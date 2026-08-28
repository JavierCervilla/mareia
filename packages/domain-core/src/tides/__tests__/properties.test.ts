/**
 * Tests de propiedades del motor: invariantes que deben cumplirse sea cual sea la estación, sin
 * depender de ningún oráculo externo. Cubren lo que un golden test no ve — que la curva sea
 * derivable, que los extremos alternen, que el resultado no dependa del huso de la máquina— y las
 * condiciones de error del contrato.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findExtremes } from "../extremes.ts";
import { heightAt, heightRateAt, predictHeight, prepareStation, sampleCurve } from "../harmonic.ts";
import { isSupportedConstituent, SUPPORTED_CONSTITUENTS } from "../constituents.ts";
import type { TideStation } from "../types.ts";
import { UnsupportedConstituentError } from "../types.ts";
import { loadNoaaStation } from "./fixtures.ts";

const HOUR_MS = 3_600_000;
const START_UTC_MS = Date.parse("2026-03-15T00:00:00Z");

/**
 * Velocidad angular de M2 publicada por NOAA CO-OPS, en grados por hora. Se usa como referencia
 * externa: el periodo semidiurno lunar que sale de nuestra tabla debe reproducirla.
 */
const M2_SPEED_DEG_PER_HOUR = 28.984104;
/** Periodo de la marea lunar semidiurna: 12 h 25 min 14 s. */
const M2_PERIOD_MS = (360 / M2_SPEED_DEG_PER_HOUR) * HOUR_MS;

const M2_ONLY_STATION: TideStation = {
  schema: "station/v1",
  id: "synthetic-m2",
  name: "M2 puro",
  datum: { msl_offset_m: 0 },
  constituents: [{ name: "M2", amplitude_m: 1, phase_deg: 0 }],
};

function realStation(): TideStation {
  return loadNoaaStation("9414290", "San Francisco, CA");
}

describe("propiedades · extremos", () => {
  it("alterna estrictamente pleamar y bajamar durante un mes", () => {
    const extremes = findExtremes(realStation(), START_UTC_MS, START_UTC_MS + 30 * 24 * HOUR_MS);
    assert.ok(extremes.length > 100, `se esperaban ~110 extremos en 30 días, hubo ${extremes.length}`);
    for (const [index, extreme] of extremes.entries()) {
      const previous = extremes[index - 1];
      if (previous === undefined) {
        continue;
      }
      assert.notEqual(extreme.kind, previous.kind, `dos ${extreme.kind} seguidos en el índice ${index}`);
      assert.ok(extreme.timeUtcMs > previous.timeUtcMs, "los extremos deben ir en orden cronológico");
      if (extreme.kind === "high") {
        assert.ok(extreme.height_m > previous.height_m, "una pleamar debe estar por encima de la bajamar previa");
      } else {
        assert.ok(extreme.height_m < previous.height_m, "una bajamar debe estar por debajo de la pleamar previa");
      }
    }
  });

  it("sitúa cada extremo donde la derivada se anula y la altura es localmente extrema", () => {
    const station = realStation();
    const prepared = prepareStation(station);
    const extremes = findExtremes(station, START_UTC_MS, START_UTC_MS + 3 * 24 * HOUR_MS);
    const nudgeMs = 5 * 60_000;
    for (const extreme of extremes) {
      assert.ok(
        Math.abs(heightRateAt(prepared, extreme.timeUtcMs)) < 1e-3,
        `derivada no nula en ${new Date(extreme.timeUtcMs).toISOString()}`,
      );
      const before = predictHeight(station, extreme.timeUtcMs - nudgeMs);
      const after = predictHeight(station, extreme.timeUtcMs + nudgeMs);
      if (extreme.kind === "high") {
        assert.ok(extreme.height_m > before && extreme.height_m > after, "la pleamar no es un máximo local");
      } else {
        assert.ok(extreme.height_m < before && extreme.height_m < after, "la bajamar no es un mínimo local");
      }
    }
  });

  it("separa las pleamares de una estación con solo M2 un periodo semidiurno lunar", () => {
    const extremes = findExtremes(M2_ONLY_STATION, START_UTC_MS, START_UTC_MS + 10 * 24 * HOUR_MS);
    const highs = extremes.filter((extreme) => extreme.kind === "high");
    assert.ok(highs.length > 15, `pocas pleamares en 10 días: ${highs.length}`);
    for (const [index, high] of highs.entries()) {
      const previous = highs[index - 1];
      if (previous === undefined) {
        continue;
      }
      const errorMs = Math.abs(high.timeUtcMs - previous.timeUtcMs - M2_PERIOD_MS);
      assert.ok(errorMs < 5_000, `periodo desviado ${(errorMs / 1000).toFixed(1)} s del de M2`);
    }
  });
});

describe("propiedades · curva", () => {
  it("es derivable: la derivada analítica coincide con la numérica", () => {
    const prepared = prepareStation(realStation());
    const deltaMs = 1_000;
    for (let index = 0; index < 48; index += 1) {
      const time = START_UTC_MS + index * HOUR_MS;
      const numeric =
        ((heightAt(prepared, time + deltaMs) - heightAt(prepared, time - deltaMs)) / (2 * deltaMs)) *
        HOUR_MS;
      assert.ok(
        Math.abs(numeric - heightRateAt(prepared, time)) < 1e-5,
        `derivada analítica y numérica discrepan en ${new Date(time).toISOString()}`,
      );
    }
  });

  it("muestrea el rango completo con paso constante y termina exactamente en el final", () => {
    const station = realStation();
    const end = START_UTC_MS + 6 * HOUR_MS;
    const curve = sampleCurve(station, START_UTC_MS, end, 30);
    assert.equal(curve.length, 13);
    const [first] = curve;
    assert.ok(first !== undefined);
    assert.equal(first.timeUtcMs, START_UTC_MS);
    assert.equal(curve.at(-1)?.timeUtcMs, end);
    for (const sample of curve) {
      assert.equal(sample.height_m, predictHeight(station, sample.timeUtcMs));
    }
  });

  it("no depende del huso horario de presentación", () => {
    const station = realStation();
    const instant = Date.parse("2026-03-16T07:23:00Z");
    const reference = withTimeZone("UTC", () => ({
      height: predictHeight(station, instant),
      extremes: findExtremes(station, instant, instant + 24 * HOUR_MS),
    }));
    for (const timeZone of ["Asia/Kolkata", "Pacific/Kiritimati", "America/Los_Angeles"]) {
      const shifted = withTimeZone(timeZone, () => ({
        height: predictHeight(station, instant),
        extremes: findExtremes(station, instant, instant + 24 * HOUR_MS),
      }));
      assert.equal(shifted.height, reference.height, `la altura cambió con TZ=${timeZone}`);
      assert.deepEqual(shifted.extremes, reference.extremes, `los extremos cambiaron con TZ=${timeZone}`);
    }
  });
});

describe("propiedades · contrato", () => {
  it("soporta el juego estándar de constituyentes", () => {
    const required = ["M2", "S2", "N2", "K2", "K1", "O1", "P1", "Q1", "M4", "MS4", "MM", "MF", "SSA", "SA"];
    for (const name of required) {
      assert.ok(isSupportedConstituent(name), `falta el constituyente ${name}`);
    }
    assert.equal(SUPPORTED_CONSTITUENTS.length, 42);
    assert.ok(isSupportedConstituent("lambda2"), "los alias deben normalizarse");
  });

  it("rechaza un constituyente desconocido en vez de ignorarlo en silencio", () => {
    const station: TideStation = {
      ...M2_ONLY_STATION,
      constituents: [...M2_ONLY_STATION.constituents, { name: "XYZ9", amplitude_m: 1, phase_deg: 0 }],
    };
    assert.throws(() => predictHeight(station, START_UTC_MS), UnsupportedConstituentError);
  });

  it("rechaza rangos y pasos inválidos", () => {
    assert.throws(() => sampleCurve(M2_ONLY_STATION, START_UTC_MS, START_UTC_MS - 1, 6), RangeError);
    assert.throws(() => sampleCurve(M2_ONLY_STATION, START_UTC_MS, START_UTC_MS + HOUR_MS, 0), RangeError);
    assert.throws(() => findExtremes(M2_ONLY_STATION, Number.NaN, START_UTC_MS), RangeError);
  });
});

/** Ejecuta `body` con el huso horario del proceso forzado, y lo restaura pase lo que pase. */
function withTimeZone<T>(timeZone: string, body: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    return body();
  } finally {
    if (previous === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previous;
    }
  }
}
