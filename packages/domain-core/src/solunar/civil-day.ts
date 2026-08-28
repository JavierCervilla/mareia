/**
 * Proyección de un día civil de una zona IANA sobre el eje UTC.
 *
 * Es el **único** sitio de `solunar/` donde aparece una zona horaria. Todo el cálculo astronómico
 * ocurre en UTC; la zona solo decide qué trozo del eje se llama «el martes» — que es justo lo que
 * hace que un día pueda tener uno o dos periodos mayores.
 *
 * Se apoya en `Intl.DateTimeFormat`, disponible en Node, Deno y navegador con ICU completo, en vez
 * de embarcar una tabla tzdata propia que habría que mantener al día.
 */

import type { EpochMs } from "../tides/types.ts";

const MS_PER_SECOND = 1000;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Zona horaria que el entorno no reconoce (o que no es una zona IANA). */
export class InvalidTimeZoneError extends Error {
  readonly timeZone: string;

  constructor(timeZone: string) {
    super(`Zona horaria IANA desconocida: ${JSON.stringify(timeZone)}`);
    this.name = "InvalidTimeZoneError";
    this.timeZone = timeZone;
  }
}

/** Fecha civil que no es un `YYYY-MM-DD` real. */
export class InvalidCivilDateError extends Error {
  readonly dateIso: string;

  constructor(dateIso: string, detail: string) {
    super(`Fecha civil inválida (${detail}): ${JSON.stringify(dateIso)}`);
    this.name = "InvalidCivilDateError";
    this.dateIso = dateIso;
  }
}

/** El día civil `dateIso` de `timeZone`, como intervalo semiabierto `[start, end)` en UTC. */
export interface CivilDayBounds {
  readonly dateIso: string;
  readonly timeZone: string;
  readonly startUtcMs: EpochMs;
  readonly endUtcMs: EpochMs;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached !== undefined) {
    return cached;
  }
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    throw new InvalidTimeZoneError(timeZone);
  }
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function partsToWallMs(parts: readonly Intl.DateTimeFormatPart[]): number {
  const value = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type);
    return part === undefined ? Number.NaN : Number(part.value);
  };
  return Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );
}

/**
 * Desplazamiento de la zona respecto de UTC en el instante dado, en milisegundos (positivo al
 * este). Se obtiene formateando el instante en la zona y leyendo la hora de pared: es la forma de
 * preguntarle a ICU sin depender de una tabla propia.
 */
export function timeZoneOffsetMs(timeZone: string, atUtcMs: EpochMs): number {
  const wallMs = partsToWallMs(formatterFor(timeZone).formatToParts(new Date(atUtcMs)));
  // ICU no reporta milisegundos: se compara contra el instante truncado al segundo para que el
  // desplazamiento salga exacto y no arrastre el resto de milisegundos del argumento.
  return wallMs - Math.floor(atUtcMs / MS_PER_SECOND) * MS_PER_SECOND;
}

/**
 * Hora de pared (interpretada como si fuese UTC) → instante UTC real en esa zona.
 *
 * Dos pasadas: la primera estima el desplazamiento con el propio valor de pared y la segunda lo
 * corrige con el instante ya aproximado. Basta porque los saltos de horario son de una hora y las
 * conversiones son monótonas salvo en la propia discontinuidad.
 *
 * Las dos horas de pared patológicas del cambio de horario se resuelven así, y está medido en el
 * test: la que **no existe** (02:30 el día que se adelanta el reloj) se desplaza hacia adelante el
 * tamaño del salto (sale 03:30 local); la que ocurre **dos veces** (02:30 el día que se atrasa) se
 * resuelve en la **segunda**, la del horario ya cambiado.
 *
 * Para lo que usa este módulo da igual: solo se convierten medianoches, y son ambiguas únicamente
 * en las pocas zonas que cambian la hora a las 00:00. Un día civil sigue siendo el intervalo entre
 * dos medianoches consecutivas, dure 23, 24 o 25 horas.
 */
export function wallTimeToUtcMs(wallMs: number, timeZone: string): EpochMs {
  const firstGuess = wallMs - timeZoneOffsetMs(timeZone, wallMs);
  return wallMs - timeZoneOffsetMs(timeZone, firstGuess);
}

function parseIsoDate(dateIso: string): { year: number; month: number; day: number } {
  const match = ISO_DATE_PATTERN.exec(dateIso);
  if (match === null) {
    throw new InvalidCivilDateError(dateIso, "no tiene la forma YYYY-MM-DD");
  }
  const [, yearText = "", monthText = "", dayText = ""] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const roundTrip = new Date(Date.UTC(year, month - 1, day));
  if (roundTrip.getUTCMonth() !== month - 1 || roundTrip.getUTCDate() !== day) {
    throw new InvalidCivilDateError(dateIso, "no es una fecha del calendario");
  }
  return { year, month, day };
}

/**
 * Límites UTC del día civil `dateIso` en `timeZone`: de medianoche local a la medianoche local
 * siguiente. El intervalo es semiabierto `[start, end)` y **no** dura siempre 24 h.
 */
export function civilDayBounds(dateIso: string, timeZone: string): CivilDayBounds {
  const { year, month, day } = parseIsoDate(dateIso);
  const startUtcMs = wallTimeToUtcMs(Date.UTC(year, month - 1, day), timeZone);
  const endUtcMs = wallTimeToUtcMs(Date.UTC(year, month - 1, day + 1), timeZone);
  if (endUtcMs <= startUtcMs) {
    throw new InvalidCivilDateError(dateIso, `día vacío o invertido en ${timeZone}`);
  }
  return { dateIso, timeZone, startUtcMs, endUtcMs };
}

/** Fecha civil (`YYYY-MM-DD`) a la que pertenece un instante UTC en la zona dada. */
export function civilDateOf(atUtcMs: EpochMs, timeZone: string): string {
  const parts = formatterFor(timeZone).formatToParts(new Date(atUtcMs));
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
