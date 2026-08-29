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
 * El patrón casa sobre el texto ya **saneado** (`sanear`), nunca sobre el original: por eso no
 * necesita una alternancia por cada forma de escribir lo mismo, y por eso lo único que tolera aquí
 * es lo que el saneado no puede tocar sin cambiar lo que se lee — el separador de `AEMET_API_KEY`
 * (`-`, `_`, espacio o ninguno: quien escribe un error a mano escribe «cabecera AEMET-API-KEY») y
 * el espacio alrededor de los puntos del dominio, que aparece solo con una URL partida por un salto
 * de línea.
 *
 * Se listan aquí, en producción, porque el recorte tiene que ser una propiedad **del borde** y no
 * una costumbre de quien redacta cada mensaje. Los recorridos que vigilan esto escriben las señas
 * **a mano**, a propósito: un gate que importara esta constante dejaría de mirar en cuanto alguien
 * la vaciara.
 */
const SENAS_DEL_OPERADOR =
  /AEMET[-_ ]?API[-_ ]?KEY|opendata ?\. ?aemet ?\. ?es|centrodedescargas|renuévala|actualiza el secreto/giu;

/** Lo que se deja en su sitio. Se marca en vez de borrar: quien lee ve que ahí faltaba algo. */
const RECORTADO = "[recortado]";

/**
 * Caracteres que no se leen pero sí cambian lo que casa una expresión regular: los de ancho cero
 * (ZWSP, ZWNJ, ZWJ, juntador de palabras, BOM) y el guion blando.
 */
const INVISIBLES = /[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/gu;

/**
 * La forma del texto sobre la que se decide **y que se publica**. Las dos cosas son la misma a
 * propósito: casar sobre una forma y publicar otra dejaría el recorte aplicado a un texto distinto
 * del que sale por el cable. Quitar lo invisible y componer no pierde nada de lo que un humano ve.
 *
 * `NFC` porque «Renuévala» escrita con `e` + acento combinante (U+0301) es **la misma palabra** en
 * pantalla y otra cadena distinta para `includes`: quien lee la respuesta no distingue las dos, así
 * que el filtro tampoco puede. Las invisibles se quitan **antes** de componer, porque una de ancho
 * cero metida entre la letra y su acento impide la composición.
 */
function sanear(texto: string): string {
  return texto.replaceAll(INVISIBLES, "").normalize("NFC").replaceAll(/\s+/gu, " ").trim();
}

/**
 * Motivo legible de un fallo, para el campo `reason` de la respuesta.
 *
 * Recorta a `MAX_REASON_LENGTH` porque un upstream puede devolver un HTML de error entero y eso no
 * es un motivo: es ruido que además engorda todas las respuestas degradadas.
 *
 * Y **filtra las señas del canal del operador**, las haya escrito quien las haya escrito. No basta
 * con vigilar la prosa que escribimos nosotros: el `descripcion` que AEMET devuelve en un sobre con
 * `estado != 200` viaja hasta aquí literal, y de aquí al JSON público y a la pantalla («el servidor
 * informa: …»). Un 401 redactado como se redactan los errores de credencial —diciendo dónde se pide
 * una nueva— publicaría por el borde dos de las cinco señas que esta trayectoria declaró
 * prohibidas, sin que nadie las hubiera escrito en este repositorio (A-18).
 *
 * **Hoy son dos los sitios que llenan el `reason` público, y los dos pasan por aquí**: la rama
 * `unavailable` de `source.ts` y la rama sin zona marítima de `module.ts`. Se dice así —dos, con
 * nombre y contados— y no «cubre todos los caminos, incluidos los que todavía no existen»: eso
 * segundo era una afirmación por costumbre, exactamente la clase de frase que A-18 desmontó, y
 * además era falsa mientras se escribía (`module.ts` llenaba su `reason` a mano). Que un tercer
 * camino pase por aquí no lo garantiza esta función: lo garantiza que quien lo escriba la llame, y
 * por eso los recorridos atacan **por HTTP** en vez de llamar a `reasonFrom`.
 *
 * **Qué casa exactamente, medido y no supuesto.** Antes de buscar, el texto se sanea (`sanear`):
 * fuera los caracteres invisibles, `NFC` y el espacio en blanco aplastado. Así «Renuévala» escrita
 * con acento combinante —la misma palabra en pantalla, otra cadena para `includes`— se recorta
 * igual que la escrita con `é`, y `AEMET<U+200B>_API_KEY` deja de esconderse detrás de un carácter
 * que nadie ve. El patrón tolera además `-`, `_`, espacio o nada como separador de `AEMET_API_KEY`,
 * y el espacio alrededor de los puntos de `opendata.aemet.es`.
 *
 * **Qué NO casa, dicho aquí para no prometerlo de más en ningún otro sitio**: cualquier
 * *codificación* del mismo texto. `opendata&#46;aemet&#46;es` (entidades HTML), su forma en
 * porcentaje o cualquier otro escape salen enteros. No se descodifica y es decisión, no olvido:
 * descodificar es publicar un texto que el upstream no escribió, el espacio de escapes no tiene
 * fondo (`&#x2E;`, `&period;`, doble codificación…) y perseguirlo dejaría una lista negra idéntica
 * con la promesa más grande y la misma garantía. Ese límite tiene su propio recorrido en el gate,
 * para que nadie lo cambie sin cambiar esta frase.
 *
 * Y sigue siendo lista negra, no lista blanca: conserva el diagnóstico del upstream —que es útil
 * para quien depura— a cambio de no poder prometer nada sobre prosa ajena que no lleve estas señas
 * («Su clave ha expirado. Solicite una nueva y configúrela en el servidor» pasa entera). La lista
 * blanca sería no republicar nunca el texto del upstream; se prefiere el filtro porque conservar el
 * diagnóstico vale más que la garantía que da vaciar el campo.
 */
export function reasonFrom(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause);
  const flat = sanear(raw).replaceAll(SENAS_DEL_OPERADOR, RECORTADO);
  return flat.length > MAX_REASON_LENGTH ? `${flat.slice(0, MAX_REASON_LENGTH)}…` : flat;
}

const MAX_REASON_LENGTH = 200;
