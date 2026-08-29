/**
 * El adaptador de AEMET: el patrón de dos llamadas, el trato de la API key y la degradación.
 *
 * El esquema del boletín costero **no se puede verificar sin clave**, así que lo que se prueba aquí
 * es el *mecanismo* —los dos saltos, la cabecera, el charset, el origen de la URL temporal, el
 * fallo limpio sin clave— y no la forma del documento, que se pasa tal cual.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { fetchCoastalBulletin } from "../aemet.ts";
import { WeatherSourceError } from "../errors.ts";
import { zoneForPort } from "../zones.ts";
import { fetchSpy } from "./fakes.ts";

const BASE = "https://aemet.test/opendata/api";
const DATOS = "https://aemet.test/opendata/sh/deadbeef";
const ZONE = { code: "36", name: "Costa de Pontevedra", verified: false };
const KEY = "clave-de-mentira";

const DOCUMENT = [
  {
    origen: { productor: "AEMET", copyright: "© AEMET" },
    elaborado: "2026-08-28T11:00:00Z",
    nombre: "Costa de Pontevedra",
    prediccion: { texto: "Viento del noroeste fuerza 4 a 5, mar rizada o marejada." },
  },
];

/** Doble de AEMET completo: sobre con URL temporal + documento. */
function aemetSpy(document: unknown = DOCUMENT) {
  return fetchSpy((url) => {
    if (url.startsWith(`${BASE}/prediccion/maritima/costera/costa/`)) {
      return { descripcion: "exito", estado: 200, datos: DATOS, metadatos: `${BASE}/metadatos` };
    }
    if (url === DATOS) {
      return document;
    }
    throw new Error(`URL inesperada: ${url}`);
  });
}

test("sin clave de AEMET no se sale a la red y el motivo lo dice sin nombrar el secreto", async () => {
  const spy = aemetSpy();

  await assert.rejects(
    () => fetchCoastalBulletin({ fetch: spy.fetch, baseUrl: BASE }, ZONE),
    (error: unknown) => {
      assert.ok(error instanceof WeatherSourceError);
      assert.match(error.message, /no está configurada/u);
      // Este motivo acaba en el `reason` de la respuesta pública, así que no nombra la variable
      // de entorno: eso es del canal del operador (T-18).
      assert.doesNotMatch(error.message, /AEMET_API_KEY/u);
      return true;
    },
  );
  assert.equal(spy.calls.length, 0, "se intentó llamar a AEMET sin clave");
});

test("una clave vacía o en blanco cuenta como no configurada", async () => {
  const spy = aemetSpy();
  await assert.rejects(() =>
    fetchCoastalBulletin({ fetch: spy.fetch, baseUrl: BASE, apiKey: "   " }, ZONE),
  );
  assert.equal(spy.calls.length, 0);
});

test("dos llamadas: sobre con URL temporal y luego el documento", async () => {
  const spy = aemetSpy();
  const bulletin = await fetchCoastalBulletin({ fetch: spy.fetch, baseUrl: BASE, apiKey: KEY }, ZONE);

  assert.deepEqual(spy.calls, [`${BASE}/prediccion/maritima/costera/costa/36`, DATOS]);
  assert.deepEqual(bulletin.zone, ZONE);
  assert.equal(bulletin.issuedAt, "2026-08-28T11:00:00Z");
  assert.deepEqual(bulletin.document, DOCUMENT);
});

test("la API key viaja en la cabecera y NUNCA en la URL", async () => {
  const spy = aemetSpy();
  await fetchCoastalBulletin({ fetch: spy.fetch, baseUrl: BASE, apiKey: KEY }, ZONE);

  for (const request of spy.requests) {
    assert.ok(!request.url.includes(KEY), `la clave se coló en la URL: ${request.url}`);
  }
  assert.equal(spy.requests[0]?.headers["api_key"], KEY);
  assert.equal(spy.requests[1]?.headers["api_key"], undefined, "la URL temporal ya está firmada");
});

test("un documento en ISO-8859-15 se decodifica con su charset, no como UTF-8", async () => {
  const latin = '[{"elaborado":"2026-08-28T11:00:00Z","zona":"Costa de Cádiz"}]';
  const bytes = Uint8Array.from(latin, (char) => char.charCodeAt(0));
  const spy = fetchSpy((url) =>
    url === DATOS
      ? new Response(bytes, {
          status: 200,
          headers: { "content-type": "application/json; charset=ISO-8859-15" },
        })
      : { estado: 200, datos: DATOS },
  );

  const bulletin = await fetchCoastalBulletin({ fetch: spy.fetch, baseUrl: BASE, apiKey: KEY }, ZONE);

  assert.deepEqual(bulletin.document, [
    { elaborado: "2026-08-28T11:00:00Z", zona: "Costa de Cádiz" },
  ]);
});

test("una URL temporal de otro origen no se sigue", async () => {
  const spy = fetchSpy((url) =>
    url === DATOS ? DOCUMENT : { estado: 200, datos: "https://malo.example/robar" },
  );

  await assert.rejects(
    () => fetchCoastalBulletin({ fetch: spy.fetch, baseUrl: BASE, apiKey: KEY }, ZONE),
    (error: unknown) => {
      assert.ok(error instanceof WeatherSourceError);
      assert.match(error.message, /origen que no es el suyo/u);
      return true;
    },
  );
  assert.equal(spy.calls.length, 1, "se llegó a pedir la URL ajena");
});

test("un estado de error de AEMET sale como fallo de la fuente", async () => {
  const spy = fetchSpy(() => ({ descripcion: "API key inválido", estado: 401 }));

  await assert.rejects(
    () => fetchCoastalBulletin({ fetch: spy.fetch, baseUrl: BASE, apiKey: KEY }, ZONE),
    (error: unknown) => {
      assert.ok(error instanceof WeatherSourceError);
      assert.match(error.message, /estado 401/u);
      return true;
    },
  );
});

test("un documento sin fecha de elaboración da issuedAt null, no una fecha inventada", async () => {
  const spy = aemetSpy([{ nombre: "Costa de Pontevedra" }]);
  const bulletin = await fetchCoastalBulletin({ fetch: spy.fetch, baseUrl: BASE, apiKey: KEY }, ZONE);

  assert.equal(bulletin.issuedAt, null);
});

test("la zona de un puerto sale del JSON de configuración", () => {
  assert.deepEqual(zoneForPort("vigo"), {
    code: "36",
    name: "Costa de Pontevedra",
    verified: false,
  });
  assert.equal(zoneForPort("no-existe"), undefined);
});
