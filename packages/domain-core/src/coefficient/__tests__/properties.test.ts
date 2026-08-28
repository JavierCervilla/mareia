/**
 * Propiedades del coeficiente: lo que tiene que cumplirse todo el año, sin oráculo externo.
 *
 * El golden fija 32 valores de 2026; esto fija la *física* —el coeficiente sube en sizigia y baja
 * en cuadratura, se mueve despacio de un día al siguiente y nunca se sale de la escala— y el
 * contrato de errores. Entre los dos cubren lo que un solo mes de fixtures no ve.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextMoonQuarters } from "../../astronomy/index.ts";
import { InvalidCivilDateError, InvalidTimeZoneError } from "../../solunar/civil-day.ts";
import type { TideStation } from "../../tides/types.ts";
import { UnsupportedConstituentError } from "../../tides/types.ts";
import {
  BREST_UNIT_HEIGHT_M,
  MAX_TIDAL_COEFFICIENT,
  MIN_TIDAL_COEFFICIENT,
  tidalCoefficientDay,
  tidalCoefficients,
} from "../coefficient.ts";
import { NoSemidiurnalTideError } from "../types.ts";
import { loadBrestStation } from "./fixtures.ts";

const DAY_MS = 86_400_000;
const YEAR_START_UTC_MS = Date.parse("2026-01-01T00:00:00Z");
const YEAR_END_UTC_MS = Date.parse("2027-01-01T00:00:00Z");

/**
 * Umbrales de la propia escala: una marea de coeficiente > 70 es de **vive-eau** y una de < 70, de
 * **morte-eau**. Se dejan con holgura (70 y 65) porque lo que se afirma es el signo del efecto, no
 * un valor: en 2026 el peor caso medido es 72 en sizigia y 57 en cuadratura.
 */
const SPRING_TIDE_FLOOR = 70;
const NEAP_TIDE_CEILING = 65;
/** Media ventana, en días, en la que se busca el efecto de la fase lunar. */
const SYZYGY_WINDOW_DAYS = 2;
/**
 * Salto máximo admitido entre los coeficientes máximos de dos días consecutivos. El ciclo de
 * vivas-muertas recorre unas 85 unidades en algo menos de siete días; en 2026 el mayor salto
 * medido es de 17 unidades (25 de marzo). Un salto mayor sería una discontinuidad del cálculo,
 * no de la marea.
 */
const MAX_DAILY_JUMP = 20;

const M2_ONLY_STATION: TideStation = {
  schema: "station/v1",
  id: "synthetic-m2",
  name: "M2 puro",
  datum: { msl_offset_m: 0 },
  constituents: [{ name: "M2", amplitude_m: 1, phase_deg: 0 }],
};

function stationWith(constituents: TideStation["constituents"]): TideStation {
  return { ...M2_ONLY_STATION, constituents };
}

/** Coeficiente máximo de cada día civil del año, indexado por fecha. */
function dailyMaxima(): ReadonlyMap<string, number> {
  const station = loadBrestStation();
  const maxima = new Map<string, number>();
  for (let time = YEAR_START_UTC_MS; time < YEAR_END_UTC_MS; time += DAY_MS) {
    const dateIso = new Date(time).toISOString().slice(0, 10);
    const day = tidalCoefficientDay(station, dateIso);
    maxima.set(dateIso, Math.max(...day.coefficients.map((coefficient) => coefficient.value)));
  }
  return maxima;
}

describe("propiedades · escala", () => {
  const coefficients = tidalCoefficients(loadBrestStation(), YEAR_START_UTC_MS, YEAR_END_UTC_MS);

  it("da un coeficiente por pleamar de todo 2026, siempre dentro de [20, 120]", () => {
    assert.ok(coefficients.length > 700, `se esperaban ~706 pleamares en un año: ${coefficients.length}`);
    for (const coefficient of coefficients) {
      assert.ok(
        coefficient.value >= MIN_TIDAL_COEFFICIENT && coefficient.value <= MAX_TIDAL_COEFFICIENT,
        `coeficiente fuera de escala: ${coefficient.value}`,
      );
      assert.ok(Number.isInteger(coefficient.value), "el coeficiente que se publica es entero");
      assert.ok(coefficient.semiRange_m > 0, "el semirrango de una pleamar es positivo");
    }
  });

  it("recorre en 2026 el rango de una marea de Brest sin recortar ninguno", () => {
    const values = coefficients.map((coefficient) => coefficient.value);
    const clamped = coefficients.filter((coefficient) => coefficient.clamped);
    console.log(
      `  2026: ${values.length} coeficientes · mín ${Math.min(...values)} · máx ${Math.max(...values)}` +
        ` · recortados ${clamped.length}`,
    );
    assert.equal(clamped.length, 0, "2026 no tiene ninguna marea fuera de la escala");
    assert.ok(Math.min(...values) < 30, "el año tiene que llegar a mareas muertas");
    assert.ok(Math.max(...values) > 100, "el año tiene que llegar a mareas vivas de equinoccio");
  });

  it("recorta y lo cuenta cuando la marea se sale de la escala", () => {
    const huge = tidalCoefficients(
      stationWith([{ name: "M2", amplitude_m: 5, phase_deg: 0 }]),
      YEAR_START_UTC_MS,
      YEAR_START_UTC_MS + DAY_MS,
    );
    const tiny = tidalCoefficients(
      stationWith([{ name: "M2", amplitude_m: 0.3, phase_deg: 0 }]),
      YEAR_START_UTC_MS,
      YEAR_START_UTC_MS + DAY_MS,
    );
    for (const coefficient of huge) {
      assert.equal(coefficient.value, MAX_TIDAL_COEFFICIENT);
      assert.ok(coefficient.clamped && coefficient.rawValue > MAX_TIDAL_COEFFICIENT);
    }
    for (const coefficient of tiny) {
      assert.equal(coefficient.value, MIN_TIDAL_COEFFICIENT);
      assert.ok(coefficient.clamped && coefficient.rawValue < MIN_TIDAL_COEFFICIENT);
    }
  });

  it("mide el semirrango contra la unidad de altura que se le pase", () => {
    const [reference] = tidalCoefficients(M2_ONLY_STATION, YEAR_START_UTC_MS, YEAR_START_UTC_MS + DAY_MS);
    assert.ok(reference !== undefined);
    const [scaled] = tidalCoefficients(
      M2_ONLY_STATION,
      YEAR_START_UTC_MS,
      YEAR_START_UTC_MS + DAY_MS,
      { unitHeight_m: reference.semiRange_m },
    );
    assert.equal(scaled?.value, 100, "con U = el propio semirrango, el coeficiente es 100 por definición");
    assert.ok(
      Math.abs(reference.rawValue - (reference.semiRange_m / BREST_UNIT_HEIGHT_M) * 100) < 1e-9,
      "el valor continuo es el cociente exacto",
    );
  });
});

describe("propiedades · fase lunar", () => {
  const maxima = dailyMaxima();

  function windowAround(atUtcMs: number): readonly number[] {
    const values: number[] = [];
    for (let offset = -SYZYGY_WINDOW_DAYS; offset <= SYZYGY_WINDOW_DAYS; offset += 1) {
      const dateIso = new Date(atUtcMs + offset * DAY_MS).toISOString().slice(0, 10);
      const value = maxima.get(dateIso);
      if (value !== undefined) {
        values.push(value);
      }
    }
    return values;
  }

  const quarters = nextMoonQuarters(YEAR_START_UTC_MS, 50).filter(
    (quarter) => quarter.timeUtcMs < YEAR_END_UTC_MS,
  );

  it("da mareas vivas en las sizigias de 2026", () => {
    const syzygies = quarters.filter(
      (quarter) => quarter.quarter === "new" || quarter.quarter === "full",
    );
    assert.ok(syzygies.length >= 24, `se esperaban ~25 sizigias en un año: ${syzygies.length}`);
    for (const syzygy of syzygies) {
      const peak = Math.max(...windowAround(syzygy.timeUtcMs));
      assert.ok(
        peak >= SPRING_TIDE_FLOOR,
        `${new Date(syzygy.timeUtcMs).toISOString()} (${syzygy.quarter}): máximo ${peak} en ±2 días`,
      );
    }
  });

  it("da mareas muertas en las cuadraturas de 2026", () => {
    const quadratures = quarters.filter(
      (quarter) => quarter.quarter === "first-quarter" || quarter.quarter === "last-quarter",
    );
    assert.ok(quadratures.length >= 24, `se esperaban ~25 cuadraturas en un año: ${quadratures.length}`);
    for (const quadrature of quadratures) {
      const trough = Math.min(...windowAround(quadrature.timeUtcMs));
      assert.ok(
        trough <= NEAP_TIDE_CEILING,
        `${new Date(quadrature.timeUtcMs).toISOString()} (${quadrature.quarter}): mínimo ${trough} en ±2 días`,
      );
    }
  });

  it("no salta de un día al siguiente más de lo que se mueve la marea", () => {
    const values = [...maxima.values()];
    let worst = 0;
    for (const [index, value] of values.entries()) {
      const previous = values[index - 1];
      if (previous === undefined) {
        continue;
      }
      worst = Math.max(worst, Math.abs(value - previous));
    }
    console.log(`  mayor salto entre días consecutivos: ${worst} unidades`);
    assert.ok(worst <= MAX_DAILY_JUMP, `salto de ${worst} unidades entre dos días consecutivos`);
  });
});

describe("propiedades · contrato", () => {
  it("rechaza una estación sin onda semidiurna en vez de inventarse un coeficiente", () => {
    const diurnal = stationWith([{ name: "K1", amplitude_m: 1, phase_deg: 0 }]);
    assert.throws(
      () => tidalCoefficients(diurnal, YEAR_START_UTC_MS, YEAR_START_UTC_MS + DAY_MS),
      NoSemidiurnalTideError,
    );
  });

  it("rechaza un constituyente desconocido aunque el filtro semidiurno fuera a descartarlo", () => {
    const unknown = stationWith([
      { name: "M2", amplitude_m: 1, phase_deg: 0 },
      { name: "XYZ9", amplitude_m: 1, phase_deg: 0 },
    ]);
    assert.throws(
      () => tidalCoefficients(unknown, YEAR_START_UTC_MS, YEAR_START_UTC_MS + DAY_MS),
      UnsupportedConstituentError,
    );
  });

  it("rechaza unidades de altura, rangos y fechas inválidos", () => {
    const end = YEAR_START_UTC_MS + DAY_MS;
    assert.throws(() => tidalCoefficients(M2_ONLY_STATION, YEAR_START_UTC_MS, end, { unitHeight_m: 0 }), RangeError);
    assert.throws(
      () => tidalCoefficients(M2_ONLY_STATION, YEAR_START_UTC_MS, end, { unitHeight_m: Number.NaN }),
      RangeError,
    );
    assert.throws(() => tidalCoefficients(M2_ONLY_STATION, end, YEAR_START_UTC_MS), RangeError);
    assert.throws(() => tidalCoefficientDay(M2_ONLY_STATION, "2026-02-30"), InvalidCivilDateError);
    assert.throws(() => tidalCoefficientDay(M2_ONLY_STATION, "1 de marzo"), InvalidCivilDateError);
    assert.throws(
      () => tidalCoefficientDay(M2_ONLY_STATION, "2026-03-01", { timeZone: "Mar/Cantabrico" }),
      InvalidTimeZoneError,
    );
  });

  it("cubre el día civil completo, también el de 25 horas del cambio de horario", () => {
    const station = loadBrestStation();
    // La madrugada del 25 de octubre de 2026 se atrasa el reloj en Europe/Paris: el día dura 25 h.
    const longDay = tidalCoefficientDay(station, "2026-10-25");
    assert.ok(longDay.coefficients.length >= 2, "un día de 25 horas no puede tener menos pleamares");
    for (const coefficient of longDay.coefficients) {
      assert.ok(
        coefficient.highWaterUtcMs >= Date.parse("2026-10-24T22:00:00Z") &&
          coefficient.highWaterUtcMs < Date.parse("2026-10-25T23:00:00Z"),
        "toda pleamar contada cae dentro del día civil francés",
      );
    }
  });
});
