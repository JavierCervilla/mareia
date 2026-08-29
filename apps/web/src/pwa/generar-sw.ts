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
 * Son **tres** y las tres tienen que estar: el `import`/`export` estático al principio de una línea,
 * el `import(...)` dinámico —que puede aparecer dentro de una función, en mitad de un fichero, y
 * que un guardián que solo mire el principio de línea no ve— y el `require(...)`. El dinámico es el
 * peligroso justo por eso: el build quedaría verde y el worker reventaría en el navegador, que es
 * exactamente el fallo silencioso que este guardián existe para impedir.
 */
const FORMAS_DE_IMPORTAR: readonly (readonly [RegExp, string])[] = [
  [/^\s*(?:import|export)\s/mu, "un import/export estático"],
  [/\bimport\s*\(/u, "un import() dinámico"],
  [/\brequire\s*\(/u, "un require()"],
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
type Zona = "codigo" | "linea" | "bloque" | "cadena";

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

/** En código: se copia tal cual, salvo que empiece un comentario o una cadena. */
function pasoEnCodigo(caracter: string, siguiente: string): Paso {
  if (caracter === "/" && siguiente === "/") {
    return { emite: " ", zona: "linea", saltar: 0 };
  }
  if (caracter === "/" && siguiente === "*") {
    return { emite: " ", zona: "bloque", saltar: 0 };
  }
  return {
    emite: caracter,
    zona: ABRE_CADENA.has(caracter) ? "cadena" : "codigo",
    saltar: 0,
  };
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
export function soloCodigo(fuente: string): string {
  const salida: string[] = [];
  let zona: Zona = "codigo";
  let comilla = "";
  let escapado = false;

  for (let indice = 0; indice < fuente.length; indice += 1) {
    const caracter = fuente[indice] ?? "";
    const siguiente = fuente[indice + 1] ?? "";
    // La anotación no es adorno: `zona` se reasigna desde `paso.zona`, así que sin ella TypeScript
    // se muerde la cola intentando inferir el tipo y lo deja en `any`.
    const paso: Paso =
      zona === "codigo"
        ? pasoEnCodigo(caracter, siguiente)
        : zona === "cadena"
          ? pasoEnCadena(caracter, comilla, escapado)
          : pasoEnComentario(zona, caracter, siguiente);

    escapado = zona === "cadena" && !escapado && caracter === "\\";
    if (zona === "codigo" && paso.zona === "cadena") {
      comilla = caracter;
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
