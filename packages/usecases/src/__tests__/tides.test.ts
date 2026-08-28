import assert from "node:assert/strict";
import test from "node:test";

import { InvalidQueryError } from "../errors.ts";
import { getAlmanac, getTides } from "../tides.ts";
import { DEFAULT_CURVE_STEP_MINUTES, MAX_TIDES_RANGE_DAYS } from "../validate.ts";
import { fakeDeps } from "./fakes.ts";

const DAY = "2026-03-15";

test("pedir un solo día devuelve el día civil entero del puerto, no 24 h desde medianoche UTC", async () => {
  const result = await getTides(fakeDeps(), { slug: "vigo", from: DAY, to: DAY });

  // Madrid en marzo va +1: el día civil empieza a las 23:00 UTC del día anterior.
  assert.equal(result.range.startUtc, "2026-03-14T23:00:00.000Z");
  assert.equal(result.range.endUtc, "2026-03-15T23:00:00.000Z");
  assert.equal(result.range.timezone, "Europe/Madrid");
  assert.equal(result.curve.stepMinutes, DEFAULT_CURVE_STEP_MINUTES);

  for (const event of result.events) {
    assert.ok(event.timeUtcMs >= result.range.startUtcMs && event.timeUtcMs <= result.range.endUtcMs);
    assert.equal(event.timeUtc, new Date(event.timeUtcMs).toISOString());
    assert.match(event.kind, /^(high|low)$/);
  }
  assert.ok(result.events.length >= 3, "un día semidiurno tiene tres o cuatro extremos");
});

test("la respuesta de mareas arrastra la procedencia: estación, datum y calidad", async () => {
  const { station } = await getTides(fakeDeps(), { slug: "las-palmas-de-gran-canaria", from: DAY, to: DAY });

  assert.equal(station.quality.grade, "C");
  assert.equal(station.quality.hw_time_err_p95_min, null);
  assert.equal(station.datum.msl_offset_m, 2);
});

test("la curva empieza y acaba exactamente en los bordes del rango", async () => {
  const { curve, range } = await getTides(fakeDeps(), { slug: "vigo", from: DAY, to: DAY, step: 30 });

  assert.equal(curve.stepMinutes, 30);
  assert.equal(curve.samples[0]?.timeUtcMs, range.startUtcMs);
  assert.equal(curve.samples[curve.samples.length - 1]?.timeUtcMs, range.endUtcMs);
});

test("los límites publicados se hacen cumplir con un error que dice cuál era", async () => {
  const deps = fakeDeps();
  const rejects = (query: Parameters<typeof getTides>[1], expected: RegExp): Promise<void> =>
    assert.rejects(() => getTides(deps, query), (error: unknown) => {
      assert.ok(error instanceof InvalidQueryError, `no fue InvalidQueryError: ${String(error)}`);
      assert.match(error.message, expected);
      return true;
    });

  await rejects({ slug: "vigo", from: "2026-03-20", to: DAY }, /invertido/);
  await rejects({ slug: "vigo", from: DAY, to: "2026-06-01" }, new RegExp(`${MAX_TIDES_RANGE_DAYS}`));
  await rejects({ slug: "vigo", from: "2026-02-30", to: "2026-02-30" }, /calendario/);
  await rejects({ slug: "vigo", from: "15-03-2026", to: DAY }, /YYYY-MM-DD/);
  await rejects({ slug: "vigo", from: DAY, to: DAY, step: 0 }, /'step'/);
  await rejects({ slug: "vigo", from: DAY, to: DAY, step: 61 }, /'step'/);
  await rejects({ slug: "vigo", from: DAY, to: "2026-04-20", step: 1 }, /puntos/);
});

test("el almanaque cubre el año entero por días civiles, sin curva", async () => {
  const almanac = await getAlmanac(fakeDeps(), { slug: "vigo", year: 2026 });

  assert.equal(almanac.year, 2026);
  assert.equal(almanac.days.length, 365);
  assert.equal(almanac.days[0]?.dateIso, "2026-01-01");
  assert.equal(almanac.days[364]?.dateIso, "2026-12-31");
  assert.equal("curve" in almanac, false);

  const total = almanac.days.reduce((count, day) => count + day.events.length, 0);
  assert.ok(total > 1_300, `un año semidiurno pasa de 1.300 extremos, salieron ${total}`);

  // Cada evento cae en el día civil bajo el que se publica, no en el de al lado.
  for (const day of almanac.days.slice(0, 40)) {
    for (const event of day.events) {
      const local = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(
        new Date(event.timeUtcMs),
      );
      assert.equal(local, day.dateIso);
    }
  }
});

test("el almanaque solo sirve el año en curso ±1, contado en la zona del puerto", async () => {
  const deps = fakeDeps();
  assert.equal((await getAlmanac(deps, { slug: "vigo", year: 2025 })).year, 2025);
  assert.equal((await getAlmanac(deps, { slug: "vigo", year: "2027" })).year, 2027);

  for (const year of [2024, 2028, "el año que viene"]) {
    await assert.rejects(() => getAlmanac(deps, { slug: "vigo", year }), InvalidQueryError);
  }
});

test("el año se valida sobre el crudo: ni hexadecimales, ni signos, ni espacios", async () => {
  const deps = fakeDeps();
  // Para `Number()` todos estos valen 2026. Si pasaran, la misma respuesta viviría en un puñado de
  // URLs distintas y cada caché intermedia guardaría su propia copia.
  for (const year of ["0x7ea", "+2026", " 2026", "2026 ", "2026.0", "2_026", "2026e0", ""]) {
    await assert.rejects(
      () => getAlmanac(deps, { slug: "vigo", year }),
      InvalidQueryError,
      `'${year}' no debería servir un almanaque`,
    );
  }
  assert.equal((await getAlmanac(deps, { slug: "vigo", year: "2026" })).year, 2026);
});
