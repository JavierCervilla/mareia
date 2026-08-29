/**
 * El único error propio del módulo: «una fuente externa no me dio un dato usable».
 *
 * Lo lanzan los adaptadores (Open-Meteo, AEMET) y lo captura `resolveSource`, que lo traduce a un
 * `status: "unavailable"` con su `reason`. Por eso el mensaje viaja **al cliente**: no puede llevar
 * nunca una URL con credenciales ni el valor de `AEMET_API_KEY` (la clave viaja en una cabecera,
 * jamás en la query, precisamente para que no pueda acabar aquí ni en un log).
 */
export class WeatherSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeatherSourceError";
  }
}

/**
 * Señas del canal del operador que no pueden salir por el borde público: el nombre de la variable
 * de entorno, el dominio donde se da de alta la clave y los dos verbos de instrucción (T-18).
 *
 * Se listan aquí, en producción, porque el recorte tiene que ser una propiedad **del borde** y no
 * una costumbre de quien redacta cada mensaje. Los recorridos que vigilan esto escriben las señas
 * **a mano**, a propósito: un gate que importara esta constante dejaría de mirar en cuanto alguien
 * la vaciara.
 */
const SENAS_DEL_OPERADOR =
  /AEMET_API_KEY|opendata\.aemet\.es|centrodedescargas|renuévala|actualiza el secreto/giu;

/** Lo que se deja en su sitio. Se marca en vez de borrar: quien lee ve que ahí faltaba algo. */
const RECORTADO = "[recortado]";

/**
 * Motivo legible de un fallo, para el campo `reason` de la respuesta.
 *
 * Recorta a `MAX_REASON_LENGTH` porque un upstream puede devolver un HTML de error entero y eso no
 * es un motivo: es ruido que además engorda todas las respuestas degradadas.
 *
 * Y **filtra las señas del canal del operador**, las haya escrito quien las haya escrito. Ésta es
 * la única puerta por la que se llena el `reason` público (`source.ts`), así que es el sitio donde
 * la promesa de T-18 se puede sostener sola. No basta con vigilar la prosa que escribimos nosotros:
 * el `descripcion` que AEMET devuelve en un sobre con `estado != 200` viaja hasta aquí literal, y
 * de aquí al JSON público y a la pantalla («el servidor informa: …»). Un 401 redactado como se
 * redactan los errores de credencial —diciendo dónde se pide una nueva— publicaría por el borde
 * dos de las cinco señas que esta trayectoria declaró prohibidas, sin que nadie las hubiera escrito
 * en este repositorio (A-18).
 *
 * Es lista negra, no lista blanca, y se sabe: conserva el diagnóstico del upstream —que es útil
 * para quien depura— a cambio de no poder prometer nada sobre prosa ajena que no lleve estas señas.
 * La lista blanca sería no republicar nunca el texto del upstream; se prefiere el filtro porque
 * cubre **todos** los caminos hacia el `reason`, incluidos los que todavía no existen.
 */
export function reasonFrom(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause);
  const flat = raw.replaceAll(/\s+/gu, " ").trim().replaceAll(SENAS_DEL_OPERADOR, RECORTADO);
  return flat.length > MAX_REASON_LENGTH ? `${flat.slice(0, MAX_REASON_LENGTH)}…` : flat;
}

const MAX_REASON_LENGTH = 200;
