/**
 * Adaptador de **Open-Meteo**: estado del mar (Marine API) y estado de la atmósfera (Forecast API).
 *
 * Sin API key: el tier no comercial de Open-Meteo es de uso libre citando la fuente, y la
 * atribución (CC-BY 4.0) viaja en el manifiesto del módulo y en cada respuesta. A cambio, hay un
 * límite de peticiones que conviene no rozar: por eso se pide **por celda** (`toCell`) y no por
 * puerto, y por eso la caché es lo primero que mira el módulo.
 *
 * Se pide con `timezone=UTC` a propósito: todo lo que sale de este módulo son instantes UTC y así
 * no hay que traducir husos ni preguntarle a la respuesta en qué hora está.
 */

import type { Cell } from "./cell.ts";
import { asRecord, fetchJson, numberOrNull, requiredString } from "./http-json.ts";
import { WeatherSourceError } from "./errors.ts";

/** Endpoints por defecto. Inyectables para poder apuntar a un doble en un test o a un espejo. */
export const OPEN_METEO_MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";
export const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/** Atribución exigida por los términos de Open-Meteo. */
export const OPEN_METEO_ATTRIBUTION = {
  name: "Open-Meteo",
  url: "https://open-meteo.com/",
  license: "CC-BY-4.0",
} as const;

const MARINE_VARIABLES = [
  "wave_height",
  "wave_direction",
  "wave_period",
  "wind_wave_height",
  "wind_wave_direction",
  "wind_wave_period",
  "swell_wave_height",
  "swell_wave_direction",
  "swell_wave_period",
  "sea_surface_temperature",
] as const;

const FORECAST_VARIABLES = [
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "pressure_msl",
  "visibility",
  "uv_index",
] as const;

/** Estado del mar en la celda. Los `null` son huecos reales del modelo, no ceros. */
export interface MarineConditions {
  /** Instante al que se refiere la observación del modelo, ISO UTC. */
  readonly observedAt: string;
  readonly waveHeightM: number | null;
  readonly waveDirectionDeg: number | null;
  readonly wavePeriodS: number | null;
  readonly windWaveHeightM: number | null;
  readonly windWaveDirectionDeg: number | null;
  readonly windWavePeriodS: number | null;
  readonly swellWaveHeightM: number | null;
  readonly swellWaveDirectionDeg: number | null;
  readonly swellWavePeriodS: number | null;
  readonly seaSurfaceTemperatureC: number | null;
}

/** Estado de la atmósfera en la celda. */
export interface ForecastConditions {
  readonly observedAt: string;
  readonly windSpeedKmh: number | null;
  readonly windDirectionDeg: number | null;
  readonly windGustsKmh: number | null;
  readonly pressureMslHpa: number | null;
  readonly visibilityM: number | null;
  readonly uvIndex: number | null;
}

/** Lo que los dos adaptadores necesitan del exterior. */
export interface OpenMeteoDeps {
  readonly fetch: typeof fetch;
  readonly marineUrl?: string;
  readonly forecastUrl?: string;
}

function currentUrl(baseUrl: string, cell: Cell, variables: readonly string[]): string {
  const url = new URL(baseUrl);
  url.searchParams.set("latitude", cell.lat.toFixed(1));
  url.searchParams.set("longitude", cell.lon.toFixed(1));
  url.searchParams.set("current", variables.join(","));
  url.searchParams.set("timezone", "UTC");
  return url.toString();
}

/**
 * Instante ISO en UTC a partir de lo que devuelve Open-Meteo (`2026-08-28T13:00`, sin zona porque
 * ya se pidió en UTC). Se normaliza aquí y no en el consumidor para que del módulo solo salgan
 * instantes con zona explícita.
 */
function observedAt(raw: string, label: string): string {
  const epochMs = Date.parse(/[Zz]|[+-]\d{2}:\d{2}$/u.test(raw) ? raw : `${raw}Z`);
  if (!Number.isFinite(epochMs)) {
    throw new WeatherSourceError(`${label} devolvió un instante ilegible`);
  }
  return new Date(epochMs).toISOString().replace(/\.\d{3}Z$/u, "Z");
}

/** Bloque `current` de una respuesta de Open-Meteo, ya validado como objeto. */
async function loadCurrent(
  deps: OpenMeteoDeps,
  url: string,
  label: string,
): Promise<Record<string, unknown>> {
  const payload = asRecord(await fetchJson({ fetch: deps.fetch, url, label }), label);
  return asRecord(payload["current"], `${label} (bloque 'current')`);
}

/** Estado del mar en la celda, o `WeatherSourceError` si Open-Meteo no lo sirve. */
export async function fetchMarine(deps: OpenMeteoDeps, cell: Cell): Promise<MarineConditions> {
  const label = "Open-Meteo marine";
  const url = currentUrl(deps.marineUrl ?? OPEN_METEO_MARINE_URL, cell, MARINE_VARIABLES);
  const current = await loadCurrent(deps, url, label);
  return {
    observedAt: observedAt(requiredString(current, "time", label), label),
    waveHeightM: numberOrNull(current, "wave_height"),
    waveDirectionDeg: numberOrNull(current, "wave_direction"),
    wavePeriodS: numberOrNull(current, "wave_period"),
    windWaveHeightM: numberOrNull(current, "wind_wave_height"),
    windWaveDirectionDeg: numberOrNull(current, "wind_wave_direction"),
    windWavePeriodS: numberOrNull(current, "wind_wave_period"),
    swellWaveHeightM: numberOrNull(current, "swell_wave_height"),
    swellWaveDirectionDeg: numberOrNull(current, "swell_wave_direction"),
    swellWavePeriodS: numberOrNull(current, "swell_wave_period"),
    seaSurfaceTemperatureC: numberOrNull(current, "sea_surface_temperature"),
  };
}

/** Estado de la atmósfera en la celda, o `WeatherSourceError` si Open-Meteo no lo sirve. */
export async function fetchForecast(deps: OpenMeteoDeps, cell: Cell): Promise<ForecastConditions> {
  const label = "Open-Meteo forecast";
  const url = currentUrl(deps.forecastUrl ?? OPEN_METEO_FORECAST_URL, cell, FORECAST_VARIABLES);
  const current = await loadCurrent(deps, url, label);
  return {
    observedAt: observedAt(requiredString(current, "time", label), label),
    windSpeedKmh: numberOrNull(current, "wind_speed_10m"),
    windDirectionDeg: numberOrNull(current, "wind_direction_10m"),
    windGustsKmh: numberOrNull(current, "wind_gusts_10m"),
    pressureMslHpa: numberOrNull(current, "pressure_msl"),
    visibilityM: numberOrNull(current, "visibility"),
    uvIndex: numberOrNull(current, "uv_index"),
  };
}
