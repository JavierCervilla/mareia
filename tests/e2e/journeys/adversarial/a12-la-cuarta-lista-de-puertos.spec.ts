/**
 * **A12 · la promesa vs lo entregado** — pase adversario de T-34.
 *
 * La promesa: *en las listas donde alguien elige puerto, si su predicción está medida se ve
 * **cuánto** se equivoca*. T-34 la cumple en tres: la portada, la de región y la de provincia.
 *
 * Pero el `dist/` publica **cuatro** listas de puertos, no tres. La cuarta es `404.html`, y no es
 * un residuo del build: es una página escrita a propósito para eso. Su propia cabecera dice por qué
 * existe —«quien cae aquí venía a por **un** puerto, no a por una disculpa»— y lo que ofrece son
 * «las dos salidas que sirven de verdad»: el índice de regiones y **la lista de puertos por
 * región**. Contados en el `dist/` de este commit: **153 entradas de puerto**, las mismas que la
 * portada, servidas por cualquier hosting estático ante cualquier URL que no exista, que es
 * exactamente el sitio donde cae quien llega con un enlace viejo de WhatsApp o un slug mal escrito.
 *
 * En esas 153 entradas hay **0 `<span class="indice__error">`** y **0 `<span
 * class="indice__calidad">`**: los 35 puertos medidos se presentan mudos y planos, igual que los
 * 118 sin medida. Es la misma forma exacta del hallazgo H-1 de T-14B —la señal en una lista y no en
 * las otras— una superficie más abajo, y con la lección de T-20 escrita en el propio `formato.ts`
 * del cambio: *una superficie nueva no hereda los gates de la vieja*.
 *
 * **Y el gate de T-34 no puede verlo nunca.** `error-en-listas-construido.test.ts` construye su
 * lista de páginas **desde el catálogo** (`index.html` + 12 regiones + 24 provincias = 37 ficheros)
 * y comprueba esos 37. `404.html` no sale del catálogo, así que no está en la lista y no lo estará
 * el día que alguien plante ahí una cifra: no es que el gate mire y perdone, es que no mira. Su
 * canario 1 —«el gate ha visto a los 153 puertos en las tres listas»— cuenta 153 × 3 y sale verde,
 * porque cuenta las listas que él mismo enumeró.
 *
 * El assert pide **el comportamiento correcto** y no el síntoma: en la lista de puertos que el
 * portal publica en su 404, un puerto medido dice cuánto se equivoca. El día que se arregle, este
 * recorrido pasa solo y se queda de trinquete.
 *
 * **Método.** Cero mutaciones: se lee el `404.html` construido tal cual, con el motor de JavaScript
 * apagado (la página no lleva ni una línea) y la salida a internet cerrada. Se navega a
 * `/404.html` y no a una URL inexistente porque el servidor de pruebas
 * (`tests/e2e/servidor-estatico.ts`) contesta un 404 de texto plano en vez de servir el fichero:
 * eso es del arnés, no del sitio — el artefacto que se publica y que sirve el hosting es este
 * fichero, y es el que se ataca.
 */

import { expect, test } from "../../fixtures/qa-bundle";

import { catalogoConError, PEGADO } from "./utiles-error-en-listas.ts";
import { cerrarLaSalidaAInternet } from "./utiles.ts";

/** La cuarta lista, tal y como la sirve un hosting estático. */
const CUARTA_LISTA = "/404.html";

const ENTRADAS = "li.indice__entrada";

test.use({ javaScriptEnabled: false });

test("A12 · la cuarta lista de puertos —la del 404— no dice cuánto se equivoca ningún medido", async ({
  page,
  qa,
}) => {
  // ARREGLADO (T-34). `404.astro` construye sus entradas con `estimada` y `errorM`, igual que las
  // otras tres listas, y el gate del `dist/` censa las páginas leyendo el `dist/` en vez del
  // catálogo — así una quinta lista tampoco podría nacer muda. El `test.fail()` se ha retirado y
  // este recorrido se queda de **gate permanente**: un recorrido adversario arreglado no se borra,
  // se queda vigilando, y lo que vigila es que la promesa cubra TODAS las listas y no tres.

  const puertos = catalogoConError();
  const medidos = puertos.filter((puerto) => puerto.cifra !== null);

  // Sin esto cada navegación espera la hoja de fuentes de Google, que en este contenedor no se
  // alcanza: el ataque moriría de reloj en vez de morir del assert.
  await cerrarLaSalidaAInternet(page);

  qa.step("abrir la página que el hosting sirve ante cualquier URL que no exista");
  await page.goto(CUARTA_LISTA);

  qa.step("comprobar que es una lista de puertos de verdad, y no una disculpa con un enlace");
  const filas = await page.locator(ENTRADAS).evaluateAll((entradas) =>
    entradas.map((entrada) => ({
      nombre: entrada.querySelector(".indice__nombre")?.textContent?.trim() ?? "",
      error: entrada.querySelector(".indice__error")?.textContent?.trim() ?? null,
    })),
  );
  // Si el 404 dejara de listar puertos, este ataque no probaría nada: mejor inconcluso que falso.
  expect(
    filas.length,
    "INCONCLUSO: el 404 ya no lista los 153 puertos, así que no es una lista donde se elija puerto",
  ).toBe(puertos.length);

  qa.step("pedirle a cada puerto medido la cifra que la portada sí publica de él");
  const publicadas = new Map(filas.map((fila) => [fila.nombre, fila.error] as const));
  const mudos = medidos.flatMap((puerto) => {
    const publicada = publicadas.get(puerto.nombre);
    return publicada === puerto.cifra
      ? []
      : [`${puerto.nombre}: publica ${publicada ?? "nada"} y su medida dice ${puerto.cifra ?? ""}`];
  });

  expect(
    mudos,
    `${mudos.length} de los ${medidos.length} puertos medidos se eligen aquí sin saber cuánto se ` +
      `equivocan (la portada dice de ellos, p. ej., «±4${PEGADO}cm»); primeros 5: ` +
      mudos.slice(0, 5).join(" | "),
  ).toEqual([]);
});
