/**
 * Cuánto tiempo se considera **fresco** el dato de cada fuente, y por qué esto no es un detalle
 * interno del servidor.
 *
 * Los tres valores salen de la cadencia real de las fuentes: los modelos de oleaje se actualizan
 * cada pocas horas, el de atmósfera con más frecuencia y un boletín costero se emite tres veces al
 * día. El módulo los usa para decidir si sirve la caché sin salir a la red (`resolveSource`).
 *
 * Viven en su propio fichero —y no dentro de `module.ts`, que importa Express— porque la **UI**
 * también los necesita: la sección meteo se pinta una vez y se queda abierta en el móvil de quien
 * la mira, así que es ella quien tiene que saber cuándo el dato que enseña ha dejado de ser el de
 * ahora. Sin este dato la página solo podía inventarse un umbral, y un umbral inventado en la capa
 * de presentación es exactamente lo que la regla 1 de `vista.ts` prohíbe: la antigüedad la manda el
 * backend, la vista la traduce.
 */

/** Estado del mar (Open-Meteo Marine): 1 h. */
export const MARINE_TTL_SECONDS = 3_600;

/** Atmósfera (Open-Meteo Forecast): 30 min. Es el más corto de los tres. */
export const FORECAST_TTL_SECONDS = 1_800;

/** Boletín costero de AEMET: 6 h. */
export const BULLETIN_TTL_SECONDS = 21_600;
