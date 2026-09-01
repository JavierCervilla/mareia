/**
 * Los tres gates que miran **el ancho de la pantalla**, que es lo que ninguno miraba.
 *
 * Este portal comprueba el `dist/` carácter a carácter —que la nota legal viaje pegada a su cifra en
 * 456 sitios, que ninguna cifra lleve el decimal inglés, que ningún hueco quede mudo— y **todos esos
 * gates comprueban lo que la página DICE. Ninguno había comprobado nunca si se puede LEER.** Una
 * página puede pasar las 456 comprobaciones de contenido y ser ilegible en el aparato donde se lee,
 * que es exactamente lo que pasó: `/pesca/especies/` partía **376 palabras a media palabra** a 360 px
 * y ningún test del repositorio se enteró.
 *
 * Los tres nacen **en verde**, que es la única forma de que un gate se respete. El de objetivo táctil
 * (≥ 44 × 44 px) se deja fuera a propósito: hoy nacería en rojo 170 de 170 en la portada, y un gate
 * que nace en rojo se ignora — así es como mueren.
 *
 * **Anchos**: 320, 360 y 390. No el `Pixel 7` del proyecto (412 px), porque a 412 la avería que
 * origina esta trayectoria **ya no se ve**: medido, 219 roturas a 390 y 0 a 412. Un gate que sólo
 * mira el ancho donde el defecto no aparece es un gate que no mira.
 */

import { expect, test } from "@playwright/test";

/** Los tres anchos que mandan. 320 es el suelo del parque; 360 el Android común; 390 el iPhone. */
const ANCHOS = [320, 360, 390] as const;

/**
 * Las páginas que se miden: una de cada familia con superficie propia. No las 279 —el gate tiene que
 * caber en el presupuesto de CI—, pero sí **la densa de cada tipo**: la tabla de especies (la que se
 * rompió), una página de puerto (que lleva la tabla del mes y las tallas legales) y la portada (que
 * lleva los 153 enlaces).
 */
const PAGINAS = ["/pesca/especies/", "/mareas/andalucia/cadiz/cadiz/", "/"] as const;

/**
 * Lo único que se exime de G1, y **está escrito aquí y no leído del CSS**.
 *
 * El binomio científico sí tiene que poder partirse por dentro: son palabras largas sin espacios en
 * una celda estrecha, y `overflow-wrap: anywhere` está puesto ahí a propósito. Pero la exención va
 * escrita en el gate, **no inferida de qué elementos declaran `anywhere`**: si se leyera del CSS que
 * vigila, volver a poner `anywhere` en `th, td` —la avería exacta que este gate existe para impedir—
 * se auto-eximiría y el gate seguiría verde. Es la lección de A-T23-2 (un gate que calcula su
 * expectativa desde el código que vigila no vigila nada) aplicada antes de tropezar con ella.
 */
const PUEDEN_PARTIRSE = [".tabla-especies__boe", ".tabla-especies__aceptado"];

/**
 * Palabras cortadas **entre dos letras**, que es la avería; los cortes en guion, raya o barra son
 * oportunidades legítimas y no cuentan.
 *
 * Se mide con `Range` sobre cada palabra del texto visible: si sus rectángulos caen en más de una
 * línea, la palabra está repartida. La comprobación letra-letra es lo que separa «Cantábri/co» de
 * «(COI-UNESCO)» y de «Anexo II—», que son cortes correctos.
 */
/**
 * El código que corre **en el navegador**, como cadena.
 *
 * Es la convención del repo (ver `a5-boletin-desborda.spec.ts`): un `page.evaluate` con `document`
 * dentro no compila, porque el `tsconfig` del proyecto no trae la `lib` del DOM y relajarla para un
 * test sería aflojar el typecheck de todo el repo. Se evalúa la expresión en el navegador y se tipa
 * sólo lo que vuelve.
 */
const MEDIR_PARTIDAS = (exentos: readonly string[]) => `(() => {
  const exentos = ${JSON.stringify(exentos)};
  const rango = document.createRange();
  const rotas = [];
  const letra = /\\p{L}/u;
  const paseo = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let nodo;
  while ((nodo = paseo.nextNode())) {
    const texto = nodo.nodeValue || "";
    if (!texto.trim()) continue;
    const padre = nodo.parentElement;
    if (!padre) continue;
    const estilo = getComputedStyle(padre);
    if (estilo.display === "none" || estilo.visibility === "hidden") continue;
    if (exentos.some((selector) => padre.closest(selector) !== null)) continue;
    for (const encontrada of texto.matchAll(/[^\\s\\u00a0]{3,}/gu)) {
      const palabra = encontrada[0];
      rango.setStart(nodo, encontrada.index);
      rango.setEnd(nodo, encontrada.index + palabra.length);
      const cajas = Array.from(rango.getClientRects()).filter((caja) => caja.width > 0);
      if (new Set(cajas.map((caja) => Math.round(caja.top))).size < 2) continue;
      let corte = -1;
      let arriba = -1;
      for (let i = 0; i < palabra.length; i += 1) {
        rango.setStart(nodo, encontrada.index + i);
        rango.setEnd(nodo, encontrada.index + i + 1);
        const caja = rango.getClientRects()[0];
        if (!caja) continue;
        const linea = Math.round(caja.top);
        if (arriba === -1) arriba = linea;
        else if (linea !== arriba) { corte = i; break; }
      }
      if (corte <= 0) continue;
      if (letra.test(palabra[corte - 1] || "") && letra.test(palabra[corte] || "")) {
        rotas.push("«" + palabra.slice(0, 30) + "» partida tras «" + palabra.slice(0, corte).slice(-6) + "»");
      }
    }
  }
  return rotas;
})()`;

/** Si alguna tipografía del sitio llegó a cargar. Sin ellas, las métricas no son las del sitio. */
const TIPOGRAFIAS_CARGADAS = `[...document.fonts].some((fuente) => fuente.status === "loaded")`;

/** Los elementos que cruzan el borde derecho, buscados en `body *` y no en un contenedor sospechado. */
const CULPABLES_DEL_DESBORDE = (ancho: number) => `(() => {
  if (document.documentElement.scrollWidth <= ${ancho} + 1) return [];
  const cruzan = [...document.querySelectorAll("body *")]
    .filter((el) => el.getBoundingClientRect().right > ${ancho} + 1);
  // **Sólo las hojas.** Cuando algo desborda, TODOS sus ancestros desbordan con él: la lista en
  // orden de documento sale llena de \`table\`, \`thead\`, \`tr\`, \`td\`… y el elemento que de verdad
  // impone el ancho queda fuera del corte. Reproducido en el pase adversario (A-T26-1) poniéndole
  // un \`min-width\` a \`.tabla-especies__literal\`: el gate enrojecía nombrando diez contenedores y
  // **no nombraba al culpable**. Es la lección de A5 —acertar el veredicto y fallar el culpable—
  // repitiéndose dentro del gate que la citaba.
  const conCulpaPropia = cruzan.filter((el) => !cruzan.some((otro) => otro !== el && el.contains(otro)));
  return conCulpaPropia
    .slice(0, 10)
    .map((el) => el.tagName.toLowerCase() + "." + (el.className || "(sin clase)"));
})()`;

for (const ruta of PAGINAS) {
  for (const ancho of ANCHOS) {
    test(`G1 · ${ruta} a ${ancho}px no parte ninguna palabra por la mitad`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 800 });
      await page.goto(ruta, { waitUntil: "networkidle" });
      // Sin las tipografías del sitio las métricas no son las del sitio: una fuente de reserva más
      // ancha inventaría roturas que nadie ve, y una más estrecha escondería las que sí hay. Así que
      // este gate **no mide sin ellas**, y lo que hace entonces depende de dónde corra:
      //
      // * **En CI falla.** Ahí las tipografías se alcanzan, así que no cargarlas es una avería
      //   —del sitio o del entorno— y hay que verla.
      // * **Fuera de CI se salta, diciéndolo.** En este contenedor el proxy no deja llegar a
      //   `fonts.googleapis.com`, y un rojo permanente en local acabaría enseñando a ignorarlo.
      //
      // Lo que NO se hace es medir igualmente con la fuente de reserva: eso sería un gate que mide
      // una página que nadie ve, verde o rojo por razones que no son las del lector.
      await page.evaluate("document.fonts.ready");
      const cargadas = await page.evaluate<boolean>(TIPOGRAFIAS_CARGADAS);
      if (!cargadas) {
        expect(
          process.env["CI"],
          "en CI las tipografías del sitio tienen que cargar: sin ellas G1 no mide lo que se ve",
        ).toBeFalsy();
        test.skip(true, "sin las tipografías del sitio (proxy local): G1 no puede medir");
      }
      expect(await page.evaluate<string[]>(MEDIR_PARTIDAS(PUEDEN_PARTIRSE))).toEqual([]);
    });

    test(`G2 · ${ruta} a ${ancho}px no desborda a lo ancho`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 800 });
      await page.goto(ruta, { waitUntil: "networkidle" });
      await page.evaluate("document.fonts.ready");
      // Si desborda, el culpable se busca en `body *` y no en un contenedor que ya sospechemos:
      // acertar el veredicto y fallar el culpable manda a quien lo lea a mirar donde no es (A5).
      const culpables = await page.evaluate<string[]>(CULPABLES_DEL_DESBORDE(ancho));
      expect(culpables).toEqual([]);
    });
  }
}

/**
 * **G1 sensibilidad** — porque en este contenedor G1 se salta, y un gate que nadie ha visto fallar
 * es una conjetura.
 *
 * No mide el sitio: mide **el detector**, sobre una página falsificada a mano donde se sabe la
 * respuesta. Por eso no depende de qué tipografía cargue, y por eso corre siempre. Las tres cosas
 * que tiene que separar son las tres que decidieron su forma:
 *
 * 1. Una palabra partida **entre dos letras** se denuncia. Es la avería.
 * 2. Un corte en **guion** no se denuncia: es donde una palabra compuesta debe partir.
 * 3. Lo que esté dentro de un selector **eximido** no se denuncia, aunque parta entre letras.
 */
test("G1 sensibilidad · denuncia el corte entre letras y perdona el del guion", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(
    `document.body.innerHTML = '<div style="width:40px;overflow-wrap:anywhere;font:16px monospace">' +
      '<p id="rota">supercalifragilistico</p>' +
      '<p id="guion">alfa-beta-gamma-delta</p>' +
      '<p class="tabla-especies__boe" id="eximida">supercalifragilistico</p>' +
      '</div>'`,
  );
  const conExencion = await page.evaluate<string[]>(MEDIR_PARTIDAS(PUEDEN_PARTIRSE));
  const sinExencion = await page.evaluate<string[]>(MEDIR_PARTIDAS([]));

  expect(
    conExencion.some((r) => r.includes("supercalifragilistico")),
    "el detector no ve una palabra partida entre dos letras: G1 no mide nada",
  ).toBe(true);
  expect(
    conExencion.some((r) => r.includes("alfa-beta")),
    "el detector denuncia un corte en guion, que es donde una palabra compuesta debe partir",
  ).toBe(false);
  // La exención tiene que quitar exactamente una: la que está dentro del selector eximido. Si no
  // quitara ninguna, la exención no existiría; si quitara las dos, se estaría comiendo el hallazgo.
  expect(sinExencion.length - conExencion.length).toBe(1);
});

/**
 * **G6 · apilar no puede esconder nada.**
 *
 * T-27 apila el catálogo de especies en fichas por debajo de 700 px cambiando **sólo la
 * presentación**: un único marcado, dos maneras de pintarlo. Eso es lo que deja intactos a los gates
 * que leen el `dist/` —E1 el nombre literal de la norma en las 86 filas, E5 las 117 tallas campo a
 * campo, E6 los taxones re-derivados—, porque el HTML publicado es el mismo a 360 px y a 1280.
 *
 * Y es exactamente por eso que hace falta este gate: **ninguno de ellos vería un `display: none`**.
 * Todos leen el HTML; ninguno mira lo que se pinta. Un `display: none` puesto para que una ficha
 * quepa —la clase de atajo que se toma cuando algo no encaja— dejaría el texto en el fichero, los
 * 300 tests en verde, y el dato fuera de la pantalla del que lo necesita.
 *
 * Se compara **especie por especie** y no la página entera, para que el rojo diga cuál se perdió.
 *
 * **La cabecera queda excluida, y se nombra en vez de descontarse en silencio.** Apilada deja de ser
 * la cabecera de nada: no está encima de su columna. Ocultarla es legítimo **porque las celdas se
 * describen solas** —la del taxón dice «WoRMS acepta el nombre de la norma», la de tallas dice «el
 * BOE imprime "25"»—, así que ningún dato queda huérfano de su rótulo. Si algún día dejaran de
 * describirse, esta exclusión sería el agujero, y por eso está escrita aquí y no dentro de un
 * selector.
 */
test("G6 · apilado en fichas, ninguna especie publica menos texto que en escritorio", async ({
  page,
}) => {
  const TEXTO_POR_ESPECIE = `(() => {
    const filas = [...document.querySelectorAll("table.tabla-especies tbody tr")];
    return Object.fromEntries(filas.map((f) => [
      f.getAttribute("data-especie"),
      (f.innerText || "").replace(/\\s+/gu, " ").trim(),
    ]));
  })()`;

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/pesca/especies/", { waitUntil: "networkidle" });
  await page.evaluate("document.fonts.ready");
  const escritorio = await page.evaluate<Record<string, string>>(TEXTO_POR_ESPECIE);

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/pesca/especies/", { waitUntil: "networkidle" });
  await page.evaluate("document.fonts.ready");
  const movil = await page.evaluate<Record<string, string>>(TEXTO_POR_ESPECIE);

  // La premisa va en la aserción: el día que el catálogo se quede sin filas, este gate dejaría de
  // medir en silencio, y eso hay que verlo.
  expect(Object.keys(escritorio).length).toBeGreaterThan(80);
  expect(Object.keys(movil)).toEqual(Object.keys(escritorio));

  const perdidas = Object.entries(escritorio)
    .filter(([clave, texto]) => movil[clave] !== texto)
    .map(([clave]) => clave);
  expect(perdidas, "estas especies publican distinto texto apiladas que en escritorio").toEqual([]);
});
