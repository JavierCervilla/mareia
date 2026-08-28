import assert from "node:assert/strict";
import test from "node:test";

import { PortNotFoundError } from "../errors.ts";
import { getPort, listPorts } from "../ports.ts";
import { fakeDeps, VIGO } from "./fakes.ts";

test("el catálogo publica la ficha del puerto y NO por dónde se guarda su estación", async () => {
  const { ports } = await listPorts(fakeDeps());

  assert.equal(ports.length, 2);
  assert.deepEqual(ports[0], {
    slug: "vigo",
    name: "Vigo",
    province: { slug: "pontevedra", name: "Pontevedra" },
    region: { slug: "galicia", name: "Galicia" },
    lat: VIGO.lat,
    lon: VIGO.lon,
    timezone: "Europe/Madrid",
  });
  assert.equal("stationFile" in (ports[0] ?? {}), false);
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
