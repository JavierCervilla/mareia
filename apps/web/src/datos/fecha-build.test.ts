import test from "node:test";
import assert from "node:assert/strict";

import { diasDelMes, fechaDeBuild, mesDe, VARIABLE_FECHA } from "./fecha-build.ts";

const RELOJ = Date.parse("2026-08-28T09:15:00Z");

test("sin BUILD_DATE, el sitio publica el día UTC del reloj", () => {
  assert.equal(fechaDeBuild({}, RELOJ), "2026-08-28");
  assert.equal(fechaDeBuild({ [VARIABLE_FECHA]: "" }, RELOJ), "2026-08-28");
  // Justo antes de medianoche UTC sigue siendo el día 28, aunque en Madrid ya sea el 29.
  assert.equal(fechaDeBuild({}, Date.parse("2026-08-28T23:59:59Z")), "2026-08-28");
});

test("con BUILD_DATE, el sitio publica ese día y el build es reproducible", () => {
  assert.equal(fechaDeBuild({ [VARIABLE_FECHA]: "2026-01-01" }, RELOJ), "2026-01-01");
});

test("un BUILD_DATE que no es una fecha rompe el build en vez de publicar otro día", () => {
  for (const malo of ["2026-13-01", "2026-02-30", "28-08-2026", "hoy", "2026-8-1"]) {
    assert.throws(() => fechaDeBuild({ [VARIABLE_FECHA]: malo }, RELOJ), /BUILD_DATE/);
  }
});

test("el mes de una fecha son su primer y su último día", () => {
  assert.deepEqual(mesDe("2026-08-28"), { primero: "2026-08-01", ultimo: "2026-08-31" });
  assert.deepEqual(mesDe("2026-02-15"), { primero: "2026-02-01", ultimo: "2026-02-28" });
  // 2028 es bisiesto: febrero tiene 29 y la tabla mensual tiene que traer la fila.
  assert.deepEqual(mesDe("2028-02-15"), { primero: "2028-02-01", ultimo: "2028-02-29" });
});

test("los días del mes salen en orden y sin huecos", () => {
  const agosto = diasDelMes("2026-08-28");
  assert.equal(agosto.length, 31);
  assert.equal(agosto[0], "2026-08-01");
  assert.equal(agosto.at(-1), "2026-08-31");
  assert.equal(diasDelMes("2028-02-01").length, 29);
});
