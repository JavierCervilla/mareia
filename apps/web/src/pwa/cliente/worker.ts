/**
 * El puente entre la página y el service worker: registrarlo y hablarle.
 *
 * Dos decisiones que no son de estilo:
 *
 * - **El registro no fuerza nada.** No hay `skipWaiting`, no hay `registration.update()` en bucle y
 *   no hay recarga automática cuando aparece una versión nueva. La política está razonada en
 *   `docs/adr/ADR-02`: el worker nuevo espera y toma el control en la siguiente navegación, que en
 *   un sitio multipágina es el siguiente enlace que se pulse.
 * - **Se habla por `MessageChannel`, no por `postMessage` a secas.** Cada petición lleva su canal de
 *   vuelta, así que la respuesta que llega es la de *esa* petición y no la de otra pestaña. Y hay
 *   plazo: si el worker no contesta, la página lo dice en vez de quedarse con el botón girando.
 */

import type { PeticionAlWorker, RespuestaDelWorker } from "../protocolo.ts";
import { RUTA_SW } from "../protocolo.ts";

/** Cuánto se espera a que el worker conteste antes de darlo por perdido. */
const ESPERA_MS = 15_000;

/** Si este navegador puede tener service worker. */
export function haySoporteDeWorker(): boolean {
  return "serviceWorker" in navigator;
}

/**
 * Registra el worker. **Nunca lanza**: que no se pueda registrar (contexto inseguro, modo privado,
 * política del navegador) no rompe la página; solo la deja sin copia offline, y eso se dice.
 */
export async function registrarWorker(): Promise<boolean> {
  if (!haySoporteDeWorker()) {
    return false;
  }
  try {
    await navigator.serviceWorker.register(RUTA_SW);
    return true;
  } catch (fallo: unknown) {
    console.warn("[mareia] no se ha podido registrar el service worker", fallo);
    return false;
  }
}

/**
 * Le pide algo al worker y espera su respuesta.
 *
 * Se usa `navigator.serviceWorker.ready` y **no** `controller`: en la primera visita el worker está
 * activo pero todavía no controla esta pestaña (no se llamó a `skipWaiting`), así que `controller`
 * sería `null` y guardar un favorito fallaría justo la primera vez, que es cuando se guarda.
 *
 * El plazo envuelve **toda** la operación y no solo la conversación, porque `ready` es una promesa
 * que no se resuelve nunca si el registro falló: sin esto, un navegador que bloquea los service
 * workers dejaría el botón girando para siempre en vez de decir lo que pasa.
 */
export async function pedirAlWorker(peticion: PeticionAlWorker): Promise<RespuestaDelWorker> {
  if (!haySoporteDeWorker()) {
    return {
      ok: false,
      motivo: "Este navegador no admite guardar páginas para usarlas sin red.",
      urls: 0,
    };
  }
  return conPlazo(async () => {
    try {
      const registro = await navigator.serviceWorker.ready;
      const activo = registro.active;
      if (activo === null) {
        return {
          ok: false,
          motivo: "El guardado sin red todavía no está listo; recarga e inténtalo otra vez.",
          urls: 0,
        };
      }
      return await conversacion(activo, peticion);
    } catch (fallo: unknown) {
      console.warn("[mareia] el service worker no ha contestado", fallo);
      return { ok: false, motivo: "El guardado sin red no ha contestado en este navegador.", urls: 0 };
    }
  });
}

/** Corre algo con plazo. Pasado el plazo, se contesta lo que se sabe: que ha tardado demasiado. */
async function conPlazo(
  operacion: () => Promise<RespuestaDelWorker>,
): Promise<RespuestaDelWorker> {
  const tardo = new Promise<RespuestaDelWorker>((resolver) => {
    setTimeout(() => {
      resolver({
        ok: false,
        motivo:
          "El guardado sin red ha tardado demasiado. Vuelve a intentarlo con mejor cobertura.",
        urls: 0,
      });
    }, ESPERA_MS);
  });
  return Promise.race([operacion(), tardo]);
}

/** Una petición por su propio canal: la respuesta que llega es la de ESTA petición. */
async function conversacion(
  worker: ServiceWorker,
  peticion: PeticionAlWorker,
): Promise<RespuestaDelWorker> {
  return new Promise((resolver) => {
    const canal = new MessageChannel();
    canal.port1.addEventListener("message", (evento: MessageEvent<unknown>) => {
      canal.port1.close();
      resolver(comoRespuesta(evento.data));
    });
    canal.port1.start();
    worker.postMessage(peticion, [canal.port2]);
  });
}

/** Lo que conteste el worker, comprobado antes de creérselo. */
function comoRespuesta(datos: unknown): RespuestaDelWorker {
  if (typeof datos !== "object" || datos === null) {
    return {
      ok: false,
      motivo: "El guardado sin red ha contestado algo que no se entiende.",
      urls: 0,
    };
  }
  const registro = datos as Record<string, unknown>;
  const motivo = typeof registro["motivo"] === "string" ? registro["motivo"] : undefined;
  return {
    ok: registro["ok"] === true,
    ...(motivo === undefined ? {} : { motivo }),
    urls: typeof registro["urls"] === "number" ? registro["urls"] : 0,
  };
}
