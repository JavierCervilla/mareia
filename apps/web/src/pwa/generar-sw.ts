/**
 * Cómo se convierte `pwa/sw.ts` en el fichero `/sw.js` que sirve el sitio.
 *
 * Un service worker no puede pasar por el bundler de Astro: tiene que vivir en una URL fija de la
 * raíz (su ámbito es el sitio entero) y Astro solo emite bundles con hash bajo `/_astro/`. Las
 * salidas habituales son escribirlo a mano en JavaScript dentro de `public/` —fuera del `tsc`, del
 * linter y de cualquier test— o meter un bundler más en el build. Aquí se hace la tercera: el
 * worker es un `.ts` de verdad, tipado contra el protocolo y contra el contrato de módulos, y este
 * módulo le quita los tipos con **el propio Node** (`stripTypeScriptTypes`) y le pega delante las
 * constantes que necesita.
 *
 * Tres cosas que este fichero garantiza, y que son la razón de que exista en vez de tres líneas
 * sueltas en el endpoint:
 *
 * 1. **El resultado no tiene ni un `import` de runtime.** Si alguien añade uno al worker, el build
 *    se cae aquí con un mensaje que dice qué pasó, en vez de publicar un `/sw.js` que el navegador
 *    rechaza en silencio y deja a la PWA sin worker sin que nadie lo note.
 * 2. **Los bytes cambian cuando cambia algo que importa.** El navegador solo reinstala un worker si
 *    el fichero difiere byte a byte; la `VERSION` lleva el día del build y una huella del código y
 *    de las políticas, así que un despliegue con el registry de módulos cambiado reinstala, y dos
 *    builds idénticos del mismo día no.
 * 3. **Es una función pura de sus entradas**, así que se testea en Node sin construir el sitio.
 */

import { createHash } from "node:crypto";
import { stripTypeScriptTypes } from "node:module";

import type { PoliticaResuelta } from "./precacheo.ts";
import type { Protocolo } from "./protocolo.ts";

/**
 * Cualquier forma de traer código de fuera que sobreviva al borrado de tipos.
 *
 * Son **cuatro** y las cuatro tienen que estar:
 *
 * - el `import`/`export` **estático** al principio de una línea;
 * - el `import(...)` **dinámico**, que puede aparecer dentro de una función, en mitad de un fichero,
 *   y que un guardián que solo mire el principio de línea no ve — el build quedaría verde y el
 *   worker reventaría en el navegador, sin error en CI y sin nada en los logs;
 * - el `require(...)`;
 * - y **`importScripts(...)`**, que es el que más importa aunque parezca el más exótico: es la única
 *   de las cuatro que **sí funciona** en un worker clásico, así que es la única capaz de meter
 *   código sin auditar en `/sw.js` sin romper nada y sin que se note. Las otras tres fallan ruidoso
 *   en cuanto alguien abre la página; ésta no falla nunca.
 */
const FORMAS_DE_IMPORTAR: readonly (readonly [RegExp, string])[] = [
  [/^\s*(?:import|export)\s/mu, "un import/export estático"],
  [/\bimport\s*\(/u, "un import() dinámico"],
  [/\brequire\s*\(/u, "un require()"],
  [/\bimportScripts\s*\(/u, "un importScripts()"],
];

/** Longitud de la huella que va en la versión. 8 hex bastan para distinguir builds de un día. */
const LARGO_HUELLA = 8;

export interface EntradasDelWorker {
  /** El código de `pwa/sw.ts`, tal cual está en disco. */
  readonly fuente: string;
  /** Día que publica el build (`FECHA_DE_BUILD`): la mitad legible de la versión. */
  readonly fechaIso: string;
  readonly protocolo: Protocolo;
  readonly politicas: readonly PoliticaResuelta[];
}

/**
 * El `/sw.js` de este build.
 *
 * @throws {Error} si el worker, ya sin tipos, conserva algún `import`/`export` de runtime: sería un
 * módulo, y este worker se registra como script clásico a propósito (los service workers de tipo
 * módulo todavía no están en todos los navegadores que nos importan).
 */
export function generarServiceWorker(entradas: EntradasDelWorker): string {
  const cuerpo = stripTypeScriptTypes(entradas.fuente, { mode: "strip" });
  // Se busca sobre el CÓDIGO, sin comentarios ni cadenas: este fichero está lleno de prosa que
  // habla de imports, y un guardián que salta con su propia documentación acaba desactivado.
  const codigo = soloCodigo(cuerpo);
  for (const [patron, que] of FORMAS_DE_IMPORTAR) {
    if (patron.test(codigo)) {
      throw new Error(
        `apps/web/src/pwa/sw.ts tiene ${que}: el worker se sirve como fichero suelto en /sw.js, ` +
          "sin bundler y como script clásico. Usa `import type`, o inyecta el valor por el " +
          "preámbulo de generar-sw.ts.",
      );
    }
  }
  const version = versionDelWorker(entradas);
  return `${preambulo(version, entradas)}\n${cuerpo}`;
}

/** En qué parte del texto va el escáner. */
type Zona = "codigo" | "linea" | "bloque" | "cadena" | "regex";

/** Lo que el escáner hace en un carácter: qué emite, a qué zona pasa y cuántos caracteres consume. */
interface Paso {
  readonly emite: string;
  readonly zona: Zona;
  readonly saltar: number;
}

/** El blanco que sustituye a un carácter tapado, conservando los saltos de línea. */
function enBlanco(caracter: string): string {
  return caracter === "\n" ? "\n" : " ";
}

const ABRE_CADENA = new Set(['"', "'", "`"]);

/**
 * Caracteres tras los cuales una barra empieza una **expresión regular** y no una división.
 *
 * Es la heurística estándar y aquí basta: sin ella, un literal como `/['"]/u` metía al escáner en
 * modo cadena y a partir de ahí se tragaba el resto del fichero — o sea, el guardián dejaba de ver
 * lo que viniera después. Fallaba hacia el silencio, que en un guardián es la única dirección que no
 * vale.
 */
const ANTES_DE_UNA_REGEX = new Set("(,=:[!&|?{};+-*%~^<>".split(""));

/** En código: se copia tal cual, salvo que empiece un comentario, una cadena o una regex. */
function pasoEnCodigo(caracter: string, siguiente: string, anterior: string): Paso {
  if (caracter === "/" && siguiente === "/") {
    return { emite: " ", zona: "linea", saltar: 0 };
  }
  if (caracter === "/" && siguiente === "*") {
    return { emite: " ", zona: "bloque", saltar: 0 };
  }
  if (caracter === "/" && (anterior === "" || ANTES_DE_UNA_REGEX.has(anterior))) {
    return { emite: " ", zona: "regex", saltar: 0 };
  }
  return {
    emite: caracter,
    zona: ABRE_CADENA.has(caracter) ? "cadena" : "codigo",
    saltar: 0,
  };
}

/** Dentro de una expresión regular: todo en blanco hasta su barra de cierre. */
function pasoEnRegex(caracter: string, escapado: boolean): Paso {
  if (escapado) {
    return { emite: " ", zona: "regex", saltar: 0 };
  }
  return caracter === "/"
    ? { emite: " ", zona: "codigo", saltar: 0 }
    : { emite: enBlanco(caracter), zona: "regex", saltar: 0 };
}

/** En un comentario: todo en blanco hasta que se cierre. */
function pasoEnComentario(zona: "linea" | "bloque", caracter: string, siguiente: string): Paso {
  if (zona === "linea") {
    return { emite: enBlanco(caracter), zona: caracter === "\n" ? "codigo" : "linea", saltar: 0 };
  }
  return caracter === "*" && siguiente === "/"
    ? { emite: "  ", zona: "codigo", saltar: 1 }
    : { emite: enBlanco(caracter), zona: "bloque", saltar: 0 };
}

/** En una cadena: todo en blanco hasta su comilla, respetando los escapes. */
function pasoEnCadena(caracter: string, comilla: string, escapado: boolean): Paso {
  if (escapado) {
    return { emite: " ", zona: "cadena", saltar: 0 };
  }
  if (caracter === comilla) {
    return { emite: caracter, zona: "codigo", saltar: 0 };
  }
  return { emite: caracter === "\\" ? " " : enBlanco(caracter), zona: "cadena", saltar: 0 };
}

/**
 * El mismo texto con los comentarios y el contenido de las cadenas puestos en blanco.
 *
 * Es un escáner de caracteres y no una expresión regular porque una regex no distingue un
 * `import(` escrito en un comentario de uno escrito en el código, y este proyecto documenta mucho:
 * un guardián que salta con su propia documentación acaba desactivado, y desactivado no guarda
 * nada. Se conservan los saltos de línea para que el `^` de los patrones siga significando lo mismo.
 */
/** Lo que el escáner necesita saber del punto en el que va. */
interface Punto {
  readonly caracter: string;
  readonly siguiente: string;
  /** Último carácter de código no blanco, para distinguir una regex de una división. */
  readonly anterior: string;
  readonly comilla: string;
  readonly escapado: boolean;
}

/** Despacha el carácter a la zona en la que va el escáner. */
function siguientePaso(zona: Zona, punto: Punto): Paso {
  if (zona === "codigo") {
    return pasoEnCodigo(punto.caracter, punto.siguiente, punto.anterior);
  }
  if (zona === "cadena") {
    return pasoEnCadena(punto.caracter, punto.comilla, punto.escapado);
  }
  if (zona === "regex") {
    return pasoEnRegex(punto.caracter, punto.escapado);
  }
  return pasoEnComentario(zona, punto.caracter, punto.siguiente);
}

export function soloCodigo(fuente: string): string {
  const salida: string[] = [];
  let zona: Zona = "codigo";
  let comilla = "";
  let escapado = false;
  let anterior = "";

  for (let indice = 0; indice < fuente.length; indice += 1) {
    const caracter = fuente[indice] ?? "";
    const siguiente = fuente[indice + 1] ?? "";
    // La anotación no es adorno: `zona` se reasigna desde `paso.zona`, así que sin ella TypeScript
    // se muerde la cola intentando inferir el tipo y lo deja en `any`.
    const paso: Paso = siguientePaso(zona, { caracter, siguiente, anterior, comilla, escapado });

    escapado = (zona === "cadena" || zona === "regex") && !escapado && caracter === "\\";
    if (zona === "codigo" && paso.zona === "cadena") {
      comilla = caracter;
    }
    if (zona === "codigo" && caracter.trim() !== "") {
      anterior = caracter;
    }
    zona = paso.zona;
    salida.push(paso.emite);
    indice += paso.saltar;
  }
  return salida.join("");
}

/**
 * La versión del worker: el día del build y una huella de todo lo que puede cambiar su
 * comportamiento (su código, el protocolo y las políticas de los módulos activos).
 *
 * Se expone porque los tests del `dist/` la recalculan para comprobar que el fichero publicado es
 * el del código publicado, y no uno que se quedó de un build anterior.
 */
export function versionDelWorker(entradas: EntradasDelWorker): string {
  const huella = createHash("sha256")
    .update(entradas.fuente)
    .update(JSON.stringify(entradas.protocolo))
    .update(JSON.stringify(entradas.politicas))
    .digest("hex")
    .slice(0, LARGO_HUELLA);
  return `${entradas.fechaIso}-${huella}`;
}

/** Las constantes que el worker declara con `declare const` y que no puede importar. */
function preambulo(version: string, entradas: EntradasDelWorker): string {
  return [
    "// Generado por apps/web/src/pwa/generar-sw.ts a partir de apps/web/src/pwa/sw.ts.",
    "// No se edita a mano: se edita el .ts y se reconstruye el sitio.",
    `const VERSION = ${JSON.stringify(version)};`,
    `const PROTOCOLO = ${JSON.stringify(entradas.protocolo, null, 2)};`,
    `const POLITICAS = ${JSON.stringify(entradas.politicas, null, 2)};`,
  ].join("\n");
}
