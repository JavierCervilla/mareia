import test from "node:test";
import assert from "node:assert/strict";

import { alturaEnMinutos, minutosDesdeHora, trazarCurvaMarea } from "./grafico-marea.ts";

/** Los cuatro extremos del día de muestra (Santander, 28-08-2026). */
const EXTREMOS = [
  { hora: "04:12", alturaM: 4.82 },
  { hora: "10:26", alturaM: 0.93 },
  { hora: "16:38", alturaM: 4.95 },
  { hora: "22:51", alturaM: 0.81 },
] as const;

test("minutosDesdeHora convierte HH:MM a minutos del día", () => {
  assert.equal(minutosDesdeHora("00:00"), 0);
  assert.equal(minutosDesdeHora("04:12"), 252);
  assert.equal(minutosDesdeHora("23:59"), 1439);
});

test("minutosDesdeHora rechaza lo que no es una hora de 24 h", () => {
  for (const malo of ["24:00", "4:12", "10:60", "", "ahora"]) {
    assert.throws(() => minutosDesdeHora(malo), /Hora inválida/);
  }
});

test("la curva cubre el día completo de borde a borde", () => {
  const curva = trazarCurvaMarea(EXTREMOS);

  assert.match(curva.path, /^M0,/);
  const ultimoPunto = curva.path.split("L").at(-1) ?? "";
  assert.equal(Number(ultimoPunto.split(",")[0]), curva.ancho);
});

test("cada extremo cae dentro del lienzo y respeta el orden vertical del dato", () => {
  const curva = trazarCurvaMarea(EXTREMOS);

  assert.equal(curva.extremos.length, EXTREMOS.length);
  for (const punto of curva.extremos) {
    assert.ok(punto.x >= 0 && punto.x <= curva.ancho, `x fuera del lienzo: ${punto.x}`);
    assert.ok(punto.y >= 0 && punto.y <= curva.alto, `y fuera del lienzo: ${punto.y}`);
  }

  const [pleamar1, bajamar1, pleamar2, bajamar2] = curva.extremos;
  assert.ok(pleamar1 && bajamar1 && pleamar2 && bajamar2);
  // 4,95 m es la pleamar más alta → la y más pequeña (el eje SVG crece hacia abajo).
  assert.ok(pleamar2.y < pleamar1.y);
  // 0,81 m es la bajamar más baja → la y más grande.
  assert.ok(bajamar2.y > bajamar1.y);
  // Toda pleamar queda por encima del nivel medio y toda bajamar por debajo.
  assert.ok(pleamar1.y < curva.nivelMedioY && bajamar1.y > curva.nivelMedioY);
});

test("la interpolación pasa exactamente por cada extremo", () => {
  for (const extremo of EXTREMOS) {
    assert.equal(
      Math.round(alturaEnMinutos(EXTREMOS, minutosDesdeHora(extremo.hora)) * 100) / 100,
      extremo.alturaM,
    );
  }
});

test("entre dos extremos la marea es monótona (baja de pleamar a bajamar)", () => {
  const inicio = minutosDesdeHora("04:12");
  const fin = minutosDesdeHora("10:26");

  let anterior = Number.POSITIVE_INFINITY;
  for (let minuto = inicio; minuto <= fin; minuto += 10) {
    const altura = alturaEnMinutos(EXTREMOS, minuto);
    assert.ok(altura < anterior, `no decrece en el minuto ${minuto}`);
    anterior = altura;
  }
});

test("la altura nunca se sale del rango de los extremos del día", () => {
  const alturas = EXTREMOS.map((extremo) => extremo.alturaM);
  const minimo = Math.min(...alturas);
  const maximo = Math.max(...alturas);

  for (let minuto = 0; minuto <= 1440; minuto += 5) {
    const altura = alturaEnMinutos(EXTREMOS, minuto);
    assert.ok(altura >= minimo - 1e-9 && altura <= maximo + 1e-9, `fuera de rango en ${minuto}`);
  }
});

test("con menos de dos extremos no hay curva que trazar", () => {
  assert.throws(() => trazarCurvaMarea([{ hora: "04:12", alturaM: 4.82 }]), /al menos dos extremos/);
});
