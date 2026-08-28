/**
 * Casos de uso de marea: el rango que pide una pantalla (`getTides`) y el año entero que se lleva
 * la PWA para funcionar sin red (`getAlmanac`).
 *
 * Ambos son deterministas: mismas constantes armónicas y mismo rango, misma respuesta byte a byte.
 * De ahí que el adaptador HTTP les pueda poner un `Cache-Control` largo.
 */

import { civilDateOf, findExtremes, sampleCurve } from "@mareia/domain-core";
import type { EpochMs, TideStation } from "@mareia/domain-core";

import {
  toPortDto,
  toStationDto,
  toTideEventDto,
  toTideSampleDto,
  toWindow,
} from "./dto.ts";
import type { PortDto, StationDto, TideEventDto, TideSampleDto, WindowDto } from "./dto.ts";
import { resolveStation } from "./resolve.ts";
import type { StationRecord, UseCaseDeps } from "./types.ts";
import {
  civilDayOrInvalid,
  resolveAlmanacYear,
  resolveCurveStep,
  resolveDayRange,
} from "./validate.ts";

/** Rango consultado: los días civiles que se pidieron y el intervalo UTC al que equivalen. */
export interface TideRangeDto extends WindowDto {
  readonly fromIso: string;
  readonly toIso: string;
  readonly timezone: string;
}

/** La curva muestreada, con el paso que se acabó usando (el pedido o el de por defecto). */
export interface TideCurveDto {
  readonly stepMinutes: number;
  readonly samples: readonly TideSampleDto[];
}

export interface GetTidesQuery {
  readonly slug: string;
  /** Primer día civil incluido, `YYYY-MM-DD` en la zona del puerto. */
  readonly from: string;
  /** Último día civil incluido, `YYYY-MM-DD` en la zona del puerto. */
  readonly to: string;
  /** Paso de la curva en minutos; si se omite, `DEFAULT_CURVE_STEP_MINUTES`. */
  readonly step?: string | number;
}

export interface GetTidesResult {
  readonly port: PortDto;
  readonly station: StationDto;
  readonly range: TideRangeDto;
  readonly events: readonly TideEventDto[];
  readonly curve: TideCurveDto;
}

/** Un día civil del almanaque con sus pleamares y bajamares. */
export interface AlmanacDayDto {
  readonly dateIso: string;
  readonly events: readonly TideEventDto[];
}

export interface GetAlmanacResult {
  readonly port: PortDto;
  readonly station: StationDto;
  readonly year: number;
  readonly timezone: string;
  readonly window: WindowDto;
  /** Los 365 (o 366) días del año, incluidos los que se quedasen sin eventos. */
  readonly days: readonly AlmanacDayDto[];
}

/**
 * La estación vista por el motor. `StationRecord` lleva metadatos que al motor no le importan; se
 * estrecha aquí para que la llamada diga exactamente qué usa la predicción.
 */
function forEngine(station: StationRecord): TideStation {
  return {
    schema: station.schema,
    id: station.id,
    name: station.name,
    datum: station.datum,
    constituents: station.constituents,
  };
}

/** Extremos del intervalo, ya en DTO. */
function eventsIn(station: StationRecord, startUtcMs: EpochMs, endUtcMs: EpochMs): TideEventDto[] {
  return findExtremes(forEngine(station), startUtcMs, endUtcMs).map(toTideEventDto);
}

export async function getTides(
  deps: UseCaseDeps,
  query: GetTidesQuery,
): Promise<GetTidesResult> {
  const { port, station } = await resolveStation(deps, query.slug);
  const { startUtcMs, endUtcMs } = resolveDayRange(query.from, query.to, port.timezone);
  const stepMinutes = resolveCurveStep(query.step, startUtcMs, endUtcMs);

  return {
    port: toPortDto(port),
    station: toStationDto(station),
    range: {
      fromIso: query.from,
      toIso: query.to,
      timezone: port.timezone,
      ...toWindow(startUtcMs, endUtcMs),
    },
    events: eventsIn(station, startUtcMs, endUtcMs),
    curve: {
      stepMinutes,
      samples: sampleCurve(forEngine(station), startUtcMs, endUtcMs, stepMinutes).map(
        toTideSampleDto,
      ),
    },
  };
}

/** Las fechas civiles de un año, en orden. No depende de la zona: un año son sus días. */
function datesOfYear(year: number): readonly string[] {
  const dates: string[] = [];
  const cursor = new Date(Date.UTC(year, 0, 1));
  while (cursor.getUTCFullYear() === year) {
    dates.push(cursor.toISOString().slice(0, "YYYY-MM-DD".length));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * El año entero de pleamares y bajamares, agrupado por día civil del puerto.
 *
 * Sin curva a propósito: un año muestreado cada 10 min son ~52.000 puntos, y lo que la PWA precachea
 * para funcionar sin red son los extremos (~1.400 al año). Quien necesite la curva pide `tides`.
 */
export async function getAlmanac(
  deps: UseCaseDeps,
  query: { readonly slug: string; readonly year: string | number },
): Promise<GetAlmanacResult> {
  const { port, station } = await resolveStation(deps, query.slug);
  const year = resolveAlmanacYear(query.year, deps.now(), port.timezone);
  const dates = datesOfYear(year);
  const first = dates[0] ?? `${year}-01-01`;
  const last = dates[dates.length - 1] ?? `${year}-12-31`;
  // El año no pasa por `resolveDayRange`: ese límite de 40 días es el de `tides`, y aquí el rango
  // no lo elige quien llama sino el calendario.
  const startUtcMs = civilDayOrInvalid(first, port.timezone, "year").startUtcMs;
  const endUtcMs = civilDayOrInvalid(last, port.timezone, "year").endUtcMs;

  const byDate = new Map<string, TideEventDto[]>(dates.map((dateIso) => [dateIso, []]));
  for (const event of eventsIn(station, startUtcMs, endUtcMs)) {
    byDate.get(civilDateOf(event.timeUtcMs, port.timezone))?.push(event);
  }

  return {
    port: toPortDto(port),
    station: toStationDto(station),
    year,
    timezone: port.timezone,
    window: toWindow(startUtcMs, endUtcMs),
    days: dates.map((dateIso) => ({ dateIso, events: byDate.get(dateIso) ?? [] })),
  };
}
