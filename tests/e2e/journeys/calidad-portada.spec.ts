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

test.use({ javaScriptEnabled: false });

test("la portada dice la calidad de cada puerto y se filtra por ella sin JavaScript", async ({
  page,
  qa,
}) => {
  const { medidos, estimados } = catalogo();

  qa.step("abrir la portada con el motor de JavaScript apagado");
  await page.goto("/");
  const todas = await page.locator(ENTRADAS_VISIBLES).allTextContents();
  expect(todas.length, "la portada no lista el catálogo entero").toBe(
    medidos.length + estimados.length,
  );

  // La forma de fallar de esto no es «no aparece»: es que aparezca en 148 de 153. Se listan las
  // entradas mudas por su nombre, que es lo que hace falta para arreglarlo.
  const mudas = todas.filter((entrada) => !/(?:medida|estimada)$/u.test(entrada.trim()));
  expect(mudas, `entradas de la portada sin decir su calidad: ${mudas.join(" | ")}`).toEqual([]);

  qa.step("filtrar «solo los medidos»: quedan los del dataset y ni un estimado a la vista");
  await page.locator('label[for="calidad-medidos"]').click();
  const visiblesMedidos = await page.locator(ENTRADAS_VISIBLES).allTextContents();
  const coladas = visiblesMedidos.filter((entrada) => entrada.endsWith("estimada"));
  expect(coladas, `el filtro dejó pasar puertos estimados: ${coladas.join(" | ")}`).toEqual([]);
  expect(visiblesMedidos.length, "el filtro no enseña todos los puertos medidos").toBe(
    medidos.length,
  );

  qa.step("filtrar «solo los estimados»: el complemento exacto, sin ningún medido");
  await page.locator('label[for="calidad-estimados"]').click();
  const visiblesEstimados = await page.locator(ENTRADAS_VISIBLES).allTextContents();
  const perdidas = visiblesEstimados.filter((entrada) => entrada.endsWith("medida"));
  expect(perdidas, `el filtro dejó pasar puertos medidos: ${perdidas.join(" | ")}`).toEqual([]);
  expect(visiblesEstimados.length).toBe(estimados.length);

  // Ninguna región se queda con su rótulo sobre una lista vacía: el bloque se va con sus puertos.
  const regionesVacias = await page
    .locator(`${REGIONES_VISIBLES}:not(:has(${ENTRADAS_VISIBLES}))`)
    .allTextContents();
  expect(
    regionesVacias,
    `regiones con el rótulo puesto y ningún puerto debajo: ${regionesVacias.join(" | ")}`,
  ).toEqual([]);

  qa.step("volver a «todos los puertos»: el catálogo entero otra vez");
  await page.locator('label[for="calidad-todos"]').click();
  expect(await page.locator(ENTRADAS_VISIBLES).count()).toBe(todas.length);
});
