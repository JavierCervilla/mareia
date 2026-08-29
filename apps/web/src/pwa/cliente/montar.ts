/**
 * El punto de entrada de la PWA en la página de puerto: **el único script de core del sitio**.
 *
 * Vive solo en la página de puerto y no en el layout a propósito. El core del portal sigue siendo
 * HTML sin JavaScript en las 21 páginas restantes —portada e índices geográficos—, y ahí no hay
 * ninguna promesa que cumplir: nadie guarda un índice para leerlo en la playa. El JavaScript de la
 * PWA vive donde vive su promesa. Está declarado como script de core en `src/scripts-de-core.ts` y
 * el gate del pase adversario de T-09 cuenta los scripts servidos contra esa declaración.
 *
 * Nada de lo que hay aquí puede tumbar la página: si algo falla, la tabla de mareas, la curva y las
 * efemérides ya están en el HTML y no dependen de una sola línea de esto.
 */

import { anclajeOtroDia, montarOtroDia } from "./otro-dia.ts";
import { anclajeSinRed, montarSinRed } from "./sin-red.ts";
import { registrarWorker } from "./worker.ts";

/** Monta una sección declarada por su atributo, si está y si tiene todo lo que necesita. */
function montarSeccion(
  selector: string,
  montar: (seccion: HTMLElement) => void,
): void {
  const seccion = document.querySelector(selector);
  if (seccion instanceof HTMLElement) {
    montar(seccion);
  }
}

/**
 * Arranca la PWA de esta página. Idempotente y silenciosa si la página no trae sus secciones.
 *
 * El worker se registra **siempre** que la página lo tenga: registrarlo no guarda nada (ver
 * `pwa/sw.ts`, que no precachea en `install`), pero tiene que estar activo para que el botón de
 * guardar funcione a la primera, y para que la copia de la respuesta de meteo se selle con su hora.
 */
export function montarPwa(): void {
  try {
    void registrarWorker();
    montarSeccion("[data-sin-red]", (seccion) => {
      const anclaje = anclajeSinRed(seccion);
      if (anclaje !== undefined) {
        montarSinRed(anclaje);
      }
    });
    montarSeccion("[data-otro-dia]", (seccion) => {
      const anclaje = anclajeOtroDia(seccion);
      if (anclaje !== undefined) {
        montarOtroDia(anclaje);
      }
    });
  } catch (fallo: unknown) {
    // La red de seguridad: la parte offline es un extra sobre una página que ya está completa. Si
    // no se puede montar, se anota donde lo lee quien puede arreglarlo y no se toca la pantalla.
    console.error("[mareia] no se ha podido montar la parte offline de la página", fallo);
  }
}
