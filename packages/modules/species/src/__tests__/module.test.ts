/**
 * Lo que el módulo declara al registry, que es donde viven tres decisiones que no son de código:
 * qué identidad tiene, **dónde se coloca su sección** y qué promete (o no) sin cobertura.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ATRIBUCIONES_SPECIES,
  ID_SECCION_ESPECIES,
  SECCION_CATALOGO_DE_ESPECIES,
  SECCION_ESPECIES,
  speciesModule,
  SPECIES_MODULE_VERSION,
} from "../module.ts";

test("es un módulo propio y no una sección de normativa", () => {
  assert.equal(speciesModule.id, "species");
  assert.equal(speciesModule.version, SPECIES_MODULE_VERSION);
  assert.equal(speciesModule.api, undefined, "el catálogo se hornea en build: sin servidor");
  assert.deepEqual(speciesModule.pageSections, [SECCION_ESPECIES]);
});

test("la sección va la ÚLTIMA de las de módulo, porque amplía lo que ya se ha leído", () => {
  assert.equal(SECCION_ESPECIES.renderMode, "static");
  assert.equal(SECCION_ESPECIES.id, ID_SECCION_ESPECIES);
  assert.equal(SECCION_ESPECIES.component, SECCION_CATALOGO_DE_ESPECIES);
  // 12 (áreas, advertencia) < 20 (solunar y meteo, contextual) < 30 (tallas, consultable) < 35.
  // Se afirma con los cuatro números a la vista y no con un `assert.equal(35)` mudo: un enlace que
  // dice «esto que acabas de leer, en más ancho» puesto ANTES de la tabla ofrece irse de la página
  // a quien todavía no ha visto lo que ya tiene aquí horneado y sin red.
  assert.equal(SECCION_ESPECIES.order, 35);
  assert.ok(SECCION_ESPECIES.order > 30, "el enlace al catálogo iría delante de la tabla de tallas");
  // Y no se pega a 31: entre la norma y su catálogo tiene que caber un módulo que amplíe la propia
  // tabla (vedas por comunidad autónoma, por ejemplo) sin renumerar a nadie.
  assert.ok(SECCION_ESPECIES.order - 30 >= 5, "no queda hueco entre las tallas y su catálogo");
});

test("la sección se publica en TODOS los puertos: los 153 declaran caladero", () => {
  assert.equal(speciesModule.isEnabledForPort, undefined);
});

test("NO declara política offline, y eso es una afirmación: el catálogo no se guarda", () => {
  // «Un módulo sin `offline` no aparece: no declarar política no es declarar cachéalo todo, es
  // declarar que ese módulo no tiene nada que guardar» (`apps/web/src/pwa/precacheo.ts`). Aquí es
  // literal: lo que hay al otro lado del enlace no está en lo que guarda un favorito, y declarar
  // `cache-first` con su ruta habría prometido servir sin red algo que nunca entra en la caché.
  // Es el fallo que T-19 publicó en 153 páginas (hallazgo H-4) y que aquí no se repite.
  assert.equal(speciesModule.offline, undefined);
});

test("las dos fuentes van por separado y la condición de WoRMS se publica en su licencia", () => {
  const [worms, obis, ...resto] = ATRIBUCIONES_SPECIES;
  assert.deepEqual(resto, [], "dos fuentes: WoRMS y OBIS");
  assert.match(worms?.name ?? "", /WoRMS/u);
  assert.match(obis?.name ?? "", /OBIS/u);
  // Lo que esta línea impide es que alguien «cachee WoRMS entero para no depender de la red»: sus
  // condiciones de uso no permiten redistribuir la base ni partes sustanciales de ella, y lo que
  // publicamos es una extracción curada. La diferencia no es de tamaño, es de naturaleza.
  assert.match(worms?.license ?? "", /NO permiten redistribuir la base de datos entera/u);
  // Y no se mezclan en una sola entrada: son dos organismos con dos licencias, y `/v1/modules`
  // existe para poder leerlas separadas.
  assert.notEqual(worms?.license, obis?.license);
});
