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

/**
 * Dónde vive el almacén de Deno KV que respalda la caché del boletín.
 *
 * Sin ruta, `Deno.openKv()` usa el almacén por defecto del proceso, que en un contenedor cae
 * dentro de la capa efímera: **cada despliegue tira la caché**, y el primer arranque vuelve a
 * pegarle a AEMET y a Open-Meteo por todos los puertos. Con la ruta puesta en un volumen, la caché
 * sobrevive al redespliegue.
 *
 * El **defecto sigue siendo sin ruta**, y es a propósito: en desarrollo y en los tests el almacén
 * por defecto es lo que se quiere (no ensucia el repo, no pide permisos de escritura y se puede
 * tirar). Quien necesita persistencia —el contenedor— lo dice con la variable, que es donde se
 * sabe qué volumen hay montado. Ojo: con ruta explícita, `Deno.openKv()` **sí exige
 * `--allow-read` y `--allow-write` sobre ella** (medido), y por eso el `CMD` de la imagen los
 * concede sobre ese directorio y solo sobre ese.
 */
const KV_PATH_ENV = "MAREIA_KV_PATH";

/** La ruta del KV, o `undefined` si no se declaró (una variable vacía no es una ruta). */
function kvPath(): string | undefined {
  const bruto = Deno.env.get(KV_PATH_ENV);
  return bruto === undefined || bruto === "" ? undefined : bruto;
}

/** Dependencias de producción del módulo meteo. */
export function createWeatherDeps(dataDir: string = DATA_DIR): WeatherModuleDeps {
  return {
    fetch: globalThis.fetch,
    cache: createDenoKvWeatherCache(kvPath()),
    now: () => Date.now(),
    ports: createPortsJsonRepository({ filePath: `${dataDir}/geo/ports.json` }),
    aemetApiKey: Deno.env.get("AEMET_API_KEY"),
  };
}
