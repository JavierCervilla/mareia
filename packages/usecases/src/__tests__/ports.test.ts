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
  });
  assert.equal("stationFile" in (vigo ?? {}), false);
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
