/**
 * El trozo de HTTP que comparten los adaptadores: pedir un JSON y no fiarse de lo que llega.
 *
 * `fetch` **siempre entra inyectado** (`typeof fetch`), nunca se coge el global. Es lo que permite
 * que los tests del módulo no tengan red: le pasan una función que devuelve el fixture y punto. En
 * producción quien inyecta el `fetch` real es el composition root de la API.
 */

import { WeatherSourceError } from "./errors.ts";

/** Segundos que se espera a un upstream antes de darlo por perdido y degradar. */
export const DEFAULT_TIMEOUT_MS = 8_000;

export interface JsonRequest {
  readonly fetch: typeof fetch;
  readonly url: string;
  /** Nombre de la fuente para los mensajes de error, p. ej. `"Open-Meteo marine"`. */
  readonly label: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
}

/**
 * GET de un JSON con timeout. Cualquier desenlace que no sea «200 con un objeto JSON» sale como
 * `WeatherSourceError`, que es el único fallo que el módulo sabe degradar.
 *
 * El cuerpo de un error HTTP **no** se propaga: un upstream puede devolver un HTML enorme y ese
 * texto acabaría en la respuesta al cliente. Se publica el código de estado, que es lo accionable.
 */
export async function fetchJson(request: JsonRequest): Promise<unknown> {
  const { fetch: doFetch, url, label, headers, timeoutMs = DEFAULT_TIMEOUT_MS } = request;

  let response: Response;
  try {
    response = await doFetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json", ...headers },
    });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new WeatherSourceError(`${label} no respondió: ${detail}`);
  }

  if (!response.ok) {
    throw new WeatherSourceError(`${label} respondió HTTP ${response.status}`);
  }

  try {
    return await response.json();
  } catch {
    throw new WeatherSourceError(`${label} devolvió un cuerpo que no es JSON`);
  }
}

/** Estrecha un `unknown` a objeto, o falla diciendo qué fuente mintió sobre su forma. */
export function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new WeatherSourceError(`${label} devolvió una forma inesperada`);
  }
  return value as Record<string, unknown>;
}

/**
 * Número de un campo, o `null` si la fuente no lo trae.
 *
 * El `null` es **significativo** y viaja hasta la respuesta: Open-Meteo devuelve `null` donde el
 * modelo no cubre (temperatura del agua en una celda de tierra, por ejemplo). Inventar un 0 ahí
 * sería publicar un dato falso.
 */
export function numberOrNull(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Cadena obligatoria de un campo; si no está, la respuesta no es utilizable. */
export function requiredString(
  record: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value === "") {
    throw new WeatherSourceError(`${label} no trae el campo '${key}'`);
  }
  return value;
}
