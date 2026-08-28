/**
 * Composition root del **módulo meteo**: de dónde salen sus dependencias.
 *
 * El módulo es hermético (no lee entorno, no abre ficheros, no conoce Deno); aquí se le da todo
 * hecho. Es también el único sitio que toca `AEMET_API_KEY`: la clave **solo** viaja desde el
 * entorno al adaptador, que la manda en una cabecera. No se registra, no se imprime y no aparece en
 * ninguna URL.
 *
 * El catálogo de puertos se construye aparte del de `core-deps.ts` a propósito: el módulo necesita
 * únicamente lat/lon, y así el registry se puede armar sin arrastrar el repositorio de estaciones.
 * El coste es releer un JSON de 12 puertos, que el propio repositorio cachea en memoria.
 */

import { createPortsJsonRepository } from "@mareia/adapters";
import type { WeatherModuleDeps } from "@mareia/module-weather";

import { DATA_DIR } from "./core-deps.ts";
import { createDenoKvWeatherCache } from "./weather-kv.ts";

/** Dependencias de producción del módulo meteo. */
export function createWeatherDeps(dataDir: string = DATA_DIR): WeatherModuleDeps {
  return {
    fetch: globalThis.fetch,
    cache: createDenoKvWeatherCache(),
    now: () => Date.now(),
    ports: createPortsJsonRepository({ filePath: `${dataDir}/geo/ports.json` }),
    aemetApiKey: Deno.env.get("AEMET_API_KEY"),
  };
}
