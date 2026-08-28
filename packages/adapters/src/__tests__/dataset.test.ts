/**
 * Coherencia del catálogo con el dataset: `data/geo/ports.json` ↔ `data/stations/*.json`.
 *
 * `ports.json` está escrito a mano y sus coordenadas y zona horaria son **copia** de las del JSON
 * de la estación. Una copia sin test es una copia que se desincroniza: este fichero es el que hace
 * que añadir un puerto y olvidarse de su estación (o mover una estación y no el puerto) salga en
 * rojo en vez de servir mareas del sitio equivocado.
 */

import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

import { createPortsJsonRepository } from "../ports-json.ts";
import { createStationsJsonRepository } from "../stations-json.ts";

const DATA_DIR = fileURLToPath(new URL("../../../../data/", import.meta.url));
const STATIONS_DIR = `${DATA_DIR}stations`;

const ports = createPortsJsonRepository({ filePath: `${DATA_DIR}geo/ports.json` });
const stations = createStationsJsonRepository({ directory: STATIONS_DIR });

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Ficheros de estación del dataset, sin el schema ni el README. */
function stationFilesOnDisk(): readonly string[] {
  return readdirSync(STATIONS_DIR)
    .filter((name) => name.endsWith(".json") && !name.endsWith(".schema.json"))
    .sort();
}

test("el catálogo tiene los 12 puertos del piloto, con slugs únicos y en forma de URL", async () => {
  const catalogue = await ports.list();
  assert.equal(catalogue.length, 12);

  const slugs = catalogue.map((port) => port.slug);
  assert.equal(new Set(slugs).size, slugs.length, "hay slugs repetidos");
  for (const port of catalogue) {
    for (const slug of [port.slug, port.province.slug, port.region.slug]) {
      assert.match(slug, SLUG_PATTERN);
    }
  }
});

test("cada puerto apunta a una estación existente y copia sus coordenadas y su zona", async () => {
  for (const port of await ports.list()) {
    const station = await stations.load(port.stationFile);
    assert.equal(
      port.stationFile,
      `${station.id}.json`,
      `el fichero de ${port.slug} no se llama como su estación`,
    );
    assert.equal(port.lat, station.lat, `lat descuadrada en ${port.slug}`);
    assert.equal(port.lon, station.lon, `lon descuadrada en ${port.slug}`);
    assert.equal(port.timezone, station.timezone, `zona horaria descuadrada en ${port.slug}`);
  }
});

test("el catálogo cubre el dataset entero: ni estaciones huérfanas ni referencias muertas", async () => {
  const referenced = (await ports.list()).map((port) => port.stationFile).sort();
  assert.deepEqual(referenced, stationFilesOnDisk());
});

test("Brest no es un puerto del catálogo: es la referencia del coeficiente (T-04)", async () => {
  const catalogue = await ports.list();
  assert.equal(
    catalogue.some((port) => port.slug.includes("brest") || port.stationFile.includes("brest")),
    false,
  );
});

test("toda estación referenciada trae su calidad, y la de un grade C viaja con sus nulos", async () => {
  for (const port of await ports.list()) {
    const { quality, attributions } = await stations.load(port.stationFile);
    assert.match(quality.grade, /^[ABC]$/);
    assert.ok(attributions.length > 0, `${port.slug} sin atribuciones`);
  }

  // Cabo de Palos es micromareal: no hay pleamares identificables en la observación, así que el
  // error de hora se publica como `null` y el grade explica por qué no llega a B.
  const microtidal = await stations.load("es-mu-cabo-de-palos.json");
  assert.equal(microtidal.quality.grade, "C");
  assert.equal(microtidal.quality.hw_time_err_p95_min, null);
  assert.equal(typeof microtidal.quality.grade_reason, "string");
});
