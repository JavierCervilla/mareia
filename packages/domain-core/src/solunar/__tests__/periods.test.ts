/**
 * Tests de los periodos solunares.
 *
 * Tres capas, a propósito:
 * 1. **Exactos** sobre una efeméride falsa: fijan la geometría de las ventanas y el bonus solar al
 *    milisegundo, sin que el resultado dependa de la mecánica celeste.
 * 2. **Golden** contra las efemérides del USNO ya commiteadas en `astronomy/`: los periodos
 *    mayores están centrados en tránsitos *reales* y los menores en ortos y ocasos *reales*.
 * 3. **Propiedades** sobre un año entero y dos sitios: cuántos periodos hay, cómo se ordenan y —la
 *    que define el módulo— que el cálculo es invariante a la zona horaria.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  loadUsnoOneDay,
  USNO_DATES,
  USNO_SITES,
} from "../../astronomy/__tests__/fixtures.ts";
import { civilDayBounds } from "../civil-day.ts";
import {
  MAJOR_PERIOD_DURATION_MS,
  MINOR_PERIOD_DURATION_MS,
  solunarDay,
} from "../periods.ts";
import { SOLAR_OVERLAP_HALF_WINDOW_MS } from "../rating.ts";
import type { SolunarAnchor, SolunarDay, SolunarPeriod } from "../types.ts";
import { fakeGateway } from "./fake-gateway.ts";
import type { FakeSky } from "./fake-gateway.ts";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

const MADRID = USNO_SITES.madrid;
const LAS_PALMAS = USNO_SITES.lasPalmas;

const DAY_ISO = "2026-05-14";
const DAY_START = Date.parse(`${DAY_ISO}T00:00:00Z`);

function at(hours: number, minutes = 0): number {
  return DAY_START + hours * MS_PER_HOUR + minutes * MS_PER_MINUTE;
}

/** Cielo de laboratorio: cuatro fenómenos lunares repartidos por el día y un Sol previsible. */
const BASE_SKY: FakeSky = {
  upperTransits: [at(3)],
  lowerTransits: [at(15, 25)],
  moonrises: [at(9)],
  moonsets: [at(21, 30)],
  sunrises: [at(6)],
  sunsets: [at(20)],
  quarters: [
    { quarter: "full", timeUtcMs: at(12) },
    { quarter: "last-quarter", timeUtcMs: at(12) + 7 * MS_PER_DAY },
  ],
  illuminatedFraction: 1,
};

function fakeDay(sky: FakeSky): SolunarDay {
  return solunarDay(
    { location: MADRID.location, dateIso: DAY_ISO, timeZone: "UTC" },
    fakeGateway(sky),
  );
}

function periodBy(day: SolunarDay, anchor: SolunarAnchor): SolunarPeriod {
  const period = day.periods.find((candidate) => candidate.anchor === anchor);
  assert.ok(period !== undefined, `falta el periodo anclado en ${anchor}`);
  return period;
}

describe("periodos · geometría exacta (efeméride falsa)", () => {
  it("centra cada mayor en su tránsito con una ventana de 2 horas", () => {
    const day = fakeDay(BASE_SKY);
    const upper = periodBy(day, "upper-transit");
    assert.equal(upper.kind, "major");
    assert.equal(upper.peakUtcMs, at(3));
    assert.equal(upper.startUtcMs, at(2));
    assert.equal(upper.endUtcMs, at(4));
    assert.equal(upper.endUtcMs - upper.startUtcMs, MAJOR_PERIOD_DURATION_MS);
    assert.equal(periodBy(day, "lower-transit").peakUtcMs, at(15, 25));
  });

  it("centra cada menor en el orto o el ocaso lunar con una ventana de hora y media", () => {
    const day = fakeDay(BASE_SKY);
    const moonrise = periodBy(day, "moonrise");
    assert.equal(moonrise.kind, "minor");
    assert.equal(moonrise.startUtcMs, at(8, 15));
    assert.equal(moonrise.peakUtcMs, at(9));
    assert.equal(moonrise.endUtcMs, at(9, 45));
    assert.equal(moonrise.endUtcMs - moonrise.startUtcMs, MINOR_PERIOD_DURATION_MS);
    assert.equal(periodBy(day, "moonset").peakUtcMs, at(21, 30));
  });

  it("devuelve los periodos ordenados por su comienzo", () => {
    const day = fakeDay(BASE_SKY);
    assert.deepEqual(
      day.periods.map((period) => period.anchor),
      ["upper-transit", "moonrise", "lower-transit", "moonset"],
    );
  });

  it("marca el solape con el Sol solo cuando la ventana toca el orto/ocaso ±30 min", () => {
    const day = fakeDay(BASE_SKY);
    // El orto solar es a las 06:00 y el menor del orto lunar va de 08:15 a 09:45: no se tocan.
    assert.equal(periodBy(day, "moonrise").overlapsSolarEvent, false);
    assert.equal(day.rating.solarOverlapCount, 0);

    // Se mueve el orto lunar hasta las 06:40: su ventana empieza a las 05:55 y el orto solar de
    // las 06:00 cae dentro. Debe marcarse y sumar 10 puntos.
    const overlapping = fakeDay({ ...BASE_SKY, moonrises: [at(6, 40)] });
    assert.equal(periodBy(overlapping, "moonrise").overlapsSolarEvent, true);
    assert.equal(overlapping.rating.solarOverlapCount, 1);
    assert.equal(overlapping.rating.solarBonus, 10);
  });

  it("respeta el borde exacto de la ventana de solape: 30 min justos no cuentan", () => {
    // Menor centrado a las 04:15 → empieza a las 03:30. Un orto solar a las 03:00 queda a
    // exactamente 30 min del borde: la condición es estricta, así que no solapa.
    const touching = fakeDay({ ...BASE_SKY, moonrises: [at(4, 15)], sunrises: [at(3)] });
    assert.equal(periodBy(touching, "moonrise").overlapsSolarEvent, false);
    const inside = fakeDay({ ...BASE_SKY, moonrises: [at(4, 15)], sunrises: [at(3, 1)] });
    assert.equal(periodBy(inside, "moonrise").overlapsSolarEvent, true);
    assert.equal(SOLAR_OVERLAP_HALF_WINDOW_MS, 30 * MS_PER_MINUTE);
  });

  it("acepta un día sin orto de Luna: los menores pueden ser 1, no es un fallo", () => {
    const day = fakeDay({ ...BASE_SKY, moonrises: [] });
    assert.equal(day.periods.length, 3);
    assert.equal(day.periods.filter((period) => period.kind === "minor").length, 1);
  });

  it("no cuenta fenómenos de días vecinos aunque su ventana desborde la medianoche", () => {
    const day = fakeDay({
      ...BASE_SKY,
      // Un tránsito 30 min antes de la medianoche: su ventana entra en el día, su instante no.
      upperTransits: [DAY_START - 30 * MS_PER_MINUTE, at(3)],
    });
    const majors = day.periods.filter((period) => period.kind === "major");
    assert.equal(majors.length, 2, "solo el tránsito de dentro del día y el inferior");
    assert.equal(periodBy(day, "upper-transit").peakUtcMs, at(3));
  });

  it("no llama al motor para nada que no necesite: los crepúsculos no se piden", () => {
    // `fakeGateway` lanza si le piden un crepúsculo: si esto no rompe, `solunar/` no los usa.
    assert.doesNotThrow(() => fakeDay(BASE_SKY));
  });
});

describe("periodos · golden contra efemérides del USNO", () => {
  for (const site of [MADRID, LAS_PALMAS]) {
    it(`centra los periodos de ${site.name} en los fenómenos publicados`, () => {
      for (const dateIso of USNO_DATES) {
        // El USNO enumera con `tz=0`, así que el día civil comparable es el día UTC.
        const day = solunarDay({ location: site.location, dateIso, timeZone: "UTC" });
        const expected = loadUsnoOneDay(site.slug, dateIso);
        const anchorByPhenomenon = {
          "upper-transit": "upper-transit",
          rise: "moonrise",
          set: "moonset",
        } as const;
        for (const event of expected.moon) {
          const anchor = anchorByPhenomenon[event.phenomenon as keyof typeof anchorByPhenomenon];
          if (anchor === undefined) {
            continue;
          }
          const period = day.periods.find((candidate) => candidate.anchor === anchor);
          assert.ok(period !== undefined, `${dateIso}: falta el periodo ${anchor}`);
          const errorMin = (period.peakUtcMs - event.timeUtcMs) / MS_PER_MINUTE;
          const toleranceMin = anchor === "upper-transit" ? 3 : 2;
          assert.ok(
            Math.abs(errorMin) <= toleranceMin,
            `${dateIso} ${anchor}: ${errorMin.toFixed(2)} min de desvío frente al USNO`,
          );
        }
      }
    });
  }
});

describe("periodos · propiedades sobre un año", () => {
  const sites = [
    { site: MADRID, timeZone: MADRID.timeZone },
    { site: LAS_PALMAS, timeZone: LAS_PALMAS.timeZone },
  ];

  function eachDayOf2026(visit: (day: SolunarDay) => void): void {
    for (const { site, timeZone } of sites) {
      for (let dayIndex = 0; dayIndex < 365; dayIndex += 1) {
        const dateIso = new Date(Date.UTC(2026, 0, 1 + dayIndex)).toISOString().slice(0, 10);
        visit(solunarDay({ location: site.location, dateIso, timeZone }));
      }
    }
  }

  it("da entre 1 y 4 periodos al día: 1-2 mayores y 0-2 menores", () => {
    eachDayOf2026((day) => {
      const majors = day.periods.filter((period) => period.kind === "major").length;
      const minors = day.periods.filter((period) => period.kind === "minor").length;
      assert.ok(majors >= 1 && majors <= 2, `${day.dateIso}: ${majors} mayores`);
      assert.ok(minors >= 0 && minors <= 2, `${day.dateIso}: ${minors} menores`);
      assert.ok(
        day.periods.length >= 1 && day.periods.length <= 4,
        `${day.dateIso}: ${day.periods.length} periodos`,
      );
    });
  });

  it("ancla cada periodo dentro de su día civil, aunque la ventana desborde la medianoche", () => {
    eachDayOf2026((day) => {
      for (const period of day.periods) {
        assert.ok(
          period.peakUtcMs >= day.dayStartUtcMs && period.peakUtcMs < day.dayEndUtcMs,
          `${day.dateIso}: el fenómeno de ${period.anchor} cae fuera del día`,
        );
        const halfWidth =
          period.kind === "major" ? MAJOR_PERIOD_DURATION_MS / 2 : MINOR_PERIOD_DURATION_MS / 2;
        assert.equal(period.peakUtcMs - period.startUtcMs, halfWidth);
        assert.equal(period.endUtcMs - period.peakUtcMs, halfWidth);
      }
    });
  });

  it("no repite ni desordena los periodos de un día", () => {
    eachDayOf2026((day) => {
      const anchors = day.periods.map((period) => period.anchor);
      assert.equal(new Set(anchors).size, anchors.length, `${day.dateIso}: anclas repetidas`);
      for (const [index, period] of day.periods.entries()) {
        const previous = day.periods[index - 1];
        if (previous !== undefined) {
          assert.ok(period.startUtcMs >= previous.startUtcMs, `${day.dateIso}: sin ordenar`);
        }
      }
    });
  });

  it("mantiene el rating dentro de [0, 100] y coherente con su desglose", () => {
    eachDayOf2026((day) => {
      const { rating } = day;
      assert.ok(Number.isInteger(rating.score) && rating.score >= 0 && rating.score <= 100);
      assert.equal(
        rating.solarOverlapCount,
        day.periods.filter((period) => period.overlapsSolarEvent).length,
      );
      assert.ok(rating.daysFromSyzygy >= 0 && rating.daysFromSyzygy < 15);
    });
  });

  it("particiona el tiempo: ningún fenómeno se cuenta dos veces en días consecutivos", () => {
    const seen = new Set<number>();
    for (let dayIndex = 0; dayIndex < 60; dayIndex += 1) {
      const dateIso = new Date(Date.UTC(2026, 3, 1 + dayIndex)).toISOString().slice(0, 10);
      const day = solunarDay({ location: MADRID.location, dateIso, timeZone: MADRID.timeZone });
      for (const period of day.periods) {
        assert.ok(!seen.has(period.peakUtcMs), `${dateIso}: ${period.anchor} repetido de otro día`);
        seen.add(period.peakUtcMs);
      }
    }
    assert.ok(seen.size > 200, `se esperaban ~4 periodos por día durante 60 días, hubo ${seen.size}`);
  });
});

describe("periodos · invariancia a la zona horaria", () => {
  /** Todos los fenómenos de un rango de días mirados desde una zona, con el tramo UTC que cubren. */
  function scan(timeZone: string, firstDayIso: string, days: number) {
    const peaks: number[] = [];
    let fromUtcMs = Number.NEGATIVE_INFINITY;
    let toUtcMs = Number.POSITIVE_INFINITY;
    const first = Date.parse(`${firstDayIso}T00:00:00Z`);
    for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
      const dateIso = new Date(first + dayIndex * MS_PER_DAY).toISOString().slice(0, 10);
      const day = solunarDay({ location: MADRID.location, dateIso, timeZone });
      if (dayIndex === 0) {
        fromUtcMs = day.dayStartUtcMs;
      }
      toUtcMs = day.dayEndUtcMs;
      peaks.push(...day.periods.map((period) => period.peakUtcMs));
    }
    return { fromUtcMs, toUtcMs, peaks: peaks.sort((left, right) => left - right) };
  }

  /**
   * Los instantes no coinciden al milisegundo entre zonas y no es un fallo: la búsqueda de raíces
   * arranca en un instante distinto en cada una y converge a unas décimas de segundo del mismo
   * cruce. Un segundo de tolerancia es tres órdenes de magnitud menos que el minuto en que se
   * publican las efemérides.
   */
  const SAME_INSTANT_TOLERANCE_MS = 1000;

  it("encuentra los mismos fenómenos desde tres zonas distintas: solo cambia el reparto", () => {
    const scans = ["Europe/Madrid", "UTC", "Pacific/Auckland"].map((zone) =>
      scan(zone, "2026-05-01", 14),
    );
    // Cada zona cubre un tramo UTC distinto: se compara solo el común a las tres.
    const fromUtcMs = Math.max(...scans.map((entry) => entry.fromUtcMs));
    const toUtcMs = Math.min(...scans.map((entry) => entry.toUtcMs));
    const inCommon = scans.map((entry) =>
      entry.peaks.filter((peak) => peak >= fromUtcMs && peak < toUtcMs),
    );

    const [reference] = inCommon;
    assert.ok(reference !== undefined && reference.length > 40, "el tramo común cubre ~13 días");
    for (const [index, peaks] of inCommon.entries()) {
      assert.equal(peaks.length, reference.length, `la zona ${index} vio otro número de fenómenos`);
      for (const [position, peak] of peaks.entries()) {
        const expected = reference[position] ?? Number.NaN;
        assert.ok(
          Math.abs(peak - expected) <= SAME_INSTANT_TOLERANCE_MS,
          `zona ${index}, fenómeno ${position}: ${peak} vs ${expected}`,
        );
      }
    }
  });

  it("reparte los mismos fenómenos en días distintos según la zona", () => {
    const dateIso = "2026-05-14";
    const inMadrid = solunarDay({ location: MADRID.location, dateIso, timeZone: "Europe/Madrid" });
    const inAuckland = solunarDay({ location: MADRID.location, dateIso, timeZone: "Pacific/Auckland" });
    assert.notEqual(inMadrid.dayStartUtcMs, inAuckland.dayStartUtcMs);
    assert.notDeepEqual(
      inMadrid.periods.map((period) => period.peakUtcMs),
      inAuckland.periods.map((period) => period.peakUtcMs),
      "dos zonas tan separadas no pueden recortar el mismo trozo del eje",
    );
  });

  it("no depende del huso de la máquina: el resultado es el mismo instante UTC", () => {
    // `solunarDay` no lee el reloj ni el huso local en ninguna parte; esto lo deja escrito.
    const bounds = civilDayBounds("2026-05-14", "Europe/Madrid");
    const day = solunarDay({
      location: MADRID.location,
      dateIso: "2026-05-14",
      timeZone: "Europe/Madrid",
    });
    assert.equal(day.dayStartUtcMs, bounds.startUtcMs);
    assert.equal(day.dayEndUtcMs, bounds.endUtcMs);
  });
});
