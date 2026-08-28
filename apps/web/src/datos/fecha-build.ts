/**
 * La fecha que publica el sitio.
 *
 * Un sitio estático no tiene «hoy»: tiene el día que se construyó. Aquí se decide cuál es, y la
 * respuesta es **un parámetro**, no `new Date()` esparcido por las páginas:
 *
 * - `BUILD_DATE=YYYY-MM-DD` → ese día, para las 12 páginas. Es lo que hace el build reproducible:
 *   dos builds del mismo commit con el mismo `BUILD_DATE` dan el mismo HTML byte a byte, que es lo
 *   que permite testear el `dist/` contra los casos de uso y diffear dos despliegues.
 * - sin `BUILD_DATE` → el día UTC del reloj de la máquina, que es lo que quiere el rebuild diario
 *   de producción (T-15).
 *
 * Una fecha mal escrita **rompe el build**: mejor eso que 12 páginas con las mareas de otro día.
 */

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Nombre de la variable de entorno, en un solo sitio para que el mensaje de error no mienta. */
export const VARIABLE_FECHA = "BUILD_DATE";

/**
 * Comprueba que `YYYY-MM-DD` es una fecha **del calendario** y no solo una cadena con la forma
 * correcta: `2026-02-30` cumple el patrón y no existe.
 */
function esFechaDelCalendario(fechaIso: string): boolean {
  const instante = Date.parse(`${fechaIso}T00:00:00Z`);
  return !Number.isNaN(instante) && new Date(instante).toISOString().startsWith(fechaIso);
}

/** El día UTC de un instante, en `YYYY-MM-DD`. */
export function diaUtcDe(instanteMs: number): string {
  return new Date(instanteMs).toISOString().slice(0, "YYYY-MM-DD".length);
}

/**
 * Día civil que publican las páginas de este build.
 *
 * @param entorno Variables de entorno (inyectables para poder testear sin tocar el proceso).
 * @param ahoraMs Reloj, solo para el caso sin `BUILD_DATE`.
 * @throws {RangeError} si `BUILD_DATE` no es una fecha real en formato `YYYY-MM-DD`.
 */
export function fechaDeBuild(
  entorno: Record<string, string | undefined> = process.env,
  ahoraMs: number = Date.now(),
): string {
  const declarada = entorno[VARIABLE_FECHA];
  if (declarada === undefined || declarada === "") {
    return diaUtcDe(ahoraMs);
  }
  if (!FORMATO_FECHA.test(declarada) || !esFechaDelCalendario(declarada)) {
    throw new RangeError(
      `${VARIABLE_FECHA} debe ser una fecha del calendario en formato YYYY-MM-DD; llegó ` +
        `${JSON.stringify(declarada)}`,
    );
  }
  return declarada;
}

/**
 * La fecha de ESTE build, resuelta una sola vez.
 *
 * Se resuelve al importar el módulo —y no en cada página— por dos motivos: un `BUILD_DATE` mal
 * escrito rompe el build en el primer import en vez de en la página 7, y un build sin `BUILD_DATE`
 * que cruce la medianoche UTC no puede publicar dos días distintos según qué página se generase
 * antes o después.
 */
export const FECHA_DE_BUILD: string = fechaDeBuild();

/** El mes civil al que pertenece una fecha: su primer y su último día, en `YYYY-MM-DD`. */
export function mesDe(fechaIso: string): { readonly primero: string; readonly ultimo: string } {
  const inicio = new Date(`${fechaIso}T00:00:00Z`);
  const primero = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 1));
  const ultimo = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 0));
  return { primero: diaUtcDe(primero.getTime()), ultimo: diaUtcDe(ultimo.getTime()) };
}

/** Todas las fechas civiles de un mes, en orden. */
export function diasDelMes(fechaIso: string): readonly string[] {
  const { primero, ultimo } = mesDe(fechaIso);
  const dias: string[] = [];
  const cursor = new Date(`${primero}T00:00:00Z`);
  const fin = Date.parse(`${ultimo}T00:00:00Z`);
  while (cursor.getTime() <= fin) {
    dias.push(diaUtcDe(cursor.getTime()));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dias;
}
