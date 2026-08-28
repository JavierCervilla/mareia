/**
 * Golden tests de astronomía contra el oráculo del USNO.
 *
 * Contrastan 8 fechas de 2026 × 2 sitios (Madrid y Las Palmas) evento a evento. Lo que verifican
 * no es la física —de eso responde `astronomy-engine`— sino que nuestra envoltura no se equivoca
 * de huso, de signo en la longitud, de dirección de búsqueda ni de convención de horizonte: los
 * cuatro errores que producen una hora plausible y falsa.
 *
 * Procedencia de las efemérides: `fixtures/usno/README.md`.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  moonIllumination,
  nextMoonQuarters,
  searchHorizonEvent,
  searchTransit,
  searchTwilight,
} from "../index.ts";
import type { CelestialBody, GeoLocation } from "../types.ts";
import type { UsnoEvent } from "./fixtures.ts";
import { loadUsnoMoonQuarters2026, loadUsnoOneDay, USNO_DATES, USNO_SITES } from "./fixtures.ts";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;

/**
 * El USNO tabula al minuto, así que ±30 s ya se van en el redondeo de la fuente. ±2 min para
 * cruces del horizonte y ±3 min para tránsitos son tolerancias estrictas, no generosas.
 */
const HORIZON_TOLERANCE_MIN = 2;
const TRANSIT_TOLERANCE_MIN = 3;
/** Los cuartos lunares se publican al minuto y son eventos globales, no locales. */
const QUARTER_TOLERANCE_MIN = 60;
/** `fracillum` es un porcentaje entero: 1 punto porcentual es el redondeo de la fuente. */
const ILLUMINATION_TOLERANCE = 0.01;

const SITES = [USNO_SITES.madrid, USNO_SITES.lasPalmas];

function minutesBetween(actualMs: number, expectedMs: number): number {
  return (actualMs - expectedMs) / MS_PER_MINUTE;
}

function assertWithin(
  actualMs: number,
  expected: UsnoEvent,
  toleranceMin: number,
  label: string,
): void {
  const errorMin = minutesBetween(actualMs, expected.timeUtcMs);
  assert.ok(
    Math.abs(errorMin) <= toleranceMin,
    `${label}: ${new Date(actualMs).toISOString()} vs USNO ` +
      `${new Date(expected.timeUtcMs).toISOString()} → ${errorMin.toFixed(2)} min ` +
      `(tolerancia ±${toleranceMin})`,
  );
}

/**
 * Busca el cruce del horizonte dentro del día UTC, que es exactamente el día que enumera el USNO
 * con `tz=0`. Falla ruidosamente si no hay evento: en Madrid y Las Palmas no hay casos polares, así
 * que un `no-event` aquí sería un bug, no una latitud difícil.
 */
function horizonEventAt(
  body: CelestialBody,
  location: GeoLocation,
  dayStartUtcMs: number,
  kind: "rise" | "set",
): number {
  const search = searchHorizonEvent(body, location, dayStartUtcMs, kind);
  assert.equal(search.outcome, "event", `sin ${kind} de ${body} en el día UTC`);
  return search.outcome === "event" ? search.event.timeUtcMs : Number.NaN;
}

function twilightAt(location: GeoLocation, dayStartUtcMs: number, phase: "dawn" | "dusk"): number {
  const search = searchTwilight(location, dayStartUtcMs, "civil", phase);
  assert.equal(search.outcome, "event", `sin crepúsculo civil (${phase}) en el día UTC`);
  return search.outcome === "event" ? search.event.timeUtcMs : Number.NaN;
}

function actualFor(
  phenomenon: UsnoEvent["phenomenon"],
  body: CelestialBody,
  location: GeoLocation,
  dayStartUtcMs: number,
): number {
  switch (phenomenon) {
    case "rise":
    case "set":
      return horizonEventAt(body, location, dayStartUtcMs, phenomenon);
    case "upper-transit":
      return searchTransit(body, location, dayStartUtcMs, "upper").timeUtcMs;
    case "civil-dawn":
      return twilightAt(location, dayStartUtcMs, "dawn");
    case "civil-dusk":
      return twilightAt(location, dayStartUtcMs, "dusk");
  }
}

function toleranceFor(phenomenon: UsnoEvent["phenomenon"]): number {
  return phenomenon === "upper-transit" ? TRANSIT_TOLERANCE_MIN : HORIZON_TOLERANCE_MIN;
}

for (const site of SITES) {
  describe(`USNO · ${site.name}`, () => {
    for (const dateIso of USNO_DATES) {
      it(`reproduce los fenómenos del Sol del ${dateIso}`, () => {
        const day = loadUsnoOneDay(site.slug, dateIso);
        assert.ok(day.sun.length >= 5, "el USNO publica 5 fenómenos solares por día");
        for (const expected of day.sun) {
          const actualMs = actualFor(expected.phenomenon, "sun", site.location, day.dayStartUtcMs);
          assertWithin(actualMs, expected, toleranceFor(expected.phenomenon), `sol ${expected.phenomenon} ${dateIso}`);
        }
      });

      it(`reproduce los fenómenos de la Luna del ${dateIso}`, () => {
        const day = loadUsnoOneDay(site.slug, dateIso);
        assert.ok(day.moon.length >= 2, "el USNO publica al menos 2 fenómenos lunares por día");
        for (const expected of day.moon) {
          const actualMs = actualFor(expected.phenomenon, "moon", site.location, day.dayStartUtcMs);
          assertWithin(actualMs, expected, toleranceFor(expected.phenomenon), `luna ${expected.phenomenon} ${dateIso}`);
        }
      });
    }

    it("reproduce la fracción iluminada publicada para cada día", () => {
      for (const dateIso of USNO_DATES) {
        const day = loadUsnoOneDay(site.slug, dateIso);
        // El USNO tabula `fracillum` para el mediodía UTC del día.
        const actual = moonIllumination(day.dayStartUtcMs + 12 * MS_PER_HOUR);
        assert.ok(
          Math.abs(actual.illuminatedFraction - day.illuminatedFraction) <= ILLUMINATION_TOLERANCE,
          `iluminación ${dateIso}: ${actual.illuminatedFraction.toFixed(4)} vs USNO ` +
            `${day.illuminatedFraction.toFixed(2)}`,
        );
      }
    });
  });
}

describe("USNO · cuartos lunares de 2026", () => {
  it("reproduce los 50 cuartos del año en orden, tipo e instante", () => {
    const expected = loadUsnoMoonQuarters2026();
    assert.equal(expected.length, 50, "el USNO publica 50 cuartos en 2026");
    const actual = nextMoonQuarters(Date.parse("2026-01-01T00:00:00Z"), expected.length);
    assert.equal(actual.length, expected.length);
    for (const [index, expectedQuarter] of expected.entries()) {
      const actualQuarter = actual[index];
      assert.ok(actualQuarter !== undefined, `falta el cuarto ${index}`);
      assert.equal(actualQuarter.quarter, expectedQuarter.quarter, `tipo del cuarto ${index}`);
      const errorMin = minutesBetween(actualQuarter.timeUtcMs, expectedQuarter.timeUtcMs);
      assert.ok(
        Math.abs(errorMin) <= QUARTER_TOLERANCE_MIN,
        `cuarto ${index} (${expectedQuarter.quarter}): ` +
          `${new Date(actualQuarter.timeUtcMs).toISOString()} vs USNO ` +
          `${new Date(expectedQuarter.timeUtcMs).toISOString()} → ${errorMin.toFixed(2)} min`,
      );
    }
  });

  it("nombra la fase como el cuarto correspondiente en el instante exacto de cada cuarto", () => {
    for (const quarter of loadUsnoMoonQuarters2026()) {
      const { name } = moonIllumination(quarter.timeUtcMs);
      assert.equal(
        name,
        quarter.quarter,
        `en ${new Date(quarter.timeUtcMs).toISOString()} la fase debería llamarse ${quarter.quarter}`,
      );
    }
  });
});
