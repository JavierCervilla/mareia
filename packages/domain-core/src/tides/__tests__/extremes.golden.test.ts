/**
 * Golden test del buscador de extremos contra las pleamares y bajamares oficiales de NOAA CO-OPS.
 *
 * Tolerancias del contrato de T-02: ±10 minutos y ±15 cm. Se exige además que la secuencia de
 * eventos sea la misma —mismo número y mismo tipo, en el mismo orden—: encontrar los extremos con
 * buena hora pero inventarse o perderse uno sería un fallo silencioso en la tabla de mareas.
 *
 * Ver `fixtures/noaa/README.md` para procedencia, unidades y datum.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findExtremes } from "../extremes.ts";
import type { TideExtreme } from "../types.ts";
import { loadNoaaExtremes, loadNoaaStation, NOAA_STATIONS } from "./fixtures.ts";

const TIME_TOLERANCE_MS = 10 * 60_000;
const HEIGHT_TOLERANCE_M = 0.15;
/** Margen alrededor del rango oficial: sin él se perdería un extremo pegado al borde. */
const EDGE_MARGIN_MS = 6 * 60 * 60_000;

/**
 * Recorta los extremos calculados al rango que cubre el oráculo. NOAA publica los eventos del
 * rango pedido; se calcula un margen extra para no depender de dónde caiga el borde y luego se
 * descartan los que quedan fuera.
 */
function withinOracleRange(
  computed: readonly TideExtreme[],
  official: readonly TideExtreme[],
): readonly TideExtreme[] {
  const [first] = official;
  const last = official.at(-1);
  if (first === undefined || last === undefined) {
    throw new Error("El fixture de extremos oficiales está vacío");
  }
  return computed.filter(
    (extreme) =>
      extreme.timeUtcMs >= first.timeUtcMs - TIME_TOLERANCE_MS &&
      extreme.timeUtcMs <= last.timeUtcMs + TIME_TOLERANCE_MS,
  );
}

describe("extremos · golden contra NOAA CO-OPS", () => {
  for (const { id, name } of NOAA_STATIONS) {
    it(`reproduce pleamares y bajamares de ${name} (${id}) dentro de ±10 min y ±15 cm`, () => {
      const station = loadNoaaStation(id, name);
      const official = loadNoaaExtremes(id);
      const [firstOfficial] = official;
      const lastOfficial = official.at(-1);
      assert.ok(firstOfficial !== undefined && lastOfficial !== undefined);

      const computed = withinOracleRange(
        findExtremes(
          station,
          firstOfficial.timeUtcMs - EDGE_MARGIN_MS,
          lastOfficial.timeUtcMs + EDGE_MARGIN_MS,
        ),
        official,
      );

      assert.equal(
        computed.length,
        official.length,
        `número de extremos distinto: ${computed.length} calculados vs ${official.length} oficiales`,
      );

      let maxTimeErrorMs = 0;
      let maxHeightError_m = 0;
      for (const [index, expected] of official.entries()) {
        const actual = computed[index];
        assert.ok(actual !== undefined);
        assert.equal(actual.kind, expected.kind, `tipo distinto en el evento ${index}`);
        const timeError = Math.abs(actual.timeUtcMs - expected.timeUtcMs);
        const heightError = Math.abs(actual.height_m - expected.height_m);
        maxTimeErrorMs = Math.max(maxTimeErrorMs, timeError);
        maxHeightError_m = Math.max(maxHeightError_m, heightError);
        assert.ok(
          timeError <= TIME_TOLERANCE_MS,
          `evento ${index} (${expected.kind}): ${(timeError / 60_000).toFixed(1)} min de error` +
            ` — esperado ${new Date(expected.timeUtcMs).toISOString()},` +
            ` calculado ${new Date(actual.timeUtcMs).toISOString()}`,
        );
        assert.ok(
          heightError <= HEIGHT_TOLERANCE_M,
          `evento ${index} (${expected.kind}): ${(heightError * 100).toFixed(1)} cm de error`,
        );
      }

      console.log(
        `  ${name}: ${official.length} eventos · máx ${(maxTimeErrorMs / 60_000).toFixed(1)} min` +
          ` · máx ${(maxHeightError_m * 100).toFixed(1)} cm`,
      );
    });
  }
});
