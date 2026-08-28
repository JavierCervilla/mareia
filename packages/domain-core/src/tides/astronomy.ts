/**
 * Argumentos astronómicos de la teoría armónica de mareas.
 *
 * Referencias:
 * - P. Schureman, «Manual of Harmonic Analysis and Prediction of Tides», USC&GS Special
 *   Publication 98 (1940, rev. 1958) — en adelante SP-98. Secciones §§ 69-79 y Tabla 2.
 * - J. Meeus, «Astronomical Algorithms», 2ª ed. (1998) — polinomios de las longitudes medias.
 *
 * Todo el módulo es puro: el instante entra como milisegundos desde el epoch Unix (UTC) y no se
 * consulta ningún reloj ni huso horario. UT se trata como TT: ΔT ≈ 70 s introduce menos de 0,001°
 * de fase en M2, muy por debajo de la tolerancia de predicción.
 */

const MS_PER_DAY = 86_400_000;
/** Día juliano del epoch Unix (1970-01-01T00:00:00Z). */
const UNIX_EPOCH_JD = 2_440_587.5;
/** Día juliano de J2000.0 (2000-01-01T12:00:00 TT). */
const J2000_JD = 2_451_545;
const DAYS_PER_JULIAN_CENTURY = 36_525;
const HOURS_PER_JULIAN_CENTURY = DAYS_PER_JULIAN_CENTURY * 24;

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

/** s — longitud media de la Luna. Meeus (47.1). */
const MEAN_LUNAR_LONGITUDE = [218.316_447_7, 481_267.881_234_21, -0.001_578_6, 1 / 538_841, -1 / 65_194_000];
/** h — longitud media del Sol. Meeus (25.2). */
const MEAN_SOLAR_LONGITUDE = [280.466_46, 36_000.769_83, 0.000_303_2];
/** p — longitud media del perigeo lunar. Meeus (47.7). */
const MEAN_LUNAR_PERIGEE = [83.353_246_5, 4_069.013_728_7, -0.010_320_0, -1 / 80_053, 1 / 18_999_000];
/** N — longitud media del nodo ascendente lunar. Meeus (47.7). */
const MEAN_LUNAR_NODE = [125.044_547_9, -1_934.136_289_1, 0.002_075_4, 1 / 467_441, -1 / 60_616_000];
/** p₁ — longitud media del perigeo solar (perihelio terrestre + 180°). Meeus cap. 25. */
const MEAN_SOLAR_PERIGEE = [282.937_35, 1.719_46, 0.000_46];
/** ω — oblicuidad media de la eclíptica. Meeus (22.2). */
const MEAN_OBLIQUITY = [23.439_291_1, -0.013_004_2, -1.64e-6, 5.04e-7];
/** i — inclinación media de la órbita lunar sobre la eclíptica. SP-98 § 69. */
const LUNAR_ORBIT_INCLINATION_DEG = 5.145;

/**
 * Argumentos astronómicos evaluados en un instante, en grados salvo indicación.
 *
 * Los seis primeros son la base de Doodson en la que se desarrolla el argumento de equilibrio
 * V(t) de cada constituyente; el resto son los auxiliares de los que dependen los factores
 * nodales f y u (SP-98 §§ 71-79).
 */
export interface AstronomicalArguments {
  /** τ — tiempo lunar medio: ángulo horario del sol medio + h − s (SP-98 § 116). */
  readonly tau: number;
  /** s — longitud media de la Luna. */
  readonly s: number;
  /** h — longitud media del Sol. */
  readonly h: number;
  /** p — longitud media del perigeo lunar. */
  readonly p: number;
  /** N′ = −N — longitud negada del nodo ascendente (convención de Doodson). */
  readonly nPrime: number;
  /** p₁ — longitud media del perigeo solar. */
  readonly p1: number;
  /** I — inclinación de la órbita lunar sobre el ecuador terrestre (SP-98 eq. 12). */
  readonly inclination: number;
  /** ξ — corrección en longitud del nodo al equinoccio móvil (SP-98 eq. 68). */
  readonly xi: number;
  /** ν — ascensión recta del nodo ascendente sobre el ecuador (SP-98 eq. 69). */
  readonly nu: number;
  /** ν′ — auxiliar del término diurno K1 (SP-98 eq. 224). */
  readonly nuPrime: number;
  /** ν″ — auxiliar del término semidiurno K2 (SP-98 eq. 232). */
  readonly nuBiPrime: number;
  /** P = p − ξ — longitud del perigeo lunar referida al nodo (SP-98 eq. 191). */
  readonly lunarPerigeeCorrected: number;
  /** ω — oblicuidad media de la eclíptica, denominador de los factores f (SP-98 eqs. 65-74). */
  readonly obliquity: number;
  /** i — inclinación media de la órbita lunar sobre la eclíptica, ídem. */
  readonly orbitInclination: number;
}

/** Velocidades angulares medias de la base de Doodson, en grados por hora. */
export interface MeanAngularSpeeds {
  readonly tau: number;
  readonly s: number;
  readonly h: number;
  readonly p: number;
  readonly nPrime: number;
  readonly p1: number;
}

function evaluatePolynomial(coefficients: readonly number[], x: number): number {
  let result = 0;
  let power = 1;
  for (const coefficient of coefficients) {
    result += coefficient * power;
    power *= x;
  }
  return result;
}

/** Término lineal del polinomio, es decir su derivada en x = 0, en grados por siglo juliano. */
function linearRate(coefficients: readonly number[]): number {
  const [, linear = 0] = coefficients;
  return linear;
}

/** Resto no negativo módulo 360. Los auxiliares ξ y ν exigen N ∈ [0, 360). */
function normalizeDegrees(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/** Día juliano correspondiente a un instante UTC en milisegundos desde el epoch Unix. */
export function julianDay(atUtcMs: number): number {
  return atUtcMs / MS_PER_DAY + UNIX_EPOCH_JD;
}

/** Siglos julianos transcurridos desde J2000.0. */
function julianCenturies(atUtcMs: number): number {
  return (julianDay(atUtcMs) - J2000_JD) / DAYS_PER_JULIAN_CENTURY;
}

/**
 * I — inclinación de la órbita lunar sobre el ecuador: cos I = cos i cos ω − sen i sen ω cos N.
 * SP-98 eq. 12.
 */
function obliquityOfLunarOrbit(nodeDeg: number, inclinationDeg: number, obliquityDeg: number): number {
  const node = nodeDeg * DEG_TO_RAD;
  const i = inclinationDeg * DEG_TO_RAD;
  const omega = obliquityDeg * DEG_TO_RAD;
  const cosI = Math.cos(i) * Math.cos(omega) - Math.sin(i) * Math.sin(omega) * Math.cos(node);
  return Math.acos(cosI) * RAD_TO_DEG;
}

/**
 * Semisumas de SP-98 eqs. 68-69: ξ = −(e₁ + e₂) y ν = e₁ − e₂, con
 * e₁ = arctan[cos((ω−i)/2)/cos((ω+i)/2) · tan(N/2)] − N/2 y su análoga con senos.
 */
function nodeAuxiliaries(
  nodeDeg: number,
  inclinationDeg: number,
  obliquityDeg: number,
): { readonly xi: number; readonly nu: number } {
  const node = normalizeDegrees(nodeDeg) * DEG_TO_RAD;
  const i = inclinationDeg * DEG_TO_RAD;
  const omega = obliquityDeg * DEG_TO_RAD;
  const halfNode = 0.5 * node;
  const cosine = Math.cos(0.5 * (omega - i)) / Math.cos(0.5 * (omega + i));
  const sine = Math.sin(0.5 * (omega - i)) / Math.sin(0.5 * (omega + i));
  const e1 = Math.atan(cosine * Math.tan(halfNode)) - halfNode;
  const e2 = Math.atan(sine * Math.tan(halfNode)) - halfNode;
  return { xi: -(e1 + e2) * RAD_TO_DEG, nu: (e1 - e2) * RAD_TO_DEG };
}

/** ν′ — SP-98 eq. 224: tan ν′ = sen 2I sen ν / (sen 2I cos ν + 0,3347). */
function nuPrimeOf(inclinationDeg: number, nuDeg: number): number {
  const i = inclinationDeg * DEG_TO_RAD;
  const nu = nuDeg * DEG_TO_RAD;
  const sin2I = Math.sin(2 * i);
  return Math.atan((sin2I * Math.sin(nu)) / (sin2I * Math.cos(nu) + 0.3347)) * RAD_TO_DEG;
}

/** ν″ — SP-98 eq. 232: tan 2ν″ = sen²I sen 2ν / (sen²I cos 2ν + 0,0727). */
function nuBiPrimeOf(inclinationDeg: number, nuDeg: number): number {
  const i = inclinationDeg * DEG_TO_RAD;
  const nu = nuDeg * DEG_TO_RAD;
  const sinSquaredI = Math.sin(i) ** 2;
  const tan2NuBiPrime = (sinSquaredI * Math.sin(2 * nu)) / (sinSquaredI * Math.cos(2 * nu) + 0.0727);
  return 0.5 * Math.atan(tan2NuBiPrime) * RAD_TO_DEG;
}

/**
 * Evalúa los argumentos astronómicos en el instante dado (UTC, ms desde el epoch Unix).
 *
 * El ángulo horario del sol medio se obtiene de la fracción del día juliano, que vale 0 en el
 * mediodía de Greenwich; equivale a 15·t − 180 con t en horas UT (SP-98 § 116).
 */
export function computeAstronomicalArguments(atUtcMs: number): AstronomicalArguments {
  const centuries = julianCenturies(atUtcMs);
  const jd = julianDay(atUtcMs);
  const solarHourAngle = (jd - Math.floor(jd)) * 360;

  const s = normalizeDegrees(evaluatePolynomial(MEAN_LUNAR_LONGITUDE, centuries));
  const h = normalizeDegrees(evaluatePolynomial(MEAN_SOLAR_LONGITUDE, centuries));
  const p = normalizeDegrees(evaluatePolynomial(MEAN_LUNAR_PERIGEE, centuries));
  const node = normalizeDegrees(evaluatePolynomial(MEAN_LUNAR_NODE, centuries));
  const p1 = normalizeDegrees(evaluatePolynomial(MEAN_SOLAR_PERIGEE, centuries));
  const obliquity = evaluatePolynomial(MEAN_OBLIQUITY, centuries);

  const inclination = obliquityOfLunarOrbit(node, LUNAR_ORBIT_INCLINATION_DEG, obliquity);
  const { xi, nu } = nodeAuxiliaries(node, LUNAR_ORBIT_INCLINATION_DEG, obliquity);

  return {
    tau: solarHourAngle + h - s,
    s,
    h,
    p,
    nPrime: -node,
    p1,
    inclination,
    xi,
    nu,
    nuPrime: nuPrimeOf(inclination, nu),
    nuBiPrime: nuBiPrimeOf(inclination, nu),
    lunarPerigeeCorrected: p - xi,
    obliquity,
    orbitInclination: LUNAR_ORBIT_INCLINATION_DEG,
  };
}

/**
 * Velocidades medias de la base de Doodson, derivadas de los mismos polinomios que los
 * argumentos: no hay una segunda tabla de velocidades que pueda desincronizarse.
 */
export const MEAN_ANGULAR_SPEEDS: MeanAngularSpeeds = {
  tau:
    15 +
    linearRate(MEAN_SOLAR_LONGITUDE) / HOURS_PER_JULIAN_CENTURY -
    linearRate(MEAN_LUNAR_LONGITUDE) / HOURS_PER_JULIAN_CENTURY,
  s: linearRate(MEAN_LUNAR_LONGITUDE) / HOURS_PER_JULIAN_CENTURY,
  h: linearRate(MEAN_SOLAR_LONGITUDE) / HOURS_PER_JULIAN_CENTURY,
  p: linearRate(MEAN_LUNAR_PERIGEE) / HOURS_PER_JULIAN_CENTURY,
  nPrime: -linearRate(MEAN_LUNAR_NODE) / HOURS_PER_JULIAN_CENTURY,
  p1: linearRate(MEAN_SOLAR_PERIGEE) / HOURS_PER_JULIAN_CENTURY,
};
