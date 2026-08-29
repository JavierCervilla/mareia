/**
 * A4 · **El fail-safe de la poda no evita el borrado: lo aplaza un paso.**
 *
 * La promesa que se ataca es la quinta de T-12: *guardar o borrar un favorito no le quita los
 * assets a otro, ni siquiera cruzando un despliegue*.
 *
 * El worker distingue «no sé qué hay guardado» (registro ausente o ilegible → no podar) de «no hay
 * nada guardado» (`{}` → podar), y esa distinción está bien puesta: con el registro roto, guardar un
 * segundo puerto no toca los ficheros del primero. Lo que no se sostiene es lo que ese mismo camino
 * **escribe**: `guardar()` con el registro ilegible deja `{ <slug>: urls }`, un registro con un solo
 * puerto que ya no se distingue en nada de uno completo. El favorito que sí estaba guardado ha
 * desaparecido del censo sin que nadie lo borre.
 *
 * A partir de ahí basta el gesto más normal del mundo —**dejar de guardar el puerto que se acaba de
 * guardar**— para que la poda actúe sobre ese censo mutilado: `resto` sale `{}`, que es un vacío «de
 * verdad», y se borra todo lo que hay bajo `/_astro/`. El primer favorito conserva su página y su
 * JSON de constantes y se queda **sin un solo fichero**: se abre sin estilos, sin la isla meteo y
 * sin el trozo que calcula otro día, que es la promesa entera. Sin un error por ninguna parte.
 *
 * La propiedad que hace segura la poda no es «¿el registro es legible?» sino «**¿es completo?**», y
 * esa no viaja con el dato.
 *
 * Se afirma sobre **las claves de la caché del worker**: la caché HTTP de Chromium sigue sirviendo
 * los ficheros ya podados, así que un recorrido que mire estilos o visibilidad pasa en verde con el
 * favorito destruido.
 */

import { expect, test } from "../../fixtures/qa-bundle";

import {
  CLAVES_GUARDADAS,
  CORROMPER_REGISTRO,
  PAGINA,
  PAGINA_SEGUNDA,
  SECCION_SIN_RED,
  guardarPuerto,
  montarArnes,
} from "./utiles-pwa";

/** Los ficheros con hash que hay ahora mismo en la caché de páginas. */
async function assetsGuardados(
  page: import("@playwright/test").Page,
): Promise<readonly string[]> {
  const claves = await page.evaluate<readonly string[]>(CLAVES_GUARDADAS);
  return claves.filter((camino) => camino.startsWith("/_astro/"));
}

test("A4 · el registro que escribe el fail-safe deja al otro favorito sin un solo fichero", async ({
  page,
  context,
  qa,
}) => {
  test.fail(); // Hallazgo ABIERTO (bundle bb2e9b141d2e). Quítalo cuando la poda exija un censo completo.
  const arnes = await montarArnes(context);

  qa.step("guardar Vigo con cobertura: es el favorito que hay que proteger");
  await page.goto(PAGINA);
  await guardarPuerto(page);
  const deVigo = await assetsGuardados(page);
  expect(deVigo.length, "Vigo tiene que haber guardado sus ficheros").toBeGreaterThan(3);

  qa.step("el registro se queda ilegible (escritura a medias por cuota, o un worker anterior)");
  await page.evaluate<void>(CORROMPER_REGISTRO);

  qa.step("llega el rebuild diario y se guarda un segundo puerto: aquí el fail-safe NO poda…");
  arnes.otroBuildEn(PAGINA_SEGUNDA);
  await page.goto(PAGINA_SEGUNDA);
  await guardarPuerto(page);

  qa.step("…pero deja escrito un registro de un solo puerto que afirma ser el censo completo");
  qa.step("y ahora se deja de guardar ese mismo puerto, que es cuando la poda se lo cree");
  await page.locator(`${SECCION_SIN_RED} [data-sin-red-accion]`).click();
  await expect(page.locator(`${SECCION_SIN_RED} .sin-red__titular`)).toContainText(
    "no está guardado en este dispositivo",
    { timeout: 20_000 },
  );

  qa.step("comprobar que el favorito de Vigo conserva los ficheros con los que se pinta");
  const quedan = await assetsGuardados(page);
  for (const necesario of deVigo) {
    expect(quedan, `el favorito de Vigo se ha quedado sin ${necesario}`).toContain(necesario);
  }
});
