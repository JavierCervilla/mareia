/**
 * Recorrido offline (T-12): guardar un puerto, **cortar la red** y comprobar que el almanaque sigue
 * en pie y que sigue calculando.
 *
 * Lo que aquí se comprueba y no puede comprobar un test de unidad: que la promesa **llega a la
 * pantalla sin cobertura**. `pwa/dia-offline.test.ts` afirma que el navegador calcula lo mismo que
 * el API en los doce puertos; esto afirma que con la red cortada, en un teléfono, la página abre,
 * la tabla del día está, una fecha futura se calcula ahí mismo y la meteo dice con qué se está
 * quedando quien la lee.
 *
 * **Cero red de verdad.** La red se corta a dos niveles porque un service worker hace sus propias
 * peticiones y con uno no basta: `context.setOffline(true)` **y** un enrutado de contexto que aborta
 * todo mientras el interruptor está bajado. Se usa `context.route` y no `page.route` porque las
 * peticiones que hace el worker no pasan por la página.
 *
 * **Y una tercera cosa, que es del arnés y no del producto**: Chromium **reinicia su emulación de
 * «sin red» en cada navegación**, así que tras un `reload` `navigator.onLine` vuelve a `true` aunque
 * no salga un solo byte del navegador (comprobado con sonda). En un teléfono de verdad la bandera
 * sigue en `false`. Como los recorridos de aquí van justamente de recargar sin cobertura, el arnés
 * fija `navigator.onLine` a `false` con un script de inicialización a partir del momento en que se
 * corta. Lo que se estaría falseando es **solo la bandera**: la red sigue cortada de verdad, así que
 * la copia guardada, el cálculo en el navegador y los sellos de antigüedad son reales. La lectura de
 * la bandera en sí la cubren los tests de `pwa/vista-sin-red.test.ts`, que reciben `conexion` como
 * entrada.
 *
 * Cada momento deja su captura en `qa-shots/t12-offline/`.
 */

import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const FIXTURES = join(RAIZ, "apps", "web", "src", "modulos", "meteo", "fixtures");
const CAPTURAS = join(RAIZ, "qa-shots", "t12-offline");

const PAGINA = "/mareas/galicia/pontevedra/vigo/";
/** Un segundo puerto, para los recorridos en los que hay más de un favorito guardado. */
const PAGINA_SEGUNDA = "/mareas/cantabria/cantabria/santander/";
const SECCION_SIN_RED = "#sin-cobertura";
const SECCION_OTRO_DIA = "#otro-dia";
const SECCION_METEO = "#meteo";

/** Un día que no publica ninguna página construida: es lo que un caché de páginas no puede dar. */
const DIA_FUTURO = "2027-03-14";

/** Los únicos orígenes externos que la página puede llegar a pedir (los mismos que en T-11). */
const EXTERNOS_CONOCIDOS = ["fonts.googleapis.com"];

function fixture(nombre: string): string {
  return readFileSync(join(FIXTURES, `${nombre}.json`), "utf8");
}

/** El interruptor de la red del recorrido: se baja y ya no sale nada del dispositivo. */
interface Arnes {
  /** Corta la red para la página **y** para el service worker. */
  cortar: () => Promise<void>;
  /**
   * Simula el **rebuild diario** (T-15) para una ruta: su HTML se sirve apuntando a assets con otro
   * hash, y esos assets se sirven con el contenido de los originales. Es la situación en la que dos
   * favoritos guardados en dos días distintos necesitan ficheros distintos.
   */
  otroBuildEn: (ruta: string) => void;
  /** Orígenes externos que la página llegó a pedir (siempre abortados). */
  readonly escapes: readonly string[];
}

/** Prefijo con el que se sirven los assets del «build de mañana» en el recorrido de dos favoritos. */
const PREFIJO_OTRO_BUILD = "/_astro/otro-build--";

/**
 * Sirve los dos endpoints del módulo meteo desde fixtures y cierra la salida a internet.
 *
 * `meteo === undefined` sirve para el recorrido en el que nunca hubo estado del mar: el endpoint
 * cae, así que el worker no llega a guardar ninguna copia.
 */
async function montarArnes(
  context: BrowserContext,
  opciones: { readonly meteo?: string; readonly boletin?: string } = {},
): Promise<Arnes> {
  const escapes: string[] = [];
  let hayRed = true;
  const rutasDeOtroBuild = new Set<string>();

  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!hayRed) {
      await route.abort("internetdisconnected");
      return;
    }
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      escapes.push(url.href);
      await route.abort();
      return;
    }
    // Un asset del «build de mañana»: mismo contenido, otro nombre. Es lo que hace un rebuild.
    if (url.pathname.startsWith(PREFIJO_OTRO_BUILD)) {
      const original = `/_astro/${url.pathname.slice(PREFIJO_OTRO_BUILD.length)}`;
      const respuesta = await route.fetch({ url: `${url.origin}${original}` });
      await route.fulfill({ response: respuesta });
      return;
    }
    if (rutasDeOtroBuild.has(url.pathname)) {
      const respuesta = await route.fetch();
      const html = (await respuesta.text()).replaceAll("/_astro/", PREFIJO_OTRO_BUILD);
      await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
      return;
    }
    const endpoint = /\/v1\/modules\/weather\/(weather|bulletin)$/u.exec(url.pathname)?.[1];
    if (endpoint !== undefined) {
      const cuerpo = endpoint === "weather" ? opciones.meteo : opciones.boletin;
      if (cuerpo === undefined) {
        await route.abort("connectionrefused");
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: fixture(cuerpo) });
      return;
    }
    await route.continue();
  });

  return {
    escapes,
    otroBuildEn: (ruta: string) => {
      rutasDeOtroBuild.add(ruta);
    },
    cortar: async () => {
      hayRed = false;
      await context.setOffline(true);
      // Ver la cabecera: la emulación de Chromium no sobrevive a una navegación.
      await context.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, "onLine", {
          get: () => false,
          configurable: true,
        });
      });
    },
  };
}

/**
 * Espera a que el service worker esté activo antes de pedirle nada.
 *
 * La condición va como expresión en texto por el mismo motivo que las dos medidas de abajo: el
 * `tsconfig` del repo no tiene `lib: DOM`, así que `navigator.serviceWorker` no compila aquí.
 */
const WORKER_ACTIVO = `navigator.serviceWorker.ready.then((registro) => registro.active !== null)`;

async function workerListo(page: Page): Promise<void> {
  await page.waitForFunction(WORKER_ACTIVO);
}

/** Guarda el puerto y espera al sello que confirma que ya está en el dispositivo. */
async function guardarPuerto(page: Page): Promise<void> {
  await workerListo(page);
  await page.locator(`${SECCION_SIN_RED} [data-sin-red-accion]`).click();
  await expect(page.locator(`${SECCION_SIN_RED} .sin-red__titular`)).toContainText(
    /^Guardado en este dispositivo hace /u,
    { timeout: 20_000 },
  );
}

async function capturar(page: Page, nombre: string): Promise<void> {
  await mkdir(CAPTURAS, { recursive: true });
  await page.screenshot({ path: join(CAPTURAS, `${nombre}.png`), fullPage: true });
}

/**
 * Las dos medidas que hay que tomar dentro del navegador van como **expresión en texto** y no como
 * función: el `tsconfig` del repo deja `lib` en `ES2022` a propósito —para que el dominio no pueda
 * tocar el DOM sin darse cuenta— así que un `page.evaluate` con `document` dentro no compila. Es el
 * mismo recurso que usa `adversarial/a5-boletin-desborda.spec.ts`.
 */
const QUITAR_TOPE_DE_FECHA = `(() => {
  document.querySelector("[data-otro-dia-fecha]").max = "";
})()`;

/** Bytes transferidos por la navegación: una respuesta servida de caché no transfiere ninguno. */
const BYTES_DE_LA_NAVEGACION = `(() =>
  performance.getEntriesByType("navigation").map((entrada) => entrada.transferSize))()`;

/** Pide un día en la calculadora y espera a que aparezca su tabla o su ausencia. */
async function pedirDia(page: Page, fechaIso: string): Promise<void> {
  await page.locator("[data-otro-dia-fecha]").fill(fechaIso);
  await page.locator(`${SECCION_OTRO_DIA} button[type="submit"]`).click();
}

// =================================================================================================
// 1 · Guardar es un acto explícito, y dice lo que ocupa
// =================================================================================================

test("guardar un puerto es un acto explícito y la página dice cuánto ocupa y hasta dónde llega", async ({
  page,
  context,
}) => {
  const arnes = await montarArnes(context, { meteo: "weather-ok", boletin: "bulletin-ok" });
  await page.goto(PAGINA);

  // Antes de tocar nada: no hay nada guardado, y se dice.
  const sello = page.locator(`${SECCION_SIN_RED} .sin-red__sello`);
  await expect(sello).toContainText("Vigo no está guardado en este dispositivo");
  await capturar(page, "1-sin-guardar");

  await guardarPuerto(page);

  // El peso es una medida y va con su unidad completa, en kB del SI.
  await expect(sello).toContainText(/Ocupa \d+,\d kB de constantes armónicas/u);
  await expect(sello).toContainText(/calcula cualquier día entre \d{4} y \d{4} sin cobertura/u);
  await expect(sello).not.toContainText("KiB");
  await capturar(page, "2-guardado");

  expect([...new Set(arnes.escapes.map((url) => new URL(url).hostname))].sort()).toEqual(
    EXTERNOS_CONOCIDOS,
  );
});

// =================================================================================================
// 2 · Sin red, el favorito abre — y calcula
// =================================================================================================

test("sin red, el favorito abre entero: la tabla del día está y no depende de la conexión", async ({
  page,
  context,
}) => {
  const arnes = await montarArnes(context, { meteo: "weather-ok", boletin: "bulletin-ok" });
  await page.goto(PAGINA);
  await guardarPuerto(page);

  await arnes.cortar();
  await page.reload();

  // La página existe sin red, con su tabla crítica y su curva: eso ya estaba en el HTML guardado.
  await expect(page.locator("h1")).toHaveText("Vigo");
  await expect(page.locator("#tabla-de-mareas .tabla-mareas tr").first()).toBeVisible();
  await expect(page.locator("#curva-de-marea svg")).toBeVisible();

  // Y lo dice: esto es una copia, de cuándo es, y qué de la página depende de la red.
  const sello = page.locator(`${SECCION_SIN_RED} .sin-red__sello`);
  await expect(sello).toContainText(/^Sin conexión: estás leyendo la copia guardada hace /u);
  await expect(sello).toContainText("no dependen de la conexión");
  await expect(sello).toContainText("El estado del mar sí depende");
  await expect(sello).toHaveClass(/sin-red__sello--caducado/u);

  await capturar(page, "3-sin-red");
});

test("sin red, pedir el 14 de marzo de 2027 da la tabla del 14 de marzo de 2027", async ({
  page,
  context,
}) => {
  const arnes = await montarArnes(context, { meteo: "weather-ok", boletin: "bulletin-ok" });
  await page.goto(PAGINA);
  await guardarPuerto(page);

  await arnes.cortar();
  await page.reload();
  await pedirDia(page, DIA_FUTURO);

  const resultado = page.locator("[data-otro-dia-resultado]");
  await expect(resultado.locator("h3")).toContainText("14 de marzo de 2027");

  // Hay tabla de verdad: filas con su tipo de marea, su hora y su altura en metros.
  const filas = resultado.locator("tr[data-tipo]");
  expect(await filas.count()).toBeGreaterThan(0);
  await expect(filas.first().locator(".tabla-mareas__hora")).toHaveText(/^\d{2}:\d{2}$/u);
  await expect(filas.first().locator(".tabla-mareas__altura")).toHaveText(/^\d+,\d{2} m$/u);
  for (const fila of await filas.all()) {
    expect(["pleamar", "bajamar"]).toContain(await fila.getAttribute("data-tipo"));
  }

  // Y dice de dónde sale el número: no es una tabla anónima calculada en un móvil.
  await expect(resultado).toContainText("Calculado en este navegador con las constantes armónicas");
  await expect(resultado).toContainText(/grade [A-Z]/u);

  await capturar(page, "4-otro-dia-sin-red");
});

test("sin red, un día fuera de la ventana no se inventa: se dice por qué no se puede", async ({
  page,
  context,
}) => {
  const arnes = await montarArnes(context, { meteo: "weather-ok", boletin: "bulletin-ok" });
  await page.goto(PAGINA);
  await guardarPuerto(page);

  await arnes.cortar();
  await page.reload();
  // El campo tiene `max`, así que la validación del navegador no dejaría enviarlo: se le quita el
  // tope para poder atacar el cálculo, que es lo que aquí se está comprobando.
  await page.evaluate<void>(QUITAR_TOPE_DE_FECHA);
  await pedirDia(page, "2040-06-01");

  await expect(page.locator(".otro-dia__ausencia")).toContainText(/Esta copia calcula de \d{4} a \d{4}/u);
  await expect(page.locator("[data-otro-dia-resultado] table")).toHaveCount(0);
});

// =================================================================================================
// 3 · Sin guardar no es lo mismo que sin red
// =================================================================================================

test("si la cobertura se cae con la página abierta y sin guardar, se dice CUÁL de las dos cosas falta", async ({
  page,
  context,
}) => {
  const arnes = await montarArnes(context, { meteo: "weather-ok", boletin: "bulletin-ok" });
  await page.goto(PAGINA);
  await workerListo(page);

  // **Sin recargar**: es el caso real y es el único posible. Una página que no se guardó y que se
  // pide sin cobertura no la puede servir nadie —el navegador enseña su propio error, como antes de
  // que hubiera PWA—; lo que sí pasa a todas horas es quedarse sin cobertura leyéndola.
  await arnes.cortar();

  const sello = page.locator(`${SECCION_SIN_RED} .sin-red__sello`);
  await expect(sello).toContainText("Sin conexión, y esta página no está guardada aquí");
  await expect(sello).toContainText("Cuando vuelva la red");
  // Un botón que va a fallar no es una acción: no se ofrece.
  await expect(page.locator(`${SECCION_SIN_RED} [data-sin-red-accion]`)).toBeHidden();

  await pedirDia(page, DIA_FUTURO);
  await expect(page.locator(".otro-dia__ausencia")).toContainText(
    "Sin conexión y sin este puerto guardado, no hay constantes con las que calcular",
  );

  await capturar(page, "5-sin-red-sin-guardar");
});

// =================================================================================================
// 3 bis · Dos favoritos guardados en dos builds distintos
//
// Es el caso que rompía y que ningún recorrido cubría, porque todos usaban **un** favorito. El
// worker podaba de la caché todo asset que no usara la página que se estaba guardando, dando por
// hecho que «lo demás ya no lo referencia ningún HTML guardado» — falso en cuanto hay dos favoritos
// de dos builds, que con el rebuild diario de T-15 es el caso normal. El primero se quedaba con su
// página y CERO assets: se abría sin estilos, sin la isla meteo y **sin el trozo de la calculadora**,
// que es la promesa entera de T-12, y sin un solo error por ninguna parte.
// =================================================================================================

test("guardar un segundo puerto tras un despliegue nuevo no deja al primero sin sus ficheros", async ({
  page,
  context,
}) => {
  const arnes = await montarArnes(context, { meteo: "weather-ok", boletin: "bulletin-ok" });

  // Favorito 1: Vigo, con el build de hoy.
  await page.goto(PAGINA);
  await guardarPuerto(page);

  // Llega el rebuild diario: la página de Santander se sirve con assets de otro hash.
  arnes.otroBuildEn(PAGINA_SEGUNDA);
  await page.goto(PAGINA_SEGUNDA);
  await guardarPuerto(page);

  // Sin red, el PRIMER favorito tiene que seguir entero.
  await arnes.cortar();
  await page.goto(PAGINA);

  await expect(page.locator("h1")).toHaveText("Vigo");
  // Su hoja de estilos sigue guardada: sin ella el nombre del puerto no sale en la serifa de marca.
  await expect(page.locator("h1.identidad__nombre")).toHaveCSS(
    "font-family",
    /Instrument Serif|Georgia/u,
  );
  // Y su JavaScript también: si el bundle no está, el formulario nunca se enseña.
  await expect(page.locator("[data-otro-dia-form]")).toBeVisible();

  // Y el trozo de la calculadora, que es el que no referencia ningún HTML y el que más fácil se
  // quedaba fuera: pedir un día futuro sin red tiene que seguir dando su tabla.
  await pedirDia(page, DIA_FUTURO);
  await expect(page.locator("[data-otro-dia-resultado] h3")).toContainText("14 de marzo de 2027");

  await capturar(page, "8-dos-favoritos-dos-builds");
});

test("olvidar un puerto no le quita los ficheros al otro, y el último se lleva los suyos", async ({
  page,
  context,
}) => {
  const arnes = await montarArnes(context, { meteo: "weather-ok", boletin: "bulletin-ok" });
  await page.goto(PAGINA);
  await guardarPuerto(page);
  await page.goto(PAGINA_SEGUNDA);
  await guardarPuerto(page);

  // Se olvida el segundo, con red.
  await page.locator(`${SECCION_SIN_RED} [data-sin-red-accion]`).click();
  await expect(page.locator(`${SECCION_SIN_RED} .sin-red__sello`)).toContainText(
    "no está guardado en este dispositivo",
  );

  // El primero sigue completo sin red.
  await arnes.cortar();
  await page.goto(PAGINA);
  await expect(page.locator("h1")).toHaveText("Vigo");
  await expect(page.locator("[data-otro-dia-form]")).toBeVisible();
});

// =================================================================================================
// 4 · La meteo sin red: dos ausencias distintas, y la copia con su antigüedad
// =================================================================================================

test("sin red, el estado del mar se sirve de la copia guardada y con su antigüedad en la cara", async ({
  page,
  context,
}) => {
  const arnes = await montarArnes(context, { meteo: "weather-ok", boletin: "bulletin-ok" });
  await page.goto(PAGINA);
  await guardarPuerto(page);

  // Segunda visita con cobertura. Hace falta: en la PRIMERA el worker todavía se estaba
  // registrando, así que la petición de meteo salió sin pasar por él y no hubo copia que guardar.
  // A partir de aquí la página va controlada y cada respuesta que se sirve se queda sellada.
  await page.reload();
  await expect(page.locator(`${SECCION_METEO} #meteo-mar`)).toContainText("1,68 m");

  await arnes.cortar();
  await page.reload();

  const mar = page.locator(`${SECCION_METEO} #meteo-mar`);
  // El dato sigue enseñándose —marcarlo no es esconderlo— pero con la edad de la copia delante.
  await expect(mar).toContainText("1,68 m");
  await expect(mar.locator(".meteo__sello-titular")).toHaveText(/^Dato de hace /u);
  await expect(mar.locator(".meteo__sello")).toContainText("Sin conexión");
  await expect(mar.locator(".meteo__sello")).toContainText("copia que se guardó en este dispositivo");
  await expect(mar.locator(".meteo__sello")).toContainText(
    "no hay forma de comprobarlo hasta que vuelva la red",
  );
  await expect(mar.locator(".meteo__sello")).toHaveClass(/meteo__sello--caducado/u);
  // Y no se disfraza de dato de ahora.
  await expect(mar).not.toContainText("Consultado hace");

  await capturar(page, "6-meteo-copia-guardada");
});

test("«sin red» y «el dato no existe» son dos ausencias distintas, con dos frases distintas", async ({
  page,
  context,
}) => {
  // El endpoint de meteo cae desde el principio: nunca hubo copia que guardar.
  const arnes = await montarArnes(context, { boletin: "bulletin-ok" });
  await page.goto(PAGINA);

  const mar = page.locator(`${SECCION_METEO} #meteo-mar`);
  // Con red y el servidor caído: la petición salió y no volvió.
  await expect(mar).toContainText("No se ha podido pedir el estado del mar al servidor de Mareia");
  const conRed = await mar.locator(".meteo__sello").innerText();

  await guardarPuerto(page);
  await page.reload();
  await arnes.cortar();
  await page.reload();

  // Sin red y sin copia: no es que el dato no exista, es que no hay línea. Y hay que decirlo así.
  await expect(mar).toContainText("Sin conexión");
  await expect(mar).toContainText("no hay ninguna copia guardada aquí");
  await expect(mar).toContainText("El dato existe; lo que falta es la red");
  const sinRed = await mar.locator(".meteo__sello").innerText();

  expect(sinRed).not.toEqual(conRed);

  await capturar(page, "7-meteo-sin-copia");
});

// =================================================================================================
// 5 · Lo que la PWA NO puede haber roto
// =================================================================================================

test("con el service worker puesto, la página sigue sin pedir nada a ningún origen nuevo", async ({
  page,
  context,
}) => {
  const arnes = await montarArnes(context, { meteo: "weather-ok", boletin: "bulletin-ok" });
  await page.goto(PAGINA);
  await guardarPuerto(page);
  await page.reload();

  expect([...new Set(arnes.escapes.map((url) => new URL(url).hostname))].sort()).toEqual(
    EXTERNOS_CONOCIDOS,
  );
});

test("con red, la navegación se sirve de la red y no de la copia: nunca una página vieja", async ({
  page,
  context,
}) => {
  await montarArnes(context, { meteo: "weather-ok", boletin: "bulletin-ok" });
  await page.goto(PAGINA);
  await guardarPuerto(page);

  // La segunda visita, con cobertura, la contesta el servidor: es la garantía de ADR-02.
  const respuesta = await page.reload();
  expect(respuesta?.fromServiceWorker()).toBe(true); // pasa por el worker…
  const servidas = await page.evaluate<readonly number[]>(BYTES_DE_LA_NAVEGACION);
  // …pero el worker fue a la red: una respuesta de caché no transfiere bytes.
  expect(servidas.some((tamano) => tamano > 0)).toBe(true);
});

test("el índice geográfico sigue sin JavaScript aunque el sitio ya sea una PWA", async ({
  page,
  context,
}) => {
  await montarArnes(context, { meteo: "weather-ok", boletin: "bulletin-ok" });
  await page.goto("/mareas/");

  expect(await page.locator("script[src]").count()).toBe(0);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
});
