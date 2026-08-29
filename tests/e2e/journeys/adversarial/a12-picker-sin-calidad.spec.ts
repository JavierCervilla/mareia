/**
 * **A12 · la promesa vs lo entregado** — pase adversario de T-14B.
 *
 * La promesa que se ataca, en una línea: *en los sitios donde alguien **elige** un puerto, la
 * calidad de su predicción está a la vista*.
 *
 * T-14B la cumple en la portada y en `GET /v1/ports`. Pero el portal tiene **tres** listas de
 * puertos, no una, y las otras dos son las de la ruta que la propia portada llama canónica: su
 * primer enlace es «Ver todas las regiones» → `/mareas/` → `/mareas/<region>/` (que lista los
 * puertos de la región, agrupados por provincia) → `/mareas/<region>/<provincia>/` (que los lista
 * otra vez). En esas dos, los 153 puertos vuelven a presentarse planos: sin «medida», sin
 * «estimada» y sin `data-estimado`.
 *
 * O sea, el último clic antes de elegir puerto —el que se da en la página de la provincia— se sigue
 * dando a ciegas, que es exactamente el problema que la trayectoria vino a quitar. No es un fallo
 * de implementación de lo que se implementó: es alcance que se quedó fuera, y por eso el ataque
 * afirma **el comportamiento correcto** (la misma señal, en cualquier lista de puertos) y no el
 * síntoma.
 *
 * Se ataca con el motor de JavaScript apagado y contra el HTML de `dist/`, que es el artefacto que
 * se publica.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "../../fixtures/qa-bundle";
import { cerrarLaSalidaAInternet } from "./utiles.ts";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

interface PuertoDelCatalogo {
  readonly slug: string;
  readonly name: string;
  readonly province: { readonly slug: string };
  readonly region: { readonly slug: string };
  readonly stationFile: string;
}

/** Cada puerto del dataset con la palabra que la portada ya publica de él. */
function catalogo(): readonly {
  nombre: string;
  region: string;
  provincia: string;
  palabra: "medida" | "estimada";
}[] {
  const { ports } = JSON.parse(
    readFileSync(join(RAIZ, "data", "geo", "ports.json"), "utf8"),
  ) as { ports: readonly PuertoDelCatalogo[] };
  return ports.map((puerto) => {
    const estacion = JSON.parse(
      readFileSync(join(RAIZ, "data", "stations", puerto.stationFile), "utf8"),
    ) as { quality: { estimated: boolean } };
    return {
      nombre: puerto.name,
      region: puerto.region.slug,
      provincia: puerto.province.slug,
      palabra: estacion.quality.estimated ? ("estimada" as const) : ("medida" as const),
    };
  });
}

const ENTRADAS = "li.indice__entrada";

test.use({ javaScriptEnabled: false });

test("A12 · la lista de puertos de una región dice la calidad de cada uno, como la portada", async ({
  page,
  qa,
}) => {
  test.fail(); // hallazgo ABIERTO (ledger 2026-08-29). Quitar cuando la señal alcance estas listas.
  // Doce navegaciones a páginas estáticas: sobra tiempo, pero el reloj por defecto (30 s) se queda
  // corto y un test adversario que caduca es un `test.fail()` en verde por el motivo equivocado.
  test.setTimeout(120_000);

  const puertos = catalogo();
  const regiones = [...new Set(puertos.map((puerto) => puerto.region))].sort();

  // Sin esto, cada navegación se queda esperando la hoja de fuentes de Google que el `<head>`
  // enlaza: en un CI sin salida son 20 s por página y el ataque muere de reloj en vez de morir del
  // assert, que es la forma más tonta de perder un hallazgo.
  await cerrarLaSalidaAInternet(page);

  qa.step("seguir el primer enlace de la portada: «Ver todas las regiones»");
  await page.goto("/");
  await page.locator('a[href="/mareas/"]').first().click();
  await expect(page).toHaveURL(/\/mareas\/$/u);

  const mudos: string[] = [];
  for (const region of regiones) {
    qa.step(`recorrer /mareas/${region}/, que lista los puertos de la región`);
    await page.goto(`/mareas/${region}/`);
    const entradas = (await page.locator(ENTRADAS).allTextContents()).map((texto) => texto.trim());
    for (const puerto of puertos.filter((candidato) => candidato.region === region)) {
      const suya = entradas.find((texto) => texto.startsWith(puerto.nombre));
      if (suya === undefined) {
        mudos.push(`${puerto.nombre}: no aparece en /mareas/${region}/`);
      } else if (!suya.endsWith(puerto.palabra)) {
        mudos.push(`${puerto.nombre} (/mareas/${region}/): «${suya}» no dice «${puerto.palabra}»`);
      }
    }
  }

  expect(
    mudos.length,
    `puertos que se eligen sin saber si su marea está medida (primeros 5 de ${mudos.length}): ` +
      mudos.slice(0, 5).join(" | "),
  ).toBe(0);
});

test("A12 · el último clic antes del puerto —la página de la provincia— tampoco es a ciegas", async ({
  page,
  qa,
}) => {
  test.fail(); // hallazgo ABIERTO (ledger 2026-08-29).

  const puertos = catalogo();

  await cerrarLaSalidaAInternet(page);

  qa.step("bajar hasta la lista de la provincia, el último índice antes de la ficha del puerto");
  await page.goto("/mareas/galicia/pontevedra/");

  const entradas = (await page.locator(ENTRADAS).allTextContents()).map((texto) => texto.trim());
  const mudos = puertos
    .filter((puerto) => puerto.provincia === "pontevedra")
    .flatMap((puerto) => {
      const suya = entradas.find((texto) => texto.startsWith(puerto.nombre));
      return suya === undefined || suya.endsWith(puerto.palabra)
        ? []
        : [`${puerto.nombre}: «${suya}» no dice «${puerto.palabra}»`];
    });

  expect(
    mudos,
    "en /mareas/galicia/pontevedra/, Vigo (medida) y Baiona (estimada) se presentan iguales",
  ).toEqual([]);
});
