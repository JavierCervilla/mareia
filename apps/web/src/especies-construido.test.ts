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
 * - **E7 · ninguna cifra legal sin su excepción**: toda talla con una nota al pie en la norma la
 *   publica **entera y en el mismo bloque** que la cifra, y ninguna marca impresa se queda sin pie.
 *   Es la regla de T-19 sobre la superficie nueva, y está aquí porque T-20 la reintrodujo.
 * - **E8 · la fila que la tabla no publica dice por qué**: las filas del BOE sin nombre científico
 *   se nombran en la página, con su motivo y su talla, en vez de desaparecer en silencio.
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
  NO_SE_PREGUNTO_A_OBIS,
  SESGO_JUNTO_A_LA_CIFRA,
  SIN_REGISTROS,
} from "@mareia/module-species";

import { cargarPuertos } from "./datos/catalogo.ts";
import { DATA_DIR } from "./datos/deps.ts";
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
  // `[^>]*` **antes** del atributo, no sólo después: T-27 añadió `role="row"` delante de
  // `data-especie` para que el apilado en fichas no le quite la semántica de tabla a un lector de
  // pantalla, y este patrón —que exigía que `data-especie` fuese el primer atributo— dejó de casar.
  // Los 86 gates E1/E7 se pusieron rojos diciendo «la fila no se publica» cuando las filas estaban
  // enteras: un gate atado al ORDEN de los atributos denuncia el marcado, no el dato.
  const patron = new RegExp(`<tr[^>]*data-especie="${clave}"[^>]*>([\\s\\S]*?)</tr>`, "u");
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
  const filas = html.match(/<tr[^>]*data-especie="/gu) ?? [];
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
  // Los dos silencios se cuentan aparte porque no dicen lo mismo, y sólo el primero lleva la frase
  // de `SIN_REGISTROS`: al segundo no se le preguntó a OBIS, así que decir que nadie lo ha anotado
  // ahí sería afirmar de la fuente algo que no hemos comprobado.
  const sinRegistros = catalogo.especies.flatMap((especie) =>
    especie.caladeros.filter(
      (caladero) => caladero.presencia === null && caladero.seLePreguntoAObis,
    ),
  );
  const sinPreguntar = catalogo.especies.flatMap((especie) =>
    especie.caladeros.filter((caladero) => !caladero.seLePreguntoAObis),
  );
  if (sinRegistros.length > 0) assert.ok(leido.includes(textoDe(SIN_REGISTROS)));
  // Y la del silencio sin consulta se busca **como constante del código**, no como la cadena que
  // trae el dataset. Esta comprobación se medía antes contra el propio dato y por eso no vio nada
  // cuando el pase adversario de T-20 plantó ahí «OBIS confirma que la especie no está presente en
  // este caladero»: un gate que se compara contra el valor que vigila aprueba cualquier valor.
  if (sinPreguntar.length > 0) {
    assert.ok(
      leido.includes(textoDe(NO_SE_PREGUNTO_A_OBIS)),
      "una consulta que no se hizo se publica con su motivo, no con el de cero registros",
    );
  }
  t.diagnostic(
    `${sinRegistros.length} pares especie-caladero sin ningún registro en OBIS y ` +
      `${sinPreguntar.length} a los que no se les preguntó`,
  );
});

// =================================================================================================
// EL GATE E7 · ninguna cifra legal sin la excepción que la cambia
// =================================================================================================
//
// Es la regla de T-19 —«la nota viaja pegada a la cifra y se pinta con ella, siempre»— medida sobre
// la superficie nueva, y existe porque T-20 la reintrodujo: el catálogo publicaba «36 cm» para la
// lubina, imprimía dentro del literal citado la llamada «36 (***)» y **no publicaba ningún pie en
// toda la página**, mientras la página de puerto del mismo `dist/` publicaba la nota entera. El
// peor de los tres casos era el pulpo, cuyo literal es «1 kg» sin marca: nada dejaba rastro de que
// en Baleares esa cifra no rige.
//
// Dos cosas lo hacen medir de verdad. **El texto entero, no la marca**: es lo que convierte 36 en
// 44, y un gate que se conformara con el asterisco aprobaría exactamente el defecto que persigue. Y
// **en el mismo bloque que la cifra**, no en la página: quien copia una fila se lleva lo que hay en
// ella, y un pie al final de la página no viaja con la fila ni lo oye quien recorre la tabla con un
// lector de pantalla.
//
// El texto de las notas se lee de `normativa/v1` **por su propia cuenta**, sin pasar por el
// adaptador que las resuelve: si el gate las pidiera por donde las pide la página, un fallo en esa
// resolución se confirmaría a sí mismo.

/** El literal de las notas de cada anexo, leído del derivado de la norma sin intermediarios. */
function notasDeLaNorma(): Map<string, Map<string, string>> {
  const norma = JSON.parse(readFileSync(`${DATA_DIR}/normativa/tallas-minimas.json`, "utf8")) as {
    caladeros: readonly {
      id: string;
      notas: readonly { marca: string; texto: string }[];
    }[];
  };
  return new Map(
    norma.caladeros.map((caladero) => [
      caladero.id,
      new Map(caladero.notas.map((nota) => [nota.marca, nota.texto])),
    ]),
  );
}

/** Los `<li>` de una fila: uno por caladero, que es el bloque en el que va la cifra con su nota. */
function bloquesDeCaladero(fila: string): readonly string[] {
  return [...fila.matchAll(/<li>([\s\S]*?)<\/li>/gu)].map((bloque) => bloque[1] ?? "");
}

test("E7 · toda cifra legal del catálogo publica, en su bloque, la nota entera que la modifica", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const html = readFileSync(CATALOGO, "utf8");
  const catalogo = await cargarCatalogoDeEspecies();
  const notas = notasDeLaNorma();
  const mudas: string[] = [];
  let comprobadas = 0;
  for (const especie of catalogo.especies) {
    const fila = filaDe(html, especie.clave) ?? "";
    const bloques = bloquesDeCaladero(fila);
    for (const caladero of especie.caladeros) {
      // El bloque de ESE caladero: es donde tiene que estar la nota, no en cualquier sitio de la
      // fila y mucho menos en cualquier sitio de la página.
      const bloque = bloques.find((candidato) => textoDe(candidato).includes(caladero.nombre)) ?? "";
      for (const talla of caladero.tallas) {
        for (const marca of talla.notas.map((nota) => nota.marca)) {
          // El texto se saca de la norma y no del catálogo ya adaptado: es la lectura independiente.
          const texto = notas.get(caladero.id)?.get(marca);
          assert.ok(
            texto !== undefined,
            `${especie.nombreBoe} · ${caladero.nombre}: la marca ${marca} no existe en el anexo`,
          );
          comprobadas += 1;
          if (!textoDe(bloque).includes(texto)) {
            mudas.push(
              `${especie.nombreBoe} · ${caladero.nombre} · «${talla.textoOriginal}» → falta ` +
                `«${texto.slice(0, 70)}…»`,
            );
          }
        }
      }
    }
  }
  assert.deepEqual(
    mudas,
    [],
    "cifras legales publicadas en el catálogo sin la excepción que la norma les pone en el mismo " +
      "bloque. La página de puerto de esos caladeros sí la publica, así que el sitio se " +
      "contradice consigo mismo sobre una cifra que se cita en una inspección",
  );
  assert.ok(comprobadas > 0, "ninguna nota medida: el gate no está mirando nada");
  t.diagnostic(`${comprobadas} cifras con excepción, todas con su nota entera en su bloque`);
});

test("E7 · ninguna marca impresa en el catálogo se queda sin el pie al que llama", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const leido = textoDe(readFileSync(CATALOGO, "utf8"));
  const catalogo = await cargarCatalogoDeEspecies();
  const notas = notasDeLaNorma();
  const huerfanas: string[] = [];
  let impresas = 0;
  for (const especie of catalogo.especies) {
    for (const caladero of especie.caladeros) {
      for (const talla of caladero.tallas) {
        // Sólo cuenta la marca que la página IMPRIME, que es la del literal citado de la celda del
        // BOE («el BOE imprime «36 (***)»»). Una llamada sin pie es la propia página avisando de
        // que ahí falta algo y no diciendo qué, que es peor que la cifra sola.
        for (const marca of talla.notas.map((nota) => nota.marca)) {
          if (!talla.textoOriginal.includes(marca)) continue;
          if (!leido.includes(`el BOE imprime «${talla.textoOriginal}»`)) continue;
          impresas += 1;
          const texto = notas.get(caladero.id)?.get(marca) ?? "";
          if (texto === "" || !leido.includes(texto)) {
            huerfanas.push(`${especie.nombreBoe} · ${caladero.nombre} · ${marca}`);
          }
        }
      }
    }
  }
  assert.deepEqual(huerfanas, [], "marcas de nota impresas sin ningún pie que las explique");
  assert.ok(impresas > 0, "la página no imprime ninguna marca: el gate no está mirando nada");
  t.diagnostic(`${impresas} marcas impresas, todas con su pie`);
});

// =================================================================================================
// EL GATE E8 · la fila del BOE que la tabla no publica dice por qué
// =================================================================================================

test("E8 · toda fila del BOE que el catálogo deja fuera se nombra en la página, con su motivo", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const leido = textoDe(readFileSync(CATALOGO, "utf8"));
  const catalogo = await cargarCatalogoDeEspecies();
  const fuera = catalogo.sinNombreCientifico;
  assert.ok(fuera.length > 0, "el dataset no declara ninguna fila fuera: el gate no mide nada");
  for (const fila of fuera) {
    // Las tres cosas, porque las tres hacen falta para que el hueco no se lea como un fallo
    // nuestro: cómo la nombra la norma, por qué no está en la tabla y cuál es su talla, que es
    // igual de obligatoria que las de arriba.
    assert.ok(leido.includes(fila.nombreComun), `${fila.nombreComun}: no se nombra en la página`);
    assert.ok(leido.includes(fila.motivo), `${fila.nombreComun}: no se publica su motivo`);
    assert.ok(
      leido.includes(`el BOE imprime «${fila.textoOriginal}»`),
      `${fila.nombreComun}: no se publica el literal de su talla`,
    );
  }
  // Y la página deja de afirmar que no le falta ninguna fila por decisión nuestra, porque le falta.
  assert.ok(!leido.includes("ni falta ninguna por decisión nuestra"));
  t.diagnostic(`${fuera.length} filas del BOE fuera de la tabla, todas nombradas con su motivo`);
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

// =================================================================================================
// A-T26-2 · la cabecera acortada sigue nombrando las dos cosas que representa
// =================================================================================================

/**
 * **La tercera columna publica dos cosas y su rótulo tiene que nombrar las dos.**
 *
 * T-26 acortó ese rótulo de `CALADEROS QUE LA REGULAN · REGISTROS EN OBIS` a `CALADEROS · OBIS`
 * porque el largo se pintaba en **10 líneas a 3,7 caracteres** en una columna de ~104 px. Acortarlo
 * fue correcto —el detalle sigue entero en cada celda— pero dejó una puerta abierta: **nada
 * comprobaba que el rótulo siguiera nombrando las dos cosas**. Reproducido en el pase adversario
 * quitándole `· OBIS`: el sitio se construía, las 86 filas seguían publicando sus registros, y
 * **ninguno de los 300 tests se enteraba** de que la columna había dejado de decir de dónde salen.
 *
 * La procedencia no es adorno en este portal: una cifra de presencia sin su fuente es exactamente lo
 * que el proyecto no publica. Se comprueba sobre el **HTML construido** y por el sentido —que la
 * cabecera nombre el caladero y nombre OBIS—, no contra la constante que la escribe: si se comparara
 * con `COLUMNA_PRESENCIA`, vaciar esa constante movería el gate con ella (A-T23-2).
 */
test("A-T26-2 · la cabecera de la tercera columna nombra el caladero y su fuente", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const html = readFileSync(CATALOGO, "utf8");
  const cabeceras = [...html.matchAll(/<th scope="col"[^>]*>([\s\S]*?)<\/th>/gu)].map((th) =>
    (th[1] ?? "").replace(/<[^>]+>/gu, " "),
  );
  const tercera = cabeceras[2] ?? "";
  assert.ok(
    /caladero/iu.test(tercera),
    `la tercera cabecera no nombra el caladero: «${tercera.trim()}»`,
  );
  assert.ok(
    /obis/iu.test(tercera),
    `la tercera cabecera no nombra a OBIS, que es de donde salen sus cifras: «${tercera.trim()}»`,
  );
});

// =================================================================================================
// A-T27-1 · los roles explícitos son lo único que sostiene la tabla cuando se apila
// =================================================================================================

/**
 * **La semántica de tabla no sobrevive al apilado por sí sola.**
 *
 * T-27 pinta cada fila como una ficha por debajo de 700 px con `display: block` sobre
 * `table`/`tr`/`th`/`td`. Eso hace que el navegador **retire los roles implícitos**: sin declararlos,
 * quien navega con lector de pantalla deja de tener filas y celdas, y deja de oír la cabecera de la
 * columna junto al dato. Los roles explícitos son la cura estándar y son **inocuos en escritorio**,
 * donde coinciden con la semántica nativa.
 *
 * Este gate existe porque **nada más los vigilaba**: reproducido en el pase adversario quitándolos
 * todos con un `sed` — el sitio se construía, las 86 fichas seguían publicando su texto entero y
 * **ninguno de los ~300 tests se enteraba**. Una regresión de accesibilidad no tiene síntoma visible:
 * si no hay un gate, no hay nadie.
 *
 * Las cuentas **se derivan del catálogo** y no se escriben a mano: con un número mágico, añadir una
 * especie pondría el gate en rojo sin que nada esté mal, y quien lo viera aprendería a subir el
 * número — que es como muere un gate.
 */
test("A-T27-1 · la tabla del catálogo declara sus roles, que es lo que la sostiene apilada", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const html = readFileSync(CATALOGO, "utf8");
  const catalogo = await cargarCatalogoDeEspecies();
  const especies = catalogo.especies.length;
  const cuantos = (rol: string): number =>
    (html.match(new RegExp(`role="${rol}"`, "gu")) ?? []).length;

  assert.deepEqual(
    {
      table: cuantos("table"),
      rowgroup: cuantos("rowgroup"),
      row: cuantos("row"),
      columnheader: cuantos("columnheader"),
      rowheader: cuantos("rowheader"),
      cell: cuantos("cell"),
    },
    {
      table: 1,
      // `thead` y `tbody`.
      rowgroup: 2,
      // La de cabecera más una por especie.
      row: 1 + especies,
      // Las tres columnas.
      columnheader: 3,
      // El nombre de la norma de cada especie, que es la cabecera de su fila.
      rowheader: especies,
      // Taxón y caladeros, dos por especie.
      cell: 2 * especies,
    },
    "sin estos roles, apilar la tabla le quita las filas y las celdas a quien usa un lector de pantalla",
  );
});
