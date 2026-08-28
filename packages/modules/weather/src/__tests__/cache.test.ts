/**
 * La celda, la caché y la política de degradación: el corazón de «no machacar a la fuente».
 *
 * El test de oro del módulo está aquí: **la segunda llamada dentro de la misma celda no sale a la
 * red**. Si alguien rompe la clave de caché o el TTL, esto se pone rojo antes de que Open-Meteo nos
 * corte el grifo en producción.
 *
 * Los escenarios reconstruyen la clave en cada resolución (`marineRequest`) en vez de calcularla
 * una vez al principio: una clave congelada en el test es una clave que no se parece a la de
 * producción y que no vería una clave que rota con el reloj.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryWeatherCache, type WeatherCache } from "../cache.ts";
import { cellKey, toCell } from "../cell.ts";
import { fetchMarine } from "../open-meteo.ts";
import { resolveSource, type SourceRequest } from "../source.ts";
import type { MarineConditions } from "../open-meteo.ts";
import { MARINE_FIXTURE, fakeClock, fetchSpy, type FetchSpy } from "./fakes.ts";

const T0 = Date.parse("2026-08-28T13:37:00Z");
const HOUR_SECONDS = 3_600;
const VIGO = { lat: 42.2406, lon: -8.7207 };

/**
 * La petición de la fuente marine, construida **en el momento de resolverla** y no una vez fuera
 * del escenario: la clave se recalcula con el reloj ya avanzado, igual que hace el módulo en cada
 * request. Construirla una sola vez congelaría la clave en el test y dejaría sin ejercer justo el
 * cableado que hay que defender —que la clave no dependa del reloj—, que es como se coló el bug de
 * la hora en la clave.
 */
function marineRequest(
  cache: WeatherCache,
  clock: { now: () => number },
  spy: FetchSpy,
): SourceRequest<MarineConditions> {
  const cell = toCell(VIGO.lat, VIGO.lon);
  return {
    cache,
    key: cellKey("marine", cell),
    ttlSeconds: HOUR_SECONDS,
    retainSeconds: 4 * HOUR_SECONDS,
    now: clock.now,
    load: () => fetchMarine({ fetch: spy.fetch }, cell),
  };
}

test("la celda redondea las coordenadas a 0,1°", () => {
  assert.deepEqual(toCell(VIGO.lat, VIGO.lon), { lat: 42.2, lon: -8.7 });
});

test("dos fondeaderos dentro de la misma celda comparten clave; un puerto lejano, no", () => {
  const vigo = toCell(VIGO.lat, VIGO.lon);
  const bouzas = toCell(42.2313, -8.742);
  const coruna = toCell(43.3623, -8.3927);

  assert.equal(cellKey("marine", vigo), cellKey("marine", bouzas));
  assert.notEqual(cellKey("marine", vigo), cellKey("marine", coruna));
});

test("la malla es fija: dos puntos a un lado y otro de un borde NO colapsan", () => {
  // Cangas está a 4 km de Vigo pero al otro lado del borde de 42,25°: celdas distintas y dos
  // peticiones. Es el precio de una malla fija, y se documenta aquí para que nadie lo lea como bug.
  const vigo = toCell(VIGO.lat, VIGO.lon);
  const cangas = toCell(42.2637, -8.7869);
  assert.notEqual(cellKey("marine", vigo), cellKey("marine", cangas));
});

test("la clave no arrastra un -0 en las longitudes justo al este de Greenwich", () => {
  const cell = toCell(37.6338, -0.02);
  assert.equal(cell.lon, 0);
  assert.equal(cellKey("marine", cell), "w1:marine:37.6:0.0");
});

test("la clave es exactamente esquema + fuente + celda: ni instante ni nada que rote", () => {
  // Afirmación sobre la forma entera, no un `match`: si alguien vuelve a colgarle la hora, la clave
  // rotaría en la hora en punto y el dato guardado dejaría de encontrarse justo cuando hace falta.
  assert.equal(cellKey("marine", toCell(VIGO.lat, VIGO.lon)), "w1:marine:42.2:-8.7");
  assert.equal(cellKey("forecast", toCell(VIGO.lat, VIGO.lon)), "w1:forecast:42.2:-8.7");
});

test("ORO: la segunda llamada a la misma celda no sale a la red", async () => {
  const clock = fakeClock(T0);
  const cache = createMemoryWeatherCache(clock.now);
  const spy = fetchSpy(() => MARINE_FIXTURE);

  const first = await resolveSource(marineRequest(cache, clock, spy));
  clock.advance(90_000);
  const second = await resolveSource(marineRequest(cache, clock, spy));

  assert.equal(spy.calls.length, 1, "la segunda llamada salió a la red");
  assert.equal(first.status, "ok");
  assert.equal(second.status, "ok");
  if (second.status !== "ok" || first.status !== "ok") {
    return;
  }
  assert.equal(second.stale, false);
  assert.deepEqual(second.data, first.data);
  assert.equal(second.fetchedAt, first.fetchedAt, "fetchedAt es el de la fuente, no el de la lectura");
  assert.equal(first.ageSeconds, 0);
  assert.equal(second.ageSeconds, 90, "la edad crece aunque el dato sea el mismo");
});

test("pasado el TTL se vuelve a la fuente y la edad se reinicia", async () => {
  const clock = fakeClock(T0);
  const cache = createMemoryWeatherCache(clock.now);
  const spy = fetchSpy(() => MARINE_FIXTURE);

  await resolveSource(marineRequest(cache, clock, spy));
  clock.advance((HOUR_SECONDS + 1) * 1000);
  const refreshed = await resolveSource(marineRequest(cache, clock, spy));

  assert.equal(spy.calls.length, 2);
  assert.equal(refreshed.status === "ok" && refreshed.ageSeconds, 0);
});

test("si la fuente falla y queda dato caducado, se sirve marcado como stale", async () => {
  const clock = fakeClock(T0);
  const cache = createMemoryWeatherCache(clock.now);
  let caida = false;
  const spy = fetchSpy(() => {
    if (caida) {
      throw new Error("ECONNREFUSED");
    }
    return MARINE_FIXTURE;
  });
  await resolveSource(marineRequest(cache, clock, spy));
  clock.advance(2 * HOUR_SECONDS * 1000);
  caida = true;
  const degraded = await resolveSource(marineRequest(cache, clock, spy));

  assert.equal(degraded.status, "ok");
  assert.equal(degraded.status === "ok" && degraded.stale, true);
  assert.equal(degraded.status === "ok" && degraded.ageSeconds, 2 * HOUR_SECONDS);
});

test("si la fuente falla y la ventana dura ya expiró, la fuente queda unavailable", async () => {
  const clock = fakeClock(T0);
  const cache = createMemoryWeatherCache(clock.now);
  let caida = false;
  const spy = fetchSpy(() => {
    if (caida) {
      throw new Error("ECONNREFUSED");
    }
    return MARINE_FIXTURE;
  });
  await resolveSource(marineRequest(cache, clock, spy));
  clock.advance(5 * HOUR_SECONDS * 1000);
  caida = true;
  const gone = await resolveSource(marineRequest(cache, clock, spy));

  assert.equal(gone.status, "unavailable");
  assert.equal(gone.status === "unavailable" && gone.reason.includes("ECONNREFUSED"), true);
});

test("el motivo de un fallo se recorta: un HTML de error no se publica entero", async () => {
  const clock = fakeClock(T0);
  const cache = createMemoryWeatherCache(clock.now);
  const gone = await resolveSource({
    cache,
    key: "w1:marine:0.0:0.0",
    ttlSeconds: HOUR_SECONDS,
    retainSeconds: 4 * HOUR_SECONDS,
    now: clock.now,
    load: () => Promise.reject(new Error("x".repeat(500))),
  });

  assert.equal(gone.status, "unavailable");
  assert.equal(gone.status === "unavailable" && gone.reason.length <= 201, true);
});
