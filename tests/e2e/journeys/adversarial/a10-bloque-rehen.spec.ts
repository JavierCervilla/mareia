/**
 * A10/A3 · **El bloque que ya llegó se queda de rehén del que tarda.**
 *
 * `cliente/isla.ts` declara, en su propia cabecera, que *«los dos endpoints se piden por separado y
 * fallan por separado: que AEMET no conteste no puede dejar sin viento a quien mira la página»*. Se
 * piden por separado, sí, pero se **pintan juntos**: `montarSeccion` hace `Promise.all` de los dos
 * y no toca el DOM hasta que resuelven los dos.
 *
 * La consecuencia sólo se ve con la red hostil (lenta), no con la red caída, que es justo el caso
 * que los recorridos confirmatorios no cubren: si AEMET tarda —y el boletín de AEMET es el endpoint
 * lento del par, con caché de horas y una fuente ajena detrás—, el estado del mar ya está en el
 * navegador y el usuario sigue leyendo «Pidiendo el estado del mar…» hasta que expira la espera de
 * ocho segundos. Ocho segundos mirando un hueco, con el dato ya descargado, en un móvil a pleno sol.
 *
 * Y el desenlace de A10 es A1: quien no ve nada recarga. Aquí recargar vuelve a pedir los dos.
 */

import { expect, test } from "../../fixtures/qa-bundle";

import { PAGINA, fixture, montarApi } from "./utiles";

test("A10 · el estado del mar se enseña sin esperar a que AEMET conteste", async ({ page, qa }) => {
  test.fail();

  qa.step("Open-Meteo contesta al momento; AEMET tarda 5 s (dentro de la espera de 8 s)");
  await montarApi(
    page,
    { cuerpo: fixture("weather-ok") },
    { cuerpo: fixture("bulletin-ok"), retrasoMs: 5_000 },
  );
  await page.goto(PAGINA);

  // El comportamiento CORRECTO: el bloque cuyo dato ya está en el navegador se pinta con su sello,
  // sin esperar al otro. 3 s es holgado —el dato del mar llegó en el primer instante— y sigue por
  // debajo de los 5 s que tarda AEMET, así que el assert distingue de verdad los dos diseños.
  qa.step("a los 3 s el mar ya tiene que estar en pantalla, con su sello");
  await expect(page.locator("#meteo-mar")).toContainText("1,68 m", { timeout: 3_000 });
  await expect(page.locator("#meteo-mar .meteo__sello-titular")).toContainText("Consultado hace");
});
