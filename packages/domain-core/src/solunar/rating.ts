/**
 * Rating de actividad solunar: un entero en [0, 100] con etiqueta.
 *
 * La escala es **una convención declarada**, no una medida. No existe un patrón oro de «cuánto
 * pica hoy»: lo que se puede hacer con honradez es fijar la fórmula, escribir sus umbrales y
 * devolver el desglose, para que quien lea el número sepa exactamente de dónde sale y pueda estar
 * en desacuerdo con la convención sin tener que dudar de la aritmética.
 *
 * ## La fórmula
 *
 * ```
 * score = moonScore(daysFromSyzygy) + solarBonus(periodosQueSolapanElSol)
 * ```
 *
 * - **`moonScore`**, entre {@link MOON_SCORE_MIN} y {@link MOON_SCORE_MAX}: mide la proximidad a
 *   la sicigia (luna nueva o llena), donde las mareas vivas y la iluminación coinciden. Dentro de
 *   ±{@link SYZYGY_PLATEAU_DAYS} días de la sicigia vale el máximo — una meseta, no un pico, porque
 *   el efecto no se apaga a las pocas horas—; de ahí decrece **linealmente** hasta el mínimo en el
 *   cuarto ({@link QUARTER_DAYS} días de la sicigia), que es el punto más lejano posible.
 * - **`solarBonus`**, entre 0 y {@link SOLAR_BONUS_MAX}: {@link SOLAR_BONUS_PER_PERIOD} puntos por
 *   cada periodo del día que solape el orto o el ocaso solar (±30 min), que es la coincidencia que
 *   la tradición solunar considera más productiva. Se satura a los dos periodos.
 *
 * ## Los estados terminales
 *
 * 100 y 0 **solo se alcanzan por exactitud de la fórmula**, nunca por redondeo: un 99,6 se muestra
 * como 99, no como 100. Un «hoy es día perfecto» redondeado sería una mentira barata.
 *
 * ## Los umbrales de la etiqueta
 *
 * No son números inventados: el rango **alcanzable** del score es [30, 100] (`moonScore` ∈ [30, 80]
 * más `solarBonus` ∈ [0, 20]), y las cuatro etiquetas son sus **cuatro cuartos iguales**,
 * redondeados al entero: 30 + 17,5 = 47,5 → 48; 65; 82,5 → 83.
 *
 * | Etiqueta | `score` | Cuarto del rango alcanzable |
 * |---|---|---|
 * | `muy-alta` | ≥ 83 | [82,5 , 100] |
 * | `alta` | ≥ 65 | [65 , 82,5) |
 * | `media` | ≥ 48 | [47,5 , 65) |
 * | `baja` | < 48 | [30 , 47,5) |
 *
 * Los cuatro se usan: sobre 2 años × 2 sitios (Madrid y Las Palmas) la distribución observada va
 * de 36 a 100, con mediana 67, y ninguna etiqueta queda vacía. Una escala cuya peor etiqueta no
 * sale nunca es una escala que miente.
 */

import type { SolunarRating, SolunarRatingLabel } from "./types.ts";

/** Días desde la sicigia dentro de los cuales el rating lunar es máximo. */
export const SYZYGY_PLATEAU_DAYS = 2;

/**
 * Días entre una sicigia y el cuarto siguiente: un cuarto del mes sinódico medio (29,530588853 d).
 * Es la distancia máxima posible a la sicigia más próxima, y el punto de rating lunar mínimo.
 */
export const QUARTER_DAYS = 29.530_588_853 / 4;

export const MOON_SCORE_MAX = 80;
export const MOON_SCORE_MIN = 30;

export const SOLAR_BONUS_PER_PERIOD = 10;
export const SOLAR_BONUS_MAX = 20;

/** Umbral inferior (inclusive) de cada etiqueta, de la más alta a la más baja. */
export const RATING_LABEL_THRESHOLDS: readonly (readonly [SolunarRatingLabel, number])[] =
  Object.freeze([
    ["muy-alta", 83],
    ["alta", 65],
    ["media", 48],
    ["baja", 0],
  ]);

/** Semiventana, en milisegundos, con la que un periodo «solapa» un orto u ocaso solar. */
export const SOLAR_OVERLAP_HALF_WINDOW_MS = 30 * 60_000;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Parte lunar del rating: meseta hasta ±2 días de la sicigia y descenso lineal hasta el cuarto. */
export function moonScore(daysFromSyzygy: number): number {
  const distance = clamp(Math.abs(daysFromSyzygy), 0, QUARTER_DAYS);
  if (distance <= SYZYGY_PLATEAU_DAYS) {
    return MOON_SCORE_MAX;
  }
  const slope = (MOON_SCORE_MAX - MOON_SCORE_MIN) / (QUARTER_DAYS - SYZYGY_PLATEAU_DAYS);
  return MOON_SCORE_MAX - slope * (distance - SYZYGY_PLATEAU_DAYS);
}

/** Parte solar del rating: 10 puntos por periodo que cae sobre el orto/ocaso, saturando en 20. */
export function solarBonus(solarOverlapCount: number): number {
  return Math.min(SOLAR_BONUS_MAX, Math.max(0, solarOverlapCount) * SOLAR_BONUS_PER_PERIOD);
}

/**
 * Redondea a entero **reservando los extremos**: 100 y 0 solo salen si la fórmula da exactamente
 * eso. Cualquier valor estrictamente interior se queda dentro de [1, 99].
 */
export function roundScore(rawScore: number): number {
  if (rawScore >= 100) {
    return 100;
  }
  if (rawScore <= 0) {
    return 0;
  }
  return clamp(Math.round(rawScore), 1, 99);
}

/** Etiqueta correspondiente a un `score` ya redondeado. */
export function ratingLabel(score: number): SolunarRatingLabel {
  for (const [label, threshold] of RATING_LABEL_THRESHOLDS) {
    if (score >= threshold) {
      return label;
    }
  }
  return "baja";
}

/** Rating completo del día, con su desglose. */
export function computeRating(daysFromSyzygy: number, solarOverlapCount: number): SolunarRating {
  const moon = moonScore(daysFromSyzygy);
  const solar = solarBonus(solarOverlapCount);
  const score = roundScore(moon + solar);
  return {
    score,
    label: ratingLabel(score),
    moonScore: moon,
    solarBonus: solar,
    daysFromSyzygy: Math.abs(daysFromSyzygy),
    solarOverlapCount,
  };
}
