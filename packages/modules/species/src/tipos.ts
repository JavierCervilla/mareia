/**
 * Lo que el módulo `species` consume del dataset `especies/v1` (`data/especies/catalogo.json`),
 * escrito en tipos.
 *
 * **No es la forma literal del fichero**, y la distinción importa desde que los dos carriles de
 * T-20 se juntaron. El dataset que publica el pipeline trae bastante más de lo que se pinta —la
 * cita que exige WoRMS, la autoridad de cada nombre, el WKT del recorte, la procedencia de cada
 * cifra del BOE— y lo agrupa a su manera. Quien traduce una cosa en la otra es el **adaptador** de
 * la web (`apps/web/src/modulos/especies/catalogo.ts`), que además es la frontera donde el JSON
 * deja de ser `unknown`. Este fichero es el otro extremo de esa traducción: lo mínimo con lo que se
 * puede escribir una fila sin mentir.
 *
 * La regla del adaptador, que es lo que mantiene honesta esa traducción: **renombra campos, nunca
 * reescribe valores**. `taxon` pasa a `worms` porque el nombre del campo es cosa nuestra; en cambio
 * `origen: "mareia"` viaja tal cual hasta aquí —y no traducido a un «nuestro» más bonito— porque es
 * una **firma de procedencia**, y un adaptador que reescribe firmas publica una que nadie estampó.
 *
 * Las tres piezas que mandan sobre todo lo demás, y las tres existen para que el catálogo no pueda
 * publicar una afirmación que no tiene:
 *
 * 1. **`nombreBoe` no es opcional y no tiene gemelo.** Es el nombre con el que la norma nombra a la
 *    especie —el que tiene consecuencia legal— y por eso es el único campo del que ningún camino
 *    del código puede prescindir. El taxón aceptado vive en `worms`, aparte, y **nunca lo
 *    sustituye**: el gate E1 mide justo eso sobre el `dist/`.
 * 2. **`rango` es una unión cerrada.** Que una talla aplique a un género entero —15 de las 86
 *    filas: `Sepia spp`, `Mullus spp`…— es un hecho jurídico. Modelarlo como texto libre dejaría
 *    que un día llegase «especie» en una fila `spp`, y convertir un género en una especie es
 *    inventarle a la norma un alcance que no tiene.
 * 3. **`PresenciaObis` no tiene ningún campo que se pueda leer como abundancia**: registros,
 *    conjuntos de datos y rango de años, y nada más. No hay densidad, no hay probabilidad y no hay
 *    geometría, porque la cifra mide **esfuerzo de muestreo** (12 registros de dorada en toda
 *    Galicia) y cualquier campo derivado que pareciese abundancia le daría a ese 12 un significado
 *    que no tiene. La frase que lo dice **no está aquí**: es una constante del módulo
 *    (`textos.ts`), por el hallazgo H-1 de T-21.
 *
 * **Lo mínimo no era tan poco: la frontera se ensanchó en T-20 y hay que decir por qué.** El pase
 * adversario encontró cinco roturas y las cinco caían aquí, después del último gate del dataset:
 * `especies/v1` traía las notas al pie de una talla, la fila del BOE sin binomio y el binomio que
 * WoRMS devolvió, y este contrato no tenía dónde ponerlos, así que el adaptador los tiraba. Una
 * cifra legal sin su excepción, una fila de la norma que desaparece en silencio y un `AphiaID` sin
 * el nombre al que apunta **no son detalles de presentación**: son las tres formas de que la página
 * publique menos verdad de la que el dato tiene. Lo que sigue siendo cierto es la regla: aquí sólo
 * entra lo que hace falta para escribir una fila **sin mentir**, y por eso el motivo de la ausencia
 * de OBIS entró como un booleano y no como el texto libre del JSON (ver `seLePreguntoAObis`).
 *
 * Lo que este dataset **no** trae, y no es un olvido: coordenadas de los registros de OBIS. La
 * trayectoria no publica mapas de distribución —con 12 registros de dorada en Galicia, un mapa es
 * una mentira dibujada—, así que si algún día aparecieran no habría dónde escribirlas aquí.
 */

import type { Talla } from "@mareia/module-regulations";

/**
 * El rango taxonómico al que se resuelve el nombre que escribe la norma.
 *
 * **Cuatro valores, medidos sobre el dataset publicado** y no elegidos de antemano: la norma nombra
 * 68 especies, 15 filas de género (`Sepia spp`, `Mullus spp`…) sobre **14 géneros distintos**
 * —`Mugil` sale dos veces, con la errata `Mugil spps` del Anexo II—, una **familia**
 * (`Palinuridae`) y una
 * **subespecie** (`Trisopterus minutus capelanus`). La primera versión de este tipo tenía dos, y no
 * era una simplificación deliberada: era una previsión escrita antes de que el dataset existiera.
 * Los dos casos raros son una fila cada uno y son exactamente los que un rango en dos valores
 * habría tenido que aplastar contra «especie», que es el error que este tipo existe para impedir.
 *
 * Sigue siendo una unión cerrada, y por el mismo motivo de siempre: un rango de texto libre deja
 * que un día llegue «especie» en una fila `spp`. No hay `desconocido`: cuando no se sabe, no hay
 * registro de WoRMS del que colgar un rango (`worms` es `null`) y el catálogo lo dice con esas
 * palabras en vez de rellenar el hueco.
 */
export type RangoDelNombre = "especie" | "genero" | "familia" | "subespecie";

/**
 * Cómo se llegó al registro de WoRMS: preguntándole el nombre del BOE tal cual, o con una
 * correspondencia **nuestra**.
 *
 * Es el campo que sostiene el gate E2 del carril A. Aquí se lee para una sola cosa, pero es la que
 * importa en la página: cuando el mapeo es nuestro, la fila lo dice y dice por qué. Un mapeo sin
 * dueño se lee como si lo firmase la fuente, que es lo mismo que una cifra inventada.
 *
 * `"mareia"` es el valor que escribe el dataset y llega hasta aquí **sin traducir**: es una firma de
 * procedencia, y el adaptador renombra campos pero no reescribe firmas (ver la cabecera).
 */
export type OrigenDeLaCorrespondencia = "worms" | "mareia";

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
  /** Especie, género, familia o subespecie. Lo que la norma nombra, sin convertir lo uno en lo otro. */
  readonly rango: RangoDelNombre;
  /** Ficha del taxón en WoRMS: el enlace con el que cualquiera comprueba esta fila. */
  readonly url: string;
  /**
   * El nombre aceptado hoy, **solo cuando difiere del que escribe la norma**; `null` cuando WoRMS
   * acepta el del BOE tal cual.
   *
   * Son 11 de los 86 (`Solea vulgaris` → `Solea solea`, `Psetta maxima` → `Scophthalmus
   * maximus`…). No es un error del BOE que haya que arreglar: la norma es de 1995 y la taxonomía se
   * mueve. Por eso son dos campos y no uno corregido.
   *
   * El dataset publica aquí el aceptado **siempre** que WoRMS lo dé, también cuando es el mismo
   * nombre; el adaptador lo deja en `null` en ese caso, porque lo que la página escribe sale de si
   * este campo aporta un nombre distinto o no. Repetir el binomio en 74 filas perdería las 11 que
   * de verdad difieren.
   */
  readonly aceptado: NombreEnWorms | null;
  /** Si el nombre se le preguntó a WoRMS tal cual o se llegó a él con una correspondencia nuestra. */
  readonly origen: OrigenDeLaCorrespondencia;
  /**
   * Qué correspondencia se hizo y por qué, cuando `origen` es `mareia`; `null` cuando el nombre
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
 * Una nota al pie del anexo **ya resuelta**: la marca que imprime el BOE y su texto entero.
 *
 * Es el campo que faltaba y por el que se cayó el hallazgo H-1 del pase adversario de T-20. El
 * dataset trae de cada talla las **marcas** (`["(***)"]`) y el texto de cada marca vive en
 * `normativa/v1`, que es de donde lo copia la tabla de las 153 páginas de puerto; entre los dos no
 * había contrato donde ponerlo, así que el catálogo publicaba «36 cm» y una llamada al pie que no
 * llevaba a ningún pie mientras la página del puerto publicaba la nota entera. **Un número sin su
 * excepción es una cifra legal falsa** para quien pesca en la zona excepcionada: la lubina son 36
 * cm salvo en las divisiones 8a y 8b del CIEM, donde son 44.
 *
 * El texto **no se hornea en `especies/v1`**: se resuelve en la frontera (el adaptador de la web,
 * que ya lee los dos derivados). Copiarlo al dataset del catálogo sería una segunda copia del
 * mismo texto legal, y dos copias de una cifra legal se corrigen en un sitio y no en el otro, que
 * es exactamente el defecto que este campo repara.
 */
export interface NotaDeLaTalla {
  /** La llamada tal y como la imprime el BOE: `(*)`, `(**)`, `(***)`. */
  readonly marca: string;
  /** El pie **entero**, sin resumir: es lo que cambia la cifra, así que no se puede glosar. */
  readonly texto: string;
}

/**
 * Una talla que un anexo le fija a una especie: la cifra, qué mide, el literal de la celda y **las
 * notas que la modifican**.
 *
 * `talla` es **la misma unión cerrada de cinco clases** de `normativa/v1` y se importa de
 * `@mareia/module-regulations` en vez de copiarse: ver la cabecera de `vista.ts`.
 */
export interface TallaDelAnexo {
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
  /**
   * Las notas del anexo que le aplican, **con su texto**. Vacío en las 108 tallas sin llamada.
   *
   * Viajan pegadas a la cifra y no en un pie de página al que haya que bajar, por lo mismo que en
   * `regulations`: la nota es parte de la cifra, no un comentario sobre ella.
   */
  readonly notas: readonly NotaDeLaTalla[];
}

/**
 * Una especie **en uno de los caladeros que la regulan**: **sus** tallas y **una** presencia.
 *
 * Las tallas y la presencia van por caladero porque las dos lo son: el BOE fija cifras distintas
 * para la misma especie en anexos distintos (la lisa son 20 cm en el Cantábrico y 16 en el
 * Mediterráneo) y la consulta a OBIS se hace por el recorte de un caladero.
 *
 * **La asimetría —tallas en plural, presencia en singular— es la forma del hecho, y es la que ya
 * emite el dataset.** El mismo anexo puede fijarle a una especie más de una talla —la cigala, por
 * cefalotórax y por longitud total—, mientras que la presencia es de la especie en el recorte y no
 * de cada medida. Una entrada por talla obligaría a repetir el recuento de OBIS dentro de la misma
 * fila, y 950 y 950 no son 1.900 registros: son el mismo dato dos veces.
 */
export interface EspecieEnCaladero {
  /** Identificador del caladero, el mismo que declara cada puerto en `data/geo/ports.json`. */
  readonly id: string;
  /** Nombre para leer («Mediterráneo»). */
  readonly nombre: string;
  /** El nombre común con el que **ese anexo** la nombra («Lisas» en uno, «Lisa» en otro). */
  readonly nombreComun: string;
  /** Las tallas que ese anexo le fija, en el orden del BOE. Casi siempre una; la cigala, dos. */
  readonly tallas: readonly TallaDelAnexo[];
  /** Lo que OBIS registra dentro del recorte de ese caladero; `null` si no hay cifra que publicar. */
  readonly presencia: PresenciaObis | null;
  /**
   * Si a OBIS **se le llegó a preguntar** por esta especie en este caladero. Es un hecho, no un
   * texto.
   *
   * Distingue los dos silencios que el dataset distingue y que no significan lo mismo: preguntarle
   * a OBIS y que no tenga ningún registro dentro del recorte (9 pares especie-caladero, y eso se
   * dice con `SIN_REGISTROS`) y **no haberle preguntado**, que es lo que pasa cuando el nombre no
   * resuelve en WoRMS y no hay taxón por el que consultar (una: `Lophius piscatorius, L.
   * Budegassa`, y eso se dice con `NO_SE_PREGUNTO_A_OBIS`). Publicar «nadie lo ha anotado ahí» en
   * el segundo caso sería afirmar algo sobre OBIS que no hemos comprobado.
   *
   * **Es un booleano y no la frase, y ésa es la corrección del hallazgo H-5 de T-20.** Antes viajaba
   * aquí el texto libre `presenciaAusente` del JSON y la vista lo imprimía tal cual, así que
   * plantando en ese campo «OBIS confirma que la especie no está presente en este caladero» la
   * afirmación salía publicada con los siete gates del pipeline y el build en verde. Es el mismo
   * hallazgo H-1 de T-21 en otro campo y se cierra igual: **la frase que sostiene la promesa vive
   * en el código** (`textos.ts`), y del dato sólo cruza el hecho de si se preguntó o no. El dataset
   * sigue guardando su motivo en `presenciaAusente` —es un derivado publicable por sí mismo y su
   * gate `errores_de_presencia` lo exige—, pero ese texto ya no se publica.
   */
  readonly seLePreguntoAObis: boolean;
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
  /**
   * Clave estable para el `data-especie` de la fila y para los gates. **La calcula el pipeline** y
   * aquí no se recalcula: recalcularla sería un segundo camino al mismo identificador, y un
   * segundo camino puede discrepar.
   *
   * Es única por especie y **no colapsa dos grafías de la norma**: el BOE escribe `Thunnus
   * thynnus` y `Thunnus Thynnus`, dos filas que cualquier slug en minúsculas convierte en una
   * (`clave_de` en `data/pipeline/mareia_pipeline/especies.py`). Que no se repita lo comprueba el
   * adaptador al leer, y el rechazo es duro: dos filas indistinguibles no se publican.
   */
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
  /** Los caladeros que la regulan, con sus tallas y su presencia. Nunca vacío: por eso está aquí. */
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
  /**
   * Cómo se llama ese rectángulo («Golfo de Cádiz»), porque un caladero puede tener más de uno.
   *
   * Sin el nombre, los tres rectángulos del caladero cantábrico-noroeste-golfo de Cádiz se
   * publicarían como tres filas con la misma etiqueta y tres pares de coordenadas distintos, que se
   * lee como una contradicción en vez de como lo que es: una consulta con tres recortes.
   */
  readonly nombre: string;
  readonly latMin: number;
  readonly latMax: number;
  readonly lonMin: number;
  readonly lonMax: number;
}

/** Con qué criterio se consultó la presencia, dicho por el propio dataset. */
export interface CriterioDelCatalogo {
  /**
   * Las cajas de todos los caladeros, **una o varias por caladero**. Sin ellas, ninguna cifra de
   * presencia se puede interpretar ni repetir.
   *
   * Son varias donde el caladero no cabe en un rectángulo: el del Cantábrico, noroeste y golfo de
   * Cádiz son tres —un único rectángulo que fuera del Cantábrico a Cádiz se tragaría el mar de
   * Alborán, que es del caladero mediterráneo— y se consultan a OBIS en una sola petición, porque
   * los recuentos de dos recortes no son sumables.
   */
  readonly cajas: readonly CajaDelCaladero[];
}

/**
 * Una fila del BOE a la que la norma le fija talla y **que este catálogo no puede publicar como
 * especie**, porque en esa celda no hay ningún nombre científico.
 *
 * Hoy es una: «Cigalas (colas)», Anexo I, 3,7 cm. La decisión de dejarla fuera está tomada y
 * razonada en el dataset (`sinNombreCientifico`), el pipeline la cuenta y `run.py check` la nombra;
 * lo que faltaba —hallazgo H-4 del pase adversario de T-20— era que **llegara a la página**. Sin
 * eso el catálogo dejaba fuera una cifra legal en silencio mientras afirmaba de sí mismo que no le
 * faltaba ninguna fila por decisión nuestra, y encima con consecuencia: son **tres** medidas del
 * mismo animal en el mismo anexo (cefalotórax 2 cm, longitud total 7 cm, colas 3,7 cm) y se
 * publicaban dos.
 *
 * Es la misma doctrina que el `sinResolver` de una especie o el `motivo` de un puerto sin áreas
 * protegidas: **una ausencia dice por qué lo es, o no se distingue de un fallo nuestro**. Lo que
 * no se hace es inventarle un binomio a la norma.
 */
export interface FilaDelBoeSinBinomio {
  /** Identificador del caladero cuyo anexo la fija, el mismo que usan las especies. */
  readonly caladero: string;
  /** El nombre común con el que la norma la nombra, literal («Cigalas (colas)»). */
  readonly nombreComun: string;
  /** Por qué no se publica como especie. Nunca un hueco mudo. */
  readonly motivo: string;
  /** La talla que el anexo le fija, en la clase que le corresponda. Es una cifra legal. */
  readonly talla: Talla;
  /** El literal de la celda del BOE, para poder comparar lo pintado con lo publicado. */
  readonly textoOriginal: string;
}

/** El dataset entero. */
export interface CatalogoDeEspecies {
  readonly schema: string;
  readonly fuentes: FuentesDelCatalogo;
  readonly criterio: CriterioDelCatalogo;
  readonly especies: readonly EspecieDelCatalogo[];
  /**
   * Las filas del BOE que se quedan fuera del catálogo y **por qué**. Hoy, una.
   *
   * Está en el contrato —y no sólo en el dataset— porque es lo que impide que el catálogo se
   * declare completo cuando no lo está: si el día de mañana la norma añade otra fila sin binomio,
   * la página la nombra sola.
   */
  readonly sinNombreCientifico: readonly FilaDelBoeSinBinomio[];
}
