/**
 * A3/A6 · **La red hostil, no la red caída: un 200 con el cuerpo cambiado mata la isla.**
 *
 * `traer()` (en `cliente/isla.ts`) sólo se protege de dos cosas: que la petición no salga y que el
 * estado HTTP no sea 2xx. Lo que llega con un 200 se pasa a `vistaMeteo` **sin mirar**, y
 * `vistaMeteo` supone la forma del contrato de T-08: lee `cuerpo.marine.status`, mete `fetchedAt`
 * en `Date.parse` y llama `.toFixed()` sobre lo que venga en cada magnitud.
 *
 * Un backend a medio desplegar, un proxy que devuelve su propio JSON con un 200, una versión del
 * módulo por delante de la del sitio construido: cualquiera de los tres rompe la isla con una
 * excepción, y como `montarSeccion` es una promesa que nadie espera, la excepción **no se ve**. Lo
 * que queda en pantalla es «Pidiendo el estado del mar…» con `aria-busy="true"`, para siempre: la
 * sección afirma estar pidiendo algo que ya no está pidiendo, no hay ninguno de los cuatro
 * ausentes que promete la trayectoria, y del estado sólo se sale recargando a mano (A9).
 *
 * El segundo test ataca el otro extremo del mismo hueco: un 200 con un cuerpo que ni siquiera es
 * JSON sí se captura, pero se le cuelga **la ausencia equivocada** — la del navegador que no pudo
 * preguntar, cuando preguntó y le contestaron.
 */

import { expect, test } from "../../fixtures/qa-bundle";

import { PAGINA, SECCION, fixture, montarApi } from "./utiles";

/** Tres formas realistas de que un 200 no tenga la forma que la isla da por hecha. */
const CUERPOS_HOSTILES = [
  {
    nombre: "sin el bloque marine (backend a medio desplegar)",
    cuerpo: { port: { slug: "vigo" }, status: "ok" },
  },
  {
    nombre: "fetchedAt que no es una fecha",
    cuerpo: (() => {
      const carga = fixture("weather-ok");
      (carga["marine"] as Record<string, unknown>)["fetchedAt"] = "ayer por la tarde";
      return carga;
    })(),
  },
  {
    nombre: "una magnitud que llega como cadena y no como número",
    cuerpo: (() => {
      const carga = fixture("weather-ok");
      const datos = (carga["forecast"] as Record<string, Record<string, unknown>>)["data"]!;
      datos["uvIndex"] = "1.3";
      return carga;
    })(),
  },
] as const;

for (const hostil of CUERPOS_HOSTILES) {
  test(`A3 · un 200 con ${hostil.nombre} no puede dejar la sección pidiendo para siempre`, async ({
    page,
    qa,
  }) => {
    qa.step(`servir 200 con ${hostil.nombre}`);
    await montarApi(page, { cuerpo: hostil.cuerpo }, { cuerpo: fixture("bulletin-ok") });
    await page.goto(PAGINA);

    qa.step("esperar a que la sección resuelva a alguno de sus cuatro estados");
    // El comportamiento CORRECTO: si el dato no se puede leer, la sección lo dice con uno de sus
    // ausentes. Se afirma la presencia del ausente (positivo y específico), no la ausencia del
    // síntoma, para que el día del fix este mismo cuerpo pase sin tocarlo.
    await expect(page.locator("#meteo-mar")).toContainText("No se ha podido traer", {
      timeout: 10_000,
    });

    qa.step("y la sección deja de anunciarse como ocupada");
    await expect(page.locator(".meteo")).toHaveAttribute("aria-busy", "false");
    await expect(page.locator(SECCION)).not.toContainText("Pidiendo el estado del mar");
  });
}

test("A3 · un 200 con basura no se puede confundir con «el navegador no pudo preguntar»", async ({
  page,
  qa,
}) => {
  qa.step("caso A: el API contesta 200 con un cuerpo que no es JSON (un proxy de por medio)");
  await montarApi(
    page,
    { cuerpo: "<html><body>502 Bad Gateway</body></html>" },
    { cuerpo: fixture("bulletin-ok") },
  );
  await page.goto(PAGINA);
  await expect(page.locator("#meteo-mar")).toContainText("No se ha podido traer");
  const conBasura = await page.locator("#meteo-mar .meteo__sello").innerText();

  qa.step("caso B: la petición ni siquiera sale (el API está caído de verdad)");
  await page.unrouteAll();
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page.route("**/v1/modules/weather/weather?*", (route) => route.abort("connectionrefused"));
  await page.route("**/v1/modules/weather/bulletin?*", (route) => route.abort("connectionrefused"));
  await page.reload();
  await expect(page.locator("#meteo-mar")).toContainText("No se ha podido traer");
  const conApiCaido = await page.locator("#meteo-mar .meteo__sello").innerText();

  // La promesa son CUATRO ausencias «cada una diciendo cuál es». Éstas son dos causas distintas
  // —el servidor contestó algo ilegible / el navegador no llegó a preguntar— y hoy se leen igual.
  qa.step("comparar las dos frases: son dos ausencias distintas y tienen que leerse distinto");
  expect(conBasura, "el 200 ilegible y el API caído dicen exactamente lo mismo").not.toEqual(
    conApiCaido,
  );
});
