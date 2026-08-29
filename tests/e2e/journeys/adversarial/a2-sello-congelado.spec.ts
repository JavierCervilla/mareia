/**
 * A2 · **El sello de antigüedad se congela en el instante en que se pintó.**
 *
 * La promesa de T-11, palabra por palabra: *«nunca presenta como fresco un dato que no lo es»*. Y
 * la justificación de ADR-01 para no hornear la meteo en build es exactamente ésta: *«un HTML
 * horneado no puede sellar su propio dato: el que dice ‘consultado hace 4 minutos’ lo sigue
 * diciendo veinte horas después»*.
 *
 * La isla calcula la edad **una vez**, al pintar (`vistaMeteo(..., Date.now(), ...)` en
 * `cliente/isla.ts`), y no vuelve a tocarla: ni temporizador, ni `visibilitychange`, ni `pageshow`.
 * Así que el defecto que ADR-01 dice resolver no se ha eliminado — se ha movido del momento del
 * build al momento de abrir la pestaña. Un móvil con la página abierta en el bolsillo, que es el
 * entorno de uso que manda el design brief («un teléfono a pleno sol en la playa»), enseña tres
 * horas después un dato de hace tres horas rotulado «Consultado hace menos de un minuto».
 *
 * El ataque no toca la red ni el reloj del sistema: adelanta el reloj **de la página**
 * (`page.clock`) tres horas con la pestaña abierta, que es lo que hace un usuario sin enterarse.
 */

import { expect, test } from "../../fixtures/qa-bundle";

import { PAGINA, SECCION, fixture, montarApi } from "./utiles";

test("A2 · el sello no envejece con la página abierta tres horas", async ({ page, qa }) => {
  test.fail();

  qa.step("congelar el reloj de la página antes de cargarla (así el adelanto es medible)");
  await page.clock.install();

  qa.step("servir un dato fresco: ageSeconds 0, stale false");
  await montarApi(
    page,
    { cuerpo: fixture("weather-ok") },
    { cuerpo: fixture("bulletin-ok") },
  );
  await page.goto(PAGINA);

  const sello = page.locator("#meteo-mar .meteo__sello-titular");
  await expect(sello).toHaveText("Consultado hace menos de un minuto");

  qa.step("el usuario deja la pestaña abierta tres horas (bolsillo, playa, sobremesa)");
  await page.clock.fastForward("03:00:00");

  // El comportamiento CORRECTO, no el síntoma: pasadas tres horas el sello tiene que decir que el
  // dato tiene tres horas. Da igual cómo se consiga (repintar la edad, volver a pedir, marcarlo
  // caducado); lo que no puede es seguir diciendo que es de hace menos de un minuto.
  qa.step("comprobar que el sello ya no vende como recién consultado un dato de hace 3 h");
  await expect(sello).toHaveText(/hace (2 h 5\d min|3 h)/u);

  // Y la sección entera tampoco puede seguir afirmándolo por otro sitio.
  await expect(page.locator(SECCION)).not.toContainText("Consultado hace menos de un minuto");
});
