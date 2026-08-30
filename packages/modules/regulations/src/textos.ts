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

import { DIAS_SELLO_CORRIENTE, DIAS_SELLO_RANCIO } from "./vigencia.ts";
import type { EstadoDeVigencia } from "./vigencia.ts";

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
 * Cómo se rotula la fila del sello de vigencia, **según el estado en que esté**.
 *
 * No es un adorno: mientras el gate diario escribe, la página puede decir «comprobada»; cuando
 * lleva días sin escribir, esa palabra es una afirmación que no se sostiene y lo único que la fila
 * puede decir es **cuándo fue la última vez**. Cambiar el rótulo es la mitad barata de la
 * degradación; la otra mitad es `avisoDeVigencia`, que dice lo que eso significa para quien lee.
 */
export function rotuloDeVigencia(estado: EstadoDeVigencia): string {
  return estado === "comprobada"
    ? "Vigencia comprobada contra el BOE el"
    : "Última vez que se comprobó la vigencia contra el BOE";
}

/**
 * Lo que la sección dice de más cuando el sello ha envejecido, y `null` cuando no hay nada que
 * decir.
 *
 * Los dos avisos se escriben con una **cota inferior** («hace más de N días») a propósito: este
 * HTML es estático y se queda en el teléfono de quien lo abra, así que una cuenta exacta se
 * volvería mentira al día siguiente y una cota inferior sigue siendo verdad. Los umbrales se
 * interpolan desde `vigencia.ts` en vez de escribirse a mano para que el texto no pueda quedarse
 * diciendo «una semana» el día que alguien mueva el número.
 *
 * El `switch` no tiene `default` y cierra con `never`, igual que el de las cinco clases de talla:
 * un cuarto estado de vigencia no compilará hasta que alguien decida qué le dice a quien lee.
 */
export function avisoDeVigencia(estado: EstadoDeVigencia): string | null {
  switch (estado) {
    case "comprobada":
      return null;
    case "envejecida":
      return (
        `Hace más de ${DIAS_SELLO_CORRIENTE} días que no se comprueba que esta norma siga en ` +
        "vigor. La comprobación contra el BOE es diaria, así que esto significa que no está " +
        "corriendo: las cifras de abajo son las de la última ingesta y pueden haber cambiado sin " +
        "que esta página se entere."
      );
    case "sin_comprobar":
      return (
        `Hace más de ${DIAS_SELLO_RANCIO} días que no se comprueba que esta norma siga en vigor, ` +
        "así que esta página no puede decir que estas cifras sean las que están en vigor hoy. " +
        "Antes de quedarte una pieza, contrasta la talla con el texto consolidado del BOE: es el " +
        "único texto auténtico y aquí abajo está el enlace."
      );
    default: {
      const imposible: never = estado;
      throw new Error(`estado de vigencia no contemplado: ${JSON.stringify(imposible)}`);
    }
  }
}

/**
 * El aviso de lectura sin red, y es **duro a propósito**.
 *
 * El módulo declara `offline: cache-first`, o sea que la copia guardada se sirve sin preguntar a la
 * red —decisión del humano, frente a la recomendación de ocultar la tabla— y lo que se lee puede
 * ser de hace semanas. La sección no tiene JavaScript con el que enterarse de si hay red ni de si
 * este puerto está guardado, así que el aviso no se enciende: **está siempre**, escrito para que
 * sea verdad en los dos casos.
 *
 * **La primera frase es condicional, y esa condición es la mitad del aviso.** La versión anterior
 * empezaba diciendo «esta tabla se guarda para leerla sin cobertura» en las 153 páginas de puerto,
 * y el pase adversario lo midió falso por defecto (hallazgo H-4): quien guarda la página de un
 * puerto es la caja de favoritos del core —«un favorito guarda su página, sus constantes, el camino
 * hasta ella y sus assets; nada más»—, así que sin marcar ese puerto no hay copia, y sin red no hay
 * tabla sino el error de red del navegador. Se corrige **el texto y no el precacheo**: guardar 153
 * páginas que nadie ha pedido es un coste que el modelo de favoritos rechaza a propósito. Una
 * afirmación sobre lo que hace la aplicación tiene que ser verdad donde está escrita, y aquí está
 * escrita en las 153.
 */
export const AVISO_SIN_RED =
  "Si guardas este puerto, esta tabla se guarda con él y se puede leer sin cobertura; el resto " +
  "del sitio no se guarda solo. Cuando la leas sin red puedes estar viendo una copia de hace " +
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
