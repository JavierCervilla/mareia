/**
 * A11 · **«Esta tabla se guarda para leerla sin cobertura» está escrito en las 153 páginas de
 * puerto, y no es verdad en ninguna hasta que el lector guarda ese puerto como favorito.**
 *
 * La decisión del humano sobre esta sección —contra la recomendación del arquitecto— fue que sin
 * red **se muestra**, con aviso duro. El aviso es `AVISO_SIN_RED`, va horneado en el HTML porque la
 * sección no tiene JavaScript con el que encender nada, y empieza así:
 *
 * > «**Esta tabla se guarda para leerla sin cobertura**, así que puedes estar viendo una copia de
 * >  hace semanas…»
 *
 * Las dos mitades de esa frase no tienen el mismo estatuto. La segunda es una advertencia y es
 * cierta. La primera es una **afirmación sobre lo que hace la aplicación**, y es falsa por defecto:
 * el worker solo guarda la página de un puerto cuando el lector lo marca como favorito
 * (`urlsDeFavorito`), y la estrategia de navegación lo dice con todas las letras —«la copia solo se
 * refresca si ya estaba guardada, o sea, si es la página de un favorito. Al navegar por el resto
 * del sitio no se guarda nada»—. Sin copia y sin red, `laPaginaDeLaRedODeLaCopia` hace `throw` y lo
 * que queda no es la tabla con su aviso: es la pantalla de error de red del navegador.
 *
 * El riesgo es concreto y del entorno de uso que manda el design brief, un teléfono en la orilla:
 * quien lee esa frase con cobertura entiende que puede volver a la tabla cuando no la tenga —es la
 * única lectura que admite «se guarda»— y no tiene por qué relacionarla con el botón de guardar el
 * puerto, del que la frase no dice una palabra. La cifra que promete estar ahí cuando se tiene la
 * pieza en la mano es exactamente la que no está.
 *
 * Y el módulo declara `offline: cache-first` con `routes` vacías, así que su política no aporta
 * nada a esto: lo que decide si la tabla existe sin red es la caja de favoritos del core, no el
 * módulo que promete guardarse.
 *
 * **Método.** El arnés de T-12: sitio construido, worker registrado, salida a internet cerrada de
 * verdad (`context.route`, no solo la bandera). Se hace lo que hace un lector normal —abrir el
 * puerto, leer, quedarse sin cobertura— **sin** guardar el puerto, porque el aviso no pide
 * guardarlo. La aserción es del comportamiento correcto, no del síntoma: o la tabla está sin red, o
 * la página no puede afirmar que se guarda.
 */

import { expect, test } from "../../fixtures/qa-bundle";

import { PAGINA, montarArnes, workerListo } from "./utiles-pwa";

/** El aviso duro, tal y como lo hornea la sección. */
const PROMESA = "Esta tabla se guarda para leerla sin cobertura";

/** La sección de tallas, por su ancla del contrato `AppModule`. */
const SECCION = "#tallas-minimas";

test("A11 · la tabla que dice guardarse sola no está cuando se va la cobertura", async ({
  context,
  page,
  qa,
}) => {
  // TRINQUETE · Hallazgo ABIERTO (bundle cc0f8d87ecaa). Quítalo el día en que «se guarda» sea verdad
  // en la página donde está escrito, o deje de estar escrito donde no lo es.
  test.fail();

  const arnes = await montarArnes(context);

  qa.step("abrir la página de un puerto con cobertura y leer la sección de tallas");
  await page.goto(PAGINA);
  await expect(page.locator(SECCION)).toContainText("Talla mínima legal de captura");

  qa.step("comprobar que la página promete DE VERDAD que la tabla se guarda");
  // Sin esto la sonda mide su propio parche: si el aviso hubiese cambiado de texto, un rojo
  // posterior no probaría nada sobre la promesa.
  await expect(page.locator(SECCION)).toContainText(PROMESA);

  qa.step("dejar que el worker se instale, como en cualquier visita");
  await workerListo(page);

  // NO se guarda el puerto: el aviso no lo pide, no lo menciona y no lo condiciona.
  qa.step("se va la cobertura y el lector vuelve a la misma página");
  await arnes.cortar();
  await page.goto(PAGINA).catch(() => undefined);

  // El comportamiento CORRECTO: la tabla que la página dijo tener guardada está. Da igual cómo se
  // consiga —guardándola de verdad, o dejando de afirmarlo en las páginas donde no es cierto—, pero
  // «se guarda» no puede ser falso en las 153 páginas de puerto por defecto.
  await expect(
    page.locator(SECCION),
    "la página prometía que la tabla se guarda para leerla sin cobertura y sin cobertura no hay " +
      "tabla: el worker solo guarda la página de un puerto si el lector lo marcó como favorito",
  ).toContainText("Talla mínima legal de captura", { timeout: 15_000 });
});
