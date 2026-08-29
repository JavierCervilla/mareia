/**
 * El **sello de antigüedad**: cómo dice esta web de cuándo es lo que enseña.
 *
 * Nació en T-11 dentro de la sección meteo, que era el único dato del portal que caducaba. Con la
 * PWA (T-12) deja de serlo: una página guardada en el teléfono también tiene una edad, y una copia
 * de la respuesta del API guardada sin red también. Como el mecanismo es el mismo —y como repetirlo
 * habría sido inventarse un segundo vocabulario para la misma idea— vive aquí, en el core, y la
 * sección meteo lo sigue re-exportando para que nada de lo suyo tenga que cambiar de import.
 *
 * La regla que sostiene el sello, y que es de T-11: **la edad se mide como intervalo, nunca como
 * instante**. Un reloj de móvil desajustado dos horas mide fatal qué hora es y perfectamente cuánto
 * ha pasado; restar `Date.parse(...)` del reloj del cliente convertiría un dato fresco en rancio.
 */

/** Los tonos del sello. El CSS los distingue; el texto ya se distingue solo. */
export type ClaseDeSello = "fresco" | "caducado" | "sin-dato" | "pidiendo";

/**
 * El sello de un bloque. Es obligatorio donde se usa: **nada se pinta sin decir de cuándo es**, que
 * es la razón de ser de T-11 y la mitad de la de T-12.
 */
export interface SelloDeAntiguedad {
  readonly clase: ClaseDeSello;
  /** La frase corta que se lee primero. En un dato caducado, lleva la edad. */
  readonly titular: string;
  /** El porqué, la hora absoluta o el motivo del backend. */
  readonly detalle: string | undefined;
}

const SEGUNDOS_POR_MINUTO = 60;
const SEGUNDOS_POR_HORA = 3_600;
const SEGUNDOS_POR_DIA = 86_400;

/** «1 minuto» / «7 minutos», sin que el singular delate una plantilla. */
function plural(cantidad: number, singular: string, pluralizado: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : pluralizado}`;
}

/**
 * Una antigüedad como se dice en voz alta: «3 h 10 min», «12 min», «2 días 4 h».
 *
 * Se escribe **completa hasta el minuto** dentro del día porque es la escala en la que se decide
 * si el dato sirve: «hace unas horas» vale para un titular y no para saber si el viento que
 * enseña la página es el que hay en la playa.
 */
export function antiguedad(segundos: number): string {
  const enteros = Math.max(0, Math.floor(segundos));
  if (enteros < SEGUNDOS_POR_MINUTO) {
    return "menos de un minuto";
  }
  if (enteros < SEGUNDOS_POR_HORA) {
    return plural(Math.floor(enteros / SEGUNDOS_POR_MINUTO), "minuto", "minutos");
  }
  if (enteros < SEGUNDOS_POR_DIA) {
    const horas = Math.floor(enteros / SEGUNDOS_POR_HORA);
    const minutos = Math.floor((enteros % SEGUNDOS_POR_HORA) / SEGUNDOS_POR_MINUTO);
    return minutos === 0 ? `${horas} h` : `${horas} h ${minutos} min`;
  }
  const dias = Math.floor(enteros / SEGUNDOS_POR_DIA);
  const horas = Math.floor((enteros % SEGUNDOS_POR_DIA) / SEGUNDOS_POR_HORA);
  const cabeza = plural(dias, "día", "días");
  return horas === 0 ? cabeza : `${cabeza} ${horas} h`;
}
