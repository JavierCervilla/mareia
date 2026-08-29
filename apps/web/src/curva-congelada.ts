/**
 * EL DETECTOR DE CURVA CONGELADA — el instrumento del gate A-1, en un único cuerpo.
 *
 * Responde a una sola pregunta sobre la curva que la página publica: **¿en qué tramos se queda
 * quieta mientras la marea real se mueve más de lo que la publicación puede enseñar?** El umbral no
 * se elige: es el paso de publicación (`toHeight` redondea a 3 decimales).
 *
 * Está en un módulo propio, y no copiado dentro de cada fichero de test, por el hallazgo que lo
 * obligó. El gate A-1 vive en `adversario-t09.test.ts` y el ataque A-17 de `adversario-t13.test.ts`
 * mide **lo que ese gate alcanza a ver** sobre una curva falsificada a propósito. Mientras A-17
 * midió con una copia local del instrumento, no medía el gate: medía su copia. Estrechar el
 * detector real a una sola meseta —el defecto exacto que A-17 dice vigilar— dejaba el ataque en
 * verde, con sus 65 puertos ciegos otra vez, y el trinquete no trinqueteaba. Con un único cuerpo el
 * gate y su ataque ya no pueden separarse: cualquier estrechamiento de este fichero se ve desde los
 * dos lados.
 *
 * Sólo lo importan los ficheros de test: ninguna página lo usa y no entra en el bundle del sitio.
 */
import type { PreparedStation } from "@mareia/domain-core";
import { heightAt } from "@mareia/domain-core";

import { alturaEn } from "./grafico-marea.ts";
import type { MuestraCurva } from "./grafico-marea.ts";

const MINUTO = 60_000;

/**
 * Paso de publicación de las alturas, en metros: `toHeight` redondea a 3 decimales. Dos muestras
 * que difieran menos que esto se publican iguales, y ninguna curva puede enseñar un movimiento más
 * pequeño por mucho que la marea se mueva.
 */
export const PASO_DE_PUBLICACION_M = 0.001;

/** Lo que el detector necesita de un día: la curva muestreada y los límites del día publicado. */
export interface CurvaDelDia {
  readonly muestras: readonly MuestraCurva[];
  readonly inicioUtcMs: number;
  readonly finUtcMs: number;
}

export interface TramoPlano {
  readonly minutos: number;
  readonly desdeUtcMs: number;
  readonly hastaUtcMs: number;
}

/** Un tramo plano que además esconde marea: el tramo y los metros que se tragó. */
export interface Congelacion {
  readonly tramo: TramoPlano;
  /** Marea real, en metros, que se movió mientras la curva estaba quieta. */
  readonly movimientoM: number;
}

/**
 * **Todos** los tramos del día en los que la curva **publicada** no se mueve nada.
 *
 * Devuelve la lista entera y no sólo el máximo porque el día tiene muchas mesetas y el instrumento
 * sólo sabe medir una cada vez: ver el porqué en la cabecera de A-1. Los tramos son maximales y
 * **disjuntos** —cada minuto pertenece como mucho a uno—, así que recorrerlos todos no multiplica
 * el número de alturas reales que hay que calcular: son las mismas muestras del día repartidas.
 */
export function tramosPlanos(dia: CurvaDelDia): readonly TramoPlano[] {
  const tramos: TramoPlano[] = [];
  let inicio = dia.inicioUtcMs;
  let ultimoIgual: number | undefined;
  const cerrar = (): void => {
    if (ultimoIgual === undefined) return;
    tramos.push({
      minutos: (ultimoIgual - inicio) / MINUTO,
      desdeUtcMs: inicio,
      hastaUtcMs: ultimoIgual,
    });
    ultimoIgual = undefined;
  };
  for (let instante = dia.inicioUtcMs + MINUTO; instante <= dia.finUtcMs; instante += MINUTO) {
    const anterior = alturaEn(dia.muestras, instante - MINUTO);
    if (Math.abs(alturaEn(dia.muestras, instante) - anterior) > 1e-9) {
      cerrar();
      inicio = instante;
      continue;
    }
    ultimoIgual = instante;
  }
  cerrar();
  return tramos;
}

/**
 * El tramo plano más largo del día: la **meseta natural** del puerto.
 *
 * El detector ya no la usa —mira todas—, pero hace falta para *nombrar* una meseta concreta: la que
 * A-1 bis acaba de inyectar, y la que en A-17 hace de escondite.
 */
export function tramoPlanoMasLargo(dia: CurvaDelDia): TramoPlano {
  const vacio: TramoPlano = { minutos: 0, desdeUtcMs: dia.inicioUtcMs, hastaUtcMs: dia.inicioUtcMs };
  return tramosPlanos(dia).reduce((mejor, tramo) => (tramo.minutos > mejor.minutos ? tramo : mejor), vacio);
}

/**
 * Cuánto se movió la marea **de verdad** mientras la curva publicada estaba quieta, medido en los
 * instantes de muestreo que caen dentro del tramo plano (los dos extremos incluidos).
 *
 * Es una función exportada aparte y no un trozo del detector porque A-1 bis la llama con una curva
 * congelada a mano: un gate que nadie ha visto fallar es una conjetura.
 */
export function excursionRealEnLaMeseta(
  muestras: readonly MuestraCurva[],
  estacion: PreparedStation,
  plano: { readonly desdeUtcMs: number; readonly hastaUtcMs: number },
): number {
  const alturas = muestras
    .filter((muestra) => muestra.timeUtcMs >= plano.desdeUtcMs && muestra.timeUtcMs <= plano.hastaUtcMs)
    .map((muestra) => heightAt(estacion, muestra.timeUtcMs));
  return alturas.length === 0 ? 0 : Math.max(...alturas) - Math.min(...alturas);
}

/**
 * **El detector**: los tramos del día en los que la curva publicada se queda quieta mientras la
 * marea real se mueve más que el paso de publicación.
 *
 * Lista vacía = la curva del día no esconde nada. Es lo que afirma el gate A-1 sobre el catálogo
 * entero, y lo que el ataque A-17 exige que no esté vacía cuando la curva se ha falsificado.
 */
export function congelacionesDeLaCurva(
  dia: CurvaDelDia,
  estacion: PreparedStation,
): readonly Congelacion[] {
  const congelaciones: Congelacion[] = [];
  for (const tramo of tramosPlanos(dia)) {
    const movimientoM = excursionRealEnLaMeseta(dia.muestras, estacion, tramo);
    if (movimientoM > PASO_DE_PUBLICACION_M) congelaciones.push({ tramo, movimientoM });
  }
  return congelaciones;
}
