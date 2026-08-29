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
 * - **A-13** · la sección que aporta el módulo es la única de la página sin nombre accesible.
 * - **A-14** · las bandas se dibujan a 1,30:1 y 1,14:1 sobre el fondo; mayor y menor se distinguen
 *   por 1,14:1, en los dos temas.
 * - **A-15** · el pie visible del gráfico no dice qué son esas manchas; el `aria-label` sí.
 * - **A-16** · el rótulo que califica la cifra vive fuera de los textos auditados, así que la regla
 *   «aquí no se promete pesca» no lo alcanza.
 *
 * Informe: `docs/qa/informe-adversario-t10.md` (promesa, clases atacadas, hallazgos, no
 * reproducidos y bundle).
 *
 * TRINQUETE — `test.fail()` es de Playwright y aquí el arnés es `node --test`; el equivalente es
 * `hallazgoAbierto()`, que estrenó el pase de T-09 y mantiene la misma tabla de verdad: el cuerpo
 * afirma **el comportamiento correcto**, CI se queda verde mientras el hallazgo esté abierto
 * (imprimiendo el motivo como diagnóstico en cada ejecución) y se pone **rojo el día que alguien lo
 * arregle**, pidiendo que se retire el trinquete para que el ataque quede como gate permanente.
 * Mismo caveat que documenta la skill: se conforma con que el cuerpo falle **por cualquier motivo**,
 * así que cada assert es específico y el motivo se imprime en cada run — un selector podrido se ve.
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
 * TRINQUETE. Envuelve un cuerpo que afirma el comportamiento CORRECTO de un hallazgo **abierto**.
 *
 * | Estado del hallazgo | Resultado del run | CI |
 * |---|---|---|
 * | abierto | el cuerpo falla → se imprime el motivo como diagnóstico | 🟢 |
 * | arreglado | el cuerpo pasa → este test **falla** pidiendo retirar el trinquete | 🔴 |
 * | arreglado y trinquete retirado | el cuerpo pasa | 🟢 gate permanente |
 */
function hallazgoAbierto(nombre: string, cuerpo: () => Promise<void> | void): void {
  test(`${nombre} · TRINQUETE (hallazgo abierto)`, async (t: TestContext) => {
    let motivo: string | undefined;
    try {
      await cuerpo();
    } catch (error) {
      if (error instanceof SinDatos) {
        t.skip(error.message);
        return;
      }
      motivo = error instanceof Error ? error.message : String(error);
    }
    assert.ok(
      motivo !== undefined,
      `«${nombre}» YA NO FALLA: si el hallazgo está corregido, quita el trinquete ` +
        "(`hallazgoAbierto` → `test`) y deja el cuerpo como gate permanente.",
    );
    t.diagnostic(`${nombre} sigue abierto — ${motivo}`);
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

/** La opacidad con la que el CSS pinta una banda de cada énfasis. */
function opacidadDeBanda(css: string, enfasis: string): number {
  const encontrado = new RegExp(
    `\\.grafico__banda\\[data-enfasis="${enfasis}"\\]\\s*\\{[^}]*opacity:\\s*([\\d.]+)`,
  ).exec(css);
  assert.ok(encontrado, `el CSS no declara la opacidad de la banda «${enfasis}»`);
  return Number(encontrado[1]);
}

/**
 * Las bandas son el elemento visual que estrena T-10 y el único sitio del gráfico donde se lee un
 * periodo solunar. El brief exige 4,5:1 para el texto «porque esta página se lee al sol» y WCAG
 * 1.4.11 pide 3:1 a los objetos gráficos que portan información.
 *
 * Medido sobre los tokens publicados y confirmado leyendo los píxeles renderizados por Chromium en
 * los dos temas: la banda fuerte queda en 1,30:1 (claro) / 1,27:1 (noche) y la suave en 1,14:1 /
 * 1,11:1. Y la distinción mayor↔menor —lo único que dice cuál de las cuatro manchas es la que la
 * convención considera buena— viaja entera en un 1,14:1 de opacidad, un canal exclusivamente de
 * color.
 *
 * Comportamiento correcto: una banda se distingue de su fondo y una banda mayor se distingue de una
 * menor, en los dos temas, por encima del umbral de objeto gráfico.
 *
 * Caveat del trinquete: si algún día la distinción se resuelve con un canal no cromático (trama,
 * filete, rótulo) en vez de subiendo el contraste, este cuerpo hay que reescribirlo — no basta con
 * retirarlo.
 */
function lasBandasSeVenYSeDistinguenEntreSi(): void {
  exigirBuild();
  const tokens = readFileSync(TOKENS_CSS, "utf8");
  const pagina = readFileSync(PAGINA_CSS, "utf8");

  assert.match(
    pagina,
    /\.grafico__banda\s*\{[^}]*fill:\s*var\(--m-terra\)/,
    "la banda ya no se pinta con --m-terra: revisa este ataque antes de darlo por cerrado",
  );

  const inicioNoche = tokens.indexOf("@media (prefers-color-scheme: dark)");
  assert.ok(inicioNoche > 0, "tokens.css ya no declara el tema noche por preferencia del sistema");
  const temas = [
    { nombre: "claro", desde: tokens.indexOf(":root {") },
    { nombre: "noche", desde: inicioNoche },
  ];
  const opacidades = [
    { enfasis: "fuerte", alfa: opacidadDeBanda(pagina, "fuerte") },
    { enfasis: "suave", alfa: opacidadDeBanda(pagina, "suave") },
  ];

  const flojos: string[] = [];
  for (const tema of temas) {
    const fondo = tokenOklch(tokens, "--m-bg", tema.desde);
    const terra = tokenOklch(tokens, "--m-terra", tema.desde);
    const compuestas = opacidades.map((o) => ({ ...o, color: componer(terra, fondo, o.alfa) }));
    for (const banda of compuestas) {
      const razon = contraste(banda.color, fondo);
      if (razon < CONTRASTE_MINIMO_OBJETO_GRAFICO) {
        flojos.push(`${tema.nombre}/${banda.enfasis} vs fondo = ${razon.toFixed(2)}:1`);
      }
    }
    const [fuerte, suave] = compuestas as [(typeof compuestas)[0], (typeof compuestas)[0]];
    const entreSi = contraste(fuerte.color, suave.color);
    if (entreSi < CONTRASTE_MINIMO_OBJETO_GRAFICO) {
      flojos.push(`${tema.nombre}/mayor vs menor = ${entreSi.toFixed(2)}:1`);
    }
  }
  assert.ok(
    flojos.length === 0,
    `bandas por debajo de ${CONTRASTE_MINIMO_OBJETO_GRAFICO}:1 (WCAG 1.4.11): ${flojos.join(" · ")}`,
  );
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

hallazgoAbierto(
  "A-13 · la sección de módulo se expone como región, igual que las otras siete",
  todaSeccionDeBloqueTieneNombreAccesible,
);
hallazgoAbierto(
  "A-14 · las bandas se ven sobre el fondo y la mayor se distingue de la menor",
  lasBandasSeVenYSeDistinguenEntreSi,
);
hallazgoAbierto(
  "A-15 · el pie visible del gráfico dice qué son las franjas sombreadas",
  elPieDelGraficoExplicaLasBandas,
);
hallazgoAbierto(
  "A-16 · el rótulo que califica el rating es un texto auditado del módulo",
  elRotuloDelRatingSaleDeLosTextosAuditados,
);
