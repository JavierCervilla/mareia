/**
 * Implementación de {@link AstronomyGateway} sobre `astronomy-engine` (MIT).
 *
 * **Este es el único fichero de `domain-core` que importa una dependencia de runtime.** Es la
 * excepción aprobada en el Design Doc bajo el epígrafe «matemática vendorizada»: reimplementar
 * VSOP87/ELP a mano es exactamente donde nace el slop numérico, y una efeméride equivocada no
 * falla ruidosamente sino que devuelve una hora plausible y falsa. `astronomy-engine` está
 * pinneado a una versión exacta, no tiene dependencias transitivas, es MIT y funciona igual en
 * Node, Deno y navegador. Todo lo demás del paquete sigue siendo TypeScript puro sin dependencias.
 *
 * El resto del dominio (incluido `solunar/`) habla con la interfaz `AstronomyGateway`, nunca con
 * este módulo: sustituir el motor es cambiar este fichero y nada más.
 *
 * Convenciones que hereda del motor y que importan para comparar con efemérides publicadas:
 * - Orto/ocaso = cruce del **borde superior** del disco por el horizonte, con refracción estándar
 *   (y paralaje lunar). Es la convención del USNO y del *Astronomical Almanac*.
 * - Crepúsculos = altura **geométrica** del centro del Sol, sin refracción, en −6/−12/−18°.
 * - Tránsito = paso por el meridiano local (ángulo horario 0 o 12 h sidéreas).
 *
 * @see https://github.com/cosinekitty/astronomy — Don Cross, licencia MIT.
 */

import {
  Body,
  Equator,
  Horizon,
  Illumination,
  KM_PER_AU,
  MoonPhase,
  NextMoonQuarter,
  Observer,
  SearchAltitude,
  SearchHourAngle,
  SearchMoonPhase,
  SearchMoonQuarter,
  SearchRiseSet,
} from "astronomy-engine";
import type { EpochMs } from "../tides/types.ts";
import type {
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
import {
  InvalidGeoLocationError,
  InvalidInstantError,
  InvalidSearchWindowError,
  TWILIGHT_ALTITUDE_DEG,
} from "./types.ts";

const MS_PER_DAY = 86_400_000;

/**
 * Rango en que se aceptan instantes. `astronomy-engine` documenta exactitud alta entre 1700 y
 * 2200; se estrecha a [1900, 2100) porque fuera de ahí una app de pesca no tiene nada que hacer y
 * un instante disparatado casi siempre es un bug de unidades (segundos en vez de milisegundos).
 */
const MIN_INSTANT_MS = Date.UTC(1900, 0, 1);
const MAX_INSTANT_MS = Date.UTC(2100, 0, 1);

/** Mes sinódico medio, en días. Solo se usa para acotar búsquedas, nunca para calcular la fase. */
const SYNODIC_MONTH_DAYS = 29.530_588_853;

/**
 * Semiancho, en grados de elongación, con el que un instante se considera *en* un cuarto lunar.
 * 1° ≈ 1 h 58 min. Sin esta tolerancia los cuatro nombres de cuarto serían inalcanzables (son
 * instantes de medida nula) y `name` nunca los devolvería.
 */
const QUARTER_NAME_TOLERANCE_DEG = 1;

/** Direcciones de búsqueda del motor: +1 hacia el futuro / cruzando al alza, −1 lo contrario. */
const FORWARD = 1;
const BACKWARD = -1;

/** Ángulo horario, en horas sidéreas, de cada tipo de tránsito. */
const TRANSIT_HOUR_ANGLE: Readonly<Record<TransitKind, number>> = Object.freeze({
  upper: 0,
  lower: 12,
});

const BODIES: Readonly<Record<CelestialBody, Body>> = Object.freeze({
  sun: Body.Sun,
  moon: Body.Moon,
});

/**
 * Nombre que da el motor a cada modelo de refracción. `normal` es el de Saemundsson (Meeus) con el
 * mismo recorte que usa JPL Horizons; `null` desactiva la corrección.
 */
const ENGINE_REFRACTION: Readonly<Record<RefractionMode, string | undefined>> = Object.freeze({
  standard: "normal",
  none: undefined,
});

const DEFAULT_SEARCH_DAYS = 1;

function assertInstant(timeUtcMs: EpochMs): void {
  if (!Number.isFinite(timeUtcMs)) {
    throw new InvalidInstantError(timeUtcMs, "no es un número finito");
  }
  if (timeUtcMs < MIN_INSTANT_MS || timeUtcMs >= MAX_INSTANT_MS) {
    throw new InvalidInstantError(timeUtcMs, "fuera del rango soportado [1900-01-01, 2100-01-01)");
  }
}

function assertSearchDays(searchDays: number): void {
  if (!Number.isFinite(searchDays) || searchDays <= 0) {
    throw new InvalidSearchWindowError(searchDays);
  }
}

/** Valida y traduce la ubicación del dominio al observador del motor. */
function toObserver(location: GeoLocation): Observer {
  const { latitude_deg, longitude_deg } = location;
  const elevation_m = location.elevation_m ?? 0;
  if (!Number.isFinite(latitude_deg) || latitude_deg < -90 || latitude_deg > 90) {
    throw new InvalidGeoLocationError(location, "latitud fuera de [-90, 90]");
  }
  if (!Number.isFinite(longitude_deg) || longitude_deg < -180 || longitude_deg > 180) {
    throw new InvalidGeoLocationError(location, "longitud fuera de [-180, 180]");
  }
  if (!Number.isFinite(elevation_m)) {
    throw new InvalidGeoLocationError(location, "elevación no finita");
  }
  return new Observer(latitude_deg, longitude_deg, elevation_m);
}

function toDate(timeUtcMs: EpochMs): Date {
  assertInstant(timeUtcMs);
  return new Date(timeUtcMs);
}

/**
 * Posición de un cuerpo en el horizonte del observador en el instante pedido. Por omisión es la
 * altura **aparente** (con refracción estándar); con `{ refraction: "none" }` es la geométrica,
 * que es la que define los crepúsculos.
 */
export function horizontalPosition(
  body: CelestialBody,
  location: GeoLocation,
  atUtcMs: EpochMs,
  options?: HorizontalPositionOptions,
): HorizontalPosition {
  const observer = toObserver(location);
  const date = toDate(atUtcMs);
  const refraction = options?.refraction ?? "standard";
  const equatorial = Equator(BODIES[body], date, observer, true, true);
  const horizontal = Horizon(
    date,
    observer,
    equatorial.ra,
    equatorial.dec,
    ENGINE_REFRACTION[refraction],
  );
  return {
    timeUtcMs: atUtcMs,
    altitude_deg: horizontal.altitude,
    azimuth_deg: horizontal.azimuth,
    refraction,
  };
}

/**
 * Decide *por qué* no hubo cruce: se mira la posición en mitad de la ventana. Si el cuerpo estaba
 * por encima del umbral, la ventana entera fue «de día» para ese umbral; si estaba por debajo, fue
 * «de noche». Es una inferencia, no una demostración, pero para ventanas de ~1 día y umbrales
 * monótonos como el horizonte o los crepúsculos coincide con el caso polar real.
 */
function inferNoEventReason(
  body: CelestialBody,
  location: GeoLocation,
  fromUtcMs: EpochMs,
  searchDays: number,
  threshold: { readonly altitude_deg: number; readonly refraction: RefractionMode },
): NoEventReason {
  const midpointMs = fromUtcMs + (searchDays * MS_PER_DAY) / 2;
  const { altitude_deg } = horizontalPosition(body, location, midpointMs, {
    refraction: threshold.refraction,
  });
  return altitude_deg > threshold.altitude_deg ? "always-above" : "always-below";
}

function noEvent<TEvent>(
  body: CelestialBody,
  location: GeoLocation,
  fromUtcMs: EpochMs,
  searchDays: number,
  threshold: { readonly altitude_deg: number; readonly refraction: RefractionMode },
): SkySearch<TEvent> {
  return {
    outcome: "no-event",
    reason: inferNoEventReason(body, location, fromUtcMs, searchDays, threshold),
    searchedFromUtcMs: fromUtcMs,
    searchedDays: searchDays,
  };
}

function searchDaysOf(options: SkySearchOptions | undefined): number {
  const searchDays = options?.searchDays ?? DEFAULT_SEARCH_DAYS;
  assertSearchDays(searchDays);
  return searchDays;
}

/**
 * Primer orto u ocaso del cuerpo a partir de `fromUtcMs`.
 *
 * En latitudes altas puede no haberlo: entonces devuelve `no-event` con el motivo, nunca `null`.
 */
export function searchHorizonEvent(
  body: CelestialBody,
  location: GeoLocation,
  fromUtcMs: EpochMs,
  kind: HorizonEventKind,
  options?: SkySearchOptions,
): SkySearch<HorizonEvent> {
  const observer = toObserver(location);
  const date = toDate(fromUtcMs);
  const searchDays = searchDaysOf(options);
  const direction = kind === "rise" ? FORWARD : BACKWARD;
  const found = SearchRiseSet(BODIES[body], observer, direction, date, searchDays);
  if (found === null) {
    // El umbral del orto/ocaso es el horizonte visto con refracción: la misma altura aparente
    // con la que el motor busca el cruce.
    return noEvent(body, location, fromUtcMs, searchDays, {
      altitude_deg: 0,
      refraction: "standard",
    });
  }
  const timeUtcMs = found.date.getTime();
  return {
    outcome: "event",
    event: {
      kind,
      body,
      timeUtcMs,
      azimuth_deg: horizontalPosition(body, location, timeUtcMs).azimuth_deg,
    },
  };
}

/**
 * Primer cruce del Sol por la altura que define el crepúsculo pedido, a partir de `fromUtcMs`.
 *
 * `dawn` busca el cruce ascendente (empieza el crepúsculo matutino) y `dusk` el descendente
 * (termina el vespertino). En verano polar el crepúsculo astronómico no llega a ocurrir: eso sale
 * como `no-event` con motivo `always-above`.
 */
export function searchTwilight(
  location: GeoLocation,
  fromUtcMs: EpochMs,
  kind: TwilightKind,
  phase: TwilightPhase,
  options?: SkySearchOptions,
): SkySearch<TwilightEvent> {
  const observer = toObserver(location);
  const date = toDate(fromUtcMs);
  const searchDays = searchDaysOf(options);
  const altitude = TWILIGHT_ALTITUDE_DEG[kind];
  const direction = phase === "dawn" ? FORWARD : BACKWARD;
  const found = SearchAltitude(Body.Sun, observer, direction, date, searchDays, altitude);
  if (found === null) {
    // Los crepúsculos se definen sobre la altura GEOMÉTRICA del centro del Sol, sin refracción:
    // compararlos con la aparente desplazaría el umbral medio grado.
    return noEvent("sun", location, fromUtcMs, searchDays, {
      altitude_deg: altitude,
      refraction: "none",
    });
  }
  return {
    outcome: "event",
    event: { kind, phase, timeUtcMs: found.date.getTime() },
  };
}

/**
 * Primer paso del cuerpo por el meridiano (`upper`) o el antimeridiano (`lower`) del observador
 * a partir de `fromUtcMs`. Siempre existe: el cuerpo cruza ambos una vez por día sidéreo.
 */
export function searchTransit(
  body: CelestialBody,
  location: GeoLocation,
  fromUtcMs: EpochMs,
  kind: TransitKind,
): TransitEvent {
  const observer = toObserver(location);
  const date = toDate(fromUtcMs);
  const found = SearchHourAngle(BODIES[body], observer, TRANSIT_HOUR_ANGLE[kind], date, FORWARD);
  return {
    kind,
    body,
    timeUtcMs: found.time.date.getTime(),
    altitude_deg: found.hor.altitude,
    azimuth_deg: found.hor.azimuth,
  };
}

/**
 * Nombre de la fase a partir de la elongación eclíptica. Los cuatro cuartos son instantes, no
 * intervalos: se les concede {@link QUARTER_NAME_TOLERANCE_DEG} de margen para que el nombre sea
 * alcanzable; fuera de esas cuatro ventanas el nombre es el del intervalo correspondiente.
 */
function moonPhaseName(phaseAngle_deg: number): MoonPhaseName {
  const tolerance = QUARTER_NAME_TOLERANCE_DEG;
  if (phaseAngle_deg <= tolerance || phaseAngle_deg >= 360 - tolerance) {
    return "new";
  }
  if (Math.abs(phaseAngle_deg - 90) <= tolerance) {
    return "first-quarter";
  }
  if (Math.abs(phaseAngle_deg - 180) <= tolerance) {
    return "full";
  }
  if (Math.abs(phaseAngle_deg - 270) <= tolerance) {
    return "last-quarter";
  }
  if (phaseAngle_deg < 90) {
    return "waxing-crescent";
  }
  if (phaseAngle_deg < 180) {
    return "waxing-gibbous";
  }
  return phaseAngle_deg < 270 ? "waning-gibbous" : "waning-crescent";
}

/**
 * Edad de la Luna: tiempo transcurrido desde la **nueva anterior real**, no la elongación
 * reescalada. La diferencia llega a medio día cerca del perigeo, porque la Luna no recorre su
 * órbita a velocidad constante.
 */
function moonAgeDays(atUtcMs: EpochMs, date: Date): number {
  const limitDays = -(SYNODIC_MONTH_DAYS + 1);
  const previousNewMoon = SearchMoonPhase(0, date, limitDays);
  if (previousNewMoon === null) {
    throw new InvalidInstantError(atUtcMs, "no se encontró la luna nueva anterior");
  }
  return (atUtcMs - previousNewMoon.date.getTime()) / MS_PER_DAY;
}

/** Fase, edad e iluminación de la Luna en un instante. */
export function moonIllumination(atUtcMs: EpochMs): MoonIllumination {
  const date = toDate(atUtcMs);
  const phaseAngle_deg = MoonPhase(date);
  return {
    timeUtcMs: atUtcMs,
    phaseAngle_deg,
    ageDays: moonAgeDays(atUtcMs, date),
    illuminatedFraction: Illumination(Body.Moon, date).phase_fraction,
    name: moonPhaseName(phaseAngle_deg),
  };
}

/** Distancia geocéntrica a la Luna, en kilómetros (perigeo ≈ 356 500, apogeo ≈ 406 700). */
export function moonDistance(atUtcMs: EpochMs): MoonDistance {
  const date = toDate(atUtcMs);
  return { timeUtcMs: atUtcMs, distance_km: Illumination(Body.Moon, date).geo_dist * KM_PER_AU };
}

const QUARTER_NAMES: readonly MoonQuarterName[] = Object.freeze([
  "new",
  "first-quarter",
  "full",
  "last-quarter",
]);

function quarterNameOf(quarter: number): MoonQuarterName {
  const name = QUARTER_NAMES[quarter];
  if (name === undefined) {
    throw new RangeError(`El motor devolvió un cuarto lunar desconocido: ${quarter}`);
  }
  return name;
}

/** Los `count` cuartos lunares siguientes a `fromUtcMs`, en orden cronológico. */
export function nextMoonQuarters(fromUtcMs: EpochMs, count: number): readonly MoonQuarterEvent[] {
  const date = toDate(fromUtcMs);
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`El número de cuartos lunares debe ser un entero >= 0: ${count}`);
  }
  const quarters: MoonQuarterEvent[] = [];
  let current = SearchMoonQuarter(date);
  for (let index = 0; index < count; index += 1) {
    quarters.push({
      quarter: quarterNameOf(current.quarter),
      timeUtcMs: current.time.date.getTime(),
    });
    current = NextMoonQuarter(current);
  }
  return quarters;
}

/**
 * La puerta de astronomía del dominio, respaldada por `astronomy-engine`. Es un objeto sin estado:
 * se puede compartir entre peticiones sin más.
 */
export const astronomyEngineGateway: AstronomyGateway = Object.freeze({
  horizontalPosition,
  searchHorizonEvent,
  searchTwilight,
  searchTransit,
  moonIllumination,
  moonDistance,
  nextMoonQuarters,
});
