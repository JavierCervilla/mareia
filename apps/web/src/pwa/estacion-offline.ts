/**
 * **Lo que se guarda de un puerto para poder calcularlo sin red**, y cómo se comprueba.
 *
 * Está separado de `dia-offline.ts` —que es quien calcula— por una razón medida y no estética:
 * calcular arrastra el motor armónico de `@mareia/domain-core`, y el motor son ~70 kB de tabla de
 * constituyentes y correcciones nodales. Ese peso lo tiene que pagar **quien pide otro día**, no
 * las doce páginas de puerto por si acaso. Aquí no se importa el dominio: solo tipos, validación y
 * la ventana de años, que es lo que necesitan la página, el almacén y el endpoint.
 *
 * El `import type` de `TideStation` no rompe esa regla: es un tipo y desaparece al compilar, así
 * que no arrastra ni un byte del dominio al bundle.
 */

import type { TideStation } from "@mareia/domain-core";

/** Identificador del formato de `/offline/estaciones/<slug>.json`. Viaja dentro del fichero. */
export const ESQUEMA_ESTACION_OFFLINE = "mareia/estacion-offline/v1";

/**
 * Ventana de años alrededor del día del build en la que esta página calcula.
 *
 * Es **la misma que el API** (`ALMANAC_YEAR_WINDOW`, un año arriba y otro abajo) y no una elección
 * de esta capa: la predicción armónica se puede evaluar para cualquier instante, pero fuera de esa
 * ventana el error crece sin que nada en la pantalla lo diga. Que el navegador conteste lo mismo
 * que contestaría el servidor es la mitad de la promesa; la otra mitad es que, cuando no puede,
 * **lo diga** en vez de servir números de garantía desconocida.
 */
export const VENTANA_DE_ANOS = 1;

/** El puerto, en lo que la PWA necesita para volver a él y para escribir sus horas. */
export interface PuertoOffline {
  readonly slug: string;
  readonly nombre: string;
  readonly timezone: string;
  /** Ruta de su página, para poder guardarla y para volver a abrirla sin red. */
  readonly ruta: string;
}

/** Procedencia del dato, que viaja con él: sin esto, la tabla offline sería un número sin autor. */
export interface AtribucionOffline {
  readonly name: string;
  readonly url: string;
  readonly license: string;
}

/**
 * Lo que se guarda de un puerto para poder calcularlo sin red.
 *
 * Lleva la calidad de la estación y sus atribuciones **a propósito**: la tabla que se calcule en el
 * teléfono tiene que poder decir de dónde salen sus constantes y con qué grade, igual que la
 * página. Un dato offline no es un dato con menos deberes.
 */
export interface EstacionOffline {
  readonly schema: typeof ESQUEMA_ESTACION_OFFLINE;
  /** Día del build que generó el fichero, `YYYY-MM-DD`. Fija el centro de la ventana de años. */
  readonly generadoEn: string;
  readonly puerto: PuertoOffline;
  readonly estacion: TideStation;
  readonly grade: string;
  readonly atribuciones: readonly AtribucionOffline[];
}

/**
 * Valida un payload recién leído de la caché o de IndexedDB **antes de creérselo**.
 *
 * Lo que hay en el disco de un navegador lo pudo escribir una versión anterior de esta página, o
 * una extensión, o nadie. Si el payload no tiene la forma esperada se dice; calcular una marea con
 * un objeto a medias daría horas, y horas plausibles, que es la peor forma de fallar.
 */
export function esEstacionOffline(valor: unknown): valor is EstacionOffline {
  if (typeof valor !== "object" || valor === null) {
    return false;
  }
  const registro = valor as Record<string, unknown>;
  return (
    registro["schema"] === ESQUEMA_ESTACION_OFFLINE &&
    typeof registro["generadoEn"] === "string" &&
    esPuerto(registro["puerto"]) &&
    esEstacion(registro["estacion"])
  );
}

function esPuerto(valor: unknown): boolean {
  if (typeof valor !== "object" || valor === null) {
    return false;
  }
  const puerto = valor as Record<string, unknown>;
  return (
    typeof puerto["slug"] === "string" &&
    typeof puerto["nombre"] === "string" &&
    typeof puerto["timezone"] === "string" &&
    typeof puerto["ruta"] === "string"
  );
}

function esEstacion(valor: unknown): boolean {
  if (typeof valor !== "object" || valor === null) {
    return false;
  }
  const estacion = valor as Record<string, unknown>;
  const datum = estacion["datum"];
  return (
    Array.isArray(estacion["constituents"]) &&
    estacion["constituents"].length > 0 &&
    typeof datum === "object" &&
    datum !== null &&
    typeof (datum as Record<string, unknown>)["msl_offset_m"] === "number"
  );
}

/** Los años que esta copia sabe calcular, ambos incluidos. */
export function ventanaDeAnos(generadoEn: string): { readonly desde: number; readonly hasta: number } {
  const ano = Number(generadoEn.slice(0, 4));
  return { desde: ano - VENTANA_DE_ANOS, hasta: ano + VENTANA_DE_ANOS };
}
