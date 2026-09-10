/**
 * Recorrido de la calidad en la portada (T-14B), **con el JavaScript apagado**.
 *
 * Lo que aquí se comprueba y no puede comprobar un test que lea el HTML de `dist/`: que la señal se
 * **ve** y que el filtro **funciona** en un navegador de verdad al que se le ha desactivado el
 * motor de JavaScript (`javaScriptEnabled: false`). La portada no sirve un solo script —eso lo
 * vigila el pase adversario de T-09—, así que el filtro es CSS puro: tres radios ocultos a la vista
 * y reglas de hermano. Apagar el JS es la forma de demostrarlo en vez de afirmarlo.
 *
 * **Las cuentas se recalculan del dataset** (`data/geo/ports.json` + `data/stations/<id>.json`) en
 * cada corrida, no se escriben a mano: el día que un puerto gane mareógrafo, este recorrido exige la
 * cifra nueva sin que nadie se acuerde de subirla. Y cuando falla, **nombra el puerto** que se coló
 * o que se quedó sin señal: un rojo que dice «esperaba 33, había 34» obliga a investigar; uno que
 * dice «Adra … estimada» ya ha hecho el trabajo.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/qa-bundle";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

interface PuertoDelCatalogo {
  readonly slug: string;
  readonly name: string;
  readonly stationFile: string;
}

/** El catálogo y la calidad de cada puerto, leídos del dataset que construyó el sitio. */
function catalogo(): { medidos: readonly string[]; estimados: readonly string[] } {
  const { ports } = JSON.parse(
    readFileSync(join(RAIZ, "data", "geo", "ports.json"), "utf8"),
  ) as { ports: readonly PuertoDelCatalogo[] };
  const medidos: string[] = [];
  const estimados: string[] = [];
  for (const puerto of ports) {
    const estacion = JSON.parse(
      readFileSync(join(RAIZ, "data", "stations", puerto.stationFile), "utf8"),
    ) as { quality: { estimated: boolean } };
    (estacion.quality.estimated ? estimados : medidos).push(puerto.name);
  }
  return { medidos, estimados };
}

const ENTRADAS_VISIBLES = "li.indice__entrada:visible";
const REGIONES_VISIBLES = "section.grupo:visible";

/**
 * Lo que cada entrada visible dice de sí misma: su texto entero y **la palabra de calidad tal como
 * la publica su propio `<span>`**.
 *
 * La palabra se lee del elemento y no del final del texto de la fila. Este recorrido afirma que la
 * calidad *se ve* y que el filtro *funciona*, no que la palabra sea lo último que se lee: cuando
 * T-34 añadió el error medido detrás («Vigo · Pontevedra · medida · ±6 cm») los tres `endsWith` se
 * pusieron rojos sin que la promesa se hubiera movido. Pinchar el `<span>` es **más estrecho**, no
 * menos —exige que la palabra viaje en el elemento que le da sentido— y no se lo lleva por delante
 * lo próximo que se añada a la fila.
 */
async function entradasVisibles(
  page: Page,
): Promise<readonly { texto: string; calidad: string | null }[]> {
  return page.locator(ENTRADAS_VISIBLES).evaluateAll((entradas) =>
    entradas.map((entrada) => ({
      texto: (entrada.textContent ?? "").trim(),
      calidad: entrada.querySelector(".indice__calidad")?.textContent?.trim() ?? null,
    })),
  );
}

test.use({ javaScriptEnabled: false });

/**
 * Ninguna región se queda con su rótulo sobre una lista vacía: el bloque se va con sus puertos.
 *
 * Se comprueba en **los dos** estados del filtro, y no en uno, porque la regla CSS que lo sostiene
 * también tiene dos mitades —`[data-medidos="0"]` y `[data-estimados="0"]`— y cada una tapa un caso
 * real del catálogo: Ceuta tiene 1 puerto y 0 medidos, Melilla 1 y 0 estimados. Comprobando solo
 * «estimados» se podía borrar la mitad de «medidos» y el recorrido seguía en verde con Ceuta
 * enseñando su encabezado sobre la nada. Lo reprodujo el verificador borrando media regla, y por eso
 * este ayudante existe: un gate que pasa en verde sobre el defecto que motivó su propio código no es
 * un gate.
 */
async function sinRegionesHuerfanas(page: Page, estado: string): Promise<void> {
  const vacias = await page
    .locator(`${REGIONES_VISIBLES}:not(:has(${ENTRADAS_VISIBLES}))`)
    .allTextContents();
  expect(
    vacias,
    `con el filtro en «${estado}», regiones con el rótulo puesto y ningún puerto debajo: ${vacias.join(" | ")}`,
  ).toEqual([]);
}

test("la portada dice la calidad de cada puerto y se filtra por ella sin JavaScript", async ({
  page,
  qa,
}) => {
  const { medidos, estimados } = catalogo();

  qa.step("abrir la portada con el motor de JavaScript apagado");
  await page.goto("/");
  const todas = await entradasVisibles(page);
  expect(todas.length, "la portada no lista el catálogo entero").toBe(
    medidos.length + estimados.length,
  );

  // La forma de fallar de esto no es «no aparece»: es que aparezca en 148 de 153. Se listan las
  // entradas mudas por su nombre, que es lo que hace falta para arreglarlo.
  const mudas = todas
    .filter((entrada) => entrada.calidad !== "medida" && entrada.calidad !== "estimada")
    .map((entrada) => entrada.texto);
  expect(mudas, `entradas de la portada sin decir su calidad: ${mudas.join(" | ")}`).toEqual([]);

  qa.step("filtrar «solo los medidos»: quedan los del dataset y ni un estimado a la vista");
  await page.locator('label[for="calidad-medidos"]').click();
  const visiblesMedidos = await entradasVisibles(page);
  const coladas = visiblesMedidos
    .filter((entrada) => entrada.calidad === "estimada")
    .map((entrada) => entrada.texto);
  expect(coladas, `el filtro dejó pasar puertos estimados: ${coladas.join(" | ")}`).toEqual([]);
  expect(visiblesMedidos.length, "el filtro no enseña todos los puertos medidos").toBe(
    medidos.length,
  );
  await sinRegionesHuerfanas(page, "medidos");

  qa.step("filtrar «solo los estimados»: el complemento exacto, sin ningún medido");
  await page.locator('label[for="calidad-estimados"]').click();
  const visiblesEstimados = await entradasVisibles(page);
  const perdidas = visiblesEstimados
    .filter((entrada) => entrada.calidad === "medida")
    .map((entrada) => entrada.texto);
  expect(perdidas, `el filtro dejó pasar puertos medidos: ${perdidas.join(" | ")}`).toEqual([]);
  expect(visiblesEstimados.length).toBe(estimados.length);

  await sinRegionesHuerfanas(page, "estimados");

  qa.step("volver a «todos los puertos»: el catálogo entero otra vez");
  await page.locator('label[for="calidad-todos"]').click();
  expect(await page.locator(ENTRADAS_VISIBLES).count()).toBe(todas.length);
});
