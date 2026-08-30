/**
 * A4 · **Veinte filas del catálogo le atribuyen a WoRMS una frase que WoRMS no ha dicho: «WoRMS
 * acepta el nombre de la norma», sobre nombres que a WoRMS nunca se le preguntaron.**
 *
 * La promesa dice «el taxón aceptado hoy **con su procedencia comprobable**». La columna «Taxón
 * aceptado hoy» tiene tres estados posibles y sólo dos están modelados: o WoRMS acepta el nombre de
 * la norma, o WoRMS remite a otro. Falta el tercero, que son 22 de las 86 filas: **a WoRMS no se le
 * preguntó ese nombre**, porque el que escribe la norma no resuelve y fuimos nosotros quienes
 * decidimos qué preguntarle —quitarle el `spp` a un género (15 filas), corregir una errata de
 * imprenta (6)—. En 20 de esas 22 el nombre que WoRMS devolvió coincide consigo mismo, y el módulo
 * cae en la rama «acepta el nombre de la norma».
 *
 * Lo que sale publicado, medido sobre el `dist/`:
 *
 * - `Cáncer pagurus` → «WoRMS acepta el nombre de la norma.» **y**, tres líneas más abajo, en la
 *   misma celda: «Correspondencia nuestra, no de WoRMS: el género es «Cancer»: el latín no lleva la
 *   tilde que imprime la norma». La celda se contradice a sí misma: si hubo que quitarle la tilde
 *   para que resolviera, WoRMS **no** acepta el nombre de la norma.
 * - `Sepia spp` → «WoRMS acepta el nombre de la norma.» sobre un nombre —con su `spp`— que no
 *   existe en ninguna nomenclatura ni en ningún registro de WoRMS.
 * - `Thunnus aibacares`, la errata del Anexo III, → «WoRMS acepta el nombre de la norma.» sobre un
 *   binomio que no nombra a ningún animal.
 *
 * El segundo cuerpo mide la consecuencia práctica, que es la que rompe la promesa: en esas filas el
 * binomio que WoRMS **sí** devolvió (`Cancer pagurus`, `Glyptocephalus cynoglossus`, `Microstomus
 * kitt`, `Melanogrammus aeglefinus`, `Thunnus albacares`) **no aparece en ninguna parte de la
 * fila**. Se publica el `AphiaID` y el enlace, rotulados «Ficha del nombre de la norma en WoRMS»
 * —que es la atribución al revés: la ficha es del nombre corregido, no del de la norma—, y el
 * lector que quiera comprobar la fila tiene que salir del sitio para averiguar a qué taxón apunta
 * el identificador que está leyendo. Esa columna existe justamente para no tener que hacer eso.
 *
 * El gate E1 no lo ve porque mide otra cosa —que el nombre del BOE esté literal y que en las 11
 * filas con aceptado distinto se publiquen los dos—, y en estas 20 el dataset dice que el aceptado
 * **es** el nombre resuelto, así que el adaptador lo colapsa a `null` («repetir el binomio en 74
 * filas perdería las 11 que de verdad difieren») y la fila se queda sin ningún taxón escrito.
 *
 * **Qué se afirma aquí (el comportamiento correcto):** una fila sólo dice que WoRMS acepta el
 * nombre de la norma cuando a WoRMS se le preguntó **ese** nombre; y toda fila resuelta publica el
 * nombre del registro al que apunta su `AphiaID`.
 *
 * **Método.** Cero mutaciones: se lee el `dist/` servido por HTTP y se contrasta contra
 * `data/especies/catalogo.json`, que es quien dice —campo `correspondencia.consultadoComo`— con qué
 * nombre se preguntó. Ninguna lista de especies tecleada aquí.
 */

import { expect, test } from "../../fixtures/qa-bundle";

import {
  catalogoPublicado,
  celdaDelTaxon,
  filaDe,
  nombra,
  RUTA_CATALOGO,
} from "./utiles-especies";

/** La frase del módulo (`textos.ts`, `MISMO_NOMBRE`). Se cita literal: es lo que se está midiendo. */
const ACEPTA_EL_DE_LA_NORMA = "WoRMS acepta el nombre de la norma.";

test("A4 · sólo dice «WoRMS acepta el nombre de la norma» la fila cuyo nombre se preguntó", async ({
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

  qa.step("separar las filas a las que WoRMS nunca vio el nombre que escribe la norma");
  const catalogo = catalogoPublicado();
  // Se recomputa de lo que el propio dataset declara: `consultadoComo` es la cadena que viajó a la
  // API. Si difiere del nombre del BOE, WoRMS no ha visto ese nombre y no puede haberlo aceptado.
  const noSePreguntaron = catalogo.especies.filter(
    (especie) =>
      especie.taxon.resuelto &&
      especie.correspondencia.consultadoComo !== null &&
      especie.correspondencia.consultadoComo.toLowerCase() !==
        especie.nombreBoe.toLowerCase().replace(/\s+/gu, " ").trim(),
  );
  expect(
    noSePreguntaron.length,
    "todas las filas se preguntaron con su propio nombre: el ataque no está midiendo nada",
  ).toBeGreaterThan(0);

  qa.step(`${noSePreguntaron.length} filas con una consulta distinta: ¿qué dicen de WoRMS?`);
  const atribuidas = noSePreguntaron
    .filter((especie) => celdaDelTaxon(html, especie.clave).includes(ACEPTA_EL_DE_LA_NORMA))
    .map(
      (especie) =>
        `«${especie.nombreBoe}» (a WoRMS se le preguntó «${especie.correspondencia.consultadoComo}»)`,
    );

  // El comportamiento CORRECTO: la frase que cita a la fuente sólo se escribe cuando la fuente la
  // ha dicho. Una atribución falsa a WoRMS es del mismo género que una cifra inventada.
  expect(
    atribuidas,
    "filas que publican «WoRMS acepta el nombre de la norma» sobre un nombre que WoRMS nunca vio " +
      "porque fuimos nosotros quienes decidimos preguntarle otro",
  ).toEqual([]);
});

test("A4 · la fila publica el nombre del registro de WoRMS al que manda a comprobarla", async ({
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

  qa.step("las filas donde la norma escribe una errata y WoRMS devolvió otro binomio");
  const catalogo = catalogoPublicado();
  // Las erratas son el caso limpio: el nombre resuelto no es subcadena del de la norma, así que
  // «lo publica» y «no lo publica» se distinguen sin ambigüedad. En las de género (`Sepia spp` →
  // `Sepia`) el nombre resuelto vive dentro del de la norma y la medida no diría nada.
  const erratas = catalogo.especies.filter(
    (especie) =>
      especie.correspondencia.tipo === "errata_de_la_norma" &&
      especie.taxon.resuelto &&
      typeof especie.taxon.nombreCientifico === "string",
  );
  expect(erratas.length, "el catálogo no publica ninguna errata: nada que medir").toBeGreaterThan(0);

  qa.step(`${erratas.length} erratas de la norma: ¿publica la fila el taxón que WoRMS devolvió?`);
  const sinTaxon = erratas
    .filter((especie) => !nombra(filaDe(html, especie.clave), especie.taxon.nombreCientifico ?? ""))
    .map(
      (especie) =>
        `«${especie.nombreBoe}» publica el AphiaID ${String(especie.taxon.aphiaId)} y no dice que ` +
        `es el de «${especie.taxon.nombreCientifico}»`,
    );

  // El comportamiento CORRECTO: la columna se llama «Taxón aceptado hoy» y la promesa dice «con su
  // procedencia comprobable». Un identificador sin el nombre al que apunta no se puede comprobar
  // sin salir del sitio, que es lo que esta columna existe para evitar.
  expect(
    sinTaxon,
    "filas resueltas que no publican en ninguna parte el nombre del registro de WoRMS al que " +
      "apuntan su AphiaID y su enlace",
  ).toEqual([]);
});
