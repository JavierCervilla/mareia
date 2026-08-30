/**
 * Cuánto puede envejecer el sello de vigencia antes de que la sección deje de poder sostener lo
 * que promete, y en qué estados se degrada.
 *
 * Es el hermano de `frescura.ts` del módulo de meteo, y la diferencia entre los dos es toda la
 * decisión: allí las ventanas son de **minutos y horas** porque el estado del mar caduca con el
 * reloj; aquí son de **días** porque una norma no se degrada, se sustituye. Lo que envejece no es
 * la talla mínima: es **nuestra afirmación** de haber comprobado que sigue en vigor.
 *
 * Esa afirmación la escribe el gate diario G2 (`fuente.verificadoEn`) y **sólo** en su día verde.
 * Cuando el BOE no se puede consultar, G2 se queda en ámbar a propósito —no romper el despliegue
 * porque la fuente tenga un mal día— y no toca la fecha. El workflow prometía por escrito que
 * entonces «la página degrada sola», y no degradaba nada: la sección imprimía el sello y no lo
 * comparaba con nada, así que un sello de 2019 publicaba exactamente la misma página que uno de
 * hoy salvo la cadena de la fecha. Este fichero es la parte que faltaba para que esa frase sea
 * verdad.
 *
 * **El sello se compara con el día que publica la página** (`ContextoDeSeccion.fechaIso`, el
 * `BUILD_DATE`), no con el reloj de quien lee: la sección es HTML estático y no tiene JavaScript
 * con el que enterarse de nada. Eso deja un límite que hay que decir en vez de disimularlo — si el
 * rebuild diario también se para, la página congela su propio diagnóstico junto con todo lo demás—
 * y de ahí sale la forma de los avisos: dicen «hace **más de** N días», que es una **cota inferior**
 * y por tanto sigue siendo verdad según el HTML envejece. «Hace 9 días» sería mentira mañana.
 */

/**
 * Hasta una semana, el sello es corriente y la sección no dice nada más.
 *
 * G2 pregunta al BOE **todos los días**, así que un día de silencio es ruido: la rama ámbar existe
 * precisamente para que un mal día de la fuente no rompa el despliegue. Siete días ya no es un mal
 * día: son siete intentos seguidos fallidos, o el job parado, y eso es un hecho sobre nosotros que
 * el lector merece saber. El umbral no se pone más bajo porque un aviso que se enciende cada vez
 * que el BOE tose se aprende a ignorar, y entonces no avisa de nada.
 */
export const DIAS_SELLO_CORRIENTE = 7;

/**
 * Pasados dos meses, la sección deja de poder decir que la cifra es la que está **en vigor hoy**.
 *
 * El umbral es de meses y no de horas porque el dato tampoco caduca en horas: la redacción
 * anterior del RD 560/1995 duró casi diez años y la vigente entró el 2 de noviembre de 2025. Lo
 * que se mide con esto no es cuánto tarda la norma en cambiar —eso no se puede saber sin
 * preguntar— sino cuánto tarda en dejar de ser creíble el «comprobada» que la página imprime. A
 * los sesenta días, la comprobación diaria lleva dos meses sin correr y el rebuild también: nadie
 * puede sostener que lo publicado esté verificado, y decirlo igualmente sería la clase de
 * afirmación falsa que esta trayectoria existe para no cometer.
 */
export const DIAS_SELLO_RANCIO = 60;

/**
 * En qué estado está la comprobación de vigencia de lo que se publica.
 *
 * Es una unión cerrada, como `Talla`: quien la consuma tiene que escribir las tres ramas, y una
 * cuarta no compilará hasta que alguien decida qué dice la página en ese caso.
 */
export type EstadoDeVigencia =
  /** Comprobado hace `DIAS_SELLO_CORRIENTE` días o menos. La sección sostiene el «en vigor hoy». */
  | "comprobada"
  /** El gate diario lleva más de una semana sin escribir. Se dice, y se dice arriba. */
  | "envejecida"
  /** Más de `DIAS_SELLO_RANCIO` días. La sección ya no puede afirmar que esto esté verificado. */
  | "sin_comprobar";

/** Un día en milisegundos: las dos fechas se anclan al mediodía UTC, así que no hay horario de verano que valga. */
const MS_POR_DIA = 86_400_000;

/** `YYYY-MM-DD` anclado al mediodía UTC, igual que `fechaLarga` de la web. `NaN` si no se lee. */
function mediodiaDe(fechaIso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(fechaIso)) return Number.NaN;
  return new Date(`${fechaIso}T12:00:00Z`).getTime();
}

/**
 * Días **cumplidos** entre la comprobación y el día que publica la página.
 *
 * `null` cuando no se puede contar: una fecha ilegible, o un sello con fecha futura (que no es una
 * comprobación, es una fecha tecleada).
 */
export function diasDesdeLaComprobacion(verificadoEn: string, diaDePublicacion: string): number | null {
  const sello = mediodiaDe(verificadoEn);
  const hoy = mediodiaDe(diaDePublicacion);
  if (Number.isNaN(sello) || Number.isNaN(hoy)) return null;
  const dias = Math.floor((hoy - sello) / MS_POR_DIA);
  return dias < 0 ? null : dias;
}

/**
 * El estado del sello de vigencia el día en que se publica la página.
 *
 * **Un sello que no se puede contar se trata como el peor caso** (`sin_comprobar`) y no levanta.
 * Las dos mitades de esa decisión: levantar aquí tumbaría el build de las 191 páginas por una
 * fecha mal escrita —y la sección de tallas es lo consultable de la página, no la marea, que es a
 * lo que se viene—; y elegir el peor caso es lo mismo que hace G2 cuando no puede preguntar. Una
 * comprobación que no se puede leer no es una comprobación.
 */
export function estadoDeVigencia(verificadoEn: string, diaDePublicacion: string): EstadoDeVigencia {
  const dias = diasDesdeLaComprobacion(verificadoEn, diaDePublicacion);
  if (dias === null || dias > DIAS_SELLO_RANCIO) return "sin_comprobar";
  return dias > DIAS_SELLO_CORRIENTE ? "envejecida" : "comprobada";
}
