/**
 * Tests del rating solunar.
 *
 * El rating es una convención, no una medida: no hay oráculo externo contra el que contrastarlo.
 * Lo que sí se puede —y se debe— verificar es que la convención **es la que está escrita**: los
 * umbrales exactos de cada etiqueta, la meseta de ±2 días, el descenso lineal hasta el cuarto y,
 * sobre todo, que los estados terminales (0 y 100) no se alcanzan nunca por redondeo.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeRating,
  MOON_SCORE_MAX,
  MOON_SCORE_MIN,
  moonScore,
  QUARTER_DAYS,
  ratingLabel,
  roundScore,
  SOLAR_BONUS_MAX,
  SOLAR_BONUS_PER_PERIOD,
  solarBonus,
  SYZYGY_PLATEAU_DAYS,
} from "../rating.ts";

describe("rating · parte lunar", () => {
  it("da el máximo en la meseta de ±2 días alrededor de la sicigia", () => {
    for (const days of [0, 0.5, 1, 1.999, SYZYGY_PLATEAU_DAYS]) {
      assert.equal(moonScore(days), MOON_SCORE_MAX, `a ${days} días de la sicigia`);
      assert.equal(moonScore(-days), MOON_SCORE_MAX, "la meseta es simétrica");
    }
  });

  it("da el mínimo exactamente en el cuarto, el punto más lejano posible", () => {
    assert.ok(Math.abs(moonScore(QUARTER_DAYS) - MOON_SCORE_MIN) < 1e-9);
  });

  it("decrece de forma estrictamente monótona entre la meseta y el cuarto", () => {
    let previous = MOON_SCORE_MAX + 1;
    for (let days = SYZYGY_PLATEAU_DAYS; days <= QUARTER_DAYS; days += 0.1) {
      const score = moonScore(days);
      assert.ok(score < previous, `no decrece en ${days} días`);
      assert.ok(score >= MOON_SCORE_MIN - 1e-9 && score <= MOON_SCORE_MAX);
      previous = score;
    }
  });

  it("recorta por debajo del mínimo si le llega una distancia imposible", () => {
    assert.ok(Math.abs(moonScore(50) - MOON_SCORE_MIN) < 1e-9);
  });
});

describe("rating · bonus solar", () => {
  it("suma 10 puntos por periodo que cae sobre el orto o el ocaso solar", () => {
    assert.equal(solarBonus(0), 0);
    assert.equal(solarBonus(1), SOLAR_BONUS_PER_PERIOD);
    assert.equal(solarBonus(2), SOLAR_BONUS_MAX);
  });

  it("satura en el máximo y no baja de cero", () => {
    assert.equal(solarBonus(4), SOLAR_BONUS_MAX);
    assert.equal(solarBonus(-3), 0);
  });
});

describe("rating · estados terminales", () => {
  it("no llega a 100 por redondeo: 99,6 se queda en 99", () => {
    assert.equal(roundScore(99.6), 99);
    assert.equal(roundScore(99.999), 99);
  });

  it("no llega a 0 por redondeo: 0,4 se queda en 1", () => {
    assert.equal(roundScore(0.4), 1);
    assert.equal(roundScore(0.001), 1);
  });

  it("da 100 y 0 solo cuando la fórmula da exactamente eso (o más allá)", () => {
    assert.equal(roundScore(100), 100);
    assert.equal(roundScore(120), 100);
    assert.equal(roundScore(0), 0);
    assert.equal(roundScore(-5), 0);
  });

  it("redondea al entero más próximo en el interior del rango", () => {
    assert.equal(roundScore(64.4), 64);
    assert.equal(roundScore(64.5), 65);
  });
});

describe("rating · umbrales de la etiqueta", () => {
  it("aplica los umbrales exactos documentados", () => {
    const cases: readonly (readonly [number, string])[] = [
      [0, "baja"],
      [47, "baja"],
      [48, "media"],
      [64, "media"],
      [65, "alta"],
      [82, "alta"],
      [83, "muy-alta"],
      [100, "muy-alta"],
    ];
    for (const [score, label] of cases) {
      assert.equal(ratingLabel(score), label, `score ${score}`);
    }
  });

  it("no deja ningún score sin etiqueta en todo el rango", () => {
    for (let score = 0; score <= 100; score += 1) {
      assert.ok(["baja", "media", "alta", "muy-alta"].includes(ratingLabel(score)));
    }
  });
});

describe("rating · resultado completo", () => {
  it("alcanza el 100 exacto en sicigia con dos periodos sobre el Sol", () => {
    const rating = computeRating(0, 2);
    assert.deepEqual(rating, {
      score: 100,
      label: "muy-alta",
      moonScore: MOON_SCORE_MAX,
      solarBonus: SOLAR_BONUS_MAX,
      daysFromSyzygy: 0,
      solarOverlapCount: 2,
    });
  });

  it("da el peor día posible en el cuarto y sin coincidencias solares", () => {
    const rating = computeRating(QUARTER_DAYS, 0);
    assert.equal(rating.score, MOON_SCORE_MIN);
    assert.equal(rating.label, "baja");
    assert.equal(rating.solarBonus, 0);
  });

  it("devuelve el desglose para que el número sea auditable", () => {
    const rating = computeRating(-4, 1);
    assert.equal(rating.daysFromSyzygy, 4, "la distancia se reporta en valor absoluto");
    assert.equal(rating.solarOverlapCount, 1);
    assert.equal(rating.score, roundScore(rating.moonScore + rating.solarBonus));
    assert.equal(rating.label, ratingLabel(rating.score));
  });

  it("mantiene el score dentro de [0, 100] para cualquier entrada plausible", () => {
    for (let days = 0; days <= QUARTER_DAYS; days += 0.25) {
      for (const overlaps of [0, 1, 2, 3]) {
        const { score } = computeRating(days, overlaps);
        assert.ok(Number.isInteger(score) && score >= 0 && score <= 100, `score ${score}`);
      }
    }
  });
});
