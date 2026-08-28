/**
 * Tabla de constituyentes armónicos soportados.
 *
 * Cada constituyente queda definido por sus números de Doodson extendidos —los coeficientes de
 * (τ, s, h, p, N′, p₁) más el múltiplo de 90° del término constante— y por la regla que deriva su
 * corrección nodal de los fundamentales de Schureman.
 *
 * El argumento de equilibrio es V(t) = c_τ·τ + c_s·s + c_h·h + c_p·p + c_N·N′ + c_p₁·p₁ + c₉₀·90°
 * (Doodson 1921; P. Schureman, SP-98, Tabla 2). La velocidad angular sale de los mismos
 * coeficientes aplicados a las velocidades medias, sin tabla paralela que mantener.
 *
 * El juego soportado es el de 37 constituyentes que publica NOAA CO-OPS para sus estaciones, que
 * contiene el conjunto estándar (M2, S2, N2, K2, K1, O1, P1, Q1, M4, MS4, Mm, Mf, Ssa, Sa) más los
 * armónicos y compuestos de orden superior.
 */

import type { AstronomicalArguments, MeanAngularSpeeds } from "./astronomy.ts";
import { MEAN_ANGULAR_SPEEDS } from "./astronomy.ts";
import type { NodalTerm } from "./nodal.ts";

/** Coeficientes de Doodson extendidos: [τ, s, h, p, N′, p₁, múltiplos de 90°]. */
export type DoodsonCoefficients = readonly [number, number, number, number, number, number, number];

export interface ConstituentDefinition {
  /** Nombre canónico, en la grafía de NOAA CO-OPS. */
  readonly name: string;
  readonly doodson: DoodsonCoefficients;
  /** Términos de los que se compone la corrección nodal; vacío = sin corrección (f = 1, u = 0). */
  readonly nodal: readonly NodalTerm[];
  /** Velocidad angular en grados por hora, derivada de `doodson`. */
  readonly speedDegPerHour: number;
}

function speedOf(doodson: DoodsonCoefficients, speeds: MeanAngularSpeeds): number {
  const [tau, s, h, p, nPrime, p1] = doodson;
  return (
    tau * speeds.tau +
    s * speeds.s +
    h * speeds.h +
    p * speeds.p +
    nPrime * speeds.nPrime +
    p1 * speeds.p1
  );
}

/** Atajo para declarar la lista de términos nodales de forma compacta. */
function nodal(...terms: readonly (readonly [NodalTerm["fundamental"], number])[]): readonly NodalTerm[] {
  return terms.map(([fundamental, factor]) => ({ fundamental, factor }));
}

function define(
  name: string,
  doodson: DoodsonCoefficients,
  nodalTerms: readonly NodalTerm[],
): ConstituentDefinition {
  return { name, doodson, nodal: nodalTerms, speedDegPerHour: speedOf(doodson, MEAN_ANGULAR_SPEEDS) };
}

/**
 * Definiciones en el orden en que NOAA CO-OPS numera sus 37 constituyentes.
 *
 * Los compuestos derivan su corrección nodal de los fundamentales que los generan: MS4 = M2 + S2
 * toma f(M2) porque S2 no tiene corrección; 2MK3 = 2·M2 − K1 toma f(M2)²·f(K1) y 2u(M2) − u(K1).
 */
const DEFINITIONS: readonly ConstituentDefinition[] = [
  define("M2", [2, 0, 0, 0, 0, 0, 0], nodal(["M2", 1])),
  define("S2", [2, 2, -2, 0, 0, 0, 0], nodal()),
  define("N2", [2, -1, 0, 1, 0, 0, 0], nodal(["M2", 1])),
  define("K1", [1, 1, 0, 0, 0, 0, -1], nodal(["K1", 1])),
  define("M4", [4, 0, 0, 0, 0, 0, 0], nodal(["M2", 2])),
  define("O1", [1, -1, 0, 0, 0, 0, 1], nodal(["O1", 1])),
  define("M6", [6, 0, 0, 0, 0, 0, 0], nodal(["M2", 3])),
  define("MK3", [3, 1, 0, 0, 0, 0, -1], nodal(["M2", 1], ["K1", 1])),
  define("S4", [4, 4, -4, 0, 0, 0, 0], nodal()),
  define("MN4", [4, -1, 0, 1, 0, 0, 0], nodal(["M2", 2])),
  define("NU2", [2, -1, 2, -1, 0, 0, 0], nodal(["M2", 1])),
  define("S6", [6, 6, -6, 0, 0, 0, 0], nodal()),
  define("MU2", [2, -2, 2, 0, 0, 0, 0], nodal(["M2", 1])),
  define("2N2", [2, -2, 0, 2, 0, 0, 0], nodal(["M2", 1])),
  define("OO1", [1, 3, 0, 0, 0, 0, -1], nodal(["OO1", 1])),
  define("LAM2", [2, 1, -2, 1, 0, 0, -2], nodal(["M2", 1])),
  define("S1", [1, 1, -1, 0, 0, 0, 0], nodal()),
  define("M1", [1, 0, 0, 1, 0, 0, -1], nodal(["M1", 1])),
  define("J1", [1, 2, 0, -1, 0, 0, -1], nodal(["J1", 1])),
  define("MM", [0, 1, 0, -1, 0, 0, 0], nodal(["Mm", 1])),
  define("SSA", [0, 0, 2, 0, 0, 0, 0], nodal()),
  define("SA", [0, 0, 1, 0, 0, 0, 0], nodal()),
  define("MSF", [0, 2, -2, 0, 0, 0, 0], nodal(["M2", -1])),
  define("MF", [0, 2, 0, 0, 0, 0, 0], nodal(["Mf", 1])),
  define("RHO", [1, -2, 2, -1, 0, 0, 1], nodal(["O1", 1])),
  define("Q1", [1, -2, 0, 1, 0, 0, 1], nodal(["O1", 1])),
  define("T2", [2, 2, -3, 0, 0, 1, 0], nodal()),
  define("R2", [2, 2, -1, 0, 0, -1, -2], nodal()),
  define("2Q1", [1, -3, 0, 2, 0, 0, 1], nodal(["O1", 1])),
  define("P1", [1, 1, -2, 0, 0, 0, 1], nodal()),
  define("2SM2", [2, 4, -4, 0, 0, 0, 0], nodal(["M2", -1])),
  define("M3", [3, 0, 0, 0, 0, 0, -2], nodal(["M2", 1.5])),
  define("L2", [2, 1, 0, -1, 0, 0, -2], nodal(["L2", 1])),
  define("2MK3", [3, -1, 0, 0, 0, 0, 1], nodal(["M2", 2], ["K1", -1])),
  define("K2", [2, 2, 0, 0, 0, 0, 0], nodal(["K2", 1])),
  define("M8", [8, 0, 0, 0, 0, 0, 0], nodal(["M2", 4])),
  define("MS4", [4, 2, -2, 0, 0, 0, 0], nodal(["M2", 1])),
];

/**
 * Grafías alternativas aceptadas, normalizadas a mayúsculas. Los ficheros de constantes armónicas
 * usan indistintamente la letra griega desarrollada o la abreviatura de NOAA.
 */
const ALIASES: Readonly<Record<string, string>> = {
  LAMBDA2: "LAM2",
  RHO1: "RHO",
  NU: "NU2",
  MU: "MU2",
};

const BY_NAME: ReadonlyMap<string, ConstituentDefinition> = new Map(
  DEFINITIONS.map((definition) => [definition.name, definition]),
);

/** Nombres canónicos soportados, en el orden de la tabla de NOAA. */
export const SUPPORTED_CONSTITUENTS: readonly string[] = DEFINITIONS.map((d) => d.name);

/** Normaliza la grafía de un nombre de constituyente a la canónica de la tabla. */
export function canonicalConstituentName(name: string): string {
  const upper = name.trim().toUpperCase();
  return ALIASES[upper] ?? upper;
}

/** Devuelve la definición del constituyente, o `undefined` si no está soportado. */
export function findConstituent(name: string): ConstituentDefinition | undefined {
  return BY_NAME.get(canonicalConstituentName(name));
}

/** ¿Está soportado este constituyente? Útil para filtrar en los pipelines de datos. */
export function isSupportedConstituent(name: string): boolean {
  return BY_NAME.has(canonicalConstituentName(name));
}

/** Argumento de equilibrio V(t) del constituyente, en grados. */
export function equilibriumArgument(
  definition: ConstituentDefinition,
  args: AstronomicalArguments,
): number {
  const [tau, s, h, p, nPrime, p1, ninety] = definition.doodson;
  return (
    tau * args.tau +
    s * args.s +
    h * args.h +
    p * args.p +
    nPrime * args.nPrime +
    p1 * args.p1 +
    ninety * 90
  );
}
