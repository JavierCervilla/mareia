import assert from "node:assert/strict";
import test from "node:test";

import { PortNotFoundError } from "../errors.ts";
import { getPort, listPorts } from "../ports.ts";
import type { Port } from "../types.ts";
import { fakeDeps, VIGO } from "./fakes.ts";

/** Puerto de juguete con lo justo para probar el orden del catálogo. */
function port(slug: string, name: string, province: string, region: string): Port {
  return {
    slug,
    name,
    province: { slug: province.toLowerCase(), name: province },
    region: { slug: region.toLowerCase(), name: region },
    lat: 0,
    lon: 0,
    timezone: "Europe/Madrid",
    stationFile: `${slug}.json`,
  };
}

test("el catálogo publica la ficha del puerto y NO por dónde se guarda su estación", async () => {
  const { ports } = await listPorts(fakeDeps());

  assert.equal(ports.length, 2);
  const vigo = ports.find((port) => port.slug === "vigo");
  assert.deepEqual(vigo, {
    slug: "vigo",
    name: "Vigo",
    province: { slug: "pontevedra", name: "Pontevedra" },
    region: { slug: "galicia", name: "Galicia" },
    lat: VIGO.lat,
    lon: VIGO.lon,
    timezone: "Europe/Madrid",
    quality: {
      grade: "C",
      estimated: false,
      rmse_m: 0.0429,
      hw_time_err_p95_min: null,
    },
  });
  assert.equal("stationFile" in (vigo ?? {}), false);
});

/**
 * El catálogo es el sitio donde se **elige** puerto, así que la calidad tiene que estar en él: sin
 * esto, saber cuáles de los 153 publican una marea medida cuesta 153 peticiones a `/v1/ports/:slug`.
 *
 * Se comprueba puerto a puerto y no «alguno la trae»: la forma de romperse esto no es que
 * desaparezca el campo, es que lo traigan 148 de 153.
 */
test("todas las entradas del catálogo traen su calidad, y el null viaja como null", async () => {
  const { ports } = await listPorts(fakeDeps());

  const sinCalidad = ports.filter((port) => port.quality === undefined).map((port) => port.slug);
  assert.deepEqual(sinCalidad, [], "hay puertos del catálogo sin calidad publicada");

  for (const port of ports) {
    assert.equal(typeof port.quality.grade, "string", `${port.slug} sin grade`);
    assert.equal(typeof port.quality.estimated, "boolean", `${port.slug} sin estimated`);
    // `in` y no `!== undefined`: un campo ausente y un campo a `null` se serializan distinto, y lo
    // que el cliente tiene que recibir es el `null` —«no se pudo medir»—, no un hueco.
    assert.ok("rmse_m" in port.quality, `${port.slug} no publica rmse_m`);
    assert.ok(
      "hw_time_err_p95_min" in port.quality,
      `${port.slug} no publica hw_time_err_p95_min`,
    );
  }
  assert.equal(
    ports.find((port) => port.slug === "vigo")?.quality.hw_time_err_p95_min,
    null,
    "el p95 no medible del fixture se maquilló al pasar por el catálogo",
  );
});

test("el catálogo sale ordenado por región, provincia y puerto, en español", async () => {
  // Entra desordenado y con un caso que el orden por defecto de JS coloca mal: comparando con `<`
  // se comparan unidades de código, y «Á» (U+00C1) va detrás de «Z», así que «Águilas» acabaría
  // después de «La Manga del Mar Menor» en vez de abrir los puertos de Murcia. Los demás nombres
  // llevan acentos que NO deciden nada («Andalucía» empieza por A plana y «Cádiz» se separa de
  // «Huelva» en la C): si el fixture fuera solo eso, quitar el colador dejaría el test verde.
  const desordenado = [
    port("santander", "Santander", "Cantabria", "Cantabria"),
    port("aguilas", "Águilas", "Murcia", "Región de Murcia"),
    port("vigo", "Vigo", "Pontevedra", "Galicia"),
    port("bilbao", "Bilbao", "Bizkaia", "País Vasco"),
    port("malaga", "Málaga", "Málaga", "Andalucía"),
    port("a-coruna", "A Coruña", "A Coruña", "Galicia"),
    port("cadiz", "Cádiz", "Cádiz", "Andalucía"),
    port("huelva", "Huelva", "Huelva", "Andalucía"),
    port("la-manga-del-mar-menor", "La Manga del Mar Menor", "Murcia", "Región de Murcia"),
    port("cabo-de-palos", "Cabo de Palos", "Murcia", "Región de Murcia"),
  ];

  const { ports } = await listPorts(fakeDeps(desordenado));

  assert.deepEqual(
    ports.map((entry) => entry.slug),
    [
      "cadiz",
      "huelva",
      "malaga",
      "santander",
      "a-coruna",
      "vigo",
      "bilbao",
      "aguilas",
      "cabo-de-palos",
      "la-manga-del-mar-menor",
    ],
  );
});

test("ordenar el catálogo no muta lo que devuelve el repositorio", async () => {
  const catalogo = [
    port("vigo", "Vigo", "Pontevedra", "Galicia"),
    port("cadiz", "Cádiz", "Cádiz", "Andalucía"),
  ];
  await listPorts(fakeDeps(catalogo));

  assert.deepEqual(
    catalogo.map((entry) => entry.slug),
    ["vigo", "cadiz"],
    "el caso de uso ordenó in situ la caché del repositorio",
  );
});

test("la ficha de un puerto lleva la calidad y las atribuciones de su estación", async () => {
  const { port, station } = await getPort(fakeDeps(), "vigo");

  assert.equal(port.slug, "vigo");
  assert.equal(station.datum.reference, "LAT");
  assert.equal(station.constituents, 2);
  assert.equal(station.quality.grade, "C");
  assert.equal(station.quality.hw_time_err_p95_min, null, "un null del QC no se puede maquillar");
  assert.equal(station.attributions[0]?.license, "cc-by-4.0");
});

test("un slug que no existe es `PortNotFoundError`, no una respuesta vacía", async () => {
  await assert.rejects(() => getPort(fakeDeps(), "cadaques"), PortNotFoundError);
});
