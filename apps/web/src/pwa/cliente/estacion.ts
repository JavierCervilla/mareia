/**
 * Bajar las constantes armónicas de un puerto (`/offline/estaciones/<slug>.json`) y **medir lo que
 * ocupan**.
 *
 * Lo usan los dos lados de la PWA: la sección que guarda el favorito (necesita el peso para poder
 * decirlo) y la calculadora de otro día (necesita el dato cuando el puerto no está guardado). Vive
 * aquí y no duplicado en los dos para que la validación del payload sea una sola.
 *
 * Con el service worker puesto, esta petición la puede contestar la copia guardada: la ruta está
 * bajo `/offline/`, que va `cache-first` (ver `pwa/sw.ts`).
 */

import { esEstacionOffline } from "../estacion-offline.ts";
import type { EstacionOffline } from "../estacion-offline.ts";
import { rutaEstacionOffline } from "../protocolo.ts";

/** El payload y **sus bytes medidos**, no estimados. */
export interface EstacionBajada {
  readonly payload: EstacionOffline;
  readonly bytes: number;
}

/**
 * Baja y valida las constantes de un puerto. `undefined` si no se pudo o si lo que llegó no tiene
 * la forma que esta página sabe leer — calcular una marea con un objeto a medias daría horas, y
 * horas plausibles, que es la peor forma de fallar.
 */
export async function bajarEstacion(slug: string): Promise<EstacionBajada | undefined> {
  try {
    const respuesta = await fetch(rutaEstacionOffline(slug), {
      headers: { accept: "application/json" },
    });
    if (!respuesta.ok) {
      return undefined;
    }
    // Se mide sobre el texto que llegó y no sobre el objeto: lo que ocupa es lo que se ha bajado.
    // `Blob` cuenta los bytes ya codificados en UTF-8, que es lo que guarda el navegador.
    const crudo = await respuesta.text();
    const bytes = new Blob([crudo]).size;
    const payload: unknown = JSON.parse(crudo);
    return esEstacionOffline(payload) ? { payload, bytes } : undefined;
  } catch (fallo: unknown) {
    console.warn("[mareia] no se han podido bajar las constantes del puerto", fallo);
    return undefined;
  }
}

/** Igual que `bajarEstacion` cuando solo interesa el dato y no lo que ocupa. */
export async function estacionDeLaRed(slug: string): Promise<EstacionOffline | undefined> {
  return (await bajarEstacion(slug))?.payload;
}
