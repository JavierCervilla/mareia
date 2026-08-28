/**
 * Cómo se escribe en castellano lo que devuelve el caso de uso `getAstro`.
 *
 * Su forma no es casual: un orto o un ocaso pueden **no existir** (sol de medianoche, luna
 * circumpolar), y el DTO lo dice con `outcome: "no-event"` y un motivo en vez de con un `null` que
 * la página pintaría como `--:--`. Aquí se respeta esa decisión: cuando no hay evento se escribe
 * POR QUÉ no lo hay. Ninguna de las 12 páginas de hoy está en latitud polar, pero la que lo esté
 * mañana (T-13 amplía a 200-300 puertos) no puede mentir por omisión.
 */

import type { HorizonEventDto, SkySearchDto, TwilightEventDto } from "@mareia/usecases";

import { acimut, hora } from "./formato.ts";

/** Una efeméride lista para pintar: o tiene hora, o tiene la razón de no tenerla. */
export interface Efemeride {
  readonly hora: string | undefined;
  /** Acompañante del dato (el acimut de un orto), si lo hay. */
  readonly detalle: string | undefined;
  /** Por qué no hay evento, cuando no lo hay. */
  readonly ausencia: string | undefined;
}

const CUERPOS = { sun: "El Sol", moon: "La Luna" } as const;

function ausencia(body: "sun" | "moon", razon: "always-above" | "always-below"): string {
  const cuerpo = CUERPOS[body];
  return razon === "always-above"
    ? `${cuerpo} no se pone: hoy está todo el día sobre el horizonte`
    : `${cuerpo} no sale: hoy está todo el día bajo el horizonte`;
}

/**
 * Un orto o un ocaso, con su acimut.
 *
 * `body` viaja aparte porque la rama «no hay evento» del DTO **no lo lleva**: sin evento no hay
 * cuerpo del que hablar, y el mensaje tiene que decir si el que no sale es el Sol o la Luna.
 */
export function efemerideDeHorizonte(
  busqueda: SkySearchDto<HorizonEventDto>,
  timeZone: string,
  body: "sun" | "moon",
): Efemeride {
  if (busqueda.outcome === "no-event") {
    return { hora: undefined, detalle: undefined, ausencia: ausencia(body, busqueda.reason) };
  }
  return {
    hora: hora(busqueda.event.timeUtcMs, timeZone),
    detalle: acimut(busqueda.event.azimuth_deg),
    ausencia: undefined,
  };
}

/** Un crepúsculo (no lleva acimut: es un instante, no una dirección). */
export function efemerideDeCrepusculo(
  busqueda: SkySearchDto<TwilightEventDto>,
  timeZone: string,
): Efemeride {
  if (busqueda.outcome === "no-event") {
    return {
      hora: undefined,
      detalle: undefined,
      ausencia:
        busqueda.reason === "always-above"
          ? "no hay: el Sol no baja tanto hoy"
          : "no hay: el Sol no sube tanto hoy",
    };
  }
  return {
    hora: hora(busqueda.event.timeUtcMs, timeZone),
    detalle: undefined,
    ausencia: undefined,
  };
}

/**
 * Un crepúsculo completo en una línea: «06:12 – 21:40», el alba y el ocaso de la misma definición.
 *
 * Los almanaques los publican emparejados y ocupa la mitad; si a alguna de las dos mitades le falta
 * el evento, se dice en su sitio en vez de dejar el par a medias sin explicación.
 */
export function parDeCrepusculo(
  par: { readonly dawn: SkySearchDto<TwilightEventDto>; readonly dusk: SkySearchDto<TwilightEventDto> },
  timeZone: string,
): Efemeride {
  const alba = efemerideDeCrepusculo(par.dawn, timeZone);
  const ocaso = efemerideDeCrepusculo(par.dusk, timeZone);
  if (alba.hora === undefined || ocaso.hora === undefined) {
    return { hora: undefined, detalle: undefined, ausencia: alba.ausencia ?? ocaso.ausencia };
  }
  return { hora: `${alba.hora} – ${ocaso.hora}`, detalle: undefined, ausencia: undefined };
}

/** Las ocho fases de la Luna, en castellano. */
const FASES: Readonly<Record<string, string>> = {
  new: "luna nueva",
  "waxing-crescent": "creciente cóncava",
  "first-quarter": "cuarto creciente",
  "waxing-gibbous": "creciente gibosa",
  full: "luna llena",
  "waning-gibbous": "menguante gibosa",
  "last-quarter": "cuarto menguante",
  "waning-crescent": "menguante cóncava",
};

export function nombreDeFase(fase: string): string {
  return FASES[fase] ?? fase;
}
