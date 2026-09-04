/**
 * Lo que el módulo dice de los periodos, sin astronomía de por medio.
 *
 * Los periodos son de mentira **a propósito**: lo que se verifica aquí es la traducción a texto y a
 * ventanas, no el cálculo — ése ya tiene sus tests exactos y golden en `domain-core/src/solunar/`.
 * Duplicarlos aquí daría una red de seguridad falsa: dos sitios afirmando lo mismo sobre el mismo
 * código. Que las horas que acaban en el HTML sean las del dominio se verifica contra el `dist/`
 * construido, en `apps/web/src/solunar-construido.test.ts`.
 */

import test from "node:test";
import assert from "node:assert/strict";

import type { FormatoDeActividad, PeriodoSolunar, RatingSolunar } from "../actividad.ts";
import {
  desgloseDelRating,
  filasDeActividad,
  franjaDePeriodo,
  nombreDeEtiqueta,
  ventanasDeActividad,
} from "../actividad.ts";
import {
  ATRIBUCIONES_FISHING,
  fishingModule,
  SECCION_ACTIVIDAD_SOLUNAR,
  SECCION_OBSERVACIONES_DEL_DIA,
} from "../module.ts";
import * as modulo from "../index.ts";
import {
  AVISO_SIN_RESPALDO,
  QUE_ES_ESTO,
  RATING_ES_CONVENCION,
  ROTULO_DEL_RATING,
} from "../textos.ts";

const HORA = 3_600_000;
const INICIO_DIA = Date.parse("2026-08-28T00:00:00Z");
const FIN_DIA = INICIO_DIA + 24 * HORA;
const DIA = { inicioUtcMs: INICIO_DIA, finUtcMs: FIN_DIA };

/** Formateador de mentira: UTC y coma decimal, sin `Intl` ni zona horaria que enredar el assert. */
const FORMATO: FormatoDeActividad = {
  hora: (timeUtcMs) => new Date(timeUtcMs).toISOString().slice(11, 16),
  numero: (valor, decimales = 2) => valor.toFixed(decimales).replace(".", ","),
};

/** Un periodo mayor centrado en el mediodía: entero dentro del día. */
const MAYOR: PeriodoSolunar = {
  kind: "major",
  anchor: "upper-transit",
  startUtcMs: INICIO_DIA + 11 * HORA,
  peakUtcMs: INICIO_DIA + 12 * HORA,
  endUtcMs: INICIO_DIA + 13 * HORA,
  overlapsSolarEvent: false,
};

/** Un menor cuyo fenómeno cae en el día pero cuya ventana desborda por el final. */
const MENOR_QUE_DESBORDA: PeriodoSolunar = {
  kind: "minor",
  anchor: "moonset",
  startUtcMs: FIN_DIA - 45 * 60_000,
  peakUtcMs: FIN_DIA - 15_000,
  endUtcMs: FIN_DIA + 45 * 60_000,
  overlapsSolarEvent: true,
};

/** Y otro que desborda por el principio: su fenómeno es de este día, su ventana empieza ayer. */
const MENOR_DEL_ALBA: PeriodoSolunar = {
  kind: "minor",
  anchor: "moonrise",
  startUtcMs: INICIO_DIA - 30 * 60_000,
  peakUtcMs: INICIO_DIA + 15 * 60_000,
  endUtcMs: INICIO_DIA + 60 * 60_000,
  overlapsSolarEvent: false,
};

test("el módulo cumple el contrato: dos secciones estáticas y atribuciones que existen", () => {
  assert.equal(fishingModule.id, "fishing");
  // Desde T-22-A el módulo aporta DOS secciones: la actividad solunar y las observaciones del día.
  // Van separadas y no como un bloque dentro de la primera porque la solunar habla de la Luna y las
  // observaciones cruzan Luna, marea y Sol: metidas dentro, la sección solunar pasaría a depender de
  // los datos de marea del puerto y dejaría de poder darse de baja sola.
  assert.deepEqual(fishingModule.pageSections?.map((seccion) => seccion.component), [
    SECCION_ACTIVIDAD_SOLUNAR,
    SECCION_OBSERVACIONES_DEL_DIA,
  ]);
  for (const seccion of fishingModule.pageSections ?? []) {
    assert.equal(seccion.renderMode, "static", `${seccion.id}: el core no lleva JS`);
  }
  assert.ok(ATRIBUCIONES_FISHING.length > 0, "un módulo sin atribuciones no se publica");
  for (const atribucion of ATRIBUCIONES_FISHING) {
    assert.match(atribucion.url, /^https:\/\//, `${atribucion.name} sin URL absoluta`);
    assert.ok(atribucion.license.length > 0, `${atribucion.name} sin licencia`);
  }
});

test("una ventana que cabe en el día se escribe sin coletillas", () => {
  assert.equal(franjaDePeriodo(MAYOR, DIA, FORMATO), "de 11:00 a 13:00");
});

test("una ventana que desborda la medianoche dice a qué día se va", () => {
  assert.equal(franjaDePeriodo(MENOR_QUE_DESBORDA, DIA, FORMATO), "de 23:15 a 00:45 del día siguiente");
  assert.equal(franjaDePeriodo(MENOR_DEL_ALBA, DIA, FORMATO), "de 23:30 del día anterior a 01:00");
});

test("las ventanas del gráfico llevan los instantes REALES, sin recortar al día", () => {
  const ventanas = ventanasDeActividad([MENOR_DEL_ALBA, MAYOR, MENOR_QUE_DESBORDA], DIA, FORMATO);

  assert.equal(ventanas[0]?.inicioUtcMs, MENOR_DEL_ALBA.startUtcMs, "recortar aquí sería mentir");
  assert.equal(ventanas[2]?.finUtcMs, MENOR_QUE_DESBORDA.endUtcMs);
  assert.deepEqual(
    ventanas.map((ventana) => ventana.enfasis),
    ["suave", "fuerte", "suave"],
    "los mayores pesan más que los menores",
  );
  assert.equal(new Set(ventanas.map((ventana) => ventana.id)).size, 3, "ids repetidos en un día");
  assert.equal(ventanas[1]?.etiqueta, "periodo mayor de 11:00 a 13:00");
});

test("la tabla nombra el fenómeno de cada periodo y su instante central", () => {
  const filas = filasDeActividad([MAYOR, MENOR_QUE_DESBORDA], DIA, FORMATO);

  assert.deepEqual(filas.map((fila) => fila.tipo), ["mayor", "menor"]);
  assert.match(filas[0]?.ancla ?? "", /Luna/);
  assert.equal(filas[0]?.pico, "12:00");
  assert.deepEqual(filas.map((fila) => fila.coincideConElSol), [false, true]);
});

/**
 * El desglose **no recalcula** el rating: publica el que trae el dominio y enseña la suma que lo
 * produce. Por eso el caso elegido es el peligroso — 79,6 + 20 = 99,6 — donde redondear por
 * separado daría el 100 que la fórmula reserva para la exactitud.
 */
test("el desglose enseña la suma sin redondear y publica el score del dominio", () => {
  const rating: RatingSolunar = {
    score: 99,
    label: "muy-alta",
    moonScore: 79.6,
    solarBonus: 20,
    daysFromSyzygy: 2.4,
    solarOverlapCount: 2,
  };

  const desglose = desgloseDelRating(rating, FORMATO);

  assert.equal(desglose.totalSinRedondear, 99.6);
  assert.equal(desglose.score, 99, "el 100 es de la fórmula, no del redondeo de la página");
  assert.equal(desglose.etiqueta, "Muy alta");
  assert.deepEqual(desglose.factores.map((factor) => factor.puntos), [79.6, 20]);
  assert.match(desglose.factores[0].detalle, /2,4 días/);
  assert.match(desglose.factores[1].detalle, /2 periodos del día caen/);
});

test("el desglose escribe bien el recuento cuando no hay coincidencias con el Sol", () => {
  const rating: RatingSolunar = {
    score: 30,
    label: "baja",
    moonScore: 30,
    solarBonus: 0,
    daysFromSyzygy: 7.4,
    solarOverlapCount: 0,
  };

  const desglose = desgloseDelRating(rating, FORMATO);

  assert.match(desglose.factores[1].detalle, /Ningún periodo del día cae/);
  assert.equal(desglose.etiqueta, "Baja");
});

test("una etiqueta que el módulo no conoce se publica cruda, no se inventa", () => {
  assert.equal(nombreDeEtiqueta("excepcional"), "excepcional");
});

/**
 * Lo que la regla prohíbe decir. Creció con el hallazgo A-16 del pase adversario, que publicó «Hoy
 * pican seguro» en las 12 páginas **sin que la lista se enterara**: prometer pesca no necesita la
 * palabra «garantizado», basta con el presente de indicativo y un adverbio. Se prohíben las formas
 * que afirman la captura («pican», «picarán»), las que la aseguran («asegura», «seguro»,
 * «garantiza») y las que la venden («promete», «infalible»).
 *
 * Ojo al escribirla: `RATING_ES_CONVENCION` contiene «cuánto pica hoy» —una pregunta, no una
 * promesa— y `AVISO_SIN_RESPALDO` contiene «no una predicción de capturas». Prohibir `/pica/` o
 * `/predicci/` a secas tumbaría los dos textos que sostienen la honestidad de la sección.
 */
const PROMESAS_PROHIBIDAS = /garantiz|infalible|pican|picar[áa]|asegura|seguro|promete/i;

/**
 * El requisito de producto de T-10: la sección declara que la teoría no está respaldada y no
 * promete pesca. Aquí se vigila el **texto**; que llegue a las 12 páginas lo vigila el test del
 * `dist/`.
 *
 * La lista negra se aplica a **todas las cadenas de la superficie pública del package** —se recorre
 * `index.ts`, no `textos.ts`—, y eso es exactamente el conjunto que el gate A-16 del `dist/` declara
 * auditado (`Object.values(fishing)`). Que los dos conjuntos coincidan **no es cosmético**: mientras
 * este guardián solo miraba `textos.ts`, quedaba una rendija por la que cabía el ataque original —
 * exportar el rótulo desde `module.ts`, que A-16 acepta como «texto auditado» y esta lista no
 * miraba— y las 12 páginas volvían a publicar «Hoy pican seguro» con los dos gates en verde.
 * Recorriendo el índice, un texto nuevo nace vigilado viva donde viva y no hay que acordarse.
 */
test("los textos declaran la convención y no prometen capturas", () => {
  assert.match(AVISO_SIN_RESPALDO, /no tiene respaldo experimental sólido/);
  assert.match(RATING_ES_CONVENCION, /una convención, no una medida/);
  assert.match(QUE_ES_ESTO, /Knight/);
  assert.match(ROTULO_DEL_RATING, /convención/);

  const publicados = Object.entries(modulo).filter(
    (entrada): entrada is [string, string] => typeof entrada[1] === "string",
  );
  assert.ok(publicados.length >= 12, `¿se han perdido textos? solo ${publicados.length}`);
  for (const [nombre, texto] of publicados) {
    assert.doesNotMatch(texto, PROMESAS_PROHIBIDAS, `${nombre} promete: ${texto}`);
  }
});
