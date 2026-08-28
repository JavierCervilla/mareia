/**
 * El adaptador entre el módulo `fishing` y esta web: quién le da los datos y quién le da el formato.
 *
 * El módulo es ciego a Astro, al dataset y a `Intl`; la página es ciega a lo que es un periodo
 * solunar. Este archivo es la costura: pide los periodos al caso de uso `getSolunar` —el mismo que
 * sirve el API en `/v1/sky/solunar`, no una segunda versión del cálculo— y le presta al módulo el
 * `formato.ts` del sitio, que es el que ya escribe las horas de la tabla de mareas.
 */

import { ventanasDeActividad } from "@mareia/module-fishing";
import type { FormatoDeActividad, VentanaDeActividad } from "@mareia/module-fishing";
import { getSolunar } from "@mareia/usecases";
import type { GetSolunarResult } from "@mareia/usecases";

import { deps } from "../datos/deps.ts";
import { hora, numero } from "../formato.ts";
import type { VentanaDestacada } from "../grafico-marea.ts";
import type { ContextoDeSeccion } from "./contexto.ts";

/**
 * Un cálculo por puerto y día, compartido por la sección y por el gráfico.
 *
 * Los dos piden lo mismo —el gráfico para saber dónde sombrear, la sección para escribir la tabla—
 * y `getSolunar` es determinista, así que repetirlo no daría un resultado distinto: daría el mismo
 * pagando otra búsqueda de efemérides por página. Se cachea la **promesa** y no el resultado para
 * que dos llamadas concurrentes (la página las lanza casi a la vez) compartan el mismo trabajo.
 */
const enCurso = new Map<string, Promise<GetSolunarResult>>();

/** Los periodos solunares del puerto y el día de la página, tal y como los publica el caso de uso. */
export function cargarActividad(contexto: ContextoDeSeccion): Promise<GetSolunarResult> {
  const clave = `${contexto.slug}|${contexto.fechaIso}`;
  const cacheada = enCurso.get(clave);
  if (cacheada !== undefined) {
    return cacheada;
  }
  const promesa = getSolunar(deps, { slug: contexto.slug, date: contexto.fechaIso });
  enCurso.set(clave, promesa);
  return promesa;
}

/** El formato del sitio, atado a la zona del puerto, prestado al módulo. */
export function formatoDelPuerto(timezone: string): FormatoDeActividad {
  return {
    hora: (timeUtcMs: number) => hora(timeUtcMs, timezone),
    numero,
  };
}

/**
 * Traducción explícita de una ventana del módulo a una del gráfico.
 *
 * Los dos tipos tienen hoy los mismos campos y TypeScript los daría por compatibles sin esta
 * función. Se escribe igualmente para que el acoplamiento se vea: el día que el gráfico añada un
 * campo, el error aparece aquí —en la costura— y no en el módulo, que no tiene por qué enterarse de
 * cómo dibuja el core.
 */
function aVentanaDelGrafico(ventana: VentanaDeActividad): VentanaDestacada {
  return {
    id: ventana.id,
    inicioUtcMs: ventana.inicioUtcMs,
    finUtcMs: ventana.finUtcMs,
    enfasis: ventana.enfasis,
    etiqueta: ventana.etiqueta,
  };
}

/**
 * Las ventanas que el gráfico de marea debe sombrear para este puerto y este día.
 *
 * El día civil se toma del **resultado del caso de uso** (`actividad.day`) y no del rango de la
 * marea: así la coletilla «del día siguiente» que escribe el módulo y el recorte que hace el
 * gráfico hablan del mismo día aunque un día dure 23 o 25 horas.
 */
export async function ventanasSolunares(
  contexto: ContextoDeSeccion,
): Promise<readonly VentanaDestacada[]> {
  const actividad = await cargarActividad(contexto);
  return ventanasDeActividad(
    actividad.periods,
    { inicioUtcMs: actividad.day.startUtcMs, finUtcMs: actividad.day.endUtcMs },
    formatoDelPuerto(contexto.timezone),
  ).map(aVentanaDelGrafico);
}
