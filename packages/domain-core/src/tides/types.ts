/**
 * Tipos del dominio de mareas. El motor es puro: el tiempo entra y sale siempre como
 * milisegundos UTC desde el epoch Unix, nunca como fecha local ni como `Date` del entorno.
 */

/** Instante en milisegundos UTC desde el epoch Unix (1970-01-01T00:00:00Z). */
export type EpochMs = number;

/**
 * Constante armónica de una estación para un constituyente.
 *
 * `phase_deg` es el retardo de fase de Greenwich κ (el «phase lag» G que publican NOAA CO-OPS o
 * el IHM): la fase con la que entra en h(t) = Σ f·A·cos(V + u − κ), referida a UTC.
 */
export interface StationConstituent {
  readonly name: string;
  readonly amplitude_m: number;
  readonly phase_deg: number;
}

/** Estación de marea en el schema canónico `station/v1`. */
export interface TideStation {
  readonly schema: "station/v1";
  readonly id: string;
  readonly name: string;
  readonly datum: TideDatum;
  readonly constituents: readonly StationConstituent[];
}

/**
 * Referencia vertical de las alturas predichas. `msl_offset_m` es Z0: la altura del nivel medio
 * del mar sobre el cero de la estación, que se suma a la serie armónica.
 */
export interface TideDatum {
  readonly msl_offset_m: number;
}

/** Altura predicha en un instante. */
export interface TideSample {
  readonly timeUtcMs: EpochMs;
  readonly height_m: number;
}

export type TideExtremeKind = "high" | "low";

/** Pleamar (`high`) o bajamar (`low`). */
export interface TideExtreme extends TideSample {
  readonly kind: TideExtremeKind;
}

/** El motor no sabe predecir un constituyente que no está en su tabla. */
export class UnsupportedConstituentError extends Error {
  readonly names: readonly string[];

  constructor(names: readonly string[]) {
    super(`Constituyentes no soportados: ${names.join(", ")}`);
    this.name = "UnsupportedConstituentError";
    this.names = names;
  }
}
