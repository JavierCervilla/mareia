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
  /**
   * Puerto **micromareal**: grade C sin error de hora publicable (`hw_time_err_p95_min: null`). En
   * el QC de T-05 eso significa que la observación no tiene pleamares identificables porque la
   * marea astronómica es de centímetros y manda el residuo meteorológico. La página lo dice con un
   * aviso destacado en vez de publicar una tabla con pinta de exacta.
   */
  readonly micromareal: boolean;
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
    micromareal: station.quality.grade === "C" && station.quality.hw_time_err_p95_min === null,
  };
}
