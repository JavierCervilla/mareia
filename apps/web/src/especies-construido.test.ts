/**
 * El catálogo de especies **tal y como se publica**: contra el `dist/`, y contra el dataset del que
 * sale.
 *
 * Un test sobre la función que compone las filas demuestra la función. Lo que le cuesta algo a quien
 * lee es lo que llega **al HTML**, y entre una cosa y otra hay una plantilla que puede olvidarse de
 * pintar un nombre o sacar una cifra de su frase sin que ninguna función se entere. Por eso los dos
 * gates de este carril se miden aquí:
 *
 * - **E1 · nadie sustituye al BOE**: el nombre legal aparece **literal** en todas las filas. Si en
 *   alguna sólo está el aceptado, rojo.
 * - **E4 · la presencia no se lee como abundancia**: ninguna página publica un número de registros
 *   sin su frase de sesgo **en el mismo bloque**. No «en la página»: en el elemento más interno que
 *   contiene la cifra, que es donde va a parar quien copia una fila o quien la escucha con un lector
 *   de pantalla.
 *
 * Sin `dist/` se salta en vez de dar un rojo falso: CI construye antes de testear (job `web`).
 */

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  anclaDeCaladero,
  censoDelCatalogo,
  ID_SECCION_ESPECIES,
  LA_PRESENCIA_NO_ES_ABUNDANCIA,
  SESGO_JUNTO_A_LA_CIFRA,
  SIN_REGISTROS,
} from "@mareia/module-species";

import { cargarPuertos } from "./datos/catalogo.ts";
import { cargarCatalogoDeEspecies } from "./modulos/especies/catalogo.ts";
import { rutaPuerto, RUTA_ESPECIES } from "./rutas.ts";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIST = join(AQUI, "..", "dist");
const PORTADA = join(DIST, "index.html");
const CATALOGO = join(DIST, "pesca", "especies", "index.html");
const HOJA = join(AQUI, "estilos", "especies.css");
const HAY_BUILD = existsSync(PORTADA);
const SIN_BUILD = "no hay apps/web/dist: corre antes `pnpm --filter web build`";

/** Lo que el navegador leería: sin marcado y con las entidades resueltas. */
function textoDe(fragmento: string): string {
  return fragmento
    .replace(/<[^>]*>/gu, " ")
    .replace(/&#(\d+);/gu, (_, codigo: string) => String.fromCodePoint(Number(codigo)))
    .replace(/&quot;/gu, '"')
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&")
    .replace(/\s+/gu, " ")
    .trim();
}

/** La fila de una especie dentro del catálogo, con su marcado. */
function filaDe(html: string, clave: string): string | undefined {
  const patron = new RegExp(`<tr data-especie="${clave}"[^>]*>([\\s\\S]*?)</tr>`, "u");
  return patron.exec(html)?.[1];
}

/** Todas las páginas HTML construidas, con su ruta relativa. */
function paginasConstruidas(desde: string = DIST, prefijo = ""): readonly [string, string][] {
  return readdirSync(desde, { withFileTypes: true }).flatMap((entrada): [string, string][] => {
    if (entrada.isDirectory()) {
      return [...paginasConstruidas(join(desde, entrada.name), `${prefijo}/${entrada.name}`)];
    }
    if (!entrada.name.endsWith(".html")) return [];
    return [[`${prefijo}/${entrada.name}`, readFileSync(join(desde, entrada.name), "utf8")]];
  });
}

/** Elementos que no cierran, para que el recorrido de etiquetas no desequilibre la pila. */
const SIN_CIERRE = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr",
]);

/**
 * El elemento **más interno** que contiene una posición del HTML.
 *
 * Es lo que hace que el gate E4 mida lo que dice medir. Con un barrido de la página entera, un
 * número desnudo en su propio `<span>` pasaría en verde mientras la frase de sesgo estuviera en
 * cualquier otro sitio del documento —incluido un pie al que nadie baja—; con el bloque más interno,
 * la cifra y su sesgo tienen que ir **juntos**, que es la promesa. Es el mismo criterio con el que
 * T-19 exige la nota dentro de la fila de su talla y no en el pie del anexo.
 */
function bloqueMasInterno(html: string, posicion: number): string {
  const pila: { nombre: string; desde: number }[] = [];
  let mejor: string | null = null;
  let mejorDesde = -1;
  for (const etiqueta of html.matchAll(/<(\/?)([a-zA-Z][^\s/>]*)([^>]*)>/gu)) {
    const indice = etiqueta.index;
    const nombre = (etiqueta[2] ?? "").toLowerCase();
    const cierra = etiqueta[1] === "/";
    const suelta = SIN_CIERRE.has(nombre) || (etiqueta[3] ?? "").trimEnd().endsWith("/");
    if (suelta) continue;
    if (!cierra) {
      pila.push({ nombre, desde: indice });
      continue;
    }
    const abierto = pila.pop();
    if (abierto === undefined) continue;
    const hasta = indice + etiqueta[0].length;
    if (abierto.desde <= posicion && posicion < hasta && abierto.desde > mejorDesde) {
      mejor = html.slice(abierto.desde, hasta);
      mejorDesde = abierto.desde;
    }
  }
  return mejor ?? html;
}

/** Cualquier número de registros publicado, sea cual sea la página. */
const CIFRA_DE_REGISTROS = /(\d[\d.,]*)\s+registros?\b/gu;

// =================================================================================================
// EL GATE E1 · nadie sustituye al BOE
// =================================================================================================

test("E1 · el nombre de la norma está LITERAL en las 86 filas del catálogo", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const html = readFileSync(CATALOGO, "utf8");
  const catalogo = await cargarCatalogoDeEspecies();
  const sinNombreLegal: string[] = [];
  for (const especie of catalogo.especies) {
    const fila = filaDe(html, especie.clave);
    if (fila === undefined) {
      sinNombreLegal.push(`${especie.nombreBoe}: la fila no se publica`);
      continue;
    }
    // El nombre del BOE, tal cual lo escribe la norma: con su tilde imposible, con su `spp` y con
    // su errata. Buscarlo normalizado sería aceptar que la página publique una versión limpia.
    if (!textoDe(fila).includes(especie.nombreBoe)) {
      sinNombreLegal.push(`${especie.nombreBoe}: «${textoDe(fila).slice(0, 120)}»`);
    }
  }
  assert.deepEqual(
    sinNombreLegal,
    [],
    "filas que no publican el nombre con el que la norma nombra a la especie, que es el que tiene " +
      "consecuencia legal",
  );
  const filas = html.match(/<tr data-especie="/gu) ?? [];
  assert.equal(filas.length, catalogo.especies.length, "el catálogo publica otras tantas filas");
  t.diagnostic(`${catalogo.especies.length} especies con su nombre del BOE literal`);
});

test("E1 · donde los dos nombres difieren se publican LOS DOS, y el legal no se pierde", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const html = readFileSync(CATALOGO, "utf8");
  const catalogo = await cargarCatalogoDeEspecies();
  const distintas = catalogo.especies.filter(
    (especie) => especie.worms !== null && especie.worms.aceptado !== null,
  );
  // El censo lo cuenta el módulo desde el mismo dataset: si el número cambia, cambia por la fuente.
  assert.equal(distintas.length, censoDelCatalogo(catalogo).conAceptadoDistinto);
  assert.ok(distintas.length > 0, "ninguna especie con nombre aceptado distinto: mira el dataset");
  for (const especie of distintas) {
    const leido = textoDe(filaDe(html, especie.clave) ?? "");
    assert.ok(leido.includes(especie.nombreBoe), `${especie.nombreBoe}: falta el nombre de la norma`);
    const aceptado = especie.worms?.aceptado?.nombre ?? "";
    assert.ok(leido.includes(aceptado), `${especie.nombreBoe}: falta el aceptado (${aceptado})`);
    // Y la fila dice POR QUÉ difieren, en vez de dejar dos nombres uno al lado del otro.
    assert.match(leido, /remite a/u, `${especie.nombreBoe}: los dos nombres sin explicar`);
  }
  t.diagnostic(`${distintas.length} especies con el nombre aceptado distinto del de la norma`);
});

// =================================================================================================
// EL GATE E4 · la presencia no se lee como abundancia
// =================================================================================================

test("E4 · ninguna página publica un número de registros sin su frase de sesgo al lado", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const desnudas: string[] = [];
  let comprobadas = 0;
  for (const [ruta, html] of paginasConstruidas()) {
    for (const cifra of html.matchAll(CIFRA_DE_REGISTROS)) {
      comprobadas += 1;
      const bloque = bloqueMasInterno(html, cifra.index);
      if (!textoDe(bloque).includes(SESGO_JUNTO_A_LA_CIFRA)) {
        desnudas.push(`${ruta} → «${textoDe(bloque).slice(0, 160)}»`);
      }
    }
  }
  assert.deepEqual(
    desnudas,
    [],
    "cifras de registros publicadas sin decir que miden esfuerzo de muestreo. Un número de OBIS " +
      "sin eso se lee como abundancia, y entonces «12» dice que en toda Galicia hay doce doradas",
  );
  assert.ok(comprobadas > 0, "ninguna cifra de registros medida: el gate no está mirando nada");
  t.diagnostic(`${comprobadas} cifras de registros, todas con su sesgo en el mismo bloque`);
});

test("E4 · la explicación larga va antes de la primera cifra, y el cero no se publica como cifra", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const html = readFileSync(CATALOGO, "utf8");
  const leido = textoDe(html);
  // La frase larga (con la dorada gallega dentro) va arriba y la corta pegada a cada cifra: una
  // coletilla sola no explica por qué 12 no significa doce doradas, y un párrafo arriba no viaja
  // con la fila que alguien copia.
  assert.match(leido, /La dorada en toda la costa gallega son 12 registros/u);
  // Y va ANTES de la primera cifra de la página. Se compara contra el arranque de la propia
  // constante y no contra una frase copiada aquí: un gate que teclea el texto que vigila deja de
  // vigilarlo en cuanto alguien reescribe el original.
  const explicacion = leido.indexOf(textoDe(LA_PRESENCIA_NO_ES_ABUNDANCIA).slice(0, 60));
  const primeraCifra = /\d[\d.,]*\s+registros?\b/u.exec(leido)?.index ?? -1;
  assert.ok(explicacion >= 0, "la página no publica la explicación larga");
  assert.ok(
    primeraCifra >= 0 && explicacion <= primeraCifra,
    "hay una cifra de registros por encima de la explicación de qué mide OBIS",
  );
  // Y el cero no existe como cifra: sin registros se publica el motivo.
  assert.ok(!/\b0 registros\b/u.test(leido), "se publica un «0 registros», que se lee como ausencia medida");
  const catalogo = await cargarCatalogoDeEspecies();
  const vacios = catalogo.especies.flatMap((especie) =>
    especie.caladeros.filter((caladero) => caladero.presencia === null),
  );
  if (vacios.length > 0) assert.ok(leido.includes(textoDe(SIN_REGISTROS)));
  t.diagnostic(`${vacios.length} pares especie-caladero sin ningún registro en OBIS`);
});

// =================================================================================================
// Lo que la página promete de sí misma
// =================================================================================================

test("el filtro por caladero es CSS puro y tiene reglas para TODOS los caladeros del catálogo", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const hoja = readFileSync(HOJA, "utf8");
  const html = readFileSync(CATALOGO, "utf8");
  const censo = censoDelCatalogo(await cargarCatalogoDeEspecies());
  // Un selector de atributo no puede leer un valor que sale del dataset, así que los tres
  // identificadores están escritos a mano en la hoja. Esto es lo que impide que un cuarto caladero
  // rompa el filtro EN SILENCIO: la opción se pintaría y no escondería nada.
  for (const caladero of censo.caladeros) {
    const ancla = anclaDeCaladero(caladero.id);
    assert.ok(html.includes(`id="${ancla}"`), `${caladero.id}: falta su ancla en la página`);
    assert.ok(html.includes(`href="#${ancla}"`), `${caladero.id}: falta su opción de filtro`);
    assert.ok(hoja.includes(`#${ancla}:target`), `${caladero.id}: no tiene reglas en especies.css`);
    assert.ok(
      hoja.includes(`[data-caladeros~="${caladero.id}"]`),
      `${caladero.id}: la hoja no esconde las especies que no regula`,
    );
  }
  t.diagnostic(`${censo.caladeros.length} caladeros con filtro`);
});

test("el catálogo no trae JavaScript: sólo el JSON-LD, que son datos y no código", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const html = readFileSync(CATALOGO, "utf8");
  const scripts = [...html.matchAll(/<script\b([^>]*)>/gu)].map((etiqueta) => etiqueta[1] ?? "");
  assert.deepEqual(
    scripts.filter((atributos) => !atributos.includes('type="application/ld+json"')),
    [],
    "la página del catálogo trae JavaScript de cliente",
  );
  assert.ok(!/\son[a-z]+=/iu.test(html), "la página trae un manejador en línea");
});

test("las 153 páginas de puerto enlazan al catálogo filtrado por SU caladero", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const catalogo = await cargarCatalogoDeEspecies();
  const caladeros = new Set(
    catalogo.especies.flatMap((especie) => especie.caladeros.map((caladero) => caladero.id)),
  );
  let comprobadas = 0;
  for (const puerto of await cargarPuertos()) {
    const html = readFileSync(join(DIST, rutaPuerto(puerto), "index.html"), "utf8");
    const abre = html.indexOf(`<section id="${ID_SECCION_ESPECIES}"`);
    assert.ok(abre >= 0, `${puerto.slug}: la página no publica la sección del catálogo`);
    const seccion = html.slice(abre, html.indexOf("</section>", abre));
    const enlace = new RegExp(`href="${RUTA_ESPECIES}#(cal-[a-z0-9-]+)"`, "u").exec(seccion)?.[1];
    assert.ok(enlace !== undefined, `${puerto.slug}: la sección no enlaza al catálogo filtrado`);
    // El ancla tiene que ser la de un caladero REAL del catálogo: un enlace a un ancla que no
    // existe no se ve —la página abre entera, sin filtrar— y es el fallo más fácil de no notar.
    assert.ok(
      [...caladeros].some((id) => anclaDeCaladero(id) === enlace),
      `${puerto.slug}: enlaza a ${enlace}, que no es ningún caladero del catálogo`,
    );
    // Y la sección dice que eso no se guarda con el puerto, porque el módulo no declara `offline`.
    assert.match(textoDe(seccion), /El catálogo no se guarda con este puerto/u, puerto.slug);
    comprobadas += 1;
  }
  assert.ok(comprobadas >= 120, `sólo ${comprobadas} páginas de puerto comprobadas`);
  t.diagnostic(`${comprobadas} páginas de puerto con su enlace al catálogo`);
});

test("cero juice sobre una cifra: la hoja del catálogo no anima ni destaca nada", (t) => {
  // El brief ya prohíbe el motion (§6) y la gamificación del dato (§3). Aquí hay dos clases de
  // cifra que aguantan mal el énfasis —una talla legal y un recuento de esfuerzo de muestreo—, así
  // que se mide en vez de confiarse.
  const hoja = readFileSync(HOJA, "utf8");
  for (const prohibido of ["@keyframes", "animation", "transition", "box-shadow", "border-radius"]) {
    assert.ok(!hoja.includes(prohibido), `la hoja del catálogo usa ${prohibido}`);
  }
  // La mancha de terracota, que el brief reserva al coeficiente y a los avisos, sólo puede caer en
  // el aviso de la sección. Nunca sobre una cifra.
  const conTerracota = [...hoja.matchAll(/^\.([\w-]+)[^{]*\{[^}]*--m-terra[^}]*\}/gmu)].map(
    (coincidencia) => coincidencia[1],
  );
  assert.deepEqual(conTerracota, ["especies__aviso"]);
  t.diagnostic(`hoja de especies.css: ${hoja.length} bytes`);
});
