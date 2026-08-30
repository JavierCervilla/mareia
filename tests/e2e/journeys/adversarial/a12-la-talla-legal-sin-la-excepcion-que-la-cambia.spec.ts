/**
 * A12 · **El catálogo publica la cifra legal y se deja la excepción que la cambia; la página del
 * puerto, no. El mismo sitio dice dos cosas distintas de la misma talla.**
 *
 * La promesa de la trayectoria termina en «ninguna cifra legal se contradice consigo misma entre dos
 * páginas del mismo sitio», y la talla mínima se publica en **dos** superficies: la tabla de la
 * norma en cada una de las 153 páginas de puerto (módulo `regulations`) y la fila del catálogo
 * (módulo `species`). El gate E5 cerró la mitad del hueco —el dataset del catálogo se rehace desde
 * `tallas-minimas.json` y se diffea campo a campo, `notas` incluidas—, pero la comparación termina
 * en el JSON: entre el dataset y la página hay un contrato (`TallaDelAnexo`) que **no tiene campo
 * para las notas** y un adaptador que no las lee. Las notas están en el dato, pasan el gate, y se
 * caen en la frontera de publicación.
 *
 * Son tres cifras del RD 560/1995 y las tres se leen distinto según por qué página del sitio se
 * entre:
 *
 * | Especie | Caladero | El catálogo publica | La norma añade | La página de puerto publica |
 * |---|---|---|---|---|
 * | `Dicentrarchus labrax` | Cantábrico–NO–Cádiz | «36 cm» | (***) 44 cm en las divisiones 8a y 8b del CIEM, profesional y recreativa | las dos cosas |
 * | `Engraulis encrasicholus` | Cantábrico–NO–Cádiz | «12 cm» | (**) 10 cm en la división IX a) | las dos cosas |
 * | `Octopus vulgaris` | Mediterráneo | «1 kg de peso» | (*) no se aplica en aguas interiores ni plataforma de Illes Balears | las dos cosas, **y** si el puerto está o no dentro |
 *
 * Y el segundo cuerpo mide la forma más visible del mismo defecto: en dos de los tres casos la
 * marca de la nota **sí** viaja, dentro del literal que la fila cita («el BOE imprime «36 (***)»»),
 * así que la página publica una llamada al pie y **no publica ningún pie**. Un asterisco que no
 * lleva a ninguna parte no es un adorno: es la señal de que falta algo, puesta por la propia página,
 * y luego no hay nada.
 *
 * El caso del pulpo es el peor de los tres porque no deja rastro: el literal es «1 kg», sin marca,
 * así que quien lea la fila del catálogo no tiene forma de saber que en Baleares esa cifra no rige.
 * La misma web se lo cuenta en la página de cualquier puerto mediterráneo, con la nota entera y una
 * frase que dice si ese puerto está dentro o fuera de la excepción.
 *
 * **Qué se afirma aquí (el comportamiento correcto, no el síntoma):** una cifra con consecuencia
 * legal se publica con la excepción que la modifica, y ninguna marca de nota se publica sin su nota.
 * El día que el catálogo publique las notas, estos dos cuerpos pasan solos.
 *
 * **Método.** Cero mutaciones: se lee el `dist/` **servido por HTTP** y se contrasta contra los dos
 * datasets commiteados. Las excepciones no se teclean aquí —salen de `tallas-minimas.json`—, así que
 * el día que el BOE cambie una nota este recorrido sigue midiendo lo que dice medir.
 */

import { expect, test } from "../../fixtures/qa-bundle";

import {
  catalogoPublicado,
  esUnaCifra,
  filaDe,
  notasDeLaNorma,
  RUTA_CATALOGO,
  textoDe,
} from "./utiles-especies";

test("A12 · toda cifra legal del catálogo publica la excepción que la norma le cuelga", async ({
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
  const leido = textoDe(html);

  qa.step("buscar en la norma qué cifras del catálogo llevan una excepción al pie");
  const notas = notasDeLaNorma();
  const catalogo = catalogoPublicado();

  /** Cada cifra publicada que la norma matiza con una nota, con el texto de esa nota. */
  const conExcepcion: { fila: string; clave: string; caladero: string; nota: string }[] = [];
  for (const especie of catalogo.especies) {
    for (const caladero of especie.caladeros) {
      for (const talla of caladero.tallas) {
        // Sólo las que publican una magnitud. Un «(*) Talla por determinar» ya se dice con la
        // frase «La norma no fija talla», así que exigir ahí el literal de la nota sería ruido
        // que taparía los tres casos en los que la nota cambia un número.
        if (!esUnaCifra(talla.talla)) continue;
        for (const marca of talla.notas) {
          const texto = notas.get(caladero.id)?.get(marca);
          if (texto === undefined) continue;
          conExcepcion.push({
            fila: `${especie.nombreBoe} · ${caladero.nombre} · «${talla.textoOriginal}»`,
            clave: especie.clave,
            caladero: caladero.nombre,
            nota: texto,
          });
        }
      }
    }
  }
  expect(
    conExcepcion.length,
    "ninguna cifra del catálogo lleva excepción en la norma: el ataque no está midiendo nada",
  ).toBeGreaterThan(0);

  qa.step(`${conExcepcion.length} cifras con excepción: ¿la publica el catálogo?`);
  const mudas = conExcepcion
    .filter((caso) => !filaDe(html, caso.clave).includes(caso.nota) && !leido.includes(caso.nota))
    .map((caso) => `${caso.fila} → falta «${caso.nota.slice(0, 90)}…»`);

  // El comportamiento CORRECTO: una cifra legal se publica con lo que la modifica. La página de
  // puerto ya lo hace; ésta publica el número solo y contradice a la otra.
  expect(
    mudas,
    "cifras legales publicadas en el catálogo sin la excepción que la norma les pone, mientras la " +
      "página de puerto de esos mismos caladeros sí la publica",
  ).toEqual([]);
});

test("A12 · ninguna marca de nota se publica sin la nota a la que llama", async ({ page, qa }) => {
  // TRINQUETE RETIRADO · hallazgo CERRADO. Playwright avisó de que «pasó lo que se esperaba
  // que fallara» y aquí se quita el `test.fail()`: a partir de ahora este recorrido es un gate
  // permanente y se pone ROJO si alguien lo vuelve a romper. El assert canario de más abajo —el
  // que dice «el ataque no está midiendo nada»— se queda donde estaba: era lo único que
  // distinguía «falla por el defecto» de «falla por otra cosa» mientras el hallazgo estaba
  // abierto, y ahora es lo único que distingue «pasa porque está arreglado» de «pasa porque ya
  // no mide».

  qa.step("abrir el catálogo tal y como se publica");
  await page.goto(RUTA_CATALOGO);
  const leido = textoDe(await page.content());

  qa.step("recoger las marcas que la página imprime dentro del literal del BOE");
  const notas = notasDeLaNorma();
  const catalogo = catalogoPublicado();
  const marcas = new Map<string, string>();
  for (const especie of catalogo.especies) {
    for (const caladero of especie.caladeros) {
      for (const talla of caladero.tallas) {
        // Las marcas que cuelgan de una talla sin cifra se dejan fuera por el mismo motivo que en
        // el cuerpo de arriba: «(*) Talla por determinar» ya se dice con «La norma no fija talla»,
        // y contarla aquí taparía las dos marcas que sí llaman a una excepción de un número.
        if (!esUnaCifra(talla.talla)) continue;
        for (const marca of talla.notas) {
          const texto = notas.get(caladero.id)?.get(marca);
          // La marca sólo cuenta si la página la imprime: es el literal citado de la celda del
          // BOE, y lo cita entero («el BOE imprime «36 (***)»»).
          if (texto !== undefined && leido.includes(`el BOE imprime «${talla.textoOriginal}»`)) {
            if (talla.textoOriginal.includes(marca)) marcas.set(marca, texto);
          }
        }
      }
    }
  }
  expect(
    [...marcas.keys()].length,
    "la página no imprime ninguna marca de nota: el ataque no está midiendo nada",
  ).toBeGreaterThan(0);

  qa.step(`${marcas.size} marcas impresas: ¿publica la página el pie de cada una?`);
  const huerfanas = [...marcas.entries()]
    .filter(([, texto]) => !leido.includes(texto))
    .map(([marca, texto]) => `${marca} → «${texto.slice(0, 90)}…»`);

  // El comportamiento CORRECTO: si la página imprime la llamada, publica el pie. Lo contrario es
  // decirle al lector «aquí falta algo» y no decirle qué.
  expect(
    huerfanas,
    "marcas de nota impresas en el catálogo sin ningún pie que las explique en toda la página",
  ).toEqual([]);
});
