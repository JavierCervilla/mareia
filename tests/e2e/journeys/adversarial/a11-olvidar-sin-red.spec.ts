/**
 * A11 · **Sin cobertura, un toque borra el almanaque que se está leyendo y no hay vuelta atrás.**
 *
 * Estado 5 de la sección —sin red y con el puerto guardado, que es la situación para la que existe
 * T-12— y el botón que se ofrece ahí es «Dejar de guardar Vigo». Un toque, sin confirmación, sin
 * decir qué se lleva por delante y sin deshacer: se borran de la caché la página y las constantes, y
 * la pestaña que se estaba leyendo queda muerta — recargarla da el error de red del navegador.
 *
 * Y no se puede rehacer, cosa que **la propia página sabe**: el estado en el que se cae dice *«Cuando
 * vuelva la red podrás guardar Vigo desde aquí»*. O sea que la sección ofrece con un toque una acción
 * que ella misma declara irreversible hasta que haya cobertura, en el único momento en que no la hay.
 * Es el patrón que la clase A11 nombra —borrado sin confirmación, sin deshacer y sin rastro— agravado
 * por el contexto: quien está en el agua no tiene la red con la que arreglarlo.
 *
 * El assert no prescribe el arreglo. Afirma la propiedad: **un solo toque no puede dejar el almanaque
 * inalcanzable**. Si se esconde el verbo destructivo sin red, no hay toque y el recorrido pasa; si se
 * pide confirmación, el toque abre la confirmación y la copia sigue ahí, y el recorrido pasa también.
 */

import { expect, test } from "../../fixtures/qa-bundle";

import { CLAVES_GUARDADAS, PAGINA, SECCION_SIN_RED, guardarPuerto, montarArnes } from "./utiles-pwa";

/**
 * Plazo que se le da al borrado para terminar antes de mirar qué queda.
 *
 * Es un plazo y no una espera por un texto de la pantalla a propósito: cualquier arreglo cambia lo
 * que la sección dice después del toque, y una espera atada a esa frase convertiría el arreglo en un
 * fallo por selector podrido. Lo que se afirma es el estado cuando ya no queda nada por hacer.
 */
const PLAZO_DEL_BORRADO_MS = 5_000;

test("A11 · sin red, un toque destruye la única copia del almanaque sin preguntar nada", async ({
  page,
  context,
  qa,
}) => {
  const arnes = await montarArnes(context);

  qa.step("guardar el puerto con cobertura");
  await page.goto(PAGINA);
  await guardarPuerto(page);

  qa.step("se acaba la cobertura y se vuelve a la página, que ahora la sirve la copia guardada");
  await arnes.cortar();
  await page.reload();
  await expect(page.locator("h1")).toHaveText("Vigo");

  qa.step("el botón que la sección ofrece en ese estado, tal y como lo encuentra quien lee");
  const boton = page.locator(`${SECCION_SIN_RED} [data-sin-red-accion]`);
  const etiqueta = (await boton.textContent()) ?? "";
  if ((await boton.isVisible()) && etiqueta.includes("Dejar de guardar")) {
    qa.step(`un solo toque en «${etiqueta}», sin cobertura para deshacerlo`);
    await boton.click();
    await page.waitForTimeout(PLAZO_DEL_BORRADO_MS);
  }

  qa.step("comprobar que el almanaque que se estaba leyendo sigue alcanzable");
  const claves = await page.evaluate<readonly string[]>(CLAVES_GUARDADAS);
  expect(
    claves,
    "un toque sin confirmación ha dejado la página fuera de la caché del worker, y sin red no se puede volver a guardar",
  ).toContain(PAGINA);
});
