/**
 * Búsqueda de pleamares y bajamares.
 *
 * Estrategia en dos pasos, la habitual en predicción de mareas: se muestrea la derivada de la
 * altura con un paso grueso para localizar los cambios de signo, y cada cambio se refina por
 * bisección hasta el segundo. El muestreo es agnóstico a la mezcla de constituyentes —vale igual
 * en régimen semidiurno, diurno o mixto— y la bisección converge siempre porque la derivada es
 * continua y cambia de signo dentro del intervalo localizado.
 */

import { assertValidRange, heightAt, heightRateAt, prepareStation, stepToMilliseconds } from "./harmonic.ts";
import type { PreparedStation } from "./harmonic.ts";
import type { EpochMs, TideExtreme, TideExtremeKind, TideStation } from "./types.ts";

/**
 * Paso grueso de muestreo por defecto, en minutos. Seis minutos es el paso de las predicciones
 * oficiales y deja unos 60 puntos por ciclo semidiurno: ningún extremo real cae entre dos
 * muestras consecutivas sin que la derivada delate el cambio de signo.
 */
const DEFAULT_COARSE_STEP_MINUTES = 6;
/** Precisión temporal del refinamiento: un segundo, muy por debajo del minuto que se publica. */
const DEFAULT_TOLERANCE_MS = 1_000;
/** Cota de seguridad de la bisección; con tolerancia de 1 s nunca se alcanza. */
const MAX_BISECTION_STEPS = 60;

export interface FindExtremesOptions {
  /** Paso del muestreo grueso, en minutos. Por defecto 6. */
  readonly coarseStepMinutes?: number;
  /** Anchura máxima del intervalo al terminar la bisección, en milisegundos. Por defecto 1000. */
  readonly toleranceMs?: number;
}

interface Bracket {
  readonly startMs: EpochMs;
  readonly endMs: EpochMs;
  readonly kind: TideExtremeKind;
}

/**
 * Localiza los intervalos en los que la derivada cambia de signo. Un paso de creciente a
 * decreciente es una pleamar; el contrario, una bajamar. La comparación asimétrica (`> 0` frente
 * a `<= 0`) evita contar dos veces un extremo que cae justo sobre una muestra.
 */
function bracketSignChanges(
  prepared: PreparedStation,
  fromUtcMs: EpochMs,
  toUtcMs: EpochMs,
  stepMs: number,
): readonly Bracket[] {
  const brackets: Bracket[] = [];
  let previousTime = fromUtcMs;
  let previousRate = heightRateAt(prepared, previousTime);
  while (previousTime < toUtcMs) {
    const time = Math.min(previousTime + stepMs, toUtcMs);
    const rate = heightRateAt(prepared, time);
    if (previousRate > 0 && rate <= 0) {
      brackets.push({ startMs: previousTime, endMs: time, kind: "high" });
    } else if (previousRate < 0 && rate >= 0) {
      brackets.push({ startMs: previousTime, endMs: time, kind: "low" });
    }
    previousTime = time;
    previousRate = rate;
  }
  return brackets;
}

/** Bisección sobre la derivada dentro del intervalo localizado. */
function refineBracket(prepared: PreparedStation, bracket: Bracket, toleranceMs: number): EpochMs {
  let low = bracket.startMs;
  let high = bracket.endMs;
  const risingAtLow = heightRateAt(prepared, low) > 0;
  for (let step = 0; step < MAX_BISECTION_STEPS && high - low > toleranceMs; step += 1) {
    const middle = 0.5 * (low + high);
    const rateIsPositive = heightRateAt(prepared, middle) > 0;
    if (rateIsPositive === risingAtLow) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return Math.round(0.5 * (low + high));
}

/**
 * Pleamares y bajamares en `[fromUtcMs, toUtcMs]`, ordenadas cronológicamente y alternadas.
 *
 * @throws {RangeError} si el rango o el paso no son válidos.
 * @throws {UnsupportedConstituentError} si algún constituyente no está en la tabla.
 */
export function findExtremes(
  station: TideStation,
  fromUtcMs: EpochMs,
  toUtcMs: EpochMs,
  options: FindExtremesOptions = {},
): readonly TideExtreme[] {
  assertValidRange(fromUtcMs, toUtcMs);
  const stepMs = stepToMilliseconds(options.coarseStepMinutes ?? DEFAULT_COARSE_STEP_MINUTES);
  const toleranceMs = options.toleranceMs ?? DEFAULT_TOLERANCE_MS;
  if (!Number.isFinite(toleranceMs) || toleranceMs <= 0) {
    throw new RangeError("La tolerancia del refinamiento debe ser positiva");
  }

  const prepared = prepareStation(station);
  return bracketSignChanges(prepared, fromUtcMs, toUtcMs, stepMs).map((bracket) => {
    const timeUtcMs = refineBracket(prepared, bracket, toleranceMs);
    return { timeUtcMs, height_m: heightAt(prepared, timeUtcMs), kind: bracket.kind };
  });
}
