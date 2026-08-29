/**
 * Lo mínimo que comparten las reproducciones adversarias de **T-12** (la PWA offline).
 *
 * Es hermano de `utiles.ts` (que sirve a las de T-11) y no una ampliación suya: aquello monta el API
 * de meteo sobre `page.route`, y aquí no vale — **las peticiones que hace un service worker no pasan
 * por la página**, así que la red se corta y se sirve desde `context.route`. Mezclarlos habría dejado
 * un helper que corta la red a medias, que es la peor clase de arnés: uno que falla en verde.
 *
 * No trae asserts, por la misma razón que `utiles.ts`: un helper que afirma esconde el ataque dentro
 * de la utilidad. Lo único que se permite es `guardarPuerto`, que espera al sello porque sin esa
 * espera el ataque empieza antes de que exista lo que se ataca.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { BrowserContext, Page } from "@playwright/test";

import { expect } from "../../fixtures/qa-bundle";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const FIXTURES = join(RAIZ, "apps", "web", "src", "modulos", "meteo", "fixtures");

/** El puerto sobre el que se ataca, el mismo que usan los recorridos confirmatorios. */
export const PAGINA = "/mareas/galicia/pontevedra/vigo/";
/** Un segundo puerto: casi todo lo que se ataca aquí necesita más de un favorito. */
export const PAGINA_SEGUNDA = "/mareas/cantabria/cantabria/santander/";
export const SECCION_SIN_RED = "#sin-cobertura";
/** Un día que no publica ninguna página construida: es lo que un caché de páginas no puede dar. */
export const DIA_FUTURO = "2027-03-14";

function fixture(nombre: string): string {
  return readFileSync(join(FIXTURES, `${nombre}.json`), "utf8");
}

export interface Arnes {
  /** Corta la red para la página **y** para el service worker. */
  cortar: () => Promise<void>;
  /** Simula el rebuild diario (T-15) en una ruta: su HTML apunta a assets con otro hash. */
  otroBuildEn: (ruta: string) => void;
  /** Retrasa la respuesta de un camino, para poder solapar dos operaciones a propósito. */
  retrasar: (camino: string, ms: number) => void;
}

const PREFIJO_OTRO_BUILD = "/_astro/otro-build--";

/**
 * Sirve el sitio construido con los endpoints de meteo desde fixtures y la salida a internet
 * cerrada. Mismo arnés que `journeys/offline.spec.ts`, que es lo que hace comparables los dos lados.
 */
export async function montarArnes(context: BrowserContext): Promise<Arnes> {
  let hayRed = true;
  const rutasDeOtroBuild = new Set<string>();
  const retrasos = new Map<string, number>();

  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!hayRed) {
      await route.abort("internetdisconnected");
      return;
    }
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      await route.abort();
      return;
    }
    const retraso = retrasos.get(url.pathname);
    if (retraso !== undefined) {
      await new Promise((listo) => setTimeout(listo, retraso));
    }
    if (url.pathname.startsWith(PREFIJO_OTRO_BUILD)) {
      const original = `/_astro/${url.pathname.slice(PREFIJO_OTRO_BUILD.length)}`;
      await route.fulfill({ response: await route.fetch({ url: `${url.origin}${original}` }) });
      return;
    }
    if (rutasDeOtroBuild.has(url.pathname)) {
      const respuesta = await route.fetch();
      const html = (await respuesta.text()).replaceAll("/_astro/", PREFIJO_OTRO_BUILD);
      await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
      return;
    }
    const endpoint = /\/v1\/modules\/weather\/(weather|bulletin)$/u.exec(url.pathname)?.[1];
    if (endpoint !== undefined) {
      const cuerpo = endpoint === "weather" ? "weather-ok" : "bulletin-ok";
      await route.fulfill({ status: 200, contentType: "application/json", body: fixture(cuerpo) });
      return;
    }
    await route.continue();
  });

  return {
    otroBuildEn: (ruta) => {
      rutasDeOtroBuild.add(ruta);
    },
    retrasar: (camino, ms) => {
      retrasos.set(camino, ms);
    },
    cortar: async () => {
      hayRed = false;
      await context.setOffline(true);
      // Chromium reinicia su emulación de «sin red» en cada navegación; en un teléfono de verdad la
      // bandera sigue abajo. Se falsea **solo la bandera**: la red sigue cortada de verdad.
      await context.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, "onLine", {
          get: () => false,
          configurable: true,
        });
      });
    },
  };
}

/**
 * Las medidas van como **expresión en texto** y no como función: el `tsconfig` del repo deja `lib`
 * en `ES2022` a propósito, así que un `page.evaluate` con `document` o `caches` dentro no compila.
 */

/** Los caminos que hay ahora mismo en la caché de páginas del worker. */
export const CLAVES_GUARDADAS = `(async () => {
  const nombre = (await caches.keys()).find((clave) => clave.startsWith("mareia-paginas-"));
  if (nombre === undefined) return [];
  const cache = await caches.open(nombre);
  return (await cache.keys()).map((peticion) => new URL(peticion.url).pathname);
})()`;

/** El registro de favoritos del worker, tal y como está guardado. */
export const REGISTRO_GUARDADO = `(async () => {
  const nombre = (await caches.keys()).find((clave) => clave.startsWith("mareia-paginas-"));
  if (nombre === undefined) return null;
  const cache = await caches.open(nombre);
  const guardado = await cache.match("/__mareia/favoritos");
  return guardado === undefined ? null : await guardado.text();
})()`;

/** Deja el registro ilegible sin tocar nada más: la avería que dispara el fail-safe de la poda. */
export const CORROMPER_REGISTRO = `(async () => {
  const nombre = (await caches.keys()).find((clave) => clave.startsWith("mareia-paginas-"));
  const cache = await caches.open(nombre);
  await cache.put("/__mareia/favoritos", new Response("esto no es JSON"));
})()`;

/**
 * Borra la caché de páginas del worker **sin tocar IndexedDB**.
 *
 * Es lo que hace el propio `activate` al subir `ESQUEMA_CACHE`, y también lo que hace el navegador
 * cuando desaloja el almacenamiento de un origen o quien lee borra «imágenes y archivos» del menú
 * del navegador. Los favoritos de IndexedDB sobreviven a las tres cosas.
 */
export const BARRER_CACHE_DE_PAGINAS = `(async () => {
  for (const clave of await caches.keys()) {
    if (clave.startsWith("mareia-paginas-")) await caches.delete(clave);
  }
})()`;

/** Espera a que el service worker esté activo antes de pedirle nada. */
export async function workerListo(page: Page): Promise<void> {
  await page.waitForFunction(
    `navigator.serviceWorker.ready.then((registro) => registro.active !== null)`,
  );
}

/** Guarda el puerto abierto y espera al sello que confirma que ya está en el dispositivo. */
export async function guardarPuerto(page: Page): Promise<void> {
  await workerListo(page);
  await page.locator(`${SECCION_SIN_RED} [data-sin-red-accion]`).click();
  await expect(page.locator(`${SECCION_SIN_RED} .sin-red__titular`)).toContainText(
    /^Guardado en este dispositivo hace /u,
    { timeout: 20_000 },
  );
}

/** Pide un día en la calculadora. */
export async function pedirDia(page: Page, fechaIso: string): Promise<void> {
  await page.locator("[data-otro-dia-fecha]").fill(fechaIso);
  await page.locator(`#otro-dia button[type="submit"]`).click();
}
