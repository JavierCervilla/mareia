/**
 * El coeficiente de marea del día y del mes.
 *
 * El coeficiente **no describe al puerto**: describe la marea del día, y se mide siempre sobre la
 * predicción de Brest (escala francesa, U = 3,05 m — ver `packages/domain-core/src/coefficient`).
 * De ahí dos decisiones de esta capa:
 *
 * 1. **Se calcula una vez y se reparte entre las 12 páginas.** Lo único que cambia de un puerto a
 *    otro es la zona horaria con la que se recorta el día civil, así que la caché va por
 *    `(mes, zona)` y en la práctica se calculan dos meses: uno peninsular y uno canario.
 * 2. **El día civil es el DEL PUERTO, no el de Brest.** Quien lee la página en Las Palmas espera
 *    que «el coeficiente de hoy» sea el de su hoy. La cifra sigue siendo la de la marea de Brest;
 *    lo local es solo dónde se corta el día y dónde cae el mediodía que separa mañana de tarde.
 *
 * Todavía no hay caso de uso para esto: el API no publica coeficiente (el endpoint estaba a la
 * espera de que merjease T-04, ver ROADMAP). Cuando lo publique, esta lógica sube a
 * `packages/usecases` y la página se limita a llamarlo, igual que hace con mareas y astronomía.
 */

import { tidalCoefficientDay } from "@mareia/domain-core";
import type { TidalCoefficientDay } from "@mareia/domain-core";

import { cargarEstacionDeReferencia } from "./deps.ts";
import { diasDelMes, mesDe } from "./fecha-build.ts";

/**
 * Tramos de la escala francesa, tal y como los nombra el SHOM: `mortes-eaux` (< 40), marea media
 * (40–70), `vives-eaux` (70–95) y `grandes vives-eaux` (≥ 95). Los límites son convención de la
 * escala, no un umbral que nos hayamos inventado para colorear.
 */
const TRAMOS: readonly (readonly [number, string])[] = [
  [95, "marea viva excepcional"],
  [70, "marea viva"],
  [40, "marea media"],
  [0, "marea muerta"],
];

/** Cómo se llama un coeficiente en castellano. */
export function etiquetaDeCoeficiente(valor: number): string {
  return TRAMOS.find(([minimo]) => valor >= minimo)?.[1] ?? "marea media";
}

const porMes = new Map<string, Promise<readonly TidalCoefficientDay[]>>();

async function calcularMes(
  fechaIso: string,
  timeZone: string,
): Promise<readonly TidalCoefficientDay[]> {
  const brest = await cargarEstacionDeReferencia();
  return diasDelMes(fechaIso).map((dateIso) => tidalCoefficientDay(brest, dateIso, { timeZone }));
}

/** Los coeficientes de todos los días del mes al que pertenece `fechaIso`, en orden. */
export function coeficientesDelMes(
  fechaIso: string,
  timeZone: string,
): Promise<readonly TidalCoefficientDay[]> {
  const clave = `${mesDe(fechaIso).primero}|${timeZone}`;
  const cacheado = porMes.get(clave);
  if (cacheado !== undefined) {
    return cacheado;
  }
  const pendiente = calcularMes(fechaIso, timeZone);
  porMes.set(clave, pendiente);
  return pendiente;
}

/**
 * El coeficiente representativo de un día: el mayor de sus pleamares.
 *
 * Un día civil tiene dos coeficientes (o uno: el día lunar dura 24 h 50 min). Los almanaques
 * publican los dos, y esta página también —en la tabla mensual—, pero la cifra grande de la
 * cabecera tiene que ser una sola: se elige la mayor porque es la que marca hasta dónde llega la
 * marea del día, que es para lo que se mira el coeficiente.
 */
export function coeficienteRepresentativo(dia: TidalCoefficientDay): number | undefined {
  const valores = dia.coefficients.map((coeficiente) => coeficiente.value);
  return valores.length === 0 ? undefined : Math.max(...valores);
}
