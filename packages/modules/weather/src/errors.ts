/**
 * El único error propio del módulo: «una fuente externa no me dio un dato usable».
 *
 * Lo lanzan los adaptadores (Open-Meteo, AEMET) y lo captura `resolveSource`, que lo traduce a un
 * `status: "unavailable"` con su `reason`. Por eso el mensaje viaja **al cliente**: no puede llevar
 * nunca una URL con credenciales ni el valor de `AEMET_API_KEY` (la clave viaja en una cabecera,
 * jamás en la query, precisamente para que no pueda acabar aquí ni en un log).
 */
export class WeatherSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeatherSourceError";
  }
}

/**
 * Motivo legible de un fallo, para el campo `reason` de la respuesta.
 *
 * Recorta a `MAX_REASON_LENGTH` porque un upstream puede devolver un HTML de error entero y eso no
 * es un motivo: es ruido que además engorda todas las respuestas degradadas.
 */
export function reasonFrom(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause);
  const flat = raw.replaceAll(/\s+/gu, " ").trim();
  return flat.length > MAX_REASON_LENGTH ? `${flat.slice(0, MAX_REASON_LENGTH)}…` : flat;
}

const MAX_REASON_LENGTH = 200;
