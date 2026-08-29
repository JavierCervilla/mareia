/**
 * Casos de uso de Mareia: la capa de aplicación entre el dominio (`@mareia/domain-core`) y las
 * superficies que lo sirven (la API de `apps/api`, y más adelante el build del sitio).
 *
 * Todo lo que necesita del mundo entra por `UseCaseDeps` —repositorios, efeméride y reloj— y todo
 * lo que sale es un DTO serializable. No hay IO, ni `Date.now()`, ni framework HTTP: quien los pone
 * es el composition root. Esa es la frontera que vigila la regla de capas de `eslint.config.mjs`.
 */

export const PACKAGE = "usecases" as const;

export type {
  GeoSegment,
  Port,
  PortRepository,
  SourceAttribution,
  StationDatum,
  StationQuality,
  StationRecord,
  StationRepository,
  UseCaseDeps,
} from "./types.ts";

export { InvalidQueryError, PortNotFoundError } from "./errors.ts";

export {
  ALMANAC_YEAR_WINDOW,
  DEFAULT_CURVE_STEP_MINUTES,
  MAX_CURVE_SAMPLES,
  MAX_CURVE_STEP_MINUTES,
  MAX_TIDES_RANGE_DAYS,
  MIN_CURVE_STEP_MINUTES,
} from "./validate.ts";

export type {
  HorizonEventDto,
  InstantDto,
  MoonIlluminationDto,
  PortDto,
  PortQualityDto,
  PortSummaryDto,
  SkySearchDto,
  StationDto,
  TideEventDto,
  TideSampleDto,
  TransitEventDto,
  TwilightEventDto,
  WindowDto,
} from "./dto.ts";

export type { GetPortResult, ListPortsResult } from "./ports.ts";
export { getPort, listPorts } from "./ports.ts";

export type {
  AlmanacDayDto,
  GetAlmanacResult,
  GetTidesQuery,
  GetTidesResult,
  TideCurveDto,
  TideRangeDto,
} from "./tides.ts";
export { getAlmanac, getTides } from "./tides.ts";

export type {
  GetAstroResult,
  GetSolunarResult,
  MoonDto,
  RiseSetDto,
  SolunarPeriodDto,
  SunDto,
  TwilightPairDto,
} from "./sky.ts";
export { getAstro, getSolunar } from "./sky.ts";
