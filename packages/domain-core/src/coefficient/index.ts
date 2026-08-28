/**
 * Coeficiente de marea de la escala francesa (20-120), calculado sobre la predicción propia del
 * puerto de referencia. TypeScript puro: los constituyentes entran por parámetro, cero IO.
 */

export {
  BREST_TIME_ZONE,
  BREST_UNIT_HEIGHT_M,
  MAX_TIDAL_COEFFICIENT,
  MIN_TIDAL_COEFFICIENT,
  semidiurnalTide,
  tidalCoefficientDay,
  tidalCoefficients,
} from "./coefficient.ts";

export type {
  TidalCoefficient,
  TidalCoefficientDay,
  TidalCoefficientOptions,
} from "./types.ts";
export { NoSemidiurnalTideError } from "./types.ts";
