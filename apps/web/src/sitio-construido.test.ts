/**
 * Lo que de verdad se publica: el `dist/`.
 *
 * Estos tests no miran componentes ni funciones, miran el **HTML construido**, que es el artefacto
 * que ve un usuario. Es el único sitio donde se comprueba de una vez que el wiring de build, los
 * casos de uso, el formato y el renderizado están de acuerdo: si el número que calcula el dominio
 * no llega a la tabla —o llega redondeado de otra forma, o en otra zona horaria—, aquí se ve.
 *
 * El día que se compara **se lee del propio HTML** y no se recalcula: sin `BUILD_DATE` el build usa
 * el día UTC del reloj, y un build a las 23:59 con los tests a las 00:01 compararía dos días
 * distintos. La página declara qué día publica; se le cree a ella.
 *
 * Sin `dist/` los tests se saltan en vez de dar un rojo falso: CI construye antes de testear
 * (`pnpm --filter web build` y luego `pnpm test`, en ese orden, job `web`).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cargarCatalogo, cargarPuertos, puertosDeRegion } from "./datos/catalogo.ts";
import { cargarDatosDePuerto } from "./datos/pagina-puerto.ts";
import { diasDelMes } from "./datos/fecha-build.ts";
import { hora, metros } from "./formato.ts";
import { RUTA_MAREAS, rutaProvincia, rutaPuerto, rutaRegion } from "./rutas.ts";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PORTADA = join(DIST, "index.html");
const HAY_BUILD = existsSync(PORTADA);
const SIN_BUILD = "no hay apps/web/dist: corre antes `pnpm --filter web build`";

/** El HTML construido de una ruta del sitio (`/mareas/…/` → `dist/mareas/…/index.html`). */
function paginaDe(ruta: string): string {
  return readFileSync(join(DIST, ruta, "index.html"), "utf8");
}

function fechaDelBuild(): string {
  const fecha = /<time datetime="(\d{4}-\d{2}-\d{2})"/.exec(readFileSync(PORTADA, "utf8"))?.[1];
  assert.ok(fecha, "la portada construida no declara la fecha de sus datos");
  return fecha;
}

/** Todas las rutas que el sitio debería haber construido, derivadas del catálogo. */
async function rutasEsperadas(): Promise<readonly string[]> {
  const regiones = await cargarCatalogo();
  return [
    "/",
    RUTA_MAREAS,
    ...regiones.map((region) => rutaRegion(region.slug)),
    ...regiones.flatMap((region) =>
      region.provincias.map((provincia) => rutaProvincia(region.slug, provincia.slug)),
    ),
    ...regiones.flatMap((region) => puertosDeRegion(region).map(rutaPuerto)),
  ];
}

test("el build genera una página por puerto y por escalón de la jerarquía", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const puertos = await cargarPuertos();
  assert.equal(puertos.length, 12, "el catálogo piloto son 12 puertos");

  const faltan = (await rutasEsperadas()).filter(
    (ruta) => !existsSync(join(DIST, ruta, "index.html")),
  );
  assert.deepEqual(faltan, [], "hay rutas del catálogo sin página construida");
});

/**
 * El test que exige la trayectoria: lo que se lee en el HTML de Vigo es lo que calcula el dominio.
 *
 * Vigo es grade B con marea semidiurna clara —cuatro extremos al día y ~4 m de carrera—, así que un
 * error de formato, de zona horaria o de redondeo se ve a simple vista en el diff del assert.
 */
test("el HTML de Vigo trae los extremos del día que calculan los casos de uso", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const fechaIso = fechaDelBuild();
  const datos = await cargarDatosDePuerto("vigo", fechaIso);
  const html = paginaDe(rutaPuerto(datos.port));

  assert.ok(datos.dia.eventos.length >= 2, "un día de Vigo tiene al menos dos extremos");

  // Se acota a la tabla del DÍA antes de leer filas: las mismas horas y alturas aparecen luego en
  // la tabla del mes, y un patrón suelto sobre la página entera casaría con la fila equivocada
  // (comprobado con una sonda: cambiar una hora en el HTML no ponía el test en rojo).
  const tabla = /<table class="tabla-mareas">([\s\S]*?)<\/table>/.exec(html)?.[1];
  assert.ok(tabla, "no encuentro la tabla de mareas del día en el HTML construido");

  const filas = [...tabla.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((fila) =>
    [...(fila[1] ?? "").matchAll(/<t[hd][^>]*>([^<]*)<\/t[hd]>/g)]
      .map((celda) => celda[1] ?? "")
      .join(" "),
  );
  const esperadas = datos.dia.eventos.map((evento) => {
    const nombre = evento.kind === "high" ? "pleamar" : "bajamar";
    return `${nombre} ${hora(evento.timeUtcMs, datos.port.timezone)} ${metros(evento.height_m)}`;
  });

  assert.deepEqual(filas, esperadas, "la tabla del día no dice lo que calculan los casos de uso");
});

test("la tabla mensual de Vigo trae todos los días del mes con su coeficiente", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const fechaIso = fechaDelBuild();
  const datos = await cargarDatosDePuerto("vigo", fechaIso);
  const html = paginaDe(rutaPuerto(datos.port));

  // Acotado a la tabla mensual: la cabecera de la página también lleva un `<time datetime>` con el
  // día del build, y sin acotar ese día pasaría el test aunque su fila no existiera.
  const tabla = /<table class="tabla-mes">([\s\S]*?)<\/table>/.exec(html)?.[1];
  assert.ok(tabla, "no encuentro la tabla mensual en el HTML construido");

  const dias = diasDelMes(fechaIso);
  assert.equal(datos.mes.dias.length, dias.length);
  for (const dateIso of dias) {
    assert.ok(
      tabla.includes(`<time datetime="${dateIso}">`),
      `la tabla mensual no tiene la fila del ${dateIso}`,
    );
  }
  // Cada día del mes tiene uno o dos coeficientes: el día lunar dura 24 h 50 min.
  for (const dia of datos.mes.dias) {
    assert.ok(
      dia.coeficientes.length >= 1 && dia.coeficientes.length <= 3,
      `${dia.dateIso}: ${dia.coeficientes.length} coeficientes`,
    );
  }
});

/**
 * El aviso micromareal sale exactamente donde el QC dice que hace falta, ni uno más ni uno menos.
 *
 * De más, sería ruido que resta credibilidad al aviso donde sí importa; de menos, sería publicar
 * una tabla con pinta de exacta en el único sitio donde no lo es.
 */
test("el aviso micromareal aparece solo en los puertos que el QC marca así", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const fechaIso = fechaDelBuild();
  const conAviso: string[] = [];
  const esperados: string[] = [];
  for (const puerto of await cargarPuertos()) {
    const datos = await cargarDatosDePuerto(puerto.slug, fechaIso);
    if (datos.micromareal) esperados.push(puerto.slug);
    if (paginaDe(rutaPuerto(puerto)).includes("aviso-micromareal")) conAviso.push(puerto.slug);
  }

  assert.deepEqual(conAviso.sort(), esperados.sort());
  assert.deepEqual(
    esperados.sort(),
    ["cabo-de-palos", "cadiz", "la-manga-del-mar-menor", "palma-de-mallorca"],
    "los puertos micromareales del dataset piloto han cambiado: revisa el QC de T-05",
  );
});

test("el sitemap lista todas las páginas construidas y ninguna más", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const xml = readFileSync(join(DIST, "sitemap.xml"), "utf8");
  const rutas = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (encontrado) => new URL(encontrado[1] ?? "").pathname,
  );

  assert.deepEqual([...rutas].sort(), [...(await rutasEsperadas())].sort());
  assert.match(xml, new RegExp(`<lastmod>${fechaDelBuild()}</lastmod>`));
});

test("cada página de puerto declara canónica y JSON-LD parseable", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  for (const puerto of await cargarPuertos()) {
    const ruta = rutaPuerto(puerto);
    const html = paginaDe(ruta);
    const canonica = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
    assert.ok(canonica, `${puerto.slug}: sin canónica`);
    assert.equal(new URL(canonica).pathname, ruta);

    const bruto = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1];
    assert.ok(bruto, `${puerto.slug}: sin JSON-LD`);
    const grafo = JSON.parse(bruto) as { "@graph": readonly { "@type": string }[] };
    assert.deepEqual(
      grafo["@graph"].map((nodo) => nodo["@type"]),
      ["Place", "BreadcrumbList"],
    );
  }
});
