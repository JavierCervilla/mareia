/**
 * La **celda**: la unidad de caché de este módulo.
 *
 * Open-Meteo sirve modelos con una malla de varios kilómetros, así que pedir el tiempo de dos
 * fondeaderos vecinos es pedir dos veces el mismo dato. Redondear a 0,1° (~11 km en latitud) los
 * colapsa en una sola clave y, con la hora UTC truncada, deja la caché alineada con la cadencia
 * real de los modelos: dentro de la misma hora la respuesta upstream no cambia.
 *
 * Consecuencia buscada: dos peticiones seguidas del mismo puerto salen a la red **una sola vez**.
 * La malla es fija, no un radio: dos puntos separados por un borde de celda no colapsan aunque
 * estén a cuatro kilómetros (Vigo y Cangas, por ejemplo). Se acepta a cambio de que la clave sea
 * calculable sin estado y sin vecindarios.
 */

/** Lado de la celda en grados. Un cambio aquí cambia todas las claves: sube `CACHE_SCHEMA`. */
export const CELL_DEGREES = 0.1;

/**
 * Versión del esquema de las claves de caché. Va delante de toda clave para que un despliegue que
 * cambie la forma de los valores cacheados no lea entradas del anterior.
 */
export const CACHE_SCHEMA = "w1";

const MS_PER_HOUR = 3_600_000;

/** Celda espacio-temporal a la que se le pide el dato. */
export interface Cell {
  /** Latitud del centro de la celda, redondeada a `CELL_DEGREES`. */
  readonly lat: number;
  /** Longitud del centro de la celda, redondeada a `CELL_DEGREES`. */
  readonly lon: number;
  /** Hora UTC truncada, en ISO (`2026-08-28T13:00:00Z`). */
  readonly hourUtc: string;
}

/**
 * Instante ISO en UTC sin milisegundos. Los milisegundos en un `fetchedAt` son ruido: la resolución
 * real de estos datos son minutos.
 */
export function isoUtc(epochMs: number): string {
  return new Date(epochMs).toISOString().replace(/\.\d{3}Z$/u, "Z");
}

/** Coordenada redondeada a la malla de la caché. El `+ 0` mata el `-0` que ensuciaría la clave. */
function toGrid(value: number): number {
  return Math.round(value / CELL_DEGREES) * CELL_DEGREES + 0;
}

/** Celda de un punto en un instante: redondeo espacial y truncado a la hora en curso. */
export function toCell(lat: number, lon: number, nowMs: number): Cell {
  return {
    lat: Number(toGrid(lat).toFixed(1)),
    lon: Number(toGrid(lon).toFixed(1)),
    hourUtc: isoUtc(Math.floor(nowMs / MS_PER_HOUR) * MS_PER_HOUR),
  };
}

/**
 * Clave de caché de una fuente en una celda. `source` distingue marine de forecast: comparten
 * celda y hora pero no TTL ni contenido.
 */
export function cellKey(source: string, cell: Cell): string {
  return `${CACHE_SCHEMA}:${source}:${cell.lat.toFixed(1)}:${cell.lon.toFixed(1)}:${cell.hourUtc}`;
}
