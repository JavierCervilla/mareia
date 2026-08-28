/**
 * El adaptador de Open-Meteo: qué pide y qué publica.
 *
 * Ni un byte de red: el `fetch` entra inyectado y los fixtures son capturas reales de la API (ver
 * `fakes.ts`). Si Open-Meteo cambia la forma de su respuesta, este test **no** se entera — lo que
 * cubre es que nuestro mapeo y nuestra normalización no cambien por accidente.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { toCell } from "../cell.ts";
import { WeatherSourceError } from "../errors.ts";
import { fetchForecast, fetchMarine } from "../open-meteo.ts";
import { FORECAST_FIXTURE, MARINE_FIXTURE, fetchSpy } from "./fakes.ts";

const CELL = toCell(42.2406, -8.7207, Date.parse("2026-08-28T13:37:00Z"));

test("pide el estado del mar por la celda, no por la coordenada exacta del puerto", async () => {
  const spy = fetchSpy(() => MARINE_FIXTURE);
  await fetchMarine({ fetch: spy.fetch }, CELL);

  assert.equal(spy.calls.length, 1);
  const url = new URL(spy.calls[0] ?? "");
  assert.equal(url.origin + url.pathname, "https://marine-api.open-meteo.com/v1/marine");
  assert.equal(url.searchParams.get("latitude"), "42.2");
  assert.equal(url.searchParams.get("longitude"), "-8.7");
  assert.equal(url.searchParams.get("timezone"), "UTC");
  assert.match(url.searchParams.get("current") ?? "", /wave_height,.*sea_surface_temperature/u);
});

test("traduce el bloque 'current' del mar a nombres con unidad y hora con zona", async () => {
  const spy = fetchSpy(() => MARINE_FIXTURE);
  const marine = await fetchMarine({ fetch: spy.fetch }, CELL);

  assert.deepEqual(marine, {
    observedAt: "2026-08-28T13:00:00Z",
    waveHeightM: 1.74,
    waveDirectionDeg: 286,
    wavePeriodS: 9.6,
    windWaveHeightM: 0.08,
    windWaveDirectionDeg: 237,
    windWavePeriodS: 1.7,
    swellWaveHeightM: 1.74,
    swellWaveDirectionDeg: 286,
    swellWavePeriodS: 8.1,
    seaSurfaceTemperatureC: 17.9,
  });
});

test("traduce el bloque 'current' de la atmósfera", async () => {
  const spy = fetchSpy(() => FORECAST_FIXTURE);
  const forecast = await fetchForecast({ fetch: spy.fetch }, CELL);

  assert.deepEqual(forecast, {
    observedAt: "2026-08-28T13:00:00Z",
    windSpeedKmh: 13,
    windDirectionDeg: 242,
    windGustsKmh: 29.9,
    pressureMslHpa: 1021.2,
    visibilityM: 28000,
    uvIndex: 5.2,
  });
});

test("un hueco del modelo se publica como null, no como cero", async () => {
  const spy = fetchSpy(() => ({
    current: { ...MARINE_FIXTURE.current, sea_surface_temperature: null },
  }));
  const marine = await fetchMarine({ fetch: spy.fetch }, CELL);

  assert.equal(marine.seaSurfaceTemperatureC, null);
  assert.equal(marine.waveHeightM, 1.74);
});

test("un HTTP de error se convierte en WeatherSourceError con el código y sin el cuerpo", async () => {
  const spy = fetchSpy(() => new Response("<html>error page</html>", { status: 429 }));

  await assert.rejects(
    () => fetchMarine({ fetch: spy.fetch }, CELL),
    (error: unknown) => {
      assert.ok(error instanceof WeatherSourceError);
      assert.equal(error.message, "Open-Meteo marine respondió HTTP 429");
      return true;
    },
  );
});

test("una respuesta sin bloque 'current' no pasa por buena", async () => {
  const spy = fetchSpy(() => ({ error: true, reason: "No data is available for this location" }));

  await assert.rejects(
    () => fetchForecast({ fetch: spy.fetch }, CELL),
    (error: unknown) => error instanceof WeatherSourceError,
  );
});

test("la red caída sale como WeatherSourceError, no como TypeError suelto", async () => {
  const spy = fetchSpy(() => {
    throw new Error("ECONNREFUSED");
  });

  await assert.rejects(
    () => fetchMarine({ fetch: spy.fetch }, CELL),
    (error: unknown) => {
      assert.ok(error instanceof WeatherSourceError);
      assert.match(error.message, /no respondió: ECONNREFUSED/u);
      return true;
    },
  );
});
