import test from "node:test";
import assert from "node:assert/strict";

import { alturaEn, trazarCurvaMarea } from "./grafico-marea.ts";
import type { EntradaCurva, ExtremoCurva, MuestraCurva } from "./grafico-marea.ts";

const MINUTO = 60_000;
const DIA = 1_440 * MINUTO;
/** Medianoche del 28-08-2026 en hora peninsular (UTC+2), el día que usan los ejemplos. */
const INICIO = Date.parse("2026-08-27T22:00:00Z");

/**
 * Un día de marea semidiurna sintético: dos ciclos de coseno muestreados cada 10 min, con sus
 * extremos exactos. Es la forma del dato que entrega `getTides` —muestras + extremos por separado—
 * y no una curva ya resuelta: es justo la costura que este módulo tiene que coser.
 */
function diaSintetico(pasoMinutos = 10): EntradaCurva {
  const periodo = 12.42 * 60 * MINUTO;
  const media = 2.5;
  const amplitud = 2;
  const desfase = 3 * 60 * MINUTO;
  const altura = (t: number): number =>
    media + amplitud * Math.cos((2 * Math.PI * (t - INICIO - desfase)) / periodo);

  const muestras: MuestraCurva[] = [];
  for (let t = INICIO; t <= INICIO + DIA; t += pasoMinutos * MINUTO) {
    muestras.push({ timeUtcMs: t, height_m: altura(t) });
  }

  const extremos: ExtremoCurva[] = [];
  for (let vuelta = 0; ; vuelta += 1) {
    const t = INICIO + desfase + (vuelta * periodo) / 2;
    if (t > INICIO + DIA) break;
    extremos.push({
      timeUtcMs: t,
      height_m: altura(t),
      kind: vuelta % 2 === 0 ? "high" : "low",
    });
  }

  return { muestras, extremos, inicioUtcMs: INICIO, finUtcMs: INICIO + DIA };
}

interface Punto {
  readonly x: number;
  readonly y: number;
}

function puntosDelPath(path: string): readonly Punto[] {
  return path
    .replace(/^M/, "")
    .split("L")
    .map((par) => {
      const [x, y] = par.split(",");
      return { x: Number(x), y: Number(y) };
    });
}

test("la curva cubre el día completo de borde a borde", () => {
  const curva = trazarCurvaMarea(diaSintetico());
  const puntos = puntosDelPath(curva.path);

  assert.equal(puntos[0]?.x, 0);
  assert.equal(puntos.at(-1)?.x, curva.ancho);
});

test("el trazo tiene un punto por muestra y uno por extremo, sin duplicar instantes", () => {
  const dia = diaSintetico();
  const curva = trazarCurvaMarea(dia);
  const instantes = new Set([
    ...dia.muestras.map((muestra) => muestra.timeUtcMs),
    ...dia.extremos.map((extremo) => extremo.timeUtcMs),
  ]);

  assert.equal(puntosDelPath(curva.path).length, instantes.size);
});

test("cada extremo cae dentro del lienzo y respeta el orden vertical del dato", () => {
  const dia = diaSintetico();
  const curva = trazarCurvaMarea(dia);

  assert.equal(curva.extremos.length, dia.extremos.length);
  for (const marca of curva.extremos) {
    assert.ok(marca.x >= 0 && marca.x <= curva.ancho, `x fuera del lienzo: ${marca.x}`);
    assert.ok(marca.y >= 0 && marca.y <= curva.alto, `y fuera del lienzo: ${marca.y}`);
    // El eje SVG crece hacia abajo: la pleamar queda por encima del nivel medio y la bajamar debajo.
    const encima = marca.y < curva.nivelMedioY;
    assert.equal(encima, marca.kind === "high", `el extremo ${marca.kind} está del lado erróneo`);
  }
});

test("el círculo de cada extremo cae sobre el trazo que dibuja el SVG", () => {
  const curva = trazarCurvaMarea(diaSintetico());
  const trazo = puntosDelPath(curva.path);

  for (const marca of curva.extremos) {
    const encima = trazo.some(
      (punto) => Math.abs(punto.x - marca.x) < 0.05 && Math.abs(punto.y - marca.y) < 0.05,
    );
    assert.ok(encima, `el extremo en x=${marca.x} no es un punto del trazo`);
  }
});

test("las marcas del eje van del principio al final del día", () => {
  const curva = trazarCurvaMarea(diaSintetico());

  assert.equal(curva.horas[0]?.timeUtcMs, INICIO);
  assert.equal(curva.horas.at(-1)?.timeUtcMs, INICIO + DIA);
  assert.equal(curva.horas[0]?.x, 0);
  assert.equal(curva.horas.at(-1)?.x, curva.ancho);
});

test("alturaEn interpola entre muestras y se aplana fuera del rango", () => {
  const dia = diaSintetico();
  const primera = dia.muestras[0];
  const segunda = dia.muestras[1];
  assert.ok(primera && segunda);

  const medio = (primera.timeUtcMs + segunda.timeUtcMs) / 2;
  assert.ok(
    Math.abs(alturaEn(dia.muestras, medio) - (primera.height_m + segunda.height_m) / 2) < 1e-9,
  );
  assert.equal(alturaEn(dia.muestras, INICIO - DIA), primera.height_m);
  assert.equal(alturaEn(dia.muestras, INICIO + 2 * DIA), dia.muestras.at(-1)?.height_m);
});

test("la altura nunca se sale del rango de la curva del día", () => {
  const dia = diaSintetico();
  const alturas = dia.muestras.map((muestra) => muestra.height_m);
  const minimo = Math.min(...alturas);
  const maximo = Math.max(...alturas);

  for (let t = INICIO; t <= INICIO + DIA; t += 5 * MINUTO) {
    const altura = alturaEn(dia.muestras, t);
    assert.ok(altura >= minimo - 1e-9 && altura <= maximo + 1e-9, `fuera de rango en ${t}`);
  }
});

test("una curva sin puntos suficientes o desordenada rompe el build en vez de mentir", () => {
  const dia = diaSintetico();
  const primera = dia.muestras[0];
  const segunda = dia.muestras[1];
  assert.ok(primera && segunda);

  assert.throws(() => trazarCurvaMarea({ ...dia, muestras: [primera] }), /al menos dos muestras/);
  assert.throws(
    () => trazarCurvaMarea({ ...dia, muestras: [segunda, primera, ...dia.muestras.slice(2)] }),
    /orden temporal estricto/,
  );
  assert.throws(
    () => trazarCurvaMarea({ ...dia, extremos: [...dia.extremos].reverse() }),
    /orden temporal estricto/,
  );
  assert.throws(
    () => trazarCurvaMarea({ ...dia, finUtcMs: dia.inicioUtcMs }),
    /invertida o es vacía/,
  );
});
