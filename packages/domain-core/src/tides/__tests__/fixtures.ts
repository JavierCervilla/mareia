/**
 * Adaptación del oráculo externo (NOAA CO-OPS) al dominio.
 *
 * Los ficheros de `fixtures/noaa/` son respuestas verbatim de la API; aquí —y solo aquí— se
 * convierten pies a metros y se parsean los instantes como UTC explícito. Ver
 * `fixtures/noaa/README.md` para la procedencia y las trampas de unidades, datum y husos.
 *
 * Este módulo es solo de test: lee ficheros, cosa que el motor nunca hace.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { StationConstituent, TideExtreme, TideStation } from "../types.ts";

/** Pie internacional exacto. */
const METERS_PER_FOOT = 0.3048;

const FIXTURES_DIR = join(import.meta.dirname, "fixtures", "noaa");

interface NoaaHarmonicConstituent {
  readonly name: string;
  readonly amplitude: number;
  readonly phase_GMT: number;
}

interface NoaaHarmonicConstants {
  readonly units: string;
  readonly HarmonicConstituents: readonly NoaaHarmonicConstituent[];
}

interface NoaaPrediction {
  readonly t: string;
  readonly v: string;
  readonly type?: string;
}

interface NoaaPredictions {
  readonly predictions: readonly NoaaPrediction[];
}

function readJson<T>(...segments: readonly string[]): T {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, ...segments), "utf8")) as T;
}

/**
 * Parsea el instante de NOAA (`"YYYY-MM-DD HH:mm"`, pedido con `time_zone=gmt`) como UTC.
 * El sufijo `Z` es obligatorio: sin él, `Date` aplicaría el huso de la máquina.
 */
export function parseNoaaUtc(timestamp: string): number {
  return Date.parse(`${timestamp.replace(" ", "T")}:00Z`);
}

/**
 * Estación en el schema `station/v1` construida desde las constantes armónicas publicadas.
 *
 * Se toma `phase_GMT` (retardo de Greenwich) y se convierte la amplitud de pies a metros. El
 * offset de datum es 0 porque las predicciones del oráculo se piden referidas al mismo MSL.
 */
export function loadNoaaStation(stationId: string, name: string): TideStation {
  const harcon = readJson<NoaaHarmonicConstants>(stationId, "harcon.json");
  if (harcon.units !== "feet") {
    throw new Error(`Unidades inesperadas en harcon.json de ${stationId}: ${harcon.units}`);
  }
  const constituents: StationConstituent[] = harcon.HarmonicConstituents.map((entry) => ({
    name: entry.name,
    amplitude_m: entry.amplitude * METERS_PER_FOOT,
    phase_deg: entry.phase_GMT,
  }));
  return {
    schema: "station/v1",
    id: stationId,
    name,
    datum: { msl_offset_m: 0 },
    constituents,
  };
}

const PREDICTION_RANGE = "20260315-20260317";

/** Serie oficial de 6 minutos (metros sobre MSL, instantes UTC). */
export function loadNoaaCurve(stationId: string): readonly { timeUtcMs: number; height_m: number }[] {
  const file = `predictions-6min-${PREDICTION_RANGE}.json`;
  return readJson<NoaaPredictions>(stationId, file).predictions.map((prediction) => ({
    timeUtcMs: parseNoaaUtc(prediction.t),
    height_m: Number(prediction.v),
  }));
}

/** Pleamares y bajamares oficiales (metros sobre MSL, instantes UTC redondeados al minuto). */
export function loadNoaaExtremes(stationId: string): readonly TideExtreme[] {
  const file = `predictions-hilo-${PREDICTION_RANGE}.json`;
  return readJson<NoaaPredictions>(stationId, file).predictions.map((prediction) => ({
    timeUtcMs: parseNoaaUtc(prediction.t),
    height_m: Number(prediction.v),
    kind: prediction.type === "H" ? "high" : "low",
  }));
}

/** Estaciones del oráculo, con el régimen de marea que aporta cada una. */
export const NOAA_STATIONS: readonly { readonly id: string; readonly name: string }[] = [
  { id: "9414290", name: "San Francisco, CA" },
  { id: "8443970", name: "Boston, MA" },
];
