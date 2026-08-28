/**
 * Cálculo de los periodos solunares de un día civil.
 *
 * Es TypeScript puro sobre la interfaz `AstronomyGateway`: no importa el motor de efemérides ni
 * lee nada del entorno. **Todo el cálculo ocurre en UTC**; la zona horaria solo decide qué trozo
 * del eje temporal se llama «ese día», y esa proyección vive en `civil-day.ts`.
 *
 * De ahí la propiedad que define el módulo: pedir el mismo instante desde dos zonas distintas da
 * exactamente los mismos periodos, solo repartidos en días civiles distintos.
 */

import type { EpochMs } from "../tides/types.ts";
import type {
  AstronomyGateway,
  GeoLocation,
  HorizonEvent,
  HorizonEventKind,
  MoonQuarterEvent,
  TransitEvent,
  TransitKind,
} from "../astronomy/types.ts";
import { astronomyEngineGateway } from "../astronomy/engine.ts";
import { civilDayBounds } from "./civil-day.ts";
import { computeRating, SOLAR_OVERLAP_HALF_WINDOW_MS } from "./rating.ts";
import type { SolunarAnchor, SolunarDay, SolunarDayQuery, SolunarPeriod } from "./types.ts";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/**
 * Duración de cada tipo de periodo, centrado en su fenómeno.
 *
 * Son las duraciones clásicas de la tabla solunar: 2 h para los mayores (tránsitos) y 1 h 30 min
 * para los menores (orto y ocaso lunar). No hay una fuente experimental que fije estos números al
 * minuto; son la convención que usan las tablas publicadas y quedan aquí como constante única y
 * visible en vez de repartidas por el código.
 */
export const MAJOR_PERIOD_DURATION_MS = 2 * MS_PER_HOUR;
export const MINOR_PERIOD_DURATION_MS = 90 * MS_PER_MINUTE;

const MAJOR_HALF_MS = MAJOR_PERIOD_DURATION_MS / 2;
const MINOR_HALF_MS = MINOR_PERIOD_DURATION_MS / 2;

/**
 * Tope de iteraciones al enumerar fenómenos dentro de la ventana. Un día civil ampliado no llega a
 * 27 h, donde caben como mucho 2 tránsitos superiores; 8 es holgura de sobra y evita que un motor
 * que devolviese instantes no crecientes colgase el proceso.
 */
const MAX_EVENTS_PER_WINDOW = 8;

/**
 * Cuánto se avanza el cursor después de encontrar un fenómeno, antes de buscar el siguiente.
 *
 * Hace falta porque una búsqueda que arranca **justo en la raíz** la vuelve a encontrar: el motor
 * devuelve el mismo cruce desplazado fracciones de milisegundo, y el bucle produciría el mismo
 * evento cinco veces. Cinco minutos es seguro: dos ortos (o dos ocasos, o dos tránsitos) del mismo
 * cuerpo distan casi un día, así que este salto no puede esconder ninguno.
 */
const MIN_EVENT_SEPARATION_MS = 5 * MS_PER_MINUTE;

/** Tránsitos de la Luna en el intervalo semiabierto `[fromUtcMs, toUtcMs)`, en orden. */
function enumerateTransits(
  gateway: AstronomyGateway,
  location: GeoLocation,
  kind: TransitKind,
  fromUtcMs: EpochMs,
  toUtcMs: EpochMs,
): readonly TransitEvent[] {
  const transits: TransitEvent[] = [];
  // `searchTransit` devuelve el primero ESTRICTAMENTE posterior al instante dado: se arranca un
  // milisegundo antes para no perder un tránsito que caiga justo en el borde de la ventana.
  let cursorUtcMs = fromUtcMs - 1;
  for (let index = 0; index < MAX_EVENTS_PER_WINDOW; index += 1) {
    const transit = gateway.searchTransit("moon", location, cursorUtcMs, kind);
    if (transit.timeUtcMs >= toUtcMs || transit.timeUtcMs <= cursorUtcMs) {
      break;
    }
    transits.push(transit);
    cursorUtcMs = transit.timeUtcMs + MIN_EVENT_SEPARATION_MS;
  }
  return transits;
}

/**
 * Ortos u ocasos del cuerpo en el intervalo semiabierto `[fromUtcMs, toUtcMs)`, en orden. Si no hay
 * ninguno (día lunar desplazado, o latitud polar) devuelve la lista vacía: aquí el `no-event` es
 * información legítima sobre el cielo, no un error.
 */
function enumerateHorizonEvents(
  gateway: AstronomyGateway,
  body: "sun" | "moon",
  location: GeoLocation,
  kind: HorizonEventKind,
  fromUtcMs: EpochMs,
  toUtcMs: EpochMs,
): readonly HorizonEvent[] {
  const events: HorizonEvent[] = [];
  // Un milisegundo antes: el motor solo encuentra cruces ESTRICTAMENTE posteriores al arranque, y
  // un orto justo en la medianoche pertenece a este día.
  let cursorUtcMs = fromUtcMs - 1;
  for (let index = 0; index < MAX_EVENTS_PER_WINDOW; index += 1) {
    const remainingMs = toUtcMs - cursorUtcMs;
    if (remainingMs <= 0) {
      break;
    }
    const search = gateway.searchHorizonEvent(body, location, cursorUtcMs, kind, {
      searchDays: remainingMs / MS_PER_DAY,
    });
    if (search.outcome !== "event" || search.event.timeUtcMs <= cursorUtcMs) {
      break;
    }
    if (search.event.timeUtcMs >= toUtcMs) {
      break;
    }
    events.push(search.event);
    cursorUtcMs = search.event.timeUtcMs + MIN_EVENT_SEPARATION_MS;
  }
  return events;
}

function periodAt(
  anchor: SolunarAnchor,
  peakUtcMs: EpochMs,
  halfWidthMs: number,
  solarEvents: readonly HorizonEvent[],
): SolunarPeriod {
  const startUtcMs = peakUtcMs - halfWidthMs;
  const endUtcMs = peakUtcMs + halfWidthMs;
  return {
    kind: halfWidthMs === MAJOR_HALF_MS ? "major" : "minor",
    anchor,
    startUtcMs,
    peakUtcMs,
    endUtcMs,
    overlapsSolarEvent: solarEvents.some(
      (event) =>
        event.timeUtcMs + SOLAR_OVERLAP_HALF_WINDOW_MS > startUtcMs &&
        event.timeUtcMs - SOLAR_OVERLAP_HALF_WINDOW_MS < endUtcMs,
    ),
  };
}

/** Distancia en días a la luna nueva o llena más próxima al instante dado. */
function daysFromSyzygy(gateway: AstronomyGateway, atUtcMs: EpochMs): number {
  // Desde 20 días antes, 8 cuartos cubren ~59 días: garantiza al menos una sicigia a cada lado.
  const quarters = gateway.nextMoonQuarters(atUtcMs - 20 * MS_PER_DAY, 8);
  const isSyzygy = (quarter: MoonQuarterEvent): boolean =>
    quarter.quarter === "new" || quarter.quarter === "full";
  const distances = quarters
    .filter(isSyzygy)
    .map((quarter) => Math.abs(quarter.timeUtcMs - atUtcMs) / MS_PER_DAY);
  if (distances.length === 0) {
    throw new Error("No se encontró ninguna sicigia alrededor del día pedido");
  }
  return Math.min(...distances);
}

const MINOR_ANCHOR_BY_KIND: Readonly<Record<HorizonEventKind, SolunarAnchor>> = Object.freeze({
  rise: "moonrise",
  set: "moonset",
});

const MAJOR_ANCHOR_BY_KIND: Readonly<Record<TransitKind, SolunarAnchor>> = Object.freeze({
  upper: "upper-transit",
  lower: "lower-transit",
});

/**
 * Periodos solunares del día civil pedido, con su rating.
 *
 * **Un periodo pertenece al día en el que cae su fenómeno** (el tránsito, el orto o el ocaso de la
 * Luna), no a todos los días que toca su ventana. Su ventana **sí** puede desbordar la medianoche
 * —hasta una hora por cada lado—, y se devuelve tal cual para que se pinte cruzando el borde.
 *
 * El criterio es el que hace que los días particionen los periodos: con el criterio alternativo
 * («todo periodo que interseque el día») un mismo tránsito aparecería en dos días seguidos y un
 * día podría llegar a tener 3 mayores, rompiendo el invariante de 1-2. Con este criterio salen
 * siempre **1 o 2 mayores** (los dos tránsitos distan 12 h 25 min: al menos uno cae en cualquier
 * día) y **0, 1 o 2 menores** (el día lunar dura 24 h 50 min, así que el orto o el ocaso pueden
 * saltarse un día civil): entre 1 y 4 periodos.
 *
 * El `gateway` se inyecta para que este módulo sea puro y testeable contra una efeméride falsa; por
 * omisión usa la real.
 */
export function solunarDay(
  query: SolunarDayQuery,
  gateway: AstronomyGateway = astronomyEngineGateway,
): SolunarDay {
  const bounds = civilDayBounds(query.dateIso, query.timeZone);
  const { location } = query;
  const { startUtcMs, endUtcMs } = bounds;

  // Los ortos y ocasos solares se buscan con holgura: un periodo anclado dentro del día puede
  // extenderse hasta una hora fuera de él, y el solape con el Sol hay que mirarlo también ahí.
  const solarMarginMs = MAJOR_HALF_MS + SOLAR_OVERLAP_HALF_WINDOW_MS;
  const solarEvents = (["rise", "set"] as const)
    .flatMap((kind) =>
      enumerateHorizonEvents(
        gateway,
        "sun",
        location,
        kind,
        startUtcMs - solarMarginMs,
        endUtcMs + solarMarginMs,
      ),
    )
    .sort((left, right) => left.timeUtcMs - right.timeUtcMs);

  const majors = (["upper", "lower"] as const).flatMap((kind) =>
    enumerateTransits(gateway, location, kind, startUtcMs, endUtcMs).map((transit) =>
      periodAt(MAJOR_ANCHOR_BY_KIND[kind], transit.timeUtcMs, MAJOR_HALF_MS, solarEvents),
    ),
  );

  const minors = (["rise", "set"] as const).flatMap((kind) =>
    enumerateHorizonEvents(gateway, "moon", location, kind, startUtcMs, endUtcMs).map((event) =>
      periodAt(MINOR_ANCHOR_BY_KIND[kind], event.timeUtcMs, MINOR_HALF_MS, solarEvents),
    ),
  );

  const periods = [...majors, ...minors].sort((left, right) => left.startUtcMs - right.startUtcMs);
  const civilNoonUtcMs = startUtcMs + (endUtcMs - startUtcMs) / 2;
  const solarOverlapCount = periods.filter((period) => period.overlapsSolarEvent).length;

  return {
    dateIso: bounds.dateIso,
    timeZone: bounds.timeZone,
    dayStartUtcMs: startUtcMs,
    dayEndUtcMs: endUtcMs,
    periods,
    moon: gateway.moonIllumination(civilNoonUtcMs),
    solarEvents,
    rating: computeRating(daysFromSyzygy(gateway, civilNoonUtcMs), solarOverlapCount),
  };
}
