/**
 * Coeficiente de marea de la escala francesa (20-120), calculado con predicción propia de Brest.
 *
 *   C = 100 · (semirrango de la marea en Brest) / U,  con U = 3,05 m
 *
 * `U` es la *unidad de altura*: el semirrango medio de la marea de sizigia equinoccial en Brest,
 * el puerto de referencia con el que el SHOM define la escala. El coeficiente es adimensional y no
 * describe ningún puerto en particular: describe **la marea del día**, y por eso vale desde
 * Dunkerque hasta San Juan de Luz aunque el marnage de cada sitio sea distinto.
 *
 * Dos decisiones que no son obvias y que este módulo toma a propósito:
 *
 * 1. **Se calcula sobre la onda semidiurna**, no sobre la predicción completa. Los coeficientes
 *    publicados de una misma jornada son casi iguales entre sí (102/102, 93/93…), mientras que la
 *    marea real de Brest tiene desigualdad diurna: la pleamar de la tarde no es la de la mañana.
 *    Medido contra los valores publicados de 2026 (ver `__tests__/fixtures/`), la predicción
 *    completa se desvía hasta 7 unidades y la reducción semidiurna se queda en 2. La escala
 *    caracteriza la parte semidiurna de la marea astronómica, así que aquí se filtra la estación a
 *    los constituyentes de especie 2 antes de predecir.
 * 2. **El semirrango se mide contra las dos bajamares adyacentes** (la de antes y la de después de
 *    la pleamar), no contra el nivel medio del datum: así el resultado no depende de que
 *    `msl_offset_m` sea exactamente el nivel medio de la estación.
 *
 * Módulo puro, como el resto del dominio: los constituyentes de Brest entran **por parámetro**
 * (`data/brest/constituents.json` los tiene, pero leerlos es cosa del llamante).
 */

import { civilDayBounds, wallTimeToUtcMs } from "../solunar/civil-day.ts";
import { findConstituent } from "../tides/constituents.ts";
import { findExtremes } from "../tides/extremes.ts";
import { assertValidRange } from "../tides/harmonic.ts";
import type { EpochMs, TideExtreme, TideStation } from "../tides/types.ts";
import { UnsupportedConstituentError } from "../tides/types.ts";
import type { TidalCoefficient, TidalCoefficientDay, TidalCoefficientOptions } from "./types.ts";
import { NoSemidiurnalTideError } from "./types.ts";

/**
 * Unidad de altura de Brest, en metros: el semirrango medio de la marea de sizigia equinoccial.
 * Es la constante que fija la escala —un coeficiente 100 es exactamente esa marea— y la que
 * publica el SHOM.
 */
export const BREST_UNIT_HEIGHT_M = 3.05;

/** La escala francesa se lee en el calendario civil francés. */
export const BREST_TIME_ZONE = "Europe/Paris";

/** Extremos de la escala: por debajo y por encima el coeficiente se recorta, no se extrapola. */
export const MIN_TIDAL_COEFFICIENT = 20;
export const MAX_TIDAL_COEFFICIENT = 120;

/** Especie de Doodson de los constituyentes semidiurnos: dos ciclos por día lunar. */
const SEMIDIURNAL_SPECIES = 2;

const HOUR_MS = 3_600_000;
/**
 * Margen con el que se amplía la búsqueda de extremos para que toda pleamar del rango tenga sus
 * dos bajamares adyacentes dentro. Un ciclo semidiurno dura 12 h 25 min; 13 h sobra.
 */
const ADJACENT_LOW_MARGIN_MS = 13 * HOUR_MS;

const NOON_HOUR = 12;

/**
 * La misma estación reducida a su onda semidiurna.
 *
 * @throws {UnsupportedConstituentError} si algún constituyente no está en la tabla del motor: sin
 * esta comprobación, filtrar por especie se tragaría en silencio un nombre desconocido, que es
 * justo lo que el motor se niega a hacer.
 * @throws {NoSemidiurnalTideError} si no queda ninguno.
 */
export function semidiurnalTide(station: TideStation): TideStation {
  const unsupported = station.constituents
    .filter((constituent) => findConstituent(constituent.name) === undefined)
    .map((constituent) => constituent.name);
  if (unsupported.length > 0) {
    throw new UnsupportedConstituentError(unsupported);
  }
  const constituents = station.constituents.filter(
    (constituent) => findConstituent(constituent.name)?.doodson[0] === SEMIDIURNAL_SPECIES,
  );
  if (constituents.length === 0) {
    throw new NoSemidiurnalTideError(station.id);
  }
  return { ...station, constituents };
}

function unitHeightOf(options: TidalCoefficientOptions): number {
  const unitHeight = options.unitHeight_m ?? BREST_UNIT_HEIGHT_M;
  if (!Number.isFinite(unitHeight) || unitHeight <= 0) {
    throw new RangeError("La unidad de altura debe ser un número de metros positivo");
  }
  return unitHeight;
}

/**
 * Semirrango de la pleamar: la mitad de su distancia a la media de las dos bajamares adyacentes.
 *
 * Promediar las dos —y no tomar solo la anterior o solo la posterior— es lo que hace que el
 * resultado no dependa de por qué lado se mire una marea asimétrica.
 */
function semiRangeOf(high: TideExtreme, previousLow: TideExtreme, nextLow: TideExtreme): number {
  return 0.5 * (high.height_m - 0.5 * (previousLow.height_m + nextLow.height_m));
}

function coefficientOf(high: TideExtreme, semiRange_m: number, unitHeight_m: number): TidalCoefficient {
  const rawValue = (semiRange_m / unitHeight_m) * 100;
  const rounded = Math.round(rawValue);
  const value = Math.min(MAX_TIDAL_COEFFICIENT, Math.max(MIN_TIDAL_COEFFICIENT, rounded));
  return {
    highWaterUtcMs: high.timeUtcMs,
    highWater_m: high.height_m,
    semiRange_m,
    rawValue,
    value,
    clamped: value !== rounded,
  };
}

/**
 * Un coeficiente por cada pleamar de `[fromUtcMs, toUtcMs]`, en orden cronológico.
 *
 * @param station Constituyentes del puerto de referencia (Brest para la escala francesa).
 * @throws {RangeError} si el rango o la unidad de altura no son válidos.
 * @throws {UnsupportedConstituentError} si algún constituyente no está en la tabla.
 * @throws {NoSemidiurnalTideError} si la estación no tiene onda semidiurna.
 */
export function tidalCoefficients(
  station: TideStation,
  fromUtcMs: EpochMs,
  toUtcMs: EpochMs,
  options: TidalCoefficientOptions = {},
): readonly TidalCoefficient[] {
  // Antes de ampliar con el margen: `[to, from]` invertido daría un rango ampliado válido y el
  // error se colaría como una lista vacía.
  assertValidRange(fromUtcMs, toUtcMs);
  const unitHeight_m = unitHeightOf(options);
  const extremes = findExtremes(
    semidiurnalTide(station),
    fromUtcMs - ADJACENT_LOW_MARGIN_MS,
    toUtcMs + ADJACENT_LOW_MARGIN_MS,
  );
  const coefficients: TidalCoefficient[] = [];
  for (const [index, extreme] of extremes.entries()) {
    // Los extremos alternan pleamar/bajamar, así que los vecinos de una pleamar son sus dos
    // bajamares; el margen del barrido garantiza que las dos existen para toda pleamar del rango.
    const previousLow = extremes[index - 1];
    const nextLow = extremes[index + 1];
    if (extreme.kind !== "high" || previousLow === undefined || nextLow === undefined) {
      continue;
    }
    if (extreme.timeUtcMs < fromUtcMs || extreme.timeUtcMs > toUtcMs) {
      continue;
    }
    coefficients.push(coefficientOf(extreme, semiRangeOf(extreme, previousLow, nextLow), unitHeight_m));
  }
  return coefficients;
}

/**
 * Los coeficientes del día civil `dateIso`, repartidos en mañana y tarde por el mediodía local.
 *
 * Es la forma en que los publican los almanaques: dos números por día, o uno los días en que solo
 * hay una pleamar. En los días de 25 horas del cambio de horario pueden caber tres pleamares; las
 * tres están en `coefficients`, y `morning`/`afternoon` siguen siendo la primera de cada mitad.
 *
 * @throws {InvalidCivilDateError} si `dateIso` no es un `YYYY-MM-DD` real.
 * @throws {InvalidTimeZoneError} si la zona no es una zona IANA que el entorno conozca.
 */
export function tidalCoefficientDay(
  station: TideStation,
  dateIso: string,
  options: TidalCoefficientOptions = {},
): TidalCoefficientDay {
  const timeZone = options.timeZone ?? BREST_TIME_ZONE;
  const bounds = civilDayBounds(dateIso, timeZone);
  const noonUtcMs = wallTimeToUtcMs(Date.parse(`${dateIso}T${NOON_HOUR}:00:00Z`), timeZone);
  const coefficients = tidalCoefficients(station, bounds.startUtcMs, bounds.endUtcMs - 1, options);
  return {
    dateIso,
    timeZone,
    coefficients,
    morning: coefficients.find((coefficient) => coefficient.highWaterUtcMs < noonUtcMs),
    afternoon: coefficients.find((coefficient) => coefficient.highWaterUtcMs >= noonUtcMs),
  };
}
