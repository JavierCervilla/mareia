/**
 * La forma del dataset `especies/v1` (`data/especies/catalogo.json`), escrita en tipos.
 *
 * Es el **contrato de lectura** entre el pipeline que lo construye (carril A de T-20) y esta
 * interfaz. Vive en el módulo y no en la web por lo mismo que `regulations` y `protected-areas`:
 * quien tiene que saber qué es una especie regulada es el módulo; la web solo sabe abrir un JSON y
 * dárselo (`apps/web/src/modulos/especies.ts`).
 *
 * Las tres piezas que mandan sobre todo lo demás, y las tres existen para que el catálogo no pueda
 * publicar una afirmación que no tiene:
 *
 * 1. **`nombreBoe` no es opcional y no tiene gemelo.** Es el nombre con el que la norma nombra a la
 *    especie —el que tiene consecuencia legal— y por eso es el único campo del que ningún camino
 *    del código puede prescindir. El taxón aceptado vive en `worms`, aparte, y **nunca lo
 *    sustituye**: el gate E1 mide justo eso sobre el `dist/`.
 * 2. **`rango` es una unión cerrada de dos valores.** 15 de los 86 nombres del BOE son un
 *    **género** (`Sepia spp`, `Mullus spp`…) y que la talla aplique a todo el género es un hecho
 *    jurídico. Modelarlo como texto libre dejaría que un día llegase «especie» en una fila `spp`, y
 *    convertir un género en una especie es inventarle a la norma un alcance que no tiene.
 * 3. **`PresenciaObis` no tiene ningún campo que se pueda leer como abundancia**: registros,
 *    conjuntos de datos y rango de años, y nada más. No hay densidad, no hay probabilidad y no hay
 *    geometría, porque la cifra mide **esfuerzo de muestreo** (12 registros de dorada en toda
 *    Galicia) y cualquier campo derivado que pareciese abundancia le daría a ese 12 un significado
 *    que no tiene. La frase que lo dice **no está aquí**: es una constante del módulo
 *    (`textos.ts`), por el hallazgo H-1 de T-21.
 *
 * Lo que este dataset **no** trae, y no es un olvido: coordenadas de los registros de OBIS. La
 * trayectoria no publica mapas de distribución —con 12 registros de dorada en Galicia, un mapa es
 * una mentira dibujada—, así que si algún día aparecieran no habría dónde escribirlas aquí.
 */

import type { Talla } from "@mareia/module-regulations";

/**
 * El rango taxonómico al que se resuelve el nombre que escribe la norma.
 *
 * Dos valores porque dos son los que el BOE usa: nombra especies y nombra géneros. No hay
 * `desconocido`: cuando no se sabe, no hay registro de WoRMS del que colgar un rango (`worms` es
 * `null`) y el catálogo lo dice con esas palabras en vez de rellenar el hueco.
 */
export type RangoDelNombre = "especie" | "genero";

/**
 * Cómo se llegó al registro de WoRMS: preguntándole el nombre del BOE tal cual, o con una
 * correspondencia **nuestra**.
 *
 * Es el campo que sostiene el gate E2 del carril A. Aquí se lee para una sola cosa, pero es la que
 * importa en la página: cuando el mapeo es nuestro, la fila lo dice y dice por qué. Un mapeo sin
 * dueño se lee como si lo firmase la fuente, que es lo mismo que una cifra inventada.
 */
export type OrigenDeLaCorrespondencia = "worms" | "nuestro";

/** Un nombre de WoRMS con su identificador, que es lo que permite comprobarlo sin fiarse del texto. */
export interface NombreEnWorms {
  /** `AphiaID`: la clave estable de WoRMS. Es lo que hace verificable todo lo demás. */
  readonly aphiaId: number;
  /** El binomio (o el nombre del género), tal y como lo escribe WoRMS. */
  readonly nombre: string;
}

/** Lo que WoRMS sabe del nombre que escribe la norma. `null` en el dataset cuando no resuelve. */
export interface TaxonEnWorms extends NombreEnWorms {
  /**
   * El estado del nombre **en las palabras de WoRMS** (`accepted`, `unaccepted`, `alternate
   * representation`…), sin traducir y sin glosar.
   *
   * Es una cita, no una etiqueta nuestra, y por eso es `string` y no una unión cerrada: el
   * vocabulario es de un tercero y cerrarlo aquí haría que el build se rompiese el día que WoRMS
   * use un estado que no habíamos previsto —justo cuando lo interesante sería publicarlo—. Lo que
   * la página escribe **no sale de esta palabra**: sale de si `aceptado` es `null` o no, que es un
   * hecho estructural. El estado se publica entrecomillado y tal cual, como el `textoOriginal` de
   * una talla.
   */
  readonly estado: string;
  /** Especie o género. La norma nombra las dos cosas y no se convierte la una en la otra. */
  readonly rango: RangoDelNombre;
  /** Ficha del taxón en WoRMS: el enlace con el que cualquiera comprueba esta fila. */
  readonly url: string;
  /**
   * El nombre aceptado hoy, **solo cuando difiere del que escribe la norma**; `null` cuando WoRMS
   * acepta el del BOE tal cual.
   *
   * Son 10 de los 86 (`Solea vulgaris` → `Solea solea`, `Psetta maxima` → `Scophthalmus
   * maximus`…). No es un error del BOE que haya que arreglar: la norma es de 1995 y la taxonomía se
   * mueve. Por eso son dos campos y no uno corregido.
   */
  readonly aceptado: NombreEnWorms | null;
  /** Si el nombre se le preguntó a WoRMS tal cual o se llegó a él con una correspondencia nuestra. */
  readonly origen: OrigenDeLaCorrespondencia;
  /**
   * Qué correspondencia se hizo y por qué, cuando `origen` es `nuestro`; `null` cuando el nombre
   * del BOE resolvió tal cual.
   *
   * Obligatorio en ese caso —el lector defensivo de la web lo exige y `filasDeEspecies` lo
   * publica—: el mapeo es nuestro, así que su motivo también tiene que serlo y estar a la vista.
   */
  readonly comoSeLlego: string | null;
}

/**
 * Lo que OBIS registra de una especie dentro de la caja envolvente de un caladero.
 *
 * **Es esfuerzo de muestreo, no abundancia**, y esta interfaz está construida para que no se pueda
 * leer de otra forma: son las tres cifras que OBIS publica y ninguna derivada. La dorada en toda la
 * costa gallega son 12 registros y en el conjunto de OBIS pasa de 18.000; nadie que conozca la ría
 * de Arousa diría que allí hay doce doradas.
 */
export interface PresenciaObis {
  /** Registros de presencia (`occurrences`) dentro de la caja. */
  readonly registros: number;
  /** De cuántos conjuntos de datos distintos salen. Un solo dataset es una sola campaña. */
  readonly datasets: number;
  /** Primer año con registro; `null` si OBIS no lo publica. */
  readonly desde: number | null;
  /** Último año con registro; `null` si OBIS no lo publica. */
  readonly hasta: number | null;
}

/**
 * Una especie **en uno de los caladeros que la regulan**: qué talla le fija ese anexo y qué
 * presencia tiene registrada ahí.
 *
 * La talla y la presencia van juntas y por caladero porque las dos lo son: el BOE fija cifras
 * distintas para la misma especie en anexos distintos (la lisa son 20 cm en el Cantábrico y 16 en
 * el Mediterráneo) y la consulta a OBIS se hace por caja envolvente de caladero.
 *
 * `talla` es **la misma unión cerrada de cinco clases** de `normativa/v1` y se importa de
 * `@mareia/module-regulations` en vez de copiarse: ver la cabecera de `vista.ts`.
 */
export interface EspecieEnCaladero {
  /** Identificador del caladero, el mismo que declara cada puerto en `data/geo/ports.json`. */
  readonly id: string;
  /** Nombre para leer («Mediterráneo»). */
  readonly nombre: string;
  /** El nombre común con el que **ese anexo** la nombra («Lisas» en uno, «Lisa» en otro). */
  readonly nombreComun: string;
  /**
   * Qué se mide, cuando el anexo mide la misma especie de más de una forma; `null` cuando no lo
   * dice.
   *
   * No es un adorno heredado de `normativa/v1`: sin esto, `Nephrops norvegicus` publica en el mismo
   * caladero **2 cm y 7 cm** sin decir que la primera es longitud del cefalotórax y la segunda
   * longitud total, y dos cifras legales que se contradicen se leen como un error del catálogo —o,
   * peor, se cree la pequeña—. Son cuatro filas: la cigala en el Cantábrico y en el Mediterráneo.
   */
  readonly medida: string | null;
  /** La talla mínima que ese anexo le fija, en la clase que le corresponda. */
  readonly talla: Talla;
  /** El literal de la celda del BOE, para poder comparar lo pintado con lo publicado. */
  readonly textoOriginal: string;
  /** Lo que OBIS registra dentro de la caja de ese caladero; `null` si no hay ningún registro. */
  readonly presencia: PresenciaObis | null;
}

/** Una de las 86 especies que el BOE regula. */
export interface EspecieDelCatalogo {
  /**
   * El nombre científico **tal y como lo escribe la norma**, literal y sin corregir.
   *
   * Es la clave del catálogo y el único campo que la página no puede dejar de publicar: es el que
   * tiene consecuencia legal. Cuando la norma escribe `Cáncer pagurus` con una tilde que el latín
   * no lleva, aquí pone `Cáncer pagurus`.
   */
  readonly nombreBoe: string;
  /** Clave estable para el `data-especie` de la fila y para los gates. La calcula el pipeline. */
  readonly clave: string;
  /** Lo que WoRMS sabe de ese nombre; `null` cuando no resuelve. */
  readonly worms: TaxonEnWorms | null;
  /**
   * Por qué no resuelve, cuando `worms` es `null`. Nunca un hueco mudo.
   *
   * Es la misma doctrina que el `motivo` de un puerto sin áreas protegidas o que el
   * `nombreCientificoAusente` de una fila del BOE sin binomio: una ausencia dice por qué lo es, o
   * no se distingue de un fallo nuestro.
   */
  readonly sinResolver: string | null;
  /** Los caladeros que la regulan, con su talla y su presencia. Nunca vacío: por eso está aquí. */
  readonly caladeros: readonly EspecieEnCaladero[];
}

/** Una fuente externa del catálogo, con su licencia y el día en que se le preguntó. */
export interface FuenteDelCatalogo {
  readonly nombre: string;
  readonly url: string;
  /** Licencia declarada por la fuente. WoRMS es CC-BY con una condición que se publica aparte. */
  readonly licencia: string;
  /** Día de la consulta (`YYYY-MM-DD`). Una resolución taxonómica envejece, y se dice cuándo se hizo. */
  readonly consultadoEn: string;
}

/** Las dos fuentes externas del catálogo. El BOE no está aquí: lo publica `regulations`. */
export interface FuentesDelCatalogo {
  readonly worms: FuenteDelCatalogo;
  readonly obis: FuenteDelCatalogo;
}

/**
 * La caja envolvente con la que se consultó OBIS para un caladero, **declarada en el dataset**.
 *
 * Va en el dato y no escondida en el código porque es la mitad del significado de la cifra: 12
 * registros «en Galicia» no quiere decir nada si no se sabe qué rectángulo es Galicia. La caja **no
 * es la costa** y mete mar de más; eso se dice en la página (`LA_CAJA_NO_ES_LA_COSTA`).
 */
export interface CajaDelCaladero {
  /** Identificador del caladero al que corresponde la caja. */
  readonly caladero: string;
  readonly latMin: number;
  readonly latMax: number;
  readonly lonMin: number;
  readonly lonMax: number;
}

/** Con qué criterio se consultó la presencia, dicho por el propio dataset. */
export interface CriterioDelCatalogo {
  /** Una caja por caladero. Sin ella, ninguna cifra de presencia se puede interpretar. */
  readonly cajas: readonly CajaDelCaladero[];
}

/** El dataset entero. */
export interface CatalogoDeEspecies {
  readonly schema: string;
  readonly fuentes: FuentesDelCatalogo;
  readonly criterio: CriterioDelCatalogo;
  readonly especies: readonly EspecieDelCatalogo[];
}
