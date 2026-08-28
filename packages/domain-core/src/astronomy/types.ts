/**
 * Tipos del dominio de astronomía. Como en `tides/`, el instante entra y sale siempre como
 * milisegundos UTC desde el epoch Unix (`EpochMs`): nunca una fecha local ni un `Date` del entorno.
 *
 * La zona horaria IANA solo aparece cuando hay que proyectar sobre un día civil (ver `solunar/`);
 * aquí, jamás.
 */

import type { EpochMs } from "../tides/types.ts";

/** Cuerpos que este dominio sabe observar. La pesca solo necesita el Sol y la Luna. */
export type CelestialBody = "sun" | "moon";

/**
 * Punto de observación en la superficie terrestre.
 *
 * `longitude_deg` es positiva al **este** de Greenwich (convención ISO 6709), de modo que
 * Las Palmas es negativa. `elevation_m` es la altura del observador sobre el elipsoide; si se
 * omite se asume 0, que es lo correcto para un puerto.
 */
export interface GeoLocation {
  readonly latitude_deg: number;
  readonly longitude_deg: number;
  readonly elevation_m?: number;
}

/**
 * Qué hacer con la refracción atmosférica al medir una altura.
 *
 * `standard` da la altura **aparente** (lo que se ve), que es la convención del orto y el ocaso;
 * `none` da la **geométrica**, que es la que define los crepúsculos. Mezclarlas es un error de
 * medio grado —unos minutos de reloj— que pasa desapercibido si nadie lo escribe.
 */
export type RefractionMode = "standard" | "none";

/** Posición de un cuerpo en el sistema horizontal del observador. */
export interface HorizontalPosition {
  readonly timeUtcMs: EpochMs;
  /** Altura sobre el horizonte en grados, con la refracción que se haya pedido. */
  readonly altitude_deg: number;
  /** Acimut en grados medidos desde el norte hacia el este: 0 = N, 90 = E, 180 = S, 270 = O. */
  readonly azimuth_deg: number;
  readonly refraction: RefractionMode;
}

/** Opciones de {@link AstronomyGateway.horizontalPosition}. */
export interface HorizontalPositionOptions {
  /** Por defecto `standard`: la altura aparente, que es lo que ve quien está en el muelle. */
  readonly refraction?: RefractionMode;
}

/** Un orto (`rise`) o un ocaso (`set`). */
export type HorizonEventKind = "rise" | "set";

/**
 * Cruce del horizonte por el borde superior del disco, con refracción estándar y —para la Luna—
 * su paralaje: la misma convención que publican las efemérides del USNO.
 */
export interface HorizonEvent {
  readonly kind: HorizonEventKind;
  readonly body: CelestialBody;
  readonly timeUtcMs: EpochMs;
  readonly azimuth_deg: number;
}

/** Los tres crepúsculos náuticos clásicos, por la depresión del centro del Sol. */
export type TwilightKind = "civil" | "nautical" | "astronomical";

/** `dawn` es el crepúsculo matutino (el Sol sube); `dusk`, el vespertino (el Sol baja). */
export type TwilightPhase = "dawn" | "dusk";

/**
 * Depresión geométrica del centro del Sol bajo el horizonte que define cada crepúsculo, en grados.
 * Son las definiciones estándar (USNO, *Astronomical Almanac*): −6°, −12° y −18°.
 */
export const TWILIGHT_ALTITUDE_DEG: Readonly<Record<TwilightKind, number>> = Object.freeze({
  civil: -6,
  nautical: -12,
  astronomical: -18,
});

/** Instante en que el centro del Sol cruza la altura que define un crepúsculo. */
export interface TwilightEvent {
  readonly kind: TwilightKind;
  readonly phase: TwilightPhase;
  readonly timeUtcMs: EpochMs;
}

/** Paso por el meridiano: `upper` es la culminación; `lower`, el paso por el antimeridiano. */
export type TransitKind = "upper" | "lower";

/**
 * Paso del cuerpo por el meridiano del observador. A diferencia del orto/ocaso, un tránsito
 * **siempre existe** (una vez por día sidéreo del cuerpo), también en latitudes polares: por eso
 * no devuelve una búsqueda con posible fallo sino el evento directamente.
 */
export interface TransitEvent {
  readonly kind: TransitKind;
  readonly body: CelestialBody;
  readonly timeUtcMs: EpochMs;
  readonly altitude_deg: number;
  readonly azimuth_deg: number;
}

/**
 * Por qué una búsqueda de cruce del horizonte no encontró nada en su ventana.
 *
 * No existe un «no hay evento» mudo: o el cuerpo pasó toda la ventana por encima del umbral
 * (`always-above`: sol de medianoche, luna circumpolar, noche que nunca llega a ser astronómica)
 * o por debajo (`always-below`: noche polar).
 */
export type NoEventReason = "always-above" | "always-below";

/**
 * Resultado de buscar un cruce de umbral. Unión discriminada a propósito: obliga al consumidor a
 * ramificar el caso polar en vez de tragarse un `null` y renderizar «--:--» por accidente.
 */
export type SkySearch<TEvent> =
  | { readonly outcome: "event"; readonly event: TEvent }
  | {
      readonly outcome: "no-event";
      readonly reason: NoEventReason;
      readonly searchedFromUtcMs: EpochMs;
      readonly searchedDays: number;
    };

/** Las cuatro fases principales (cuartos) del ciclo lunar. */
export type MoonQuarterName = "new" | "first-quarter" | "full" | "last-quarter";

/** Instante exacto de un cuarto lunar. */
export interface MoonQuarterEvent {
  readonly quarter: MoonQuarterName;
  readonly timeUtcMs: EpochMs;
}

/** Nombre descriptivo de la fase continua, con los cuartos como puntos y no como intervalos. */
export type MoonPhaseName =
  | "new"
  | "waxing-crescent"
  | "first-quarter"
  | "waxing-gibbous"
  | "full"
  | "waning-gibbous"
  | "last-quarter"
  | "waning-crescent";

/** Estado de iluminación de la Luna en un instante. */
export interface MoonIllumination {
  readonly timeUtcMs: EpochMs;
  /**
   * Elongación eclíptica Luna−Sol en grados, en [0, 360): 0 = nueva, 90 = cuarto creciente,
   * 180 = llena, 270 = cuarto menguante. Es la magnitud que define la fase, no un ángulo de fase.
   */
  readonly phaseAngle_deg: number;
  /** Días transcurridos desde la nueva anterior (0 … ~29,53). */
  readonly ageDays: number;
  /** Fracción del disco iluminada vista desde la Tierra, en [0, 1]. */
  readonly illuminatedFraction: number;
  readonly name: MoonPhaseName;
}

/** Distancia geocéntrica al centro de la Luna. */
export interface MoonDistance {
  readonly timeUtcMs: EpochMs;
  readonly distance_km: number;
}

/** Opciones de las búsquedas que pueden no encontrar evento. */
export interface SkySearchOptions {
  /** Ancho de la ventana de búsqueda hacia adelante, en días. Por defecto 1. */
  readonly searchDays?: number;
}

/**
 * Puerta del dominio a las efemérides. Existe para que el resto del código (y `solunar/` en
 * particular) dependa de esta interfaz y no del paquete que hoy la implementa: si mañana hay que
 * cambiar de motor, se sustituye una implementación y nada más.
 */
export interface AstronomyGateway {
  horizontalPosition(
    body: CelestialBody,
    location: GeoLocation,
    atUtcMs: EpochMs,
    options?: HorizontalPositionOptions,
  ): HorizontalPosition;
  searchHorizonEvent(
    body: CelestialBody,
    location: GeoLocation,
    fromUtcMs: EpochMs,
    kind: HorizonEventKind,
    options?: SkySearchOptions,
  ): SkySearch<HorizonEvent>;
  searchTwilight(
    location: GeoLocation,
    fromUtcMs: EpochMs,
    kind: TwilightKind,
    phase: TwilightPhase,
    options?: SkySearchOptions,
  ): SkySearch<TwilightEvent>;
  searchTransit(
    body: CelestialBody,
    location: GeoLocation,
    fromUtcMs: EpochMs,
    kind: TransitKind,
  ): TransitEvent;
  moonIllumination(atUtcMs: EpochMs): MoonIllumination;
  moonDistance(atUtcMs: EpochMs): MoonDistance;
  nextMoonQuarters(fromUtcMs: EpochMs, count: number): readonly MoonQuarterEvent[];
}

/** Coordenadas fuera del rango físico, o no finitas: el llamante se equivocó, no la efeméride. */
export class InvalidGeoLocationError extends Error {
  readonly location: GeoLocation;

  constructor(location: GeoLocation, detail: string) {
    super(`Ubicación inválida (${detail}): ${JSON.stringify(location)}`);
    this.name = "InvalidGeoLocationError";
    this.location = location;
  }
}

/** Instante no finito o fuera del rango en que la efeméride mantiene su exactitud. */
export class InvalidInstantError extends Error {
  readonly timeUtcMs: number;

  constructor(timeUtcMs: number, detail: string) {
    super(`Instante inválido (${detail}): ${timeUtcMs}`);
    this.name = "InvalidInstantError";
    this.timeUtcMs = timeUtcMs;
  }
}

/** Ventana de búsqueda vacía, negativa o absurda: la búsqueda no se intenta a ciegas. */
export class InvalidSearchWindowError extends Error {
  readonly searchDays: number;

  constructor(searchDays: number) {
    super(`Ventana de búsqueda inválida: ${searchDays} días (debe ser finita y > 0)`);
    this.name = "InvalidSearchWindowError";
    this.searchDays = searchDays;
  }
}
