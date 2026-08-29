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

/**
 * Los doce puertos que T-05 escribió a mano y T-13 no toca. El catálogo creció a toda la costa
 * derivándolo del volcado de GeoNames, pero estos siguen siendo dato editorial: sus coordenadas de
 * dársena, sus identificadores y sus URL están publicados y moverlos rompe enlaces de verdad.
 */
const PILOTO = [
  "a-coruna",
  "bilbao",
  "cabo-de-palos",
  "cadiz",
  "huelva",
  "la-manga-del-mar-menor",
  "las-palmas-de-gran-canaria",
  "malaga",
  "palma-de-mallorca",
  "santa-cruz-de-tenerife",
  "santander",
  "vigo",
] as const;

/** Cota inferior del catálogo publicado: T-13 lo llevó de 12 a ciento y pico. */
const MINIMO_DE_PUERTOS = 120;

test("el catálogo cubre la costa española, con slugs únicos y en forma de URL", async () => {
  const catalogue = await ports.list();
  assert.ok(
    catalogue.length >= MINIMO_DE_PUERTOS,
    `el catálogo se ha encogido a ${catalogue.length} puertos: si es a propósito, baja la cota`,
  );

  const slugs = catalogue.map((port) => port.slug);
  assert.equal(new Set(slugs).size, slugs.length, "hay slugs repetidos");
  for (const port of catalogue) {
    for (const slug of [port.slug, port.province.slug, port.region.slug]) {
      assert.match(slug, SLUG_PATTERN);
    }
  }
});

test("los doce puertos del piloto siguen en el catálogo con su URL intacta", async () => {
  const catalogue = await ports.list();
  const bySlug = new Map(catalogue.map((port) => [port.slug, port]));
  for (const slug of PILOTO) {
    assert.ok(bySlug.get(slug) !== undefined, `el piloto '${slug}' ha desaparecido del catálogo`);
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

  // Cabo de Palos toma las constantes de Cartagena, a 24,8 km, y no tiene observación propia: ni
  // RMSE ni error de hora que publicar, y el grade explica por qué no llega a B.
  const borrowed = await stations.load("es-mu-cabo-de-palos.json");
  assert.equal(borrowed.quality.grade, "C");
  assert.equal(borrowed.quality.hw_time_err_p95_min, null);
  assert.equal(typeof borrowed.quality.grade_reason, "string");
});

/**
 * El invariante que T-13 añade y que vale más que cualquier recuento: **ningún puerto publica un
 * número que no se haya medido en él**.
 *
 * Un puerto no estimado tiene mareógrafo en su dársena y observación con la que contrastarlo, así
 * que tiene error medido. Uno estimado puede tener error (si la observación existe pero las
 * constantes vienen de otro sitio) o no tenerlo, pero **nunca** al revés: publicar RMSE sin ser
 * medible es exactamente el fraude que este dataset existe para no cometer, y con 150 puertos
 * dejarlo a la vista de una revisión humana es dejarlo pasar.
 */
test("ningún puerto publica una precisión que no tiene", async () => {
  const incoherentes: string[] = [];
  for (const port of await ports.list()) {
    const { quality } = await stations.load(port.stationFile);
    if (!quality.estimated && quality.rmse_m === null) {
      incoherentes.push(`${port.slug}: no estimado y sin RMSE medido`);
    }
    if (!quality.estimated && quality.grade === "C" && quality.grade_reason === null) {
      incoherentes.push(`${port.slug}: grade C sin motivo`);
    }
    if (quality.estimated && quality.estimated_reason === null) {
      incoherentes.push(`${port.slug}: estimado sin decir por qué`);
    }
    if (quality.rmse_m === null && quality.hw_time_err_p95_min !== null) {
      incoherentes.push(`${port.slug}: error de hora sin observación con la que medirlo`);
    }
  }
  assert.deepEqual(incoherentes, []);
});

/** Un puerto que hereda las constantes de lejos no puede heredar también el grade de quien se las presta. */
test("ningún puerto estimado alcanza el grade A", async () => {
  const impostores: string[] = [];
  for (const port of await ports.list()) {
    const { quality } = await stations.load(port.stationFile);
    if (quality.estimated && quality.grade === "A") {
      impostores.push(port.slug);
    }
  }
  assert.deepEqual(impostores, []);
});
