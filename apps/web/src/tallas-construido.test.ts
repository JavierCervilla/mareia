/**
 * Las tallas mínimas **tal y como se publican**: contra el `dist/`, página a página, y contra el
 * dataset del que salen.
 *
 * Un test sobre la función que compone las filas demuestra la función. Lo que le cuesta dinero a
 * quien lee es lo que llega **al HTML**, y entre una cosa y otra hay una plantilla que puede
 * olvidarse de pintar una nota sin que ninguna función se entere. Por eso el gate del que va esta
 * trayectoria —**ninguna cifra sin su nota**— se mide aquí: se busca la fila de la especie en el
 * HTML construido y se exige que el texto de su nota esté **dentro de esa misma fila**, no en un
 * pie al que haya que bajar.
 *
 * Sin `dist/` se salta en vez de dar un rojo falso: CI construye antes de testear.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  avisoDeVigencia,
  DIAS_SELLO_CORRIENTE,
  DIAS_SELLO_RANCIO,
  estadoDeVigencia,
  ID_SECCION_TALLAS,
  rotuloDeVigencia,
} from "@mareia/module-regulations";
import type { Caladero } from "@mareia/module-regulations";

import { cargarPuertos } from "./datos/catalogo.ts";
import { FECHA_DE_BUILD } from "./datos/fecha-build.ts";
import { cargarTablaDeTallas } from "./modulos/normativa.ts";
import { claveDeFila } from "@mareia/module-regulations";
import { rutaPuerto } from "./rutas.ts";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIST = join(AQUI, "..", "dist");
const PORTADA = join(DIST, "index.html");
const HOJA = join(AQUI, "estilos", "tallas-minimas.css");
const HAY_BUILD = existsSync(PORTADA);
const SIN_BUILD = "no hay apps/web/dist: corre antes `pnpm --filter web build`";

interface PaginaConTabla {
  readonly slug: string;
  readonly seccion: string;
  readonly caladero: Caladero;
}

/** El trozo de HTML de la sección del módulo, y solo ese. */
function seccionDe(html: string, slug: string): string {
  const abre = html.indexOf(`<section id="${ID_SECCION_TALLAS}"`);
  assert.ok(abre >= 0, `${slug}: la página no publica la sección de tallas mínimas`);
  const cierra = html.indexOf("</section>", abre);
  assert.ok(cierra > abre, `${slug}: la sección de tallas mínimas no cierra`);
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

/** La fila de una especie dentro de la sección, con su marcado. */
function filaDe(seccion: string, clave: string): string | undefined {
  const patron = new RegExp(`<tr data-especie="${clave}">([\\s\\S]*?)</tr>`, "u");
  return patron.exec(seccion)?.[1];
}

/** Las 153 páginas de puerto construidas, cada una con el caladero que le toca. */
async function paginasConTabla(): Promise<readonly PaginaConTabla[]> {
  const puertos = await cargarPuertos();
  return Promise.all(
    puertos.map(async (puerto) => {
      const html = readFileSync(join(DIST, rutaPuerto(puerto), "index.html"), "utf8");
      const { caladero } = await cargarTablaDeTallas({
        slug: puerto.slug,
        nombre: puerto.name,
        fechaIso: "2026-08-30",
        timezone: puerto.timezone,
      });
      return { slug: puerto.slug, seccion: seccionDe(html, puerto.slug), caladero };
    }),
  );
}

// =================================================================================================
// EL GATE DE LA TRAYECTORIA · ninguna cifra publicada sin su nota
// =================================================================================================

test("ninguna especie con nota se publica sin el TEXTO de su nota en su propia fila", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const desnudas: string[] = [];
  let comprobadas = 0;
  for (const { slug, seccion, caladero } of await paginasConTabla()) {
    for (const especie of caladero.especies) {
      if (especie.notas.length === 0) continue;
      const fila = filaDe(seccion, claveDeFila(especie));
      if (fila === undefined) {
        desnudas.push(`${slug} → ${especie.nombreComun}: la fila no se publica`);
        continue;
      }
      const leido = textoDe(fila);
      for (const marca of especie.notas) {
        const nota = caladero.notas.find((candidata) => candidata.marca === marca);
        assert.ok(nota !== undefined, `${slug} → ${especie.nombreComun}: marca ${marca} sin nota`);
        comprobadas += 1;
        // La NOTA ENTERA, dentro de la fila. Una marca sola («36 (***)») pasaría cualquier test de
        // «la fila menciona la nota» y seguiría publicando 36 cm a secas en Bilbao, donde son 44.
        if (!leido.includes(textoDe(nota.texto))) {
          desnudas.push(`${slug} → ${especie.nombreComun} (${marca}): «${leido}»`);
        }
      }
    }
  }
  assert.deepEqual(
    desnudas,
    [],
    "cifras publicadas sin la nota que las excepciona (una cifra legal falsa para esos puertos)",
  );
  // 9 especies con nota × las páginas de su caladero: 8 del Anexo I en 47 puertos + el pulpo del
  // Anexo II en 80. Si el número baja, alguien ha dejado de pintar una nota en algún caladero.
  assert.equal(comprobadas, 8 * 47 + 1 * 80, "no se han comprobado todas las notas de todos los puertos");
});

test("la lubina publica 36 cm y, en la misma fila, los 44 de las divisiones 8a y 8b", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  // El caso que da nombre al gate: 8 cm de diferencia entre la cifra y su excepción, que es la
  // mayor de las tres notas. OJO con la glosa fácil: las divisiones 8.a/8.b son el golfo de Vizcaya
  // NORTE Y CENTRAL —la vertiente francesa—, y la costa española es la 8.c, así que la excepción no
  // afecta a ninguno de estos 47 puertos. Lo que el gate exige es que la nota viaje entera junto a
  // la cifra, y eso vale igual: quien lee tiene que poder decidir si le aplica, y para eso necesita
  // el texto, no la marca.
  const cantabricos = (await paginasConTabla()).filter(
    (pagina) => pagina.caladero.id === "cantabrico-noroeste-y-golfo-de-cadiz",
  );
  assert.equal(cantabricos.length, 47);
  for (const { slug, seccion } of cantabricos) {
    const fila = textoDe(filaDe(seccion, "lubina") ?? "");
    assert.match(fila, /36 cm/u, `${slug}: la lubina no publica su cifra`);
    assert.match(fila, /44 centímetros/u, `${slug}: los 44 cm de la excepción no están en la fila`);
    assert.match(fila, /36 \(\*\*\*\)/u, `${slug}: falta el literal del BOE`);
  }
});

test("el pulpo del Mediterráneo publica su kilo y, en la fila, que no aplica en Baleares", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const mediterraneos = (await paginasConTabla()).filter(
    (pagina) => pagina.caladero.id === "mediterraneo",
  );
  assert.equal(mediterraneos.length, 80);
  for (const { slug, seccion } of mediterraneos) {
    const fila = textoDe(filaDe(seccion, "pulpo") ?? "");
    assert.match(fila, /1 kg de peso/u, `${slug}: el pulpo no publica su peso`);
    assert.match(fila, /Balears/u, `${slug}: la excepción balear no está en la fila del pulpo`);
  }
});

test("y la excepción balear se RESUELVE: un puerto balear no lee el pulpo igual que uno peninsular", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  // EL GATE DE H-5. Antes, el `<tr>` del pulpo de Palma y el de Ibiza eran idénticos byte a byte al
  // de Valencia, aunque la propia nota dijera que en Balears esa talla no es de aplicación. El
  // criterio de esa nota es administrativo —la comunidad autónoma— y el portal lo sabe: está en
  // `ports.json` y con él construye la URL en la que el lector está. Las dos ramas se miden, no
  // solo la que excepciona: sin la de «aquí sí aplica», a quien lee en Valencia se le seguiría
  // dejando el trabajo.
  const puertos = await cargarPuertos();
  const comunidadDe = new Map(puertos.map((puerto) => [puerto.slug, puerto.region.slug]));
  const mediterraneos = (await paginasConTabla()).filter(
    (pagina) => pagina.caladero.id === "mediterraneo",
  );
  const baleares: string[] = [];
  const resto: string[] = [];
  for (const { slug, seccion } of mediterraneos) {
    const fila = textoDe(filaDe(seccion, "pulpo") ?? "");
    const esBalear = comunidadDe.get(slug) === "illes-balears";
    (esBalear ? baleares : resto).push(slug);
    assert.match(
      fila,
      esBalear
        ? /En este puerto no se aplica: está en Illes Balears\./u
        : /En este puerto sí se aplica: la excepción es solo para Illes Balears\./u,
      `${slug}: la fila del pulpo no dice si la excepción balear le afecta · «${fila}»`,
    );
  }
  // Los 17 puertos de Balears del catálogo, y los otros 63 del caladero. Si el reparto cambia, hay
  // que mirar por qué antes de tocar este número.
  assert.equal(baleares.length, 17, `puertos baleares medidos: ${baleares.join(", ")}`);
  assert.equal(resto.length, 63);
});

// =================================================================================================
// Las cinco clases, publicadas
// =================================================================================================

test("las 118 tallas se publican enteras, cada puerto con las de su caladero", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  for (const { slug, seccion, caladero } of await paginasConTabla()) {
    const filas = seccion.match(/<tr data-especie="/gu) ?? [];
    assert.equal(
      filas.length,
      caladero.especies.length,
      `${slug}: publica ${filas.length} filas y su anexo tiene ${caladero.especies.length}`,
    );
  }
});

test("las cinco formas de talla se leen cada una como lo que es, no como un número", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const anexoI = textoDe(
    (await paginasConTabla()).find((pagina) => pagina.slug === "bilbao")?.seccion ?? "",
  );
  const anexoII = textoDe(
    (await paginasConTabla()).find((pagina) => pagina.slug === "valencia")?.seccion ?? "",
  );
  assert.match(anexoI, /Abadejo Pollachius pollachius 30 cm 30/u, "longitud entera");
  assert.match(anexoI, /Cigalas \(colas\).*3,7 cm 3,7/u, "longitud decimal, con la coma del sitio");
  assert.match(anexoI, /Atún rojo Thunnus thynnus 6,4 kg de peso 6,4 kg/u, "peso, dicho como peso");
  assert.match(anexoII, /80 cm o 10 kg de peso/u, "disyunción longitud-o-peso");
  assert.match(anexoI, /Anguila Anguilla anguilla La norma no fija talla/u, "talla por determinar");
  // La boga: el literal `1 1` a la vista y el motivo escrito. Nadie lo ha «arreglado» a 11.
  assert.match(anexoI, /Boga Boops boops La norma no imprime una talla legible/u);
  assert.match(anexoI, /la norma imprime «1 1»/u);
});

// =================================================================================================
// Lo que la sección promete de sí misma
// =================================================================================================

test("cada página publica la fecha del texto, la de verificación y el enlace ELI", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const { fuente } = await cargarTablaDeTallas({
    slug: "vigo",
    nombre: "Vigo",
    fechaIso: "2026-08-30",
    timezone: "Europe/Madrid",
  });
  for (const { slug, seccion, caladero } of await paginasConTabla()) {
    const leido = textoDe(seccion);
    // Las tres son la mitad del valor de la sección: sin ellas, una tabla de cifras legales no se
    // puede fechar ni contrastar.
    assert.match(leido, /2 de noviembre de 2025/u, `${slug}: falta la fecha de la redacción`);
    // El rótulo del sello es el que le toca a su estado, no una cadena fija: si G2 llevara días
    // sin escribir, la página no puede seguir diciendo «comprobada» (ver el gate de abajo).
    assert.ok(
      leido.includes(rotuloDeVigencia(estadoDeVigencia(fuente.verificadoEn, FECHA_DE_BUILD))),
      `${slug}: falta el sello de G2`,
    );
    assert.ok(seccion.includes(`href="${fuente.eli}"`), `${slug}: falta el enlace ELI`);
    assert.ok(leido.includes(caladero.normaModificadora), `${slug}: falta la norma modificadora`);
    assert.ok(leido.includes(fuente.aviso), `${slug}: falta el aviso de autenticidad`);
  }
});

test("la sección se lee sin cobertura y lo dice: el aviso duro va horneado, no encendido por JS", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  for (const { slug, seccion } of await paginasConTabla()) {
    const leido = textoDe(seccion);
    // `offline: cache-first` significa que sin red esto se sigue leyendo, y la sección no tiene
    // JavaScript con el que enterarse de que no hay red: el aviso está escrito siempre.
    assert.match(leido, /puedes estar viendo una copia de hace semanas/u, `${slug}: sin aviso`);
    assert.match(leido, /Una talla derogada se lee igual de bien que la vigente/u, slug);
    assert.ok(!/<script/iu.test(seccion), `${slug}: la sección trae JavaScript y es SSG`);
    assert.ok(!/\son[a-z]+=/iu.test(seccion), `${slug}: la sección trae un manejador en línea`);
  }
});

test("el sello de vigencia degrada EN LO PUBLICADO, y no solo en una función", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  // EL GATE DE H-1. El workflow de G2 promete dos veces que en su rama ámbar «la sección degradará
  // sola»; hasta T-19 no degradaba nada y el único gate que miraba `verificadoEn` comprobaba su
  // FORMATO (`/^\d{4}-\d{2}-\d{2}$/`), que es lo que un sello de 2019 pasa sin despeinarse. Este
  // mide el artefacto: qué estado publican las 153 páginas y si dicen lo que ese estado obliga a
  // decir. Que los tres estados se lean distinto lo prueban los tests del módulo; que un sello
  // atrasado cambie la página construida, el recorrido adversario A2.
  const { fuente } = await cargarTablaDeTallas({
    slug: "vigo",
    nombre: "Vigo",
    fechaIso: FECHA_DE_BUILD,
    timezone: "Europe/Madrid",
  });
  const esperado = estadoDeVigencia(fuente.verificadoEn, FECHA_DE_BUILD);
  const aviso = avisoDeVigencia(esperado);
  for (const { slug, seccion } of await paginasConTabla()) {
    const publicado = /data-vigencia="([a-z_]+)"/u.exec(seccion)?.[1];
    assert.equal(
      publicado,
      esperado,
      `${slug}: publica el estado de vigencia ${publicado} y al sello ${fuente.verificadoEn} le ` +
        `toca ${esperado} el día que se construyó (${FECHA_DE_BUILD})`,
    );
    const leido = textoDe(seccion);
    if (aviso === null) {
      // Y al revés: con el sello recién escrito no puede haber un aviso de sello viejo. Un aviso
      // permanente se aprende a ignorar el primer día.
      assert.ok(!/que no se comprueba que esta norma siga en vigor/u.test(leido), `${slug}: avisa de más`);
    } else {
      assert.ok(leido.includes(textoDe(aviso)), `${slug}: el sello está ${esperado} y no lo dice`);
    }
  }
  t.diagnostic(
    `sello ${fuente.verificadoEn} · build ${FECHA_DE_BUILD} · estado ${esperado} ` +
      `(umbrales ${DIAS_SELLO_CORRIENTE}/${DIAS_SELLO_RANCIO} días)`,
  );
});

test("cero juice sobre una cifra legal: la hoja de la sección no anima ni destaca nada", (t) => {
  // El design brief ya prohíbe el motion (§6) y la gamificación del dato (§3); sobre una cifra con
  // consecuencia jurídica el argumento es más fuerte, así que se mide en vez de confiarse.
  const hoja = readFileSync(HOJA, "utf8");
  for (const prohibido of ["@keyframes", "animation", "transition", "box-shadow", "border-radius"]) {
    assert.ok(!hoja.includes(prohibido), `la hoja de tallas usa ${prohibido}`);
  }
  // La mancha de terracota, que el brief reserva al coeficiente y a los avisos, solo puede caer en
  // los avisos de esta sección. Nunca sobre una cifra.
  const conTerracota = [...hoja.matchAll(/^\.([\w-]+)[^{]*\{[^}]*--m-terra[^}]*\}/gmu)].map(
    (coincidencia) => coincidencia[1],
  );
  assert.deepEqual(conTerracota, ["tallas__aviso"]);
  t.diagnostic(`hoja de tallas-minimas.css: ${hoja.length} bytes`);
});
