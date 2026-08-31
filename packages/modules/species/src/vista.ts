/**
 * Cómo se escribe una fila del catálogo de especies. Todo el criterio de presentación, sin Astro y
 * sin `Intl`: funciones puras que un `node --test` puede juzgar sin construir el sitio.
 *
 * Las tres reglas que este archivo existe para hacer cumplir, y las tres son de las que hacen
 * mentir a la página si se rompen:
 *
 * 1. **El nombre del BOE está en todas las filas.** No hay ninguna rama que lo omita ni ninguna que
 *    lo sustituya por el aceptado: `FilaDeEspecie.nombreBoe` es obligatorio y el taxón vive en otro
 *    campo. El gate E1 lo mide sobre el `dist/`, que es donde importa.
 * 2. **Ninguna presencia se escribe como un número suelto.** `CaladeroDeLaFila.presencia` es
 *    siempre una frase de `textos.ts` —la que lleva la cifra dentro y el sesgo pegado, o la que
 *    dice que no hay registros—, así que no existe el camino de código que imprima el `12` solo.
 *    El gate E4 lo mide sobre el `dist/`.
 * 3. **Un género no se convierte en especie y una ausencia dice por qué lo es.**
 *    `filasDeEspecies` **levanta** si una especie no resuelve y no trae motivo, o si trae una
 *    correspondencia nuestra sin decir cuál. Publicar eso en silencio es firmar con el nombre de
 *    WoRMS una decisión que hemos tomado nosotros.
 * 4. **Ninguna cifra legal sale sin la excepción que la cambia.** Es la regla de T-19 —«la nota
 *    viaja pegada a la cifra y se pinta con ella, siempre»— y aquí no estaba: el pase adversario de
 *    T-20 encontró el catálogo publicando «36 cm» y una llamada `(***)` que no llevaba a ningún
 *    pie, mientras la página de puerto del mismo sitio publicaba la nota entera. `TallaDeLaFila`
 *    lleva ahora las notas escritas y `caladeroDeLaFila` las pone en el mismo bloque que la cifra.
 *
 * Y una que no es de composición pero se decide aquí: **cada fila dice qué otra fila publica su
 * mismo taxón** (`tambienEn`), porque el BOE escribe tres animales con dos grafías y sin el cruce
 * cada una de las seis filas se lee como si fuera la única.
 *
 * **La talla no se vuelve a escribir aquí: se presta el criterio de `regulations`** (`textoDeTalla`,
 * con su unión cerrada de cinco clases y su `never`). Es una dependencia de un módulo sobre otro y
 * es deliberada: es exactamente el mismo argumento con el que la sección de la página de puerto es
 * un enlace y no una segunda tabla —dos superficies del mismo dato se desincronizan—, y una copia de
 * las cinco clases aquí sería justo eso, una segunda forma de escribir una cifra legal que puede
 * corregirse en un sitio y no en el otro. El precio: `@mareia/module-species` no compila sin
 * `@mareia/module-regulations`. Lo que **no** cambia es el registry: dar de baja cualquiera de los
 * dos módulos sigue siendo borrar su línea de `modules.config.ts`.
 *
 * El formato numérico se **presta** desde la superficie (`FormatoDelCatalogo`), igual que en
 * `regulations` y en `fishing`: el módulo no sabe si se escribe con coma o con punto.
 */

import { textoDeTalla } from "@mareia/module-regulations";
import type { FormatoDeTallas, TallaEscrita } from "@mareia/module-regulations";

import {
  correspondenciaNuestra,
  enElCaladero,
  MISMO_NOMBRE,
  NO_SE_PREGUNTO_A_OBIS,
  notaDeLaTalla,
  noSePreguntoEsteNombre,
  presenciaEscrita,
  rangoEscrito,
  remiteA,
  SIN_REGISTROS,
  tambienEnOtraFila,
} from "./textos.ts";
import type {
  CatalogoDeEspecies,
  EspecieDelCatalogo,
  EspecieEnCaladero,
  TaxonEnWorms,
} from "./tipos.ts";

/**
 * Lo que la superficie le presta al módulo para escribir números.
 *
 * Es el mismo contrato que `FormatoDeTallas` y se declara como alias suyo en vez de duplicarse: lo
 * que el catálogo necesita para escribir una talla es exactamente lo que `regulations` necesita, y
 * dos interfaces idénticas con nombres distintos se acaban separando por accidente.
 */
export type FormatoDelCatalogo = FormatoDeTallas;

/**
 * El taxón de una fila, en las tres situaciones en que puede estar. Es una unión cerrada para que
 * la plantilla las recorra sin `default`: no hay una cuarta forma de contar esto que no sea inventar.
 */
export type TaxonDeLaFila =
  | {
      readonly tipo: "resuelto";
      /**
       * Qué dice WoRMS de este nombre: que lo acepta, o que remite a otro. Es una frase y no una
       * etiqueta porque las dos situaciones necesitan sujeto y verbo para no leerse como una
       * corrección del BOE.
       */
      readonly texto: string;
      /**
       * El registro de WoRMS al que apunta la fila: **su nombre**, su `AphiaID` y su enlace. Es el
       * que hay que poder abrir para comprobarla, y los tres campos apuntan al mismo sitio: un
       * identificador junto a un enlace que lleva a otro registro es peor que no publicar ninguno.
       *
       * El **nombre** entró con el hallazgo H-2 de T-20. En las 22 filas a las que WoRMS no vio el
       * nombre de la norma, este registro es el del nombre **corregido** (`Cancer pagurus` por
       * `Cáncer pagurus`) y no aparecía en ninguna parte de la fila: se publicaba el `AphiaID` a
       * secas, rotulado además como si fuera la ficha del nombre de la norma. Quien quisiera
       * comprobar la fila tenía que salir del sitio para saber a qué taxón apunta el identificador
       * que estaba leyendo, que es justo lo que esta columna existe para evitar.
       */
      readonly ficha: {
        readonly nombre: string;
        readonly aphiaId: number;
        readonly url: string;
      };
      /**
       * El nombre aceptado hoy y su propio `AphiaID`, **solo cuando difiere del de la norma**.
       * **Se suma al del BOE; no lo sustituye.** Son 11 de las 86.
       */
      readonly aceptado: { readonly nombre: string; readonly aphiaId: number } | null;
      /** Cómo llegamos a este registro, cuando el mapeo es nuestro; `null` si lo resolvió WoRMS. */
      readonly correspondencia: string | null;
    }
  /** WoRMS no resuelve el nombre. Viaja el motivo, nunca un hueco mudo. */
  | { readonly tipo: "sin_resolver"; readonly motivo: string };

/** Una talla de la especie dentro de un anexo: la cifra, qué mide y el literal del BOE. */
export interface TallaDeLaFila {
  /**
   * Qué se mide, cuando el anexo mide la especie de más de una forma; `null` si no lo dice.
   *
   * Sin esto, la cigala publica en el mismo caladero **2 cm y 7 cm** y las dos cifras se leen como
   * una contradicción. Son cuatro filas del BOE: `Nephrops norvegicus` en el Anexo I y en el II.
   */
  readonly medida: string | null;
  readonly talla: TallaEscrita;
  /** El literal de la celda del BOE, para poder comparar lo pintado con lo publicado. */
  readonly literal: string;
  /**
   * Las notas del anexo que modifican esta cifra, **escritas enteras**; vacío si no lleva ninguna.
   *
   * Se pintan **con la cifra y en su mismo bloque**, no en un pie de la página: la nota es parte de
   * la cifra. Un número sin su excepción es una cifra legal falsa para quien pesca en la zona
   * excepcionada, y una llamada `(***)` sin pie es la propia página avisando de que falta algo y no
   * diciendo qué (hallazgo H-1 de T-20; la doctrina es la de T-19 y la sección de tallas ya la
   * cumple en las 153 páginas de puerto).
   */
  readonly notas: readonly string[];
}

/**
 * Un caladero dentro de una fila: **sus** tallas (en plural) y **una** presencia.
 *
 * La forma no es indiferente y sale de lo que cada cosa es: el BOE puede fijarle a una especie más
 * de una talla en el mismo anexo —la cigala, por cefalotórax y por longitud total—, mientras que la
 * presencia es de la especie **en el recorte de ese caladero** y no de cada medida. Con una talla
 * por entrada, la cigala publicaría dos veces el mismo recuento de OBIS en la misma fila, que es
 * una invitación a sumarlos: 950 y 950 no son 1.900 registros, son el mismo dato dos veces. Es la
 * forma que ya tiene el dataset (`EspecieEnCaladero`), así que aquí no hay nada que agrupar.
 */
export interface CaladeroDeLaFila {
  readonly id: string;
  readonly nombre: string;
  /** Las tallas que ese anexo le fija, en el orden del BOE. Casi siempre una; la cigala, dos. */
  readonly tallas: readonly TallaDeLaFila[];
  /**
   * La presencia, **siempre como frase**: la cifra con su sesgo pegado, o el motivo de que no haya
   * ninguna. Nunca un número suelto, que es lo que el gate E4 persigue.
   */
  readonly presencia: string;
  /** `true` cuando la frase lleva una cifra dentro. Lo consume el gate y el CSS, no el texto. */
  readonly hayCifra: boolean;
}

/** Una fila del catálogo, con todo lo que hay que pintar ya resuelto. */
export interface FilaDeEspecie {
  /** Identificador estable de la fila (`data-especie`), el que usan los gates para encontrarla. */
  readonly clave: string;
  /** El nombre que escribe la norma, literal. **Obligatorio: no hay fila sin él.** */
  readonly nombreBoe: string;
  /** Los nombres comunes con los que la norma la llama, sin repetir y en el orden de los anexos. */
  readonly nombresComunes: readonly string[];
  readonly taxon: TaxonDeLaFila;
  /** «género, no especie» y sus dos hermanos, en las 17 filas que no son una especie; `null` en las demás. */
  readonly rango: string | null;
  /**
   * Que el mismo taxón está **en otra fila de la tabla**, con la otra grafía del BOE; `null` en las
   * 80 filas que no tienen hermana.
   *
   * Son tres pares y seis filas, y sin este cruce cada una de las seis se lee como si fuera la
   * única: quien busca el atún rojo por `Thunnus thynnus` ve dos caladeros y concluye que en
   * Canarias no hay talla mínima, cuando la hay en la fila de al lado (hallazgo H-3 de T-20).
   */
  readonly tambienEn: string | null;
  readonly caladeros: readonly CaladeroDeLaFila[];
  /** Los identificadores de sus caladeros, que es de lo que se agarra el filtro sin JavaScript. */
  readonly idsDeCaladero: readonly string[];
}

/** El dataset no publica lo que la fila necesita para no mentir. El mensaje nombra la especie. */
export class CatalogoIncompleto extends Error {
  constructor(nombreBoe: string, detalle: string) {
    super(`No se puede publicar la fila de ${nombreBoe}: ${detalle}`);
    this.name = "CatalogoIncompleto";
  }
}

/**
 * El taxón de una especie, resuelto para pintarse.
 *
 * **Levanta** en los dos casos en los que publicar sería peor que romper el build: una especie sin
 * registro de WoRMS y sin motivo (una ausencia muda no se distingue de un fallo nuestro) y una
 * correspondencia marcada como nuestra sin decir cuál es. La segunda es el gate E2 visto desde la
 * interfaz: el pipeline no debería producirla, y si la produce no se publica.
 */
function taxonDeLaFila(especie: EspecieDelCatalogo): TaxonDeLaFila {
  const { worms, nombreBoe } = especie;
  if (worms === null) {
    if (especie.sinResolver === null) {
      throw new CatalogoIncompleto(
        nombreBoe,
        "no resuelve en WoRMS y el dataset no dice por qué. Una ausencia sin motivo se lee como un " +
          "hueco del catálogo y no como lo que es.",
      );
    }
    return { tipo: "sin_resolver", motivo: especie.sinResolver };
  }
  const aceptado = worms.aceptado;
  return {
    tipo: "resuelto",
    texto: queDiceWorms(worms),
    ficha: { nombre: worms.nombre, aphiaId: worms.aphiaId, url: worms.url },
    aceptado: aceptado === null ? null : { nombre: aceptado.nombre, aphiaId: aceptado.aphiaId },
    correspondencia: correspondenciaDe(nombreBoe, worms),
  };
}

/**
 * Qué dice WoRMS de esta fila, en las **tres** situaciones que hay. Antes se contaban dos.
 *
 * La que faltaba —y es el hallazgo H-2 de T-20— son las 22 filas a las que **a WoRMS no se le
 * preguntó el nombre de la norma**, porque el de la norma no resuelve y fuimos nosotros quienes
 * decidimos qué preguntarle: los 15 géneros escritos con `spp`, las 6 erratas de imprenta y la
 * celda que nombra dos especies. En 20 de ellas el nombre devuelto coincidía consigo mismo, el
 * adaptador dejaba `aceptado` en `null` y la fila caía en «WoRMS acepta el nombre de la norma»
 * sobre nombres que WoRMS nunca vio —`Sepia spp`, `Thunnus aibacares`—, contradiciéndose dos líneas
 * más abajo con la correspondencia firmada por nosotros.
 *
 * El discriminante es `origen`, que es **un hecho del dataset y no una heurística**: vale `mareia`
 * exactamente cuando la consulta la decidimos nosotros. No se compara el nombre consultado con el
 * del BOE porque eso sería un segundo camino al mismo hecho, y un segundo camino puede discrepar.
 */
function queDiceWorms(worms: TaxonEnWorms): string {
  const aceptado = worms.aceptado?.nombre ?? null;
  if (worms.origen === "mareia") {
    return noSePreguntoEsteNombre(worms.nombre, worms.estado, aceptado);
  }
  return aceptado === null ? MISMO_NOMBRE : remiteA(worms.estado, aceptado);
}

/** La correspondencia, cuando es nuestra y por tanto tiene que ir firmada; `null` cuando es de WoRMS. */
function correspondenciaDe(nombreBoe: string, worms: TaxonEnWorms): string | null {
  if (worms.origen === "worms") return null;
  if (worms.comoSeLlego === null) {
    throw new CatalogoIncompleto(
      nombreBoe,
      "el dataset marca la correspondencia como nuestra y no dice cuál es. Un mapeo sin dueño se " +
        "lee como si lo firmase WoRMS.",
    );
  }
  return correspondenciaNuestra(worms.comoSeLlego);
}

/**
 * Las filas del catálogo, ordenadas **por el nombre del BOE**.
 *
 * El orden es el del nombre legal y no el del aceptado ni el del común, y no es indiferente: es el
 * nombre por el que se busca una especie cuando lo que se tiene delante es la norma. `localeCompare`
 * con `es` para que la tilde de `Cáncer pagurus` no lo mande al final de la lista.
 */
export function filasDeEspecies(
  catalogo: CatalogoDeEspecies,
  formato: FormatoDelCatalogo,
): readonly FilaDeEspecie[] {
  const hermanas = filasDelMismoTaxon(catalogo);
  return [...catalogo.especies]
    .sort((una, otra) => una.nombreBoe.localeCompare(otra.nombreBoe, "es"))
    .map((especie) => filaDeEspecie(especie, formato, hermanas.get(especie.clave) ?? []));
}

/**
 * Qué otras filas publican **el mismo registro de WoRMS**, indexado por clave.
 *
 * Se agrupa por `AphiaID` y no por nombre porque el `AphiaID` es la identidad del taxón para la
 * fuente: son tres pares que el BOE escribe con dos grafías (`Thunnus thynnus` / `Thunnus Thynnus`,
 * `Thunnus albacares` / `Thunnus aibacares`, `Mugil spp` / `Mugil spps`) y para WoRMS cada par es
 * un solo animal. La clave con digest los mantiene como dos filas distintas, que es lo correcto
 * —son dos nombres de la norma—, pero cada una tiene que **enterarse de la otra**: si no, la que
 * lleva el nombre bien escrito se lee como si diera cuenta de todos los caladeros del taxón y deja
 * fuera una talla legal sin decirlo (hallazgo H-3 de T-20).
 */
function filasDelMismoTaxon(catalogo: CatalogoDeEspecies): ReadonlyMap<string, readonly string[]> {
  return new Map(
    [...hermanasPorClave(catalogo)].map(([clave, hermanas]) => [
      clave,
      hermanas.map((otra) => otra.nombreBoe),
    ]),
  );
}

/**
 * Lo mismo, pero devolviendo **la clave** de cada hermana en vez de su nombre.
 *
 * Existe porque la ficha de especie (T-23) tiene que **enlazar** a la hermana y el aviso de
 * `tambienEnOtraFila` sólo trae nombres del BOE: quien lee «el BOE nombra a este mismo taxón también
 * como “Thunnus Thynnus”» y no puede pulsarlo tiene que volver al catálogo y buscarlo a mano, que es
 * justo la fricción por la que el hallazgo H-3 se leía mal. La agrupación es **la misma** —de aquí
 * salen las dos— para que la ficha no pueda enlazar a una hermana distinta de la que nombra la
 * tabla.
 */
export function clavesDelMismoTaxon(
  catalogo: CatalogoDeEspecies,
): ReadonlyMap<string, readonly string[]> {
  return new Map(
    [...hermanasPorClave(catalogo)].map(([clave, hermanas]) => [
      clave,
      hermanas.map((otra) => otra.clave),
    ]),
  );
}

/** Las especies que comparten `AphiaID` con otra, indexadas por clave. La agrupación, una sola vez. */
function hermanasPorClave(
  catalogo: CatalogoDeEspecies,
): ReadonlyMap<string, readonly EspecieDelCatalogo[]> {
  const porAphia = new Map<number, EspecieDelCatalogo[]>();
  for (const especie of catalogo.especies) {
    const aphiaId = especie.worms?.aphiaId;
    if (aphiaId === undefined) continue;
    porAphia.set(aphiaId, [...(porAphia.get(aphiaId) ?? []), especie]);
  }
  const hermanas = new Map<string, readonly EspecieDelCatalogo[]>();
  for (const filas of porAphia.values()) {
    if (filas.length < 2) continue;
    for (const especie of filas) {
      hermanas.set(
        especie.clave,
        filas.filter((otra) => otra.clave !== especie.clave),
      );
    }
  }
  return hermanas;
}

function filaDeEspecie(
  especie: EspecieDelCatalogo,
  formato: FormatoDelCatalogo,
  hermanas: readonly string[],
): FilaDeEspecie {
  if (especie.caladeros.length === 0) {
    throw new CatalogoIncompleto(
      especie.nombreBoe,
      "no la regula ningún caladero. El catálogo son las especies a las que la norma les fija una " +
        "talla; una fila sin ninguna no sale de la norma.",
    );
  }
  const caladeros = especie.caladeros.map((caladero) => caladeroDeLaFila(caladero, formato));
  return {
    clave: especie.clave,
    nombreBoe: especie.nombreBoe,
    nombresComunes: [...new Set(especie.caladeros.map((caladero) => caladero.nombreComun))],
    taxon: taxonDeLaFila(especie),
    rango: especie.worms === null ? null : rangoEscrito(especie.worms.rango),
    tambienEn: hermanas.length === 0 ? null : tambienEnOtraFila(hermanas),
    caladeros,
    idsDeCaladero: caladeros.map((caladero) => caladero.id),
  };
}

/**
 * Un caladero de la fila, listo para pintarse: sus tallas escritas **con sus notas** y su presencia
 * **como frase**.
 *
 * Aquí no se agrupa nada —el dataset ya publica una entrada por especie y caladero, con sus tallas
 * dentro— y la única decisión es cuál de los dos silencios se escribe cuando no hay cifra. Son dos y
 * no significan lo mismo: que se le preguntara a OBIS y no tuviera ningún registro en el recorte
 * (`SIN_REGISTROS`, que dice que nadie lo ha anotado ahí) y que **no se le preguntara**, porque el
 * nombre no resuelve en WoRMS y no hay taxón por el que consultar (`NO_SE_PREGUNTO_A_OBIS`).
 * Escribir el primero en el segundo caso afirmaría sobre OBIS algo que no hemos comprobado, que es
 * la misma clase de mentira que publicar un cero.
 *
 * **Las dos frases son constantes de `textos.ts` y ninguna sale del dato**, que es la corrección del
 * hallazgo H-5 de T-20: la del silencio sin consulta se imprimía tal cual desde `presenciaAusente`,
 * y por ahí entraba una afirmación sobre lo que hay en el mar con toda la escalera en verde.
 */
function caladeroDeLaFila(
  caladero: EspecieEnCaladero,
  formato: FormatoDelCatalogo,
): CaladeroDeLaFila {
  return {
    id: caladero.id,
    nombre: caladero.nombre,
    tallas: caladero.tallas.map((entrada) => ({
      medida: entrada.medida,
      talla: textoDeTalla(entrada.talla, formato),
      literal: entrada.textoOriginal,
      notas: entrada.notas.map((nota) => notaDeLaTalla(nota.marca, nota.texto)),
    })),
    presencia:
      caladero.presencia === null
        ? (caladero.seLePreguntoAObis ? SIN_REGISTROS : NO_SE_PREGUNTO_A_OBIS)
        : presenciaEscrita(caladero.presencia),
    hayCifra: caladero.presencia !== null,
  };
}

// =================================================================================================
// Las filas del BOE que la tabla no puede publicar como especie
// =================================================================================================

/** Una fila de la norma sin binomio, lista para pintarse: su talla escrita y su motivo. */
export interface FilaSinBinomioEscrita {
  /** El nombre común con el que la norma la nombra, literal («Cigalas (colas)»). */
  readonly nombreComun: string;
  /** El caladero cuyo anexo la fija, escrito con su nombre y no con su identificador. */
  readonly caladero: string;
  /** La talla, escrita con el mismo criterio que las de la tabla. Es una cifra legal igual. */
  readonly talla: TallaEscrita;
  /** El literal de la celda del BOE, para poder comparar lo pintado con lo publicado. */
  readonly literal: string;
  /** Por qué no está en la tabla. Nunca un hueco mudo. */
  readonly motivo: string;
}

/**
 * Las filas del BOE que se quedan fuera de la tabla, listas para publicarse con su motivo.
 *
 * El nombre del caladero **se resuelve contra las especies del propio catálogo** y no se teclea: el
 * dataset guarda aquí el identificador, y es el mismo que declaran las 86 filas. Si no lo conociera
 * —lo que significaría que el catálogo y esta lista hablan de anexos distintos— se publica el
 * identificador tal cual antes que inventarse un nombre.
 */
export function filasSinBinomio(
  catalogo: CatalogoDeEspecies,
  formato: FormatoDelCatalogo,
): readonly FilaSinBinomioEscrita[] {
  const nombres = new Map(
    catalogo.especies.flatMap((especie) =>
      especie.caladeros.map((caladero) => [caladero.id, caladero.nombre] as const),
    ),
  );
  return catalogo.sinNombreCientifico.map((fila) => ({
    nombreComun: fila.nombreComun,
    caladero: enElCaladero(nombres.get(fila.caladero) ?? fila.caladero),
    talla: textoDeTalla(fila.talla, formato),
    literal: fila.textoOriginal,
    motivo: fila.motivo,
  }));
}

// =================================================================================================
// Las cuentas, recalculadas desde el contenido
// =================================================================================================

/** Un caladero visto desde el catálogo: cuántas especies regula. */
export interface CaladeroDelCatalogo {
  readonly id: string;
  readonly nombre: string;
  readonly especies: number;
}

/**
 * El censo del catálogo: las cifras que la página publica de sí misma.
 *
 * **Se recalculan desde el contenido y no se leen de un campo `resumen` del dataset ni se teclean
 * en la plantilla.** Es la doctrina de la casa (el resumen de `areas-protegidas` lo recalcula el
 * pipeline desde sus propias filas) y aquí cuesta especialmente poco: si el BOE gana o pierde una
 * especie, las cuentas de la página cambian solas y ninguna frase se queda diciendo 86.
 */
export interface CensoDelCatalogo {
  /** Especies del catálogo, que son los nombres científicos que la norma escribe. */
  readonly especies: number;
  /**
   * Cuántas resuelven en WoRMS **preguntando el nombre del BOE tal cual**.
   *
   * Se cuentan aparte de las que resuelven por una correspondencia nuestra, y esa separación es el
   * censo: mezclarlas publicaría como respuesta de la fuente lo que en parte es decisión nuestra.
   */
  readonly resueltasTalCual: number;
  /** Cuántas resuelven porque **nosotros** decidimos a qué apuntan, con su motivo publicado. */
  readonly porCorrespondenciaNuestra: number;
  /** Cuántas resuelven a un nombre distinto del que usa la norma. */
  readonly conAceptadoDistinto: number;
  /** Cuántas son de rango **género**: la norma regula el género entero. */
  readonly deGenero: number;
  /** Cuántas no resuelven, y por tanto publican su motivo. */
  readonly sinResolver: number;
  /** Los caladeros que aparecen en el catálogo, en el orden en que salen del dataset. */
  readonly caladeros: readonly CaladeroDelCatalogo[];
}

export function censoDelCatalogo(catalogo: CatalogoDeEspecies): CensoDelCatalogo {
  const especies = catalogo.especies;
  const caladeros = new Map<string, CaladeroDelCatalogo>();
  for (const especie of especies) {
    // Una especie cuenta **una vez por caladero**, y aquí eso es contar entradas porque el dataset
    // publica una por especie y caladero, con sus tallas dentro. Cuando eran una entrada por talla,
    // la cigala —cefalotórax y longitud total en el mismo anexo— se contaba dos veces y la opción
    // del filtro decía 52 mientras el enlace de la página de puerto decía 51. Dos cuentas de lo
    // mismo que no coinciden se leen como que una está mal, y lo estaría.
    for (const enEsteCaladero of especie.caladeros) {
      const id = enEsteCaladero.id;
      caladeros.set(id, {
        id,
        nombre: enEsteCaladero.nombre,
        especies: (caladeros.get(id)?.especies ?? 0) + 1,
      });
    }
  }
  return {
    especies: especies.length,
    resueltasTalCual: especies.filter((especie) => especie.worms?.origen === "worms").length,
    porCorrespondenciaNuestra: especies.filter((especie) => especie.worms?.origen === "mareia")
      .length,
    conAceptadoDistinto: especies.filter(
      (especie) => especie.worms !== null && especie.worms.aceptado !== null,
    ).length,
    deGenero: especies.filter((especie) => especie.worms?.rango === "genero").length,
    sinResolver: especies.filter((especie) => especie.worms === null).length,
    caladeros: [...caladeros.values()],
  };
}

/**
 * El `id` del ancla con la que se filtra el catálogo por un caladero.
 *
 * Vive aquí porque lo comparten **dos superficies**: la página del catálogo, que la pinta, y la
 * sección de la página de puerto, que enlaza a ella. Escribir la misma cadena por separado en las
 * dos es exactamente lo que hace que un renombrado deje 153 enlaces apuntando a un ancla que ya no
 * existe — y un enlace roto a un filtro no se ve: la página abre entera, sin filtrar.
 *
 * El prefijo `cal-` no es decorativo: separa el espacio de nombres del filtro del de los `id` de las
 * secciones de la página, que también salen del dataset.
 */
export function anclaDeCaladero(idDelCaladero: string): string {
  return `cal-${idDelCaladero}`;
}
