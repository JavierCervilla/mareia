/**
 * Lo que el módulo declara al registry, y que es donde viven tres decisiones que no son de código:
 * qué identidad tiene, dónde se coloca su sección y qué pasa sin cobertura.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { AVISO_SIN_RED } from "../textos.ts";
import {
  ATRIBUCIONES_REGULATIONS,
  ID_SECCION_TALLAS,
  OFFLINE_REGULATIONS,
  regulationsModule,
  REGULATIONS_MODULE_VERSION,
  SECCION_TALLAS,
  SECCION_TALLAS_MINIMAS,
} from "../module.ts";

test("es un módulo propio y no una sección de pesca: identidad, versión y una sección", () => {
  assert.equal(regulationsModule.id, "regulations");
  assert.equal(regulationsModule.version, REGULATIONS_MODULE_VERSION);
  assert.equal(regulationsModule.api, undefined, "la tabla se hornea en build: no hay parte servidor");
  assert.deepEqual(regulationsModule.pageSections, [SECCION_TALLAS]);
});

test("la sección es estática y va detrás del bloque contextual, no delante", () => {
  // `static` porque una talla mínima no envejece en horas —se deroga, y de eso avisa el gate G2—,
  // así que hidratarla costaría JavaScript para no enterarse de nada nuevo.
  assert.equal(SECCION_TALLAS.renderMode, "static");
  assert.equal(SECCION_TALLAS.id, ID_SECCION_TALLAS);
  assert.equal(SECCION_TALLAS.component, SECCION_TALLAS_MINIMAS);
  // 30 > 20 (solunar y meteo): consultable, no contextual. Se viene a esta página a por la marea.
  assert.ok(SECCION_TALLAS.order > 20, `order ${SECCION_TALLAS.order} competiría con la marea`);
});

test("sin cobertura la tabla se muestra: cache-first, y sin rutas propias que precachear", () => {
  assert.equal(OFFLINE_REGULATIONS.strategy, "cache-first");
  // Decisión del humano frente a la recomendación de ocultarla. Lo que la política declara es la
  // postura, no una lista de ficheros: la tabla viaja dentro del HTML de la página.
  assert.equal(OFFLINE_REGULATIONS.routes, undefined);
  assert.equal(OFFLINE_REGULATIONS.assets, undefined);
  assert.equal(regulationsModule.offline, OFFLINE_REGULATIONS);
});

test("la atribución del BOE lleva su licencia real y el aviso de autenticidad dentro", () => {
  const [boe, ...resto] = ATRIBUCIONES_REGULATIONS;
  assert.deepEqual(resto, [], "una sola fuente: el texto consolidado del RD 560/1995");
  assert.match(boe.name, /Bolet[ií]n Oficial del Estado/u);
  // El aviso viaja en la atribución y no solo en la página: `/v1/modules` publica estos tres campos
  // y es por ahí por donde la cita sale del portal.
  assert.match(boe.name, /solo el texto publicado en el BOE tiene carácter auténtico/iu);
  assert.equal(boe.license, "Reutilización de la legislación (art. 13 Ley 37/2007 y RD 1495/2011)");
  assert.equal(boe.url, "https://www.boe.es/eli/es/rd/1995/04/07/560");
});

test("el aviso de sin-red dice la CONDICIÓN, porque sin ella la frase es falsa en las 153 páginas", () => {
  // El gate de H-4. El módulo declara `cache-first` pero no guarda nada: quien guarda la página de
  // un puerto es la caja de favoritos del core, y solo la del puerto que el lector marque
  // (`routes` vacío lo dice: este módulo no tiene ninguna URL propia que precachear). Un aviso que
  // afirme «esta tabla se guarda» a secas es, por tanto, una afirmación sobre lo que hace la
  // aplicación que es falsa por defecto en las 153 páginas donde va horneada.
  assert.equal(OFFLINE_REGULATIONS.routes, undefined, "si el módulo precacheara rutas, revisa el aviso");
  assert.match(AVISO_SIN_RED, /^Si guardas este puerto/u, "el aviso no empieza por su condición");
  assert.ok(
    !/^Esta tabla se guarda/u.test(AVISO_SIN_RED),
    "el aviso vuelve a afirmar sin condición que la tabla se guarda (hallazgo H-4)",
  );
  // La segunda mitad es la advertencia y sigue siendo verdad: no se ha suavizado al corregir la
  // primera. Es lo que sostiene que una copia guardada no puede saber si la norma sigue viva.
  assert.match(AVISO_SIN_RED, /puedes estar viendo una copia de hace semanas/u);
  assert.match(AVISO_SIN_RED, /Una talla derogada se lee igual de bien que la vigente/u);
});
