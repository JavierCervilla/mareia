/**
 * Cómo se escribe en castellano lo que devuelve el caso de uso `getAstro`.
 *
 * Su forma no es casual: un orto o un ocaso pueden **no existir** (sol de medianoche, luna
 * circumpolar), y el DTO lo dice con `outcome: "no-event"` y un motivo en vez de con un `null` que
 * la página pintaría como `--:--`. Aquí se respeta esa decisión: cuando no hay evento se escribe
 * POR QUÉ no lo hay. Ninguna de las 12 páginas de hoy está en latitud polar, pero la que lo esté
 * mañana (T-13 amplía a 200-300 puertos) no puede mentir por omisión.
 *
 * Y por eso el orto y el ocaso se traducen **en par** y no de uno en uno: la razón de que falte uno
 * está en el otro (ver `sinOrto`). Aplanar cada `SkySearchDto` por su cuenta es lo que hacía que la
 * fila «Sale» anunciase el ocaso y que la página afirmase «todo el día bajo el horizonte» al lado
 * de la hora de ese mismo ocaso (hallazgos A-9 y A-10 del pase adversario de T-09).
 */

import type { HorizonEventDto, RiseSetDto, SkySearchDto, TwilightEventDto } from "@mareia/usecases";

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

/** El par de efemérides de horizonte de un cuerpo en el día: la fila «Sale» y la fila «Se pone». */
export interface ParDeHorizonte {
  readonly sale: Efemeride;
  readonly sePone: Efemeride;
}

/**
 * Por qué falta el orto, dicho **desde la fila del orto**.
 *
 * La ventana de búsqueda de `getAstro` es exactamente el día civil, así que un `no-event` significa
 * «el orto cae fuera de este día», no «no hay orto». Que el cuerpo esté circumpolar solo queda
 * DEMOSTRADO cuando faltan las dos efemérides —si falta una y la otra existe, el cuerpo cruzó el
 * horizonte y el motivo del DTO (la altura en mitad de la ventana) no describe el día entero—. Por
 * eso la frase se compone con las dos búsquedas y no con una: entre 28° y 44° N la Luna nunca es
 * circumpolar y decir que «está todo el día bajo el horizonte» junto a la hora de su ocaso es
 * publicar un dato falso.
 */
function sinOrto(cuerpo: string, ocaso: SkySearchDto<HorizonEventDto>, timeZone: string): string {
  if (ocaso.outcome === "event") {
    return (
      `${cuerpo} no sale hoy: ya estaba en el cielo al empezar el día y se pone a las ` +
      `${hora(ocaso.event.timeUtcMs, timeZone)}`
    );
  }
  return ocaso.reason === "always-above"
    ? `${cuerpo} no sale hoy: está todo el día sobre el horizonte`
    : `${cuerpo} no sale hoy: está todo el día bajo el horizonte`;
}

/** Por qué falta el ocaso, dicho **desde la fila del ocaso**. Misma regla que `sinOrto`. */
function sinOcaso(cuerpo: string, orto: SkySearchDto<HorizonEventDto>, timeZone: string): string {
  if (orto.outcome === "event") {
    return (
      `${cuerpo} no se pone hoy: sale a las ${hora(orto.event.timeUtcMs, timeZone)} y sigue en el ` +
      "cielo al acabar el día"
    );
  }
  return orto.reason === "always-above"
    ? `${cuerpo} no se pone hoy: está todo el día sobre el horizonte`
    : `${cuerpo} no se pone hoy: no llega a salir en todo el día`;
}

function conHora(evento: HorizonEventDto, timeZone: string): Efemeride {
  return {
    hora: hora(evento.timeUtcMs, timeZone),
    detalle: acimut(evento.azimuth_deg),
    ausencia: undefined,
  };
}

/**
 * El orto y el ocaso de un cuerpo en el día, listos para pintar.
 *
 * Se resuelven **juntos** a propósito: la razón de que falte uno está en el otro (ver `sinOrto`).
 * `body` viaja aparte porque la rama «no hay evento» del DTO no lo lleva, y el mensaje tiene que
 * decir si el que no sale es el Sol o la Luna.
 */
export function efemeridesDeHorizonte(
  parDeBusquedas: RiseSetDto,
  timeZone: string,
  body: "sun" | "moon",
): ParDeHorizonte {
  const cuerpo = CUERPOS[body];
  const { rise, set } = parDeBusquedas;
  return {
    sale:
      rise.outcome === "event"
        ? conHora(rise.event, timeZone)
        : { hora: undefined, detalle: undefined, ausencia: sinOrto(cuerpo, set, timeZone) },
    sePone:
      set.outcome === "event"
        ? conHora(set.event, timeZone)
        : { hora: undefined, detalle: undefined, ausencia: sinOcaso(cuerpo, rise, timeZone) },
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
