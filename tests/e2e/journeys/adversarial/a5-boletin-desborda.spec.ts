/**
 * A5/A6 · **Una palabra larga en el boletín de AEMET rompe el ancho de la página en el móvil.**
 *
 * El boletín es prosa de un tercero que se pinta tal cual (bien: se cita, no se reescribe), y llega
 * por `textContent` dentro de un `<blockquote class="meteo__cita">` que no declara ninguna política
 * de partición de palabra. La hoja `estilos/meteo.css` no trae `overflow-wrap`, y `.meteo__cita` es
 * un `flex` en columna, donde el mínimo de contenido de un hijo es la palabra más larga.
 *
 * Basta con que un párrafo del boletín traiga un enlace —AEMET los pone: su propio boletín completo,
 * su nota legal— para que esa palabra imponga su ancho a toda la sección. Medido: 490 px de
 * `scrollWidth` en una ventana de 320, 360 y 412 px. La página entera se desplaza en horizontal, que
 * es el fallo de maquetación que el pase de T-09 gateó a 320/360 px sobre el HTML construido — y que
 * este contenido esquiva porque **no está en el HTML construido**: lo inyecta la isla en el navegador.
 *
 * El entorno de uso que manda el design brief es un teléfono; el project de Playwright es un Pixel 7.
 */

import { expect, test } from "../../fixtures/qa-bundle";

import { PAGINA, fixture, montarApi } from "./utiles";

/** Un enlace de los que AEMET pone en sus propios boletines. Es una sola palabra de 84 caracteres. */
const ENLACE_DE_AEMET =
  "https://www.aemet.es/es/eltiempo/prediccion/maritima/costera/costa-de-pontevedra-36";

/** Lo que se mide en el navegador: cuánto se desplaza la página y qué la empuja. */
interface Medida {
  readonly desplazable: number;
  readonly visible: number;
  readonly culpables: readonly string[];
}

/**
 * La medida va como **expresión en texto** y no como función: el `tsconfig` del repo deja `lib` en
 * `ES2022` a propósito —para que el dominio no pueda tocar el DOM sin darse cuenta—, así que un
 * `page.evaluate` con `document` dentro no compila. Evaluar la expresión en el navegador y tipar
 * sólo lo que vuelve mantiene el typecheck del repo intacto sin relajar su configuración.
 */
const MEDIR_DESBORDAMIENTO = `(() => ({
  desplazable: document.documentElement.scrollWidth,
  visible: document.documentElement.clientWidth,
  culpables: [...document.querySelectorAll("#meteo *")]
    .filter((nodo) => nodo.scrollWidth > nodo.clientWidth + 1)
    .map((nodo) => nodo.tagName + "." + nodo.className),
}))()`;

for (const ancho of [320, 360]) {
  test(`A5 · un enlace en el boletín no puede desbordar la página a ${ancho} px`, async ({
    page,
    qa,
  }) => {
    qa.step(`ventana de ${ancho} px (el ancho de un móvil pequeño y el de uno normal)`);
    await page.setViewportSize({ width: ancho, height: 800 });

    qa.step("AEMET emite un aviso con el enlace a su boletín completo");
    const boletin = fixture("bulletin-ok");
    const documento = (boletin["document"] as Record<string, Record<string, unknown>>[])[0]!;
    (documento["aviso"] as Record<string, unknown>)["texto"] =
      `Aviso costero en vigor. Detalle en ${ENLACE_DE_AEMET}`;
    await montarApi(page, { cuerpo: fixture("weather-ok") }, { cuerpo: boletin });
    await page.goto(PAGINA);
    await expect(page.locator("#meteo-boletin")).toContainText("Aviso costero en vigor");

    qa.step("medir si la página se desplaza en horizontal");
    const medida = await page.evaluate<Medida>(MEDIR_DESBORDAMIENTO);

    // El comportamiento CORRECTO: nada de la sección impone un ancho mayor que el de la ventana.
    expect(
      medida.desplazable,
      `la sección desborda ${medida.desplazable - medida.visible} px · ${medida.culpables.join(", ")}`,
    ).toBeLessThanOrEqual(medida.visible + 1);
  });

  /**
   * La segunda puerta del mismo hallazgo, y la que más importa de las dos: el detalle del sello
   * publica el `reason` que da el backend, y ahí puede venir la URL que falló. Es texto que **no
   * escribimos nosotros**, igual que el boletín.
   *
   * El arreglo de H-5 tocó dos selectores con la misma cura; el recorrido solo cubría uno. Un gate
   * que protege la mitad de su propio arreglo deja la otra mitad a merced de la próxima limpieza
   * de CSS, así que aquí va la que faltaba.
   */
  test(`A5b · una URL en el motivo del backend tampoco desborda a ${ancho} px`, async ({
    page,
    qa,
  }) => {
    qa.step(`ventana de ${ancho} px`);
    await page.setViewportSize({ width: ancho, height: 800 });

    qa.step("el módulo degrada con 200 y el `reason` trae la URL que falló");
    // Un 503 NO vale para este ataque: el motivo de un no-2xx lo escribe la isla y no publica el
    // cuerpo del backend. La URL solo llega a la página por el `reason` de una degradación con
    // 200, que es como el módulo de T-08 expresa que una fuente no respondió.
    const caido = fixture("weather-no-disponible");
    for (const fuente of ["marine", "forecast"] as const) {
      (caido[fuente] as Record<string, unknown>)["reason"] =
        `Open-Meteo no respondió al consultar ${ENLACE_DE_AEMET}`;
    }
    await montarApi(page, { cuerpo: caido }, { cuerpo: fixture("bulletin-ok") });
    await page.goto(PAGINA);
    await expect(page.locator("#meteo")).toContainText("Open-Meteo no respondió");

    qa.step("medir si la página se desplaza en horizontal");
    const medida = await page.evaluate<Medida>(MEDIR_DESBORDAMIENTO);

    expect(
      medida.desplazable,
      `el motivo del backend desborda ${medida.desplazable - medida.visible} px · ${medida.culpables.join(", ")}`,
    ).toBeLessThanOrEqual(medida.visible + 1);
  });
}
