/**
 * Los textos del catálogo de especies, en un solo sitio.
 *
 * Viven aquí y no dentro de las plantillas por lo mismo que los de `regulations` y los de
 * `protected-areas`: son **requisito de producto** —esta trayectoria se permite publicar un número
 * de registros de OBIS únicamente porque va acompañado de lo que ese número significa— y hay gates
 * que los buscan en el `dist/` construido. Un texto escrito dentro de un componente se puede
 * suavizar en un commit de estilo sin que nadie lo note.
 *
 * **Y por eso ninguna de las dos frases duras viaja en el dataset**, aunque el dataset sea nuestro y
 * tenga sus propios gates. Es la lección del hallazgo H-1 del pase adversario de T-21: allí el aviso
 * que sostenía la promesa de la trayectoria («esto dice dónde NO se puede pescar, nunca dónde sí»)
 * era un campo de texto libre del JSON, y un aviso plantado de los mismos bytes se publicó en las
 * 153 páginas con toda la escalera en verde. Aquí la frase que impide leer 12 registros como doce
 * doradas (`SESGO_JUNTO_A_LA_CIFRA`) y la que dice que la caja envolvente no es la costa
 * (`LA_CAJA_NO_ES_LA_COSTA`) son **constantes del código**: cambiarlas es un diff revisado, y un
 * gate del artefacto las busca literales.
 *
 * Lo que **sí** sale del dato y se publica tal cual: la licencia y la fecha de consulta de cada
 * fuente, que son hechos sobre la fuente y no afirmaciones nuestras, y el estado con que WoRMS
 * califica cada nombre, que es una cita.
 */

import type { PresenciaObis, RangoDelNombre } from "./tipos.ts";

// =================================================================================================
// El catálogo: qué es y por qué publica dos nombres
// =================================================================================================

/**
 * Rótulo del catálogo. Nombra **cuántas son y de dónde salen**, porque las dos cosas acotan lo que
 * hay debajo: no es un catálogo de la fauna de la costa española, es la lista cerrada de las
 * especies a las que el RD 560/1995 le fija una talla mínima. El número no se teclea: lo cuenta
 * `censoDelCatalogo` desde el propio dataset.
 */
export function tituloDelCatalogo(especies: number): string {
  return `Las ${especies} especies que el BOE regula`;
}

/**
 * Qué es esto, antes del primer nombre.
 *
 * Dice las tres cosas que cambian cómo se lee la tabla: que la lista **la fija la norma** y no
 * nosotros, que de cada especie se publican **dos nombres** y por qué, y que la talla que aparece
 * es la del caladero de esa fila y no una talla nacional.
 */
export const QUE_ES_ESTE_CATALOGO =
  "Las especies a las que el Real Decreto 560/1995 le fija una talla mínima de captura, con el " +
  "nombre que usa la norma y el nombre que la ciencia acepta hoy. La lista la fija el BOE: ni " +
  "sobra ninguna ni falta ninguna por decisión nuestra. La talla que se publica en cada fila es la " +
  "del caladero que la fija, y la misma especie tiene cifras distintas en anexos distintos.";

/**
 * Por qué se publican dos nombres, dicho como lo que es y no como un error de nadie.
 *
 * Es el texto con más criterio del catálogo. La tentación fácil sería publicar un solo nombre —el
 * «bueno»— y quedarse tranquilo; elegir uno obliga a decidir entre mentir sobre la ley o mentir
 * sobre la taxonomía. Se publican los dos, y esta frase dice por qué difieren: **la norma es de
 * 1995 y la taxonomía se movió**, no que el BOE se equivocara.
 */
export const POR_QUE_DOS_NOMBRES =
  "La norma es de 1995 y la taxonomía se ha movido desde entonces: hay especies a las que el BOE " +
  "nombra con un nombre que hoy es sinónimo de otro. No es un error de la norma ni algo que haya " +
  "que corregir. El nombre del BOE es el que tiene consecuencia legal —es el que aparece en una " +
  "inspección— y el aceptado es el que sirve para buscar la especie en cualquier otra base de " +
  "datos. Aquí están los dos, cada uno con su fuente, y el de la norma no se sustituye nunca.";

/** Rótulo de la columna del nombre que escribe la norma. */
export const COLUMNA_NOMBRE_BOE = "Nombre en el BOE";

/** Rótulo de la columna del taxón de WoRMS. */
export const COLUMNA_TAXON = "Taxón aceptado hoy";

/** Rótulo de la columna de caladeros y tallas. */
export const COLUMNA_CALADEROS = "Caladeros que la regulan";

/** Rótulo de la columna de presencia. */
export const COLUMNA_PRESENCIA = "Registros en OBIS";

/**
 * Cómo se rotula el enlace a la ficha de WoRMS.
 *
 * Dice **de qué nombre es la ficha**, y no es una precisión gratuita: en las 11 filas en las que
 * hay dos nombres y dos identificadores, un «AphiaID 127160» a secas no diría a cuál de los dos
 * pertenece, y quien fuera a comprobarlo abriría el que no es.
 */
export function fichaEnWorms(aphiaId: number): string {
  return `Ficha del nombre de la norma en WoRMS · AphiaID ${aphiaId}`;
}

/** Cómo se rotula el identificador del nombre aceptado, que es otro registro distinto. */
export function aphiaDelAceptado(aphiaId: number): string {
  return `AphiaID ${aphiaId}`;
}

/**
 * Lo que se escribe en la columna del taxón cuando WoRMS acepta el nombre del BOE tal cual.
 *
 * No se deja en blanco ni se repite el binomio: una celda vacía se lee como «esto no lo hemos
 * mirado», y repetirlo haría que las 11 filas en las que sí difiere se perdieran entre las 74
 * idénticas. Se dice el hecho, que es que aquí no hay distancia entre la ley y la ciencia.
 */
export const MISMO_NOMBRE = "WoRMS acepta el nombre de la norma.";

/**
 * Cómo se dice que el nombre aceptado difiere del de la norma.
 *
 * El verbo importa: WoRMS **remite** a otro nombre, no «corrige» el del BOE. El estado va
 * entrecomillado y en las palabras de WoRMS —es una cita, como el literal de una talla— para que
 * quien lea pueda contrastarlo con la ficha enlazada sin traducir nada de vuelta.
 */
export function remiteA(estado: string, aceptado: string): string {
  return `WoRMS registra este nombre como «${estado}» y remite a ${aceptado}.`;
}

// =================================================================================================
// El género, que no se convierte en especie
// =================================================================================================

/**
 * Cómo se rotula el rango de una fila.
 *
 * **Se rotula todo lo que no es una especie**, que son 17 de las 86: 15 filas de género (sobre 14
 * géneros distintos: `Mugil` sale dos veces), una familia
 * (`Palinuridae`, las langostas) y una subespecie (`Trisopterus minutus capelanus`). Son los casos
 * que cambian lo que la fila significa —a qué alcance se aplica la talla mínima— y por eso son los
 * que llevan rótulo; un «especie» en las otras 68 sería ruido que además le restaría fuerza a
 * éstos.
 *
 * Los tres rótulos dicen «no especie» y no sólo el rango, porque un rango a secas se lee como una
 * precisión taxonómica y esto no lo es: es el alcance de una norma. El `never` del final obliga a
 * decidir qué se escribe el día que el dataset traiga un rango nuevo, en vez de dejar la fila muda.
 */
export function rangoEscrito(rango: RangoDelNombre): string | null {
  switch (rango) {
    case "especie":
      return null;
    case "genero":
      return "género, no especie";
    case "familia":
      return "familia, no especie";
    case "subespecie":
      return "subespecie, no especie";
    default: {
      const nunca: never = rango;
      return nunca;
    }
  }
}

/**
 * Qué significa que una fila sea de rango género, dicho donde se lee.
 *
 * **Es un hecho jurídico y por eso se publica**: cuando la norma escribe `Sepia spp` la talla
 * mínima aplica a todo el género, no a una especie concreta. Elegirle una especie —la más común, la
 * que más se pesca— sería inventarle a la norma un alcance que no tiene, y del lado que multa.
 */
export const EL_GENERO_APLICA_A_TODO_EL_GENERO =
  "Cuando la norma escribe el género seguido de «spp» está regulando el género entero: la talla " +
  "mínima se aplica a todas sus especies. Aquí no se le elige ninguna, porque eso sería " +
  "estrecharle a la norma un alcance que la norma no estrecha. Por eso lleva rótulo todo lo que " +
  "no es una especie: además de los géneros, la norma nombra una familia entera (Palinuridae) y " +
  "una subespecie, y en los tres casos lo que cambia es a qué alcanza la talla.";

/**
 * Cómo se publica una correspondencia que no viene de WoRMS: **con dueño**.
 *
 * Cuando el nombre del BOE no resuelve tal cual y hemos sido nosotros quienes hemos decidido a qué
 * apunta —quitarle el `spp` a un género, leer `Cáncer` como `Cancer`—, eso no es un hecho de la
 * fuente. Va marcado como nuestro y con su motivo delante: un mapeo sin dueño se lee como si lo
 * firmase WoRMS, y eso es lo mismo que una cifra inventada.
 */
export function correspondenciaNuestra(motivo: string): string {
  return `Correspondencia nuestra, no de WoRMS: ${motivo}`;
}

// =================================================================================================
// LA REGLA DURA DE LA TRAYECTORIA · la presencia no es abundancia
// =================================================================================================

/**
 * **La frase que va pegada a cada cifra de presencia, y por eso es corta.**
 *
 * Es el equivalente exacto de la nota pegada a la talla en `regulations`: allí un número sin su
 * excepción es una cifra legal falsa; aquí un número de registros sin esto se lee como abundancia,
 * y entonces «12» dice que en toda la costa gallega hay doce doradas. Va **dentro de la misma
 * celda**, no en un pie al que haya que bajar, y el gate E4 lo mide sobre el `dist/`: ningún número
 * de registros se publica sin esta frase en su mismo bloque.
 *
 * Corta a propósito: se repite en cada fila y en cada caladero de cada fila. La explicación larga
 * —qué mide OBIS y qué no— es `LA_PRESENCIA_NO_ES_ABUNDANCIA`, que se dice una vez arriba.
 */
export const SESGO_JUNTO_A_LA_CIFRA = "esfuerzo de muestreo, no abundancia";

/**
 * La explicación larga, arriba del todo y antes de la primera cifra.
 *
 * Lleva el ejemplo medido dentro —la dorada gallega— porque una advertencia abstracta sobre sesgo
 * de muestreo no la lee nadie, y ese número la hace evidente en una frase. Es el mismo criterio con
 * el que `rmse_m` se publica como cota y no como precisión: el dato pobre se publica con su método
 * a la vista, no se maquilla.
 */
export const LA_PRESENCIA_NO_ES_ABUNDANCIA =
  // La frase corta se **compone** dentro de la larga en vez de reescribirse: así las dos no pueden
  // separarse en dos commits distintos, y el gate E4 —que exige la corta en el mismo bloque que
  // cualquier cifra— se cumple también aquí, donde el párrafo cita la cifra de la dorada.
  `Los registros de OBIS son ${SESGO_JUNTO_A_LA_CIFRA}: miden dónde ha ido alguien a mirar y lo ` +
  "ha anotado, no cuánta especie hay. La dorada en toda la costa gallega son 12 registros, de 3 " +
  "conjuntos de datos: nadie que conozca la ría de Arousa diría que allí hay doce doradas. Una " +
  "cifra alta significa que esa " +
  "especie está bien muestreada y una baja puede significar sólo que nadie ha muestreado. Por eso " +
  "estas cifras no se publican como abundancia, ni como probabilidad de captura, ni como mapa: " +
  "sirven para saber si hay registro de la especie en esa zona y desde cuándo, y para nada más.";

/**
 * Cómo se escribe una presencia: **la cifra y su significado en la misma frase**.
 *
 * No hay forma de imprimir el número solo, y esa es la idea: la función no devuelve el `12`, sino
 * «12 registros … · esfuerzo de muestreo, no abundancia». Los conjuntos de datos van con la cifra
 * porque son la mitad de su lectura —12 registros de 1 conjunto es una campaña; de 3, tres
 * campañas— y el rango de años dice de cuándo es lo que se está mirando.
 */
export function presenciaEscrita(presencia: PresenciaObis): string {
  const cuerpo = [
    `${plural(presencia.registros, "registro", "registros")} de ` +
      `${plural(presencia.datasets, "conjunto de datos", "conjuntos de datos")}`,
    anios(presencia),
  ]
    .filter((parte) => parte !== null)
    .join(", ");
  return `${cuerpo} · ${SESGO_JUNTO_A_LA_CIFRA}`;
}

/** `1 registro` / `12 registros`. Un «1 registros» resta credibilidad a la cifra que acompaña. */
function plural(cuantos: number, singular: string, varios: string): string {
  return `${cuantos} ${cuantos === 1 ? singular : varios}`;
}

/**
 * El rango de años, o `null` cuando OBIS no lo publica.
 *
 * Se omite en vez de inventarse: un «entre null y null» es ruido, y un rango a medias («desde
 * 2014») afirmaría un final abierto que no sabemos.
 */
function anios(presencia: PresenciaObis): string | null {
  const { desde, hasta } = presencia;
  if (desde === null || hasta === null) return null;
  return desde === hasta ? `en ${desde}` : `entre ${desde} y ${hasta}`;
}

/**
 * Lo que se lee cuando OBIS no tiene ni un registro de esa especie en ese caladero.
 *
 * **Es lo mismo que se ha dicho arriba, aplicado al caso extremo**: cero registros no es «no hay
 * esa especie ahí», es «nadie lo ha anotado en OBIS». La alternativa —dejar la celda vacía— se lee
 * como un hueco del catálogo, y un hueco mudo no se distingue de un fallo nuestro.
 */
export const SIN_REGISTROS =
  "Ningún registro en OBIS dentro de esta caja, que no quiere decir que la especie no esté: " +
  "quiere decir que nadie lo ha anotado ahí.";

/**
 * Que la caja con la que se consulta OBIS no es la costa, dicho donde se leen las cifras.
 *
 * El tradeoff está en el plan y se acepta con su precio a la vista: una demarcación marina real
 * habría sido otra fuente de geometría más para afinarle el método a un dato que ya publicamos como
 * pobre. Publicar un dato pobre con su método visible es honrado; afinarle el método sin afinar el
 * dato es maquillaje.
 */
export const LA_CAJA_NO_ES_LA_COSTA =
  "La consulta a OBIS se hace sobre rectángulos —uno o varios por caladero, porque hay caladeros " +
  "que no caben en uno—, y un rectángulo no es una costa: mete mar de más y no sigue el contorno " +
  "de ninguna demarcación. Las coordenadas de todos están publicadas aquí abajo para que se pueda " +
  "repetir la consulta.";

/** Rótulo del bloque que publica las cajas envolventes. */
export const ROTULO_CAJAS = "Con qué caja se ha consultado cada caladero";

/**
 * Una caja, escrita como se escriben las coordenadas del portal: grados con hemisferio, no un par
 * de números con signo. Un `-9,3` en una página se lee mal y se cita peor.
 */
export function cajaEscrita(
  caja: { readonly latMin: number; readonly latMax: number; readonly lonMin: number; readonly lonMax: number },
  numero: (valor: number, decimales: number) => string,
): string {
  const lat = (valor: number): string => `${numero(Math.abs(valor), 2)}° ${valor < 0 ? "S" : "N"}`;
  const lon = (valor: number): string => `${numero(Math.abs(valor), 2)}° ${valor < 0 ? "O" : "E"}`;
  return `de ${lat(caja.latMin)} a ${lat(caja.latMax)} y de ${lon(caja.lonMin)} a ${lon(caja.lonMax)}`;
}

// =================================================================================================
// El filtro por caladero
// =================================================================================================

/** Rótulo del filtro. Dice qué hace, no «filtrar» a secas. */
export const ROTULO_FILTRO = "Ver solo las especies que regula un caladero";

/** Opción que devuelve la lista entera. */
export const FILTRO_TODAS = "Todas";

/**
 * Nota del filtro: **filtrar no cambia ninguna cifra**.
 *
 * Se dice porque el filtro esconde filas y quien lo usa podría creer que además recorta lo que
 * queda. Cada fila sigue publicando todos los caladeros que la regulan, también los que el filtro
 * no ha pedido: la misma especie tiene tallas distintas en anexos distintos y esconder una la haría
 * parecer única.
 */
export const EL_FILTRO_NO_RECORTA_LA_FILA =
  "El filtro esconde las especies que ese caladero no regula. Las que quedan siguen publicando " +
  "todos sus caladeros y todas sus tallas: la misma especie tiene cifras distintas según el anexo, " +
  "y enseñar sólo una la haría parecer la única.";

// =================================================================================================
// La sección de la página de puerto
// =================================================================================================

/** Rótulo de la sección en la página de puerto. Nombra el caladero, que es lo que la acota. */
export function tituloDeLaSeccion(nombreDelCaladero: string): string {
  return `El catálogo de especies del caladero ${nombreDelCaladero}`;
}

/**
 * **Por qué esta sección es un enlace y no una segunda tabla**, dicho en la propia página.
 *
 * No es una disculpa por lo que falta: es la razón de que falte. La tabla de tallas de este puerto
 * ya está arriba, la pone `regulations` y sale del BOE; una segunda tabla con las mismas cifras
 * sería una segunda verdad que se desincroniza a la primera corrección. Lo que el catálogo añade
 * —el taxón aceptado, el rango, la presencia registrada— no depende del puerto, así que vive en una
 * página y no en 153.
 */
export const POR_QUE_UN_ENLACE =
  "Las tallas de este puerto están arriba, en la tabla de la norma. El catálogo no las repite: " +
  "añade el nombre que la ciencia acepta hoy para cada especie, si la norma regula una especie o " +
  "un género entero, y qué registros de presencia hay. Eso no cambia de un puerto a otro, así que " +
  "vive en una sola página y no en cada una.";

/** El enlace, con la cuenta de especies del caladero horneada desde el propio dataset. */
export function enlaceAlCatalogo(especies: number, nombreDelCaladero: string): string {
  return `Ver las ${especies} especies del caladero ${nombreDelCaladero}`;
}

/**
 * Que sin cobertura este enlace no abre, dicho **porque el módulo no declara política offline**.
 *
 * La caja de favoritos del core guarda la página de un puerto, sus constantes, el camino hasta ella
 * y sus assets; el catálogo no está en esa lista y declarar `offline` aquí no lo metería —las rutas
 * de una `PrecachePolicy` fijan la estrategia del worker, no lo que se guarda—. Así que la promesa
 * no se hace: se dice lo contrario, que es lo que es verdad. En T-19 una frase que afirmaba lo que
 * el precacheo no hacía se publicó en 153 páginas y hubo que corregirla (hallazgo H-4).
 */
export const SIN_RED_NO_ABRE =
  "El catálogo no se guarda con este puerto: aunque lo tengas en favoritos, este enlace necesita " +
  "cobertura. Lo que sí se guarda con el puerto es la tabla de tallas de aquí arriba.";

/** Rótulo del pie de fuentes, igual que en las otras secciones de módulo. */
export const ROTULO_FUENTES = "Fuentes de esta sección";
