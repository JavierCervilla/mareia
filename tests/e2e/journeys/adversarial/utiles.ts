/**
 * Lo mínimo compartido por las reproducciones adversarias de T-11.
 *
 * Está aquí y no copiado en cada spec por una razón concreta del pase: el arnés tiene que **cerrar
 * la salida a internet** igual que los recorridos confirmatorios (`journeys/meteo.spec.ts`), porque
 * un ataque que se apoyara en la red real no sería reproducible en CI y el hallazgo se pudriría.
 *
 * No trae asserts: un helper que afirma esconde el ataque dentro de la utilidad y luego nadie sabe
 * qué se estaba comprobando. Cada spec afirma en su cuerpo.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Page, Route } from "@playwright/test";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const FIXTURES = join(RAIZ, "apps", "web", "src", "modulos", "meteo", "fixtures");

/** Página de puerto sobre la que se ataca (la misma que usan los recorridos confirmatorios). */
export const PAGINA = "/mareas/galicia/pontevedra/vigo/";

/** La sección meteo, por su ancla del contrato `AppModule`. */
export const SECCION = "#meteo";

/** Un fixture del módulo `weather`, ya parseado: los ataques lo mutan antes de servirlo. */
export function fixture(nombre: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURES, `${nombre}.json`), "utf8")) as Record<
    string,
    unknown
  >;
}

/** Aborta toda petición que no vaya al servidor local: el ataque corre con la salida cerrada. */
export async function cerrarLaSalidaAInternet(page: Page): Promise<void> {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      await route.abort();
      return;
    }
    await route.continue();
  });
}

/** Cómo responde un endpoint del módulo en este ataque. */
export interface Respuesta {
  /** Cuerpo. Un objeto se serializa; una cadena viaja tal cual (para servir basura a propósito). */
  readonly cuerpo: unknown;
  /** Retraso antes de contestar, en ms. Es la red hostil: lenta, no caída. */
  readonly retrasoMs?: number;
  readonly estado?: number;
}

/**
 * Sirve los dos endpoints del módulo desde el ataque y cierra la salida.
 *
 * El orden importa (gana la última ruta registrada en Playwright): primero la puerta cerrada,
 * después los dos endpoints. Al revés, el catch-all se comería las peticiones al API.
 */
export async function montarApi(
  page: Page,
  meteo: Respuesta,
  boletin: Respuesta,
): Promise<void> {
  await cerrarLaSalidaAInternet(page);
  const responder = (respuesta: Respuesta) => async (route: Route) => {
    if (respuesta.retrasoMs !== undefined) {
      await new Promise((listo) => setTimeout(listo, respuesta.retrasoMs));
    }
    await route.fulfill({
      status: respuesta.estado ?? 200,
      contentType: "application/json",
      body:
        typeof respuesta.cuerpo === "string"
          ? respuesta.cuerpo
          : JSON.stringify(respuesta.cuerpo),
    });
  };
  await page.route("**/v1/modules/weather/weather?*", responder(meteo));
  await page.route("**/v1/modules/weather/bulletin?*", responder(boletin));
}
