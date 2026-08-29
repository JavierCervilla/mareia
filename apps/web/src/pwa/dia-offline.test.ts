/**
 * **La promesa de T-12, comprobada**: lo que calcula el navegador es lo que calcula el servidor.
 *
 * No es una comparación con números escritos a mano. Se coge el payload que se le baja al teléfono
 * (`/offline/estaciones/<slug>.json`, generado por el mismo endpoint del sitio), se calcula con él
 * un día **futuro** —uno que no está en ninguna página construida— y se compara evento a evento con
 * lo que devuelve el caso de uso `getTides`, que es el que sirve el API. Si algún día una de las
 * dos rutas deriva de la otra, esto se pone rojo.
 *
 * Los doce puertos, no uno: el que se mira al desarrollar siempre funciona.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { getTides } from "@mareia/usecases";

import { cargarPuertos } from "../datos/catalogo.ts";
import { deps } from "../datos/deps.ts";
import { rutaPuerto } from "../rutas.ts";
import { diaOffline } from "./dia-offline.ts";
import {
  ESQUEMA_ESTACION_OFFLINE,
  esEstacionOffline,
  ventanaDeAnos,
  ventanaVigente,
} from "./estacion-offline.ts";
import type { EstacionOffline } from "./estacion-offline.ts";

/** Día del que hablan estos tests. Fijo: un test que cambia de respuesta cada mañana no es un gate. */
const GENERADO_EN = "2026-08-29";

/**
 * El payload que se le baja al teléfono, construido igual que en
 * `src/pages/offline/estaciones/[puerto].json.ts`.
 *
 * Se compone aquí en vez de leer el `dist/` a propósito: así este test corre sin haber construido y
 * lo que se compara es el **dato**, no el fichero.
 */
async function estacionOffline(slug: string): Promise<EstacionOffline> {
  const puerto = await deps.ports.findBySlug(slug);
  assert.ok(puerto, `el catálogo no tiene el puerto ${slug}`);
  const registro = await deps.stations.load(puerto.stationFile);
  return {
    schema: ESQUEMA_ESTACION_OFFLINE,
    generadoEn: GENERADO_EN,
    puerto: {
      slug: puerto.slug,
      nombre: puerto.name,
      timezone: puerto.timezone,
      ruta: rutaPuerto(puerto),
    },
    estacion: {
      schema: registro.schema,
      id: registro.id,
      name: registro.name,
      datum: { msl_offset_m: registro.datum.msl_offset_m },
      constituents: registro.constituents,
    },
    grade: registro.quality.grade,
    atribuciones: registro.attributions.map((fuente) => ({
      name: fuente.name,
      url: fuente.url,
      license: fuente.license,
    })),
  };
}

test("el navegador calcula un día futuro igual que el API, en los doce puertos", async () => {
  // Un día que no publica ninguna página construida: es el caso que un caché de páginas no cubre.
  const fechaIso = "2027-03-14";

  for (const puerto of await cargarPuertos()) {
    const enElNavegador = diaOffline(await estacionOffline(puerto.slug), fechaIso);
    assert.ok(enElNavegador.ok, `${puerto.name}: ${enElNavegador.ok ? "" : enElNavegador.motivo}`);

    const { events } = await getTides(deps, { slug: puerto.slug, from: fechaIso, to: fechaIso });
    assert.deepEqual(
      enElNavegador.eventos.map((evento) => ({
        timeUtcMs: evento.timeUtcMs,
        height_m: evento.height_m,
        kind: evento.kind,
      })),
      events.map((evento) => ({
        timeUtcMs: evento.timeUtcMs,
        height_m: evento.height_m,
        kind: evento.kind,
      })),
      `${puerto.name}: el cálculo del navegador no coincide con el del API`,
    );
  }
});

test("el día es el CIVIL del puerto, también la noche en que cambia la hora", async () => {
  // Último domingo de marzo de 2027: en Europe/Madrid ese día tiene 23 horas.
  const cambioDeHora = "2027-03-28";
  const dia = diaOffline(await estacionOffline("vigo"), cambioDeHora);
  assert.ok(dia.ok);

  const { events, range } = await getTides(deps, {
    slug: "vigo",
    from: cambioDeHora,
    to: cambioDeHora,
  });
  assert.equal(range.endUtcMs - range.startUtcMs, 23 * 3_600_000, "el día del cambio dura 23 h");
  assert.deepEqual(
    dia.eventos.map((evento) => evento.timeUtcMs),
    events.map((evento) => evento.timeUtcMs),
  );
});

test("fuera de la ventana de años no se inventa una hora: se dice por qué no la hay", async () => {
  const estacion = await estacionOffline("santander");
  const { hasta } = ventanaDeAnos(GENERADO_EN);
  const demasiadoLejos = diaOffline(estacion, `${hasta + 1}-06-01`);

  assert.equal(demasiadoLejos.ok, false);
  assert.ok(!demasiadoLejos.ok);
  assert.match(demasiadoLejos.motivo, /pierde .*garantía|garantía/u);
  assert.match(demasiadoLejos.motivo, new RegExp(String(hasta), "u"));
});

test("la ventana del navegador es la misma que la del API (año del build ±1)", () => {
  assert.deepEqual(ventanaDeAnos("2026-08-29"), { desde: 2025, hasta: 2027 });
});

test("un día que no existe en el calendario se dice, no se aproxima", async () => {
  const resultado = diaOffline(await estacionOffline("cadiz"), "2027-02-30");
  assert.ok(!resultado.ok);
  assert.match(resultado.motivo, /No existe el día 2027-02-30/u);
});

test("una fecha con otra forma se rechaza antes de tocar el motor", async () => {
  const resultado = diaOffline(await estacionOffline("cadiz"), "14/03/2027");
  assert.ok(!resultado.ok);
  assert.match(resultado.motivo, /Escribe la fecha/u);
});

// =================================================================================================
// Lo que se lee del disco del navegador NO se cree sin mirarlo.
// =================================================================================================

test("un payload guardado por otra versión no entra en el motor", async () => {
  const bueno = await estacionOffline("vigo");
  assert.equal(esEstacionOffline(bueno), true);

  const rotos: readonly unknown[] = [
    null,
    "no soy un objeto",
    { ...bueno, schema: "mareia/estacion-offline/v0" },
    { ...bueno, estacion: { ...bueno.estacion, constituents: [] } },
    { ...bueno, estacion: { ...bueno.estacion, datum: {} } },
    { ...bueno, puerto: { ...bueno.puerto, timezone: 42 } },
  ];
  for (const roto of rotos) {
    assert.equal(esEstacionOffline(roto), false, `esto no debería pasar la validación: ${String(roto)}`);
  }
});

// =================================================================================================
// R-2 · La ventana la manda la copia guardada, no el build de la página.
//
// Las dos se congelan en instantes distintos: el payload el día que se guardó, la página cada
// madrugada. Derivarla por separado en la sección y en la calculadora acabó publicando dos frases
// que se contradecían en la misma pantalla, con el campo de fecha dejando elegir el año que luego
// se rechazaba. La regla vive en un solo sitio y aquí se comprueba que dice lo que hace.
// =================================================================================================

test("con un favorito guardado manda SU ventana, aunque la página sea de otro año", () => {
  // Favorito guardado el 30 de diciembre; la página, reconstruida el 2 de enero.
  assert.deepEqual(ventanaVigente("2026-12-30", "2027-01-02"), { desde: 2025, hasta: 2027 });
  // Y es la misma que aplica el cálculo: la sección no puede prometer un año que esto rechaza.
  assert.deepEqual(ventanaVigente("2026-12-30", "2027-01-02"), ventanaDeAnos("2026-12-30"));
});

test("sin nada guardado manda la ventana del build, que es la del fichero que se bajaría", () => {
  assert.deepEqual(ventanaVigente(undefined, "2027-01-02"), ventanaDeAnos("2027-01-02"));
});

test("lo que promete la ventana vigente es exactamente lo que el cálculo acepta y rechaza", async () => {
  const estacion = { ...(await estacionOffline("vigo")), generadoEn: "2026-12-30" };
  const { desde, hasta } = ventanaVigente(estacion.generadoEn, "2027-01-02");

  assert.ok(diaOffline(estacion, `${desde}-01-01`).ok, "el primer día prometido tiene que calcular");
  assert.ok(diaOffline(estacion, `${hasta}-12-31`).ok, "el último día prometido tiene que calcular");
  assert.equal(diaOffline(estacion, `${hasta + 1}-01-01`).ok, false);
  assert.equal(diaOffline(estacion, `${desde - 1}-12-31`).ok, false);
});

// =================================================================================================
// La ventana del día civil viaja en la respuesta, y se afirma DEL LADO OFFLINE.
//
// El test del día de 23 h comparaba el intervalo contra el `range` del API, así que sobrevivía a
// una mutación del cálculo offline a ventana fija de 24 h mientras no cayera ningún extremo en la
// hora sobrante. Ahora el intervalo lo publica `diaOffline` y se compara el suyo.
// =================================================================================================

test("el intervalo que publica el cálculo offline es el día civil, no 24 h fijas", async () => {
  const estacion = await estacionOffline("vigo");
  const cambioDeHora = "2027-03-28";
  const dia = diaOffline(estacion, cambioDeHora);
  assert.ok(dia.ok);

  const { range } = await getTides(deps, { slug: "vigo", from: cambioDeHora, to: cambioDeHora });
  assert.equal(dia.inicioUtcMs, range.startUtcMs);
  assert.equal(dia.finUtcMs, range.endUtcMs);
  assert.equal(dia.finUtcMs - dia.inicioUtcMs, 23 * 3_600_000, "esa noche el día dura 23 h");

  // Y un día normal sigue durando 24: la ventana no se ha quedado corta para todos.
  const normal = diaOffline(estacion, "2027-03-14");
  assert.ok(normal.ok);
  assert.equal(normal.finUtcMs - normal.inicioUtcMs, 24 * 3_600_000);
});
