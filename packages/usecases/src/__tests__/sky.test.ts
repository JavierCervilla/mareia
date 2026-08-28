import assert from "node:assert/strict";
import test from "node:test";

import { InvalidQueryError } from "../errors.ts";
import { getAstro, getSolunar } from "../sky.ts";
import { fakeDeps } from "./fakes.ts";

const DAY = "2026-03-15";

test("las efemérides del día caen dentro del día civil del puerto", async () => {
  const astro = await getAstro(fakeDeps(), { slug: "vigo", date: DAY });

  assert.equal(astro.dateIso, DAY);
  assert.equal(astro.timezone, "Europe/Madrid");
  assert.equal(astro.day.startUtc, "2026-03-14T23:00:00.000Z");

  assert.equal(astro.sun.rise.outcome, "event");
  assert.equal(astro.sun.set.outcome, "event");
  if (astro.sun.rise.outcome === "event") {
    const { event } = astro.sun.rise;
    assert.ok(event.timeUtcMs > astro.day.startUtcMs && event.timeUtcMs < astro.day.endUtcMs);
    assert.equal(event.body, "sun");
    assert.equal(event.kind, "rise");
    // En Vigo, a mediados de marzo, el Sol sale por el este con poco margen.
    assert.ok(Math.abs(event.azimuth_deg - 90) < 15, `acimut inesperado: ${event.azimuth_deg}`);
  }

  assert.equal(astro.sun.twilight.altitudes_deg.nautical, -12);
  assert.equal(astro.sun.twilight.civil.dawn.outcome, "event");
  assert.equal(astro.sun.transit.kind, "upper");
  assert.ok(astro.sun.transit.altitude_deg > 0, "el Sol culmina por encima del horizonte en Vigo");

  assert.equal(astro.moon.upperTransit.body, "moon");
  assert.ok(astro.moon.illumination.illuminatedFraction >= 0);
  assert.ok(astro.moon.distance.distance_km > 300_000);
});

test("una búsqueda sin evento viaja con su motivo, no como un hueco", async () => {
  const astro = await getAstro(fakeDeps(), { slug: "vigo", date: DAY });
  const searches = [astro.sun.rise, astro.sun.set, astro.moon.rise, astro.moon.set];

  for (const search of searches) {
    if (search.outcome === "no-event") {
      assert.match(search.reason, /^always-(above|below)$/);
      assert.equal(typeof search.searchedFromUtc, "string");
    } else {
      assert.equal(typeof search.event.timeUtc, "string");
    }
  }
});

test("los periodos solunares del día llegan con su rating desglosado", async () => {
  const solunar = await getSolunar(fakeDeps(), { slug: "las-palmas-de-gran-canaria", date: DAY });

  assert.equal(solunar.timezone, "Atlantic/Canary");
  assert.ok(solunar.periods.length >= 1 && solunar.periods.length <= 4);
  for (const period of solunar.periods) {
    assert.ok(period.startUtcMs <= period.peakUtcMs && period.peakUtcMs <= period.endUtcMs);
    assert.match(period.kind, /^(major|minor)$/);
    assert.equal(period.peakUtc, new Date(period.peakUtcMs).toISOString());
  }

  assert.ok(solunar.rating.score >= 0 && solunar.rating.score <= 100);
  assert.match(solunar.rating.label, /^(baja|media|alta|muy-alta)$/);
  assert.equal(
    solunar.rating.solarOverlapCount,
    solunar.periods.filter((period) => period.overlapsSolarEvent).length,
  );
});

test("una fecha imposible es un error de la petición en los dos casos de uso del cielo", async () => {
  const deps = fakeDeps();
  await assert.rejects(() => getAstro(deps, { slug: "vigo", date: "2026-13-01" }), InvalidQueryError);
  await assert.rejects(() => getSolunar(deps, { slug: "vigo", date: "ayer" }), InvalidQueryError);
});
