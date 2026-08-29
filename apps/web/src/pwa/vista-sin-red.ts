/**
 * Qué dice la sección «sin cobertura» de la página de puerto, en cada uno de sus cinco estados.
 *
 * Igual que `modulos/meteo/vista.ts` en T-11: aquí no se toca el DOM ni la red, entra un estado y
 * sale un modelo de vista. Eso es lo que permite tener un test por estado sin navegador, y lo que
 * impide que las frases se escriban a mano dentro de un manejador de clic.
 *
 * Los cinco estados no son decorativos: **son cinco situaciones distintas para quien está en la
 * orilla**, y confundir dos de ellas es el hallazgo A-11 de T-09 con otra ropa.
 *
 *  1. el navegador no puede guardar nada (privado, almacenamiento denegado);
 *  2. hay red y el puerto no está guardado → se puede guardar;
 *  3. **no** hay red y el puerto no está guardado → no se puede guardar, y hay que decir que lo que
 *     se está leyendo puede desaparecer al cerrar;
 *  4. hay red y el puerto está guardado → cuánto ocupa y qué se puede hacer con ello;
 *  5. **no** hay red y el puerto está guardado → esto es la copia, de cuándo es, y qué de la página
 *     depende de la red y qué no.
 *
 * El sello es el mismo de T-11 (`src/sello.ts`), no uno nuevo: la edad de una copia guardada se
 * escribe igual que la edad de un dato de meteo, porque para quien lee es la misma pregunta.
 */

import { numero } from "../formato.ts";
import { antiguedad } from "../sello.ts";
import type { SelloDeAntiguedad } from "../sello.ts";

/** Lo que se sabe de la copia guardada de este puerto. */
export interface CopiaGuardada {
  /** Reloj del navegador al guardarla. */
  readonly guardadoEnMs: number;
  /** Bytes del JSON de constantes, **medidos** al bajarlo. */
  readonly bytes: number;
}

/** Los años que la copia sabe calcular (los publica `pwa/dia-offline.ts`). */
export interface Ventana {
  readonly desde: number;
  readonly hasta: number;
}

export interface EntradaSinRed {
  readonly copia: CopiaGuardada | undefined;
  /** `navigator.onLine`. Su negativo es fiable, que es para lo único que se usa. */
  readonly conexion: boolean;
  /** Si este navegador admite guardar (service worker + IndexedDB). */
  readonly sePuedeGuardar: boolean;
  readonly ahoraMs: number;
  readonly nombre: string;
  /** Día que publica esta página (`FECHA_DE_BUILD`). */
  readonly fechaDeBuild: string;
  readonly ventana: Ventana;
}

/** El verbo que ofrece el botón, si hay alguno que ofrecer. */
export interface AccionSinRed {
  readonly verbo: "guardar" | "olvidar";
  readonly etiqueta: string;
}

export interface VistaSinRed {
  readonly sello: SelloDeAntiguedad;
  readonly accion: AccionSinRed | undefined;
}

/**
 * Los bytes de la copia, en kilobytes **de mil** (kB), que es la unidad del SI y la que usan los
 * navegadores al informar de almacenamiento.
 *
 * Se escribe la unidad completa a propósito: mezclar kB (1000) y KiB (1024) en la misma frase —o
 * escribir «KB» y que cada cual decida— convierte una medida en una impresión.
 */
export function kilobytes(bytes: number): string {
  return `${numero(bytes / 1000, 1)} kB`;
}

/** Qué se puede hacer con la copia, dicho una vez y reutilizado en los dos estados que la tienen. */
function loQueSirve(ventana: Ventana): string {
  return `calcula cualquier día entre ${ventana.desde} y ${ventana.hasta} sin cobertura`;
}

/** Qué de esta página depende de la red y qué no. Es la parte que se descuida. */
function queDependeDeLaRed(fechaDeBuild: string): string {
  return (
    `Las mareas, la curva y las efemérides de esta página se calcularon el ${fechaDeBuild} y no ` +
    `dependen de la conexión. El estado del mar sí depende: su bloque dice aparte de cuándo es lo ` +
    `que enseña, o por qué no hay nada.`
  );
}

export function vistaSinRed(entrada: EntradaSinRed): VistaSinRed {
  if (!entrada.sePuedeGuardar) {
    return {
      sello: {
        clase: "sin-dato",
        titular: "Este navegador no puede guardar la página",
        detalle:
          "Guardar sin red necesita service worker y almacenamiento local, y aquí no hay uno de " +
          "los dos (suele pasar en ventanas privadas). La página se sigue leyendo entera y se " +
          "imprime igual de bien.",
      },
      accion: undefined,
    };
  }
  if (entrada.copia === undefined) {
    return entrada.conexion ? sinGuardarConRed(entrada) : sinGuardarSinRed(entrada);
  }
  return entrada.conexion
    ? guardadoConRed(entrada, entrada.copia)
    : guardadoSinRed(entrada, entrada.copia);
}

/** Estado 2: hay red y no está guardado. El único en el que se puede ofrecer guardar. */
function sinGuardarConRed(entrada: EntradaSinRed): VistaSinRed {
  return {
    sello: {
      clase: "sin-dato",
      titular: `${entrada.nombre} no está guardado en este dispositivo`,
      detalle:
        `Guárdalo y esta página se abrirá sin cobertura, y ${loQueSirve(entrada.ventana)}. Es una ` +
        `copia local: no sale de este navegador, no se sincroniza con nadie y no hace falta cuenta.`,
    },
    accion: { verbo: "guardar", etiqueta: `Guardar ${entrada.nombre} para usarlo sin red` },
  };
}

/**
 * Estado 3: no hay red y no está guardado.
 *
 * **No se ofrece guardar**, porque no se puede: guardar exige bajarse la página y las constantes. Un
 * botón que va a fallar no es una acción, es una trampa. Y se dice lo importante: lo que se está
 * leyendo lo sirvió la caché del navegador y puede no estar la próxima vez.
 */
function sinGuardarSinRed(entrada: EntradaSinRed): VistaSinRed {
  return {
    sello: {
      clase: "caducado",
      titular: "Sin conexión, y esta página no está guardada aquí",
      detalle:
        `Lo que estás leyendo lo ha servido la caché del navegador y puede no estar la próxima ` +
        `vez. Cuando vuelva la red podrás guardar ${entrada.nombre} desde aquí. ` +
        queDependeDeLaRed(entrada.fechaDeBuild),
    },
    accion: undefined,
  };
}

/** Estado 4: hay red y está guardado. La edad de la copia va delante, como en cualquier sello. */
function guardadoConRed(entrada: EntradaSinRed, copia: CopiaGuardada): VistaSinRed {
  return {
    sello: {
      clase: "fresco",
      titular: `Guardado en este dispositivo hace ${edad(copia, entrada.ahoraMs)}`,
      detalle:
        `Ocupa ${kilobytes(copia.bytes)} de constantes armónicas y ${loQueSirve(entrada.ventana)}. ` +
        `La página se guarda con su hoja de estilos; la tipografía no, y sin red se lee en Georgia.`,
    },
    accion: { verbo: "olvidar", etiqueta: `Dejar de guardar ${entrada.nombre}` },
  };
}

/** Estado 5: no hay red y está guardado. Esto es lo que T-12 promete, dicho con su edad. */
function guardadoSinRed(entrada: EntradaSinRed, copia: CopiaGuardada): VistaSinRed {
  return {
    sello: {
      clase: "caducado",
      titular: `Sin conexión: estás leyendo la copia guardada hace ${edad(copia, entrada.ahoraMs)}`,
      detalle:
        `${queDependeDeLaRed(entrada.fechaDeBuild)} Y puedes pedir otro día más abajo: se calcula ` +
        `aquí mismo, en este navegador, con las constantes guardadas.`,
    },
    accion: { verbo: "olvidar", etiqueta: `Dejar de guardar ${entrada.nombre}` },
  };
}

/** Edad de la copia, medida como intervalo (regla 2 del sello). */
function edad(copia: CopiaGuardada, ahoraMs: number): string {
  return antiguedad(Math.max(0, ahoraMs - copia.guardadoEnMs) / 1_000);
}
