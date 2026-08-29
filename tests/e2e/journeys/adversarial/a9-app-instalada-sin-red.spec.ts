/**
 * A9 · **La app instalada no abre sin red: su puerta de entrada no se guarda nunca.**
 *
 * T-12 no publica solo un service worker: publica un `manifest.webmanifest` con
 * `display: minimal-ui`, su icono y su `start_url`. Eso es una invitación explícita a **instalar**
 * Mareia en la pantalla de inicio — y quien la acepta deja de tener barra de direcciones y de
 * historial a mano: a partir de ese momento **la única puerta de entrada es `start_url`**.
 *
 * `start_url` es `/`, y `/` no se guarda jamás. Lo que se guarda al marcar un favorito es la página
 * del puerto, sus constantes y sus assets (`pwa/precacheo.ts`); la portada y el índice geográfico no
 * están en esa lista y el worker tiene prohibido guardar lo que nadie ha pedido. Así que el icono de
 * la pantalla de inicio, sin cobertura, abre **el error de red del navegador**: ni el almanaque
 * guardado, ni una página que diga qué hay guardado, ni una salida. Con el puerto favorito intacto a
 * un toque de distancia y sin forma de llegar a él.
 *
 * Es el escenario de uso que manda el design brief —un teléfono a pleno sol en la playa— y el único
 * en el que instalar la PWA se paga: quien la instaló lo hizo justamente para esto.
 *
 * El `start_url` se lee **del manifiesto publicado**, no de una constante copiada aquí: lo que se
 * ataca es el artefacto que se sirve.
 *
 * El assert es el mínimo no prescriptivo: la puerta de entrada de la app instalada tiene que llevar
 * a algo de Mareia. Da igual cómo se consiga —guardar la portada con el primer favorito, servir una
 * página de respaldo, o apuntar `start_url` a algo que sí se guarda—: cualquiera de las tres pone
 * este recorrido en verde.
 */

import { expect, test } from "../../fixtures/qa-bundle";

import { PAGINA, guardarPuerto, montarArnes } from "./utiles-pwa";

test("A9 · con un puerto guardado, el icono de la pantalla de inicio no abre nada sin cobertura", async ({
  page,
  context,
  qa,
}) => {
  const arnes = await montarArnes(context);

  qa.step("leer el start_url del manifiesto publicado, que es lo que abre la app instalada");
  const manifiesto = await (await page.request.get("/manifest.webmanifest")).json();
  const arranque = manifiesto["start_url"] as string;

  qa.step(`entrar por ${arranque} con cobertura y llegar al puerto, como hace cualquiera`);
  await page.goto(arranque);
  await page.goto(PAGINA);

  qa.step("guardar el puerto: a partir de aquí el almanaque está en el teléfono");
  await guardarPuerto(page);

  qa.step("al día siguiente, en la playa y sin cobertura, se toca el icono de la app");
  await arnes.cortar();
  const fallo = await page.goto(arranque).then(
    () => undefined,
    (error: Error) => error.message.split("\n")[0],
  );

  qa.step("comprobar que la app instalada abre algo de Mareia y no el error del navegador");
  expect(
    fallo,
    `el arranque de la app instalada (${arranque}) no lleva a ninguna parte sin red`,
  ).toBeUndefined();
  await expect(page.locator("body")).toContainText("Mareia");
});
