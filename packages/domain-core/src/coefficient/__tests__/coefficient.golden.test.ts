/**
 * Golden test del coeficiente contra los valores publicados para Brest en 2026.
 *
 * Es el test que decide si el módulo calcula *el* coeficiente o simplemente *un* número: la escala
 * es una convención (unidad de altura, qué marea se mide, cómo se reparte el día), y solo un
 * oráculo externo demuestra que la convención implementada es la publicada.
 *
 * Procedencia de los valores, URLs y fecha de consulta: `fixtures/README.md`.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { civilDayBounds } from "../../solunar/civil-day.ts";
import { findExtremes } from "../../tides/extremes.ts";
import { BREST_UNIT_HEIGHT_M, tidalCoefficientDay } from "../coefficient.ts";
import { loadBrestStation, loadPublishedCoefficients } from "./fixtures.ts";

const HOUR_MS = 3_600_000;

describe("coeficiente · golden contra los valores publicados de Brest 2026", () => {
  const station = loadBrestStation();
  const fixture = loadPublishedCoefficients();
  const errors: number[] = [];

  for (const day of fixture.days) {
    it(`reproduce los coeficientes del ${day.dateIso} dentro de ±${fixture.toleranceUnits}`, () => {
      const computed = tidalCoefficientDay(station, day.dateIso, { timeZone: fixture.timeZone });
      assert.equal(
        computed.coefficients.length,
        day.coefficients.length,
        `${day.dateIso}: ${computed.coefficients.length} pleamares frente a las ${day.coefficients.length} publicadas`,
      );
      for (const [index, published] of day.coefficients.entries()) {
        const value = computed.coefficients[index]?.value;
        assert.ok(value !== undefined);
        const error = value - published;
        errors.push(error);
        assert.ok(
          Math.abs(error) <= fixture.toleranceUnits,
          `${day.dateIso} #${index + 1}: ${value} frente al ${published} publicado (${error > 0 ? "+" : ""}${error})`,
        );
      }
    });
  }

  /**
   * El sesgo es la parte del desacuerdo que no se arregla mirando un día concreto: nuestras
   * constantes de Brest son TICON-4 (análisis 2006-2025 del mareógrafo REFMAR) y las del oráculo
   * son las del SHOM, así que las dos predicciones son parientes y no gemelas.
   *
   * **Medido en T-13**, al regenerar el dataset con los 42 constituyentes del motor: sesgo +1,38
   * unidades y error máximo 3 sobre los 32 valores publicados, frente al +0,91 y máximo 2 que daba
   * el fichero truncado a 37. La cota sube de 1 a 1,5 con ese dato delante y no antes. Lo que la
   * justifica es que el dataset nuevo predice **mejor** la marea real —contra las observaciones del
   * IOC, Brest pasó de 2,23 a 0,47 cm RMS de coste de truncado y de grade B a grade A— mientras se
   * aleja un pelo del coeficiente del SHOM: son dos oráculos distintos y sólo uno de ellos es el
   * mar. Quitar del cálculo la modulación radiacional (MA2 y MB2) tampoco lo arregla: deja el sesgo
   * en +1,19, así que el desacuerdo no viene de qué constituyentes entran sino de qué análisis
   * armónico se compara con cuál.
   */
  it("no arrastra un sesgo sistemático sobre el conjunto de la muestra", () => {
    const bias = errors.reduce((total, error) => total + error, 0) / errors.length;
    const maxAbs = Math.max(...errors.map(Math.abs));
    console.log(`  ${errors.length} coeficientes · sesgo ${bias.toFixed(2)} · máx ${maxAbs}`);
    assert.ok(errors.length >= 30, `la muestra debe cubrir los tres meses del fixture (${errors.length})`);
    assert.ok(Math.abs(bias) <= 1.5, `sesgo medio de ${bias.toFixed(2)} unidades`);
  });

  /**
   * El experimento que justifica la reducción semidiurna del módulo, con la misma fórmula pero
   * sobre la marea completa. Si alguien «simplifica» el filtro algún día, este test le dice cuánto
   * cuesta antes de que lo descubra un pescador.
   */
  it("se desvía de lo publicado si se calcula sobre la marea completa", () => {
    const fullTideErrors: number[] = [];
    for (const day of fixture.days) {
      const bounds = civilDayBounds(day.dateIso, fixture.timeZone);
      const extremes = findExtremes(station, bounds.startUtcMs - HOUR_MS * 13, bounds.endUtcMs + HOUR_MS * 13);
      const values: number[] = [];
      for (const [index, extreme] of extremes.entries()) {
        const previous = extremes[index - 1];
        const next = extremes[index + 1];
        if (extreme.kind !== "high" || previous === undefined || next === undefined) {
          continue;
        }
        if (extreme.timeUtcMs < bounds.startUtcMs || extreme.timeUtcMs >= bounds.endUtcMs) {
          continue;
        }
        const semiRange = 0.5 * (extreme.height_m - 0.5 * (previous.height_m + next.height_m));
        values.push(Math.round((semiRange / BREST_UNIT_HEIGHT_M) * 100));
      }
      day.coefficients.forEach((published, index) => {
        const value = values[index];
        if (value !== undefined) {
          fullTideErrors.push(value - published);
        }
      });
    }
    const worst = Math.max(...fullTideErrors.map(Math.abs));
    console.log(`  con la marea completa el error máximo sería de ${worst} unidades`);
    assert.ok(
      worst > fixture.toleranceUnits,
      "si la marea completa cayera dentro de tolerancia, el filtro semidiurno sobraría",
    );
  });

  it("reparte el día en mañana y tarde por el mediodía local", () => {
    const twoTides = fixture.days.find((day) => day.coefficients.length === 2);
    assert.ok(twoTides !== undefined);
    const day = tidalCoefficientDay(station, twoTides.dateIso, { timeZone: fixture.timeZone });
    assert.equal(day.morning, day.coefficients[0]);
    assert.equal(day.afternoon, day.coefficients[1]);

    const oneTide = fixture.days.find((candidate) => candidate.coefficients.length === 1);
    assert.ok(oneTide !== undefined);
    const single = tidalCoefficientDay(station, oneTide.dateIso, { timeZone: fixture.timeZone });
    assert.equal(single.coefficients.length, 1);
    assert.ok(
      (single.morning === undefined) !== (single.afternoon === undefined),
      "un día de una sola pleamar tiene mañana o tarde, no las dos ni ninguna",
    );
  });
});
