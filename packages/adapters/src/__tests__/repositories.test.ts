/**
 * Comportamiento de los adaptadores como adaptadores: caché, ruta inyectada y qué pasa cuando el
 * fichero no es lo que dice ser. No tocan el disco (la lectura entra por parámetro), así que lo que
 * se prueba aquí es el adaptador y no el dataset — para eso está `dataset.test.ts`.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DatasetFormatError } from "../json-parse.ts";
import { createPortsJsonRepository } from "../ports-json.ts";
import { createStationsJsonRepository } from "../stations-json.ts";

const PORTS_FILE = "/dataset/geo/ports.json";
const STATIONS_DIR = "/dataset/stations";

const PORTS_DOC = JSON.stringify({
  schema: "ports/v1",
  ports: [
    {
      slug: "vigo",
      name: "Vigo",
      province: { slug: "pontevedra", name: "Pontevedra" },
      region: { slug: "galicia", name: "Galicia" },
      lat: 42.2406,
      lon: -8.7207,
      timezone: "Europe/Madrid",
      stationFile: "es-po-vigo.json",
    },
  ],
});

const STATION_DOC = JSON.stringify({
  schema: "station/v1",
  id: "es-po-vigo",
  name: "Vigo",
  lat: 42.2406,
  lon: -8.7207,
  timezone: "Europe/Madrid",
  datum: { reference: "LAT", msl_offset_m: 1.982 },
  source: {
    attribution: [
      { name: "TICON-4", url: "https://example.invalid", license: "cc-by-4.0", role: "constantes" },
    ],
  },
  constituents: [{ name: "M2", amplitude_m: 1.1, phase_deg: 60 }],
  quality: {
    grade: "B",
    rmse_m: 0.067,
    hw_time_err_p95_min: 25.44,
    grade_reason: null,
    validated_against: "IOC vigo",
    estimated: false,
    estimated_reason: null,
  },
});

/** Lectura en memoria que además cuenta cuántas veces se la ha llamado y con qué ruta. */
function fakeReader(files: Readonly<Record<string, string>>): {
  readTextFile: (filePath: string) => Promise<string>;
  readonly calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    readTextFile: (filePath) => {
      calls.push(filePath);
      const content = files[filePath];
      return content === undefined
        ? Promise.reject(new Error(`ENOENT: ${filePath}`))
        : Promise.resolve(content);
    },
  };
}

test("el repositorio de puertos lee la ruta inyectada y la lee una sola vez", async () => {
  const reader = fakeReader({ [PORTS_FILE]: PORTS_DOC });
  const repository = createPortsJsonRepository({ filePath: PORTS_FILE, ...reader });

  const catalogue = await repository.list();
  const vigo = await repository.findBySlug("vigo");
  await repository.findBySlug("vigo");

  assert.deepEqual(reader.calls, [PORTS_FILE]);
  assert.equal(catalogue.length, 1);
  assert.equal(vigo?.name, "Vigo");
  assert.equal(vigo?.region.slug, "galicia");
});

test("un slug que no está en el catálogo se resuelve como `undefined`, no como error", async () => {
  const reader = fakeReader({ [PORTS_FILE]: PORTS_DOC });
  const repository = createPortsJsonRepository({ filePath: PORTS_FILE, ...reader });
  assert.equal(await repository.findBySlug("no-existe"), undefined);
});

test("un fichero con otro schema falla nombrando el fichero y el campo", async () => {
  const reader = fakeReader({ [PORTS_FILE]: JSON.stringify({ schema: "ports/v9", ports: [] }) });
  const repository = createPortsJsonRepository({ filePath: PORTS_FILE, ...reader });

  await assert.rejects(() => repository.list(), (error: unknown) => {
    assert.ok(error instanceof DatasetFormatError);
    assert.equal(error.filePath, PORTS_FILE);
    assert.match(error.message, /schema/);
    return true;
  });
});

test("un fallo de lectura no se cachea: la siguiente llamada vuelve a intentarlo", async () => {
  const reader = fakeReader({});
  const repository = createPortsJsonRepository({ filePath: PORTS_FILE, ...reader });

  await assert.rejects(() => repository.list());
  await assert.rejects(() => repository.list());
  assert.deepEqual(reader.calls, [PORTS_FILE, PORTS_FILE]);
});

test("el repositorio de estaciones traduce el fichero al registro de la capa de aplicación", async () => {
  const reader = fakeReader({ [`${STATIONS_DIR}/es-po-vigo.json`]: STATION_DOC });
  const repository = createStationsJsonRepository({ directory: STATIONS_DIR, ...reader });

  const station = await repository.load("es-po-vigo.json");
  await repository.load("es-po-vigo.json");

  assert.equal(reader.calls.length, 1, "la estación debería cachearse por fichero");
  assert.equal(station.id, "es-po-vigo");
  assert.equal(station.datum.reference, "LAT");
  assert.equal(station.constituents.length, 1);
  assert.equal(station.quality.grade_reason, null);
  assert.equal(station.quality.estimated, false);
  assert.deepEqual(station.attributions, [
    {
      name: "TICON-4",
      url: "https://example.invalid",
      license: "cc-by-4.0",
      license_url: null,
      role: "constantes",
    },
  ]);
});

/**
 * `quality.estimated` no admite ausencia. Un `undefined` leído como «falso» convertiría un puerto
 * sin medir en un puerto medido y la página dejaría de avisar justo donde hace falta: es el único
 * campo del contrato cuyo valor por omisión sería una mentira, así que se lee sin tolerancia.
 */
test("una estación sin `quality.estimated` se rechaza en vez de darla por medida", async () => {
  const sinFlag = JSON.parse(STATION_DOC) as { quality: Record<string, unknown> };
  delete sinFlag.quality["estimated"];
  const reader = fakeReader({ [`${STATIONS_DIR}/es-po-vigo.json`]: JSON.stringify(sinFlag) });
  const repository = createStationsJsonRepository({ directory: STATIONS_DIR, ...reader });

  await assert.rejects(() => repository.load("es-po-vigo.json"), /estimated/u);
});

test("un nombre de fichero de estación con travesía de directorios se rechaza", async () => {
  const reader = fakeReader({});
  const repository = createStationsJsonRepository({ directory: STATIONS_DIR, ...reader });

  await assert.rejects(() => repository.load("../../etc/passwd"), RangeError);
  assert.deepEqual(reader.calls, [], "no debería haberse intentado leer nada");
});
