/**
 * La generación de `/sw.js`, con dos gates que valen por sí solos toda la maquinaria.
 *
 *  1. **El worker publicado no puede tener imports de runtime.** Se sirve como fichero suelto en la
 *     raíz, sin bundler y como script clásico: un `import` lo dejaría inservible, y el navegador no
 *     dice nada — simplemente no hay PWA. Que rompa el build.
 *  2. **Los bytes tienen que cambiar cuando cambia el comportamiento.** El navegador solo reinstala
 *     un service worker si el fichero difiere byte a byte; un worker cuya versión no se mueve al
 *     cambiar el código es exactamente cómo un sitio se queda con un worker de hace tres semanas.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { activeModules } from "../modules.config.ts";
import { generarServiceWorker, versionDelWorker } from "./generar-sw.ts";
import type { EntradasDelWorker } from "./generar-sw.ts";
import { politicasDeModulos } from "./precacheo.ts";
import { PROTOCOLO } from "./protocolo.ts";

const AQUI = dirname(fileURLToPath(import.meta.url));
const FUENTE = readFileSync(join(AQUI, "sw.ts"), "utf8");

function entradas(cambios: Partial<EntradasDelWorker> = {}): EntradasDelWorker {
  return {
    fuente: FUENTE,
    fechaIso: "2026-08-29",
    protocolo: PROTOCOLO,
    politicas: politicasDeModulos(activeModules),
    ...cambios,
  };
}

test("el worker publicado no tiene ni un import ni un export de runtime", () => {
  const worker = generarServiceWorker(entradas());

  assert.doesNotMatch(worker, /^\s*import\s/mu);
  assert.doesNotMatch(worker, /^\s*export\s/mu);
  assert.doesNotMatch(worker, /\brequire\(/u);
});

test("si alguien le mete un import al worker, el build se cae diciendo qué pasa", () => {
  assert.throws(
    () => generarServiceWorker(entradas({ fuente: `import { x } from "./y.ts";\n${FUENTE}` })),
    /import\/export de runtime/u,
  );
});

test("el preámbulo declara las tres constantes que el worker no puede importar", () => {
  const worker = generarServiceWorker(entradas());

  assert.match(worker, /^const VERSION = "/mu);
  assert.match(worker, /^const PROTOCOLO = \{/mu);
  assert.match(worker, /^const POLITICAS = \[/mu);
});

test("el protocolo inyectado es el mismo objeto que usa la página: un solo sitio para los literales", () => {
  const worker = generarServiceWorker(entradas());
  const inyectado = /^const PROTOCOLO = (\{[\s\S]*?\n\});$/mu.exec(worker)?.[1];

  assert.ok(inyectado);
  assert.deepEqual(JSON.parse(inyectado), PROTOCOLO);
});

test("las rutas que enruta el worker son las que declara el registry, no literales suyos", () => {
  const worker = generarServiceWorker(entradas());
  const rutas = politicasDeModulos(activeModules).flatMap((politica) => politica.rutas);

  assert.ok(rutas.length > 0, "el registry real declara al menos una ruta de módulo");
  for (const ruta of rutas) {
    assert.ok(worker.includes(ruta), `el worker no lleva la ruta declarada ${ruta}`);
  }
  // Y el CÓDIGO del worker no las conoce: solo las ve por el preámbulo inyectado.
  assert.ok(!FUENTE.includes("/v1/modules/"), "el worker no puede tener rutas de módulo escritas");
});

test("la versión cambia si cambia el código del worker", () => {
  assert.notEqual(
    versionDelWorker(entradas()),
    versionDelWorker(entradas({ fuente: `${FUENTE}\n// un cambio\n` })),
  );
});

test("la versión cambia si cambian las políticas de los módulos activos", () => {
  assert.notEqual(
    versionDelWorker(entradas()),
    versionDelWorker(entradas({ politicas: [] })),
  );
});

test("la versión cambia de un día a otro, que es cuando el rebuild diario publica otro almanaque", () => {
  assert.notEqual(versionDelWorker(entradas()), versionDelWorker(entradas({ fechaIso: "2026-08-30" })));
});

test("dos builds iguales del mismo día dan el MISMO fichero: nada de churn gratuito", () => {
  assert.equal(generarServiceWorker(entradas()), generarServiceWorker(entradas()));
});

test("la versión lleva el día delante, para poder leerla en producción sin descifrar nada", () => {
  assert.match(versionDelWorker(entradas()), /^2026-08-29-[0-9a-f]{8}$/u);
});

// =================================================================================================
// La política de actualización, comprobada en el código publicado (ADR-02).
// =================================================================================================

test("el worker NO llama a skipWaiting: no le cambia el motor a una pestaña que se está leyendo", () => {
  assert.doesNotMatch(generarServiceWorker(entradas()), /skipWaiting\s*\(/u);
});

test("las navegaciones van a la red antes que a la copia: nunca una página vieja con cobertura", () => {
  // La copia solo se consulta en el `catch` del `fetch`, es decir, cuando la red ha fallado.
  const cuerpo = /async function laPaginaDeLaRedODeLaCopia[\s\S]*?\n\}/u.exec(FUENTE)?.[0];
  assert.ok(cuerpo, "no encuentro la estrategia de navegación en el worker");

  const posicionFetch = cuerpo.indexOf("await fetch(peticion)");
  const posicionCopia = cuerpo.indexOf("cache.match(peticion)");
  assert.ok(posicionFetch >= 0 && posicionCopia >= 0);
  assert.ok(
    posicionFetch < cuerpo.indexOf("catch"),
    "el fetch a la red tiene que ir antes del catch que sirve la copia",
  );
});
