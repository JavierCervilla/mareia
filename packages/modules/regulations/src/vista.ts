/**
 * Cómo se escribe una talla mínima. Todo el criterio de presentación de la sección, sin Astro y sin
 * `Intl`: funciones puras que un `node --test` puede juzgar sin construir el sitio.
 *
 * Las dos reglas que este archivo existe para hacer cumplir —y las dos son de las que cuestan
 * dinero al lector si se rompen:
 *
 * 1. **Las cinco clases de `Talla` se pintan cada una como lo que es.** El `switch` de
 *    `textoDeTalla` está cerrado con `never`: no hay `default`, así que no existe la rama que
 *    pintaría un `por_determinar` o un `1 1` como si fueran un número. Añadir una sexta clase al
 *    dataset **no compila** hasta que alguien decida cómo se escribe.
 * 2. **Ninguna cifra sale sin su nota.** `filasDeTallas` resuelve las marcas de cada especie contra
 *    las notas del anexo y **levanta** si una marca no tiene nota, o si una talla «por determinar»
 *    no arrastra la nota que dice por qué. Una marca que apunta a un pie que no está es un número
 *    desnudo con una estrellita al lado, que es peor que el número solo: parece anotado.
 *
 * El formato numérico se **presta** desde la superficie (`FormatoDeTallas`), igual que hace
 * `fishing`: el módulo no sabe si se escribe con coma o con punto, y el sitio ya tiene esa decisión
 * tomada en `apps/web/src/formato.ts`.
 */

import type { ComunidadDelPuerto, ResolucionDeNota } from "./excepciones.ts";
import { resolverNota } from "./excepciones.ts";
import {
  ROTULO_NOMBRE_LOCAL,
  SIN_TALLA_FIJADA,
  TALLA_ILEGIBLE,
} from "./textos.ts";
import type { Caladero, EspecieConTalla, NotaDeCaladero, Talla } from "./tipos.ts";

/** Lo que la superficie le presta al módulo para escribir números. */
export interface FormatoDeTallas {
  /** Un número con la coma decimal del sitio y los decimales que se le pidan. */
  readonly numero: (valor: number, decimales: number) => string;
}

/** Una nota del anexo ya resuelta: la marca **y su texto**, listos para pintarse juntos. */
export interface NotaVisible {
  readonly marca: string;
  readonly texto: string;
  /**
   * Si la excepción afecta o no al puerto de esta página, cuando se puede saber.
   *
   * Es `sin_resolver` para las notas que dependen de geometría marina (las divisiones del CIEM) y
   * está resuelta para las administrativas, que dependen de la comunidad autónoma —dato que el
   * portal ya tiene—. La nota entera se pinta en los dos casos: esto se suma, no sustituye.
   */
  readonly resolucion: ResolucionDeNota;
}

/**
 * Un nombre que la norma da… o no.
 *
 * Cuando no lo da, viaja el **motivo** y no un hueco: es la misma doctrina que `grade` y que
 * `por_determinar`, que una ausencia diga por qué lo es.
 */
export type NombreSecundario =
  | { readonly tipo: "nombre"; readonly valor: string }
  | { readonly tipo: "ausente"; readonly motivo: string };

/** Cómo queda escrita una talla concreta. */
export interface TallaEscrita {
  /** Lo que se pinta donde va la cifra. Puede ser una magnitud o una frase. */
  readonly texto: string;
  /**
   * `true` solo si `texto` es una magnitud. Lo consume el CSS para alinear cifras
   * (`tabular-nums`); una frase alineada como número se lee como si lo fuera.
   */
  readonly hayCifra: boolean;
  /** Segunda línea con el motivo, cuando la ausencia de cifra tiene que explicarse. */
  readonly explicacion: string | null;
}

/** Una fila de la tabla que se publica, con todo lo que hay que pintar ya resuelto. */
export interface FilaDeTalla {
  /** Identificador estable de la fila dentro del anexo (`data-especie`, y clave de render). */
  readonly clave: string;
  readonly nombreComun: string;
  /** Qué se mide, cuando la especie tiene más de una medida («Longitud cefalotórax»). */
  readonly medida: string | null;
  readonly cientifico: NombreSecundario;
  /** Nombre local canario: solo lo trae el Anexo III; en los otros dos es `null`. */
  readonly local: NombreSecundario | null;
  readonly talla: TallaEscrita;
  /** El literal de la celda del BOE, para poder comparar lo pintado con lo publicado. */
  readonly literal: string;
  /** Las notas que le aplican, **con su texto**. */
  readonly notas: readonly NotaVisible[];
}

/**
 * Cuántos decimales tiene de verdad el número, para no inventar precisión ni recortarla.
 *
 * `36` se escribe `36` y no `36,0`; `3,7` se escribe `3,7`. Fijar los decimales a uno redondearía
 * el día que la norma publique `2,25`, y redondear una cifra legal a la baja es exactamente el
 * error que cuesta una sanción.
 */
function decimalesDe(valor: number): number {
  return String(valor).split(".")[1]?.length ?? 0;
}

/**
 * `36 cm`, `3,7 cm`. El espacio entre la cifra y la unidad es **duro** (U+00A0) a propósito: una
 * talla legal partida entre dos líneas —«36» arriba y «cm» abajo— se lee mal y se cita peor. Pegar
 * la unidad aquí es lo que permite que la celda NO lleve `white-space: nowrap`, y eso es lo que
 * arregla el desbordamiento de los 80 puertos mediterráneos: la disyunción del atún rojo puede
 * partir por el «o», que es una separación de verdad, sin que ninguna de sus dos magnitudes se
 * rompa por dentro.
 */
function centimetros(valor: number, formato: FormatoDeTallas): string {
  return `${formato.numero(valor, decimalesDe(valor))}\u00a0cm`;
}

/** `6,4 kg`, con el mismo espacio duro que `centimetros`. */
function kilos(valor: number, formato: FormatoDeTallas): string {
  return `${formato.numero(valor, decimalesDe(valor))}\u00a0kg`;
}

/**
 * Cómo se escribe cada una de las cinco clases de talla.
 *
 * **Sin `default`.** El `never` del final es el gate: si mañana el dataset trae una sexta clase,
 * esto deja de compilar en vez de caer en una rama genérica que la pintaría como un número.
 */
export function textoDeTalla(talla: Talla, formato: FormatoDeTallas): TallaEscrita {
  switch (talla.tipo) {
    case "longitud_cm":
      return { texto: centimetros(talla.cm, formato), hayCifra: true, explicacion: null };
    case "peso_kg":
      // Se dice «de peso» porque la columna del BOE se titula «Talla (en cm)» y esta fila no es una
      // talla: quien lee de arriba abajo espera centímetros y aquí hay kilos.
      return { texto: `${kilos(talla.kg, formato)} de peso`, hayCifra: true, explicacion: null };
    case "longitud_o_peso":
      return {
        texto: `${centimetros(talla.cm, formato)} o ${kilos(talla.kg, formato)} de peso`,
        hayCifra: true,
        explicacion: null,
      };
    case "por_determinar":
      // La cifra no falta: la norma DECLARA que no la ha fijado, y eso es un dato. El porqué lo
      // pone la nota que arrastra la especie, y `filasDeTallas` levanta si no la arrastra.
      return { texto: SIN_TALLA_FIJADA, hayCifra: false, explicacion: null };
    case "sin_dato_legible":
      // El literal a la vista y el motivo debajo. No se corrige por inferencia: ver `tipos.ts`.
      return {
        texto: TALLA_ILEGIBLE,
        hayCifra: false,
        explicacion: talla.motivo,
      };
    default: {
      const imposible: never = talla;
      throw new Error(`clase de talla no contemplada: ${JSON.stringify(imposible)}`);
    }
  }
}

/** Identificador estable de una fila: su nombre y, si la tiene, su medida. */
export function claveDeFila(especie: EspecieConTalla): string {
  const partes = [especie.nombreComun, especie.medida ?? ""].join(" ");
  return partes
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

/** El nombre secundario, o el motivo por el que la norma no lo da. */
function nombreSecundario(
  valor: string | undefined,
  motivo: string | undefined,
  que: string,
  especie: string,
): NombreSecundario {
  if (valor !== undefined) return { tipo: "nombre", valor };
  if (motivo !== undefined) return { tipo: "ausente", motivo };
  throw new Error(
    `${especie}: no trae ${que} ni el motivo por el que falta. Una ausencia muda no se publica ` +
      `(dataset normativa/v1: el pipeline escribe el campo «…Ausente» con su motivo).`,
  );
}

/**
 * Las notas de una especie, resueltas contra el pie del anexo.
 *
 * **Levanta si una marca no tiene nota.** Es el caso que rompe la promesa entera de la sección: el
 * boquerón son 12 cm salvo en la división IX a) —de Galicia sur al golfo de Cádiz, donde sí hay
 * puertos nuestros—, donde son 10. Publicar «12 (**)» con el pie perdido es una cifra con aspecto de
 * dato anotado y sin el dato. (La nota de la lubina, 44 cm en 8.a/8.b, se cita mucho por ser la de
 * mayor diferencia, pero **no afecta a ningún puerto del portal**: la costa española es 8.c.)
 *
 * Además de traerla entera, **resuelve la nota para este puerto cuando se puede** (`excepciones.ts`):
 * la del pulpo del Anexo II excepciona a una comunidad autónoma y el portal sabe en cuál está el
 * lector, así que no hay motivo para pasarle a él ese trabajo. Las que dependen de la división del
 * CIEM se quedan sin resolver y se publican igual que siempre.
 */
function notasDe(
  especie: EspecieConTalla,
  notas: readonly NotaDeCaladero[],
  comunidad: ComunidadDelPuerto,
): readonly NotaVisible[] {
  return especie.notas.map((marca) => {
    const nota = notas.find((candidata) => candidata.marca === marca);
    if (nota === undefined) {
      throw new Error(
        `${especie.nombreComun}: la marca ${marca} no tiene nota en el anexo. Una cifra con una ` +
          `marca que no lleva a ninguna parte se lee como una cifra anotada, y no lo está.`,
      );
    }
    return { marca: nota.marca, texto: nota.texto, resolucion: resolverNota(nota.texto, comunidad) };
  });
}

/**
 * Las filas de la tabla de un caladero, listas para pintar.
 *
 * Se conserva **el orden del dataset**, que es el del BOE (alfabético por nombre común). No se
 * reordena por talla, ni por «mejores especies», ni por nada: ordenar una tabla legal por otro
 * criterio inventa una jerarquía que la norma no tiene.
 *
 * La `comunidad` es obligatoria y no opcional a propósito: es lo que permite decirle a quien lee si
 * la excepción de su tabla le afecta, y un parámetro que se puede omitir se omite. La página ya
 * sabe en qué puerto está —construye su URL con ese dato—, así que pedírsela no le cuesta nada.
 */
export function filasDeTallas(
  caladero: Caladero,
  formato: FormatoDeTallas,
  comunidad: ComunidadDelPuerto,
): readonly FilaDeTalla[] {
  return caladero.especies.map((especie) => {
    const notas = notasDe(especie, caladero.notas, comunidad);
    if (especie.talla.tipo === "por_determinar") {
      const citada = especie.talla.segunNota;
      if (!notas.some((nota) => nota.marca === citada)) {
        throw new Error(
          `${especie.nombreComun}: la talla está «por determinar» según ${citada} y la especie no ` +
            `arrastra esa nota, así que la página diría que no hay talla sin decir por qué.`,
        );
      }
    }
    return {
      clave: claveDeFila(especie),
      nombreComun: especie.nombreComun,
      medida: especie.medida ?? null,
      cientifico: nombreSecundario(
        especie.nombreCientifico,
        especie.nombreCientificoAusente,
        "nombre científico",
        especie.nombreComun,
      ),
      local:
        especie.nombreLocalCanario === undefined && especie.nombreLocalCanarioAusente === undefined
          ? null
          : nombreSecundario(
              especie.nombreLocalCanario,
              especie.nombreLocalCanarioAusente,
              ROTULO_NOMBRE_LOCAL,
              especie.nombreComun,
            ),
      talla: textoDeTalla(especie.talla, formato),
      literal: especie.textoOriginal,
      notas,
    };
  });
}
