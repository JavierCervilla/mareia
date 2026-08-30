/**
 * Los textos de la sección de áreas marinas protegidas, en un solo sitio.
 *
 * Viven aquí y no dentro de la plantilla por lo mismo que los de `regulations`: son **requisito de
 * producto** —esta sección existe para decir dónde **no** se puede pescar, y lo que la separa de
 * decir lo contrario son estas frases— y hay gates que las buscan en el `dist/` construido. Un
 * texto escrito dentro del componente se puede suavizar en un commit de estilo sin que nadie lo
 * note.
 *
 * **Hasta el pase adversario de T-21, el aviso que manda sobre todo lo demás y el motivo de los
 * puertos vacíos NO vivían aquí**: viajaban dentro del dataset (`fuente.aviso`,
 * `AreasDelPuerto.motivo`) y la sección los imprimía tal cual, para no tener dos ejemplares del
 * mismo texto. El hallazgo H-1 midió el precio de esa decisión: plantó en el JSON un aviso de los
 * mismos 186 bytes que decía «…no autoriza a pescar **sin licencia; con ella, en el resto no hay
 * veda**» y se publicó en negrita, antes de la lista, en las 153 páginas, con `pnpm test`,
 * `run.py check`, `pytest` y `ruff` en verde. El filtro real de la regla dura eran ocho expresiones
 * regulares y una subcadena, y ninguna decía nada de «no hay veda».
 *
 * Así que ahora **las dos frases son nuestras y viven aquí** (`NO_AUTORIZA_A_PESCAR`,
 * `hastaDondeSeHaMirado`), y la sección las pinta venga lo que venga en el dato. El dataset sigue
 * trayendo las suyas —son su registro de lo que se ingirió y sus gates las siguen exigiendo—, pero
 * ya no son **el portador** de la regla de seguridad: el aviso que sostiene la promesa de la
 * trayectoria no puede reescribirse editando un JSON.
 *
 * Lo que **sí** sigue viniendo del dato y se publica tal cual: la licencia (`fuente.licencia`), que
 * es un hecho sobre la fuente y no una afirmación nuestra, y va junto a su atribución.
 */

import type { TipoDeArea } from "./tipos.ts";

/**
 * Cómo se publica un radio en kilómetros: **redondeado hacia abajo**, y no es indiferente.
 *
 * El radio dice hasta dónde hemos mirado, así que la cota honrada es la inferior: con un criterio
 * de 30,5 km, decir «30» afirma que se miró al menos eso —verdad— y decir «31» prometería un
 * kilómetro que nadie recorrió. Hoy el criterio es 30 exacto y las dos darían lo mismo; la regla
 * está escrita para el día que no.
 */
export function kmDelRadio(radioKm: number): number {
  return Math.floor(radioKm);
}

/**
 * Rótulo de la sección. Nombra **el radio**, y por eso vale igual en las 143 páginas que listan
 * áreas y en las 10 que no listan ninguna: el título dice qué se ha mirado, no qué se ha
 * encontrado. Un título del tipo «Áreas protegidas cerca» sobre una lista vacía se lee como un
 * error de la página.
 */
export function tituloDeLaSeccion(radioKm: number): string {
  return `Áreas marinas protegidas a menos de ${kmDelRadio(radioKm)} km`;
}

/**
 * Qué es esto, antes del primer nombre.
 *
 * Dice las tres cosas que cambian cómo se lee la lista: que son **espacios protegidos** de una
 * fuente oficial, que aquí no se publica **qué se puede hacer** dentro de cada uno —eso lo fija su
 * declaración, que es otro documento— y que esto **no es un mapa de dónde se puede pescar**. La
 * tercera es la razón de ser de la sección y va escrita, no insinuada.
 */
export const QUE_ES_ESTO =
  "Los espacios marinos protegidos que este puerto tiene cerca, según la Red de Áreas Marinas " +
  "Protegidas de España. Esta página dice cuáles son y a qué distancia aproximada están; no dice " +
  "qué se puede hacer dentro de cada uno, porque eso lo fija la declaración oficial de cada " +
  "espacio y no está aquí. Y no dice en ningún caso dónde se puede pescar: para eso haría falta " +
  "una fuente que no tenemos.";

/**
 * **La regla dura de la trayectoria, y por eso es una constante del código y no un campo del dato.**
 *
 * Es la frase que sostiene la promesa entera —«en ningún caso, ni por omisión, se puede leer que se
 * pueda pescar»—: califica todo lo que hay debajo, se pinta en las **153** páginas y va **antes**
 * de la lista, también —sobre todo— en las 10 que no listan ninguna área, que son las que más
 * riesgo tienen de leerse como un permiso por omisión.
 *
 * Hasta el pase adversario esta frase llegaba a la página desde `fuente.aviso`, un campo de texto
 * libre del derivado. El texto es **el mismo** que el dataset publica hoy, palabra por palabra: lo
 * que cambia no es lo que se lee sino **quién responde de ello**. Un aviso que viaja en el dato lo
 * reescribe cualquiera que edite el JSON —o cualquier ingesta con una constante mal copiada— y lo
 * único que lo miraba eran ocho expresiones regulares; una constante del código la cambia un diff
 * revisado y hay un gate que la busca **literal** en las 153 páginas construidas.
 *
 * Que el dataset traiga además su propio aviso no sobra: es el registro de lo que se ingirió y sus
 * gates lo siguen exigiendo. Lo que ya no hace es llegar a la página.
 */
export const NO_AUTORIZA_A_PESCAR =
  "Solo la declaración oficial de cada espacio define sus límites y su régimen. Que no haya un " +
  "área protegida cerca no autoriza a pescar: esto dice dónde NO se puede, nunca dónde sí.";

/**
 * Lo que se lee en un puerto **sin ninguna área** a menos del radio, y es el punto con más criterio
 * de toda la sección.
 *
 * Son 10 de los 153 puertos del catálogo. La alternativa —no pintar la sección— convierte una
 * respuesta en un silencio: quien abre la página de Arenys de Mar no puede distinguir «hemos
 * mirado y no hay ninguna a menos de 30 km» de «esto todavía no lo hemos hecho», y las dos cosas
 * se leen igual de bien en una página sin sección. Esta frase dice **lo que sabemos**, y el motivo
 * que viaja en el dato (`AreasDelPuerto.motivo`) dice **hasta dónde hemos mirado** y que el límite
 * es una decisión nuestra y no un hueco de la fuente.
 *
 * Lo que esta frase **no** es, y por eso va seguida del aviso de la fuente en las 153 páginas: un
 * permiso. Que no haya un área protegida a menos de 30 km no autoriza a pescar nada.
 */
export function ningunaCerca(radioKm: number): string {
  return `Ninguna a menos de ${kmDelRadio(radioKm)} km de este puerto.`;
}

/**
 * La segunda mitad de lo que lee un puerto vacío: **hasta dónde se ha mirado**, y que el límite es
 * una decisión nuestra y no un hueco de la fuente.
 *
 * Con `ningunaCerca` sola, quien lee no sabe si el radio es de 3 km o de 300; con esto sola, la
 * respuesta se pierde dentro de un párrafo de método. Hacen falta las dos.
 *
 * Viene aquí por lo mismo que `NO_AUTORIZA_A_PESCAR`, y el pase adversario lo midió igual de bien:
 * hasta T-21 esta frase era `AreasDelPuerto.motivo`, texto libre del derivado del que sólo se
 * exigía que no estuviese vacío. Plantado en Valencia, la página publicaba «…y el puerto tampoco
 * cae dentro de ninguna, **así que por este concepto no hay ninguna limitación que consultar antes
 * de salir de este puerto**» con toda la escalera en verde. En los 10 puertos que no listan nada,
 * que son los que peor se leen, la frase la escribimos nosotros. El texto es palabra por palabra el
 * que el pipeline escribe hoy en `motivo` (`areas._sin_areas`).
 */
export function hastaDondeSeHaMirado(radioKm: number): string {
  return (
    `ninguna área marina protegida de RAMPE 2025 tiene su borde a menos de ${kmDelRadio(radioKm)} ` +
    "km de este puerto, y el puerto tampoco cae dentro de ninguna. No mirar más lejos es una " +
    "decisión nuestra, no una ausencia de la fuente."
  );
}

/**
 * Cómo se ha medido la distancia, dicho donde se lee la distancia.
 *
 * El dataset mide al **borde** del área, arista a arista. Es una aproximación con error acotado
 * —esfera en vez de elipsoide, y la arista como arco— pero ya no una cota de otra cosa: hasta la
 * primera versión de T-21 se medía al vértice más cercano, que aleja, y esa cota **perdía seis
 * áreas reales** de las 348. Publicarlo como `8,7 km` seguiría fingiendo una precisión que no
 * existe, así que se escribe como **cota** («a menos de 9 km»), que es lo que los dos redondeos
 * —la décima hacia arriba en el dato, el kilómetro hacia arriba aquí— hacen verdad.
 */
export const COMO_SE_MIDE_LA_DISTANCIA =
  "Las distancias son aproximadas y se publican como cota: se miden al borde del área y se " +
  "redondean al kilómetro hacia arriba. Un área que aquí figura a menos de 9 km puede estar de " +
  "verdad más cerca. No son una medida y no sirven para decidir dónde empieza un espacio " +
  "protegido: eso solo lo dice su declaración oficial.";

/**
 * Qué son las siglas, sin inventarles un régimen.
 *
 * Se glosa **lo que la sigla significa** y se dice explícitamente que aquí no está lo que cada
 * figura implica. Es la línea que separa informar de improvisar: desarrollar «ZEPA» es leer la
 * fuente, y escribir qué se puede hacer en una ZEPA sería redactar derecho por nuestra cuenta.
 */
export const QUE_SON_LAS_SIGLAS =
  "La figura es la clase de protección con la que la fuente clasifica cada espacio. Aquí se " +
  "desarrolla la sigla y nada más: lo que cada figura permite o prohíbe está en la declaración " +
  "oficial del espacio, y varía de uno a otro aunque compartan figura.";

/**
 * La sigla, desarrollada. `null` cuando no hay nada que desarrollar.
 *
 * El `switch` cierra con `never`: una sexta figura en RAMPE **no compila** hasta que alguien
 * escriba qué significa. Es la misma disciplina que las cinco clases de talla de `regulations`, y
 * por el mismo motivo: la rama que falta se rellenaría con la sigla en crudo, y una sigla
 * administrativa sin glosa en una página pública no informa de nada.
 *
 * `RESERVA MARINA` devuelve `null` **a propósito y no por pereza**: la fuente ya la escribe en
 * palabras, y repetir «Reserva marina» debajo de «RESERVA MARINA» es ruido. Lo que sí se calla es
 * su apellido —las reservas marinas se declaran con un fin y una autoridad concretos— porque eso
 * ya sería el régimen, y el régimen no lo hemos verificado.
 */
export function glosaDeTipo(tipo: TipoDeArea): string | null {
  switch (tipo) {
    case "ZEPA":
      return "Zona de Especial Protección para las Aves";
    case "ZEC":
      return "Zona Especial de Conservación";
    case "AMP":
      return "Área Marina Protegida";
    case "ZEC/AMP":
      return "Zona Especial de Conservación y Área Marina Protegida a la vez";
    case "RESERVA MARINA":
      return null;
    default: {
      const imposible: never = tipo;
      throw new Error(`figura de protección no contemplada: ${JSON.stringify(imposible)}`);
    }
  }
}

/**
 * Lo que se escribe cuando el puerto cae **dentro** del área.
 *
 * Es un hecho distinto de una distancia y más fuerte, así que no se disfraza de «a menos de 1 km»:
 * hay 10 relaciones así en el dataset. La segunda frase es la que evita que esto se lea como una
 * prohibición concreta que no podemos sostener: seguimos sin publicar el régimen del espacio.
 */
export const DENTRO_DEL_AREA =
  "El punto de este puerto cae dentro de esta área. Lo que eso implica lo dice su declaración " +
  "oficial, no esta página.";

/**
 * El aviso de lectura sin red, con su **condición delante**.
 *
 * El módulo declara `offline: cache-first`, o sea que la copia guardada se sirve sin preguntar a la
 * red. Pero quien guarda una página **no es este módulo**: es la caja de favoritos del core, y solo
 * la del puerto que el lector marque. En T-19 se publicó en las 153 páginas una frase que afirmaba
 * lo contrario —«esta tabla se guarda», a secas— y el pase adversario la midió falsa por defecto
 * (hallazgo H-4). Aquí la condición va primera, y la sección no tiene JavaScript con el que
 * encender ni apagar nada: el aviso está escrito siempre, redactado para ser verdad en los dos
 * casos.
 */
export const AVISO_SIN_RED =
  "Si guardas este puerto, esta lista se guarda con él y se puede leer sin cobertura; el resto " +
  "del sitio no se guarda solo. Lo que leas sin red puede ser una copia de hace semanas: los " +
  "espacios protegidos se declaran y se amplían por norma, y esta página no se entera hasta que " +
  "se vuelve a construir.";

/** Cabeceras de la tabla. */
export const COLUMNA_AREA = "Área";
export const COLUMNA_FIGURA = "Figura";
export const COLUMNA_DISTANCIA = "Distancia aproximada";

/** Rótulo del código de la fuente, que es lo que permite buscar el espacio sin fiarse del nombre. */
export const ROTULO_CODIGO = "Código RAMPE";

/** Rótulo de la lista de fuentes al pie de la sección. */
export const ROTULO_FUENTES = "Fuentes de esta sección";
