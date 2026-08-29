/**
 * El portero de la sección meteo: qué cuerpos de 200 pasan y cuáles no.
 *
 * Los que **sí** pasan son los fixtures capturados del módulo real (T-08), no JSON escritos a
 * mano: un validador que solo se prueba con lo que uno mismo inventa acaba rechazando la respuesta
 * de verdad. Los que **no** pasan son las tres entradas del hallazgo H-2 del pase adversario, que
 * llegaron con un 200 y reventaron el pintado a media sección.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { esRespuestaDeBoletin, esRespuestaDeMeteo } from "./contrato.ts";

import BOLETIN_CLAVE_CADUCADA from "./fixtures/bulletin-clave-caducada.json" with { type: "json" };
import BOLETIN_OK from "./fixtures/bulletin-ok.json" with { type: "json" };
import BOLETIN_SIN_CLAVE from "./fixtures/bulletin-sin-clave.json" with { type: "json" };
import METEO_HUECOS from "./fixtures/weather-huecos.json" with { type: "json" };
import METEO_NO_DISPONIBLE from "./fixtures/weather-no-disponible.json" with { type: "json" };
import METEO_OK from "./fixtures/weather-ok.json" with { type: "json" };
import METEO_PARCIAL from "./fixtures/weather-parcial.json" with { type: "json" };
import METEO_STALE from "./fixtures/weather-stale.json" with { type: "json" };

/** Copia profunda de un fixture, para mutarlo sin contagiar al resto de los tests. */
function copia(fixture: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(fixture)) as Record<string, unknown>;
}

test("los cinco estados reales del endpoint del mar pasan el portero", () => {
  for (const [nombre, fixture] of Object.entries({
    ok: METEO_OK,
    stale: METEO_STALE,
    parcial: METEO_PARCIAL,
    "no disponible": METEO_NO_DISPONIBLE,
    "con huecos del modelo": METEO_HUECOS,
  })) {
    assert.ok(esRespuestaDeMeteo(fixture), `el fixture ${nombre} debería pasar y no pasa`);
  }
});

test("los tres estados reales del boletín pasan el portero", () => {
  for (const [nombre, fixture] of Object.entries({
    ok: BOLETIN_OK,
    "sin clave": BOLETIN_SIN_CLAVE,
    "clave caducada": BOLETIN_CLAVE_CADUCADA,
  })) {
    assert.ok(esRespuestaDeBoletin(fixture), `el fixture ${nombre} debería pasar y no pasa`);
  }
});

// --- Las tres entradas del hallazgo H-2 ----------------------------------------------------------

test("un 200 sin el bloque marine no pasa: es un backend a medio desplegar", () => {
  assert.equal(esRespuestaDeMeteo({ port: { slug: "vigo" }, status: "ok" }), false);
});

test("un fetchedAt que no es una fecha no pasa: `Date.parse` no lo sabe leer", () => {
  const cuerpo = copia(METEO_OK);
  (cuerpo["marine"] as Record<string, unknown>)["fetchedAt"] = "ayer por la tarde";

  assert.equal(esRespuestaDeMeteo(cuerpo), false);
});

test("una magnitud que llega como cadena no pasa, aunque parezca un número", () => {
  const cuerpo = copia(METEO_OK);
  const datos = (cuerpo["forecast"] as Record<string, Record<string, unknown>>)["data"]!;
  datos["uvIndex"] = "1.3";

  assert.equal(esRespuestaDeMeteo(cuerpo), false, "'1.3' es una cadena: .toFixed() no existe ahí");
});

test("un cuerpo torcido tumba la respuesta ENTERA, no solo su mitad", () => {
  // El `marine` viene perfecto; el `forecast` no. No se publica ninguno de los dos: un cuerpo que
  // ya ha incumplido el contrato no es medio fiable.
  const cuerpo = copia(METEO_OK);
  const datos = (cuerpo["forecast"] as Record<string, Record<string, unknown>>)["data"]!;
  datos["pressureMslHpa"] = "1021,5";

  assert.equal(esRespuestaDeMeteo(cuerpo), false);
});

// --- Otras formas de que un 200 no sea lo que dice ser -------------------------------------------

test("lo que no es un objeto no pasa: ni una lista, ni una cadena, ni nulo", () => {
  for (const cuerpo of [null, "<html>502 Bad Gateway</html>", 7, [], [METEO_OK]]) {
    assert.equal(esRespuestaDeMeteo(cuerpo), false, `${JSON.stringify(cuerpo)} no es una respuesta`);
    assert.equal(esRespuestaDeBoletin(cuerpo), false, `${JSON.stringify(cuerpo)} no es un boletín`);
  }
});

test("un status que esta página no conoce no pasa: no se adivina qué quiso decir", () => {
  const cuerpo = copia(METEO_OK);
  (cuerpo["marine"] as Record<string, unknown>)["status"] = "degraded";

  assert.equal(esRespuestaDeMeteo(cuerpo), false);
});

test("un `unavailable` sin motivo no pasa: la ausencia sin su porqué es el fallo que evitamos", () => {
  const cuerpo = copia(METEO_NO_DISPONIBLE);
  delete (cuerpo["marine"] as Record<string, unknown>)["reason"];

  assert.equal(esRespuestaDeMeteo(cuerpo), false);
});

test("un null del modelo SÍ pasa: es un hueco declarado, no una avería", () => {
  const cuerpo = copia(METEO_OK);
  const datos = (cuerpo["marine"] as Record<string, Record<string, unknown>>)["data"]!;
  datos["seaSurfaceTemperatureC"] = null;

  assert.ok(esRespuestaDeMeteo(cuerpo));
});

test("un NaN no pasa aunque sea de tipo número: escribiría «NaN m» en la página", () => {
  const cuerpo = copia(METEO_OK);
  const datos = (cuerpo["marine"] as Record<string, Record<string, unknown>>)["data"]!;
  // JSON no tiene NaN; llega así cuando el cuerpo lo compone otro cliente en memoria.
  datos["waveHeightM"] = Number.NaN;

  assert.equal(esRespuestaDeMeteo(cuerpo), false);
});

test("el boletín sin hora de elaboración pasa (`null` es un valor del contrato)", () => {
  const cuerpo = copia(BOLETIN_OK);
  cuerpo["issuedAt"] = null;

  assert.ok(esRespuestaDeBoletin(cuerpo));
});

test("el boletín con una hora de elaboración ilegible no pasa", () => {
  const cuerpo = copia(BOLETIN_OK);
  cuerpo["issuedAt"] = "esta mañana";

  assert.equal(esRespuestaDeBoletin(cuerpo), false);
});

test("el boletín sin el estado de la credencial no pasa: la sección lo lee para explicarse", () => {
  const cuerpo = copia(BOLETIN_OK);
  delete cuerpo["credential"];

  assert.equal(esRespuestaDeBoletin(cuerpo), false);
});

test("un documento de AEMET con forma desconocida SÍ pasa: eso ya lo dice la vista", () => {
  const cuerpo = copia(BOLETIN_OK);
  cuerpo["document"] = [{ vaya: "otra cosa" }];

  assert.ok(esRespuestaDeBoletin(cuerpo), "el esquema del boletín costero sigue sin verificar");
});
