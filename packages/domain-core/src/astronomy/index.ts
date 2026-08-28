/**
 * Astronomía observacional para la pesca: ortos y ocasos de Sol y Luna, crepúsculos, fase lunar,
 * tránsitos y distancia.
 *
 * El instante es siempre epoch ms UTC, como en `tides/`. La zona horaria solo aparece al proyectar
 * sobre un día civil, y eso vive en `solunar/`.
 *
 * Este subpaquete es el único de `domain-core` con una dependencia de runtime
 * (`astronomy-engine`, MIT, pinneada): ver el porqué y su alcance en `README.md` y en `engine.ts`.
 */

export type {
  AstronomyGateway,
  CelestialBody,
  GeoLocation,
  HorizonEvent,
  HorizonEventKind,
  HorizontalPosition,
  HorizontalPositionOptions,
  MoonDistance,
  MoonIllumination,
  MoonPhaseName,
  MoonQuarterEvent,
  MoonQuarterName,
  NoEventReason,
  RefractionMode,
  SkySearch,
  SkySearchOptions,
  TransitEvent,
  TransitKind,
  TwilightEvent,
  TwilightKind,
  TwilightPhase,
} from "./types.ts";

export {
  InvalidGeoLocationError,
  InvalidInstantError,
  InvalidSearchWindowError,
  TWILIGHT_ALTITUDE_DEG,
} from "./types.ts";

export {
  astronomyEngineGateway,
  horizontalPosition,
  moonDistance,
  moonIllumination,
  nextMoonQuarters,
  searchHorizonEvent,
  searchTransit,
  searchTwilight,
} from "./engine.ts";
