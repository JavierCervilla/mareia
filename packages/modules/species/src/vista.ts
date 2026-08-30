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
  MISMO_NOMBRE,
  presenciaEscrita,
  rangoEscrito,
  remiteA,
  SIN_REGISTROS,
} from "./textos.ts";
import type {
  CatalogoDeEspecies,
  EspecieDelCatalogo,
  PresenciaObis,
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
       * El registro de WoRMS **del nombre que escribe la norma**, que es el que hay que poder abrir
       * para comprobar la fila. El `AphiaID` que se publica y el enlace apuntan al mismo sitio: un
       * identificador junto a un enlace que lleva a otro registro es peor que no publicar ninguno.
       */
      readonly ficha: { readonly aphiaId: number; readonly url: string };
      /**
       * El nombre aceptado hoy y su propio `AphiaID`, **solo cuando difiere del de la norma**.
       * **Se suma al del BOE; no lo sustituye.** Son 10 de las 86.
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
}

/**
 * Un caladero dentro de una fila: **sus** tallas (en plural) y **una** presencia.
 *
 * La forma no es indiferente y sale de lo que cada cosa es: el BOE puede fijarle a una especie más
 * de una talla en el mismo anexo —la cigala, por cefalotórax y por longitud total—, mientras que la
 * presencia es de la especie **en la caja de ese caladero** y no de cada medida. Con una talla por
 * entrada, la cigala publicaba dos veces el mismo recuento de OBIS en la misma fila, que es una
 * invitación a sumarlos: 950 y 950 no son 1.900 registros, son el mismo dato dos veces.
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
  /** «género, no especie» en las 15 filas que lo son; `null` en las demás. */
  readonly rango: string | null;
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
    texto: aceptado === null ? MISMO_NOMBRE : remiteA(worms.estado, aceptado.nombre),
    ficha: { aphiaId: worms.aphiaId, url: worms.url },
    aceptado: aceptado === null ? null : { nombre: aceptado.nombre, aphiaId: aceptado.aphiaId },
    correspondencia: correspondenciaDe(nombreBoe, worms),
  };
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
  return [...catalogo.especies]
    .sort((una, otra) => una.nombreBoe.localeCompare(otra.nombreBoe, "es"))
    .map((especie) => filaDeEspecie(especie, formato));
}

function filaDeEspecie(especie: EspecieDelCatalogo, formato: FormatoDelCatalogo): FilaDeEspecie {
  if (especie.caladeros.length === 0) {
    throw new CatalogoIncompleto(
      especie.nombreBoe,
      "no la regula ningún caladero. El catálogo son las especies a las que la norma les fija una " +
        "talla; una fila sin ninguna no sale de la norma.",
    );
  }
  const caladeros = agruparPorCaladero(especie, formato);
  return {
    clave: especie.clave,
    nombreBoe: especie.nombreBoe,
    nombresComunes: [...new Set(especie.caladeros.map((caladero) => caladero.nombreComun))],
    taxon: taxonDeLaFila(especie),
    rango: especie.worms === null ? null : rangoEscrito(especie.worms.rango),
    caladeros,
    idsDeCaladero: caladeros.map((caladero) => caladero.id),
  };
}

/**
 * Las entradas del dataset agrupadas por caladero: varias tallas, una presencia.
 *
 * **Levanta si dos entradas del mismo caladero traen presencias distintas**, y no es una manía de
 * validación: la presencia es de la especie en la caja de ese caladero, así que dos valores para lo
 * mismo significan que una de las dos consultas a OBIS mide otra cosa. Publicar cualquiera de las
 * dos sería elegir a cara o cruz cuál es la buena.
 */
function agruparPorCaladero(
  especie: EspecieDelCatalogo,
  formato: FormatoDelCatalogo,
): readonly CaladeroDeLaFila[] {
  const porCaladero = new Map<string, { nombre: string; presencia: PresenciaObis | null; tallas: TallaDeLaFila[] }>();
  for (const entrada of especie.caladeros) {
    const talla: TallaDeLaFila = {
      medida: entrada.medida,
      talla: textoDeTalla(entrada.talla, formato),
      literal: entrada.textoOriginal,
    };
    const visto = porCaladero.get(entrada.id);
    if (visto === undefined) {
      porCaladero.set(entrada.id, {
        nombre: entrada.nombre,
        presencia: entrada.presencia,
        tallas: [talla],
      });
      continue;
    }
    if (!mismaPresencia(visto.presencia, entrada.presencia)) {
      throw new CatalogoIncompleto(
        especie.nombreBoe,
        `el caladero ${entrada.id} trae dos presencias distintas para la misma especie. La ` +
          `presencia es de la especie en la caja del caladero, no de cada talla.`,
      );
    }
    visto.tallas.push(talla);
  }
  return [...porCaladero.entries()].map(([id, agrupado]) => ({
    id,
    nombre: agrupado.nombre,
    tallas: agrupado.tallas,
    presencia:
      agrupado.presencia === null ? SIN_REGISTROS : presenciaEscrita(agrupado.presencia),
    hayCifra: agrupado.presencia !== null,
  }));
}

/** Dos presencias son la misma cuando lo son sus cuatro cifras, o cuando las dos son ausencia. */
function mismaPresencia(una: PresenciaObis | null, otra: PresenciaObis | null): boolean {
  if (una === null || otra === null) return una === otra;
  return (
    una.registros === otra.registros &&
    una.datasets === otra.datasets &&
    una.desde === otra.desde &&
    una.hasta === otra.hasta
  );
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
    // Una especie cuenta **una vez por caladero**, aunque el anexo le dedique dos filas: la cigala
    // tiene dos —longitud del cefalotórax y longitud total— y contarlas por separado haría que la
    // opción del filtro dijera 52 mientras el enlace de la página de puerto dice 51. Dos cuentas de
    // lo mismo que no coinciden se leen como que una de las dos está mal, y lo estaría.
    for (const id of new Set(especie.caladeros.map((caladero) => caladero.id))) {
      const enEsteCaladero = especie.caladeros.find((caladero) => caladero.id === id);
      if (enEsteCaladero === undefined) continue;
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
    porCorrespondenciaNuestra: especies.filter((especie) => especie.worms?.origen === "nuestro")
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
