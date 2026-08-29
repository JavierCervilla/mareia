/**
 * A3 · **El sello promete un offline que no comprueba.**
 *
 * La promesa de T-12, en la frase que la sección escribe en pantalla: *«Guardado en este
 * dispositivo… La página se guarda con su hoja de estilos»*. Y la de T-11, que esta sección
 * re-exporta entera: *nunca presentar como fresco lo que no lo es*.
 *
 * El sello se deriva **solo de IndexedDB** (`cliente/sin-red.ts` → `leerFavorito` → `vistaSinRed`):
 * si hay registro de favorito, dice que el puerto está guardado. Pero los bytes de la página no
 * están en IndexedDB, están en la caché del service worker, y **nadie mira si siguen ahí**. Los dos
 * almacenes pueden separarse, y se separan por caminos que no tienen nada de exótico:
 *
 *  1. **Un fichero con hash que ya no está en el servidor.** `addAll` es todo o nada, así que un
 *     solo 404 deja la caché vacía; el favorito de IndexedDB se escribió antes y se queda. Pasa con
 *     una pestaña abierta desde ayer y el rebuild diario de T-15 por medio, que es el caso normal.
 *     La página lo dice —una nota debajo del botón— y **la primera recarga se lleva la nota**: lo
 *     que queda es el sello afirmando lo que no hay.
 *  2. **La caché barrida y IndexedDB no.** Es literalmente lo que hace `activate` al subir
 *     `ESQUEMA_CACHE` (v1→v2 en este mismo PR), y también lo que hacen el desalojo por presión de
 *     almacenamiento y el «borrar imágenes y archivos» del menú del navegador.
 *  3. **Al revés: IndexedDB desalojada y la caché intacta.** El sello dice entonces que la página
 *     «no está guardada» y que «puede no estar la próxima vez» — sobre una copia que el worker sí
 *     tiene y que sí va a estar.
 *
 * Los tres son el mismo defecto y se afirman con el mismo invariante: **lo que el sello promete y
 * lo que hay en la caché del worker tienen que coincidir**. Da igual por cuál de los dos lados se
 * arregle (que el sello mire la caché, que el favorito no se escriba si el worker falló, que la
 * copia se rehaga sola): cualquiera de ellos pone este recorrido en verde.
 *
 * Se afirma sobre **las claves de la caché del worker** y no sobre lo que se ve, porque la caché
 * HTTP de Chromium sirve assets ya podados y un recorrido que mire píxeles pasa en verde con la
 * copia destruida.
 */

import { expect, test } from "../../fixtures/qa-bundle";

import {
  BARRER_CACHE_DE_PAGINAS,
  CLAVES_GUARDADAS,
  PAGINA,
  SECCION_SIN_RED,
  guardarPuerto,
  montarArnes,
  workerListo,
} from "./utiles-pwa";

/** Borra la base de favoritos sin tocar la caché del worker. */
const BORRAR_IDB = `(async () => {
  await new Promise((listo) => {
    const peticion = indexedDB.deleteDatabase("mareia");
    peticion.onsuccess = listo;
    peticion.onerror = listo;
    peticion.onblocked = listo;
  });
})()`;

/**
 * El invariante, en un sitio: **el sello y la caché del worker cuentan la misma historia**.
 *
 * No afirma el síntoma («el sello miente») sino la propiedad que la sección promete, así que el día
 * del arreglo pasa a verde sin tocar una línea, se arregle por el lado que se arregle.
 */
async function elSelloYLaCacheDicenLoMismo(
  page: import("@playwright/test").Page,
): Promise<void> {
  const dicho = await page.locator(`${SECCION_SIN_RED} .sin-red__sello`).innerText();
  const claves = await page.evaluate<readonly string[]>(CLAVES_GUARDADAS);
  const prometeGuardado = dicho.includes("Guardado en este dispositivo");
  const paginaGuardada = claves.includes(PAGINA);
  expect(
    prometeGuardado,
    `el sello dice «${dicho.split("\n")[0]}» y en la caché del worker hay ${JSON.stringify(claves)}`,
  ).toBe(paginaGuardada);
}

test("A3 · un fichero que ya no está deja el favorito sin página, y la recarga se lleva el aviso", async ({
  page,
  context,
  qa,
}) => {
  test.fail(); // Hallazgo ABIERTO (bundle b3d55218409f). Quítalo cuando el sello mire la caché.
  await montarArnes(context);

  qa.step("abrir el puerto y esperar al worker");
  await page.goto(PAGINA);
  await workerListo(page);

  qa.step("la pestaña lleva abierta desde ayer: el rebuild diario se llevó su hoja de estilos");
  await context.route("**/_astro/AlmanaqueLayout*.css", async (route) => {
    await route.fulfill({ status: 404, contentType: "text/plain", body: "ya no está" });
  });

  qa.step("guardar el puerto: las constantes bajan, los bytes de la página no");
  await page.locator(`${SECCION_SIN_RED} [data-sin-red-accion]`).click();
  await expect(page.locator(`${SECCION_SIN_RED} .sin-red__titular`)).toContainText(
    /^Guardado en este dispositivo hace /u,
    { timeout: 20_000 },
  );

  qa.step("y quien lee recarga, que es lo primero que hace cualquiera al volver a la página");
  await page.reload();
  await expect(page.locator(`${SECCION_SIN_RED} .sin-red__sello`)).toBeVisible();

  qa.step("comprobar que el sello no afirma un offline que no existe");
  await elSelloYLaCacheDicenLoMismo(page);
});

test("A3 · con la caché de páginas barrida, el sello sigue prometiendo la copia que ya no hay", async ({
  page,
  context,
  qa,
}) => {
  test.fail(); // Hallazgo ABIERTO (bundle e5174ab760e4).
  await montarArnes(context);

  qa.step("guardar el puerto con cobertura");
  await page.goto(PAGINA);
  await guardarPuerto(page);

  qa.step("barrer la caché de páginas sin tocar IndexedDB (el barrido de ESQUEMA_CACHE v1→v2)");
  await page.evaluate<void>(BARRER_CACHE_DE_PAGINAS);

  qa.step("volver a la página con cobertura, que es cuando se podría arreglar sola");
  await page.reload();
  await expect(page.locator(`${SECCION_SIN_RED} .sin-red__sello`)).toBeVisible();

  qa.step("comprobar que el sello no promete un offline que ya no existe");
  await elSelloYLaCacheDicenLoMismo(page);
});

test("A3 · con IndexedDB desalojada, el sello niega una copia que el worker sí tiene", async ({
  page,
  context,
  qa,
}) => {
  test.fail(); // Hallazgo ABIERTO (bundle a6345d9e9ceb).
  await montarArnes(context);

  qa.step("guardar el puerto con cobertura");
  await page.goto(PAGINA);
  await guardarPuerto(page);

  qa.step("el navegador desaloja IndexedDB y deja la caché del worker en su sitio");
  await page.evaluate<void>(BORRAR_IDB);

  await page.reload();
  await expect(page.locator(`${SECCION_SIN_RED} .sin-red__sello`)).toBeVisible();

  qa.step("comprobar que el sello no da por perdida una copia que sigue guardada");
  await elSelloYLaCacheDicenLoMismo(page);
});
