/**
 * Correcciones nodales f (amplitud) y u (fase) del método de Schureman.
 *
 * Referencia: P. Schureman, «Manual of Harmonic Analysis and Prediction of Tides», USC&GS
 * Special Publication 98 — en adelante SP-98. Los factores f son los de las eqs. 73-80 divididos
 * por su valor medio (eqs. 65-72), de modo que f ≈ 1 promediado sobre el ciclo nodal de 18,6 años.
 *
 * Solo once constituyentes tienen corrección propia («fundamentales»); el resto la derivan de
 * ellos como producto/suma ponderada (ver `constituents.ts`).
 */

import type { AstronomicalArguments } from "./astronomy.ts";
import { DEG_TO_RAD, RAD_TO_DEG } from "./astronomy.ts";

/** Constituyentes con fórmula propia de f y u en SP-98. */
export type NodalFundamental =
  | "Mm"
  | "Mf"
  | "O1"
  | "J1"
  | "OO1"
  | "M1"
  | "M2"
  | "M3"
  | "K1"
  | "K2"
  | "L2";

/** Corrección nodal: factor de amplitud f (adimensional) y desfase u en grados. */
export interface NodalCorrection {
  readonly f: number;
  readonly u: number;
}

/**
 * Aportación de un fundamental a la corrección de un constituyente derivado.
 * El factor es un entero, negativo en los constituyentes compuestos por diferencia.
 */
export interface NodalTerm {
  readonly fundamental: NodalFundamental;
  readonly factor: number;
}

const NO_CORRECTION: NodalCorrection = { f: 1, u: 0 };

type FundamentalFormula = (args: AstronomicalArguments) => NodalCorrection;

interface Angles {
  readonly bigI: number;
  readonly omega: number;
  readonly i: number;
  readonly nu: number;
  readonly bigP: number;
}

function anglesInRadians(args: AstronomicalArguments): Angles {
  return {
    bigI: args.inclination * DEG_TO_RAD,
    omega: args.obliquity * DEG_TO_RAD,
    i: args.orbitInclination * DEG_TO_RAD,
    nu: args.nu * DEG_TO_RAD,
    bigP: args.lunarPerigeeCorrected * DEG_TO_RAD,
  };
}

/** Factor (1 − 3/2 sen²i) que aparece en los valores medios de SP-98 eqs. 66, 68 y 71. */
function orbitMeanFactor(i: number): number {
  return 1 - 1.5 * Math.sin(i) ** 2;
}

/** f(Mm) — SP-98 eqs. 73 y 65. */
function fMm({ bigI, omega, i }: Angles): number {
  const mean = (2 / 3 - Math.sin(omega) ** 2) * orbitMeanFactor(i);
  return (2 / 3 - Math.sin(bigI) ** 2) / mean;
}

/** f(Mf) — SP-98 eqs. 74 y 66. */
function fMf({ bigI, omega, i }: Angles): number {
  const mean = Math.sin(omega) ** 2 * Math.cos(0.5 * i) ** 4;
  return Math.sin(bigI) ** 2 / mean;
}

/** f(O1) — SP-98 eqs. 75 y 67. */
function fO1({ bigI, omega, i }: Angles): number {
  const mean = Math.sin(omega) * Math.cos(0.5 * omega) ** 2 * Math.cos(0.5 * i) ** 4;
  return (Math.sin(bigI) * Math.cos(0.5 * bigI) ** 2) / mean;
}

/** f(J1) — SP-98 eqs. 76 y 68. */
function fJ1({ bigI, omega, i }: Angles): number {
  return Math.sin(2 * bigI) / (Math.sin(2 * omega) * orbitMeanFactor(i));
}

/** f(OO1) — SP-98 eqs. 77 y 69. */
function fOO1({ bigI, omega, i }: Angles): number {
  const mean = Math.sin(omega) * Math.sin(0.5 * omega) ** 2 * Math.cos(0.5 * i) ** 4;
  return (Math.sin(bigI) * Math.sin(0.5 * bigI) ** 2) / mean;
}

/** f(M2) — SP-98 eqs. 78 y 70. */
function fM2({ bigI, omega, i }: Angles): number {
  return Math.cos(0.5 * bigI) ** 4 / (Math.cos(0.5 * omega) ** 4 * Math.cos(0.5 * i) ** 4);
}

/**
 * f(M3) — SP-98 Tabla 2: f = cos⁶(½I)/0,8758, con u = 3ξ − 3ν.
 *
 * El 0,8758 que imprime Schureman es el valor medio cos⁶(½ω)·cos⁶(½i), que aquí se evalúa a partir
 * de ω e i como el resto del módulo, en vez de copiar la constante redondeada. Con la ω de la
 * efeméride sale **0,875977** en 2026 (0,875969-0,875993 entre 2020 y 2038): un **+0,02 %** sobre
 * el valor impreso —mayor, no menor—, así que este f queda un 0,02 % por debajo del que da la
 * constante. Sobre la mayor amplitud de M3 del dataset (Brest, 1,98 cm) son 4 µm.
 *
 * Es la forma **publicada**, y no la derivada `f(M2)^1,5` que usaba este motor: analíticamente son
 * la misma expresión —f(M2) = cos⁴(½I)/[cos⁴(½ω)cos⁴(½i)], elevarla a 3/2 da exactamente cos⁶(½I)
 * sobre el mismo denominador—, pero escrita así se lee contra la referencia y deja de depender de
 * un exponente fraccionario en la composición de fundamentales, que es un caso especial que no
 * tiene ningún otro constituyente.
 */
function fM3({ bigI, omega, i }: Angles): number {
  return Math.cos(0.5 * bigI) ** 6 / (Math.cos(0.5 * omega) ** 6 * Math.cos(0.5 * i) ** 6);
}

/** f(K1) — SP-98 eqs. 79 y 71. */
function fK1({ bigI, omega, i, nu }: Angles): number {
  const sin2I = Math.sin(2 * bigI);
  const mean = 0.5023 * (Math.sin(2 * omega) * orbitMeanFactor(i)) + 0.1681;
  return Math.sqrt(0.2523 * sin2I ** 2 + 0.1689 * sin2I * Math.cos(nu) + 0.0283) / mean;
}

/** f(K2) — SP-98 eqs. 80 y 72. */
function fK2({ bigI, omega, i, nu }: Angles): number {
  const sinSquaredI = Math.sin(bigI) ** 2;
  const mean = 0.5023 * (Math.sin(omega) ** 2 * orbitMeanFactor(i)) + 0.0365;
  return Math.sqrt(0.2523 * sinSquaredI ** 2 + 0.0367 * sinSquaredI * Math.cos(2 * nu) + 0.0013) / mean;
}

/** 1/Rₐ — SP-98 eq. 215, corrección de amplitud propia de L2. */
function inverseRa({ bigI, bigP }: Angles): number {
  const tanHalfI = Math.tan(0.5 * bigI);
  return Math.sqrt(1 - 12 * tanHalfI ** 2 * Math.cos(2 * bigP) + 36 * tanHalfI ** 4);
}

/** 1/Qₐ — SP-98 eq. 197, corrección de amplitud propia de M1. */
function inverseQa({ bigI, bigP }: Angles): number {
  const cosHalfI = Math.cos(0.5 * bigI);
  return Math.sqrt(
    0.25 +
      (1.5 * Math.cos(bigI) * Math.cos(2 * bigP)) / cosHalfI ** 2 +
      (2.25 * Math.cos(bigI) ** 2) / cosHalfI ** 4,
  );
}

/** R — SP-98 eq. 214: tan R = sen 2P / [(1/6) cot²(I/2) − cos 2P]. */
function angleR({ bigI, bigP }: Angles): number {
  const cotSquaredHalfI = Math.tan(0.5 * bigI) ** -2;
  return Math.atan(Math.sin(2 * bigP) / (cotSquaredHalfI / 6 - Math.cos(2 * bigP))) * RAD_TO_DEG;
}

/** Q — SP-98 eq. 204: tan Q = [(5 cos I − 1)/(7 cos I + 1)] tan P. */
function angleQ({ bigI, bigP }: Angles): number {
  const cosI = Math.cos(bigI);
  return Math.atan(((5 * cosI - 1) / (7 * cosI + 1)) * Math.tan(bigP)) * RAD_TO_DEG;
}

/**
 * Fórmulas de f y u por constituyente fundamental. Las u salen de SP-98 Tabla 2 (columna
 * «u»): ξ y ν son los auxiliares del nodo, ν′ y ν″ los términos declinacionales de K1 y K2.
 */
const FUNDAMENTAL_FORMULAS: Readonly<Record<NodalFundamental, FundamentalFormula>> = {
  Mm: (args) => ({ f: fMm(anglesInRadians(args)), u: 0 }),
  Mf: (args) => ({ f: fMf(anglesInRadians(args)), u: -2 * args.xi }),
  O1: (args) => ({ f: fO1(anglesInRadians(args)), u: 2 * args.xi - args.nu }),
  J1: (args) => ({ f: fJ1(anglesInRadians(args)), u: -args.nu }),
  OO1: (args) => ({ f: fOO1(anglesInRadians(args)), u: -2 * args.xi - args.nu }),
  M2: (args) => ({ f: fM2(anglesInRadians(args)), u: 2 * args.xi - 2 * args.nu }),
  M3: (args) => ({ f: fM3(anglesInRadians(args)), u: 3 * args.xi - 3 * args.nu }),
  K1: (args) => ({ f: fK1(anglesInRadians(args)), u: -args.nuPrime }),
  K2: (args) => ({ f: fK2(anglesInRadians(args)), u: -2 * args.nuBiPrime }),
  M1: (args) => {
    const angles = anglesInRadians(args);
    return { f: fO1(angles) * inverseQa(angles), u: args.xi - args.nu + angleQ(angles) };
  },
  L2: (args) => {
    const angles = anglesInRadians(args);
    return { f: fM2(angles) * inverseRa(angles), u: 2 * args.xi - 2 * args.nu - angleR(angles) };
  },
};

/**
 * Compone la corrección nodal de un constituyente a partir de sus términos fundamentales:
 * f = Π f_k^|factor_k| y u = Σ factor_k · u_k. Sin términos, f = 1 y u = 0 (constituyentes
 * puramente solares como S2, P1 o T2, que no dependen del nodo lunar).
 */
export function computeNodalCorrection(
  terms: readonly NodalTerm[],
  args: AstronomicalArguments,
): NodalCorrection {
  if (terms.length === 0) {
    return NO_CORRECTION;
  }
  let f = 1;
  let u = 0;
  for (const term of terms) {
    const correction = FUNDAMENTAL_FORMULAS[term.fundamental](args);
    f *= correction.f ** Math.abs(term.factor);
    u += term.factor * correction.u;
  }
  return { f, u };
}
