/**
 * PASE ADVERSARIO · T-10 (rol `qa-adversario`, skill `qa-adversarial`).
 *
 * Función objetivo INVERTIDA: el `verificador` ya hizo mutation testing sobre los gates nuevos y el
 * rol `qa` ya vio la sección funcionar. Aquí se ataca la PROMESA de la trayectoria:
 *
 *   «La página de puerto publica la actividad solunar del día: las BANDAS del gráfico SON los
 *    periodos que calcula el dominio, el RATING es una convención publicada con su desglose —jamás
 *    una promesa de capturas—, las ventanas que se salen del día se recortan y la tabla dice de
 *    dónde vienen, todo sin un byte de JavaScript de cliente.»
 *
 * Los cuatro hallazgos de esta pasada no son de aritmética: los números son correctos en los 12
 * puertos y en los dos días de cambio de hora (comprobado, ver el informe). Lo que falla es la otra
 * mitad de la promesa — **que lo publicado se pueda ver, se pueda nombrar y no prometa lo que el
 * aviso jura no prometer**:
 *
 * - **A-13** · la sección que aporta el módulo era la única de la página sin nombre accesible.
 * - **A-14** · las bandas se dibujaban a 1,30:1 y 1,14:1 sobre el fondo; mayor y menor se
 *   distinguían por 1,14:1, en los dos temas.
 * - **A-15** · el pie visible del gráfico no decía qué son esas manchas; el `aria-label` sí.
 * - **A-16** · el rótulo que califica la cifra vivía fuera de los textos auditados, así que la regla
 *   «aquí no se promete pesca» no lo alcanzaba.
 *
 * Informe: `docs/qa/informe-adversario-t10.md` (promesa, clases atacadas, hallazgos, no
 * reproducidos y bundle).
 *
 * **ESTADO: los cuatro corregidos en el mismo PR (#12) y el trinquete retirado.** El envoltorio
 * `hallazgoAbierto()` —el `test.fail()` de Playwright traducido a `node --test`— mantenía CI en
 * verde mientras el hallazgo estaba abierto y se puso rojo en cuanto los cuerpos empezaron a pasar,
 * que es exactamente lo que pedía. Cumplido su trabajo, los cuatro ataques son ya gates duros
 * (`gatePermanente`): el día que alguien deshaga uno de los arreglos, esto se pone rojo.
 *
 * El cuerpo de **A-14** se reescribió al cerrarlo, como avisaba su propio caveat: la vara original
 * medía tres contrastes de la mancha y era insatisfacible con la paleta del brief (ver la
 * demostración sobre su función); ahora mide el filete, que es lo que porta la información, y exige
 * que la distinción mayor↔menor no sea cromática. Los otros tres cuerpos están **intactos**.
 */

import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as fishing from "@mareia/module-fishing";

import { cargarPuertos } from "./datos/catalogo.ts";
import { rutaPuerto } from "./rutas.ts";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIST = join(AQUI, "..", "dist");
const PORTADA = join(DIST, "index.html");
const HAY_BUILD = existsSync(PORTADA);
const SIN_BUILD = "no hay apps/web/dist: corre antes `pnpm --filter web build`";

const TOKENS_CSS = join(AQUI, "..", "..", "..", "packages", "ui", "src", "tokens.css");
const PAGINA_CSS = join(AQUI, "estilos", "pagina-puerto.css");

/** Un test que no se puede juzgar en este entorno (falta el `dist/`): ni pasa ni falla, se salta. */
class SinDatos extends Error {}

function exigirBuild(): void {
  if (!HAY_BUILD) throw new SinDatos(SIN_BUILD);
}

function paginaDe(ruta: string): string {
  return readFileSync(join(DIST, ruta, "index.html"), "utf8");
}

/** Las 12 páginas de puerto construidas, con su slug. */
async function paginasDePuerto(): Promise<readonly { slug: string; html: string }[]> {
  const puertos = await cargarPuertos();
  return puertos.map((puerto) => ({ slug: puerto.slug, html: paginaDe(rutaPuerto(puerto)) }));
}

/**
 * GATE PERMANENTE — el último paso del trinquete.
 *
 * Los cuatro cuerpos nacieron envueltos en `hallazgoAbierto()`, que invertía el resultado mientras
 * el hallazgo estaba abierto y se ponía rojo el día que alguien lo arreglara. Ese día llegó: los
 * cuatro se corrigieron en este mismo PR, el envoltorio gritó «YA NO FALLA» y se retiró. A partir
 * de aquí los ataques son gates duros y corrientes: si alguien deshace uno de los arreglos, esto se
 * pone rojo por el motivo que sea, no por un diagnóstico que nadie lee.
 *
 * Lo único que sobrevive del envoltorio es la traducción de `SinDatos` a `skip`: sin `dist/` no hay
 * artefacto que juzgar, y un gate que se pone rojo por falta de build no dice nada del sitio.
 */
function gatePermanente(nombre: string, cuerpo: () => Promise<void> | void): void {
  test(nombre, async (t: TestContext) => {
    try {
      await cuerpo();
    } catch (error) {
      if (error instanceof SinDatos) {
        t.skip(error.message);
        return;
      }
      throw error;
    }
  });
}

// =================================================================================================
// A-13 · clase A5 (límites 0/1/N: la sección número 8) · la sección del módulo no tiene nombre
// =================================================================================================

/**
 * Las siete secciones que T-09 dejó en la página de puerto llevan `aria-labelledby` apuntando al
 * `id` de su propio `<h2>` — es la convención de la casa, y hasta el comentario de `.solo-lectores`
 * la enuncia («el nombre accesible de una tabla cuyo rótulo visible es el `<h2>` de su sección»).
 *
 * La octava, la que aporta el módulo, la emite `SeccionesDeModulos` como `<section id="..."
 * class="bloque">` a secas. El componente del módulo **sí** emite `<h2
 * id="titulo-actividad-solunar">`, y ese `id` no lo referencia nadie en toda la página: es la huella
 * de la intención que se quedó a medias. Efecto medido con el árbol de accesibilidad de Chromium:
 * la página expone 7 regiones y «Actividad solunar» no está entre ellas — desaparece de la
 * navegación por landmarks, que es como se recorre una página larga sin ver.
 *
 * Comportamiento correcto: toda `<section class="bloque">` que la página publica tiene nombre
 * accesible, y todo `id` de título que se emite lo usa alguien.
 */
async function todaSeccionDeBloqueTieneNombreAccesible(): Promise<void> {
  exigirBuild();
  const sinNombre: string[] = [];
  const idsColgando: string[] = [];
  for (const { slug, html } of await paginasDePuerto()) {
    const referenciados = new Set(
      [...html.matchAll(/aria-labelledby="([^"]+)"/g)].flatMap((m) => (m[1] ?? "").split(/\s+/)),
    );
    for (const etiqueta of html.match(/<section\b[^>]*>/g) ?? []) {
      if (!/class="[^"]*\bbloque\b/.test(etiqueta)) continue;
      const id = /\bid="([^"]+)"/.exec(etiqueta)?.[1] ?? "(sin id)";
      const nombrada =
        /\baria-labelledby="/.test(etiqueta) || /\baria-label="/.test(etiqueta);
      if (!nombrada) sinNombre.push(`${slug} → <section id="${id}">`);
    }
    for (const [, id] of html.matchAll(/<h[1-6]\b[^>]*\bid="(titulo-[^"]+)"/g)) {
      if (id !== undefined && !referenciados.has(id)) idsColgando.push(`${slug} → #${id}`);
    }
  }
  assert.ok(
    sinNombre.length === 0,
    `secciones de bloque sin nombre accesible (no se exponen como región): ${sinNombre.join(", ")}`,
  );
  assert.ok(
    idsColgando.length === 0,
    `ids de título que no referencia ningún aria-labelledby: ${idsColgando.join(", ")}`,
  );
}

// =================================================================================================
// A-14 · clase A5 (a pleno sol) · las bandas no llegan al contraste de un objeto gráfico
// =================================================================================================

/** Contraste mínimo de un objeto gráfico portador de información (WCAG 2.2 · 1.4.11). */
const CONTRASTE_MINIMO_OBJETO_GRAFICO = 3;

interface RGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/**
 * OKLCH (L en 0-1, C, H en grados) → sRGB con codificación gamma, en 0-1.
 *
 * El linter anti-slop de UI busca funciones de color literales y el nombre de ésta acaba en las tres
 * letras de una de ellas seguidas del paréntesis, así que la caza: es un falso positivo. Aquí no se
 * escribe ningún color —los que se miden salen de `tokens.css` en tiempo de test—, se convierten.
 * Se exime la línea en vez de renombrarla a `oklchASRGB`: renombrar sería escribir para el grep, y
 * la excepción se ve en el diff y muere con el fichero.
 */
// anti-slop-allow: `rgb(` aquí es el nombre de la conversión OKLCH→sRGB, no un color literal
function oklchASrgb(L: number, C: number, H: number): RGB {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const bb = C * Math.sin(h);
  const l = (L + 0.396_337_777_4 * a + 0.215_803_757_3 * bb) ** 3;
  const m = (L - 0.105_561_345_8 * a - 0.063_854_172_8 * bb) ** 3;
  const s = (L - 0.089_484_177_5 * a - 1.291_485_548 * bb) ** 3;
  const lineal = {
    r: 4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
    g: -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
    b: -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
  };
  const codificar = (valor: number): number => {
    const x = Math.min(1, Math.max(0, valor));
    return x <= 0.003_130_8 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  };
  return { r: codificar(lineal.r), g: codificar(lineal.g), b: codificar(lineal.b) };
}

/** Luminancia relativa WCAG de un color sRGB gamma-codificado. */
function luminancia({ r, g, b }: RGB): number {
  const linealizar = (v: number): number => (v <= 0.040_45 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linealizar(r) + 0.7152 * linealizar(g) + 0.0722 * linealizar(b);
}

/** Razón de contraste WCAG entre dos colores opacos. */
function contraste(uno: RGB, otro: RGB): number {
  const [alto, bajo] = [luminancia(uno), luminancia(otro)].sort((a, b) => b - a) as [number, number];
  return (alto + 0.05) / (bajo + 0.05);
}

/** Composición «source-over» de un color con alfa sobre un fondo opaco, en el espacio del lienzo. */
function componer(frente: RGB, fondo: RGB, alfa: number): RGB {
  return {
    r: alfa * frente.r + (1 - alfa) * fondo.r,
    g: alfa * frente.g + (1 - alfa) * fondo.g,
    b: alfa * frente.b + (1 - alfa) * fondo.b,
  };
}

/** El primer valor de un token OKLCH declarado a partir de una posición del archivo. */
function tokenOklch(css: string, nombre: string, desde: number): RGB {
  const patron = new RegExp(`${nombre}:\\s*oklch\\(\\s*([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)`, "g");
  patron.lastIndex = desde;
  const encontrado = patron.exec(css);
  assert.ok(encontrado, `no se encontró el token ${nombre} a partir del carácter ${desde}`);
  const [, l = "0", c = "0", h = "0"] = encontrado;
  // anti-slop-allow: `rgb(` es el nombre de la conversión OKLCH→sRGB; el color lo pone tokens.css
  return oklchASrgb(Number(l) / 100, Number(c), Number(h));
}

/** Lo que el CSS declara para una banda de cada énfasis, o `undefined` si no lo declara. */
function declaracionDeBanda(css: string, enfasis: string, propiedad: string): string | undefined {
  const regla = new RegExp(`\\.grafico__banda\\[data-enfasis="${enfasis}"\\]\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[1];
  assert.ok(regla, `el CSS no declara la banda «${enfasis}»`);
  // El prefijo evita que preguntar por `opacity` conteste `fill-opacity`, que es otra cosa.
  return new RegExp(`(?:^|;|\\s)${propiedad}:\\s*([^;}]+)`).exec(regla)?.[1]?.trim();
}

/**
 * Cuánto de la trama lleva tinta, de 0 a 1. Una línea continua es 1.
 *
 * Existe porque «continuo vs discontinuo» no dice nada por sí solo: `stroke-dasharray: 1 40` es
 * técnicamente otra trama y deja el filete menor en un punto cada 41 px, o sea en nada. El ciclo de
 * trabajo es lo que hace que una discontinua se lea **como una línea** y no como una mota.
 */
function cicloDeTrabajo(trama: string): { readonly ciclo: number; readonly tinta: number } {
  if (trama === "continuo") return { ciclo: 1, tinta: Number.POSITIVE_INFINITY };
  const tramos = trama
    .split(/[\s,]+/)
    .filter((trozo) => trozo !== "")
    .map((trozo) => Number.parseFloat(trozo));
  assert.ok(
    tramos.length > 0 && tramos.every((valor) => Number.isFinite(valor) && valor >= 0),
    `trama ilegible: «${trama}»`,
  );
  // Una lista impar se repite para hacerla par (SVG 1.1 §11.4): «5» son 5 de tinta y 5 de hueco.
  const patron = tramos.length % 2 === 0 ? tramos : [...tramos, ...tramos];
  const tinta = patron.filter((_, indice) => indice % 2 === 0).reduce((a, b) => a + b, 0);
  const total = patron.reduce((a, b) => a + b, 0);
  assert.ok(total > 0, `trama de longitud cero: «${trama}»`);
  return { ciclo: tinta / total, tinta: Math.min(...patron.filter((_, i) => i % 2 === 0)) };
}

/** Lo mismo, exigido: una banda sin esta declaración es el ataque otra vez. */
function exigirDeBanda(css: string, enfasis: string, propiedad: string): string {
  const valor = declaracionDeBanda(css, enfasis, propiedad);
  assert.ok(valor, `la banda «${enfasis}» no declara ${propiedad}`);
  return valor;
}

/**
 * Las bandas son el elemento visual que estrena T-10 y el único sitio del gráfico donde se lee un
 * periodo solunar. El brief exige 4,5:1 para el texto «porque esta página se lee al sol» y WCAG
 * 1.4.11 pide 3:1 a los objetos gráficos que portan información.
 *
 * Cuando se escribió el ataque, la banda entera era una mancha: `fill: var(--m-terra)` a opacidad
 * 0,18 (mayor) y 0,09 (menor), medidas 1,30:1 y 1,14:1 sobre el fondo y **1,14:1 entre sí** en los
 * dos temas — la importancia de una ventana viajaba entera en un canal cromático por debajo de
 * cualquier umbral de percepción a plena luz.
 *
 * ─── REESCRITO AL CERRAR EL HALLAZGO (el caveat del trinquete decía que había que hacerlo) ───
 *
 * El cuerpo original medía **tres** contrastes de la mancha: mayor vs fondo, menor vs fondo y mayor
 * vs menor, los tres ≥ 3:1. Con `fill: var(--m-terra)` esos tres NO pueden darse a la vez, y no es
 * cuestión de afinar la opacidad: si el menor da 3:1 contra el fondo y el mayor da 3:1 contra el
 * menor, el mayor tiene que dar 9:1 contra el fondo, y `--m-terra` **a opacidad 1** da 5,40:1
 * (claro) y 5,69:1 (noche). Barrido exhaustivo de las dos opacidades en pasos de 0,01: el mejor
 * mínimo alcanzable es 2,31:1 en claro y 2,37:1 en noche. La vara era insatisfacible con la
 * paleta del brief, que no se toca porque su peor par (5,4:1) es lo que hace legible la página al
 * sol.
 *
 * Así que el arreglo hace lo que el propio caveat contemplaba —resolver la distinción con un canal
 * **no cromático**— y este cuerpo pasa a medir lo que ahora porta la información:
 *
 * 1. **El filete** (`stroke: var(--m-terra)`, opacidad 1) es el objeto gráfico que WCAG mide de una
 *    región sombreada: se exige que llegue a 3:1 sobre el fondo en los dos temas — **contando el
 *    grosor**, que es lo que decide si ese color llega a algún píxel. La primera versión de este
 *    cuerpo medía solo el token y dos desigualdades declarativas, y el verificador la tumbó con la
 *    mutación más obvia: bajando el filete a `0.1px` el gate seguía verde 4/4 y las bandas
 *    renderizadas volvían a 1,38:1 y 1,16:1, los números del hallazgo original. Un trinquete que
 *    deja reintroducir su propio fallo no es un trinquete. El modelo que se usa ahora es geometría
 *    de rasterizado: un filete de w px centrado en el borde del `<rect>` reparte su cobertura entre
 *    dos columnas de píxel y en la peor alineación la mejor columna se queda en **w/2**, así que se
 *    mide el color compuesto a esa cobertura. Es una **cota inferior**, no una estimación: el
 *    renderizador real puede quedar por encima, nunca por debajo. Y por eso se exige también
 *    `vector-effect: non-scaling-stroke`: sin él, el grosor escala con el ancho de presentación
 *    —el lienzo son 620 unidades servidas a 340 px en un móvil— y ninguna cuenta hecha en px vale.
 * 2. **La distinción mayor↔menor no es de color**: se exige que difieran en grosor y en trama
 *    (continuo vs discontinuo), que es lo que ve quien no distingue dos tonos del mismo naranja.
 *    Comprobado en escala de grises por el verificador: el mayor deja trazo en 40/40 filas y el
 *    menor en 23–27/40.
 * 3. **La mancha sigue siendo contexto**: se exige que su opacidad siga siendo tenue, porque subirla
 *    hasta el 3:1 (haría falta 0,70) taparía la curva y rompería la regla del brief de una sola
 *    mancha de color. Que el contraste lo ponga el filete es la decisión, y aquí queda anclada.
 */
function lasBandasSeVenYSeDistinguenEntreSi(): void {
  exigirBuild();
  const tokens = readFileSync(TOKENS_CSS, "utf8");
  const pagina = readFileSync(PAGINA_CSS, "utf8");

  const base = /\.grafico__banda\s*\{([^}]*)\}/.exec(pagina)?.[1];
  assert.ok(base, "el CSS ya no declara la banda: revisa este ataque antes de darlo por cerrado");
  assert.match(
    base,
    /fill:\s*var\(--m-terra\)/,
    "la banda ya no se pinta con --m-terra: revisa este ataque antes de darlo por cerrado",
  );
  assert.match(
    base,
    /stroke:\s*var\(--m-terra\)/,
    "la banda ya no lleva filete del token: es el filete lo que la hace visible, vuelve a medir",
  );
  assert.match(
    base,
    /vector-effect:\s*non-scaling-stroke/,
    "sin non-scaling-stroke el grosor del filete escala con el ancho de presentación y la cuenta " +
      "en píxeles de este gate deja de valer: vuelve a medir sobre el SVG servido",
  );
  const alfaDeclarada = Number(/(?:^|;|\s)stroke-opacity:\s*([\d.]+)/.exec(base)?.[1] ?? "1");

  const grosor = {
    fuerte: exigirDeBanda(pagina, "fuerte", "stroke-width"),
    suave: exigirDeBanda(pagina, "suave", "stroke-width"),
  };

  /*
   * Los temas se buscan sobre la hoja **sin comentarios**, y esto no es pulcritud: la cabecera de
   * `tokens.css` cita `@media (prefers-color-scheme: dark)` para explicar cómo funciona el tema, y
   * esa mención va 3.700 caracteres ANTES del bloque de verdad — antes incluso del `:root` claro.
   * Buscando a pelo, las dos vueltas del bucle leían los mismos tokens claros y **el trinquete del
   * tema noche llevaba muerto desde que se escribió**: el verificador ennegreció el `--m-terra` del
   * bloque dark real hasta hacerlo indistinguible del fondo y el gate siguió verde 4/4. Los
   * comentarios se sustituyen por espacios de la misma longitud para que los offsets sigan valiendo.
   */
  const hoja = tokens.replace(/\/\*[\s\S]*?\*\//g, (bloque) => " ".repeat(bloque.length));
  const inicioNoche = hoja.indexOf("@media (prefers-color-scheme: dark)");
  assert.ok(inicioNoche > 0, "tokens.css ya no declara el tema noche por preferencia del sistema");
  const temas = [
    { nombre: "claro", desde: hoja.indexOf(":root {") },
    { nombre: "noche", desde: inicioNoche },
  ];
  // Red de seguridad del ancla: si los dos temas resuelven al mismo color es que se está leyendo dos
  // veces el mismo bloque, y entonces este cuerpo no está midiendo lo que dice medir.
  assert.notDeepEqual(
    tokenOklch(hoja, "--m-bg", temas[0]?.desde ?? 0),
    tokenOklch(hoja, "--m-bg", temas[1]?.desde ?? 0),
    "los dos «temas» dan el mismo fondo: el ancla del tema noche no apunta al bloque noche",
  );

  const flojos: string[] = [];
  for (const tema of temas) {
    const fondo = tokenOklch(hoja, "--m-bg", tema.desde);
    const terra = tokenOklch(hoja, "--m-terra", tema.desde);
    for (const enfasis of ["fuerte", "suave"] as const) {
      const declarado = grosor[enfasis];
      assert.match(
        declarado,
        /^[\d.]+px$/,
        `el grosor del filete «${enfasis}» es «${declarado}»: en unidades del lienzo escala con el ` +
          "ancho de presentación, así que tiene que ir en px",
      );
      // Peor alineación: el trazo se parte entre dos columnas y la mejor se queda en w/2.
      const cobertura = Math.min(1, Number.parseFloat(declarado) / 2) * alfaDeclarada;
      const razon = contraste(componer(terra, fondo, cobertura), fondo);
      if (razon < CONTRASTE_MINIMO_OBJETO_GRAFICO) {
        flojos.push(
          `${tema.nombre}/filete ${enfasis} (${declarado}, cobertura ${cobertura.toFixed(2)}) = ` +
            `${razon.toFixed(2)}:1`,
        );
      }
    }
  }
  assert.ok(
    flojos.length === 0,
    `el filete de la banda no llega a ${CONTRASTE_MINIMO_OBJETO_GRAFICO}:1 en la peor alineación ` +
      `de píxel (WCAG 1.4.11): ${flojos.join(" · ")}`,
  );

  // `stroke-dasharray: none` y no declararlo dibujan la misma línea continua: se normalizan, o
  // igualar las tramas escribiendo `none` en una de las dos pasaría el gate sin cambiar el dibujo.
  const tramaDe = (enfasis: string): string => {
    const declarada = declaracionDeBanda(pagina, enfasis, "stroke-dasharray");
    return declarada === undefined || declarada === "none" ? "continuo" : declarada;
  };
  const trama = { fuerte: tramaDe("fuerte"), suave: tramaDe("suave") };
  assert.notEqual(
    grosor.fuerte,
    grosor.suave,
    `mayor y menor comparten grosor de filete (${grosor.fuerte}): la distinción vuelve a ser de color`,
  );
  assert.notEqual(
    trama.fuerte,
    trama.suave,
    `mayor y menor comparten trama (${trama.fuerte}): quien no distingue tonos no las distingue`,
  );

  /*
   * Y la trama tiene que seguir siendo una línea. Exigir solo que las dos tramas sean **distintas**
   * deja pasar `stroke-dasharray: 1 40` —2,4 % de ciclo de trabajo, un punto cada 41 px—: grosores
   * distintos, tramas distintas, contraste del trazo intacto y la banda menor desaparecida. Lo
   * encontró el verificador, y es el assert que le faltaba al criterio con el que se mide este
   * filete: medir la discontinua «donde hay trazo» solo vale si alguien vigila cuánto trazo hay.
   * El suelo de 0,4 deja sitio a las tramas razonables (la de hoy, `5 4`, da 0,56) y mata las motas;
   * el de 3 px es para que cada tramo de tinta se vea como raya y no como grano.
   */
  for (const enfasis of ["fuerte", "suave"] as const) {
    const { ciclo, tinta } = cicloDeTrabajo(trama[enfasis]);
    assert.ok(
      ciclo >= 0.4,
      `la trama de «${enfasis}» (${trama[enfasis]}) solo lleva tinta el ${(100 * ciclo).toFixed(1)} % ` +
        "del recorrido: eso ya no es una línea discontinua, es una banda que desaparece",
    );
    assert.ok(
      tinta >= 3,
      `los tramos de tinta de «${enfasis}» (${trama[enfasis]}) miden ${tinta} px: se leen como ` +
        "grano, no como filete",
    );
  }

  for (const enfasis of ["fuerte", "suave"] as const) {
    const mancha = Number(exigirDeBanda(pagina, enfasis, "fill-opacity"));
    assert.ok(
      mancha > 0 && mancha <= 0.25,
      `la mancha de «${enfasis}» es ${mancha}: o desapareció o dejó de ser contexto y tapa la curva`,
    );
  }
}

// =================================================================================================
// A-15 · clase A12 (la promesa vs lo entregado) · el pie del gráfico no dice qué son las manchas
// =================================================================================================

/**
 * Al añadir las bandas, el `aria-label` del `<svg>` se amplió para enumerarlas («Franjas
 * sombreadas: periodo mayor de 02:12 a 04:12; …»). El `<figcaption>`, que es el único texto que ve
 * quien mira el gráfico, se quedó como estaba: «Entre 0,43 m y 3,54 m sobre el cero del puerto».
 *
 * La asimetría es la prueba de que es un olvido y no una decisión: quien no ve el SVG recibe la
 * explicación completa y quien lo ve recibe cuatro manchas sin leyenda. Y la sección que las explica
 * va **después** del bloque de sol y luna (`order: 20`), así que en móvil median dos pantallas entre
 * la mancha y su significado.
 *
 * Comportamiento correcto: si el gráfico publica bandas, su pie visible dice qué son.
 */
async function elPieDelGraficoExplicaLasBandas(): Promise<void> {
  exigirBuild();
  const mudos: string[] = [];
  let conBandas = 0;
  for (const { slug, html } of await paginasDePuerto()) {
    if (!html.includes('class="grafico__banda"')) continue;
    conBandas += 1;
    const pie = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/.exec(html)?.[1];
    assert.ok(pie, `${slug}: el gráfico no tiene figcaption`);
    if (!/sombread|franja|banda|periodo|solunar/i.test(pie)) {
      mudos.push(`${slug} → «${pie.replace(/\s+/g, " ").trim()}»`);
    }
  }
  assert.ok(conBandas > 0, "ninguna página construida publicó bandas: el ataque no se pudo juzgar");
  assert.ok(
    mudos.length === 0,
    `páginas con bandas cuyo pie visible no las nombra: ${mudos.join(" · ")}`,
  );
}

// =================================================================================================
// A-16 · clase A12/A6 · el rótulo que califica la cifra escapa a los textos auditados
// =================================================================================================

/**
 * `textos.ts` declara en su cabecera por qué existe: los textos de la sección viven ahí «y no en la
 * plantilla» porque «son requisito de producto», con la regla explícita «aquí no se promete pesca» y
 * un test que vigila su contenido (`actividad.test.ts` ancla las frases y prohíbe
 * `/garantiz|infalible|picarán|asegura que/i`).
 *
 * El rótulo que califica la cifra —«Actividad prevista por la convención», el texto que dice al
 * lector QUÉ es ese 90— está escrito a mano en `ActividadSolunar.astro`, fuera del package. La
 * regla no lo alcanza. Verificado ejecutando el ataque: sustituido por «Hoy pican seguro», las 12
 * páginas lo publican y la suite entera queda en verde (344 pass / 0 fail) con el lint limpio.
 *
 * Comportamiento correcto: el rótulo que califica el rating es uno de los textos auditados del
 * módulo, para que la regla que prohíbe prometer capturas lo cubra como cubre a los demás.
 */
async function elRotuloDelRatingSaleDeLosTextosAuditados(): Promise<void> {
  exigirBuild();
  const auditados = new Set(
    Object.values(fishing).filter((valor): valor is string => typeof valor === "string"),
  );
  const fuera: string[] = [];
  for (const { slug, html } of await paginasDePuerto()) {
    const veredicto = /<p class="solunar__veredicto">([\s\S]*?)<\/p>/.exec(html)?.[1];
    assert.ok(veredicto, `${slug}: no se encontró el veredicto del rating en la página`);
    const rotulo = /<span class="etiqueta">([\s\S]*?)<\/span>/.exec(veredicto)?.[1]?.trim();
    assert.ok(rotulo, `${slug}: el veredicto no lleva rótulo`);
    if (!auditados.has(rotulo)) fuera.push(`${slug} → «${rotulo}»`);
  }
  assert.ok(
    fuera.length === 0,
    "rótulos del rating que no son constantes auditadas de @mareia/module-fishing " +
      `(la regla «aquí no se promete pesca» no los cubre): ${fuera.join(" · ")}`,
  );
}

// =================================================================================================

gatePermanente(
  "A-13 · la sección de módulo se expone como región, igual que las otras siete",
  todaSeccionDeBloqueTieneNombreAccesible,
);
gatePermanente(
  "A-14 · las bandas se ven sobre el fondo y la mayor se distingue de la menor",
  lasBandasSeVenYSeDistinguenEntreSi,
);
gatePermanente(
  "A-15 · el pie visible del gráfico dice qué son las franjas sombreadas",
  elPieDelGraficoExplicaLasBandas,
);
gatePermanente(
  "A-16 · el rótulo que califica el rating es un texto auditado del módulo",
  elRotuloDelRatingSaleDeLosTextosAuditados,
);
