/**
 * La forma del dataset `normativa/v1` (`data/normativa/tallas-minimas.json`), escrita en tipos.
 *
 * Es el **contrato de lectura** entre el pipeline que construye el fichero y esta interfaz. Vive en
 * el módulo y no en la web porque quien tiene que saber qué es una talla mínima es el módulo; la
 * web solo sabe leer un JSON y dárselo (`apps/web/src/modulos/normativa.ts`).
 *
 * La pieza que manda sobre todo lo demás es `Talla`: la columna del BOE se titula «Talla (en cm)» y
 * **no contiene solo tallas en cm** —17 de las 118 publicadas no lo son—, así que modelarla como
 * `number` sería un tipo falso que obliga a inventarse un número en 17 celdas. Es una unión cerrada
 * de cinco clases y `textoOriginal` acompaña **siempre** al valor, en las cinco: quien lee puede
 * comparar lo que pintamos con lo que dice la norma sin salir de la página.
 */

/**
 * La talla mínima de una especie, en las cinco formas en que la norma la escribe.
 *
 * No hay `default` posible sobre esta unión y ese es el punto: pintar un `por_determinar` o un
 * `sin_dato_legible` como si fuese un número es publicar una cifra legal que la norma no dice.
 * `vista.ts` la recorre con un `switch` exhaustivo cerrado con `never`, así que **añadir una sexta
 * clase no compila** hasta que alguien decida cómo se escribe.
 */
export type Talla =
  /** Longitud en centímetros; admite decimal (`3,7` en las colas de cigala). */
  | { readonly tipo: "longitud_cm"; readonly cm: number }
  /** La norma fija **peso**, no longitud (`6,4 kg` del atún rojo, `1 kg` del pulpo). */
  | { readonly tipo: "peso_kg"; readonly kg: number }
  /** Cualquiera de las dos vale (`80 cm o 10 kg de peso`, atún rojo del Anexo II). */
  | { readonly tipo: "longitud_o_peso"; readonly cm: number; readonly kg: number }
  /** La norma **declara** que no la ha fijado; el motivo está en la nota que se cita. */
  | { readonly tipo: "por_determinar"; readonly segunNota: string }
  /** La celda no se puede leer como talla y **no se arregla** (el `1 1` de la boga). */
  | { readonly tipo: "sin_dato_legible"; readonly motivo: string };

/** De dónde sale **esa** cifra: el gate G1 exige que cada una lo declare. */
export interface Procedencia {
  /** Bloque del texto consolidado (`ani`, `anii`, `aniii`). */
  readonly bloque: string;
  /** Fecha en la que entró en vigor la redacción de la que se leyó (`YYYY-MM-DD`). */
  readonly fechaVigencia: string;
  /** ELI de la norma, que es el texto auténtico. */
  readonly eli: string;
}

/** Una nota al pie de un anexo, con la marca que la referencia desde la tabla. */
export interface NotaDeCaladero {
  /** `(*)`, `(**)`, `(***)` — tal y como la imprime el BOE. */
  readonly marca: string;
  /** El texto entero de la nota. */
  readonly texto: string;
}

/** Una fila de la tabla de un anexo: una especie y una medida suya. */
export interface EspecieConTalla {
  /** Nombre común tal y como lo escribe la norma. */
  readonly nombreComun: string;
  /** Binomio latino, cuando la norma lo da. */
  readonly nombreCientifico?: string;
  /** Por qué no hay binomio, cuando la norma no lo da. Nunca un hueco mudo. */
  readonly nombreCientificoAusente?: string;
  /** Nombre local canario (solo Anexo III), cuando la norma lo da. */
  readonly nombreLocalCanario?: string;
  /** Por qué falta el nombre local canario, cuando la norma deja la celda vacía. */
  readonly nombreLocalCanarioAusente?: string;
  /**
   * Qué se mide, cuando una especie se mide de más de una forma: el BOE cuelga de
   * `Cigala (entera)` dos filas —`Longitud cefalotórax` y `Longitud total`— con cifras distintas.
   */
  readonly medida?: string;
  /** La talla, en la clase que le corresponda. */
  readonly talla: Talla;
  /** El literal de la celda del BOE. Está **siempre**, en las cinco clases. */
  readonly textoOriginal: string;
  /** Marcas de las notas que le aplican: la cifra no se pinta sin ellas. */
  readonly notas: readonly string[];
  /** Procedencia de esta cifra (G1). */
  readonly procedencia: Procedencia;
}

/** Uno de los tres caladeros del RD 560/1995, con su anexo y su tabla. */
export interface Caladero {
  /** Identificador estable; es el que declara cada puerto en `data/geo/ports.json`. */
  readonly id: string;
  /** Nombre para leer («Mediterráneo»). */
  readonly nombre: string;
  /** Rótulo entero del anexo en el BOE. */
  readonly titulo: string;
  /** `ANEXO I` / `ANEXO II` / `ANEXO III`. */
  readonly anexo: string;
  /** Bloque del texto consolidado del que se leyó. */
  readonly bloque: string;
  /** Fecha en la que entró en vigor la redacción publicada (`YYYY-MM-DD`). */
  readonly fechaVigencia: string;
  /** Fecha de la última actualización del bloque, la señal que vigila el gate G2. */
  readonly fechaActualizacionBloque: string;
  /** Norma que dio esa redacción (`BOE-A-2025-22024`). */
  readonly normaModificadora: string;
  /** Notas al pie de la versión en vigor. */
  readonly notas: readonly NotaDeCaladero[];
  /** Las filas del anexo. */
  readonly especies: readonly EspecieConTalla[];
}

/** La norma, su licencia, su aviso de autenticidad y el día en que se comprobó que sigue viva. */
export interface FuenteNormativa {
  readonly norma: string;
  readonly identificador: string;
  readonly eli: string;
  readonly textoConsolidado: string;
  /** Última actualización del texto consolidado según el BOE (`YYYY-MM-DD`). */
  readonly fechaActualizacion: string;
  readonly licencia: string;
  readonly licenciaUrl: string;
  /** «Solo el texto publicado en el BOE tiene carácter auténtico.» */
  readonly aviso: string;
  /**
   * El día en que una máquina comprobó contra el BOE que la norma sigue en vigor (gate G2).
   *
   * **La interfaz lo imprime y no lo recalcula.** Es el único dato de esta sección que envejece, y
   * envejece porque G2 deja de tocarlo cuando no puede preguntar; recomponerlo aquí con el reloj
   * del build diría «comprobado hoy» los días en que nadie comprobó nada.
   */
  readonly verificadoEn: string;
}

/** El dataset entero. */
export interface Normativa {
  readonly schema: string;
  readonly fuente: FuenteNormativa;
  readonly caladeros: readonly Caladero[];
}
