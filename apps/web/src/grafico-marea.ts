/**
 * Gráfico de altura de marea: de la curva del día a la geometría de un SVG.
 *
 * Se genera **en build** (la página de puerto es HTML estático, sin JavaScript de cliente), así que
 * aquí no hay ni DOM ni estado: entran los puntos que ya calculó el dominio y sale el `path`.
 *
 * La curva que se dibuja es **la curva predicha** (`sampleCurve` del motor armónico, vía el caso de
 * uso `getTides`), no una interpolación de los extremos: hasta T-05/T-07 la página no tenía más que
 * cuatro horas y cuatro alturas y había que reconstruir la forma con una media coseno; ahora hay
 * 145 alturas reales del día y aproximar sería dibujar peor teniendo el dato mejor.
 *
 * Los **extremos se insertan** en la serie muestreada antes de trazar. Con paso de 10 min, el
 * máximo de las muestras cae hasta 5 min antes o después de la pleamar y hasta un par de
 * centímetros por debajo: si no se insertaran, el círculo de la pleamar quedaría fuera del trazo
 * que marca (justo el fallo A-2 del pase adversario de la tranche 1, con otra causa).
 */

/** Un punto de la curva tal y como lo publica el caso de uso. */
export interface MuestraCurva {
  readonly timeUtcMs: number;
  readonly height_m: number;
}

/** Un extremo del día: la misma forma más su tipo. */
export interface ExtremoCurva extends MuestraCurva {
  readonly kind: "high" | "low";
}

export interface PuntoCurva {
  readonly x: number;
  readonly y: number;
}

/** Un extremo ya colocado en el lienzo, con el dato que representa. */
export interface MarcaExtremo extends PuntoCurva, ExtremoCurva {}

/** Una marca del eje horizontal: su posición y el instante que representa (la hora la pone quien pinta). */
export interface MarcaDeHora extends Pick<PuntoCurva, "x"> {
  readonly timeUtcMs: number;
}

export interface CurvaMarea {
  /** Dimensiones del `viewBox`; el SVG escala con `width: 100%`. */
  readonly ancho: number;
  readonly alto: number;
  /** Atributo `d` del trazo de la marea. */
  readonly path: string;
  /** Ordenada del punto medio entre la altura mínima y la máxima del día. */
  readonly nivelMedioY: number;
  /** Un punto por extremo, en orden cronológico. */
  readonly extremos: readonly MarcaExtremo[];
  /** Marcas del eje de horas, de la medianoche a la medianoche. */
  readonly horas: readonly MarcaDeHora[];
  readonly minima_m: number;
  readonly maxima_m: number;
}

export interface EntradaCurva {
  /** La curva muestreada del día, en orden cronológico estricto. */
  readonly muestras: readonly MuestraCurva[];
  /** Los extremos del día, en orden cronológico estricto. */
  readonly extremos: readonly ExtremoCurva[];
  /** Límites UTC del día civil del puerto (23, 24 o 25 h: el del cambio de hora no dura 24). */
  readonly inicioUtcMs: number;
  readonly finUtcMs: number;
}

export interface OpcionesCurva {
  readonly ancho?: number;
  readonly alto?: number;
  /** Aire vertical entre el extremo más alto/bajo y el borde del lienzo. */
  readonly margenY?: number;
  /** Cuántas marcas tiene el eje de horas, extremos incluidos. */
  readonly marcasDeHora?: number;
}

const ANCHO = 620;
const ALTO = 220;
const MARGEN_Y = 45;
const MARCAS_DE_HORA = 5;

/** Comprueba el orden estricto de una serie y falla nombrando el punto que lo rompe. */
function exigirOrdenEstricto(puntos: readonly MuestraCurva[], que: string): void {
  for (let indice = 1; indice < puntos.length; indice += 1) {
    const anterior = puntos[indice - 1];
    const actual = puntos[indice];
    if (anterior === undefined || actual === undefined) continue;
    if (actual.timeUtcMs <= anterior.timeUtcMs) {
      throw new Error(
        `${que}: los puntos deben venir en orden temporal estricto; ` +
          `${new Date(actual.timeUtcMs).toISOString()} no va después de ` +
          `${new Date(anterior.timeUtcMs).toISOString()}.`,
      );
    }
  }
}

/**
 * La serie que se dibuja: las muestras del día con los extremos insertados en su instante exacto.
 * Si un extremo coincide con una muestra (paso divisor de la hora del extremo), gana el extremo.
 */
function serieDeTrazado(entrada: EntradaCurva): readonly MuestraCurva[] {
  const porInstante = new Map<number, MuestraCurva>();
  for (const muestra of entrada.muestras) {
    porInstante.set(muestra.timeUtcMs, muestra);
  }
  for (const extremo of entrada.extremos) {
    porInstante.set(extremo.timeUtcMs, { timeUtcMs: extremo.timeUtcMs, height_m: extremo.height_m });
  }
  return [...porInstante.values()].sort((a, b) => a.timeUtcMs - b.timeUtcMs);
}

function redondear(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/**
 * Altura de la curva en un instante cualquiera, interpolando linealmente entre las dos muestras que
 * lo rodean. Fuera del rango muestreado devuelve el extremo más cercano: se aplana en vez de
 * dispararse, que es lo que hace un `Math.min`/`Math.max` honesto.
 */
export function alturaEn(muestras: readonly MuestraCurva[], timeUtcMs: number): number {
  const primera = muestras[0];
  const ultima = muestras.at(-1);
  if (primera === undefined || ultima === undefined) {
    throw new Error("La curva necesita al menos una muestra.");
  }
  if (timeUtcMs <= primera.timeUtcMs) return primera.height_m;
  if (timeUtcMs >= ultima.timeUtcMs) return ultima.height_m;

  for (let indice = 1; indice < muestras.length; indice += 1) {
    const anterior = muestras[indice - 1];
    const siguiente = muestras[indice];
    if (anterior === undefined || siguiente === undefined || timeUtcMs > siguiente.timeUtcMs) {
      continue;
    }
    const tramo = siguiente.timeUtcMs - anterior.timeUtcMs;
    const fraccion = tramo === 0 ? 0 : (timeUtcMs - anterior.timeUtcMs) / tramo;
    return anterior.height_m + fraccion * (siguiente.height_m - anterior.height_m);
  }
  return ultima.height_m;
}

/**
 * Traza la curva del día y devuelve la geometría lista para el `<svg>`.
 *
 * @throws {Error} si la ventana del día está invertida, si hay menos de dos muestras o si las
 * muestras o los extremos no vienen en orden temporal estricto. Falla ruidoso a propósito: una
 * curva trazada sobre puntos desordenados tiene aspecto normal y es falsa, y nada en la página lo
 * delataría.
 */
export function trazarCurvaMarea(
  entrada: EntradaCurva,
  opciones: OpcionesCurva = {},
): CurvaMarea {
  const {
    ancho = ANCHO,
    alto = ALTO,
    margenY = MARGEN_Y,
    marcasDeHora = MARCAS_DE_HORA,
  } = opciones;
  const { inicioUtcMs, finUtcMs } = entrada;

  if (!(finUtcMs > inicioUtcMs)) {
    throw new Error(
      `La ventana del día está invertida o es vacía: ${new Date(inicioUtcMs).toISOString()} → ` +
        `${new Date(finUtcMs).toISOString()}.`,
    );
  }
  if (entrada.muestras.length < 2) {
    throw new Error("La curva de marea necesita al menos dos muestras del día.");
  }
  exigirOrdenEstricto(entrada.muestras, "curva muestreada");
  exigirOrdenEstricto(entrada.extremos, "extremos del día");

  const serie = serieDeTrazado(entrada);
  const alturas = serie.map((punto) => punto.height_m);
  const minima = Math.min(...alturas);
  const maxima = Math.max(...alturas);
  const recorrido = maxima - minima;

  const x = (timeUtcMs: number): number =>
    redondear(((timeUtcMs - inicioUtcMs) / (finUtcMs - inicioUtcMs)) * ancho);
  const y = (altura: number): number => {
    const util = alto - 2 * margenY;
    const proporcion = recorrido === 0 ? 0.5 : (altura - minima) / recorrido;
    return redondear(alto - margenY - proporcion * util);
  };

  return {
    ancho,
    alto,
    path: `M${serie.map((punto) => `${x(punto.timeUtcMs)},${y(punto.height_m)}`).join("L")}`,
    nivelMedioY: y((minima + maxima) / 2),
    extremos: entrada.extremos.map((extremo) => ({
      ...extremo,
      x: x(extremo.timeUtcMs),
      y: y(extremo.height_m),
    })),
    horas: Array.from({ length: marcasDeHora }, (_, indice) => {
      const instante = inicioUtcMs + ((finUtcMs - inicioUtcMs) * indice) / (marcasDeHora - 1);
      return { x: x(instante), timeUtcMs: instante };
    }),
    minima_m: minima,
    maxima_m: maxima,
  };
}
