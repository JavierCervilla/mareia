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
 * Los dos avisos de la cabecera salen exactamente donde toca, ni uno más ni uno menos, y cada uno
 * por su motivo: el micromareal donde la **carrera de marea medida** es de centímetros, y el de
 * estación sin observación donde el QC no tuvo mareógrafo con el que validar.
 *
 * De más, sería ruido que resta credibilidad al aviso donde sí importa; de menos, sería publicar
 * una tabla con pinta de exacta en el único sitio donde no lo es. Y confundirlos —que es lo que
 * hacía el criterio viejo, `grade C` sin p95— le colgaba a Cádiz el cartel de «aquí la marea es de
 * centímetros» encima de su tabla de 2,90 m (hallazgo A-8 del pase adversario de T-09).
 */
test("cada aviso de la cabecera aparece solo en los puertos que le tocan", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const fechaIso = fechaDelBuild();
  const conAviso: string[] = [];
  const esperados: string[] = [];
  const conAvisoSinObservacion: string[] = [];
  const esperadosSinObservacion: string[] = [];
  for (const puerto of await cargarPuertos()) {
    const datos = await cargarDatosDePuerto(puerto.slug, fechaIso);
    const html = paginaDe(rutaPuerto(puerto));
    if (datos.micromareal) esperados.push(puerto.slug);
    if (html.includes("aviso-micromareal")) conAviso.push(puerto.slug);
    if (datos.sinObservacion) esperadosSinObservacion.push(puerto.slug);
    if (html.includes("aviso-sin-observacion")) conAvisoSinObservacion.push(puerto.slug);
  }

  assert.deepEqual(conAviso.sort(), esperados.sort());
  assert.deepEqual(
    esperados.sort(),
    ["cabo-de-palos", "la-manga-del-mar-menor", "palma-de-mallorca"],
    "la carrera de marea del dataset piloto ha cambiado: revisa las constantes de T-04",
  );

  assert.deepEqual(conAvisoSinObservacion.sort(), esperadosSinObservacion.sort());
  assert.deepEqual(
    esperadosSinObservacion.sort(),
    ["cadiz"],
    "las estaciones sin observación del dataset piloto han cambiado: revisa el QC de T-05",
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

// --- La sección meteo en el HTML publicado (T-11) ------------------------------------------------
// Lo que se comprueba aquí es la mitad estructural de ADR-01: que el dato que caduca **no está
// dentro del HTML**. Si algún día alguien decide hornear la meteo en build, estos tests se ponen
// rojos, que es exactamente lo que tienen que hacer.

test("cada página de puerto trae la sección meteo anclada a su puerto y a su zona horaria", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  for (const puerto of await cargarPuertos()) {
    const html = paginaDe(rutaPuerto(puerto));
    assert.match(html, /<section id="meteo" class="bloque">/u, `${puerto.slug}: sin sección meteo`);
    assert.match(
      html,
      new RegExp(`data-meteo-puerto="${puerto.slug}" data-meteo-zona="${puerto.timezone}"`, "u"),
      `${puerto.slug}: la isla no sabe de qué puerto ni en qué hora habla`,
    );
  }
});

test("el HTML construido no lleva NI UNA magnitud meteorológica dentro (ADR-01)", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  // Unidades que solo puede escribir la sección meteo. Si aparecen en el HTML es que el dato se
  // horneó en build, y entonces envejece hasta el siguiente rebuild sin poder decir cuánto.
  const unidadesDeMeteo = /\d[\d,]*\s*(km\/h|hPa|°C)\b|Índice UV|Mar de fondo|Temperatura del agua/u;
  for (const puerto of await cargarPuertos()) {
    const html = paginaDe(rutaPuerto(puerto));
    assert.doesNotMatch(html, unidadesDeMeteo, `${puerto.slug}: hay meteo horneada en el HTML`);
  }
});

test("sin JavaScript, la sección meteo explica el hueco en vez de quedarse muda", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const html = paginaDe(rutaPuerto((await cargarPuertos())[0]!));

  assert.match(html, /El estado del mar todavía no ha llegado/u);
  assert.match(html, /o tu navegador no ejecuta JavaScript/u);
  // Y las atribuciones no dependen de que la petición salga: son HTML estático.
  assert.match(html, /<a href="https:\/\/open-meteo\.com\/">Open-Meteo<\/a> · CC-BY-4\.0/u);
  assert.match(html, /AEMET — Agencia Estatal de Meteorología<\/a> · Uso condicionado/u);
});

test("el único JavaScript de una página de puerto es la isla meteo: el core sigue sin JS", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const html = paginaDe(rutaPuerto((await cargarPuertos())[0]!));
  const scripts = [...html.matchAll(/<script[^>]*>/gu)].map((encontrado) => encontrado[0]);

  assert.equal(scripts.length, 2, `scripts inesperados en la página: ${scripts.join(" ")}`);
  assert.match(scripts[0] ?? "", /type="application\/ld\+json"/u, "el JSON-LD son datos, no código");
  assert.match(scripts[1] ?? "", /src="\/_astro\/Meteo\.astro[^"]*\.js"/u);

  // Los índices geográficos no tienen módulos: siguen con cero JavaScript.
  assert.equal([...paginaDe(RUTA_MAREAS).matchAll(/<script[^>]*src=/gu)].length, 0);
});
