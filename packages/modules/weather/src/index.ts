/**
 * Módulo **weather**: el estado del mar y del cielo en un puerto, servido por el contrato
 * `AppModule`. Es el primer módulo real del registry de Mareia.
 *
 * Qué NO hay aquí: red directa, variables de entorno, ficheros ni relojes. Todo entra inyectado
 * desde el composition root de la API, que es también el único sitio que sabe que la caché es Deno
 * KV y que la clave de AEMET vive en `AEMET_API_KEY`. Gracias a eso los tests del módulo corren sin
 * red y sin secretos.
 */

export const PACKAGE = "module-weather" as const;

export type { CacheEntry, WeatherCache } from "./cache.ts";
export { createMemoryWeatherCache } from "./cache.ts";

export type { Cell } from "./cell.ts";
export { CACHE_SCHEMA, CELL_DEGREES, cellKey, isoUtc, toCell } from "./cell.ts";

export { WeatherSourceError } from "./errors.ts";

export type { ForecastConditions, MarineConditions, OpenMeteoDeps } from "./open-meteo.ts";
export {
  OPEN_METEO_ATTRIBUTION,
  OPEN_METEO_FORECAST_URL,
  OPEN_METEO_MARINE_URL,
  fetchForecast,
  fetchMarine,
} from "./open-meteo.ts";

export type { SourceReport, SourceRequest } from "./source.ts";
export { resolveSource } from "./source.ts";
