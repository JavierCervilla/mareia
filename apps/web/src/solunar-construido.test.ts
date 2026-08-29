/**
 * La actividad solunar tal y como se publica: contra el `dist/`, y **contra el dominio**.
 *
 * La regla de esta trayectoria: un test que compare el HTML consigo mismo no vale nada. Aquí las
 * horas esperadas las da `getSolunar` —el mismo caso de uso que sirve el API— y lo que se afirma es
 * que las bandas del SVG y la tabla de la página dicen exactamente eso. Si mañana alguien cambia la
 * proyección del gráfico, el recorte del día o la zona horaria, esto se pone rojo.
 *
 * Lo único que el test **replica a propósito** es la fórmula de proyección al lienzo (`x` lineal
 * sobre el día civil, redondeada a la décima). No es circular: los instantes que entran en esa
 * fórmula salen del dominio, así que lo que se verifica es que llegaron los correctos.
 *
 * Sin `dist/` se salta en vez de dar un rojo falso: CI construye antes de testear.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AVISO_SIN_RESPALDO,
  franjaDePeriodo,
  ID_SECCION_ACTIVIDAD,
  nombreDeEtiqueta,
} from "@mareia/module-fishing";
import { getSolunar } from "@mareia/usecases";
import type { GetSolunarResult } from "@mareia/usecases";

import { cargarPuertos } from "./datos/catalogo.ts";
import { deps } from "./datos/deps.ts";
import { hora, numero } from "./formato.ts";
import { formatoDelPuerto } from "./modulos/actividad-solunar.ts";
import { rutaPuerto } from "./rutas.ts";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PORTADA = join(DIST, "index.html");
const HAY_BUILD = existsSync(PORTADA);
const SIN_BUILD = "no hay apps/web/dist: corre antes `pnpm --filter web build`";

const VIGO = "vigo";

function paginaDe(ruta: string): string {
  return readFileSync(join(DIST, ruta, "index.html"), "utf8");
}

/** El día que publica el build, leído del propio HTML: es la página quien declara de qué día habla. */
function fechaDelBuild(): string {
  const fecha = /<time datetime="(\d{4}-\d{2}-\d{2})"/.exec(readFileSync(PORTADA, "utf8"))?.[1];
  assert.ok(fecha, "la portada construida no declara la fecha de sus datos");
  return fecha;
}

/** Las páginas de puerto construidas, con su slug y su zona horaria. */
async function paginasDePuerto(): Promise<
  readonly { slug: string; timezone: string; html: string }[]
> {
  const puertos = await cargarPuertos();
  return puertos.map((puerto) => ({
    slug: puerto.slug,
    timezone: puerto.timezone,
    html: paginaDe(rutaPuerto(puerto)),
  }));
}

/** Una banda del gráfico tal y como quedó en el SVG. */
interface BandaPublicada {
  readonly id: string;
  readonly enfasis: string;
  readonly x: number;
  readonly ancho: number;
}

function bandasDe(html: string): readonly BandaPublicada[] {
  return [...html.matchAll(/<rect class="grafico__banda"([^>]*)>/g)].map((encontrado) => {
    const atributos = encontrado[1] ?? "";
    const atributo = (nombre: string): string =>
      new RegExp(`${nombre}="([^"]*)"`).exec(atributos)?.[1] ?? "";
    return {
      id: atributo("data-ventana"),
      enfasis: atributo("data-enfasis"),
      x: Number(atributo("x")),
      ancho: Number(atributo("width")),
    };
  });
}

/** Ancho del lienzo declarado en el `viewBox`, para no clavar el 620 en el test. */
function anchoDelLienzo(html: string): number {
  const viewBox = /class="grafico__lienzo"[^>]*viewBox="0 0 (\d+) (\d+)"/.exec(html);
  assert.ok(viewBox, "la página no trae el gráfico de marea");
  return Number(viewBox[1]);
}

function solunarDe(slug: string, fechaIso: string): Promise<GetSolunarResult> {
  return getSolunar(deps, { slug, date: fechaIso });
}

/**
 * El fallo que este test existe para no repetir: la hoja de la sección se importaba desde su propio
 * componente, Astro no la metía en el bundle —el componente llega por el mapa de renderizadores, no
 * por un import de la página— y la sección se publicaba **sin estilos** con todo el CI en verde. Un
 * gate que mira el HTML y no la hoja no ve esa avería.
 */
test("la hoja publicada trae los estilos de la sección y de las bandas", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const html = readFileSync(join(DIST, "mareas", "galicia", "pontevedra", VIGO, "index.html"), "utf8");
  const hoja = /<link rel="stylesheet" href="(\/_astro\/[^"]+\.css)"/.exec(html)?.[1];
  assert.ok(hoja, "la página de puerto no enlaza ninguna hoja propia");

  const css = readFileSync(join(DIST, hoja), "utf8");
  for (const clase of [".solunar__cifra", ".tabla-solunar", ".solunar__aviso", ".grafico__banda"]) {
    assert.ok(css.includes(clase), `la hoja publicada no trae ${clase}: la sección sale sin estilo`);
  }
});

test("el aviso de que la teoría no está respaldada está en todas las páginas de puerto", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const paginas = await paginasDePuerto();
  assert.ok(paginas.length >= 120, `el catálogo se ha encogido a ${paginas.length} puertos`);

  const sinAviso = paginas.filter((pagina) => !pagina.html.includes(AVISO_SIN_RESPALDO));
  assert.deepEqual(sinAviso.map((pagina) => pagina.slug), [], "páginas que publican el rating sin el aviso");

  const sinSeccion = paginas.filter((pagina) => !pagina.html.includes(`id="${ID_SECCION_ACTIVIDAD}"`));
  assert.deepEqual(sinSeccion.map((pagina) => pagina.slug), []);
});

/**
 * El golden de la trayectoria: cada banda del SVG es un periodo del dominio, con su hora y su
 * anchura. Vigo es semidiurno y tiene los cuatro periodos, así que un error de zona horaria o de
 * proyección se ve en el primer assert.
 */
test("las bandas del SVG de Vigo son los periodos que publica getSolunar", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const fechaIso = fechaDelBuild();
  const puertos = await cargarPuertos();
  const vigo = puertos.find((puerto) => puerto.slug === VIGO);
  assert.ok(vigo, "el catálogo ya no tiene Vigo");

  const html = paginaDe(rutaPuerto(vigo));
  const actividad = await solunarDe(VIGO, fechaIso);
  const ancho = anchoDelLienzo(html);
  const bandas = bandasDe(html);

  const inicio = actividad.day.startUtcMs;
  const duracion = actividad.day.endUtcMs - inicio;
  /** La proyección del gráfico, escrita aparte a propósito: los instantes vienen del dominio. */
  const x = (timeUtcMs: number): number =>
    Math.round((((timeUtcMs - inicio) / duracion) * ancho) * 10) / 10;

  assert.equal(bandas.length, actividad.periods.length, "sobran o faltan bandas");
  for (const periodo of actividad.periods) {
    const banda = bandas.find((candidata) => candidata.id === `solunar-${periodo.anchor}`);
    assert.ok(banda, `no hay banda para el periodo ${periodo.anchor}`);

    const izquierda = x(Math.max(periodo.startUtcMs, inicio));
    const derecha = x(Math.min(periodo.endUtcMs, actividad.day.endUtcMs));
    assert.equal(banda.x, izquierda, `${periodo.anchor} empieza donde no toca`);
    assert.equal(banda.ancho, Math.round((derecha - izquierda) * 10) / 10, `${periodo.anchor} mal de ancho`);
    assert.equal(banda.enfasis, periodo.kind === "major" ? "fuerte" : "suave");
  }
});

test("la tabla y el nombre accesible del gráfico traen las horas locales del dominio", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const fechaIso = fechaDelBuild();
  const puertos = await cargarPuertos();
  const vigo = puertos.find((puerto) => puerto.slug === VIGO);
  assert.ok(vigo);

  const html = paginaDe(rutaPuerto(vigo));
  const actividad = await solunarDe(VIGO, fechaIso);
  const aria = /aria-label="(Curva de altura[^"]*)"/.exec(html)?.[1] ?? "";

  const dia = { inicioUtcMs: actividad.day.startUtcMs, finUtcMs: actividad.day.endUtcMs };
  const formato = formatoDelPuerto(vigo.timezone);

  for (const periodo of actividad.periods) {
    const franja = franjaDePeriodo(periodo, dia, formato);
    assert.ok(html.includes(franja), `la tabla no publica la franja de ${periodo.anchor}: ${franja}`);
    assert.ok(aria.includes(franja), `el gráfico no nombra la franja de ${periodo.anchor}`);
    assert.ok(
      html.includes(`a las ${hora(periodo.peakUtcMs, vigo.timezone)}`),
      `la tabla no publica el instante del fenómeno de ${periodo.anchor}`,
    );
  }
});

/**
 * El caso que busca el pase adversario: una ventana que empieza el día anterior o acaba el
 * siguiente **se recorta**. Se comprueba en todas las páginas porque cuál de ellas tiene un periodo a
 * caballo de la medianoche depende del día que se construya.
 */
test("ninguna banda se sale del lienzo en ninguna página", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const fugadas: string[] = [];
  for (const pagina of await paginasDePuerto()) {
    const ancho = anchoDelLienzo(pagina.html);
    for (const banda of bandasDe(pagina.html)) {
      if (banda.x < 0 || banda.ancho <= 0 || banda.x + banda.ancho > ancho) {
        fugadas.push(`${pagina.slug}/${banda.id} → x=${banda.x} ancho=${banda.ancho}`);
      }
    }
  }
  assert.deepEqual(fugadas, [], "bandas dibujadas fuera del día civil");
});

test("las bandas se emiten bajo la curva: primero el sombreado, después el trazo", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  for (const pagina of await paginasDePuerto()) {
    const primeraBanda = pagina.html.indexOf('<rect class="grafico__banda"');
    const trazo = pagina.html.indexOf('<path class="grafico__trazo"');
    assert.ok(primeraBanda >= 0 && trazo > primeraBanda, `en ${pagina.slug} la banda tapa la curva`);
  }
});

/**
 * El rating publicado es el del dominio, y el desglose cuadra: la suma sin redondear que se enseña
 * es la de los factores, y los estados terminales (100 y 0) solo aparecen si la fórmula llega ahí.
 * Un `toFixed` de más en la plantilla se vería aquí.
 */
test("el rating y su desglose son los que calcula el dominio, en todas las páginas", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const fechaIso = fechaDelBuild();
  for (const pagina of await paginasDePuerto()) {
    const actividad = await solunarDe(pagina.slug, fechaIso);
    const { rating } = actividad;
    const cifra = /<span class="solunar__cifra">(\d+)<\/span>/.exec(pagina.html)?.[1];
    const total = /solunar__total"[\s\S]*?datos__valor">\s*([^<]*?)\s*<\/span>/.exec(pagina.html)?.[1];

    assert.equal(Number(cifra), rating.score, `${pagina.slug} publica un rating que no es el suyo`);
    assert.equal(
      total,
      `${numero(rating.moonScore + rating.solarBonus, 1)} → ${rating.score} · ${nombreDeEtiqueta(rating.label)}`,
      `${pagina.slug} no enseña la suma que produce su rating`,
    );
    if (rating.score === 100 || rating.score === 0) {
      assert.equal(
        rating.moonScore + rating.solarBonus,
        rating.score,
        `${pagina.slug} llega a ${rating.score} redondeando, no por la fórmula`,
      );
    }
  }
});
