/**
 * Los DTO que salen por el API y las funciones puras que los construyen desde el dominio.
 *
 * Dos decisiones de forma, aplicadas en todas las respuestas:
 *
 * 1. **Cada instante viaja dos veces**: `…UtcMs` (epoch ms UTC, lo que usa el dominio y lo que
 *    quiere un cliente que calcula) y `…Utc` (ISO 8601, lo que quiere un humano leyendo la
 *    respuesta). Nunca hay horas locales: la zona horaria del puerto viaja aparte y quien pinta
 *    decide cómo proyectarla.
 * 2. **Solo se redondea el ruido por debajo de la resolución del método**: los instantes al
 *    segundo (la bisección de extremos converge con tolerancia de 1 s) y las alturas al milímetro
 *    (el RMSE del dataset está en centímetros). Ángulos, fracciones y distancias salen tal cual los
 *    da el motor: recortarlos sería inventarse una precisión — o perderla — sin justificación.
 */

import type {
  EpochMs,
  HorizonEvent,
  MoonIllumination,
  SkySearch,
  TideExtreme,
  TideSample,
  TransitEvent,
  TwilightEvent,
} from "@mareia/domain-core";

import type { Port, StationQuality, StationRecord, SourceAttribution } from "./types.ts";

const MS_PER_SECOND = 1_000;
/** Milímetro: la resolución con la que se publican las alturas. */
const HEIGHT_DECIMALS = 3;

/** Instante publicado: el mismo momento en las dos formas. */
export interface InstantDto {
  readonly timeUtcMs: EpochMs;
  readonly timeUtc: string;
}

/** Ventana temporal publicada (un día civil, el rango de una consulta, el año del almanaque). */
export interface WindowDto {
  readonly startUtcMs: EpochMs;
  readonly startUtc: string;
  readonly endUtcMs: EpochMs;
  readonly endUtc: string;
}

/** Ficha pública de un puerto. `stationFile` no viaja: es dónde guardamos el dato, no el dato. */
export interface PortDto {
  readonly slug: string;
  readonly name: string;
  readonly province: { readonly slug: string; readonly name: string };
  readonly region: { readonly slug: string; readonly name: string };
  readonly lat: number;
  readonly lon: number;
  readonly timezone: string;
}

/**
 * Procedencia y calidad del dato de marea. Viaja en **toda** respuesta que contenga alturas: un
 * grade C con `hw_time_err_p95_min: null` tiene que llegar al cliente para que pueda decirlo.
 */
export interface StationDto {
  readonly id: string;
  readonly name: string;
  readonly datum: { readonly reference: string; readonly msl_offset_m: number };
  /** Constituyentes armónicos efectivamente usados en la predicción. */
  readonly constituents: number;
  readonly quality: StationQuality;
  readonly attributions: readonly SourceAttribution[];
}

export interface TideEventDto extends InstantDto {
  readonly kind: "high" | "low";
  readonly height_m: number;
}

export interface TideSampleDto extends InstantDto {
  readonly height_m: number;
}

export interface HorizonEventDto extends InstantDto {
  readonly kind: "rise" | "set";
  readonly body: "sun" | "moon";
  readonly azimuth_deg: number;
}

export interface TwilightEventDto extends InstantDto {
  readonly kind: "civil" | "nautical" | "astronomical";
  readonly phase: "dawn" | "dusk";
}

export interface TransitEventDto extends InstantDto {
  readonly kind: "upper" | "lower";
  readonly body: "sun" | "moon";
  readonly altitude_deg: number;
  readonly azimuth_deg: number;
}

export interface MoonIlluminationDto extends InstantDto {
  readonly phaseAngle_deg: number;
  readonly ageDays: number;
  readonly illuminatedFraction: number;
  readonly name: string;
}

/**
 * Búsqueda que puede no encontrar evento, serializada **sin `null`**: el caso polar (sol de
 * medianoche, luna circumpolar) llega como `outcome: "no-event"` con su motivo, y no como un hueco
 * que el cliente pinte de `--:--` por accidente.
 */
export type SkySearchDto<TEvent> =
  | { readonly outcome: "event"; readonly event: TEvent }
  | {
      readonly outcome: "no-event";
      readonly reason: "always-above" | "always-below";
      readonly searchedFromUtcMs: EpochMs;
      readonly searchedFromUtc: string;
      readonly searchedDays: number;
    };

/** Instante al segundo: por debajo de eso solo hay ruido de la bisección. */
export function toInstant(timeUtcMs: EpochMs): InstantDto {
  const rounded = Math.round(timeUtcMs / MS_PER_SECOND) * MS_PER_SECOND;
  return { timeUtcMs: rounded, timeUtc: new Date(rounded).toISOString() };
}

export function toWindow(startUtcMs: EpochMs, endUtcMs: EpochMs): WindowDto {
  return {
    startUtcMs,
    startUtc: new Date(startUtcMs).toISOString(),
    endUtcMs,
    endUtc: new Date(endUtcMs).toISOString(),
  };
}

/** Altura al milímetro. */
export function toHeight(height_m: number): number {
  return Number(height_m.toFixed(HEIGHT_DECIMALS));
}

export function toPortDto(port: Port): PortDto {
  return {
    slug: port.slug,
    name: port.name,
    province: port.province,
    region: port.region,
    lat: port.lat,
    lon: port.lon,
    timezone: port.timezone,
  };
}

export function toStationDto(station: StationRecord): StationDto {
  return {
    id: station.id,
    name: station.name,
    datum: { reference: station.datum.reference, msl_offset_m: station.datum.msl_offset_m },
    constituents: station.constituents.length,
    quality: station.quality,
    attributions: station.attributions,
  };
}

export function toTideEventDto(extreme: TideExtreme): TideEventDto {
  return { ...toInstant(extreme.timeUtcMs), kind: extreme.kind, height_m: toHeight(extreme.height_m) };
}

export function toTideSampleDto(sample: TideSample): TideSampleDto {
  return { ...toInstant(sample.timeUtcMs), height_m: toHeight(sample.height_m) };
}

export function toHorizonEventDto(event: HorizonEvent): HorizonEventDto {
  return {
    ...toInstant(event.timeUtcMs),
    kind: event.kind,
    body: event.body,
    azimuth_deg: event.azimuth_deg,
  };
}

export function toTwilightEventDto(event: TwilightEvent): TwilightEventDto {
  return { ...toInstant(event.timeUtcMs), kind: event.kind, phase: event.phase };
}

export function toTransitEventDto(event: TransitEvent): TransitEventDto {
  return {
    ...toInstant(event.timeUtcMs),
    kind: event.kind,
    body: event.body,
    altitude_deg: event.altitude_deg,
    azimuth_deg: event.azimuth_deg,
  };
}

export function toMoonIlluminationDto(moon: MoonIllumination): MoonIlluminationDto {
  return {
    ...toInstant(moon.timeUtcMs),
    phaseAngle_deg: moon.phaseAngle_deg,
    ageDays: moon.ageDays,
    illuminatedFraction: moon.illuminatedFraction,
    name: moon.name,
  };
}

/** Serializa una búsqueda del cielo conservando el motivo cuando no hay evento. */
export function toSkySearchDto<TDomain, TDto>(
  search: SkySearch<TDomain>,
  toEvent: (event: TDomain) => TDto,
): SkySearchDto<TDto> {
  if (search.outcome === "event") {
    return { outcome: "event", event: toEvent(search.event) };
  }
  return {
    outcome: "no-event",
    reason: search.reason,
    searchedFromUtcMs: search.searchedFromUtcMs,
    searchedFromUtc: new Date(search.searchedFromUtcMs).toISOString(),
    searchedDays: search.searchedDays,
  };
}
