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
import { computeAstronomicalArguments } from "../astronomy.ts";
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
