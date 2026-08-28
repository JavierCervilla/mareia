/**
 * La celda, la caché y la política de degradación: el corazón de «no machacar a la fuente».
 *
 * El test de oro del módulo está aquí: **la segunda llamada dentro de la misma celda y la misma
 * hora no sale a la red**. Si alguien rompe la clave de caché o el TTL, esto se pone rojo antes de
 * que Open-Meteo nos corte el grifo en producción.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryWeatherCache } from "../cache.ts";
import { cellKey, toCell } from "../cell.ts";
import { fetchMarine } from "../open-meteo.ts";
import { resolveSource } from "../source.ts";
import { MARINE_FIXTURE, fakeClock, fetchSpy } from "./fakes.ts";

const T0 = Date.parse("2026-08-28T13:37:00Z");
const HOUR_SECONDS = 3_600;

test("la celda redondea a 0,1° y trunca la hora UTC", () => {
  const cell = toCell(42.2406, -8.7207, T0);
  assert.deepEqual(cell, { lat: 42.2, lon: -8.7, hourUtc: "2026-08-28T13:00:00Z" });
});

test("dos fondeaderos dentro de la misma celda comparten clave; un puerto lejano, no", () => {
  const vigo = toCell(42.2406, -8.7207, T0);
  const bouzas = toCell(42.2313, -8.742, T0);
  const coruna = toCell(43.3623, -8.3927, T0);

  assert.equal(cellKey("marine", vigo), cellKey("marine", bouzas));
  assert.notEqual(cellKey("marine", vigo), cellKey("marine", coruna));
});

test("la malla es fija: dos puntos a un lado y otro de un borde NO colapsan", () => {
  // Cangas está a 4 km de Vigo pero al otro lado del borde de 42,25°: celdas distintas y dos
  // peticiones. Es el precio de una malla fija, y se documenta aquí para que nadie lo lea como bug.
  const vigo = toCell(42.2406, -8.7207, T0);
  const cangas = toCell(42.2637, -8.7869, T0);
  assert.notEqual(cellKey("marine", vigo), cellKey("marine", cangas));
});

test("la clave no arrastra un -0 en las longitudes justo al este de Greenwich", () => {
  const cell = toCell(37.6338, -0.02, T0);
  assert.equal(cell.lon, 0);
  assert.match(cellKey("marine", cell), /:0\.0:/u);
});

test("la clave lleva el prefijo de esquema: un despliegue no lee valores con otra forma", () => {
  assert.match(cellKey("marine", toCell(42.24, -8.72, T0)), /^w1:marine:/u);
});

test("la hora cambia de celda al cruzar la hora en punto", () => {
  const antes = toCell(42.24, -8.72, Date.parse("2026-08-28T13:59:59Z"));
  const despues = toCell(42.24, -8.72, Date.parse("2026-08-28T14:00:00Z"));
  assert.notEqual(cellKey("marine", antes), cellKey("marine", despues));
});

test("ORO: la segunda llamada a la misma celda y hora no sale a la red", async () => {
  const clock = fakeClock(T0);
  const cache = createMemoryWeatherCache(clock.now);
  const spy = fetchSpy(() => MARINE_FIXTURE);
  const cell = toCell(42.2406, -8.7207, clock.now());
  const request = {
    cache,
    key: cellKey("marine", cell),
    ttlSeconds: HOUR_SECONDS,
    retainSeconds: 4 * HOUR_SECONDS,
    now: clock.now,
    load: () => fetchMarine({ fetch: spy.fetch }, cell),
  };

  const first = await resolveSource(request);
  clock.advance(90_000);
  const second = await resolveSource(request);

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
  const cell = toCell(42.2406, -8.7207, clock.now());
  const request = {
    cache,
    key: cellKey("marine", cell),
    ttlSeconds: HOUR_SECONDS,
    retainSeconds: 4 * HOUR_SECONDS,
    now: clock.now,
    load: () => fetchMarine({ fetch: spy.fetch }, cell),
  };

  await resolveSource(request);
  clock.advance((HOUR_SECONDS + 1) * 1000);
  const refreshed = await resolveSource(request);

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
  const cell = toCell(42.2406, -8.7207, clock.now());
  const request = {
    cache,
    key: cellKey("marine", cell),
    ttlSeconds: HOUR_SECONDS,
    retainSeconds: 4 * HOUR_SECONDS,
    now: clock.now,
    load: () => fetchMarine({ fetch: spy.fetch }, cell),
  };

  await resolveSource(request);
  clock.advance(2 * HOUR_SECONDS * 1000);
  caida = true;
  const degraded = await resolveSource(request);

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
  const cell = toCell(42.2406, -8.7207, clock.now());
  const request = {
    cache,
    key: cellKey("marine", cell),
    ttlSeconds: HOUR_SECONDS,
    retainSeconds: 4 * HOUR_SECONDS,
    now: clock.now,
    load: () => fetchMarine({ fetch: spy.fetch }, cell),
  };

  await resolveSource(request);
  clock.advance(5 * HOUR_SECONDS * 1000);
  caida = true;
  const gone = await resolveSource(request);

  assert.equal(gone.status, "unavailable");
  assert.equal(gone.status === "unavailable" && gone.reason.includes("ECONNREFUSED"), true);
});

test("el motivo de un fallo se recorta: un HTML de error no se publica entero", async () => {
  const clock = fakeClock(T0);
  const cache = createMemoryWeatherCache(clock.now);
  const gone = await resolveSource({
    cache,
    key: "w1:marine:0.0:0.0:2026-08-28T13:00:00Z",
    ttlSeconds: HOUR_SECONDS,
    retainSeconds: 4 * HOUR_SECONDS,
    now: clock.now,
    load: () => Promise.reject(new Error("x".repeat(500))),
  });

  assert.equal(gone.status, "unavailable");
  assert.equal(gone.status === "unavailable" && gone.reason.length <= 201, true);
});
