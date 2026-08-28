/**
 * Tests de propiedades de astronomía: invariantes que deben cumplirse sin depender de ningún
 * oráculo externo. Cubren lo que el golden test del USNO no ve —el tránsito inferior (que la
 * fuente no publica), los casos polares, el orden de los crepúsculos, los acimuts y las
 * condiciones de error del contrato— y son la red que atrapa un cambio de motor que rompa la
 * geometría sin mover las horas de Madrid.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  horizontalPosition,
  InvalidGeoLocationError,
  InvalidInstantError,
  InvalidSearchWindowError,
  moonDistance,
  moonIllumination,
  nextMoonQuarters,
  searchHorizonEvent,
  searchTransit,
  searchTwilight,
  TWILIGHT_ALTITUDE_DEG,
} from "../index.ts";
import type { GeoLocation, TwilightKind } from "../types.ts";
import { USNO_SITES } from "./fixtures.ts";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

const MADRID = USNO_SITES.madrid.location;

/** Longyearbyen (Svalbard): 78° N, la latitud habitada donde el sol de medianoche es rutina. */
const LONGYEARBYEN: GeoLocation = { latitude_deg: 78.2232, longitude_deg: 15.6267 };

const SUMMER_SOLSTICE_2026 = Date.parse("2026-06-21T00:00:00Z");
const WINTER_SOLSTICE_2026 = Date.parse("2026-12-21T00:00:00Z");
const MARCH_EQUINOX_2026 = Date.parse("2026-03-20T00:00:00Z");

function eventTimeMs(search: ReturnType<typeof searchHorizonEvent>): number {
  assert.equal(search.outcome, "event");
  return search.outcome === "event" ? search.event.timeUtcMs : Number.NaN;
}

function twilightTimeMs(search: ReturnType<typeof searchTwilight>): number {
  assert.equal(search.outcome, "event");
  return search.outcome === "event" ? search.event.timeUtcMs : Number.NaN;
}

describe("propiedades · casos polares", () => {
  it("declara sol de medianoche (`always-above`) en Svalbard en el solsticio de junio", () => {
    const search = searchHorizonEvent("sun", LONGYEARBYEN, SUMMER_SOLSTICE_2026, "set");
    assert.equal(search.outcome, "no-event");
    if (search.outcome === "no-event") {
      assert.equal(search.reason, "always-above");
      assert.equal(search.searchedFromUtcMs, SUMMER_SOLSTICE_2026);
      assert.equal(search.searchedDays, 1);
    }
  });

  it("declara noche polar (`always-below`) en Svalbard en el solsticio de diciembre", () => {
    const search = searchHorizonEvent("sun", LONGYEARBYEN, WINTER_SOLSTICE_2026, "rise");
    assert.equal(search.outcome, "no-event");
    if (search.outcome === "no-event") {
      assert.equal(search.reason, "always-below");
    }
  });

  it("declara que en junio el crepúsculo astronómico no llega a ocurrir en Svalbard", () => {
    const search = searchTwilight(LONGYEARBYEN, SUMMER_SOLSTICE_2026, "astronomical", "dusk");
    assert.equal(search.outcome, "no-event");
    if (search.outcome === "no-event") {
      assert.equal(search.reason, "always-above");
    }
  });

  it("encuentra el evento si se le da ventana bastante: el sol de medianoche termina", () => {
    const search = searchHorizonEvent("sun", LONGYEARBYEN, SUMMER_SOLSTICE_2026, "set", {
      searchDays: 120,
    });
    assert.equal(search.outcome, "event");
    if (search.outcome === "event") {
      const daysLater = (search.event.timeUtcMs - SUMMER_SOLSTICE_2026) / MS_PER_DAY;
      assert.ok(daysLater > 30 && daysLater < 90, `el primer ocaso llegó ${daysLater} días después`);
    }
  });

  it("da tránsito superior también en la noche polar: el tránsito existe siempre", () => {
    const transit = searchTransit("sun", LONGYEARBYEN, WINTER_SOLSTICE_2026, "upper");
    assert.ok(transit.altitude_deg < 0, "en la noche polar el tránsito es bajo el horizonte");
    assert.ok(transit.timeUtcMs > WINTER_SOLSTICE_2026);
    assert.ok(transit.timeUtcMs < WINTER_SOLSTICE_2026 + MS_PER_DAY);
  });
});

describe("propiedades · crepúsculos", () => {
  const kinds: readonly TwilightKind[] = ["astronomical", "nautical", "civil"];

  it("ordena el amanecer: astronómico < náutico < civil < orto", () => {
    const times = kinds.map((kind) =>
      twilightTimeMs(searchTwilight(MADRID, MARCH_EQUINOX_2026, kind, "dawn")),
    );
    const sunrise = eventTimeMs(searchHorizonEvent("sun", MADRID, MARCH_EQUINOX_2026, "rise"));
    for (const [index, time] of times.entries()) {
      const next = times[index + 1] ?? sunrise;
      assert.ok(time < next, `el crepúsculo ${kinds[index]} debe preceder al siguiente`);
    }
  });

  it("ordena el anochecer: ocaso < civil < náutico < astronómico", () => {
    const sunset = eventTimeMs(searchHorizonEvent("sun", MADRID, MARCH_EQUINOX_2026, "set"));
    const times = [...kinds]
      .reverse()
      .map((kind) => twilightTimeMs(searchTwilight(MADRID, MARCH_EQUINOX_2026, kind, "dusk")));
    let previous = sunset;
    for (const time of times) {
      assert.ok(time > previous, "cada crepúsculo vespertino va después del anterior");
      previous = time;
    }
  });

  it("sitúa cada crepúsculo donde el Sol está a la depresión que lo define", () => {
    for (const kind of kinds) {
      const timeUtcMs = twilightTimeMs(searchTwilight(MADRID, MARCH_EQUINOX_2026, kind, "dusk"));
      // Los crepúsculos se definen sobre la altura GEOMÉTRICA: hay que pedirla sin refracción, o
      // el umbral se desplaza medio grado (≈ 4 min de reloj) y el test mediría otra cosa.
      const { altitude_deg } = horizontalPosition("sun", MADRID, timeUtcMs, { refraction: "none" });
      assert.ok(
        Math.abs(altitude_deg - TWILIGHT_ALTITUDE_DEG[kind]) < 0.01,
        `crepúsculo ${kind}: el Sol estaba a ${altitude_deg.toFixed(3)}°, no a ${TWILIGHT_ALTITUDE_DEG[kind]}°`,
      );
    }
  });
});

describe("propiedades · refracción", () => {
  it("levanta el astro: la altura aparente en el horizonte supera a la geométrica en ~0,5°", () => {
    const sunrise = searchHorizonEvent("sun", MADRID, MARCH_EQUINOX_2026, "rise");
    assert.equal(sunrise.outcome, "event");
    if (sunrise.outcome === "event") {
      const timeUtcMs = sunrise.event.timeUtcMs;
      const apparent = horizontalPosition("sun", MADRID, timeUtcMs);
      const geometric = horizontalPosition("sun", MADRID, timeUtcMs, { refraction: "none" });
      assert.equal(apparent.refraction, "standard");
      assert.equal(geometric.refraction, "none");
      const lift = apparent.altitude_deg - geometric.altitude_deg;
      assert.ok(lift > 0.4 && lift < 0.7, `refracción en el horizonte: ${lift.toFixed(3)}°`);
      // El acimut no lo toca la refracción (el astro sube en vertical, no gira).
      assert.ok(Math.abs(apparent.azimuth_deg - geometric.azimuth_deg) < 0.01);
    }
  });
});

describe("propiedades · acimuts", () => {
  it("saca el Sol por el este y lo pone por el oeste", () => {
    for (const dayStartUtcMs of [MARCH_EQUINOX_2026, SUMMER_SOLSTICE_2026, WINTER_SOLSTICE_2026]) {
      const rise = searchHorizonEvent("sun", MADRID, dayStartUtcMs, "rise");
      const set = searchHorizonEvent("sun", MADRID, dayStartUtcMs, "set");
      assert.equal(rise.outcome, "event");
      assert.equal(set.outcome, "event");
      if (rise.outcome === "event" && set.outcome === "event") {
        assert.ok(rise.event.azimuth_deg > 0 && rise.event.azimuth_deg < 180, "orto al este");
        assert.ok(set.event.azimuth_deg > 180 && set.event.azimuth_deg < 360, "ocaso al oeste");
      }
    }
  });

  it("saca el Sol casi exactamente por el este en el equinoccio", () => {
    const rise = searchHorizonEvent("sun", MADRID, MARCH_EQUINOX_2026, "rise");
    assert.equal(rise.outcome, "event");
    if (rise.outcome === "event") {
      // No es 90,0° exacto: el equinoccio no cae al alba y la refracción adelanta el orto.
      assert.ok(
        Math.abs(rise.event.azimuth_deg - 90) < 2,
        `acimut del orto en el equinoccio: ${rise.event.azimuth_deg.toFixed(2)}°`,
      );
    }
  });

  it("culmina el Sol al sur y hace su tránsito inferior al norte, desde Madrid", () => {
    const upper = searchTransit("sun", MADRID, MARCH_EQUINOX_2026, "upper");
    const lower = searchTransit("sun", MADRID, MARCH_EQUINOX_2026, "lower");
    assert.ok(Math.abs(upper.azimuth_deg - 180) < 1, `culminación al sur: ${upper.azimuth_deg}`);
    const northError = Math.min(lower.azimuth_deg, 360 - lower.azimuth_deg);
    assert.ok(northError < 1, `tránsito inferior al norte: ${lower.azimuth_deg}`);
  });
});

describe("propiedades · tránsitos", () => {
  it("separa el tránsito inferior del superior en media jornada del cuerpo", () => {
    const upper = searchTransit("moon", MADRID, MARCH_EQUINOX_2026, "upper");
    const lower = searchTransit("moon", MADRID, upper.timeUtcMs, "lower");
    const gapHours = (lower.timeUtcMs - upper.timeUtcMs) / MS_PER_HOUR;
    // El día lunar dura 24 h 50 min, así que media jornada son ~12 h 25 min.
    assert.ok(gapHours > 12 && gapHours < 13, `separación superior→inferior: ${gapHours} h`);
    assert.ok(lower.altitude_deg < upper.altitude_deg, "el tránsito inferior es el más bajo");
  });

  it("pone el tránsito superior en el máximo local de altura", () => {
    const transit = searchTransit("moon", MADRID, MARCH_EQUINOX_2026, "upper");
    for (const offsetMin of [-30, -10, 10, 30]) {
      const { altitude_deg } = horizontalPosition(
        "moon",
        MADRID,
        transit.timeUtcMs + offsetMin * MS_PER_MINUTE,
      );
      assert.ok(
        altitude_deg <= transit.altitude_deg,
        `a ${offsetMin} min del tránsito la Luna estaba más alta (${altitude_deg} > ${transit.altitude_deg})`,
      );
    }
  });

  it("encadena tránsitos superiores separados por un día lunar", () => {
    let previous = searchTransit("moon", MADRID, MARCH_EQUINOX_2026, "upper");
    for (let index = 0; index < 20; index += 1) {
      const next = searchTransit("moon", MADRID, previous.timeUtcMs + MS_PER_MINUTE, "upper");
      const gapHours = (next.timeUtcMs - previous.timeUtcMs) / MS_PER_HOUR;
      assert.ok(gapHours > 24.2 && gapHours < 25.5, `día lunar fuera de rango: ${gapHours} h`);
      previous = next;
    }
  });
});

describe("propiedades · Luna", () => {
  it("mantiene edad, elongación e iluminación coherentes a lo largo de un año", () => {
    for (let day = 0; day < 365; day += 1) {
      const atUtcMs = Date.parse("2026-01-01T00:00:00Z") + day * MS_PER_DAY;
      const moon = moonIllumination(atUtcMs);
      assert.ok(moon.ageDays >= 0 && moon.ageDays <= 29.9, `edad fuera de rango: ${moon.ageDays}`);
      assert.ok(moon.phaseAngle_deg >= 0 && moon.phaseAngle_deg < 360);
      assert.ok(moon.illuminatedFraction >= 0 && moon.illuminatedFraction <= 1);
      // La fracción iluminada es (1 − cos φ)/2 salvo por la inclinación de la órbita lunar.
      const geometric = (1 - Math.cos((moon.phaseAngle_deg * Math.PI) / 180)) / 2;
      assert.ok(
        Math.abs(moon.illuminatedFraction - geometric) < 0.02,
        `iluminación incoherente con la elongación el día ${day}`,
      );
    }
  });

  it("mantiene la distancia lunar entre el perigeo y el apogeo posibles", () => {
    for (let day = 0; day < 365; day += 1) {
      const atUtcMs = Date.parse("2026-01-01T00:00:00Z") + day * MS_PER_DAY;
      const { distance_km } = moonDistance(atUtcMs);
      assert.ok(
        distance_km > 356_000 && distance_km < 407_000,
        `distancia lunar imposible el día ${day}: ${distance_km} km`,
      );
    }
  });

  it("encadena los cuartos lunares en orden y sin saltarse ninguno", () => {
    const quarters = nextMoonQuarters(Date.parse("2026-01-01T00:00:00Z"), 12);
    const cycle = ["new", "first-quarter", "full", "last-quarter"];
    for (const [index, quarter] of quarters.entries()) {
      const previous = quarters[index - 1];
      if (previous === undefined) {
        continue;
      }
      assert.ok(quarter.timeUtcMs > previous.timeUtcMs, "los cuartos van en orden cronológico");
      const expectedIndex = (cycle.indexOf(previous.quarter) + 1) % cycle.length;
      assert.equal(quarter.quarter, cycle[expectedIndex], `tras ${previous.quarter} viene otro`);
      const gapDays = (quarter.timeUtcMs - previous.timeUtcMs) / MS_PER_DAY;
      assert.ok(gapDays > 6 && gapDays < 9, `cuarto de lunación fuera de rango: ${gapDays} días`);
    }
  });

  it("devuelve una lista vacía si se piden cero cuartos", () => {
    assert.deepEqual(nextMoonQuarters(MARCH_EQUINOX_2026, 0), []);
  });
});

describe("propiedades · contrato de errores", () => {
  it("rechaza latitudes y longitudes fuera del rango físico", () => {
    for (const location of [
      { latitude_deg: 91, longitude_deg: 0 },
      { latitude_deg: 0, longitude_deg: 181 },
      { latitude_deg: Number.NaN, longitude_deg: 0 },
      { latitude_deg: 0, longitude_deg: 0, elevation_m: Number.POSITIVE_INFINITY },
    ]) {
      assert.throws(
        () => horizontalPosition("sun", location, MARCH_EQUINOX_2026),
        InvalidGeoLocationError,
        `debería rechazar ${JSON.stringify(location)}`,
      );
    }
  });

  it("rechaza instantes no finitos o fuera del rango soportado", () => {
    for (const timeUtcMs of [Number.NaN, Number.POSITIVE_INFINITY, Date.UTC(1800, 0, 1), Date.UTC(2200, 0, 1)]) {
      assert.throws(
        () => moonIllumination(timeUtcMs),
        InvalidInstantError,
        `debería rechazar el instante ${timeUtcMs}`,
      );
    }
  });

  it("rechaza ventanas de búsqueda vacías o negativas", () => {
    for (const searchDays of [0, -1, Number.NaN]) {
      assert.throws(
        () => searchHorizonEvent("sun", MADRID, MARCH_EQUINOX_2026, "rise", { searchDays }),
        InvalidSearchWindowError,
        `debería rechazar searchDays=${searchDays}`,
      );
    }
  });

  it("rechaza un número de cuartos que no sea un entero no negativo", () => {
    assert.throws(() => nextMoonQuarters(MARCH_EQUINOX_2026, -1), RangeError);
    assert.throws(() => nextMoonQuarters(MARCH_EQUINOX_2026, 1.5), RangeError);
  });
});
