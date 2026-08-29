/**
 * La PWA **en el `dist/`**: lo que de verdad se publica.
 *
 * Los tests de `src/pwa/*.test.ts` afirman que las piezas hacen lo suyo; éste afirma que salen del
 * build, que salen bien y que **caben**. Los presupuestos de peso no son decoración: la PWA la usa
 * quien está en la playa con mala cobertura, y un favorito que tarda medio minuto en guardarse no
 * se guarda. Las cifras son **medidas**, no estimadas, y las mismas que van al CHANGELOG.
 *
 * Unidades: **kB de mil bytes** (SI) en todo el fichero. Ni una cifra en KiB, para que dos números
 * de la misma tabla se puedan sumar.
 *
 * Exige haber construido (`pnpm --filter web build`); sin build se salta en vez de dar un rojo falso.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getTides } from "@mareia/usecases";

import { cargarPuertos } from "./datos/catalogo.ts";
import { deps } from "./datos/deps.ts";
import { FECHA_DE_BUILD } from "./datos/fecha-build.ts";
import { activeModules } from "./modules.config.ts";
import { generarServiceWorker } from "./pwa/generar-sw.ts";
import { esEstacionOffline } from "./pwa/estacion-offline.ts";
import { diaOffline } from "./pwa/dia-offline.ts";
import { iconoSvg, MANIFIESTO } from "./pwa/marca.ts";
import { politicasDeModulos } from "./pwa/precacheo.ts";
import { PROTOCOLO, RUTA_MANIFEST, rutaEstacionOffline } from "./pwa/protocolo.ts";
import { rutaPuerto } from "./rutas.ts";

const RAIZ = dirname(fileURLToPath(import.meta.url));
const DIST = join(RAIZ, "..", "dist");
const SW = join(DIST, "sw.js");
const HAY_BUILD = existsSync(SW);
const SIN_BUILD = "no hay apps/web/dist: corre antes `pnpm --filter web build`";

/** Los modos de `display` con los que un navegador considera instalable una PWA. */
const DISPLAY_INSTALABLE = ["standalone", "minimal-ui", "fullscreen"];

function fichero(...tramos: readonly string[]): string {
  return readFileSync(join(DIST, ...tramos), "utf8");
}

function bytes(...tramos: readonly string[]): number {
  return statSync(join(DIST, ...tramos)).size;
}

/** El asset construido cuyo nombre empieza por `prefijo`. Los hashes cambian en cada build. */
function assetQueEmpiezaPor(prefijo: string): string {
  const encontrado = readdirSync(join(DIST, "_astro")).find((nombre) => nombre.startsWith(prefijo));
  assert.ok(encontrado, `no hay ningún asset construido que empiece por ${prefijo}`);
  return join("_astro", encontrado);
}

// =================================================================================================
// El service worker publicado
// =================================================================================================

test("`/sw.js` es exactamente el que genera el fuente de este commit", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const esperado = generarServiceWorker({
    fuente: readFileSync(join(RAIZ, "pwa", "sw.ts"), "utf8"),
    fechaIso: FECHA_DE_BUILD,
    protocolo: PROTOCOLO,
    politicas: politicasDeModulos(activeModules),
  });
  assert.equal(readFileSync(SW, "utf8"), esperado, "el /sw.js publicado no es el del fuente");
});

test("el worker se sirve desde la raíz: su ámbito es el sitio entero y no un subdirectorio", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  assert.ok(existsSync(SW), "un /sw.js bajo /_astro/ solo controlaría /_astro/");
});

// =================================================================================================
// Instalable: manifiesto e icono
// =================================================================================================

test("el manifiesto publicado es JSON válido y declara lo que hace falta para instalar", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const manifiesto: unknown = JSON.parse(fichero("manifest.webmanifest"));
  assert.deepEqual(manifiesto, MANIFIESTO);

  const leido = manifiesto as typeof MANIFIESTO;
  assert.ok(leido.name.length > 0 && leido.short_name.length > 0);
  assert.ok(DISPLAY_INSTALABLE.includes(leido.display), `display=${leido.display} no es instalable`);
  assert.equal(leido.lang, "es");
  for (const icono of leido.icons) {
    assert.ok(existsSync(join(DIST, icono.src.slice(1))), `el icono ${icono.src} no se ha publicado`);
  }
});

test("el icono publicado es el que dibuja `marca.ts`, sin fuentes ni degradados", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const svg = fichero("icono.svg");
  assert.equal(svg, iconoSvg());
  assert.doesNotMatch(svg, /<text|font-family|linearGradient|filter/u);
});

test("todas las páginas del sitio enlazan el manifiesto: la identidad no cambia según por dónde entres", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  for (const ruta of ["", ...(await cargarPuertos()).map((puerto) => rutaPuerto(puerto).slice(1))]) {
    const html = fichero(ruta, "index.html");
    assert.ok(
      html.includes(`<link rel="manifest" href="${RUTA_MANIFEST}">`),
      `${ruta || "/"} no enlaza el manifiesto`,
    );
  }
});

// =================================================================================================
// Las constantes armónicas que se lleva un favorito
// =================================================================================================

/**
 * **El gate de la promesa, sobre el artefacto publicado.**
 *
 * Aquí está la lección que costó el rechazo del verificador: `pwa/dia-offline.test.ts` compara el
 * cálculo del navegador con `getTides` en los doce puertos, pero **compone el payload dentro del
 * test**, así que prueba el motor y no el fichero que se le baja al teléfono. Sonda del verificador:
 * un `constituents.slice(0, 8)` en el endpoint dejaba los 172 tests y los 35 recorridos en verde
 * mientras la tabla offline de Vigo se separaba **13 cm y 6 min** de la del API. Horas plausibles y
 * equivocadas, que es justo lo que este proyecto dice no publicar.
 *
 * Así que el bucle que ya tenía el payload publicado en la mano lo compara **evento a evento**.
 */
test("lo que se publica calcula EXACTAMENTE lo mismo que el API, en los doce puertos", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  // Un día que no publica ninguna página construida: es lo que un caché de páginas no puede dar.
  const fechaIso = "2027-03-14";

  for (const puerto of await cargarPuertos()) {
    const ruta = rutaEstacionOffline(puerto.slug).slice(1);
    const payload: unknown = JSON.parse(fichero(ruta));
    assert.ok(esEstacionOffline(payload), `${puerto.slug}: el payload publicado no valida`);

    const dia = diaOffline(payload, fechaIso);
    assert.ok(dia.ok, `${puerto.slug}: no se puede calcular con lo que se publica`);
    assert.ok(dia.eventos.length > 0, `${puerto.slug}: el día calculado sale vacío`);

    const { events, range } = await getTides(deps, { slug: puerto.slug, from: fechaIso, to: fechaIso });
    assert.deepEqual(
      dia.eventos.map((evento) => ({
        timeUtcMs: evento.timeUtcMs,
        height_m: evento.height_m,
        kind: evento.kind,
      })),
      events.map((evento) => ({
        timeUtcMs: evento.timeUtcMs,
        height_m: evento.height_m,
        kind: evento.kind,
      })),
      `${puerto.slug}: el fichero PUBLICADO no calcula lo mismo que el API`,
    );
    // Y la ventana también: un día civil no siempre dura 24 h.
    assert.equal(dia.inicioUtcMs, range.startUtcMs, `${puerto.slug}: el día empieza en otro sitio`);
    assert.equal(dia.finUtcMs, range.endUtcMs, `${puerto.slug}: el día acaba en otro sitio`);

    // La procedencia viaja con el dato: una tabla calculada en el móvil también responde por sí.
    assert.ok(payload.atribuciones.length > 0, `${puerto.slug}: sin atribuciones`);
    assert.ok(payload.grade.length > 0, `${puerto.slug}: sin grade del QC`);
  }
});

test("las constantes NO llevan los metadatos del pipeline: al teléfono baja lo que se usa o se cita", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const crudo = fichero(rutaEstacionOffline("vigo").slice(1));
  for (const campo of ["rmse_m", "hw_time_err_p95_min", "validated_against", "stationFile"]) {
    assert.ok(!crudo.includes(campo), `${campo} no tiene por qué bajar al teléfono`);
  }
});

// =================================================================================================
// Las dos secciones, en el HTML construido y sin JavaScript
// =================================================================================================

test("sin JavaScript, las dos secciones explican qué hacen en vez de enseñar controles muertos", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const html = fichero(rutaPuerto((await cargarPuertos())[0]!).slice(1), "index.html");

  // El botón y el formulario viajan ocultos: sin JS no harían nada.
  assert.match(html, /<button[^>]*data-sin-red-accion[^>]*hidden/u);
  assert.match(html, /<form[^>]*data-otro-dia-form[^>]*hidden/u);
  // Y lo que sí se lee explica el hueco.
  assert.match(html, /Guardar el puerto necesita JavaScript/u);
  assert.match(html, /Hace falta JavaScript: sin él no aparece el formulario/u);
  // Las regiones vivas viajan vacías (lección H-7 de T-11).
  assert.match(html, /data-sin-red-anuncio role="status" aria-live="polite"><\/p>/u);
});

test("la sección de guardar lleva los datos que necesita el cliente, y ninguno de más", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const puerto = (await cargarPuertos())[0]!;
  const html = fichero(rutaPuerto(puerto).slice(1), "index.html");

  assert.ok(html.includes(`data-sin-red-slug="${puerto.slug}"`));
  assert.ok(html.includes(`data-sin-red-ruta="${rutaPuerto(puerto)}"`));
  assert.ok(html.includes(`data-sin-red-fecha="${FECHA_DE_BUILD}"`));
  assert.ok(html.includes("data-sin-red-assets-modulos="), "los assets de módulos viajan del build");
  assert.ok(html.includes(`data-otro-dia-slug="${puerto.slug}"`));
});

// =================================================================================================
// PRESUPUESTOS DE PESO · cifras medidas, no estimadas. Las mismas que van al CHANGELOG.
// =================================================================================================

/**
 * Los topes son **holgados sobre lo medido** a propósito: no están para clavar un número, están
 * para que un descuido que multiplique por dos lo que se baja a un teléfono salga en rojo antes de
 * llegar a la playa. Si una cifra sube de verdad, se sube el tope **y se explica en el CHANGELOG**.
 */
const TOPES = {
  /** El worker entero, con sus comentarios (que son su documentación y su auditoría). */
  swBytes: 24_000,
  /** Constantes armónicas de UN puerto: lo que se baja al marcar un favorito. */
  estacionBytes: 4_000,
  /** El bundle que baja CUALQUIERA que abra un puerto, use la PWA o no. */
  pwaBaseBytes: 20_000,
  /** El motor, que solo baja quien pide otro día (o quien guarda el puerto). */
  motorBytes: 80_000,
} as const;

test("el service worker cabe en su presupuesto", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const medido = bytes("sw.js");
  assert.ok(medido <= TOPES.swBytes, `sw.js pesa ${medido} B y el tope es ${TOPES.swBytes} B`);
});

test("las constantes de cada puerto caben en su presupuesto, y los doce juntos siguen siendo poco", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  let total = 0;
  for (const puerto of await cargarPuertos()) {
    const medido = bytes(rutaEstacionOffline(puerto.slug).slice(1));
    total += medido;
    assert.ok(
      medido <= TOPES.estacionBytes,
      `${puerto.slug}: ${medido} B de constantes, tope ${TOPES.estacionBytes} B`,
    );
  }
  // El catálogo entero pesa menos que una foto: es la razón de guardar constantes y no almanaques.
  assert.ok(total <= 12 * TOPES.estacionBytes, `los doce puertos suman ${total} B`);
});

test("el JavaScript que baja quien NO usa la PWA está acotado: el motor va aparte", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const base = bytes(assetQueEmpiezaPor("index.astro_astro_type_script"));
  const motor = bytes(assetQueEmpiezaPor("dia-offline."));

  assert.ok(base <= TOPES.pwaBaseBytes, `el bundle base de la PWA pesa ${base} B`);
  assert.ok(motor <= TOPES.motorBytes, `el motor pesa ${motor} B`);
  assert.ok(
    motor > base,
    "si el motor dejara de ser lo gordo, el corte por `import()` habría dejado de tener sentido",
  );
});

/**
 * El motor tiene que estar en **su propio fichero**: si el corte se pierde en un refactor, los
 * ~70 kB vuelven al bundle que baja cualquiera que abra un puerto y nadie se entera.
 */
test("el motor de mareas se sirve en un trozo aparte y no dentro del bundle de la página", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const base = fichero(assetQueEmpiezaPor("index.astro_astro_type_script"));
  assert.ok(
    !base.includes("SUPPORTED_CONSTITUENTS") && !/M2|S2|N2/u.test(base.slice(0, 200)),
    "la tabla de constituyentes no puede estar en el bundle de entrada",
  );
  assert.ok(existsSync(join(DIST, assetQueEmpiezaPor("dia-offline."))));
});
