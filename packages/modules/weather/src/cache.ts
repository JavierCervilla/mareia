/**
 * El **puerto** de caché del módulo y su implementación en memoria.
 *
 * El módulo no sabe dónde se guarda lo que cachea: pide `WeatherCache` y el composition root de la
 * API le enchufa Deno KV (`apps/api/src/weather-kv.ts`). Los tests le enchufan la de memoria de
 * aquí abajo y así no hay ni red ni disco en CI.
 *
 * La caché es **almacenamiento tonto**: guarda lo que le den y lo olvida cuando expira. Quién es
 * fresco y quién está rancio lo decide `resolveSource`, comparando la edad de la entrada con el TTL
 * de su fuente. Por eso `write` recibe una expiración (la ventana dura, generosa) y no un TTL de
 * frescura: fuera de esa ventana la entrada ya no sirve ni para degradar.
 */

/** Un valor cacheado con el instante en que se trajo de la fuente. */
export interface CacheEntry<T> {
  readonly value: T;
  /** Epoch en ms del momento en que la fuente respondió (no el de la escritura en caché). */
  readonly fetchedAtMs: number;
}

/**
 * Almacén clave→valor con expiración.
 *
 * `read<T>` **confía** en que lo guardado bajo esa clave tiene la forma `T`: quien escribe y quien
 * lee es este mismo módulo. El riesgo real de esa confianza es un despliegue que cambie la forma de
 * un valor y se encuentre entradas viejas del despliegue anterior; se cubre versionando el prefijo
 * de las claves (`CACHE_SCHEMA` en `cell.ts`), no con una validación en cada lectura.
 */
export interface WeatherCache {
  read<T>(key: string): Promise<CacheEntry<T> | undefined>;
  write<T>(key: string, entry: CacheEntry<T>, expiresInSeconds: number): Promise<void>;
}

/**
 * Caché en memoria del proceso. Es la que usan los tests, y también el plan B de la API si Deno KV
 * no está disponible: perder la caché entre reinicios es aceptable; dejar de servir, no.
 *
 * El reloj entra inyectado para que un test pueda hacer envejecer una entrada sin esperar.
 */
export function createMemoryWeatherCache(now: () => number = Date.now): WeatherCache {
  const entries = new Map<string, { readonly entry: CacheEntry<unknown>; readonly expiresAtMs: number }>();

  return {
    read<T>(key: string): Promise<CacheEntry<T> | undefined> {
      const stored = entries.get(key);
      if (stored === undefined) {
        return Promise.resolve(undefined);
      }
      if (stored.expiresAtMs <= now()) {
        entries.delete(key);
        return Promise.resolve(undefined);
      }
      return Promise.resolve(stored.entry as CacheEntry<T>);
    },

    write<T>(key: string, entry: CacheEntry<T>, expiresInSeconds: number): Promise<void> {
      entries.set(key, { entry, expiresAtMs: now() + expiresInSeconds * 1000 });
      return Promise.resolve();
    },
  };
}
