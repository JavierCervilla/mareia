/**
 * Lo que el módulo declara al registry, que es donde viven tres decisiones que no son de código:
 * qué identidad tiene, **dónde se coloca su sección** y qué pasa sin cobertura.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ATRIBUCIONES_PROTECTED_AREAS,
  ID_SECCION_AREAS,
  OFFLINE_PROTECTED_AREAS,
  protectedAreasModule,
  PROTECTED_AREAS_MODULE_VERSION,
  SECCION_AREAS,
  SECCION_AREAS_PROTEGIDAS,
} from "../module.ts";
import { AVISO_SIN_RED } from "../textos.ts";

test("es un módulo propio y no una sección de pesca ni de normativa", () => {
  assert.equal(protectedAreasModule.id, "protected-areas");
  assert.equal(protectedAreasModule.version, PROTECTED_AREAS_MODULE_VERSION);
  assert.equal(protectedAreasModule.api, undefined, "la lista se hornea en build: sin servidor");
  assert.deepEqual(protectedAreasModule.pageSections, [SECCION_AREAS]);
});

test("la sección va la PRIMERA de las de módulo, porque es una advertencia y no una consulta", () => {
  assert.equal(SECCION_AREAS.renderMode, "static");
  assert.equal(SECCION_AREAS.id, ID_SECCION_AREAS);
  assert.equal(SECCION_AREAS.component, SECCION_AREAS_PROTEGIDAS);
  // 12 < 20 (solunar y meteo, contextual) < 30 (tallas, consultable). Es la decisión de diseño de
  // T-21 y por eso se afirma con los tres números a la vista y no con un `assert.equal(12)` mudo:
  // una advertencia que aparece después de lo que califica llega tarde.
  assert.equal(SECCION_AREAS.order, 12);
  assert.ok(SECCION_AREAS.order < 20, `order ${SECCION_AREAS.order} caería debajo de la meteo`);
  // Y no se pega al suelo: debajo tiene que quedar sitio para un aviso más duro (uno que dependa
  // del día y no del sitio) sin renumerar a nadie.
  assert.ok(SECCION_AREAS.order > 10, "por debajo de 10 no queda hueco para un aviso más urgente");
});

test("la sección se publica en TODOS los puertos, también en los que no tienen ninguna área", () => {
  // El filtro que la escondería en los 10 puertos sin área es justo el que convierte una respuesta
  // en un silencio. `isEnabledForPort` omitido = aplica en los 153.
  assert.equal(protectedAreasModule.isEnabledForPort, undefined);
});

test("sin cobertura la lista se muestra: cache-first, y sin rutas propias que precachear", () => {
  assert.equal(OFFLINE_PROTECTED_AREAS.strategy, "cache-first");
  // Lo que la política declara es la postura, no una lista de ficheros: la lista viaja dentro del
  // HTML de la página, que la caja de favoritos guarda cuando el lector marca el puerto.
  assert.equal(OFFLINE_PROTECTED_AREAS.routes, undefined);
  assert.equal(OFFLINE_PROTECTED_AREAS.assets, undefined);
  assert.equal(OFFLINE_PROTECTED_AREAS.maxAgeSeconds, undefined);
  assert.equal(protectedAreasModule.offline, OFFLINE_PROTECTED_AREAS);
});

test("la atribución dice el hueco de licencia tal cual, sin maquillarlo", () => {
  const [rampe, ...resto] = ATRIBUCIONES_PROTECTED_AREAS;
  assert.deepEqual(resto, [], "una sola fuente: RAMPE 2025");
  assert.equal(rampe.license, "MITECO · RAMPE 2025 — condiciones de uso no declaradas en origen");
  // Las dos maneras de maquillarlo: inventarle una licencia que otras fuentes del MITECO sí llevan,
  // o dejarlo en un «desconocida» que esconde que el hueco es DE ORIGEN y no nuestro.
  assert.ok(!/CC-?BY/iu.test(rampe.license), "a esta fuente no se le puede poner una CC");
  assert.match(rampe.license, /no declaradas en origen/u);
  assert.match(rampe.name, /RAMPE 2025/u);
  assert.match(rampe.url, /^https:\/\/www\.miteco\.gob\.es\//u);
});

test("el aviso de sin-red empieza por su CONDICIÓN: es la lección H-4 de T-19", () => {
  // El módulo declara `cache-first` pero no guarda nada: quien guarda la página de un puerto es la
  // caja de favoritos del core, y solo la del puerto que el lector marque (`routes` vacío lo dice).
  // Una frase que afirme «esta lista se guarda» a secas es falsa por defecto en las 153 páginas.
  assert.equal(OFFLINE_PROTECTED_AREAS.routes, undefined, "si precacheara rutas, revisa el aviso");
  assert.match(AVISO_SIN_RED, /^Si guardas este puerto/u, "el aviso no empieza por su condición");
  assert.ok(!/^Esta lista se guarda/u.test(AVISO_SIN_RED));
  assert.match(AVISO_SIN_RED, /puede ser una copia de hace semanas/u);
});
