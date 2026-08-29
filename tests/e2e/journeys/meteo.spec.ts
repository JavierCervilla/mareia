/**
 * Recorrido de la sección meteo (T-11): los cuatro estados, uno a uno, contra la página construida.
 *
 * Lo que aquí se comprueba y no puede comprobar un test de unidad: que el estado **llega a la
 * pantalla**. `vista.test.ts` afirma que el modelo de vista dice «Dato de hace 3 h 10 min»; esto
 * afirma que un ojo lo lee en la página, que el bloque no se quedó oculto y que el estado anterior
 * no sigue debajo contando otra cosa.
 *
 * **Cero red.** El API se sirve desde los fixtures capturados (`page.route`) y **toda** petición a un
 * origen que no sea el servidor local se aborta y se anota. Lo que se afirma al final de cada
 * recorrido es doble: que la sección funciona con la salida cerrada, y que los orígenes externos que
 * la página llegó a pedir son exactamente los conocidos —hoy, la hoja de tipografías de Google, que
 * el design brief ya cubre con su respaldo Georgia—. Un origen nuevo (un CDN, una analítica) pone
 * esto en rojo, que es justo lo que tiene que hacer un portal que promete no espiar a nadie.
 *
 * Cada estado deja su captura en `qa-shots/t11-meteo/` para el informe del pase adversario (no se
 * versiona: el .gitignore del repo deja fuera los artefactos de QA y CI los sube como artifact).
 */

import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page, type Route } from "@playwright/test";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const FIXTURES = join(RAIZ, "apps", "web", "src", "modulos", "meteo", "fixtures");
const CAPTURAS = join(RAIZ, "qa-shots", "t11-meteo");
const PAGINA = "/mareas/galicia/pontevedra/vigo/";

/** La sección meteo de la página, por su ancla del contrato `AppModule`. */
const SECCION = "#meteo";

/**
 * Los únicos orígenes externos que la página puede llegar a pedir. Se **bloquean** igualmente: aquí
 * solo se declara cuáles se conocen, para que aparecer uno nuevo sea un fallo y no un silencio.
 */
const EXTERNOS_CONOCIDOS = ["fonts.googleapis.com"];

/** Comprueba que la página no pidió nada fuera de lo previsto (y que lo previsto iba bloqueado). */
function sinSalidasNuevas(escapes: readonly string[]): readonly string[] {
  return [...new Set(escapes.map((url) => new URL(url).hostname))].sort();
}

function fixture(nombre: string): string {
  return readFileSync(join(FIXTURES, `${nombre}.json`), "utf8");
}

/**
 * Sirve los dos endpoints del módulo desde fixtures y **cierra la salida a internet**.
 *
 * Devuelve la lista de escapes: URLs que la página pidió fuera del servidor local. Se afirma vacía
 * en cada recorrido, que es la forma de que «cero red en CI» sea una comprobación y no una promesa.
 */
async function montarApi(
  page: Page,
  meteo: string | undefined,
  boletin: string | undefined,
): Promise<readonly string[]> {
  const escapes = await cerrarLaSalidaAInternet(page);

  // El orden importa y no es un detalle: en Playwright **gana la última ruta registrada**, así que
  // la puerta cerrada va primero y los dos endpoints del módulo después. Al revés, el catch-all se
  // comería las peticiones al API y todos los recorridos verían el mismo 404.
  const responder = (cuerpo: string) => (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: cuerpo });
  const caer = (route: Route) => route.abort("connectionrefused");

  await page.route(
    "**/v1/modules/weather/weather?*",
    meteo === undefined ? caer : responder(fixture(meteo)),
  );
  await page.route(
    "**/v1/modules/weather/bulletin?*",
    boletin === undefined ? caer : responder(fixture(boletin)),
  );

  return escapes;
}

/** Aborta y anota toda petición que no vaya al servidor local. */
async function cerrarLaSalidaAInternet(page: Page): Promise<readonly string[]> {
  const escapes: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      escapes.push(url.href);
      await route.abort();
      return;
    }
    await route.continue();
  });
  return escapes;
}

/** El bloque de un origen dentro de la sección: mar, atmósfera o boletín. */
function bloque(page: Page, id: string) {
  return page.locator(`${SECCION} #meteo-${id}`);
}

async function capturar(page: Page, nombre: string): Promise<void> {
  await mkdir(CAPTURAS, { recursive: true });
  await page.locator(SECCION).screenshot({ path: join(CAPTURAS, `${nombre}.png`) });
}

// --- Estado 1 · ok ---------------------------------------------------------------------------

test("estado ok · el dato llega con la hora de la consulta y nada dice que sea viejo", async ({
  page,
}) => {
  const escapes = await montarApi(page, "weather-ok", "bulletin-ok");
  await page.goto(PAGINA);

  const mar = bloque(page, "mar");
  await expect(mar.getByText("Ola", { exact: true })).toBeVisible();
  await expect(mar).toContainText("1,68 m");
  await expect(mar).toContainText("de 287° (ONO) · periodo 8,9 s");
  await expect(mar.locator(".meteo__sello-titular")).toHaveText(/^Consultado hace /u);
  await expect(bloque(page, "atmosfera")).toContainText("9,4 km/h");

  // Nada en la sección se anuncia como caducado ni queda el estado de carga por debajo.
  await expect(page.locator(SECCION)).not.toContainText("Dato de hace");
  await expect(page.locator(SECCION)).not.toContainText("todavía no ha llegado");
  await expect(page.locator(`${SECCION} [aria-busy="false"]`)).toBeVisible();

  await capturar(page, "1-ok");
  expect(sinSalidasNuevas(escapes), "origen externo nuevo").toEqual(EXTERNOS_CONOCIDOS);
});

// --- Estado 2 · stale ------------------------------------------------------------------------

test("estado stale · la antigüedad se lee en la cara, no en un icono ni en un tooltip", async ({
  page,
}) => {
  const escapes = await montarApi(page, "weather-stale", "bulletin-ok");
  await page.goto(PAGINA);

  const sello = bloque(page, "mar").locator(".meteo__sello");
  // El texto está VISIBLE en la página, no escondido en un `title` ni en un `aria-label`.
  await expect(sello).toContainText("Dato de hace 3 h 10 min");
  await expect(sello).toContainText("No es de ahora");
  await expect(sello).toHaveClass(/meteo__sello--caducado/u);
  // Y el dato viejo se sigue enseñando: marcarlo no es esconderlo.
  await expect(bloque(page, "mar")).toContainText("1,68 m");

  await capturar(page, "2-caducado");
  expect(sinSalidasNuevas(escapes), "origen externo nuevo").toEqual(EXTERNOS_CONOCIDOS);
});

test("estado stale · no se puede confundir con el estado ok mirando la sección", async ({
  page,
}) => {
  await montarApi(page, "weather-stale", "bulletin-ok");
  await page.goto(PAGINA);
  const caducado = await bloque(page, "mar").locator(".meteo__sello").innerText();

  await page.unrouteAll();
  const escapes = await montarApi(page, "weather-ok", "bulletin-ok");
  await page.reload();
  const fresco = await bloque(page, "mar").locator(".meteo__sello").innerText();

  expect(caducado).not.toEqual(fresco);
  expect(fresco).not.toContain("Dato de hace");
  expect(sinSalidasNuevas(escapes), "origen externo nuevo").toEqual(EXTERNOS_CONOCIDOS);
});

// --- Estado 3 · unavailable ------------------------------------------------------------------

test("estado unavailable · cada bloque publica su motivo, con la credencial de AEMET incluida", async ({
  page,
}) => {
  const escapes = await montarApi(page, "weather-no-disponible", "bulletin-clave-caducada");
  await page.goto(PAGINA);

  await expect(bloque(page, "mar")).toContainText("No se ha podido traer");
  await expect(bloque(page, "mar")).toContainText("Open-Meteo marine no respondió: ECONNREFUSED");
  await expect(bloque(page, "boletin")).toContainText(
    "La credencial de AEMET de esta instancia caducó el 2026-07-20",
  );
  // Un hueco mudo sería el fallo: la sección abre diciendo que no hay nada que enseñar.
  await expect(page.locator(SECCION)).toContainText("no hay estado del mar que enseñar");
  // Y las atribuciones siguen ahí aunque no haya dato que atribuir todavía.
  await expect(page.locator(SECCION)).toContainText("Open-Meteo");
  await expect(page.locator(SECCION)).toContainText("CC-BY-4.0");

  await capturar(page, "3-no-disponible");
  expect(sinSalidasNuevas(escapes), "origen externo nuevo").toEqual(EXTERNOS_CONOCIDOS);
});

test("sin credencial de AEMET el boletín explica el hueco y el resto de la sección sigue viva", async ({
  page,
}) => {
  const escapes = await montarApi(page, "weather-ok", "bulletin-sin-clave");
  await page.goto(PAGINA);

  await expect(bloque(page, "boletin")).toContainText("no tiene credencial de AEMET");
  await expect(bloque(page, "mar")).toContainText("1,68 m");
  expect(sinSalidasNuevas(escapes), "origen externo nuevo").toEqual(EXTERNOS_CONOCIDOS);
});

// --- Estado 4 · carga sin datos --------------------------------------------------------------

test.describe("estado de carga sin datos", () => {
  test.use({ javaScriptEnabled: false });

  test("sin JavaScript la sección explica el hueco y el resto de la página está entera", async ({
    page,
  }) => {
    // Aquí no hay API que mockear —no hay JavaScript que la pida— pero la salida se cierra igual:
    // el recorrido tiene que valer en un CI sin red, y sin esto la página se iría a por las fuentes.
    const escapes = await cerrarLaSalidaAInternet(page);
    await page.goto(PAGINA);

    await expect(page.locator(SECCION)).toContainText("El estado del mar todavía no ha llegado");
    await expect(page.locator(SECCION)).toContainText("no ejecuta JavaScript");
    // Ni una magnitud meteorológica: la página no puede envejecer diciendo que es de ahora.
    await expect(page.locator(SECCION)).not.toContainText("km/h");
    await expect(page.locator(SECCION)).not.toContainText("hPa");
    // Las atribuciones son HTML estático: no dependen de que la petición salga.
    await expect(page.locator(SECCION)).toContainText("AEMET");

    // Y lo que no es el módulo sigue completo sin una línea de JavaScript.
    await expect(page.locator("#tabla-de-mareas")).toContainText("Mareas de hoy");
    await expect(page.locator("#curva-de-marea svg")).toBeVisible();

    await capturar(page, "4-sin-datos");
    expect(sinSalidasNuevas(escapes), "origen externo nuevo").toEqual(EXTERNOS_CONOCIDOS);
  });
});

// --- El otro ausente: hueco del modelo -------------------------------------------------------

test("un hueco del modelo se lee distinto de una fuente caída", async ({ page }) => {
  const escapes = await montarApi(page, "weather-huecos", "bulletin-ok");
  await page.goto(PAGINA);

  const mar = bloque(page, "mar");
  await expect(mar).toContainText("el modelo no publica la altura de esta ola en esta celda");
  // La fuente SÍ respondió: el sello es de dato consultado, no de fallo.
  await expect(mar.locator(".meteo__sello")).toHaveClass(/meteo__sello--fresco/u);
  await expect(mar).not.toContainText("No se ha podido traer");

  await capturar(page, "5-hueco-del-modelo");
  expect(sinSalidasNuevas(escapes), "origen externo nuevo").toEqual(EXTERNOS_CONOCIDOS);
});

// --- Degradación parcial ---------------------------------------------------------------------

test("degradación parcial · el mar servido no se contagia de la atmósfera caída", async ({
  page,
}) => {
  const escapes = await montarApi(page, "weather-parcial", "bulletin-ok");
  await page.goto(PAGINA);

  await expect(bloque(page, "mar")).toContainText("1,68 m");
  await expect(bloque(page, "atmosfera")).toContainText("No se ha podido traer");
  await expect(page.locator(SECCION)).not.toContainText("no hay estado del mar que enseñar");

  await capturar(page, "6-parcial");
  expect(sinSalidasNuevas(escapes), "origen externo nuevo").toEqual(EXTERNOS_CONOCIDOS);
});

// --- El API caído desde el navegador ----------------------------------------------------------

test("si el API no contesta, el motivo es NUESTRO y no se le achaca a Open-Meteo", async ({
  page,
}) => {
  const escapes = await montarApi(page, undefined, undefined);
  await page.goto(PAGINA);

  const seccion = page.locator(SECCION);
  await expect(seccion).toContainText("No se ha podido pedir el estado del mar al servidor de Mareia.");
  await expect(seccion).not.toContainText("Open-Meteo marine no respondió");

  await capturar(page, "7-api-caido");
  expect(sinSalidasNuevas(escapes), "origen externo nuevo").toEqual(EXTERNOS_CONOCIDOS);
});
