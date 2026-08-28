/**
 * Todo lo que la página de un puerto necesita saber, calculado **en build** con los mismos casos de
 * uso que sirve el API (`getTides`, `getAstro`, `getPort`): la web no tiene su propia versión de la
 * marea, tiene la misma.
 *
 * Este módulo es el único sitio de `apps/web` que habla con `@mareia/usecases`. Las páginas reciben
 * un objeto ya resuelto y se dedican a pintarlo; así el `.astro` no mezcla obtención de datos con
 * marcado, y este fichero se puede testear sin construir el sitio.
 */

import { civilDateOf } from "@mareia/domain-core";
import type { TidalCoefficientDay } from "@mareia/domain-core";
import { getAstro, getPort, getTides } from "@mareia/usecases";
import type { GetAstroResult, PortDto, StationDto, TideEventDto, TideSampleDto } from "@mareia/usecases";

import { coeficientesDelMes } from "./coeficiente.ts";
import { deps } from "./deps.ts";
import { mesDe } from "./fecha-build.ts";

/**
 * Paso de la curva del día, en minutos. 10 min = 145 puntos: suficiente para que el trazo se vea
 * continuo a 620 px de ancho y no tan fino como para inflar el HTML de las 12 páginas.
 */
const PASO_CURVA_MIN = 10;

/**
 * Paso de la consulta mensual. De la tabla del mes solo se usan los EXTREMOS, pero `getTides`
 * devuelve siempre curva: se pide el paso más grueso que admite (60 min) para no muestrear un mes
 * entero a 10 min y tirarlo.
 */
const PASO_MES_MIN = 60;

/**
 * Carrera de marea, en metros, por debajo de la cual «la marea es de centímetros» describe el
 * puerto y no lo calumnia.
 *
 * Se mide sobre los extremos del **mes** que la página publica, que es el ciclo completo de vivas y
 * muertas: la carrera de un día suelto depende de en qué punto del ciclo caiga. En el catálogo
 * piloto separa con holgura los tres puertos micromareales de verdad (Cabo de Palos, La Manga y
 * Palma: 0,15-0,27 m, medido mes a mes en 2026 y 2027) del siguiente (Málaga, 0,59-0,70 m) y de los
 * mareales atlánticos (2,0-4,6 m). Ningún puerto del catálogo cruza el umbral en ninguno de esos 24
 * meses: la clasificación no depende del mes que toque construir. Antes el aviso lo disparaba el grade del QC, y eso le colgó a Cádiz
 * —2,90 m de carrera— el cartel de micromareal (hallazgo A-8 del pase adversario de T-09).
 */
export const CARRERA_MICROMAREAL_M = 0.4;

/** Un día de la tabla mensual: sus extremos y sus coeficientes. */
export interface DiaDelMes {
  readonly dateIso: string;
  readonly eventos: readonly TideEventDto[];
  readonly coeficientes: readonly number[];
}

export interface DatosDePuerto {
  readonly port: PortDto;
  readonly station: StationDto;
  /** Día civil que publica la página (el `BUILD_DATE`). */
  readonly fechaIso: string;
  readonly dia: {
    readonly inicioUtcMs: number;
    readonly finUtcMs: number;
    readonly eventos: readonly TideEventDto[];
    readonly muestras: readonly TideSampleDto[];
  };
  readonly mes: {
    readonly primero: string;
    readonly ultimo: string;
    readonly dias: readonly DiaDelMes[];
  };
  readonly coeficiente: TidalCoefficientDay;
  readonly astro: GetAstroResult;
  /** Carrera de marea del mes publicado: de la bajamar más baja a la pleamar más alta, en metros. */
  readonly carreraMensualM: number;
  /**
   * Puerto **micromareal**: la carrera del mes no llega a `CARRERA_MICROMAREAL_M`. Ahí el nivel del
   * agua lo decide sobre todo el residuo meteorológico (presión y viento), y la página lo dice con
   * un aviso destacado en vez de publicar una tabla con pinta de exacta.
   *
   * Se mide sobre la marea, no sobre el grade del QC: `grade C` significa muchas cosas y una de
   * ellas —Cádiz, sin observación con la que validar— no tiene nada que ver con la carrera.
   */
  readonly micromareal: boolean;
  /**
   * Estación **sin observación**: el QC no tuvo mareógrafo con el que contrastar la predicción
   * (`rmse_m: null`), así que no hay error medido que publicar. No es un defecto de la marea del
   * puerto —Cádiz sube y baja casi tres metros—, es un hueco de nuestra validación, y la página lo
   * dice con esas palabras en vez de confundirlo con el caso micromareal.
   */
  readonly sinObservacion: boolean;
}

/** Agrupa los extremos de un rango por día civil del puerto. */
function porDiaCivil(
  eventos: readonly TideEventDto[],
  timezone: string,
): ReadonlyMap<string, readonly TideEventDto[]> {
  const dias = new Map<string, TideEventDto[]>();
  for (const evento of eventos) {
    const dateIso = civilDateOf(evento.timeUtcMs, timezone);
    const grupo = dias.get(dateIso);
    if (grupo === undefined) {
      dias.set(dateIso, [evento]);
    } else {
      grupo.push(evento);
    }
  }
  return dias;
}

/**
 * Carrera de marea de una tanda de extremos: de la más baja a la más alta.
 *
 * Sin extremos no hay carrera que medir y devuelve 0, que es lo que la deja fuera del aviso: un
 * aviso sobre una carrera desconocida sería exactamente el error que este cálculo viene a arreglar.
 */
/**
 * Carrera de marea de un conjunto de extremos: de la bajamar más baja a la pleamar más alta.
 *
 * Exportada por su test: es la que decide si un puerto lleva el aviso de «marea de centímetros», y
 * el caso que importa —quedarse sin extremos— no lo produce ningún puerto del catálogo piloto.
 */
export function carreraDe(eventos: readonly TideEventDto[], mes: string, slug: string): number {
  if (eventos.length === 0) {
    // Un mes sin un solo extremo no es «marea nula»: es un dataset roto. Devolver 0 apagaba el
    // aviso de micromareal en silencio —justo el peor sitio para fallar callado—, y con 200-300
    // puertos en T-13 eso pasa de imposible a cuestión de tiempo. Que rompa el build.
    throw new Error(
      `El mes ${mes} de ${slug} no tiene ni un extremo de marea: el dataset de la estación está roto.`,
    );
  }
  const alturas = eventos.map((evento) => evento.height_m);
  return Math.max(...alturas) - Math.min(...alturas);
}

/**
 * Los datos de la página de un puerto para un día civil dado.
 *
 * @param slug Slug del puerto en `data/geo/ports.json`.
 * @param fechaIso Día civil `YYYY-MM-DD` (el `BUILD_DATE` del build).
 */
export async function cargarDatosDePuerto(
  slug: string,
  fechaIso: string,
): Promise<DatosDePuerto> {
  const { primero, ultimo } = mesDe(fechaIso);
  const [ficha, dia, mes, astro] = await Promise.all([
    getPort(deps, slug),
    getTides(deps, { slug, from: fechaIso, to: fechaIso, step: PASO_CURVA_MIN }),
    getTides(deps, { slug, from: primero, to: ultimo, step: PASO_MES_MIN }),
    getAstro(deps, { slug, date: fechaIso }),
  ]);

  const { port, station } = ficha;
  const coeficientes = await coeficientesDelMes(fechaIso, port.timezone);
  const carreraMensualM = carreraDe(mes.events, `${primero}..${ultimo}`, slug);
  const eventosPorDia = porDiaCivil(mes.events, port.timezone);
  const coeficientePorDia = new Map(coeficientes.map((dia) => [dia.dateIso, dia]));
  const delDia = coeficientePorDia.get(fechaIso);
  if (delDia === undefined) {
    throw new Error(`No hay coeficiente calculado para ${fechaIso} (zona ${port.timezone}).`);
  }

  return {
    port,
    station,
    fechaIso,
    dia: {
      inicioUtcMs: dia.range.startUtcMs,
      finUtcMs: dia.range.endUtcMs,
      eventos: dia.events,
      muestras: dia.curve.samples,
    },
    mes: {
      primero,
      ultimo,
      dias: coeficientes.map((coeficiente) => ({
        dateIso: coeficiente.dateIso,
        eventos: eventosPorDia.get(coeficiente.dateIso) ?? [],
        coeficientes: coeficiente.coefficients.map((valor) => valor.value),
      })),
    },
    coeficiente: delDia,
    astro,
    carreraMensualM,
    micromareal: carreraMensualM < CARRERA_MICROMAREAL_M,
    sinObservacion: station.quality.rmse_m === null,
  };
}
