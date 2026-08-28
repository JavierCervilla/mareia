/**
 * Gráfico de altura de marea: de los extremos del día al `path` de un SVG.
 *
 * Se genera **en build** (la página de puerto es estática y no carga JavaScript de cliente), así
 * que aquí no hay ni DOM ni estado: entra la lista de extremos del día y sale la geometría lista
 * para escupir dentro de un `<svg>`.
 *
 * Interpolación: media coseno entre cada par de extremos consecutivos, que es la aproximación
 * clásica de la curva de marea semidiurna (equivalente a la «regla de los doceavos», pero continua).
 * Pasa exactamente por cada extremo, es monótona entre ellos y nunca se sale de su rango — las tres
 * propiedades están cubiertas por `grafico-marea.test.ts`.
 */

const MINUTOS_DIA = 1440;

export interface ExtremoAltura {
  /** Hora local del extremo, `HH:MM` en 24 h. */
  readonly hora: string;
  /** Altura sobre el cero del puerto, en metros. */
  readonly alturaM: number;
}

export interface PuntoCurva {
  readonly x: number;
  readonly y: number;
}

export interface CurvaMarea {
  /** Dimensiones del `viewBox`; el SVG escala con `max-width: 100%`. */
  readonly ancho: number;
  readonly alto: number;
  /** Atributo `d` del trazo de la marea. */
  readonly path: string;
  /** Ordenada del nivel medio del día (la línea discontinua de referencia). */
  readonly nivelMedioY: number;
  /** Un punto por extremo de entrada y en su mismo orden, para marcarlos con un círculo. */
  readonly extremos: readonly PuntoCurva[];
}

export interface OpcionesCurva {
  readonly ancho?: number;
  readonly alto?: number;
  /** Aire vertical entre el extremo más alto/bajo y el borde del lienzo. */
  readonly margenY?: number;
  /** Resolución del muestreo. 10 min ≈ 145 puntos: curva suave sin inflar el HTML. */
  readonly pasoMinutos?: number;
}

interface Nodo {
  readonly minutos: number;
  readonly alturaM: number;
}

/** Convierte una hora local `HH:MM` (24 h) en minutos transcurridos desde medianoche. */
export function minutosDesdeHora(hora: string): number {
  const partes = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora);
  if (!partes) {
    throw new Error(`Hora inválida: "${hora}". Se espera HH:MM en formato de 24 horas.`);
  }
  const [, horas = "0", minutos = "0"] = partes;
  return Number(horas) * 60 + Number(minutos);
}

/**
 * Añade un extremo virtual a cada lado para que la curva llegue a medianoche por los dos bordes:
 * la marea no empieza ni acaba en el primer y último extremo del día. Cada extremo virtual refleja
 * la separación y la altura de su vecino, de modo que la alternancia pleamar/bajamar se mantiene.
 */
function nodosDelDia(extremos: readonly ExtremoAltura[]): readonly Nodo[] {
  const nodos = extremos.map((extremo) => ({
    minutos: minutosDesdeHora(extremo.hora),
    alturaM: extremo.alturaM,
  }));
  const primero = nodos[0];
  const segundo = nodos[1];
  const ultimo = nodos.at(-1);
  const penultimo = nodos.at(-2);
  if (!primero || !segundo || !ultimo || !penultimo) {
    throw new Error("La curva de marea necesita al menos dos extremos del día.");
  }

  return [
    { minutos: primero.minutos - (segundo.minutos - primero.minutos), alturaM: segundo.alturaM },
    ...nodos,
    { minutos: ultimo.minutos + (ultimo.minutos - penultimo.minutos), alturaM: penultimo.alturaM },
  ];
}

/** Media coseno entre dos extremos consecutivos. `fraccion` recorre 0 → 1 de `desde` a `hasta`. */
function interpolar(desde: number, hasta: number, fraccion: number): number {
  return (desde + hasta) / 2 + ((desde - hasta) / 2) * Math.cos(Math.PI * fraccion);
}

/** Altura de la marea, en metros, en un minuto cualquiera del día. */
export function alturaEnMinutos(extremos: readonly ExtremoAltura[], minutos: number): number {
  const nodos = nodosDelDia(extremos);
  const primero = nodos[0];
  const ultimo = nodos.at(-1);
  if (!primero || !ultimo) {
    throw new Error("La curva de marea necesita al menos dos extremos del día.");
  }
  // Fuera del tramo cubierto por los extremos virtuales la curva se aplana en vez de dispararse:
  // red de seguridad para días con extremos muy juntos, no el caso normal.
  const instante = Math.min(Math.max(minutos, primero.minutos), ultimo.minutos);

  for (let indice = 1; indice < nodos.length; indice += 1) {
    const anterior = nodos[indice - 1];
    const siguiente = nodos[indice];
    if (!anterior || !siguiente || instante > siguiente.minutos) continue;
    const tramo = siguiente.minutos - anterior.minutos;
    const fraccion = tramo === 0 ? 0 : (instante - anterior.minutos) / tramo;
    return interpolar(anterior.alturaM, siguiente.alturaM, fraccion);
  }
  return ultimo.alturaM;
}

function redondear(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/** Traza la curva de las 24 horas y devuelve la geometría lista para el `<svg>`. */
export function trazarCurvaMarea(
  extremos: readonly ExtremoAltura[],
  opciones: OpcionesCurva = {},
): CurvaMarea {
  const { ancho = 620, alto = 220, margenY = 45, pasoMinutos = 10 } = opciones;
  const nodos = nodosDelDia(extremos);

  const alturas = nodos.map((nodo) => nodo.alturaM);
  const minima = Math.min(...alturas);
  const maxima = Math.max(...alturas);
  const recorrido = maxima - minima;

  const x = (minutos: number): number => redondear((minutos / MINUTOS_DIA) * ancho);
  const y = (altura: number): number => {
    const util = alto - 2 * margenY;
    const proporcion = recorrido === 0 ? 0.5 : (altura - minima) / recorrido;
    return redondear(alto - margenY - proporcion * util);
  };

  const muestras: string[] = [];
  for (let minuto = 0; minuto <= MINUTOS_DIA; minuto += pasoMinutos) {
    muestras.push(`${x(minuto)},${y(alturaEnMinutos(extremos, minuto))}`);
  }
  const cierre = `${x(MINUTOS_DIA)},${y(alturaEnMinutos(extremos, MINUTOS_DIA))}`;
  if (muestras.at(-1) !== cierre) muestras.push(cierre);

  return {
    ancho,
    alto,
    path: `M${muestras.join("L")}`,
    nivelMedioY: y((minima + maxima) / 2),
    extremos: extremos.map((extremo) => ({
      x: x(minutosDesdeHora(extremo.hora)),
      y: y(extremo.alturaM),
    })),
  };
}
