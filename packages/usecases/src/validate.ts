/**
 * Validación de la entrada de los casos de uso. Es **ruidosa a propósito**: cada límite publicado
 * (rango máximo, ventana del almanaque, paso de la curva) se comprueba aquí y falla con
 * `InvalidQueryError` diciendo qué se esperaba, en vez de recortar en silencio o de intentar
 * calcular un año entero a paso de un minuto.
 */

import { civilDayBounds, InvalidCivilDateError } from "@mareia/domain-core";
import type { CivilDayBounds } from "@mareia/domain-core";

import { InvalidQueryError } from "./errors.ts";

/** Días máximos que abarca una consulta de mareas, extremos incluidos. */
export const MAX_TIDES_RANGE_DAYS = 40;

/** Cuántos años a cada lado del actual acepta el almanaque. */
export const ALMANAC_YEAR_WINDOW = 1;

/** Paso por defecto de la curva, en minutos: resolución de sobra para dibujarla. */
export const DEFAULT_CURVE_STEP_MINUTES = 10;

/** Límites del paso de la curva, en minutos. */
export const MIN_CURVE_STEP_MINUTES = 1;
export const MAX_CURVE_STEP_MINUTES = 60;

/**
 * Tope de puntos de curva por respuesta. Con el paso por defecto, el rango máximo (40 días) cabe
 * holgado; el tope solo muerde si se piden pasos finos sobre rangos largos, y entonces el 400 dice
 * cómo salir del paso en vez de devolver un megabyte de JSON.
 */
export const MAX_CURVE_SAMPLES = 6_000;

const MS_PER_DAY = 86_400_000;

/**
 * Límites UTC de un día civil, traduciendo el fallo del dominio a un 400.
 *
 * La comprobación de que la fecha existe en el calendario ya la hace `civilDayBounds`; repetirla
 * aquí sería tener dos definiciones de «fecha válida» que pueden divergir.
 */
export function civilDayOrInvalid(dateIso: string, timeZone: string, field: string): CivilDayBounds {
  try {
    return civilDayBounds(dateIso, timeZone);
  } catch (cause) {
    if (cause instanceof InvalidCivilDateError) {
      throw new InvalidQueryError(
        `El parámetro '${field}' debe ser una fecha del calendario en formato YYYY-MM-DD; llegó ${JSON.stringify(dateIso)}`,
      );
    }
    throw cause;
  }
}

/** Un parámetro obligatorio que llegó vacío o ausente. */
export function requireParam(value: string | undefined, field: string): string {
  if (value === undefined || value.trim() === "") {
    throw new InvalidQueryError(`Falta el parámetro obligatorio '${field}'`);
  }
  return value;
}

/**
 * Intervalo UTC `[start, end)` que cubre los días civiles `from`..`to` completos, ambos incluidos.
 *
 * El final es la medianoche local del día siguiente a `to`: quien pide `from=to` recibe el día
 * entero, que es lo que espera quien pregunta por «las mareas de hoy».
 */
export function resolveDayRange(
  fromIso: string,
  toIso: string,
  timeZone: string,
): { readonly startUtcMs: number; readonly endUtcMs: number } {
  const from = civilDayOrInvalid(fromIso, timeZone, "from");
  const to = civilDayOrInvalid(toIso, timeZone, "to");
  if (to.endUtcMs <= from.startUtcMs) {
    throw new InvalidQueryError(`El rango está invertido: 'from' (${fromIso}) es posterior a 'to' (${toIso})`);
  }
  const spanDays = Math.round((to.endUtcMs - from.startUtcMs) / MS_PER_DAY);
  if (spanDays > MAX_TIDES_RANGE_DAYS) {
    throw new InvalidQueryError(
      `El rango pedido abarca ${spanDays} días y el máximo son ${MAX_TIDES_RANGE_DAYS}: acorta 'from'/'to'`,
    );
  }
  return { startUtcMs: from.startUtcMs, endUtcMs: to.endUtcMs };
}

/** Paso de la curva en minutos, ya validado contra sus límites y contra el tope de puntos. */
export function resolveCurveStep(
  raw: string | number | undefined,
  startUtcMs: number,
  endUtcMs: number,
): number {
  const stepMinutes = raw === undefined || raw === "" ? DEFAULT_CURVE_STEP_MINUTES : Number(raw);
  if (
    !Number.isFinite(stepMinutes) ||
    stepMinutes < MIN_CURVE_STEP_MINUTES ||
    stepMinutes > MAX_CURVE_STEP_MINUTES
  ) {
    throw new InvalidQueryError(
      `El parámetro 'step' debe ser un número de minutos entre ${MIN_CURVE_STEP_MINUTES} y ${MAX_CURVE_STEP_MINUTES}; llegó ${JSON.stringify(raw)}`,
    );
  }
  const samples = Math.ceil((endUtcMs - startUtcMs) / (stepMinutes * 60_000)) + 1;
  if (samples > MAX_CURVE_SAMPLES) {
    throw new InvalidQueryError(
      `La curva pedida tendría ${samples} puntos y el máximo son ${MAX_CURVE_SAMPLES}: aumenta 'step' o acorta el rango`,
    );
  }
  return stepMinutes;
}

/**
 * Año del almanaque, dentro de la ventana permitida alrededor del año en curso **del puerto**
 * (su zona horaria, no la del servidor: en Nochevieja no son el mismo año).
 */
export function resolveAlmanacYear(raw: string | number, nowUtcMs: number, timeZone: string): number {
  const year = Number(raw);
  if (!Number.isInteger(year)) {
    throw new InvalidQueryError(`El año debe ser un entero de cuatro cifras; llegó ${JSON.stringify(raw)}`);
  }
  const currentYear = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric" }).format(new Date(nowUtcMs)),
  );
  const first = currentYear - ALMANAC_YEAR_WINDOW;
  const last = currentYear + ALMANAC_YEAR_WINDOW;
  if (year < first || year > last) {
    throw new InvalidQueryError(
      `El almanaque solo cubre de ${first} a ${last} (año en curso ±${ALMANAC_YEAR_WINDOW}); se pidió ${year}`,
    );
  }
  return year;
}
