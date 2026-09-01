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
 * Todos nacen **en verde**, que es la única forma de que un gate se respete. El de objetivo táctil
 * (**G5**) se dejó fuera en T-26 porque entonces nacía en rojo, y entró en **T-30** cuando el arreglo
 * de `indices.css` y el de esta trayectoria lo dejaron verde. Ojo con el número: durante cuatro
 * trayectorias esta cabecera dijo «hoy nacería en rojo 170 de 170 en la portada» **como si fuera el
 * presente**, y hacía tiempo que no lo era — el propio `indices.css` decía «bajan de 170 a 14» desde
 * T-26. Un dato correcto que nadie actualiza se convierte en uno falso sin que nadie mienta.
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

/**
 * **G4 · ningún texto se publica por debajo del contraste que la WCAG pide para leerlo** (4,5:1
 * normal, 3:1 grande).
 *
 * Nace en verde con holgura —mínimo medido **5,42:1**— y avisará si alguien retoca la paleta. Pero lo
 * que hace a este gate distinto de los otros no es el umbral: son **los dos canarios**, y están
 * porque **las dos maneras de mentir de este gate se reprodujeron a mano** antes de escribirlo.
 *
 * **1 · No ver nada.** El primer intento parseaba `rgb(...)` del `color` computado. Este Chromium lo
 * serializa como `oklch(...)`, así que el patrón no casó **ni una vez**: `0 muestras de 487
 * elementos`, y el informe habría dicho «ningún problema de contraste». La auditoría de la que sale
 * esta trayectoria tropezó igual, con el mismo número.
 *
 * **2 · Verlo todo.** El segundo intento resolvió el color con el motor del navegador (canvas) pero
 * **sin limpiar el lienzo entre resoluciones**: un fondo transparente devolvía el **último color
 * pintado** —el del propio texto—, y los 951 elementos daban ratio **1,00**. Un gate que denuncia
 * todo es tan inútil como uno que no denuncia nada, y además entrena a ignorarlo.
 *
 * De ahí los dos:
 *
 * * **Cobertura**: las muestras tienen que ser **exactamente** tantas como los elementos con texto.
 *   Si son menos —o cero—, el color no se está resolviendo y el verde no significa nada.
 * * **Sensibilidad**: un par que sabemos que falla (dos `oklch()` casi iguales) **tiene que salir**
 *   por debajo del umbral. Si no sale, el instrumento no mide.
 *
 * Un umbral sin las dos es exactamente el gate que ya mintió dos veces aquí.
 */
const MEDIR_CONTRASTE = `(() => {
  const cvs = document.createElement("canvas"); cvs.width = cvs.height = 1;
  const cx = cvs.getContext("2d", { willReadFrequently: true });
  // El \`clearRect\` es el arreglo de la segunda mentira: sin él, un color transparente devuelve el
  // último que se pintó, y todo el sitio da 1,00.
  const resolver = (c) => { cx.clearRect(0,0,1,1); cx.fillStyle = c; cx.fillRect(0,0,1,1);
    const d = cx.getImageData(0,0,1,1).data; return { r:d[0], g:d[1], b:d[2], a:d[3]/255 }; };
  const lum = (c) => { const f = (v) => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); };
    return 0.2126*f(c.r) + 0.7152*f(c.g) + 0.0722*f(c.b); };
  const mez = (fg,bg) => ({ r:fg.r*fg.a+bg.r*(1-fg.a), g:fg.g*fg.a+bg.g*(1-fg.a), b:fg.b*fg.a+bg.b*(1-fg.a), a:1 });
  const fondo = (el) => { let n = el, acc = null;
    while (n && n.nodeType === 1) { const q = resolver(getComputedStyle(n).backgroundColor);
      if (q.a > 0) { acc = acc ? mez(acc,q) : q; if (acc.a >= 1) return acc; } n = n.parentElement; }
    return acc && acc.a >= 1 ? acc : { r:255, g:255, b:255, a:1 }; };
  const ratioDe = (fg,bg) => { const l1 = lum(fg), l2 = lum(bg);
    return (Math.max(l1,l2)+0.05) / (Math.min(l1,l2)+0.05); };
  const conTexto = [...document.body.querySelectorAll("*")].filter((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    const r = el.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return false;
    return [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim().length > 2); });
  const bajos = []; let muestras = 0;
  for (const el of conTexto) {
    const cs = getComputedStyle(el); const fg0 = resolver(cs.color);
    if (fg0.a === 0) continue;
    muestras += 1;
    const bg = fondo(el); const fg = fg0.a < 1 ? mez(fg0,bg) : fg0;
    const ratio = ratioDe(fg,bg);
    const px = parseFloat(cs.fontSize);
    const grande = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight,10) >= 700);
    if (ratio < (grande ? 3 : 4.5)) {
      bajos.push(el.tagName.toLowerCase() + "." + (el.className || "(sin clase)") +
        " → " + ratio.toFixed(2) + ":1 a " + px + "px");
    }
  }
  return { elementos: conTexto.length, muestras, bajos: bajos.slice(0,10),
           canario: ratioDe(resolver("oklch(80% 0.02 90)"), resolver("oklch(85% 0.02 90)")) };
})()`;

/**
 * **Los dos temas, y el segundo lo añadió el pase adversario.**
 *
 * Este sitio publica una paleta clara y otra oscura (`prefers-color-scheme`), con **tokens distintos**
 * para cada una. G4 nació midiendo sólo la clara, y eso lo dejaba ciego a la mitad de lo que se
 * publica: reproducido bajando la tinta del bloque oscuro hasta casi el color de su fondo, **el gate
 * pasaba 6 de 6**. La paleta oscura está bien hoy —mínimo **5,68:1**—, así que el hallazgo no era una
 * avería del sitio sino **un agujero del gate**, que es peor: mide algo que nadie mira mientras deja
 * sin mirar algo que sí se publica.
 */
const ESQUEMAS = ["light", "dark"] as const;

for (const ruta of PAGINAS) {
  for (const ancho of [360, 1280] as const) {
    for (const esquema of ESQUEMAS) {
    test(`G4 · ${ruta} a ${ancho}px (${esquema}) no publica texto por debajo del contraste AA`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: esquema });
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.goto(ruta, { waitUntil: "networkidle" });
      await page.evaluate("document.fonts.ready");
      const medida = await page.evaluate<{
        elementos: number;
        muestras: number;
        bajos: string[];
        canario: number;
      }>(MEDIR_CONTRASTE);

      // CANARIO 1 · cobertura. Si el color no se resuelve, esto cae a 0 y el verde de abajo sería
      // el verde de no haber mirado.
      expect(medida.elementos, "no hay texto que medir: el gate estaría en verde por vacío").toBeGreaterThan(50);
      expect(
        medida.muestras,
        `sólo se resolvió el color de ${medida.muestras} de ${medida.elementos} elementos: el ` +
          `resolvedor no entiende lo que el navegador devuelve, y un verde así no significa nada`,
      ).toBe(medida.elementos);

      // CANARIO 2 · sensibilidad. Un par que sabemos malo tiene que salir malo.
      expect(
        medida.canario,
        "el instrumento no denuncia un par de colores que sabemos que falla: no está midiendo",
      ).toBeLessThan(4.5);

      expect(medida.bajos).toEqual([]);
    });
    }
  }
}

/* -----------------------------------------------------------------------------
 * G5 · objetivo táctil. El gate que T-26 dejó fuera, y por qué entra ahora.
 *
 * **El número con el que se aplazó estaba caducado, no equivocado.** La cabecera de este fichero
 * decía «hoy nacería en rojo 170 de 170 en la portada», y era cierto **antes** del arreglo de T-26
 * que movió el relleno del `li` al `a`. El propio `indices.css` lo dice desde entonces: «los
 * objetivos que no llegan a 44 en la portada bajan de 170 a 14». Dos superficies del mismo hecho
 * desincronizadas —la lección de T-20 y T-29, esta vez en prosa—, y quien las desempató fue medir.
 *
 * **Por qué 24 y no 44.** 24 × 24 es WCAG 2.5.8 *Target Size (Minimum)*, nivel **AA**; 44 × 44 es
 * 2.5.5, nivel AAA. El gate encierra la **obligación**, no la aspiración, y la razón no es comodidad:
 * exigir 44 a los 171 enlaces de la tabla de especies son **+60 px por ficha**, ~25 % más de página,
 * deshaciendo el 42 % que ganó T-27. Medido tras el arreglo de esta trayectoria, subir a 24 costó
 * **+508 px (+1,6 %)** en el catálogo, **+355 px (+3,9 %)** en la portada y **+40 px (+0,3 %)** en una
 * página de puerto. La **cromía navegable** —marca, migas, rótulos enlazados, llamadas sueltas— sí va
 * a 44 px de alto, pero eso lo pone el CSS, no lo exige este gate: un gate que pide más de lo que se
 * puede sostener en todo el sitio es un gate que se acaba bajando, y bajarlo una vez es enseñar que
 * se puede.
 *
 * **Las dos exenciones van escritas AQUÍ y no leídas del CSS** (lección A-T23-2): una exención
 * inferida del código que se vigila se auto-concede.
 *
 * 1. **Enlaces en línea dentro de texto corrido** — excepción explícita de 2.5.8. Se detecta porque
 *    el elemento comparte padre con texto que no es enlace; hoy son 2 en el catálogo y 16 en la
 *    página de puerto.
 * 2. **Objetivos ocultos a la vista** (patrón *screen-reader only*: caja ≤ 1 px y posicionado
 *    absoluto). Hoy, los 3 `input.solo-lectores` de la portada, que no son objetivo táctil de nadie.
 *
 * Y **el gate los nombra en su mensaje** en vez de descontarlos en silencio: un gate que calla a
 * quién no mira hace creer que mira a todos (lección A-T28-1).
 *
 * **Por qué el arreglo va con `min-height` y no fiándose del texto**: este contenedor no carga las
 * tipografías del sitio (vienen de Google Fonts) y G2 salió verde en local y rojo en CI por eso. Un
 * alto que sale de `line-height × font-size` cambia con la tipografía que llegue; uno declarado en
 * píxeles, no. Por eso G5 mide lo mismo aquí que en CI.
 * -------------------------------------------------------------------------- */

/** WCAG 2.5.8 (AA). El mismo número que `--m-tap-min`, escrito aquí y no leído del token. */
const LADO_MINIMO = 24;

const MEDIR_OBJETIVOS = `(() => {
  const SELECTOR = 'a, button, input, select, textarea, summary, [role="button"]';
  const visibles = [...document.querySelectorAll(SELECTOR)].filter((el) => {
    const caja = el.getBoundingClientRect();
    return caja.width > 0 && caja.height > 0;
  });

  // Excepción «inline» de 2.5.8: el objetivo va dentro de una frase, y agrandarlo rompería el texto.
  const enLinea = (el) => {
    const padre = el.parentElement;
    if (!padre) return false;
    for (const hijo of padre.childNodes) {
      if (hijo.nodeType === 3 && (hijo.textContent || "").trim().length > 0) return true;
    }
    return false;
  };

  // Patrón screen-reader-only: no lo toca nadie porque no se ve.
  const ocultoALaVista = (el) => {
    const caja = el.getBoundingClientRect();
    return caja.width <= 1 && caja.height <= 1 && getComputedStyle(el).position === "absolute";
  };

  const nombre = (el) => {
    const caja = el.getBoundingClientRect();
    const texto = (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24);
    return el.tagName.toLowerCase() + " " + Math.round(caja.width) + "x" + Math.round(caja.height) +
      " «" + texto + "»";
  };

  const exentosLinea = visibles.filter(enLinea);
  const exentosOcultos = visibles.filter((el) => !enLinea(el) && ocultoALaVista(el));
  const sujetos = visibles.filter((el) => !enLinea(el) && !ocultoALaVista(el));

  const pequenos = sujetos.filter((el) => {
    const caja = el.getBoundingClientRect();
    return Math.min(caja.width, caja.height) < ${LADO_MINIMO};
  });

  // CANARIO de sensibilidad: una caja que sabemos pequeña tiene que salir pequeña. Se mide de
  // verdad —se pinta, se lee su rectángulo y se retira—, no se asume.
  const testigo = document.createElement("button");
  testigo.style.cssText = "position:fixed;left:0;top:0;width:10px;height:10px;padding:0;border:0";
  document.body.appendChild(testigo);
  const cajaTestigo = testigo.getBoundingClientRect();
  const canario = Math.min(cajaTestigo.width, cajaTestigo.height);
  testigo.remove();

  return {
    visibles: visibles.length,
    sujetos: sujetos.length,
    exentosLinea: exentosLinea.length,
    exentosOcultos: exentosOcultos.map(nombre),
    pequenos: pequenos.slice(0, 12).map(nombre),
    total: pequenos.length,
    canario,
  };
})()`;

for (const ruta of PAGINAS) {
  for (const ancho of ANCHOS) {
    test(`G5 · ${ruta} a ${ancho}px no publica objetivos táctiles por debajo de ${LADO_MINIMO}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.goto(ruta, { waitUntil: "networkidle" });
      await page.evaluate("document.fonts.ready");
      const medida = await page.evaluate<{
        visibles: number;
        sujetos: number;
        exentosLinea: number;
        exentosOcultos: string[];
        pequenos: string[];
        total: number;
        canario: number;
      }>(MEDIR_OBJETIVOS);

      // CANARIO 1 · cobertura. Si no queda nadie a quien medir —porque el selector dejó de casar o
      // porque las exenciones se lo comieron todo—, el verde de abajo sería el de no haber mirado.
      expect(
        medida.sujetos,
        `no queda ningún objetivo que medir en ${ruta} (${medida.visibles} visibles, ` +
          `${medida.exentosLinea} exentos por ir en línea, ${medida.exentosOcultos.length} por estar ` +
          "ocultos a la vista): este gate estaría en verde por vacío",
      ).toBeGreaterThan(5);

      // CANARIO 2 · sensibilidad. Un objetivo de 10 px tiene que medirse como 10 px.
      expect(
        medida.canario,
        "un botón de 10 px no se mide como menor que el umbral: el instrumento no está midiendo",
      ).toBeLessThan(LADO_MINIMO);

      expect(
        medida.pequenos,
        `objetivos táctiles por debajo de ${LADO_MINIMO}x${LADO_MINIMO} px (WCAG 2.5.8 AA) en ` +
          `${ruta} a ${ancho}px: ${medida.total} de ${medida.sujetos} medidos. ALCANCE: se eximen ` +
          `${medida.exentosLinea} enlaces que van dentro de un texto corrido (excepción de 2.5.8) y ` +
          `estos ${medida.exentosOcultos.length} objetivos ocultos a la vista, que se nombran para ` +
          `que nadie los dé por medidos: ${JSON.stringify(medida.exentosOcultos)}`,
      ).toEqual([]);
    });
  }
}
