/**
 * Motor de predicción de mareas por suma armónica con correcciones nodales (Schureman, SP-98).
 *
 * TypeScript puro: sin IO, sin reloj del sistema y sin dependencias de runtime, para poder correr
 * igual en Deno (API), en Node (build del sitio) y en el navegador.
 */

export type {
  AstronomicalArguments,
  MeanAngularSpeeds,
} from "./astronomy.ts";
export { computeAstronomicalArguments, julianDay, MEAN_ANGULAR_SPEEDS } from "./astronomy.ts";

export type { ConstituentDefinition, DoodsonCoefficients } from "./constituents.ts";
export {
  canonicalConstituentName,
  equilibriumArgument,
  findConstituent,
  isSupportedConstituent,
  SUPPORTED_CONSTITUENTS,
} from "./constituents.ts";

export type { NodalCorrection, NodalFundamental, NodalTerm } from "./nodal.ts";
export { computeNodalCorrection } from "./nodal.ts";

export type { PreparedStation } from "./harmonic.ts";
export { heightAt, heightRateAt, predictHeight, prepareStation, sampleCurve } from "./harmonic.ts";

export type { FindExtremesOptions } from "./extremes.ts";
export { findExtremes } from "./extremes.ts";

export type {
  EpochMs,
  StationConstituent,
  TideDatum,
  TideExtreme,
  TideExtremeKind,
  TideSample,
  TideStation,
} from "./types.ts";
export { UnsupportedConstituentError } from "./types.ts";
