/**
 * A12 · **Tres especies están en el catálogo dos veces, con dos grafías de la norma, y ninguna de
 * las seis filas lo dice. La que lleva el nombre bien escrito se deja fuera un caladero entero.**
 *
 * La clave del catálogo lleva digest (`slug + sha256(literal)[:6]`) precisamente porque el BOE
 * escribe el mismo animal de dos formas, y eso está bien resuelto **como identificador**: dos filas,
 * dos claves, ninguna se come a la otra. Lo que no está resuelto es lo que ve quien lee. Medido
 * sobre el `dist/`, tres registros de WoRMS aparecen en dos filas cada uno:
 *
 * | AphiaID | Filas | Caladeros de cada una |
 * |---|---|---|
 * | 127029 | `Thunnus thynnus` · `Thunnus Thynnus` | Cantábrico + Mediterráneo · Canario |
 * | 127027 | `Thunnus albacares` · `Thunnus aibacares` | Cantábrico · Canario |
 * | 126032 | `Mugil spp` · `Mugil spps` | Cantábrico · Mediterráneo |
 *
 * Las dos filas de cada par publican **el mismo `AphiaID`**, **el mismo enlace a WoRMS** y **el
 * mismo nombre común** («Atún rojo», «Atún rojo»), y ninguna dice que la otra existe. Para el
 * lector son dos animales; para WoRMS es uno.
 *
 * La consecuencia no es estética. Quien busca el atún rojo por el nombre que la ciencia acepta
 * —`Thunnus thynnus`, en minúscula, que es el que devuelve WoRMS y el que escriben los Anexos I y
 * II— encuentra una fila que publica **dos** caladeros y ningún aviso, y de ahí se sigue que en
 * Canarias esa especie no tiene talla mínima. La tiene: 6,4 kg, Anexo III, en la fila de al lado,
 * bajo `Thunnus Thynnus` con la T mayúscula que imprimió el BOE. Lo mismo con el rabil: el catálogo
 * fija la talla canaria en la fila `Thunnus aibacares`, que además es una errata.
 *
 * El segundo cuerpo lo mide desde donde entra el lector de verdad: **el enlace de las 153 páginas de
 * puerto**, que abre el catálogo ya filtrado por el caladero de ese puerto. Con el filtro canario
 * puesto, las dos filas visibles del atún rojo y del rabil publican los nombres tal y como los
 * imprime el BOE y **en ninguna parte visible** aparece el binomio que WoRMS acepta, aunque la
 * página prometa en su cabecera «el nombre que la ciencia acepta hoy». Las filas que lo llevan están
 * ahí, con `display: none`.
 *
 * **Qué se afirma aquí (el comportamiento correcto):** si dos filas son el mismo taxón, cada una lo
 * dice —o da cuenta de todos los caladeros de ese taxón—; y con cualquier filtro puesto, todo taxón
 * visible publica el nombre que WoRMS acepta. Cualquiera de los arreglos posibles (juntar las filas,
 * cruzarlas, escribir el aceptado también cuando coincide) pone estos dos cuerpos en verde.
 *
 * **Método.** Cero mutaciones. `dist/` servido por HTTP; las parejas y los caladeros se derivan de
 * `data/especies/catalogo.json`, no se teclean. La comparación de nombres es **sensible a la caja**
 * a propósito: `Thunnus thynnus` y `Thunnus Thynnus` son dos filas del catálogo exactamente por eso.
 */

import { expect, test } from "../../fixtures/qa-bundle";

import {
  catalogoPublicado,
  filaDe,
  nombra,
  RUTA_CATALOGO,
  textoDe,
  type EspeciePublicada,
} from "./utiles-especies";

/** Los taxones que el catálogo publica en más de una fila, agrupados por su `AphiaID`. */
function repetidos(especies: readonly EspeciePublicada[]): Map<number, EspeciePublicada[]> {
  const porAphia = new Map<number, EspeciePublicada[]>();
  for (const especie of especies) {
    const aphia = especie.taxon.aphiaId;
    if (!especie.taxon.resuelto || typeof aphia !== "number") continue;
    porAphia.set(aphia, [...(porAphia.get(aphia) ?? []), especie]);
  }
  return new Map([...porAphia].filter(([, filas]) => filas.length > 1));
}

test("A12 · dos filas que son el mismo taxón lo dicen, o dan cuenta de todos sus caladeros", async ({
  page,
  qa,
}) => {
  // TRINQUETE RETIRADO · hallazgo CERRADO. Playwright avisó de que «pasó lo que se esperaba
  // que fallara» y aquí se quita el `test.fail()`: a partir de ahora este recorrido es un gate
  // permanente y se pone ROJO si alguien lo vuelve a romper. El assert canario de más abajo —el
  // que dice «el ataque no está midiendo nada»— se queda donde estaba: era lo único que
  // distinguía «falla por el defecto» de «falla por otra cosa» mientras el hallazgo estaba
  // abierto, y ahora es lo único que distingue «pasa porque está arreglado» de «pasa porque ya
  // no mide».

  qa.step("abrir el catálogo tal y como se publica");
  await page.goto(RUTA_CATALOGO);
  const html = await page.content();

  qa.step("agrupar por AphiaID: qué registros de WoRMS se publican en más de una fila");
  const catalogo = catalogoPublicado();
  const parejas = repetidos(catalogo.especies);
  expect(
    parejas.size,
    "ningún AphiaID se publica dos veces: el ataque no está midiendo nada",
  ).toBeGreaterThan(0);

  qa.step(`${parejas.size} taxones en más de una fila: ¿lo sabe quien lee una sola?`);
  const mudas: string[] = [];
  for (const [aphia, filas] of parejas) {
    // Todos los caladeros en los que la norma le fija talla a ESE taxón, sumando sus dos filas.
    const todos = new Set(filas.flatMap((especie) => especie.caladeros.map((c) => c.nombre)));
    for (const especie of filas) {
      const texto = filaDe(html, especie.clave);
      const hermanas = filas.filter((otra) => otra.clave !== especie.clave);
      // Vale cualquiera de las dos formas honestas de contarlo: nombrar a la hermana (un cruce) o
      // publicar los caladeros del taxón entero (una fusión). Lo que no vale es ninguna de las dos.
      const cruza = hermanas.some((otra) => nombra(texto, otra.nombreBoe));
      const completa = [...todos].every((nombre) => texto.includes(nombre));
      if (!cruza && !completa) {
        mudas.push(
          `AphiaID ${aphia}: «${especie.nombreBoe}» publica ` +
            `${especie.caladeros.map((c) => c.nombre).join(" + ")} y no nombra a ` +
            `«${hermanas.map((otra) => otra.nombreBoe).join("», «")}», que es el mismo taxón`,
        );
      }
    }
  }

  // El comportamiento CORRECTO: el catálogo no deja creer que hay dos especies donde hay una, ni
  // que un caladero no regula una especie porque su talla está en la fila de al lado.
  expect(
    mudas,
    "filas que publican un registro de WoRMS que otra fila también publica, sin decirlo y sin dar " +
      "cuenta de los caladeros que la otra se lleva",
  ).toEqual([]);
});

test("A12 · con el filtro de un caladero puesto, todo taxón visible publica el nombre aceptado", async ({
  page,
  qa,
}) => {
  // TRINQUETE RETIRADO · hallazgo CERRADO. Playwright avisó de que «pasó lo que se esperaba
  // que fallara» y aquí se quita el `test.fail()`: a partir de ahora este recorrido es un gate
  // permanente y se pone ROJO si alguien lo vuelve a romper. El assert canario de más abajo —el
  // que dice «el ataque no está midiendo nada»— se queda donde estaba: era lo único que
  // distinguía «falla por el defecto» de «falla por otra cosa» mientras el hallazgo estaba
  // abierto, y ahora es lo único que distingue «pasa porque está arreglado» de «pasa porque ya
  // no mide».

  const catalogo = catalogoPublicado();
  const caladeros = new Map(
    catalogo.especies.flatMap((especie) => especie.caladeros.map((c) => [c.id, c.nombre] as const)),
  );
  expect(caladeros.size, "el catálogo no publica ningún caladero").toBeGreaterThan(0);

  qa.step("abrir el catálogo entero");
  await page.goto(RUTA_CATALOGO);

  const perdidos: string[] = [];
  for (const [caladero, nombreDelCaladero] of caladeros) {
    qa.step(`pulsar el filtro «${nombreDelCaladero}», que es a donde lleva el enlace de un puerto`);
    // Se pulsa la opción en vez de escribir el ancla a mano: el ancla la compone el módulo
    // (`anclaDeCaladero`) y tecleársela aquí sería medir contra una segunda copia de ese criterio.
    await page.locator(".filtro-caladero__opcion", { hasText: nombreDelCaladero }).first().click();
    // Lo que se mide es lo que se VE: con el filtro puesto, las demás filas están en
    // `display: none` y para quien lee no existen.
    const visible = textoDe(
      (await page.locator("tbody tr:visible").allInnerTexts()).join(" · "),
    );
    for (const especie of catalogo.especies) {
      const aceptado = especie.taxon.nombreCientifico;
      if (!especie.taxon.resuelto || typeof aceptado !== "string") continue;
      if (!especie.caladeros.some((uno) => uno.id === caladero)) continue;
      if (!nombra(visible, aceptado)) {
        perdidos.push(`${caladero}: «${especie.nombreBoe}» sin «${aceptado}» a la vista`);
      }
    }
  }

  // El comportamiento CORRECTO: la cabecera promete «el nombre que la ciencia acepta hoy» y el
  // filtro no puede quitárselo al lector. Hoy, en el caladero canario, el atún rojo y el rabil se
  // publican sólo con la grafía del BOE porque el binomio aceptado vive en una fila escondida.
  expect(
    perdidos,
    "taxones que el filtro deja a la vista sin publicar en ninguna fila visible el nombre que " +
      "WoRMS acepta para ellos",
  ).toEqual([]);
});
