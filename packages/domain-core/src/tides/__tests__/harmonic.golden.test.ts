/**
 * Golden test de la suma armónica contra las predicciones oficiales de NOAA CO-OPS.
 *
 * Partiendo de las mismas constantes armónicas publicadas por NOAA, la curva que produce este
 * motor debe coincidir con la que publica NOAA para los mismos instantes. Es la prueba de que la
 * implementación de V, f y u es correcta: cualquier error en los coeficientes de Doodson, en el
 * signo de u o en la normalización de f se traduce en decímetros de discrepancia.
 *
 * Ver `fixtures/noaa/README.md` para procedencia, unidades y datum.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prepareStation, heightAt } from "../harmonic.ts";
import { loadNoaaCurve, loadNoaaStation, NOAA_STATIONS } from "./fixtures.ts";

/** Tolerancia de altura del contrato de T-02. */
const HEIGHT_TOLERANCE_M = 0.15;

interface CurveError {
  readonly maxAbs_m: number;
  readonly rms_m: number;
  readonly bias_m: number;
  readonly atUtcMs: number;
  readonly points: number;
}

function compareCurve(stationId: string, name: string): CurveError {
  const station = loadNoaaStation(stationId, name);
  const prepared = prepareStation(station);
  const official = loadNoaaCurve(stationId);

  let maxAbs = 0;
  let atUtcMs = 0;
  let sumSquares = 0;
  let sum = 0;
  for (const point of official) {
    const error = heightAt(prepared, point.timeUtcMs) - point.height_m;
    sum += error;
    sumSquares += error * error;
    if (Math.abs(error) > maxAbs) {
      maxAbs = Math.abs(error);
      atUtcMs = point.timeUtcMs;
    }
  }
  return {
    maxAbs_m: maxAbs,
    rms_m: Math.sqrt(sumSquares / official.length),
    bias_m: sum / official.length,
    atUtcMs,
    points: official.length,
  };
}

describe("suma armónica · golden contra NOAA CO-OPS", () => {
  for (const { id, name } of NOAA_STATIONS) {
    it(`reproduce la curva de 6 minutos de ${name} (${id}) dentro de ±15 cm`, () => {
      const error = compareCurve(id, name);
      const detail =
        `${error.points} puntos · máx ${(error.maxAbs_m * 100).toFixed(1)} cm` +
        ` en ${new Date(error.atUtcMs).toISOString()}` +
        ` · RMS ${(error.rms_m * 100).toFixed(1)} cm · sesgo ${(error.bias_m * 100).toFixed(1)} cm`;
      console.log(`  ${name}: ${detail}`);
      assert.ok(error.points > 700, `el fixture debe cubrir tres días completos (${error.points})`);
      assert.ok(error.maxAbs_m < HEIGHT_TOLERANCE_M, `error máximo fuera de tolerancia — ${detail}`);
    });
  }
});
