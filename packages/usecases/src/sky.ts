/**
 * Casos de uso del cielo sobre el puerto: efemérides del día (`getAstro`) y periodos solunares
 * (`getSolunar`). Ambos proyectan sobre el **día civil del puerto**, en su zona horaria.
 *
 * La efeméride entra por `deps.astronomy` (la interfaz `AstronomyGateway` del dominio): esta capa
 * no sabe qué motor la implementa.
 */

import { solunarDay, TWILIGHT_ALTITUDE_DEG } from "@mareia/domain-core";
import type {
  EpochMs,
  GeoLocation,
  HorizonEventKind,
  SolunarPeriod,
  TwilightKind,
  TwilightPhase,
} from "@mareia/domain-core";

import {
  toHorizonEventDto,
  toInstant,
  toMoonIlluminationDto,
  toPortDto,
  toSkySearchDto,
  toTransitEventDto,
  toTwilightEventDto,
  toWindow,
} from "./dto.ts";
import type {
  HorizonEventDto,
  InstantDto,
  MoonIlluminationDto,
  PortDto,
  SkySearchDto,
  TransitEventDto,
  TwilightEventDto,
  WindowDto,
} from "./dto.ts";
import { resolvePort } from "./resolve.ts";
import type { Port, UseCaseDeps } from "./types.ts";
import { civilDayOrInvalid } from "./validate.ts";

const MS_PER_DAY = 86_400_000;

/** Orto y ocaso de un cuerpo dentro del día, cada uno con su posible caso polar. */
export interface RiseSetDto {
  readonly rise: SkySearchDto<HorizonEventDto>;
  readonly set: SkySearchDto<HorizonEventDto>;
}

/** Crepúsculo matutino y vespertino de una de las tres definiciones. */
export interface TwilightPairDto {
  readonly dawn: SkySearchDto<TwilightEventDto>;
  readonly dusk: SkySearchDto<TwilightEventDto>;
}

export interface SunDto extends RiseSetDto {
  readonly transit: TransitEventDto;
  /** Las tres definiciones clásicas, con su depresión del Sol en grados. */
  readonly twilight: {
    readonly civil: TwilightPairDto;
    readonly nautical: TwilightPairDto;
    readonly astronomical: TwilightPairDto;
    readonly altitudes_deg: Readonly<Record<TwilightKind, number>>;
  };
}

export interface MoonDto extends RiseSetDto {
  readonly upperTransit: TransitEventDto;
  readonly lowerTransit: TransitEventDto;
  /** Fase e iluminación en el mediodía civil del día, que es el instante que la resume. */
  readonly illumination: MoonIlluminationDto;
  readonly distance: InstantDto & { readonly distance_km: number };
}

export interface GetAstroResult {
  readonly port: PortDto;
  readonly dateIso: string;
  readonly timezone: string;
  readonly day: WindowDto;
  readonly sun: SunDto;
  readonly moon: MoonDto;
}

/** Una ventana de actividad solunar. */
export interface SolunarPeriodDto {
  readonly kind: "major" | "minor";
  readonly anchor: "upper-transit" | "lower-transit" | "moonrise" | "moonset";
  readonly startUtcMs: EpochMs;
  readonly startUtc: string;
  readonly peakUtcMs: EpochMs;
  readonly peakUtc: string;
  readonly endUtcMs: EpochMs;
  readonly endUtc: string;
  readonly overlapsSolarEvent: boolean;
}

export interface GetSolunarResult {
  readonly port: PortDto;
  readonly dateIso: string;
  readonly timezone: string;
  readonly day: WindowDto;
  readonly periods: readonly SolunarPeriodDto[];
  readonly moon: MoonIlluminationDto;
  /** Ortos y ocasos solares que se tuvieron en cuenta: la evidencia del rating. */
  readonly solarEvents: readonly HorizonEventDto[];
  readonly rating: {
    readonly score: number;
    readonly label: string;
    readonly moonScore: number;
    readonly solarBonus: number;
    readonly daysFromSyzygy: number;
    readonly solarOverlapCount: number;
  };
}

function locationOf(port: Port): GeoLocation {
  return { latitude_deg: port.lat, longitude_deg: port.lon };
}

/**
 * Día civil del puerto listo para buscar efemérides dentro de él: la ventana de búsqueda es
 * exactamente lo que dura el día, así que un evento encontrado nunca cae fuera del día que se pidió
 * (y en el día del cambio de hora dura 23 o 25 h, no 24).
 */
function civilDayOf(port: Port, dateIso: string): {
  readonly startUtcMs: EpochMs;
  readonly endUtcMs: EpochMs;
  readonly searchDays: number;
} {
  const bounds = civilDayOrInvalid(dateIso, port.timezone, "date");
  return {
    startUtcMs: bounds.startUtcMs,
    endUtcMs: bounds.endUtcMs,
    searchDays: (bounds.endUtcMs - bounds.startUtcMs) / MS_PER_DAY,
  };
}

export async function getAstro(
  deps: UseCaseDeps,
  query: { readonly slug: string; readonly date: string },
): Promise<GetAstroResult> {
  const port = await resolvePort(deps, query.slug);
  const { startUtcMs, endUtcMs, searchDays } = civilDayOf(port, query.date);
  const location = locationOf(port);
  const sky = deps.astronomy;
  const noon = startUtcMs + (endUtcMs - startUtcMs) / 2;

  const riseSet = (body: "sun" | "moon"): RiseSetDto => {
    const search = (kind: HorizonEventKind): SkySearchDto<HorizonEventDto> =>
      toSkySearchDto(
        sky.searchHorizonEvent(body, location, startUtcMs, kind, { searchDays }),
        toHorizonEventDto,
      );
    return { rise: search("rise"), set: search("set") };
  };

  const twilight = (kind: TwilightKind): TwilightPairDto => {
    const search = (phase: TwilightPhase): SkySearchDto<TwilightEventDto> =>
      toSkySearchDto(
        sky.searchTwilight(location, startUtcMs, kind, phase, { searchDays }),
        toTwilightEventDto,
      );
    return { dawn: search("dawn"), dusk: search("dusk") };
  };

  const distance = sky.moonDistance(noon);

  return {
    port: toPortDto(port),
    dateIso: query.date,
    timezone: port.timezone,
    day: toWindow(startUtcMs, endUtcMs),
    sun: {
      ...riseSet("sun"),
      transit: toTransitEventDto(sky.searchTransit("sun", location, startUtcMs, "upper")),
      twilight: {
        civil: twilight("civil"),
        nautical: twilight("nautical"),
        astronomical: twilight("astronomical"),
        altitudes_deg: TWILIGHT_ALTITUDE_DEG,
      },
    },
    moon: {
      ...riseSet("moon"),
      upperTransit: toTransitEventDto(sky.searchTransit("moon", location, startUtcMs, "upper")),
      lowerTransit: toTransitEventDto(sky.searchTransit("moon", location, startUtcMs, "lower")),
      illumination: toMoonIlluminationDto(sky.moonIllumination(noon)),
      distance: { ...toInstant(distance.timeUtcMs), distance_km: distance.distance_km },
    },
  };
}

/** Una ventana solunar en DTO: sus tres instantes (comienzo, pico y fin) en las dos formas. */
function toSolunarPeriodDto(period: SolunarPeriod): SolunarPeriodDto {
  const start = toInstant(period.startUtcMs);
  const peak = toInstant(period.peakUtcMs);
  const end = toInstant(period.endUtcMs);
  return {
    kind: period.kind,
    anchor: period.anchor,
    startUtcMs: start.timeUtcMs,
    startUtc: start.timeUtc,
    peakUtcMs: peak.timeUtcMs,
    peakUtc: peak.timeUtc,
    endUtcMs: end.timeUtcMs,
    endUtc: end.timeUtc,
    overlapsSolarEvent: period.overlapsSolarEvent,
  };
}

export async function getSolunar(
  deps: UseCaseDeps,
  query: { readonly slug: string; readonly date: string },
): Promise<GetSolunarResult> {
  const port = await resolvePort(deps, query.slug);
  // Se valida aquí para que una fecha imposible sea un 400 con mensaje y no la excepción del
  // dominio que `solunarDay` lanzaría por su cuenta.
  civilDayOrInvalid(query.date, port.timezone, "date");
  const day = solunarDay(
    { location: locationOf(port), dateIso: query.date, timeZone: port.timezone },
    deps.astronomy,
  );

  return {
    port: toPortDto(port),
    dateIso: day.dateIso,
    timezone: day.timeZone,
    day: toWindow(day.dayStartUtcMs, day.dayEndUtcMs),
    periods: day.periods.map(toSolunarPeriodDto),
    moon: toMoonIlluminationDto(day.moon),
    solarEvents: day.solarEvents.map(toHorizonEventDto),
    rating: day.rating,
  };
}
