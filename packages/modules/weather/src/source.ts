/**
 * La política de «qué contesto» de toda fuente externa del módulo, en un solo sitio.
 *
 * Las tres fuentes (marine, forecast, boletín) se diferencian en la URL y en el TTL; en lo demás
 * hacen exactamente lo mismo: mirar la caché, salir a la red si hace falta y **no romperse** si el
 * upstream falla. Escribir eso tres veces sería tres sitios donde arreglar el mismo bug.
 *
 * La degradación tiene tres escalones, en este orden:
 *   1. entrada fresca en caché (edad ≤ TTL) → `ok`, `stale: false`, **cero peticiones de red**;
 *   2. la red responde → `ok` recién traído;
 *   3. la red falla pero queda una entrada vieja dentro de la ventana dura → `ok` con `stale: true`.
 * Solo cuando no hay ni red ni nada guardado se contesta `unavailable` con el motivo. Un dato de
 * hace tres horas sigue siendo útil para decidir si sales a navegar; un 500, no.
 */

import type { CacheEntry, WeatherCache } from "./cache.ts";
import { isoUtc } from "./cell.ts";
import { reasonFrom } from "./errors.ts";

/**
 * Lo que el módulo publica de una fuente. Es una **unión discriminada** por `status`: quien la
 * consume no puede leer `data` sin haber comprobado antes que la fuente respondió, y el JSON no
 * lleva campos a `null` que haya que interpretar.
 */
export type SourceReport<T> =
  | {
      readonly status: "ok";
      /** Instante en que la fuente respondió, ISO UTC. */
      readonly fetchedAt: string;
      /** Antigüedad de ese instante, en segundos, en el momento de contestar. */
      readonly ageSeconds: number;
      /** `true` si se sirve dato caducado porque la fuente no respondió (escalón 3). */
      readonly stale: boolean;
      readonly data: T;
    }
  | {
      readonly status: "unavailable";
      /** Motivo legible, sin credenciales ni URLs internas. */
      readonly reason: string;
    };

/** Todo lo que `resolveSource` necesita para resolver una fuente. */
export interface SourceRequest<T> {
  readonly cache: WeatherCache;
  /** Clave de caché ya construida (celda+hora para Open-Meteo, zona para AEMET). */
  readonly key: string;
  /** Segundos durante los cuales la entrada se considera **fresca**. */
  readonly ttlSeconds: number;
  /**
   * Segundos que la entrada sobrevive en la caché. Debe ser mayor que `ttlSeconds`: la diferencia
   * es la ventana en la que un dato caducado todavía sirve para degradar (`stale: true`).
   */
  readonly retainSeconds: number;
  readonly now: () => number;
  /** Trae el dato de la fuente. Lanza `WeatherSourceError` si no puede. */
  load: () => Promise<T>;
}

function report<T>(entry: CacheEntry<T>, nowMs: number, stale: boolean): SourceReport<T> {
  return {
    status: "ok",
    fetchedAt: isoUtc(entry.fetchedAtMs),
    ageSeconds: Math.max(0, Math.round((nowMs - entry.fetchedAtMs) / 1000)),
    stale,
    data: entry.value,
  };
}

/** Resuelve una fuente aplicando los tres escalones de degradación descritos arriba. */
export async function resolveSource<T>(request: SourceRequest<T>): Promise<SourceReport<T>> {
  const { cache, key, ttlSeconds, retainSeconds, now, load } = request;
  const cached = await cache.read<T>(key);
  const beforeMs = now();
  if (cached !== undefined && beforeMs - cached.fetchedAtMs <= ttlSeconds * 1000) {
    return report(cached, beforeMs, false);
  }

  try {
    const value = await load();
    const entry: CacheEntry<T> = { value, fetchedAtMs: now() };
    await cache.write(key, entry, retainSeconds);
    return report(entry, now(), false);
  } catch (cause) {
    if (cached !== undefined) {
      return report(cached, now(), true);
    }
    return { status: "unavailable", reason: reasonFrom(cause) };
  }
}
