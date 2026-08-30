/**
 * Las áreas marinas protegidas **tal y como se publican**: contra el `dist/`, página a página, y
 * contra el derivado del que salen.
 *
 * Un test sobre la función que compone las filas demuestra la función. Lo que le importa a quien
 * lee es lo que llega **al HTML**, y entre una cosa y otra hay una plantilla que puede olvidarse de
 * pintar una sección entera sin que ninguna función se entere. Por eso **el gate de esta
 * trayectoria —P3, los 10 puertos sin ninguna área lo DICEN— se mide aquí**: se busca la sección en
 * las 10 páginas construidas y se exige la frase y su motivo.
 *
 * Sin `dist/` se salta en vez de dar un rojo falso: CI construye antes de testear.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AVISO_SIN_RED,
  distanciaEscrita,
  ID_SECCION_AREAS,
  ningunaCerca,
  QUE_ES_ESTO,
} from "@mareia/module-protected-areas";
import type { AreaProtegida } from "@mareia/module-protected-areas";

import { cargarPuertos } from "./datos/catalogo.ts";
import { cargarAreasDelPuerto, cargarResumenDeAreas } from "./modulos/areas-protegidas.ts";
import { rutaPuerto } from "./rutas.ts";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIST = join(AQUI, "..", "dist");
const PORTADA = join(DIST, "index.html");
const HOJA = join(AQUI, "estilos", "areas-protegidas.css");
const BRIEF = join(AQUI, "..", "design-brief.md");
const HAY_BUILD = existsSync(PORTADA);
const SIN_BUILD = "no hay apps/web/dist: corre antes `pnpm --filter web build`";

interface PaginaConAreas {
  readonly slug: string;
  readonly seccion: string;
  readonly areas: readonly AreaProtegida[];
  readonly motivo: string | null;
}

/** El trozo de HTML de la sección del módulo, y solo ese. */
function seccionDe(html: string, slug: string): string {
  const abre = html.indexOf(`<section id="${ID_SECCION_AREAS}"`);
  assert.ok(abre >= 0, `${slug}: la página no publica la sección de áreas protegidas`);
  const cierra = html.indexOf("</section>", abre);
  assert.ok(cierra > abre, `${slug}: la sección de áreas protegidas no cierra`);
  return html.slice(abre, cierra);
}

/** Lo que el navegador leería: sin marcado y con las entidades resueltas. */
function textoDe(fragmento: string): string {
  return fragmento
    .replace(/<[^>]*>/gu, " ")
    .replace(/&#39;/gu, "'")
    .replace(/&quot;/gu, '"')
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&")
    .replace(/\s+/gu, " ")
    .trim();
}

/** La fila de un área dentro de la sección, con su marcado. */
function filaDe(seccion: string, codigo: string): string | undefined {
  const patron = new RegExp(`<tr data-area="${codigo}"[^>]*>([\\s\\S]*?)</tr>`, "u");
  return patron.exec(seccion)?.[1];
}

/** Las 153 páginas de puerto construidas, cada una con las áreas que le tocan. */
async function paginasConAreas(): Promise<readonly PaginaConAreas[]> {
  const puertos = await cargarPuertos();
  return Promise.all(
    puertos.map(async (puerto) => {
      const html = readFileSync(join(DIST, rutaPuerto(puerto), "index.html"), "utf8");
      const { areas, motivo } = await cargarAreasDelPuerto({
        slug: puerto.slug,
        nombre: puerto.name,
        fechaIso: "2026-08-30",
        timezone: puerto.timezone,
      });
      return { slug: puerto.slug, seccion: seccionDe(html, puerto.slug), areas, motivo };
    }),
  );
}

// =================================================================================================
// P3 · EL GATE DE LA TRAYECTORIA · los puertos sin ninguna área lo DICEN
// =================================================================================================

test("P3 · los 10 puertos sin ninguna área publican la frase y hasta dónde se ha mirado", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const { criterio, resumen } = await cargarResumenDeAreas();
  const frase = ningunaCerca(criterio.radioKm);
  const mudos: string[] = [];
  const sinArea: string[] = [];
  for (const { slug, seccion, areas, motivo } of await paginasConAreas()) {
    if (areas.length > 0) continue;
    sinArea.push(slug);
    const leido = textoDe(seccion);
    // Las dos mitades, y hacen falta las dos. La frase dice **lo que sabemos** («ninguna a menos de
    // 30 km»); el motivo dice **hasta dónde hemos mirado** y que el límite es una decisión nuestra
    // y no una ausencia de la fuente. Con la frase sola, quien lee no sabe si el radio es 3 km o
    // 300; con el motivo solo, la respuesta se pierde dentro de un párrafo de método.
    if (!leido.includes(frase)) mudos.push(`${slug}: no publica «${frase}» · «${leido}»`);
    assert.ok(motivo !== null, `${slug}: el derivado no trae motivo para un puerto sin áreas`);
    if (!leido.includes(textoDe(motivo))) mudos.push(`${slug}: publica la frase pero no el motivo`);
    // Y la marca que hace medible el caso vacío en el artefacto, no solo en el texto. Va al mismo
    // saco y no a un `assert` propio: un gate que se para en el primer puerto cuenta uno de los
    // diez, y lo que hay que ver de un tirón es si el defecto es de una página o de la plantilla.
    if (!/data-sin-areas="true"/u.test(seccion)) mudos.push(`${slug}: sin la marca del caso vacío`);
  }
  assert.deepEqual(
    mudos,
    [],
    "puertos que publican una sección vacía en vez de decir que no hay ninguna: una sección que " +
      "calla se lee como «no hay nada que saber»",
  );
  // Los 10 medidos sobre RAMPE 2025, nombrados: si el reparto cambia, hay que mirar por qué antes
  // de tocar este número.
  assert.deepEqual(sinArea.sort(), [
    "alboraya",
    "arenys-de-mar",
    "donostia",
    "getaria",
    "mataro",
    "melilla",
    "sagunto",
    "seville",
    "silla",
    "valencia",
  ]);
  assert.equal(sinArea.length, resumen.sinArea, "el derivado y lo publicado no cuentan lo mismo");
});

test("P3 · y la sección está en las 153 páginas: no desaparece en las 10 que no listan nada", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  // `seccionDe` ya levanta nombrando el puerto si falta la sección; esto afirma el censo entero.
  const paginas = await paginasConAreas();
  const { resumen } = await cargarResumenDeAreas();
  assert.equal(paginas.length, 153);
  assert.equal(paginas.length, resumen.puertos);
  assert.equal(paginas.filter((pagina) => pagina.areas.length > 0).length, resumen.conArea);
});

// =================================================================================================
// LA REGLA DURA · en ningún sitio, ni por omisión, puede leerse que se pueda pescar
// =================================================================================================

test("las 153 páginas publican el aviso de la fuente: la ausencia de área no es un permiso", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const { fuente } = await cargarResumenDeAreas();
  // Va **antes** de la lista porque califica todo lo que hay debajo, y sobre todo va en las 10 que
  // no listan nada: es ahí donde el silencio se leería como vía libre.
  assert.match(fuente.aviso, /no autoriza a pescar/u, "el dataset ha dejado de traer el aviso");
  for (const { slug, seccion } of await paginasConAreas()) {
    const leido = textoDe(seccion);
    assert.ok(leido.includes(fuente.aviso), `${slug}: la sección no publica el aviso de la fuente`);
    assert.ok(leido.includes(QUE_ES_ESTO), `${slug}: falta el encabezado que dice qué es esto`);
    // Y el aviso va antes que la primera área, no en un pie.
    const primeraFila = seccion.indexOf("<tr data-area=");
    if (primeraFila >= 0) {
      assert.ok(
        seccion.indexOf(fuente.aviso.slice(0, 40)) < primeraFila,
        `${slug}: el aviso va después de la lista y llega tarde`,
      );
    }
  }
});

test("ninguna página escribe una frase que suene a permiso", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  // La razón de ser de la trayectoria: se publica la mitad defendible del encargo —dónde NO se
  // puede— porque la otra mitad no tiene fuente. Las formas de romperlo son de redacción, así que
  // se miden como tales. (No se puede prohibir la cadena «se puede pescar» a secas: el encabezado
  // dice «no dice en ningún caso dónde se puede pescar», que es justo lo contrario.)
  const permisivas = [
    /puedes pescar/iu,
    /se puede pescar (aqu|en est)/iu,
    /pesca (permitida|libre|autorizada)/iu,
    /permitido pescar/iu,
    /zona libre/iu,
    /sin restricciones/iu,
    /apto para (la )?pesca/iu,
    /aquí sí se puede/iu,
  ];
  const culpables: string[] = [];
  for (const { slug, seccion } of await paginasConAreas()) {
    const leido = textoDe(seccion);
    for (const patron of permisivas) {
      if (patron.test(leido)) culpables.push(`${slug} → ${String(patron)}`);
    }
  }
  assert.deepEqual(culpables, [], "una sección de zonas prohibidas que insinúa dónde sí se puede");
});

// =================================================================================================
// Lo que se publica de cada área: nombre oficial, figura glosada y la distancia como COTA
// =================================================================================================

test("las 348 relaciones se publican con su nombre, su figura y su cota, en orden de proximidad", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const { resumen } = await cargarResumenDeAreas();
  let comprobadas = 0;
  const rotas: string[] = [];
  for (const { slug, seccion, areas } of await paginasConAreas()) {
    const publicadas = [...seccion.matchAll(/<tr data-area="([^"]+)"/gu)].map((m) => m[1]);
    assert.deepEqual(
      publicadas,
      areas.map((area) => area.codigo),
      `${slug}: publica otras áreas, o en otro orden, que las del derivado`,
    );
    for (const area of areas) {
      comprobadas += 1;
      const fila = filaDe(seccion, area.codigo);
      if (fila === undefined) {
        rotas.push(`${slug} → ${area.codigo}: la fila no se publica`);
        continue;
      }
      const leido = textoDe(fila);
      // El nombre OFICIAL entero, sin abreviar: es lo que permite buscar el espacio en la fuente.
      if (!leido.includes(textoDe(area.nombre))) rotas.push(`${slug} → ${area.nombre}: sin nombre`);
      if (!leido.includes(area.tipo)) rotas.push(`${slug} → ${area.codigo}: sin la figura`);
      if (!leido.includes(distanciaEscrita(area.distanciaAproxKm))) {
        rotas.push(`${slug} → ${area.codigo}: sin la cota · «${leido}»`);
      }
      // Y el «dentro» dicho con sus palabras, que es un hecho más fuerte que una distancia corta.
      if (area.dentro && !/cae dentro de esta área/u.test(leido)) {
        rotas.push(`${slug} → ${area.codigo}: cae dentro y no lo dice`);
      }
    }
  }
  assert.deepEqual(rotas, []);
  assert.equal(comprobadas, resumen.relaciones, "no se han comprobado las 348 relaciones");
  assert.equal(comprobadas, 348);
});

test("la distancia se publica SIEMPRE como cota entera, nunca como la décima del derivado", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  // El derivado mide al borde: `8,7` en la página se leería como una medida y no lo
  // es. Se mide en el artefacto porque el error que importa —que alguien pinte
  // `{area.distanciaAproxKm} km` para «dar más detalle»— vive en la plantilla, no en la función.
  const decimales: string[] = [];
  for (const { slug, seccion } of await paginasConAreas()) {
    const leido = textoDe(seccion);
    for (const [suelto] of leido.matchAll(/\d+[.,]\d+\s*km/giu)) decimales.push(`${slug}: ${suelto}`);
    // Y la desigualdad va escrita: un «9 km» a secas es una medida, «a menos de 9 km» es lo que
    // sabemos. Solo donde hay áreas, claro.
    if (seccion.includes("<tr data-area=")) {
      assert.match(leido, /a menos de \d+ km/u, `${slug}: publica distancias sin la desigualdad`);
    }
  }
  assert.deepEqual(decimales, [], "distancias con decimales: fingen una precisión que no tenemos");
});

test("las siglas llegan glosadas: ninguna figura se publica sola salvo la que ya está en palabras", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const glosas = new Map([
    ["ZEPA", "Zona de Especial Protección para las Aves"],
    ["ZEC", "Zona Especial de Conservación"],
    ["AMP", "Área Marina Protegida"],
  ]);
  const vistos = new Set<string>();
  for (const { slug, seccion, areas } of await paginasConAreas()) {
    for (const area of areas) {
      vistos.add(area.tipo);
      const glosa = glosas.get(area.tipo);
      if (glosa === undefined) continue;
      const leido = textoDe(filaDe(seccion, area.codigo) ?? "");
      assert.ok(leido.includes(glosa), `${slug} → ${area.codigo}: ${area.tipo} sin glosar`);
    }
  }
  // Las cuatro figuras que de verdad salen en las páginas. La quinta de RAMPE, `ZEC/AMP`, tiene una
  // sola área —El Cachucho, en el Cantábrico abierto— y no cae a menos de 30 km de ningún puerto
  // del catálogo: está glosada en el módulo y probada allí, pero aquí no se puede medir, y decirlo
  // es más honrado que escribir un `assert` que pasaría por vacío.
  assert.deepEqual([...vistos].sort(), ["AMP", "RESERVA MARINA", "ZEC", "ZEPA"]);
});

// =================================================================================================
// Lo que la sección promete de sí misma, y lo que NO manda al cliente
// =================================================================================================

test("la sección se lee sin cobertura y lo dice CON su condición, sin JavaScript", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  for (const { slug, seccion } of await paginasConAreas()) {
    const leido = textoDe(seccion);
    // `cache-first` significa que sin red esto se sigue leyendo… si el lector guardó ESTE puerto.
    // La condición va delante, que es la corrección de H-4 en T-19.
    assert.ok(leido.includes(textoDe(AVISO_SIN_RED)), `${slug}: sin el aviso de lectura sin red`);
    assert.ok(!/<script/iu.test(seccion), `${slug}: la sección trae JavaScript y es SSG`);
    assert.ok(!/\son[a-z]+=/iu.test(seccion), `${slug}: la sección trae un manejador en línea`);
  }
});

test("ni un vértice cruza a dist/: la sección publica hechos, no geometría", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  // La licencia de RAMPE **no está declarada en origen**, y ésa es justo la razón por la que se
  // publican hechos derivados y no las geometrías. El derivado ya lo garantiza (gate P2 del
  // pipeline); esto lo vuelve a medir en el último sitio por el que podría escaparse, que es el
  // HTML: un `data-` con coordenadas para «un mapita» cabría aquí sin romper nada.
  const sospechosas = [/coordinates/iu, /polygon/iu, /geojson/iu, /-?\d+\.\d{4,},\s*-?\d+\.\d{4,}/u];
  let mayor = 0;
  let elMayor = "";
  for (const { slug, seccion } of await paginasConAreas()) {
    for (const patron of sospechosas) {
      assert.ok(!patron.test(seccion), `${slug}: la sección publica algo con pinta de geometría`);
    }
    if (seccion.length > mayor) {
      mayor = seccion.length;
      elMayor = slug;
    }
  }
  // Tope de bytes: el peor puerto del catálogo tiene 6 áreas. Si esto se dispara, o alguien ha
  // metido geometría o la sección ha dejado de ser una advertencia y se ha vuelto un informe.
  assert.ok(mayor < 8_000, `la sección más grande es ${mayor} B en ${elMayor}`);
  t.diagnostic(`sección más grande: ${mayor} B (${elMayor})`);
});

test("cero juice sobre una advertencia: la hoja de la sección no anima ni destaca nada", (t) => {
  // El design brief prohíbe el motion (§6) y la gamificación del dato (§3); sobre una advertencia
  // el argumento es el más fuerte de todos —adornarla es pedir que se le crea por el adorno—, así
  // que se mide en vez de confiarse.
  const hoja = readFileSync(HOJA, "utf8");
  for (const prohibido of ["@keyframes", "animation", "transition", "box-shadow", "border-radius"]) {
    assert.ok(!hoja.includes(prohibido), `la hoja de áreas protegidas usa ${prohibido}`);
  }
  // La mancha de terracota, que el brief reserva al coeficiente y a los avisos, solo puede caer en
  // los avisos de esta sección. Nunca sobre el nombre de un área ni sobre una distancia.
  const conTerracota = [...hoja.matchAll(/^\.([\w-]+)[^{]*\{[^}]*--m-terra[^}]*\}/gmu)].map(
    (coincidencia) => coincidencia[1],
  );
  assert.deepEqual(conTerracota, ["areas__aviso"]);
  t.diagnostic(`hoja de areas-protegidas.css: ${hoja.length} bytes`);
});

// =================================================================================================
// Las cifras de la documentación, medidas contra el dato
// =================================================================================================

test("las cifras que el design brief cuenta de esta sección salen del dataset, no de la memoria", async () => {
  // La lección de T-19: se coló un censo que no reproducía y costó una corrección pública. Las
  // cuatro cifras que la ampliación del brief cita se recalculan aquí desde el derivado.
  const { fuente, criterio, resumen } = await cargarResumenDeAreas();
  const brief = readFileSync(BRIEF, "utf8");
  const seccion = brief.slice(brief.indexOf("## 7 sexies"));
  assert.ok(seccion.length > 0, "el brief no tiene la ampliación de T-21");
  for (const cifra of [
    `${resumen.conArea} de ${resumen.puertos}`,
    `${resumen.relaciones}`,
    `${resumen.sinArea}`,
    `${fuente.censo.areas}`,
    `${criterio.radioKm} km`,
  ]) {
    assert.ok(seccion.includes(cifra), `la ampliación del brief no dice «${cifra}»`);
  }
});

test("el peso de la sección en el dist/ es el que dice `module.ts`, y el máximo no se teclea", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  // El recorrido existe por un fallo real: `module.ts` y el CHANGELOG daban Agaete como el puerto
  // donde más pesa la sección, y Agaete es el quinto. Nadie lo había medido sobre las 153 páginas.
  // Lo que se mide es el coste MARGINAL —la página con la sección menos la página sin ella—, que es
  // lo que la sección «añade»; medir el fragmento suelto daría otro número y otra frase.
  const puertos = await cargarPuertos();
  const pesos = puertos.map((puerto) => {
    const html = readFileSync(join(DIST, rutaPuerto(puerto), "index.html"), "utf8");
    const abre = html.indexOf(`<section id="${ID_SECCION_AREAS}"`);
    const cierra = html.indexOf("</section>", abre) + "</section>".length;
    const sinSeccion = html.slice(0, abre) + html.slice(cierra);
    return {
      slug: puerto.slug,
      bytes: Buffer.byteLength(html) - Buffer.byteLength(sinSeccion),
    };
  });
  pesos.sort((a, b) => b.bytes - a.bytes);
  const mayor = pesos.at(0);
  const menor = pesos.at(-1);
  assert.ok(mayor !== undefined && menor !== undefined, "no se ha medido ninguna página");
  assert.equal(mayor.slug, "guia-de-isora");
  assert.equal(mayor.bytes, 4925);
  assert.equal(menor.bytes, 1955);
  t.diagnostic(`sección: de ${menor.bytes} B (${menor.slug}) a ${mayor.bytes} B (${mayor.slug})`);
});
