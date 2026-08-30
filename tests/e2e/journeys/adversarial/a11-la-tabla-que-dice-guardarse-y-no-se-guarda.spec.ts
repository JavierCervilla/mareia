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
 * puerto, leer, quedarse sin cobertura— **sin** guardar el puerto, porque el aviso no pedía
 * guardarlo. La aserción es del comportamiento correcto, no del síntoma: o la tabla está sin red, o
 * la página no puede afirmar que se guarda.
 *
 * ---
 *
 * **ARREGLADO cambiando el texto, no el precacheo.** Precachear las 153 páginas es un coste que
 * nadie ha pedido y el modelo de favoritos lo rechaza a propósito; lo que estaba mal era la frase.
 * El aviso ahora empieza por su condición («Si guardas este puerto…»), así que este recorrido se
 * queda como **gate permanente** y mide las dos mitades de esa condición, que es lo que impide que
 * vuelva a colarse una afirmación sin comprobar:
 *
 * 1. la página **no** afirma sin condición que la tabla se guarda, y **sí** dice de qué depende;
 * 2. cumplida la condición —el lector guarda el puerto— la tabla **está** sin cobertura.
 *
 * El caso que dio el hallazgo (no guardar y quedarse sin red) sigue midiéndose, pero ya como lo que
 * es: el comportamiento que el aviso describe, no el que contradice.
 */

import { expect, test } from "../../fixtures/qa-bundle";

import { guardarPuerto, PAGINA, montarArnes, workerListo } from "./utiles-pwa";

/** La afirmación incondicional que el hallazgo cazó: no puede volver a estar en la página. */
const PROMESA_SIN_CONDICION = "Esta tabla se guarda para leerla sin cobertura";

/** La condición de la que depende de verdad que la tabla esté sin red. */
const CONDICION = "Si guardas este puerto";

/** La sección de tallas, por su ancla del contrato `AppModule`. */
const SECCION = "#tallas-minimas";

test("A11 · lo que la sección dice de guardarse tiene que ser lo que pasa al guardarla", async ({
  context,
  page,
  qa,
}) => {
  // TRINQUETE · Hallazgo ARREGLADO (bundle cc0f8d87ecaa). La cura es `AVISO_SIN_RED` en
  // `packages/modules/regulations/src/textos.ts`: la frase empieza por su condición. Este
  // recorrido se queda como gate permanente y ata el texto a la condición real: no se borra.
  const arnes = await montarArnes(context);

  qa.step("abrir la página de un puerto con cobertura y leer la sección de tallas");
  await page.goto(PAGINA);
  await expect(page.locator(SECCION)).toContainText("Talla mínima legal de captura");

  qa.step("la sección NO puede afirmar sin condición que la tabla se guarda");
  // Es la mitad del arreglo, y la que se pierde primero: cualquiera puede «simplificar» la frase
  // en un commit de estilo y volver a publicar la afirmación falsa en las 153 páginas.
  await expect(page.locator(SECCION)).not.toContainText(PROMESA_SIN_CONDICION);

  qa.step("y sí tiene que decir de qué depende: guardar este puerto");
  await expect(page.locator(SECCION)).toContainText(CONDICION);

  qa.step("dejar que el worker se instale, como en cualquier visita");
  await workerListo(page);

  qa.step("cumplir la condición: el lector guarda el puerto");
  await guardarPuerto(page);

  qa.step("se va la cobertura y el lector vuelve a la misma página");
  await arnes.cortar();
  await page.goto(PAGINA).catch(() => undefined);

  // El comportamiento CORRECTO: cumplida la condición que la sección enuncia, la tabla está. Si un
  // día el favorito dejara de guardar la página del puerto, la frase volvería a ser falsa —esta
  // vez por el otro lado— y esto se pondría rojo.
  await expect(
    page.locator(SECCION),
    "la sección dice que si guardas este puerto la tabla se puede leer sin cobertura, y guardado " +
      "el puerto y cortada la red no hay tabla",
  ).toContainText("Talla mínima legal de captura", { timeout: 15_000 });
});
