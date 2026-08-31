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
 *
 * La frase decía «ni sobra ninguna ni falta ninguna **por decisión nuestra**», y era falsa: falta
 * una por una decisión nuestra —«Cigalas (colas)», que la norma nombra sin ningún latín— (hallazgo
 * H-4 del pase adversario de T-20). Se han hecho las dos cosas y no una: la fila **se publica**,
 * con su talla y su motivo, al final de la página, y esta frase deja de afirmar una completitud
 * que la tabla no tiene y dice en su lugar dónde está lo que no cabe en ella. Retirar sólo la
 * afirmación habría dejado el hueco mudo; publicar sólo la fila habría dejado el literal mintiendo.
 */
export const QUE_ES_ESTE_CATALOGO =
  "Las especies a las que el Real Decreto 560/1995 le fija una talla mínima de captura, con el " +
  "nombre que usa la norma y el nombre que la ciencia acepta hoy. La lista la fija el BOE: no " +
  "sobra ninguna, y las filas de la norma que esta tabla no puede publicar como especie —porque el " +
  "BOE no les escribe ningún nombre científico— están al final de la página, nombradas y con su " +
  "talla. La talla que se publica en cada fila es la del caladero que la fija, y la misma especie " +
  "tiene cifras distintas en anexos distintos.";

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
 * Cómo se rotula el enlace a la ficha de WoRMS: **con el nombre del registro al que lleva**.
 *
 * Dice de qué nombre es la ficha, y no es una precisión gratuita: en las 11 filas en las que hay
 * dos nombres y dos identificadores, un «AphiaID 127160» a secas no diría a cuál de los dos
 * pertenece, y quien fuera a comprobarlo abriría el que no es.
 *
 * El rótulo decía «Ficha **del nombre de la norma** en WoRMS», y en 22 de las 86 filas eso era la
 * atribución **al revés** (hallazgo H-2 del pase adversario de T-20): a WoRMS no se le preguntó el
 * nombre de la norma —se le preguntó el que decidimos nosotros—, así que esa ficha es la del
 * nombre corregido. Ahora el rótulo **nombra el registro**, que además es lo que hace comprobable
 * la fila sin salir del sitio: quien lee ve a qué taxón apunta el identificador que tiene delante.
 */
export function fichaEnWorms(nombreDelRegistro: string, aphiaId: number): string {
  return `Ficha de «${nombreDelRegistro}» en WoRMS · AphiaID ${aphiaId}`;
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
 * El **tercer** estado de la columna: a WoRMS nunca se le preguntó el nombre que escribe la norma.
 *
 * Son 22 de las 86 filas —los 15 géneros escritos con `spp`, las 6 erratas de imprenta del BOE y la
 * celda que nombra dos especies— y hasta el pase adversario de T-20 caían en la rama de arriba: la
 * página publicaba «WoRMS acepta el nombre de la norma» sobre `Sepia spp`, que no existe en ninguna
 * nomenclatura, y sobre `Cáncer pagurus`, **contradiciéndose dos líneas más abajo** en la misma
 * celda con «Correspondencia nuestra, no de WoRMS: el género es «Cancer»». Atribuirle a la fuente
 * una frase que la fuente no ha dicho es de la misma familia que inventar una cifra.
 *
 * La frase nombra el registro que **sí** devolvió la consulta, y ahí está la mitad del arreglo del
 * segundo cuerpo de ese hallazgo: el binomio corregido (`Cancer pagurus`, `Thunnus albacares`) no
 * aparecía en ninguna parte de la fila, sólo su `AphiaID`. El estado va entrecomillado y en las
 * palabras de WoRMS, como en `remiteA`: es una cita.
 *
 * `aceptado` arrastra la segunda mitad de la frase cuando el registro **además** remite a otro
 * nombre. Es una sola fila —`Panaeux kerathurus`, la errata del Anexo I, cuyo registro es una
 * combinación superada—, y las dos cosas son ciertas a la vez: ni se le preguntó el nombre de la
 * norma, ni el registro que se encontró es el aceptado hoy. Contarlas en dos frases separadas
 * dejaría al lector emparejando cuál se refiere a cuál.
 */
export function noSePreguntoEsteNombre(
  nombreDelRegistro: string,
  estado: string,
  aceptado: string | null,
): string {
  return (
    `A WoRMS no se le preguntó este nombre. El registro al que apunta esta fila es ` +
    `${nombreDelRegistro}, que WoRMS registra como «${estado}»` +
    `${aceptado === null ? "." : ` y remite a ${aceptado}.`}`
  );
}

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

/**
 * Que este mismo taxón está **en otra fila de la tabla**, con la otra grafía que imprime el BOE.
 *
 * Son tres pares y seis filas (hallazgo H-3 del pase adversario de T-20): el BOE escribe `Thunnus
 * thynnus` en los Anexos I y II y `Thunnus Thynnus` en el III, `Thunnus albacares` en el I y
 * `Thunnus aibacares` en el III, `Mugil spp` en el I y `Mugil spps` en el II. Las dos filas de cada
 * par publican el mismo `AphiaID`, el mismo enlace y el mismo nombre común, **y ninguna decía que
 * la otra existía**: quien buscaba el atún rojo por el binomio que la ciencia acepta encontraba una
 * fila con dos caladeros y concluía que en Canarias no tiene talla mínima. La tiene: 6,4 kg, en la
 * fila de al lado, bajo la `T` mayúscula del BOE.
 *
 * **Las filas no se fusionan**, y eso está decidido: son dos nombres de la norma y el nombre de la
 * norma es el que tiene consecuencia legal, así que colapsarlos publicaría uno que el BOE no
 * escribe. Lo que se hace es cruzarlas, que es lo que el lector necesita para no sacar la
 * conclusión equivocada de una sola.
 */
export function tambienEnOtraFila(nombresDeLaNorma: readonly string[]): string {
  const nombres = nombresDeLaNorma.map((nombre) => `«${nombre}»`).join(", ");
  return (
    `El BOE nombra a este mismo taxón también como ${nombres}, en ` +
    `${nombresDeLaNorma.length === 1 ? "otra fila" : "otras filas"} de esta tabla: los caladeros y ` +
    `las tallas que van ahí no están en ésta.`
  );
}

// =================================================================================================
// La nota al pie, que viaja pegada a la cifra
// =================================================================================================

/**
 * Una nota del anexo, escrita **entera y junto a la cifra que modifica**.
 *
 * Es el mismo criterio que `regulations` aplica en las 153 páginas de puerto, y aquí faltaba: el
 * catálogo publicaba «36 cm» y, dentro del literal citado, la llamada «36 (***)» sin ningún pie en
 * toda la página (hallazgo H-1 del pase adversario de T-20). Una marca que no lleva a ninguna parte
 * es **peor** que la cifra sola, porque la propia página señala que ahí falta algo y luego no hay
 * nada; y el pulpo era el caso peor, porque su literal es «1 kg» sin marca y nada dejaba rastro de
 * que en Baleares esa cifra no rige.
 *
 * El texto va **entero**: es lo que convierte 36 en 44, y resumirlo sería publicar una tercera
 * cifra que no dice la norma.
 */
export function notaDeLaTalla(marca: string, texto: string): string {
  return `${marca} ${texto}`;
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
 * El **tercer** texto de la columna de presencia: a OBIS no se le llegó a preguntar.
 *
 * Es una fila —`Lophius piscatorius, L. Budegassa`, dos especies en una celda del BOE—: sin taxón
 * resuelto no hay nombre por el que consultar, y un cero de una búsqueda que no puede acertar se
 * leería como ausencia de la especie. No es lo mismo que `SIN_REGISTROS`, que sí afirma algo sobre
 * OBIS: que se le preguntó y no tenía nada.
 *
 * **Y es una constante del código, no una cadena del dataset, que es la corrección del hallazgo
 * H-5 de T-20.** Antes esta frase viajaba en `presenciaAusente` y la vista la imprimía tal cual;
 * plantando ahí «Sin registros: OBIS confirma que la especie no está presente en este caladero» la
 * afirmación se publicaba con los siete gates del pipeline y el build en verde, porque lo único que
 * la vigilaba era que no estuviera vacía y el gate E4 sólo mira donde hay una cifra. Es el hallazgo
 * H-1 de T-21 en otro campo y se cierra con la misma regla, ya escrita en la cabecera de este
 * fichero: **la frase que sostiene una promesa vive en el código**, donde cambiarla es un diff
 * revisado. Con esto son tres las frases duras de esta columna, y las tres están aquí.
 */
export const NO_SE_PREGUNTO_A_OBIS =
  "A OBIS no se le ha preguntado por esta especie: el nombre de la norma no resuelve en WoRMS, así " +
  "que no hay taxón por el que consultar. No es que no haya registros; es que no hay consulta, y " +
  "el cero de una búsqueda que no puede acertar se leería como ausencia de la especie.";

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
// Las filas del BOE que la tabla no puede publicar como especie
// =================================================================================================

/** Rótulo del bloque. Nombra **cuántas son**, contadas del dataset, y no «otras filas». */
export function rotuloSinBinomio(filas: number): string {
  return filas === 1
    ? "La fila del BOE que este catálogo no publica como especie"
    : `Las ${filas} filas del BOE que este catálogo no publica como especie`;
}

/**
 * Por qué esas filas no están en la tabla, dicho donde se echan en falta.
 *
 * El catálogo son las especies **con nombre científico**, porque la columna del taxón necesita uno
 * al que preguntarle a WoRMS. La norma no siempre lo escribe: el Anexo I le fija 3,7 cm a «Cigalas
 * (colas)» y ahí no hay ningún latín entre paréntesis. Inventárselo sería atribuirle a la norma un
 * alcance que no tiene —y del lado que multa—, así que la fila se publica **como lo que es**: una
 * talla legal de la norma sin especie a la que colgarla.
 *
 * Que la talla vaya aquí y no sólo el nombre no es adorno: **3,7 cm es una cifra con consecuencia
 * legal** y es la tercera medida del mismo animal en el mismo anexo (2 cm de cefalotórax y 7 cm de
 * longitud total, que sí están en la tabla, bajo `Nephrops norvegicus`). Publicar dos de tres sin
 * decir que hay una tercera es lo que encontró el hallazgo H-4 de T-20.
 */
export const POR_QUE_NO_ESTAN_EN_LA_TABLA =
  "La tabla de arriba necesita un nombre científico por fila: es el que se le pregunta a WoRMS y el " +
  "que permite decir si la norma regula una especie o un género entero. Estas filas del Real " +
  "Decreto 560/1995 no lo traen —la norma las nombra sólo en castellano—, y aquí no se les inventa " +
  "uno. Su talla mínima es igual de obligatoria que las de arriba, así que se publican con ella y " +
  "con el motivo por el que no están en la tabla.";

/** Cómo se rotula el caladero de una de esas filas: nombrando **el anexo por su caladero**. */
export function enElCaladero(nombreDelCaladero: string): string {
  return `Caladero ${nombreDelCaladero}`;
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

// =================================================================================================
// LA FICHA DE UNA ESPECIE (T-23) · la retícula fija y sus huecos rotulados
// =================================================================================================
//
// **La regla que gobierna todo lo que sigue.** Un pokédex ayuda a la honradez porque tiene siempre
// los mismos campos: un campo vacío es **visible** y dice «esto no lo sabemos». Un párrafo libre
// esconde el hueco, porque no se ve lo que no se escribió. Por eso la retícula es fija —las nueve
// filas se publican en las 86 fichas, en este orden— y **ningún hueco se deja en blanco ni se omite
// la fila**: cada uno publica su motivo.
//
// Y estorba si se le deja hacer lo que hacen los juegos —rellenar y puntuar—, así que aquí no hay
// ninguna magnitud inventada: ni barras, ni estrellas, ni rareza, ni dificultad, ni puntos, ni
// «mejor cebo», ni «temporada ideal», ni descripción narrativa nuestra. Todo lo de abajo o cita una
// fuente o dice por qué no puede citarla.

/**
 * Identificador de cada fila de la retícula. Es una unión cerrada porque **la retícula no es una
 * lista de sugerencias**: el `never` de quien la recorra obliga a decidir qué se escribe el día que
 * alguien añada un campo, en vez de dejar una fila muda.
 *
 * Viaja al `dist/` como `data-campo`, que es de lo que se agarra el gate F3 para comprobar que las
 * nueve están y en este orden.
 */
export type IdDeCampo =
  | "nombre-boe"
  | "nombre-comun"
  | "nombre-local-canario"
  | "taxon"
  | "rango"
  | "tallas"
  | "presencia"
  | "areas-protegidas"
  | "foto";

/** Una fila de la retícula: su identificador estable y el rótulo con el que se lee. */
export interface CampoDeLaFicha {
  readonly id: IdDeCampo;
  readonly rotulo: string;
}

/**
 * **La retícula, en su orden**, y el único sitio donde ese orden está escrito.
 *
 * La plantilla lo recorre para pintar y el gate F3 lo recorre para medir, así que no hay forma de
 * que la página publique ocho campos y el gate siga creyendo que son nueve: eso es exactamente lo
 * que pasa cuando el orden se teclea dos veces.
 *
 * Los rótulos dicen **de dónde sale cada cosa** —«que escribe la norma», «que acepta WoRMS hoy»,
 * «en los caladeros que la regulan»— porque en esta ficha conviven cuatro fuentes con cuatro
 * autoridades distintas, y un rótulo genérico las mezclaría en una sola voz que sería la nuestra.
 */
export const CAMPOS_DE_LA_FICHA: readonly CampoDeLaFicha[] = [
  { id: "nombre-boe", rotulo: "Nombre que escribe la norma" },
  { id: "nombre-comun", rotulo: "Nombre común en los anexos" },
  { id: "nombre-local-canario", rotulo: "Nombre local canario" },
  { id: "taxon", rotulo: "Taxón que acepta WoRMS hoy" },
  { id: "rango", rotulo: "A qué alcanza la talla" },
  { id: "tallas", rotulo: "Talla mínima por caladero" },
  { id: "presencia", rotulo: "Registros en OBIS" },
  { id: "areas-protegidas", rotulo: "Espacios protegidos en los caladeros que la regulan" },
  { id: "foto", rotulo: "Foto" },
];

/** El `id` del título de una fila, que es lo que la nombra para un lector de pantalla. */
export function tituloDelCampo(id: IdDeCampo): string {
  return `titulo-${id}`;
}

/** Título de la ficha: **el nombre de la norma**, que es el que tiene consecuencia legal. */
export function tituloDeLaFicha(nombreBoe: string): string {
  return nombreBoe;
}

/**
 * Qué es esta página, antes de la primera fila, y **por qué tiene siempre los mismos campos**.
 *
 * Se dice en voz alta porque es lo que hace legible un hueco: quien lee tiene que saber que la fila
 * vacía no es un descuido de maquetación sino una respuesta. Sin esta frase, «Nombre local canario:
 * la norma deja la celda vacía» se lee como que la página está a medias.
 */
export const QUE_ES_ESTA_FICHA =
  "Todo lo que este portal sabe de una de las especies a las que el Real Decreto 560/1995 le fija " +
  "una talla mínima de captura. La ficha tiene siempre los mismos campos y en el mismo orden, " +
  "también cuando no hay nada que poner en uno: en ese caso el campo dice por qué está vacío. Un " +
  "hueco rotulado es información —dice qué no sabemos—; un hueco en blanco no se distingue de un " +
  "fallo nuestro.";

/**
 * Lo que esta ficha **no** hace, dicho donde se lee y no sólo en el design doc.
 *
 * Es la mitad de la promesa: la otra es la retícula. Quien llega a una ficha de especie desde
 * cualquier otro sitio de internet viene acostumbrado a que le puntúen el animal, y esta frase
 * dice que aquí eso no está por decisión, no por falta de datos.
 */
export const AQUI_NO_SE_PUNTUA_NADA =
  "Aquí no hay ninguna magnitud inventada: ni rareza, ni dificultad, ni puntuación, ni mejor " +
  "cebo, ni temporada ideal, ni un orden que sugiera qué especies son mejores. Cada campo o cita " +
  "una fuente con su fecha o dice por qué no puede citarla. Sobre una cifra con consecuencia " +
  "jurídica el adorno consigue que se le crea más de lo que merece, y lo que merece está escrito " +
  "al lado.";

/** Vuelta al catálogo, que es de donde se llega. Dice **cuántas** son, contadas del dataset. */
export function volverAlCatalogo(especies: number): string {
  return `Volver al catálogo de las ${especies} especies que el BOE regula`;
}

// --- Los motivos de los huecos -------------------------------------------------------------------

/**
 * Por qué una especie no tiene nombre local canario **cuando la norma no la regula en Canarias**.
 *
 * Es el hueco más numeroso de la retícula —55 de las 86— y el que peor se leería en blanco: quien
 * viera la fila vacía concluiría que la especie no tiene nombre en las islas, cuando lo que pasa es
 * que el Anexo III no la nombra. La frase distingue las dos cosas.
 */
export const FUERA_DEL_ANEXO_III =
  "El nombre local canario sólo lo escribe el Anexo III del Real Decreto 560/1995, que es el del " +
  "caladero canario, y esta especie no está en ese anexo. No es que no tenga nombre en las islas: " +
  "es que la norma no lo escribe aquí, y este portal no le pone uno de su cosecha.";

/** Lo que se lee en la fila del rango cuando la norma nombra **una especie** y no un alcance mayor. */
export const LA_NORMA_NOMBRA_UNA_ESPECIE =
  "La norma nombra una especie: la talla mínima se aplica a ella y a ninguna otra.";

/**
 * Por qué no hay rango cuando no hay registro de WoRMS.
 *
 * El rango es lo que la fuente dice del nombre, no una lectura nuestra de cómo está escrito.
 * Deducirlo del texto —«esto acaba en spp, luego es un género»— sería exactamente el mapeo sin
 * dueño que el catálogo se prohíbe en la columna del taxón.
 */
export const RANGO_SIN_TAXON =
  "Sin registro en WoRMS no hay rango que publicar: el rango es lo que la fuente dice del nombre, " +
  "no una deducción nuestra a partir de cómo está escrito.";

/** Por qué puede faltar el nombre común. No pasa hoy en ninguna de las 86, y la fila existe igual. */
export const SIN_NOMBRE_COMUN =
  "Ninguno de los anexos que regulan esta especie le escribe un nombre común.";

// --- La fila de los espacios protegidos ----------------------------------------------------------

/**
 * **La frase que sostiene esta fila entera, y por eso es lo primero que se lee en ella.**
 *
 * RAMPE publica espacios y sus límites; **no publica nada por especie**. El vínculo honesto entre
 * una especie y un espacio protegido es el **caladero** —dónde se aplica su talla—, y ni siquiera
 * eso dice que a la especie le afecte el régimen del espacio. Sin esta frase delante, una lista de
 * espacios debajo del nombre de un animal se lee como «esta especie está protegida aquí», que es
 * una afirmación que no tenemos con qué sostener.
 *
 * Es constante del código y no texto del dataset por la lección del hallazgo H-1 de T-21: la frase
 * que sostiene una promesa vive donde cambiarla es un diff revisado.
 */
export const RAMPE_NO_HABLA_DE_ESPECIES =
  "La Red de Áreas Marinas Protegidas publica espacios, no especies: no dice qué especie está " +
  "protegida en cada uno, así que esta ficha no puede decirlo. Lo que sí se puede decir es dónde " +
  "hay espacios protegidos en los caladeros que fijan la talla de esta especie, y eso está abajo, " +
  "contado por caladero. El régimen de cada espacio lo fija su declaración oficial.";

/**
 * Cuántos puertos de un caladero tienen algún espacio protegido cerca: **un recuento de puertos, no
 * una afirmación sobre la especie**, y la frase lo dice con esas palabras.
 *
 * La cifra sale de contar el derivado de T-21 contra el caladero que cada puerto declara en
 * `ports.json`; no hay ninguna magnitud nueva. Va con el radio dentro porque un «tienen espacios
 * cerca» sin decir cuánto es «cerca» no significa nada, y con el número de espacios distintos
 * porque 110 relaciones sobre 37 espacios y sobre 110 no son lo mismo.
 */
export function espaciosEnElCaladero(
  nombreDelCaladero: string,
  puertos: number,
  conEspacio: number,
  espacios: number,
  radioKm: number,
): string {
  return (
    `De los ${puertos} puertos del caladero ${nombreDelCaladero} que publica este portal, ` +
    `${conEspacio} tienen algún espacio protegido a menos de ${kmDelRadio(radioKm)} km: ` +
    `${espacios} espacios distintos. Cuáles son y a qué distancia está en la página de cada puerto.`
  );
}

/** El radio, escrito sin decimales cuando no los tiene. Un «30,0 km» finge una precisión que no hay. */
function kmDelRadio(radioKm: number): number {
  return Math.round(radioKm * 10) / 10;
}

// --- La foto ------------------------------------------------------------------------------------

/**
 * El crédito de la foto: **autor y licencia, juntos y pegados a la imagen**.
 *
 * No hay pie global de la página y no puede haberlo: en la muestra de 12 ficheros que midió el plan
 * salieron **seis licencias distintas**, así que un «fotos de Wikimedia Commons» sería falso para
 * cinco de ellas. Cada foto lleva la suya, en su mismo bloque, y el gate F2 lo mide ahí.
 */
export function creditoDeLaFoto(autor: string, licencia: string): string {
  return `Foto de ${autor} · ${licencia}`;
}

/**
 * Quién identificó la foto, que **no fuimos nosotros**.
 *
 * Es la asunción 2 del plan escrita en la página: la foto se coge de la propiedad `P18` de Wikidata,
 * que es la imagen que alguien vinculó a mano al taxón. Publicarla sin decirlo convertiría una
 * decisión editorial ajena en una afirmación nuestra sobre qué animal es ése.
 */
export function identificadaPor(fuente: string, entidad: string, propiedad: string): string {
  return `La identificación es de ${fuente} (${entidad}, propiedad ${propiedad}), no nuestra.`;
}

/**
 * Que una foto **no sirve para identificar una captura**, dicho junto a la foto.
 *
 * Es el riesgo propio de esta fila: una imagen debajo de una talla mínima se lee como una guía de
 * campo, y equivocarse identificando una captura tiene la misma consecuencia que equivocarse con la
 * cifra. La ficha publica una foto para ilustrar, no para que nadie decida con ella.
 */
export const LA_FOTO_NO_IDENTIFICA =
  "Una foto no sirve para identificar una captura: hay especies que se distinguen por caracteres " +
  "que no se ven en una imagen, y el nombre que tiene consecuencia legal es el de la norma, que " +
  "está arriba.";

/** Texto alternativo: dice **quién** asocia la imagen al taxón, no que la imagen sea el taxón. */
export function textoAlternativoDeLaFoto(nombreBoe: string, fuente: string): string {
  return `Fotografía que ${fuente} asocia al taxón «${nombreBoe}».`;
}

/**
 * Enlace a la página del fichero, que es donde se comprueba el crédito sin fiarse de esta página.
 *
 * **No lleva el nombre del fichero, y ése es el cambio.** Lo llevaba, entero y entrecomillado, y
 * los nombres de Commons son cadenas cualesquiera: uno de ellos —`File:Brachsenmakrele (Brama
 * Brama) 22.12.2008 Strand von Callantsoog Nord Holland.JPG`— metía «22.12» en el texto visible de
 * la ficha del bicho, donde un lector español lee un decimal con punto inglés y el gate A-19 lee
 * una regresión. Las dos lecturas son razonables, y las dos son culpa de imprimir el nombre: la
 * etiqueta de un enlace no necesita nombrar su destino cuando el destino **es** la página donde ese
 * nombre está escrito. El `fichero` sigue en el dataset, que es donde hace falta: es procedencia.
 */
export const VER_EL_FICHERO_EN_COMMONS = "Ver el fichero en Wikimedia Commons";

/**
 * Lo que se lee **en lugar** del enlace al texto de la licencia cuando la foto es de dominio
 * público.
 *
 * No hay texto de licencia al que mandar al lector porque no hay condiciones que cumplir, y un
 * enlace vacío o un «licencia: —» serían un crédito que no lleva a ninguna parte. Lo que sí hay es
 * quién lo declara y con qué motivo: la página del fichero en Commons, que va justo debajo y es
 * obligatoria en toda foto publicada.
 */
export const DOMINIO_PUBLICO_SIN_CONDICIONES =
  "Dominio público: no hay texto de licencia que enlazar porque no hay condiciones que cumplir. " +
  "Quién lo declara así está en la página del fichero.";

/**
 * El crédito de una foto **cuya fuente declara que no hace falta atribuir**.
 *
 * Es la enmienda del 2026-08-31 escrita en la página. Dos ficheros de la NOAA —el bacalao y las
 * lisas— publican `AttributionRequired = "false"` y `Copyrighted = "False"` y no registran autor:
 * publicarlos sin acreditar a nadie no incumple nada, y lo que sí incumpliría es publicar así uno
 * que exija atribuir. Lo que no vale es callarlo: un «Foto de  · Public domain» con el hueco donde
 * iría el nombre es una atribución que no atribuye, y una foto sin línea de crédito parece nuestra.
 *
 * Así que se dice el estado, **quién lo declara** y dónde comprobarlo: la página del fichero en
 * Commons va justo debajo y la lleva toda foto publicada.
 */
export function creditoSinAutor(licencia: string): string {
  return (
    `Sin autor acreditado · ${licencia}. Wikimedia Commons no registra quién hizo esta foto y ` +
    `declara que su licencia no exige atribuir; quien dude puede comprobarlo en la página del ` +
    `fichero.`
  );
}

/**
 * El rótulo de la foto de una fila que **regula un género** y no puede publicar la imagen del suyo.
 *
 * Pasa en `Lophius spp`: la única `P18` del género es `File:Monkfish.jpg`, `CC BY-SA 3.0`, que
 * exige atribuir y cuya fuente no dice a quién. La salida no es relajar el crédito —eso sería
 * incumplir la licencia— sino publicar la foto de una especie del género **que nombra la propia
 * norma**, y decirlo aquí.
 *
 * La frase nombra la fila del BOE de donde sale la elección porque eso es lo que la hace
 * comprobable: sin ella, «la elige la norma» sería una afirmación nuestra sobre un texto que el
 * lector tendría que ir a buscar. Y va **dentro de la figura**, no en una nota al final: quien mira
 * la foto tiene que leer de qué animal es sin bajar.
 */
export function fotoDeUnaEspecieDelGenero(nombre: string, nombreBoe: string): string {
  return (
    `Esta fila regula un género entero y la imagen que Wikidata le vincula no se puede publicar. ` +
    `La foto es de «${nombre}», una de las especies de ese género que la propia norma nombra —en ` +
    `la fila «${nombreBoe}»—, y no ilustra a las demás del género.`
  );
}

/**
 * El rótulo de la foto de una fila que **nombra varias especies** en una sola celda.
 *
 * Pasa en `Lophius piscatorius, L. Budegassa`. El catálogo deja esa fila sin taxón a propósito
 * —repartir una fila legal en dos decide a qué alcance se aplica una talla mínima, y esa decisión
 * no es nuestra—, pero para ilustrarla no hace falta repartir nada: se publica la primera especie
 * que la norma nombra **diciendo que hay más**. Callarlo sería contar media fila.
 */
export function fotoDeLaPrimeraEspecieDeLaFila(nombre: string, nombreBoe: string): string {
  return (
    `La norma nombra más de una especie en esta fila («${nombreBoe}»): la foto es de «${nombre}», ` +
    `la primera que nombra, y no ilustra a las demás.`
  );
}

/** El día en que se consultaron los créditos. Una licencia envejece, y se dice cuándo se leyó. */
export function fotosConsultadasEn(fecha: string): string {
  return `Créditos de las fotos consultados el ${fecha}.`;
}

/**
 * Lo que se lee en la fila de la foto **cuando el dataset de fotos todavía no está en el build**.
 *
 * Es el hueco que más fácil sería dejar mudo, y el que peor se leería: sin esta frase, una ficha sin
 * imagen dice «esta especie no tiene foto», que es una afirmación sobre Wikidata que nadie ha
 * comprobado. Lo que se sabe es otra cosa —que aún no se ha preguntado— y es lo que se publica.
 */
export const SIN_DATASET_DE_FOTOS =
  "El dataset de fotos todavía no se ha ingerido, así que ninguna ficha de este portal publica " +
  "imagen. No quiere decir que esta especie no tenga foto: quiere decir que aún no se ha " +
  "preguntado por ella.";

/** Rótulo del enlace al texto de la licencia. Nombra **cuál** es: hay seis distintas en la muestra. */
export function enlaceALaLicencia(licencia: string): string {
  return `Texto de la licencia ${licencia}`;
}
