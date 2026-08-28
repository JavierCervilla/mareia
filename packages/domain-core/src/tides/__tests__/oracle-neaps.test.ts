/**
 * Segundo oráculo: `@neaps/tide-predictor`, el motor de predicción del proyecto neaps (MIT).
 *
 * Es una implementación independiente del mismo método de Schureman. Alimentada con las mismas
 * constantes armónicas, tiene que dar la misma curva que la nuestra. NOAA valida el resultado
 * final; esto valida la *implementación*: si nuestro coeficiente de Doodson o nuestro f/u de un
 * constituyente pequeño estuviesen mal, NOAA lo escondería bajo el ruido de sus redondeos y este
 * test, que parte de constantes idénticas, no.
 *
 * Es dependencia de DESARROLLO y solo de test: el dominio no depende de nada en runtime.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import createTidePredictor from "@neaps/tide-predictor";
import { heightAt, prepareStation } from "../harmonic.ts";
import { loadNoaaStation, NOAA_STATIONS } from "./fixtures.ts";

/** Tres días a paso de 10 minutos, el mismo tramo que cubre el oráculo de NOAA. */
const START_UTC_MS = Date.parse("2026-03-15T00:00:00Z");
const END_UTC_MS = Date.parse("2026-03-18T00:00:00Z");
const STEP_MS = 10 * 60_000;

/**
 * Acuerdo exigido entre las dos implementaciones. No es la tolerancia de producto (±15 cm): dos
 * implementaciones del mismo método sobre las mismas constantes solo pueden diferir en detalles
 * de segundo orden (polinomios astronómicos, forma exacta de 1/Qa en M1), no en centímetros.
 */
const AGREEMENT_TOLERANCE_M = 0.01;

describe("suma armónica · acuerdo con @neaps/tide-predictor", () => {
  for (const { id, name } of NOAA_STATIONS) {
    it(`coincide con el motor neaps en ${name} (${id}) por debajo de 1 cm`, () => {
      const station = loadNoaaStation(id, name);
      const prepared = prepareStation(station);
      const oracle = createTidePredictor(
        station.constituents.map((constituent) => ({
          name: constituent.name,
          amplitude: constituent.amplitude_m,
          phase: constituent.phase_deg,
        })),
        { nodeCorrections: "schureman", offset: false },
      );

      let maxAbs = 0;
      let samples = 0;
      for (let time = START_UTC_MS; time < END_UTC_MS; time += STEP_MS) {
        const ours = heightAt(prepared, time);
        const theirs = oracle.getWaterLevelAtTime({ time: new Date(time) }).level;
        maxAbs = Math.max(maxAbs, Math.abs(ours - theirs));
        samples += 1;
      }

      console.log(`  ${name}: ${samples} puntos · máx ${(maxAbs * 1000).toFixed(2)} mm`);
      assert.ok(samples > 400, "el barrido debe cubrir tres días");
      assert.ok(
        maxAbs < AGREEMENT_TOLERANCE_M,
        `desacuerdo de ${(maxAbs * 100).toFixed(2)} cm con el oráculo neaps`,
      );
    });
  }
});
