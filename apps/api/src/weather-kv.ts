/**
 * La caché del módulo meteo sobre **Deno KV**.
 *
 * Vive en `apps/api` y no en `packages/adapters` ni dentro del módulo, y es a propósito: este
 * fichero es el único de todo el repositorio que menciona `Deno.*`. `packages/*` lo compila el
 * `tsc` de la raíz con las librerías de Node y lo prueba `node --test`, así que un `Deno.openKv()`
 * ahí rompería `pnpm typecheck` o obligaría a arrastrar los tipos de Deno a un package que no los
 * necesita. El módulo declara **qué** necesita (el puerto `WeatherCache`); el composition root
 * decide **con qué** se cumple, igual que `core-deps.ts` decide que los puertos son ficheros JSON.
 *
 * Si KV no está disponible (falta `--unstable-kv`, disco de solo lectura…), se degrada a la caché
 * en memoria del propio módulo: perder la caché entre reinicios es aceptable; dejar de servir —o
 * peor, machacar a Open-Meteo en cada petición— no lo es.
 */

import type { CacheEntry, WeatherCache } from "@mareia/module-weather";
import { createMemoryWeatherCache } from "@mareia/module-weather";

/** Prefijo de todas las claves del módulo dentro del KV compartido del proceso. */
const KV_PREFIX = "weather";

/**
 * Abre el KV una sola vez y recuerda el resultado (incluido el fallo). Es perezoso a propósito: el
 * registry de módulos se construye al importar `modules.config.ts` y ahí no puede haber IO.
 */
function openOnce(path: string | undefined): () => Promise<Deno.Kv | undefined> {
  let pending: Promise<Deno.Kv | undefined> | undefined;
  return () => {
    pending ??= (path === undefined ? Deno.openKv() : Deno.openKv(path)).catch((cause: unknown) => {
      console.error("weather: Deno KV no disponible, se cachea en memoria: %o", cause);
      return undefined;
    });
    return pending;
  };
}

/**
 * Caché del módulo meteo respaldada por Deno KV.
 *
 * @param path Ruta del almacén; por defecto, el KV por defecto del proceso.
 */
export function createDenoKvWeatherCache(path?: string): WeatherCache {
  const kv = openOnce(path);
  const fallback = createMemoryWeatherCache();

  return {
    async read<T>(key: string): Promise<CacheEntry<T> | undefined> {
      const store = await kv();
      if (store === undefined) {
        return fallback.read<T>(key);
      }
      try {
        // Una lectura fallida es un fallo de caché, no un fallo de la petición: quien llama
        // reacciona saliendo a la fuente, que es exactamente lo que haría con una entrada ausente.
        return (await store.get<CacheEntry<T>>([KV_PREFIX, key])).value ?? undefined;
      } catch (cause) {
        console.error("weather: lectura de KV fallida (%s): %o", key, cause);
        return undefined;
      }
    },

    async write<T>(key: string, entry: CacheEntry<T>, expiresInSeconds: number): Promise<void> {
      const store = await kv();
      if (store === undefined) {
        return fallback.write(key, entry, expiresInSeconds);
      }
      try {
        await store.set([KV_PREFIX, key], entry, { expireIn: expiresInSeconds * 1000 });
      } catch (cause) {
        // Un valor demasiado grande (KV topa en 64 KiB) o un disco lleno no pueden tumbar una
        // respuesta que ya está servida: se pierde la caché de ese valor y se deja rastro.
        console.error("weather: escritura en KV fallida (%s): %o", key, cause);
      }
    },
  };
}
