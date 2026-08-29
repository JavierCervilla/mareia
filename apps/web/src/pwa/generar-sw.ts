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

/** Un `import`/`export` que sobreviva al borrado de tipos: es decir, uno de runtime. */
const IMPORT_DE_RUNTIME = /^\s*(?:import|export)\s/mu;

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
  if (IMPORT_DE_RUNTIME.test(cuerpo)) {
    throw new Error(
      "apps/web/src/pwa/sw.ts tiene un import/export de runtime: el worker se sirve como fichero " +
        "suelto en /sw.js y no pasa por ningún bundler. Usa `import type`, o inyecta el valor por " +
        "el preámbulo de generar-sw.ts.",
    );
  }
  const version = versionDelWorker(entradas);
  return `${preambulo(version, entradas)}\n${cuerpo}`;
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
