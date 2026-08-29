/**
 * De los periodos solunares que calcula el dominio a lo que se puede leer en una página.
 *
 * Aquí **no se calcula nada** de astronomía: los periodos y el rating llegan ya resueltos por
 * `solunarDay` (T-03) a través del caso de uso `getSolunar`. Este archivo decide cómo se nombran,
 * cómo se agrupan y qué se cuenta de cada uno — y nada más. Si algún día hay que discutir un
 * número, se discute en `domain-core/src/solunar/`, no aquí.
 *
 * **El formato entra inyectado** (`FormatoDeActividad`). El módulo no sabe en qué zona horaria vive
 * el puerto ni con qué separador decimal se escribe: eso es del borde (la web lo resuelve con su
 * `formato.ts`, que es el mismo que usan la tabla de mareas y el gráfico). Así este package se
 * testea con un formateador de mentira, sin `Intl` y sin zona horaria de por medio.
 *
 * Las constantes de la fórmula (`MOON_SCORE_MAX`, `SOLAR_BONUS_PER_PERIOD`…) se **importan del
 * dominio**: el desglose que lee el usuario tiene que envejecer con la fórmula, no a su lado.
 */

import {
  MOON_SCORE_MAX,
  MOON_SCORE_MIN,
  QUARTER_DAYS,
  SOLAR_BONUS_MAX,
  SOLAR_BONUS_PER_PERIOD,
  SYZYGY_PLATEAU_DAYS,
} from "@mareia/domain-core";

/** `major` = ventana del tránsito lunar; `minor` = ventana del orto o el ocaso de la Luna. */
export type TipoDePeriodo = "major" | "minor";

/** El fenómeno lunar que ancla la ventana. */
export type AnclaDePeriodo = "upper-transit" | "lower-transit" | "moonrise" | "moonset";

/**
 * Un periodo solunar visto por el módulo: **más estrecho** que el `SolunarPeriodDto` del caso de
 * uso a propósito (aquí no hacen falta los ISO, solo los instantes), de modo que el DTO encaja sin
 * adaptador y este package no depende de `@mareia/usecases`.
 */
export interface PeriodoSolunar {
  readonly kind: TipoDePeriodo;
  readonly anchor: AnclaDePeriodo;
  readonly startUtcMs: number;
  readonly peakUtcMs: number;
  readonly endUtcMs: number;
  /** Si la ventana cae sobre el orto o el ocaso del Sol (±30 min): es lo que da el bonus. */
  readonly overlapsSolarEvent: boolean;
}

/** El rating del día con su desglose, tal y como lo publica el dominio. */
export interface RatingSolunar {
  readonly score: number;
  readonly label: string;
  readonly moonScore: number;
  readonly solarBonus: number;
  readonly daysFromSyzygy: number;
  readonly solarOverlapCount: number;
}

/** Los límites UTC del día civil del puerto (23, 24 o 25 h: el del cambio de hora no dura 24). */
export interface DiaCivil {
  readonly inicioUtcMs: number;
  readonly finUtcMs: number;
}

/** Cómo escribe horas y números la superficie que renderiza (la web inyecta su `formato.ts`). */
export interface FormatoDeActividad {
  /** Una hora `HH:MM` ya proyectada a la zona del puerto. */
  readonly hora: (timeUtcMs: number) => string;
  /** Un número con la coma decimal del castellano. */
  readonly numero: (valor: number, decimales?: number) => string;
}

/** Cuánto pesa cada banda en el gráfico: los mayores mandan sobre los menores. */
export type EnfasisDeVentana = "fuerte" | "suave";

/**
 * Una ventana para pintar sobre el gráfico de marea. Es deliberadamente pobre —cuándo empieza,
 * cuándo acaba, cuánto pesa y cómo se llama—: el gráfico del core no debe saber qué es un periodo
 * solunar, solo que hay un tramo del día que se sombrea.
 */
export interface VentanaDeActividad {
  readonly id: string;
  readonly inicioUtcMs: number;
  readonly finUtcMs: number;
  readonly enfasis: EnfasisDeVentana;
  /** Texto para lectores de pantalla; el gráfico lo enhebra en su `aria-label`. */
  readonly etiqueta: string;
  /**
   * Nombre corto de la CLASE de ventana —«periodo mayor»—, sin horas, para la leyenda **visible**
   * del gráfico. Existe desde el hallazgo A-15 del pase adversario: el `aria-label` enumeraba las
   * cuatro franjas con sus horas y el pie que ve quien mira el gráfico no decía qué eran esas
   * manchas. La leyenda no repite las horas —eso ya lo hacen el `aria-label` y la tabla— sino que
   * dice qué representa cada trama, que es lo que un pie de figura tiene que decir.
   */
  readonly leyenda: string;
}

/** Una fila de la tabla de periodos del día. */
export interface FilaDeActividad {
  readonly id: string;
  readonly tipo: string;
  readonly ancla: string;
  /** «de 07:10 a 09:10», con la coletilla del día vecino si la ventana desborda la medianoche. */
  readonly franja: string;
  /** Hora del fenómeno: el centro exacto de la ventana. */
  readonly pico: string;
  /** Si suma bonus por caer sobre el orto o el ocaso del Sol. */
  readonly coincideConElSol: boolean;
}

/** Un sumando del rating, con su explicación. */
export interface FactorDelRating {
  readonly concepto: string;
  readonly puntos: number;
  readonly detalle: string;
}

/** El rating abierto en canal: sus dos sumandos, el total sin redondear y el número publicado. */
export interface DesgloseDelRating {
  readonly factores: readonly [FactorDelRating, FactorDelRating];
  readonly totalSinRedondear: number;
  readonly score: number;
  readonly etiqueta: string;
}

const NOMBRE_TIPO: Readonly<Record<TipoDePeriodo, string>> = {
  major: "mayor",
  minor: "menor",
};

/**
 * El fenómeno de cada ancla, en castellano llano. «Tránsito inferior» es exacto y no lo entiende
 * nadie que no navegue: se escribe lo que pasa (la Luna, debajo del horizonte, en su punto más
 * alejado) porque la ventana cuenta igual con la Luna invisible.
 */
const NOMBRE_ANCLA: Readonly<Record<AnclaDePeriodo, string>> = {
  "upper-transit": "la Luna en lo más alto de su recorrido",
  "lower-transit": "la Luna en lo más bajo, bajo el horizonte",
  moonrise: "salida de la Luna",
  moonset: "puesta de la Luna",
};

/** Cómo se escribe cada etiqueta del rating cuando se lee en la página. */
const NOMBRE_ETIQUETA: Readonly<Record<string, string>> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  "muy-alta": "Muy alta",
};

/**
 * La etiqueta del rating tal y como se escribe. Una etiqueta desconocida se devuelve **cruda** en
 * vez de traducirse a «Desconocida»: si el dominio añade un quinto tramo, que se vea su nombre en
 * la página, no un hueco inventado.
 */
export function nombreDeEtiqueta(label: string): string {
  return NOMBRE_ETIQUETA[label] ?? label;
}

/** Identificador estable de un periodo dentro de su día: cada ancla ocurre como mucho una vez. */
export function idDePeriodo(periodo: PeriodoSolunar): string {
  return `solunar-${periodo.anchor}`;
}

/**
 * La franja horaria de una ventana, diciendo cuándo se sale del día.
 *
 * Un periodo pertenece al día en el que cae su **fenómeno**, así que su ventana puede empezar antes
 * de medianoche o acabar después (hasta una hora por cada lado). Escribir «de 23:10 a 00:40» sin
 * más convierte esa ventana en un viaje al pasado; con la coletilla se lee lo que es.
 */
export function franjaDePeriodo(
  periodo: PeriodoSolunar,
  dia: DiaCivil,
  formato: FormatoDeActividad,
): string {
  const desde = formato.hora(periodo.startUtcMs);
  const hasta = formato.hora(periodo.endUtcMs);
  const antes = periodo.startUtcMs < dia.inicioUtcMs ? " del día anterior" : "";
  const despues = periodo.endUtcMs > dia.finUtcMs ? " del día siguiente" : "";
  return `de ${desde}${antes} a ${hasta}${despues}`;
}

/** Las filas de la tabla de periodos, en el orden en que llegan (cronológico). */
export function filasDeActividad(
  periodos: readonly PeriodoSolunar[],
  dia: DiaCivil,
  formato: FormatoDeActividad,
): readonly FilaDeActividad[] {
  return periodos.map((periodo) => ({
    id: idDePeriodo(periodo),
    tipo: NOMBRE_TIPO[periodo.kind],
    ancla: NOMBRE_ANCLA[periodo.anchor],
    franja: franjaDePeriodo(periodo, dia, formato),
    pico: formato.hora(periodo.peakUtcMs),
    coincideConElSol: periodo.overlapsSolarEvent,
  }));
}

/**
 * Las ventanas que el gráfico de marea sombrea. Se emiten **completas**, con sus instantes reales:
 * recortarlas al día es geometría del lienzo y la hace el gráfico (`trazarCurvaMarea`), que es
 * quien sabe dónde está el borde. Aquí recortarlas sería mentir en la etiqueta, que es texto y se
 * lee.
 */
export function ventanasDeActividad(
  periodos: readonly PeriodoSolunar[],
  dia: DiaCivil,
  formato: FormatoDeActividad,
): readonly VentanaDeActividad[] {
  return periodos.map((periodo) => ({
    id: idDePeriodo(periodo),
    inicioUtcMs: periodo.startUtcMs,
    finUtcMs: periodo.endUtcMs,
    enfasis: periodo.kind === "major" ? "fuerte" : "suave",
    etiqueta: `periodo ${NOMBRE_TIPO[periodo.kind]} ${franjaDePeriodo(periodo, dia, formato)}`,
    leyenda: `periodo ${NOMBRE_TIPO[periodo.kind]}`,
  }));
}

/** «Ningún periodo cae» / «1 periodo cae» / «2 periodos caen»: el recuento, bien escrito. */
function recuentoDeCoincidencias(cuantos: number): string {
  if (cuantos === 0) {
    return "Ningún periodo del día cae";
  }
  return cuantos === 1 ? "1 periodo del día cae" : `${cuantos} periodos del día caen`;
}

/**
 * El desglose del rating: los dos sumandos con su explicación, el total sin redondear y el número
 * que se publica.
 *
 * `totalSinRedondear` se enseña porque **no siempre coincide** con `score`: 62,4 + 20 son 82,4 y se
 * publica 82. Enseñar solo el entero obligaría a creerse la suma; enseñando los dos, el lector la
 * hace. Y el redondeo se explica al lado (`NOTA_DE_REDONDEO`), que es donde vive la regla de que
 * 100 y 0 no se alcanzan redondeando.
 */
export function desgloseDelRating(
  rating: RatingSolunar,
  formato: FormatoDeActividad,
): DesgloseDelRating {
  return {
    factores: [
      {
        concepto: "Fase lunar",
        puntos: rating.moonScore,
        detalle:
          `A ${formato.numero(rating.daysFromSyzygy, 1)} días de la sicigia más próxima (luna ` +
          `nueva o llena), cuando coinciden las mareas vivas y la iluminación. El máximo, ` +
          `${MOON_SCORE_MAX}, se mantiene hasta ±${SYZYGY_PLATEAU_DAYS} días; de ahí baja en línea ` +
          `recta hasta ${MOON_SCORE_MIN} en el cuarto, a ${formato.numero(QUARTER_DAYS, 1)} días.`,
      },
      {
        concepto: "Coincidencia con el orto o el ocaso del Sol",
        puntos: rating.solarBonus,
        detalle:
          `${recuentoDeCoincidencias(rating.solarOverlapCount)} sobre la salida o la puesta del ` +
          `Sol (±30 min): ${SOLAR_BONUS_PER_PERIOD} puntos cada uno, con tope en ` +
          `${SOLAR_BONUS_MAX}.`,
      },
    ],
    totalSinRedondear: rating.moonScore + rating.solarBonus,
    score: rating.score,
    etiqueta: nombreDeEtiqueta(rating.label),
  };
}
