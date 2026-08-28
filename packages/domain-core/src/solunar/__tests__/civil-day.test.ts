/**
 * Tests de la proyección del día civil sobre UTC.
 *
 * Es la única pieza de `solunar/` que sabe de zonas horarias, así que es la única que puede
 * equivocarse en una hora entera. Se comprueba contra los desplazamientos publicados de la tzdata
 * (CET/CEST y WET/WEST en 2026) y contra los dos días del año que no duran 24 h.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  civilDateOf,
  civilDayBounds,
  InvalidCivilDateError,
  InvalidTimeZoneError,
  timeZoneOffsetMs,
  wallTimeToUtcMs,
} from "../civil-day.ts";

const MS_PER_HOUR = 3_600_000;

/** Días del cambio de horario en la UE en 2026: últimos domingos de marzo y de octubre. */
const DST_FORWARD_DAY = "2026-03-29";
const DST_BACK_DAY = "2026-10-25";

describe("día civil · límites", () => {
  it("empieza el día de Madrid en invierno a las 23:00 UTC del día anterior (CET, UTC+1)", () => {
    const bounds = civilDayBounds("2026-01-20", "Europe/Madrid");
    assert.equal(new Date(bounds.startUtcMs).toISOString(), "2026-01-19T23:00:00.000Z");
    assert.equal(new Date(bounds.endUtcMs).toISOString(), "2026-01-20T23:00:00.000Z");
  });

  it("empieza el día de Madrid en verano a las 22:00 UTC del día anterior (CEST, UTC+2)", () => {
    const bounds = civilDayBounds("2026-07-15", "Europe/Madrid");
    assert.equal(new Date(bounds.startUtcMs).toISOString(), "2026-07-14T22:00:00.000Z");
    assert.equal(new Date(bounds.endUtcMs).toISOString(), "2026-07-15T22:00:00.000Z");
  });

  it("hace coincidir el día de Canarias con el día UTC en invierno (WET, UTC+0)", () => {
    const bounds = civilDayBounds("2026-01-20", "Atlantic/Canary");
    assert.equal(new Date(bounds.startUtcMs).toISOString(), "2026-01-20T00:00:00.000Z");
    assert.equal(new Date(bounds.endUtcMs).toISOString(), "2026-01-21T00:00:00.000Z");
  });

  it("separa Canarias de la Península por una hora exacta todo el año", () => {
    for (const dateIso of ["2026-01-20", "2026-04-15", "2026-07-15", "2026-11-11"]) {
      const peninsula = civilDayBounds(dateIso, "Europe/Madrid");
      const canarias = civilDayBounds(dateIso, "Atlantic/Canary");
      assert.equal(
        canarias.startUtcMs - peninsula.startUtcMs,
        MS_PER_HOUR,
        `${dateIso}: Canarias debe ir una hora por detrás`,
      );
    }
  });

  it("dura 23 horas el día en que se adelanta el reloj y 25 el día en que se atrasa", () => {
    const forward = civilDayBounds(DST_FORWARD_DAY, "Europe/Madrid");
    const back = civilDayBounds(DST_BACK_DAY, "Europe/Madrid");
    assert.equal((forward.endUtcMs - forward.startUtcMs) / MS_PER_HOUR, 23);
    assert.equal((back.endUtcMs - back.startUtcMs) / MS_PER_HOUR, 25);
  });

  it("encadena los días sin huecos ni solapes, también en los cambios de horario", () => {
    let previousEndUtcMs: number | undefined;
    for (let day = 27; day <= 31; day += 1) {
      const dateIso = `2026-10-${String(day).padStart(2, "0")}`;
      const bounds = civilDayBounds(dateIso, "Europe/Madrid");
      if (previousEndUtcMs !== undefined) {
        assert.equal(bounds.startUtcMs, previousEndUtcMs, `hueco antes de ${dateIso}`);
      }
      previousEndUtcMs = bounds.endUtcMs;
    }
  });

  it("mantiene el día UTC exactamente igual al día civil de UTC", () => {
    const bounds = civilDayBounds("2026-06-21", "UTC");
    assert.equal(bounds.startUtcMs, Date.parse("2026-06-21T00:00:00Z"));
    assert.equal(bounds.endUtcMs, Date.parse("2026-06-22T00:00:00Z"));
  });

  it("funciona al oeste del meridiano y al este, con desplazamientos no enteros", () => {
    const kathmandu = civilDayBounds("2026-06-21", "Asia/Kathmandu"); // UTC+05:45
    assert.equal(new Date(kathmandu.startUtcMs).toISOString(), "2026-06-20T18:15:00.000Z");
    const honolulu = civilDayBounds("2026-06-21", "Pacific/Honolulu"); // UTC−10
    assert.equal(new Date(honolulu.startUtcMs).toISOString(), "2026-06-21T10:00:00.000Z");
  });
});

describe("día civil · desplazamiento y hora de pared", () => {
  it("mide el desplazamiento de la zona en el instante dado", () => {
    assert.equal(timeZoneOffsetMs("Europe/Madrid", Date.parse("2026-01-20T12:00:00Z")), MS_PER_HOUR);
    assert.equal(
      timeZoneOffsetMs("Europe/Madrid", Date.parse("2026-07-15T12:00:00Z")),
      2 * MS_PER_HOUR,
    );
    assert.equal(timeZoneOffsetMs("UTC", Date.parse("2026-07-15T12:00:00Z")), 0);
  });

  it("no arrastra los milisegundos del instante al desplazamiento", () => {
    const withMillis = Date.parse("2026-07-15T12:00:00Z") + 777;
    assert.equal(timeZoneOffsetMs("Europe/Madrid", withMillis), 2 * MS_PER_HOUR);
  });

  it("resuelve la hora de pared repetida en la segunda ocurrencia, la del horario ya cambiado", () => {
    // El 2026-10-25 las 02:30 locales existen dos veces en Madrid: 00:30 UTC (CEST) y 01:30 (CET).
    const utcMs = wallTimeToUtcMs(Date.UTC(2026, 9, 25, 2, 30), "Europe/Madrid");
    assert.equal(new Date(utcMs).toISOString(), "2026-10-25T01:30:00.000Z");
  });

  it("desplaza hacia adelante la hora de pared que no existe el día que se adelanta el reloj", () => {
    // El 2026-03-29 en Madrid se salta de las 02:00 a las 03:00: las 02:30 locales no existen.
    const utcMs = wallTimeToUtcMs(Date.UTC(2026, 2, 29, 2, 30), "Europe/Madrid");
    assert.equal(new Date(utcMs).toISOString(), "2026-03-29T01:30:00.000Z");
    assert.equal(civilDateOf(utcMs, "Europe/Madrid"), DST_FORWARD_DAY);
  });

  it("da la vuelta: el instante inicial de un día civil se lee como ese día en su zona", () => {
    for (const dateIso of ["2026-01-20", DST_FORWARD_DAY, DST_BACK_DAY, "2026-07-15"]) {
      const bounds = civilDayBounds(dateIso, "Europe/Madrid");
      assert.equal(civilDateOf(bounds.startUtcMs, "Europe/Madrid"), dateIso);
      assert.equal(civilDateOf(bounds.endUtcMs - 1, "Europe/Madrid"), dateIso);
      assert.notEqual(civilDateOf(bounds.endUtcMs, "Europe/Madrid"), dateIso);
    }
  });
});

describe("día civil · contrato de errores", () => {
  it("rechaza una zona horaria que el entorno no reconoce", () => {
    for (const timeZone of ["Europa/Madrid", "CET+1", ""]) {
      assert.throws(
        () => civilDayBounds("2026-01-20", timeZone),
        InvalidTimeZoneError,
        `debería rechazar la zona ${JSON.stringify(timeZone)}`,
      );
    }
  });

  it("rechaza fechas mal formadas o inexistentes", () => {
    for (const dateIso of ["20-01-2026", "2026-1-20", "2026-02-30", "2026-13-01", "hoy"]) {
      assert.throws(
        () => civilDayBounds(dateIso, "Europe/Madrid"),
        InvalidCivilDateError,
        `debería rechazar la fecha ${JSON.stringify(dateIso)}`,
      );
    }
  });

  it("acepta el 29 de febrero de un año bisiesto y rechaza el de uno que no lo es", () => {
    assert.doesNotThrow(() => civilDayBounds("2028-02-29", "Europe/Madrid"));
    assert.throws(() => civilDayBounds("2026-02-29", "Europe/Madrid"), InvalidCivilDateError);
  });
});
