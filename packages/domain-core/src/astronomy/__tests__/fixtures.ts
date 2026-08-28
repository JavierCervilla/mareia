/**
 * Adaptación del oráculo externo (USNO) al dominio.
 *
 * Los ficheros de `fixtures/usno/` son respuestas verbatim de la API; aquí —y solo aquí— se
 * parsean las horas «HH:mm» como UTC del día pedido y se traducen los nombres de evento. Ver
 * `fixtures/usno/README.md` para la procedencia y las trampas de husos y unidades.
 *
 * Este módulo es solo de test: lee ficheros, cosa que el dominio nunca hace.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GeoLocation, MoonQuarterName } from "../types.ts";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures", "usno");

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;

/** Sitios de prueba, con las coordenadas exactas con las que se pidieron las efemérides. */
export const USNO_SITES = {
  madrid: {
    slug: "madrid",
    name: "Madrid",
    location: { latitude_deg: 40.4168, longitude_deg: -3.7038 } satisfies GeoLocation,
    timeZone: "Europe/Madrid",
  },
  lasPalmas: {
    slug: "las-palmas",
    name: "Las Palmas de Gran Canaria",
    location: { latitude_deg: 28.1235, longitude_deg: -15.4363 } satisfies GeoLocation,
    timeZone: "Atlantic/Canary",
  },
} as const;

/** Fechas (UTC) descargadas para los dos sitios. */
export const USNO_DATES = [
  "2026-01-20",
  "2026-03-20",
  "2026-05-05",
  "2026-06-21",
  "2026-08-12",
  "2026-09-23",
  "2026-11-11",
  "2026-12-21",
] as const;

interface UsnoPhenomenon {
  readonly phen: string;
  readonly time: string;
}

interface UsnoOneDayData {
  readonly sundata: readonly UsnoPhenomenon[];
  readonly moondata: readonly UsnoPhenomenon[];
  readonly fracillum: string;
  readonly curphase?: string;
}

interface UsnoOneDayResponse {
  readonly properties: { readonly data: UsnoOneDayData };
}

interface UsnoPhaseEntry {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly phase: string;
  readonly time: string;
}

interface UsnoPhasesResponse {
  readonly phasedata: readonly UsnoPhaseEntry[];
}

function readJson<T>(...segments: readonly string[]): T {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, ...segments), "utf8")) as T;
}

/** «HH:mm» del USNO (con `tz=0`) → epoch ms UTC del día pedido. */
function parseUtcTimeOfDay(dateIso: string, hhmm: string): number {
  const dayStartMs = Date.parse(`${dateIso}T00:00:00Z`);
  const hours = Number(hhmm.slice(0, 2));
  const minutes = Number(hhmm.slice(3, 5));
  if (Number.isNaN(dayStartMs) || Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw new Error(`Hora USNO ilegible: ${dateIso} ${hhmm}`);
  }
  return dayStartMs + hours * MS_PER_HOUR + minutes * MS_PER_MINUTE;
}

/** Un fenómeno publicado por el USNO, ya en el vocabulario del dominio. */
export interface UsnoEvent {
  readonly phenomenon: "rise" | "set" | "upper-transit" | "civil-dawn" | "civil-dusk";
  readonly timeUtcMs: number;
}

const PHENOMENON_BY_USNO_NAME: Readonly<Record<string, UsnoEvent["phenomenon"]>> = Object.freeze({
  "Rise": "rise",
  "Set": "set",
  "Upper Transit": "upper-transit",
  "Begin Civil Twilight": "civil-dawn",
  "End Civil Twilight": "civil-dusk",
});

function toEvents(dateIso: string, raw: readonly UsnoPhenomenon[]): readonly UsnoEvent[] {
  const events: UsnoEvent[] = [];
  for (const entry of raw) {
    const phenomenon = PHENOMENON_BY_USNO_NAME[entry.phen];
    if (phenomenon !== undefined) {
      events.push({ phenomenon, timeUtcMs: parseUtcTimeOfDay(dateIso, entry.time) });
    }
  }
  return events;
}

/** Un día del oráculo, listo para comparar. */
export interface UsnoOneDay {
  readonly dateIso: string;
  /** Comienzo del día UTC que enumera el USNO (`tz=0`). */
  readonly dayStartUtcMs: number;
  readonly sun: readonly UsnoEvent[];
  readonly moon: readonly UsnoEvent[];
  /** Fracción iluminada publicada, ya como fracción en [0, 1] (la fuente la da en % entero). */
  readonly illuminatedFraction: number;
}

/** Carga el día del USNO para un sitio (`slug` de {@link USNO_SITES}) y una fecha ISO. */
export function loadUsnoOneDay(siteSlug: string, dateIso: string): UsnoOneDay {
  const { data } = readJson<UsnoOneDayResponse>("oneday", siteSlug, `${dateIso}.json`).properties;
  return {
    dateIso,
    dayStartUtcMs: Date.parse(`${dateIso}T00:00:00Z`),
    sun: toEvents(dateIso, data.sundata),
    moon: toEvents(dateIso, data.moondata),
    illuminatedFraction: Number(data.fracillum.replace("%", "")) / 100,
  };
}

const QUARTER_BY_USNO_NAME: Readonly<Record<string, MoonQuarterName>> = Object.freeze({
  "New Moon": "new",
  "First Quarter": "first-quarter",
  "Full Moon": "full",
  "Last Quarter": "last-quarter",
});

/** Cuarto lunar publicado por el USNO. */
export interface UsnoMoonQuarter {
  readonly quarter: MoonQuarterName;
  readonly timeUtcMs: number;
}

/** Los 50 cuartos lunares de 2026 publicados por el USNO, en orden cronológico. */
export function loadUsnoMoonQuarters2026(): readonly UsnoMoonQuarter[] {
  const { phasedata } = readJson<UsnoPhasesResponse>("moon-phases-2026.json");
  return phasedata.map((entry) => {
    const quarter = QUARTER_BY_USNO_NAME[entry.phase];
    if (quarter === undefined) {
      throw new Error(`Fase USNO desconocida: ${entry.phase}`);
    }
    const dateIso = [
      String(entry.year),
      String(entry.month).padStart(2, "0"),
      String(entry.day).padStart(2, "0"),
    ].join("-");
    return { quarter, timeUtcMs: parseUtcTimeOfDay(dateIso, entry.time) };
  });
}
