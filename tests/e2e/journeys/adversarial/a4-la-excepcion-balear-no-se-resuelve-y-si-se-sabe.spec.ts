/**
 * A4 · **En los 17 puertos de Balears se publica la talla del pulpo con el mismo aspecto que donde
 * sí aplica, y la razón que la página da para no resolverlo no es cierta en este caso.**
 *
 * La promesa de T-19 dice que en la página de un puerto se lee la talla mínima **que aplica a ese
 * puerto**. La sección tiene una excepción de las que cambian esa respuesta entera, y no por unos
 * centímetros sino por completo — la nota `(*)` del Anexo II, tal cual la imprime el BOE:
 *
 * > «La talla del pulpo (Octopus vulgaris) recogida en la presente tabla **no es de aplicación** en
 * >  las aguas interiores y la plataforma continental de la Comunidad Autónoma de las Illes
 * >  Balears.»
 *
 * De los 80 puertos del caladero mediterráneo, **17 son de Illes Balears**. En sus páginas se
 * publica «Pulpo · 1 kg de peso» exactamente igual que en Valencia: medido en el `dist/`, el `<tr>`
 * del pulpo de Palma de Mallorca y el de Ibiza son **idénticos byte a byte** al de Valencia.
 *
 * La sección explica por qué no resuelve las excepciones, y ahí está el defecto:
 *
 * > «No se resuelve por puerto porque eso exige saber en qué división del CIEM cae cada dársena, y
 * >  asignarla mal daría un número seguro y equivocado.»
 *
 * Para la nota de la lubina eso es verdad (divisiones 8a y 8b del CIEM: geometría). Para ésta no:
 * el criterio de la nota es **administrativo**, la comunidad autónoma, y el portal ya sabe la de
 * cada puerto — está en `data/geo/ports.json`, se usa para construir la propia URL en la que el
 * lector está (`/mareas/illes-balears/illes-balears/palma-de-mallorca/`) y es el mismo dato con el
 * que el pipeline decide que a ese puerto le toca el Anexo II. O sea que la única de las tres
 * excepciones que se puede resolver con lo que ya hay en el repo es la que se deja sin resolver,
 * con una explicación que describe a otra.
 *
 * El resultado para quien lee en Palma es una cifra presentada como su talla mínima legal cuya
 * propia nota dice que ahí no rige. Está escrito debajo —eso el gate de T-19 lo asegura— pero el
 * trabajo de decidir si le aplica se le pasa al lector, que es exactamente lo que la sección dice
 * que no quiere hacer con las cifras.
 *
 * **Método.** Sin tocar nada: se abren las dos páginas del sitio construido y se compara la celda.
 * La aserción es del comportamiento correcto, no del síntoma: da igual cómo se resuelva —marcarla
 * como no aplicable, retirar la fila, decirlo con palabras—, lo que no puede es que la página de un
 * puerto balear y la de uno peninsular digan lo mismo sobre una talla que solo rige en uno.
 */

import type { Page } from "@playwright/test";

import { expect, test } from "../../fixtures/qa-bundle";

/** Un puerto de cada lado de la excepción, los dos del caladero mediterráneo (Anexo II). */
const PALMA = "/mareas/illes-balears/illes-balears/palma-de-mallorca/";
const VALENCIA = "/mareas/comunitat-valenciana/valencia/valencia/";

/** La celda de la talla del pulpo: la cifra, su nota y el literal del BOE. */
const CELDA_DEL_PULPO = '#tallas-minimas tr[data-especie="pulpo"] td';

/** Lo que se lee en la celda de la talla del pulpo de un puerto. */
async function celdaDelPulpo(page: Page, ruta: string): Promise<string> {
  await page.goto(ruta);
  const celda = page.locator(CELDA_DEL_PULPO).first();
  await expect(celda, `INCONCLUSO: ${ruta} no publica la fila del pulpo`).toBeVisible();
  return ((await celda.textContent()) ?? "").replace(/\s+/gu, " ").trim();
}

test("A4 · en un puerto balear la talla del pulpo no puede leerse igual que en uno peninsular", async ({
  page,
  qa,
}) => {
  // TRINQUETE · Hallazgo ABIERTO (bundle 357b20089027). Quítalo el día en que un puerto balear deje
  // de leer la talla del pulpo igual que uno peninsular.
  test.fail();

  qa.step("abrir Valencia, un puerto del Anexo II donde la talla del pulpo SÍ rige");
  const valencia = await celdaDelPulpo(page, VALENCIA);
  expect(valencia, "INCONCLUSO: la celda de Valencia no trae la cifra").toContain("1");

  qa.step("abrir Palma de Mallorca, uno de los 17 puertos que la nota excepciona");
  const palma = await celdaDelPulpo(page, PALMA);

  qa.step("comprobar que la nota que excepciona está de verdad ahí (el gate de T-19 lo asegura)");
  expect(palma, "INCONCLUSO: la nota balear no está en la fila").toContain("Illes Balears");

  // El comportamiento CORRECTO: el portal sabe que Palma es de Illes Balears —lo dice la URL— y la
  // nota dice que ahí esta talla no se aplica. La página no puede publicarla igual que donde sí.
  expect(
    palma,
    "la página de un puerto balear publica la talla del pulpo con exactamente el mismo texto que " +
      "la de Valencia, aunque su propia nota diga que en Balears no es de aplicación",
  ).not.toBe(valencia);
});
