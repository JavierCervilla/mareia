/**
 * Tipos del coeficiente de marea. Como en `tides/`, el instante es siempre milisegundos UTC desde
 * el epoch Unix; la zona horaria solo aparece para recortar el día civil.
 */

import type { EpochMs } from "../tides/types.ts";

/**
 * Coeficiente de una pleamar concreta, con la evidencia con la que se calculó: quien lo lee puede
 * auditarlo sin recalcularlo. `value` es lo que se publica; `rawValue` es el número continuo antes
 * de redondear y recortar, que es lo que hace comparable un 119,6 con un 120.
 */
export interface TidalCoefficient {
  /** Instante de la pleamar a la que corresponde el coeficiente. */
  readonly highWaterUtcMs: EpochMs;
  /** Altura de esa pleamar sobre el cero de la estación, en metros. */
  readonly highWater_m: number;
  /** Semirrango de la marea: la mitad de la distancia a la media de las bajamares adyacentes. */
  readonly semiRange_m: number;
  /** Coeficiente publicable: entero en [20, 120]. */
  readonly value: number;
  /** El mismo cociente sin redondear ni recortar, en la misma escala. */
  readonly rawValue: number;
  /** Si el redondeo cayó fuera de [20, 120] y hubo que recortarlo. */
  readonly clamped: boolean;
}

/**
 * Los coeficientes de un día civil.
 *
 * El día lunar dura 24 h 50 min, así que un día civil tiene **dos** pleamares o **una**: no es un
 * fallo, es la aritmética, y es también lo que publican los almanaques franceses (los días de una
 * sola pleamar traen un solo coeficiente).
 */
export interface TidalCoefficientDay {
  readonly dateIso: string;
  readonly timeZone: string;
  /** Uno por pleamar del día civil, en orden cronológico. */
  readonly coefficients: readonly TidalCoefficient[];
  /** El de la pleamar anterior al mediodía local, si la hay. */
  readonly morning: TidalCoefficient | undefined;
  /** El de la primera pleamar a partir del mediodía local, si la hay. */
  readonly afternoon: TidalCoefficient | undefined;
}

/** Ajustes del cálculo. Los valores por defecto son los de la escala francesa sobre Brest. */
export interface TidalCoefficientOptions {
  /** Unidad de altura U, en metros. Por defecto `BREST_UNIT_HEIGHT_M`. */
  readonly unitHeight_m?: number;
  /** Zona IANA en la que se recorta el día civil. Por defecto `BREST_TIME_ZONE`. */
  readonly timeZone?: string;
}

/**
 * La estación no tiene ningún constituyente semidiurno, así que no tiene onda semidiurna de la que
 * salga un coeficiente. Falla ruidoso: un coeficiente calculado sobre una marea diurna sería un
 * número con unidades correctas y significado ninguno.
 */
export class NoSemidiurnalTideError extends Error {
  readonly stationId: string;

  constructor(stationId: string) {
    super(`La estación ${JSON.stringify(stationId)} no tiene constituyentes semidiurnos`);
    this.name = "NoSemidiurnalTideError";
    this.stationId = stationId;
  }
}
