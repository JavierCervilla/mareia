/**
 * El catálogo de Doodson reproduce las velocidades publicadas de cada constituyente.
 *
 * Es el test que atrapa la errata más cara del motor: un número de Doodson mal copiado no rompe
 * nada visible, solo desplaza para siempre la pleamar de ese constituyente. La tabla de abajo es
 * **independiente** del catálogo (velocidades publicadas en grados por hora solar media, del
 * listado estándar de Schureman/NOAA CO-OPS), así que compararlas cierra el lazo. Es la misma
 * tabla que verifica el catálogo gemelo del pipeline, en
 * `data/pipeline/tests/test_constituent_speeds.py`.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeAstronomicalArguments, DEG_TO_RAD } from "../astronomy.ts";
import { findConstituent } from "../constituents.ts";
import { computeNodalCorrection } from "../nodal.ts";

/** Velocidades publicadas de los constituyentes que añade T-04, en grados por hora. */
const PUBLISHED_SPEEDS_DEG_PER_HOUR: Readonly<Record<string, number>> = {
  EP2: 27.4238337,
  MA2: 28.9430356,
  MB2: 29.0251728,
  MKS2: 29.0662415,
  "2MS6": 87.9682084,
};

/** Un instante cualquiera del rango de operación: los factores nodales no son constantes. */
const AT_UTC_MS = Date.parse("2026-03-15T00:00:00Z");

function definitionOf(name: string) {
  const definition = findConstituent(name);
  assert.ok(definition !== undefined, `el catálogo no conoce ${name}`);
  return definition;
}

describe("catálogo · velocidades publicadas", () => {
  for (const [name, published] of Object.entries(PUBLISHED_SPEEDS_DEG_PER_HOUR)) {
    it(`deriva la velocidad publicada de ${name} de sus números de Doodson`, () => {
      const speed = definitionOf(name).speedDegPerHour;
      assert.ok(
        Math.abs(speed - published) < 1e-5,
        `${name}: ${speed.toFixed(7)}°/h frente a los ${published.toFixed(7)}°/h publicados`,
      );
    });
  }
});

describe("catálogo · corrección nodal de los compuestos añadidos", () => {
  const args = computeAstronomicalArguments(AT_UTC_MS);
  const m2 = computeNodalCorrection(definitionOf("M2").nodal, args);
  const k2 = computeNodalCorrection(definitionOf("K2").nodal, args);

  it("compone MKS2 = M2 + K2 − S2 con los factores de M2 y K2 (S2 no aporta)", () => {
    const mks2 = computeNodalCorrection(definitionOf("MKS2").nodal, args);
    assert.ok(Math.abs(mks2.f - m2.f * k2.f) < 1e-12, `f(MKS2) = ${mks2.f}, f(M2)·f(K2) = ${m2.f * k2.f}`);
    assert.ok(Math.abs(mks2.u - (m2.u + k2.u)) < 1e-12, `u(MKS2) = ${mks2.u}, u(M2)+u(K2) = ${m2.u + k2.u}`);
  });

  it("compone 2MS6 = 2·M2 + S2 con el cuadrado del factor de M2", () => {
    const ms6 = computeNodalCorrection(definitionOf("2MS6").nodal, args);
    assert.ok(Math.abs(ms6.f - m2.f ** 2) < 1e-12, `f(2MS6) = ${ms6.f}, f(M2)² = ${m2.f ** 2}`);
    assert.ok(Math.abs(ms6.u - 2 * m2.u) < 1e-12, `u(2MS6) = ${ms6.u}, 2·u(M2) = ${2 * m2.u}`);
  });

  it("deja EP2 con la corrección de M2 y MA2/MB2 sin corrección nodal lunar", () => {
    const ep2 = computeNodalCorrection(definitionOf("EP2").nodal, args);
    assert.deepEqual(ep2, m2);
    for (const name of ["MA2", "MB2"]) {
      assert.deepEqual(computeNodalCorrection(definitionOf(name).nodal, args), { f: 1, u: 0 }, name);
    }
  });
});

/**
 * El factor nodal de M3 en la forma publicada, contra la constante impresa de Schureman.
 *
 * Este motor evalúa el valor medio a partir de ω e i en vez de copiar el 0,8758 de la tabla; el
 * test comprueba que ambas lecturas coinciden a lo largo del ciclo nodal de 18,6 años, que es lo
 * que demuestra que el denominador analítico es el que Schureman redondeó.
 */
describe("catálogo · factor nodal de M3 (SP-98, forma publicada)", () => {
  /** Valor medio impreso en SP-98 para M3: cos⁶(½ω)·cos⁶(½i). */
  const SCHUREMAN_M3_MEAN = 0.8758;
  /** Un instante por año a lo largo de un ciclo nodal completo. */
  const YEARS = Array.from({ length: 19 }, (_, index) => Date.parse(`${2020 + index}-07-01T00:00:00Z`));

  for (const atUtcMs of YEARS) {
    const iso = new Date(atUtcMs).toISOString().slice(0, 10);
    it(`reproduce cos⁶(I/2)/0,8758 en ${iso}`, () => {
      const args = computeAstronomicalArguments(atUtcMs);
      const { f, u } = computeNodalCorrection(definitionOf("M3").nodal, args);
      const published =
        Math.cos(0.5 * args.inclination * DEG_TO_RAD) ** 6 / SCHUREMAN_M3_MEAN;
      const relative = Math.abs(f - published) / published;
      assert.ok(
        relative < 1e-3,
        `f(M3) = ${f.toFixed(6)} frente a ${published.toFixed(6)} (${(relative * 100).toFixed(3)} %)`,
      );
      const m2 = computeNodalCorrection(definitionOf("M2").nodal, args);
      assert.ok(Math.abs(u - 1.5 * m2.u) < 1e-9, `u(M3) = ${u} debe ser 3ξ − 3ν = 1,5·u(M2)`);
    });
  }
});
