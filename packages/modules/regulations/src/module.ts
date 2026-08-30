/**
 * El módulo `regulations`: la normativa de tallas mínimas de captura en la página de puerto.
 *
 * Cumple el contrato `AppModule` de `@mareia/module-contract`, así que darlo de alta es añadirlo al
 * array de `apps/web/src/modules.config.ts` y darlo de baja es **borrar esa línea**.
 *
 * **Es un módulo propio y no una sección de `fishing`**, y esa decisión está en el diff del
 * contrato: la unión `ModuleId` se amplió a propósito (§7.3.8 del design doc de la épica prohíbe
 * expresamente colgarlo de pesca «para no tocar el contrato»). Comparten lector, no fuente: una
 * cosa es una convención sin respaldo experimental que se calcula en casa y la otra es el BOE. Con
 * una sola identidad no se podrían dar de baja por separado, la versión contaría dos cosas a la vez
 * y `/v1/modules` publicaría la teoría solunar y la Agencia Estatal en la misma lista de fuentes.
 *
 * No tiene parte servidor (`api`): la tabla se lee del dataset commiteado en build y viaja dentro
 * del HTML. Un endpoint sería un segundo camino al mismo fichero.
 *
 * **No declara `isEnabledForPort`**: los 153 puertos del catálogo tienen caladero —el pipeline
 * levanta si alguno se queda sin él— y por tanto tienen tabla. Un filtro que siempre dice que sí es
 * una condición que nadie prueba.
 */

import type { AppModule, Attribution, PageSection, PrecachePolicy } from "@mareia/module-contract";

/** Versión del módulo, publicada en `/v1/modules`. Va a la par con su `package.json`. */
export const REGULATIONS_MODULE_VERSION = "0.1.0";

/**
 * Clave lógica de la sección. El contrato identifica los componentes por **cadena** para no
 * depender de ningún framework de UI; la constante existe para que el módulo y el mapa de
 * renderizadores de la superficie (`apps/web/src/secciones.ts`) no escriban la misma cadena por
 * separado y se desincronicen en el primer renombrado.
 */
export const SECCION_TALLAS_MINIMAS = "@mareia/module-regulations/sections/TallasMinimas";

/** Ancla de la sección en la página (`#tallas-minimas`). */
export const ID_SECCION_TALLAS = "tallas-minimas";

/**
 * Atribución de la fuente: el BOE, con su licencia real y con el aviso de autenticidad **dentro**.
 *
 * El aviso viaja en el `name` y no solo en el texto de la sección porque `Attribution` tiene tres
 * campos y son los tres que publica `/v1/modules`: es ahí donde la atribución sale del portal. Una
 * reutilización de la legislación que se cite sin decir cuál es el texto auténtico es media cita, y
 * la regla de la casa —la misma de `data/stations`— es que la atribución acompaña al dato allá
 * donde vaya. La sección, además, imprime el aviso aparte y en su sitio: esto es el respaldo, no el
 * único ejemplar.
 *
 * La licencia no es una etiqueta SPDX porque no existe ninguna para esto: es el régimen de
 * reutilización de la legislación del art. 13 de la Ley 37/2007 y del RD 1495/2011. Escribir
 * «CC-BY-4.0» porque se parece sería inventarse los términos de uso de una fuente oficial.
 */
export const ATRIBUCIONES_REGULATIONS: readonly [Attribution, ...Attribution[]] = [
  {
    name:
      "Agencia Estatal Boletín Oficial del Estado · Real Decreto 560/1995, texto consolidado " +
      "(solo el texto publicado en el BOE tiene carácter auténtico)",
    url: "https://www.boe.es/eli/es/rd/1995/04/07/560",
    license: "Reutilización de la legislación (art. 13 Ley 37/2007 y RD 1495/2011)",
  },
];

/**
 * La sección que el módulo aporta a la página de puerto.
 *
 * `renderMode: "static"` porque esto es **dato de build**: una talla mínima no envejece en horas
 * como la meteo —se deroga, que es otra cosa y llega por otro camino (el gate G2 y el rebuild
 * diario)—, así que hidratarla costaría JavaScript para no enterarse de nada nuevo. Es justo el
 * caso contrario al de ADR-01.
 *
 * `order: 30` la coloca **detrás** de la actividad solunar y de la meteo, que van las dos a 20.
 * En la jerarquía del design brief (§1) una talla mínima es **consultable**, no contextual: se
 * viene a esta página a por la marea, y quien mira la talla la mira porque ya tiene la pieza en la
 * mano. Ponerla más arriba la haría competir con lo que la gente viene a leer, y una cifra legal no
 * gana nada por estar antes: gana por estar completa. Los órdenes por debajo de 10 siguen libres
 * para un módulo que algún día tenga que avisar de algo por encima del dato.
 */
export const SECCION_TALLAS: PageSection = {
  id: ID_SECCION_TALLAS,
  order: 30,
  renderMode: "static",
  component: SECCION_TALLAS_MINIMAS,
};

/**
 * Política offline: **`cache-first`, o sea que la copia guardada se sirve sin preguntar a la red.**
 *
 * Quién guarda la copia **no es este módulo**: es la caja de favoritos del core, que guarda la
 * página de un puerto cuando el lector lo marca. Sin marcarlo no hay copia y sin red no hay tabla.
 * Decirlo aquí no es una cautela: la versión anterior de este comentario y del aviso de la sección
 * afirmaban que la tabla se guarda, a secas, y el pase adversario lo midió falso por defecto en las
 * 153 páginas (hallazgo H-4). El aviso ya dice la condición; este comentario también.
 *
 * Es una decisión del humano **contra la recomendación del arquitecto**, que proponía ocultar la
 * sección sin red por lo mismo que la hace valiosa: una copia guardada no puede saber si la norma
 * que enseña sigue viva, y una talla derogada se lee igual de bien que la vigente. Se aceptó el
 * riesgo porque el entorno de uso que manda el design brief es un teléfono en la orilla y a menudo
 * sin cobertura, que es exactamente cuando alguien tiene la pieza en la mano y necesita el número.
 * Ocultarla ahí la haría inútil justo el día que sirve.
 *
 * El precio se paga en la página y no se disimula: la sección lleva el aviso de `AVISO_SIN_RED`
 * **siempre escrito** —no puede encenderlo, porque no tiene JavaScript— diciendo que lo que se ve
 * puede ser una copia de hace semanas y que la fecha de comprobación es la del día en que se
 * guardó.
 *
 * `routes` y `assets` van **vacíos, y eso es exacto**: la tabla se hornea dentro del HTML de la
 * página, que la PWA ya guarda cuando alguien marca el puerto como favorito, y el módulo no tiene
 * ninguna URL propia que precachear. Lo que esta política declara no es una lista de ficheros: es
 * la postura —servir lo guardado sin preguntar a la red— y por eso está escrita aquí, donde
 * `/v1/modules` y `/sw.js` la publican, en vez de vivir solo en la cabeza de quien la decidió.
 * `maxAgeSeconds` no se declara por la misma razón: el worker solo lo aplica a las rutas que casan,
 * no hay ninguna, y un umbral que no caduca nada sería una promesa falsa.
 */
export const OFFLINE_REGULATIONS: PrecachePolicy = {
  strategy: "cache-first",
};

/** El módulo, listo para el registry. Sin dependencias que inyectar: no lee nada del entorno. */
export const regulationsModule: AppModule = {
  id: "regulations",
  version: REGULATIONS_MODULE_VERSION,
  attributions: ATRIBUCIONES_REGULATIONS,
  pageSections: [SECCION_TALLAS],
  offline: OFFLINE_REGULATIONS,
};
