/**
 * Los textos de la sección de tallas mínimas, en un solo sitio.
 *
 * Viven aquí y no dentro del componente por el mismo motivo que los de `fishing`: son **requisito
 * de producto** —el aviso de autenticidad y el aviso de lectura sin red no son decoración, son la
 * condición con la que este proyecto se permite publicar una cifra legal— y hay tests que los
 * buscan en el `dist/` construido. Un texto escrito dentro de la plantilla se puede suavizar en un
 * commit de estilo sin que nadie lo note.
 *
 * Lo que **no** vive aquí: el aviso de autenticidad y la licencia de la fuente, que viajan dentro
 * del propio dataset (`fuente.aviso`, `fuente.licencia`). Copiarlos como constante sería una
 * segunda versión de algo que ya viene firmado con el dato, y las dos se desincronizarían.
 */

/** Rótulo de la sección. El caladero se nombra porque la tabla que aplica depende de él. */
export function tituloDeLaSeccion(nombreDelCaladero: string): string {
  return `Tallas mínimas del caladero ${nombreDelCaladero}`;
}

/**
 * Qué es esto, antes de la primera cifra.
 *
 * Dice las dos cosas que cambian cómo se lee la tabla: que es **talla mínima legal de captura** (no
 * un consejo de pesca) y que la lista es la del caladero de este puerto y no la de España entera.
 */
export const QUE_ES_ESTO =
  "Talla mínima legal de captura: por debajo de estas medidas la pieza no se puede " +
  "desembarcar ni retener, ni pescando de forma profesional ni de forma recreativa. La tabla es " +
  "la del caladero al que pertenece este puerto; los otros dos caladeros tienen la suya, con " +
  "cifras distintas para la misma especie.";

/** Rótulo del bloque que dice de qué redacción concreta salen las cifras. */
export const ROTULO_PROCEDENCIA = "De dónde salen estas cifras";

/**
 * El aviso de lectura sin red, y es **duro a propósito**.
 *
 * El módulo declara `offline: cache-first`, o sea que sin cobertura esta tabla **se sigue leyendo**
 * —decisión del humano, frente a la recomendación de ocultarla— y lo que se lee puede ser una copia
 * de hace semanas. La sección no tiene JavaScript con el que enterarse de si hay red, así que el
 * aviso no se enciende: **está siempre**, escrito para que sea verdad en los dos casos. Es la única
 * forma honrada de sostener «se muestra sin red»: si la copia guardada no puede decir que es una
 * copia guardada, la fecha de comprobación de arriba se lee como si fuese de hoy.
 */
export const AVISO_SIN_RED =
  "Esta tabla se guarda para leerla sin cobertura, así que puedes estar viendo una copia de hace " +
  "semanas: la fecha de comprobación de arriba es la del día en que se guardó, no la de hoy, y " +
  "desde entonces la norma ha podido cambiar o quedar derogada sin que esta página se entere. Una " +
  "talla derogada se lee igual de bien que la vigente.";

/** Rótulo del pie de notas del anexo. */
export const ROTULO_NOTAS = "Notas de la norma";

/**
 * Por qué las notas se repiten pegadas a cada cifra en vez de quedarse solo en el pie.
 *
 * Es la decisión de alcance de T-19 dicha en la página: resolver la excepción por puerto exige
 * saber en qué división CIEM cae cada dársena —geometría, que esta trayectoria no hace— y asignarla
 * mal daría un número seguro y falso.
 */
export const POR_QUE_LA_NOTA_VA_PEGADA =
  "Cuando una cifra tiene excepción, la excepción va escrita junto a ella y no solo aquí abajo: " +
  "hay especies cuya talla cambia según la zona, y el número sin su excepción es una cifra falsa " +
  "para quien pesca en la zona excepcionada. No se resuelve por puerto porque eso exige saber en " +
  "qué división del CIEM cae cada dársena, y asignarla mal daría un número seguro y equivocado.";

/** Cabeceras de la tabla. */
export const COLUMNA_ESPECIE = "Especie";
export const COLUMNA_TALLA = "Talla mínima";
export const COLUMNA_LITERAL = "Como lo escribe el BOE";

/** Lo que se escribe donde iría la cifra cuando la norma declara que no la ha fijado. */
export const SIN_TALLA_FIJADA = "La norma no fija talla";

/** Lo que se escribe cuando la celda del BOE no se puede leer como una talla. */
export const TALLA_ILEGIBLE = "La norma no imprime una talla legible";

/** Rótulo del nombre local canario, que solo trae el Anexo III. */
export const ROTULO_NOMBRE_LOCAL = "En Canarias";

/** Rótulo de la lista de fuentes al pie de la sección. */
export const ROTULO_FUENTES = "Fuentes de esta sección";
