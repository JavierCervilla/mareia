/**
 * Las observaciones del día: lo que sale del cálculo, con su procedencia pegada.
 *
 * **Qué NO hay aquí**: consejos. La superficie no se llama «Consejos» porque el tipo y los gates
 * impiden entregarlos — llamarla así sería prometer lo que no se puede cumplir (spec §4.4).
 */

export { REGLAS_DECLARADAS } from "./tipos.ts";
export type {
  FormatoDeObservaciones,
  MagnitudCalculada,
  Observacion,
  Procedencia,
  ReglaId,
  Unidad,
} from "./tipos.ts";

export type {
  ContextoDelDia,
  ExtremoDelDia,
  FaseLunar,
  MuestraDeCurva,
  PeriodoDelDia,
  ReglaDefinida,
  SolunarDelDia,
} from "./regla.ts";
export { EntradasIlegiblesError, ReglaSinMagnitudesError } from "./regla.ts";

export { REGLAS } from "./reglas.ts";

import type { FormatoDeObservaciones, Observacion, ReglaId } from "./tipos.ts";
import type { ContextoDelDia, ReglaDefinida } from "./regla.ts";
import { REGLAS } from "./reglas.ts";

/**
 * Las observaciones del día, en el orden en que se declaran las reglas.
 *
 * Devolver **cero** es un resultado legítimo: un día sin coincidencia solunar y sin franja baja
 * publica menos, y eso es información. Lo que impide que ese cero se convierta en la salida cómoda
 * es el **censo publicado**, que exige que las reglas estén declaradas y probadas aunque no disparen.
 */
export function observacionesDelDia(
  dia: ContextoDelDia,
  formato: FormatoDeObservaciones,
): readonly Observacion[] {
  const observaciones: Observacion[] = [];
  for (const regla of REGLAS) {
    const observacion = regla.observar(dia, formato);
    if (observacion !== null) observaciones.push(observacion);
  }
  return observaciones;
}

/** La regla con ese identificador, o `undefined`. Es por donde **T3** entra a recomputar. */
export function reglaPorId(id: string): ReglaDefinida | undefined {
  return REGLAS.find((regla) => regla.id === id);
}

/** Los identificadores que de verdad hay implementados, para contrastarlos con los declarados. */
export function reglasImplementadas(): readonly ReglaId[] {
  return REGLAS.map((regla) => regla.id);
}
