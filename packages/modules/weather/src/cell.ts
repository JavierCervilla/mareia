/**
 * La **celda**: la unidad de caché de este módulo.
 *
 * Open-Meteo sirve modelos con una malla de varios kilómetros, así que pedir el tiempo de dos
 * fondeaderos vecinos es pedir dos veces el mismo dato. Redondear a 0,1° (~11 km en latitud) los
 * colapsa en una sola clave.
 *
 * Consecuencia buscada: dos peticiones seguidas del mismo puerto salen a la red **una sola vez**.
 * La malla es fija, no un radio: dos puntos separados por un borde de celda no colapsan aunque
 * estén a cuatro kilómetros (Vigo y Cangas, por ejemplo). Se acepta a cambio de que la clave sea
 * calculable sin estado y sin vecindarios.
 *
 * La celda es **solo espacial** y la clave, por tanto, **no lleva instante**. Meter la hora en la
 * clave parece alinearla con la cadencia de los modelos, pero lo que hace es rotarla en la hora en
 * punto: una entrada solo sería legible durante su propia hora, su edad máxima observable serían
 * 3599 s y el escalón 3 de la degradación (servir dato caducado cuando la fuente no responde) no
 * llegaría a ejecutarse nunca para un TTL de una hora o más. Quién es fresco, quién está rancio y
 * quién ya no sirve lo decide `resolveSource` comparando la edad de `fetchedAt` con el TTL y con la
 * ventana de retención; la clave solo tiene que decir **de qué** se habla, no **cuándo**.
 */

/** Lado de la celda en grados. Un cambio aquí cambia todas las claves: sube `CACHE_SCHEMA`. */
export const CELL_DEGREES = 0.1;

/**
 * Versión del esquema de las claves de caché. Va delante de toda clave para que un despliegue que
 * cambie la forma de los valores cacheados no lea entradas del anterior.
 */
export const CACHE_SCHEMA = "w1";

/** Celda de la malla a la que se le pide el dato. */
export interface Cell {
  /** Latitud del centro de la celda, redondeada a `CELL_DEGREES`. */
  readonly lat: number;
  /** Longitud del centro de la celda, redondeada a `CELL_DEGREES`. */
  readonly lon: number;
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

/** Celda de un punto: redondeo de sus coordenadas a la malla. */
export function toCell(lat: number, lon: number): Cell {
  return {
    lat: Number(toGrid(lat).toFixed(1)),
    lon: Number(toGrid(lon).toFixed(1)),
  };
}

/**
 * Clave de caché de una fuente en una celda. `source` distingue marine de forecast: comparten
 * celda pero no TTL ni contenido. No lleva instante a propósito (ver la cabecera del fichero): una
 * clave estable es lo que permite encontrar el dato viejo el día que la fuente no responde.
 */
export function cellKey(source: string, cell: Cell): string {
  return `${CACHE_SCHEMA}:${source}:${cell.lat.toFixed(1)}:${cell.lon.toFixed(1)}`;
}
