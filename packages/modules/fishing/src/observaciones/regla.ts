/**
 * La maquinaria de una regla, y las tres piezas que le exige el censo **T2**.
 *
 * Una regla es cuatro funciones puras y ninguna de ellas escribe prosa libre:
 *
 * | pieza | qué hace | por qué existe |
 * |---|---|---|
 * | `evaluar` | mira el día y devuelve sus entradas, o `null` | que **no dispare es información honrada**, no un fallo (spec §4.2) |
 * | `redactar` | entradas → texto | es lo único que produce la frase |
 * | `magnitudes` | entradas → números con unidad | el censo exige **al menos una** |
 * | `leerEntradas` | JSON crudo → entradas, o levanta | lo que hace **fiable** a T3 |
 *
 * **`leerEntradas` es la pieza que se olvida y sin la cual T3 miente.** T3 lee `data-entradas` del
 * `dist/`, que es JSON venido de fuera del tipo. Si `redactar` lo aceptase tal cual, un objeto con
 * los campos cambiados produciría *algún* texto y el gate compararía dos cosas igual de inventadas.
 * Con el lector, un `data-entradas` que no case con la forma de su regla **levanta**, y eso es rojo.
 */

import type {
  FormatoDeObservaciones,
  MagnitudCalculada,
  Observacion,
  Procedencia,
  ReglaId,
} from "./tipos.ts";

/** El día ya calculado, que es de donde salen todas las reglas. Nada de red, nada de estado. */
export interface ContextoDelDia {
  readonly zonaHoraria: string;
  /** Periodos solunares del día civil, con su rating y la Luna del mediodía. */
  readonly solunar: SolunarDelDia;
  /** Pleamares y bajamares del día, en orden. */
  readonly extremos: readonly ExtremoDelDia[];
  /** La curva ya calculada, muestreada. Es de donde sale la franja de nivel bajo. */
  readonly curva: readonly MuestraDeCurva[];
  /** Coeficiente del día (T-04), o `null` si el puerto no tiene marea semidiurna. */
  readonly coeficiente: number | null;
}

/**
 * Las formas que consume este módulo, declaradas **aquí** y no importadas de `domain-core`.
 *
 * No es duplicación por gusto: es la superficie mínima que las reglas necesitan. Importar
 * `SolunarDay` entero ataría el módulo a campos que no usa —`solarEvents`, el desglose del rating—
 * y cada cambio en ellos rompería estas reglas sin que nada aquí haya cambiado.
 */
/** Las ocho fases, con los nombres que usa `domain-core`. Cerrada para que el `switch` que las
 *  traduce no pueda tener un `default` que pinte una fase nueva como una cadena en inglés. */
export type FaseLunar =
  | "new"
  | "waxing-crescent"
  | "first-quarter"
  | "waxing-gibbous"
  | "full"
  | "waning-gibbous"
  | "last-quarter"
  | "waning-crescent";

export interface SolunarDelDia {
  readonly periodos: readonly PeriodoDelDia[];
  readonly fraccionIluminada: number;
  readonly edadLunarDias: number;
  readonly faseLunar: FaseLunar;
  /** Orto y ocaso del Sol del día, en epoch ms. `null` si el Sol no sale o no se pone. */
  readonly ortoSolarUtcMs: number | null;
  readonly ocasoSolarUtcMs: number | null;
}

export interface PeriodoDelDia {
  readonly clase: "mayor" | "menor";
  readonly picoUtcMs: number;
}

export interface ExtremoDelDia {
  readonly clase: "pleamar" | "bajamar";
  readonly instanteUtcMs: number;
  readonly altura_m: number;
}

export interface MuestraDeCurva {
  readonly instanteUtcMs: number;
  readonly altura_m: number;
}

/** Una regla, con sus entradas tipadas. `E` sólo lo conoce el fichero que la define. */
export interface Regla<E> {
  readonly id: ReglaId;
  readonly evaluar: (dia: ContextoDelDia) => E | null;
  readonly redactar: (entradas: E, formato: FormatoDeObservaciones) => string;
  readonly magnitudes: (entradas: E) => readonly MagnitudCalculada[];
  /** Valida y tipa un `data-entradas` venido del HTML. **Levanta** si no es de esta regla. */
  readonly leerEntradas: (crudo: unknown) => E;
}

/**
 * Una regla con su `E` ya cerrada, para poder tenerlas todas en una lista.
 *
 * Sin esto, un array de `Regla<E>` con cinco `E` distintas obliga a un `unknown` que se lleva por
 * delante la comprobación de tipos justo donde importa.
 */
export interface ReglaDefinida {
  readonly id: ReglaId;
  /** La observación del día, o `null` si la regla no dispara. */
  readonly observar: (
    dia: ContextoDelDia,
    formato: FormatoDeObservaciones,
  ) => Observacion | null;
  /** Recomputa el texto desde un `data-entradas` crudo. Es lo que ejecuta **T3**. */
  readonly recomputar: (crudo: unknown, formato: FormatoDeObservaciones) => string;
  /** Las magnitudes de un `data-entradas` crudo, para el censo y para auditar. */
  readonly magnitudesDe: (crudo: unknown) => readonly MagnitudCalculada[];
}

/** Cuando un `data-entradas` no tiene la forma de su regla. Es un fallo de T3, no un caso raro. */
export class EntradasIlegiblesError extends Error {
  constructor(reglaId: ReglaId, motivo: string) {
    super(`Las entradas de «${reglaId}» no se pueden leer: ${motivo}`);
    this.name = "EntradasIlegiblesError";
  }
}

/** Cuando una regla dispara sin aportar una sola magnitud. El censo lo prohíbe. */
export class ReglaSinMagnitudesError extends Error {
  constructor(reglaId: ReglaId) {
    super(
      `La regla «${reglaId}» disparó sin ninguna MagnitudCalculada: una observación derivada sin ` +
        "cálculo detrás es una frase escrita a mano con otro nombre",
    );
    this.name = "ReglaSinMagnitudesError";
  }
}

/**
 * Cierra una regla sobre su `E` y le pone el único camino por el que nace una `Observacion`.
 *
 * Aquí es donde se comprueba, **en tiempo de ejecución y no sólo en el censo**, que una regla que
 * dispara aporta magnitudes: el censo mira las reglas una a una con sus goldens, y esto mira lo que
 * de verdad se publica en cada página.
 */
export function definirRegla<E>(regla: Regla<E>): ReglaDefinida {
  const procedenciaDe = (entradas: E): Procedencia => {
    const magnitudes = regla.magnitudes(entradas);
    if (magnitudes.length === 0) throw new ReglaSinMagnitudesError(regla.id);
    return {
      clase: "derivada",
      reglaId: regla.id,
      magnitudes,
      entradas,
    };
  };

  return {
    id: regla.id,
    observar: (dia, formato) => {
      const entradas = regla.evaluar(dia);
      if (entradas === null) return null;
      return {
        texto: regla.redactar(entradas, formato),
        procedencia: procedenciaDe(entradas),
        // El único `as` del módulo, y por eso vive aquí solo: es la puerta por la que se construye
        // una Observacion. Fuera de esta función, la marca la hace inconstruible.
      } as Observacion;
    },
    recomputar: (crudo, formato) => regla.redactar(regla.leerEntradas(crudo), formato),
    magnitudesDe: (crudo) => regla.magnitudes(regla.leerEntradas(crudo)),
  };
}

/** Lector de campos con mensaje útil: el `data-entradas` que no case dice **qué** campo falló. */
export function leerCampo(
  crudo: unknown,
  reglaId: ReglaId,
  campo: string,
  tipo: "number" | "string",
): never | number | string {
  if (typeof crudo !== "object" || crudo === null) {
    throw new EntradasIlegiblesError(reglaId, "no es un objeto");
  }
  const valor = (crudo as Record<string, unknown>)[campo];
  if (typeof valor !== tipo) {
    throw new EntradasIlegiblesError(
      reglaId,
      `«${campo}» debería ser ${tipo} y es ${valor === undefined ? "inexistente" : typeof valor}`,
    );
  }
  if (tipo === "number" && !Number.isFinite(valor)) {
    throw new EntradasIlegiblesError(reglaId, `«${campo}» no es un número finito`);
  }
  return valor as number | string;
}

/** `leerCampo` para números, sin el estrechado en cada llamada. */
export function numeroDe(crudo: unknown, reglaId: ReglaId, campo: string): number {
  return leerCampo(crudo, reglaId, campo, "number") as number;
}

/** `leerCampo` para cadenas. */
export function textoDe(crudo: unknown, reglaId: ReglaId, campo: string): string {
  return leerCampo(crudo, reglaId, campo, "string") as string;
}
