/**
 * Periodos solunares: las ventanas de actividad que la teoría de John Alden Knight (1926) asocia a
 * los cuatro fenómenos lunares del día — tránsito superior e inferior (periodos **mayores**), orto
 * y ocaso de la Luna (**menores**) — con un rating de actividad para el día.
 *
 * Puro sobre `astronomy/`: todo el cálculo es en UTC y la zona horaria IANA solo decide qué
 * periodos caen en el día civil pedido.
 */

export type { CivilDayBounds } from "./civil-day.ts";
export {
  civilDateOf,
  civilDayBounds,
  InvalidCivilDateError,
  InvalidTimeZoneError,
  timeZoneOffsetMs,
  wallTimeToUtcMs,
} from "./civil-day.ts";

export {
  computeRating,
  MOON_SCORE_MAX,
  MOON_SCORE_MIN,
  moonScore,
  QUARTER_DAYS,
  RATING_LABEL_THRESHOLDS,
  ratingLabel,
  roundScore,
  SOLAR_BONUS_MAX,
  SOLAR_BONUS_PER_PERIOD,
  SOLAR_OVERLAP_HALF_WINDOW_MS,
  solarBonus,
  SYZYGY_PLATEAU_DAYS,
} from "./rating.ts";

export {
  MAJOR_PERIOD_DURATION_MS,
  MINOR_PERIOD_DURATION_MS,
  solunarDay,
} from "./periods.ts";

export type {
  SolunarAnchor,
  SolunarDay,
  SolunarDayQuery,
  SolunarPeriod,
  SolunarPeriodKind,
  SolunarRating,
  SolunarRatingLabel,
} from "./types.ts";
