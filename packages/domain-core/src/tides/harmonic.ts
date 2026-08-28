/**
 * Suma armónica con correcciones nodales.
 *
 *   h(t) = Z₀ + Σᵢ fᵢ(t) · Aᵢ · cos( Vᵢ(t) + uᵢ(t) − κᵢ )
 *
 * donde Aᵢ y κᵢ son la amplitud y el retardo de fase de Greenwich de la estación, Vᵢ el argumento
 * de equilibrio y (fᵢ, uᵢ) las correcciones nodales de Schureman. Cada término se evalúa en el
 * instante pedido —no en el epoch del año— igual que hace NOAA CO-OPS en sus predicciones.
 *
 * Módulo puro: sin IO, sin reloj y sin dependencias de runtime.
 */

import type { AstronomicalArguments } from "./astronomy.ts";
import { computeAstronomicalArguments, DEG_TO_RAD } from "./astronomy.ts";
import type { ConstituentDefinition } from "./constituents.ts";
import { equilibriumArgument, findConstituent } from "./constituents.ts";
import { computeNodalCorrection } from "./nodal.ts";
import type { EpochMs, TideSample, TideStation } from "./types.ts";
import { UnsupportedConstituentError } from "./types.ts";

const MS_PER_MINUTE = 60_000;

/**
 * Estación con sus constituyentes ya resueltos contra la tabla. Resolver una vez y reutilizar
 * evita repetir la búsqueda por nombre en cada uno de los miles de puntos de una curva.
 */
export interface PreparedStation {
  readonly datumOffset_m: number;
  readonly terms: readonly PreparedConstituent[];
}

interface PreparedConstituent {
  readonly definition: ConstituentDefinition;
  readonly amplitude_m: number;
  readonly phaseDeg: number;
}

/**
 * Resuelve los constituyentes de la estación contra la tabla soportada.
 * @throws {UnsupportedConstituentError} si algún constituyente no está en la tabla.
 */
export function prepareStation(station: TideStation): PreparedStation {
  const terms: PreparedConstituent[] = [];
  const unsupported: string[] = [];
  for (const constituent of station.constituents) {
    const definition = findConstituent(constituent.name);
    if (definition === undefined) {
      unsupported.push(constituent.name);
      continue;
    }
    terms.push({
      definition,
      amplitude_m: constituent.amplitude_m,
      phaseDeg: constituent.phase_deg,
    });
  }
  if (unsupported.length > 0) {
    throw new UnsupportedConstituentError(unsupported);
  }
  return { datumOffset_m: station.datum.msl_offset_m, terms };
}

/** Término corregido: amplitud f·A en metros y ángulo V + u − κ en radianes. */
interface EvaluatedTerm {
  readonly amplitude_m: number;
  readonly angleRad: number;
}

function evaluateTerm(term: PreparedConstituent, args: AstronomicalArguments): EvaluatedTerm {
  const { f, u } = computeNodalCorrection(term.definition.nodal, args);
  return {
    amplitude_m: f * term.amplitude_m,
    angleRad: (equilibriumArgument(term.definition, args) + u - term.phaseDeg) * DEG_TO_RAD,
  };
}

/** Altura en metros sobre el cero de la estación, con la estación ya resuelta. */
export function heightAt(prepared: PreparedStation, atUtcMs: EpochMs): number {
  const args = computeAstronomicalArguments(atUtcMs);
  let height = prepared.datumOffset_m;
  for (const term of prepared.terms) {
    const { amplitude_m, angleRad } = evaluateTerm(term, args);
    height += amplitude_m * Math.cos(angleRad);
  }
  return height;
}

/**
 * Derivada de la altura respecto al tiempo, en metros por hora.
 *
 * Se desprecia la variación de f, u y de las velocidades instantáneas frente a la del argumento:
 * varían en escalas de meses a años, mientras que el término dominante gira 29°/h. Basta y sobra
 * para localizar el cero de la derivada con el que se refinan pleamares y bajamares.
 */
export function heightRateAt(prepared: PreparedStation, atUtcMs: EpochMs): number {
  const args = computeAstronomicalArguments(atUtcMs);
  let rate = 0;
  for (const term of prepared.terms) {
    const { amplitude_m, angleRad } = evaluateTerm(term, args);
    rate -= amplitude_m * term.definition.speedDegPerHour * DEG_TO_RAD * Math.sin(angleRad);
  }
  return rate;
}

/**
 * Altura predicha en metros sobre el cero de la estación en el instante dado (UTC, ms).
 * @throws {UnsupportedConstituentError} si algún constituyente no está en la tabla.
 */
export function predictHeight(station: TideStation, atUtcMs: EpochMs): number {
  return heightAt(prepareStation(station), atUtcMs);
}

/** @throws {RangeError} si el rango no es un intervalo finito y bien orientado. */
export function assertValidRange(fromUtcMs: EpochMs, toUtcMs: EpochMs): void {
  if (!Number.isFinite(fromUtcMs) || !Number.isFinite(toUtcMs)) {
    throw new RangeError("El rango temporal debe estar formado por instantes finitos");
  }
  if (toUtcMs < fromUtcMs) {
    throw new RangeError("El final del rango no puede ser anterior al inicio");
  }
}

/** Valida el paso de muestreo y lo devuelve en milisegundos. */
export function stepToMilliseconds(stepMinutes: number): number {
  if (!Number.isFinite(stepMinutes) || stepMinutes <= 0) {
    throw new RangeError("El paso de muestreo debe ser un número de minutos positivo");
  }
  return stepMinutes * MS_PER_MINUTE;
}

/**
 * Curva muestreada en `[fromUtcMs, toUtcMs]` con paso constante. El último punto es exactamente
 * `toUtcMs` aunque el rango no sea múltiplo del paso, para que el gráfico no quede corto.
 */
export function sampleCurve(
  station: TideStation,
  fromUtcMs: EpochMs,
  toUtcMs: EpochMs,
  stepMinutes: number,
): readonly TideSample[] {
  assertValidRange(fromUtcMs, toUtcMs);
  const stepMs = stepToMilliseconds(stepMinutes);
  const prepared = prepareStation(station);
  const samples: TideSample[] = [];
  const steps = Math.ceil((toUtcMs - fromUtcMs) / stepMs);
  for (let index = 0; index < steps; index += 1) {
    const time = fromUtcMs + index * stepMs;
    samples.push({ timeUtcMs: time, height_m: heightAt(prepared, time) });
  }
  samples.push({ timeUtcMs: toUtcMs, height_m: heightAt(prepared, toUtcMs) });
  return samples;
}
