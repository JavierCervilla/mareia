/**
 * El protocolo entre la página y su service worker: nombres de caché, cabeceras y mensajes.
 *
 * Vive en un fichero aparte —y no dentro del propio worker— por una razón mecánica: el service
 * worker se sirve como **un fichero suelto en `/sw.js`**, sin bundler y sin imports en tiempo de
 * ejecución (ver `src/pages/sw.js.ts`), así que no puede importar de aquí. Lo que hace el endpoint
 * es **inyectar este objeto** en la cabecera del worker como una constante; el worker lo declara
 * con `declare const PROTOCOLO: Protocolo` y así los dos lados comparten los mismos literales sin
 * copiarlos. Si se cambia un nombre aquí, cambia en los dos a la vez o no compila.
 *
 * Nada de esto toca el DOM ni la red: es TypeScript puro, y por eso se puede testear en Node.
 */

/** Prefijo de **todas** las cachés de Mareia: lo que no lo lleve, no es nuestro y no se borra. */
export const PREFIJO_CACHE = "mareia";

/**
 * Versión del **esquema de caché**, no del build.
 *
 * Se sube a mano cuando cambia la *forma* de lo guardado (qué se guarda, con qué cabeceras), no en
 * cada despliegue: los assets de Astro ya van con hash en la URL —dos builds nunca colisionan— y el
 * HTML se pide siempre a la red antes que a la caché (ADR-02). Versionar la caché por build
 * obligaría a re-descargarlo todo cada día y dejaría sin copia offline a quien actualizara el SW
 * justo cuando se quedó sin cobertura, que es exactamente el momento en que la copia hace falta.
 */
export const ESQUEMA_CACHE = 1;

/** Páginas guardadas a petición del usuario, con el CSS y el JS que necesitan para pintarse. */
export const CACHE_PAGINAS = `${PREFIJO_CACHE}-paginas-v${ESQUEMA_CACHE}`;

/**
 * Última respuesta servida por cada endpoint de módulo (hoy, los dos de meteo).
 *
 * Va en su propia caché porque su ciclo de vida es otro: no se precachea nunca —se guarda lo que ya
 * se sirvió— y se poda por antigüedad, mientras que las páginas se guardan por acto explícito y se
 * borran por acto explícito.
 */
export const CACHE_MODULOS = `${PREFIJO_CACHE}-modulos-v${ESQUEMA_CACHE}`;

/**
 * Cuántas respuestas de módulo se conservan como mucho.
 *
 * Dos endpoints por puerto y doce puertos en el catálogo piloto: 24 entradas cubren el catálogo
 * entero sin que la caché crezca sin techo si mañana son 300 puertos.
 */
export const MAX_RESPUESTAS_DE_MODULO = 24;

/**
 * Cabecera con la que el worker **sella** una respuesta al guardarla: el reloj del navegador, en
 * milisegundos, en el instante en que se metió en la caché.
 *
 * Es lo que permite que la sección meteo diga la edad REAL de lo que enseña sin red. La edad que
 * publica el backend (`ageSeconds`) es la que tenía el dato cuando el servidor contestó; si esa
 * respuesta lleva tres horas en el disco del teléfono, la edad de verdad es la suma de las dos. Sin
 * esta cabecera, una copia de anteayer se pintaría con el sello de «consultado hace un momento»,
 * que es la mentira que T-11 existe para no contar.
 */
export const CABECERA_GUARDADO = "x-mareia-guardado-en";

/** URL del worker. Vive en la raíz porque su ámbito es el sitio entero. */
export const RUTA_SW = "/sw.js";

/** URL del manifiesto de instalación (`display`, iconos, nombre). */
export const RUTA_MANIFEST = "/manifest.webmanifest";

/** Dónde vive el fichero con las constantes armónicas de un puerto, listo para el navegador. */
export function rutaEstacionOffline(slug: string): string {
  return `/offline/estaciones/${slug}.json`;
}

/**
 * Lo que la página le pide al worker. **Solo hay dos verbos**, y los dos los dispara una acción
 * explícita de quien lee: guardar este puerto y olvidarlo. El worker no guarda nada por su cuenta.
 */
export const MENSAJE_GUARDAR = "mareia:guardar-puerto";
export const MENSAJE_OLVIDAR = "mareia:olvidar-puerto";

/** Petición de guardar un puerto: su slug y **las URL exactas** que hacen falta para verlo sin red. */
export interface PeticionGuardar {
  readonly tipo: typeof MENSAJE_GUARDAR;
  readonly slug: string;
  /** Página, constantes armónicas y assets con hash. Todas del mismo origen. */
  readonly urls: readonly string[];
  /**
   * Assets con hash que la página está usando AHORA. Sirven para podar de la caché los de builds
   * anteriores, que ya no los referencia ningún HTML y solo ocupan sitio.
   */
  readonly assetsVigentes: readonly string[];
}

/** Petición de olvidar un puerto: se borran su página y sus constantes, no los assets compartidos. */
export interface PeticionOlvidar {
  readonly tipo: typeof MENSAJE_OLVIDAR;
  readonly slug: string;
  readonly urls: readonly string[];
}

export type PeticionAlWorker = PeticionGuardar | PeticionOlvidar;

/** Lo que el worker contesta por el puerto del `MessageChannel` de la petición. */
export interface RespuestaDelWorker {
  readonly ok: boolean;
  /** Qué falló, en palabras que la página pueda enseñar. Vacío cuando `ok`. */
  readonly motivo?: string;
  /** Cuántas URL quedaron guardadas (o borradas). Se enseña como medida, no como adorno. */
  readonly urls: number;
}

/** El objeto que el endpoint inyecta en el worker. Un solo sitio para los literales compartidos. */
export interface Protocolo {
  readonly cachePaginas: string;
  readonly cacheModulos: string;
  readonly prefijoCache: string;
  readonly maxRespuestasDeModulo: number;
  readonly cabeceraGuardado: string;
  readonly mensajeGuardar: string;
  readonly mensajeOlvidar: string;
}

/** El protocolo de ESTE build, tal y como viaja al worker. */
export const PROTOCOLO: Protocolo = {
  cachePaginas: CACHE_PAGINAS,
  cacheModulos: CACHE_MODULOS,
  prefijoCache: PREFIJO_CACHE,
  maxRespuestasDeModulo: MAX_RESPUESTAS_DE_MODULO,
  cabeceraGuardado: CABECERA_GUARDADO,
  mensajeGuardar: MENSAJE_GUARDAR,
  mensajeOlvidar: MENSAJE_OLVIDAR,
};
