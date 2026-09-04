/**
 * Los tipos que hacen **imposible** una observación sin procedencia — el gate **T1** de la spec
 * (§4.1 del design de especies y zonas), que es de compilación y no de test.
 *
 * La superficie de observaciones **no renderiza `string`**. Renderiza una `Observacion`, y una
 * `Observacion` sólo se puede construir con la `Procedencia` que dice de dónde sale su texto. Es la
 * misma técnica que ya impide un módulo sin `attributions`.
 *
 * **Sólo existe la rama `derivada`.** La spec declara también una rama `citada` (hábitat,
 * profundidad, talla máxima y ritmo de actividad, transcritos de FishBase), y **no se escribe aquí
 * a propósito**: FishBase necesita red y una decisión del humano sobre su licencia CC-BY-NC (Q2).
 * Un tipo con una rama que nadie construye es un camino sin ejercitar — la lección de T-29—, así que
 * la rama entra el día que entre su productor, con su test. Añadirla serán cuatro líneas.
 */

/**
 * La unión **cerrada** de reglas. Es el sujeto del censo **T2**: por cada miembro de este tipo se
 * exige un golden test, una entrada en `docs/recomendaciones.md` y al menos una magnitud real.
 *
 * Cerrarla es lo que hace que añadir una regla sin sus tres cosas ponga el censo en rojo. Si fuera
 * `string`, el censo no tendría sobre qué iterar.
 */
export type ReglaId =
  | "coincidencia-solunar-marea"
  | "periodo-en-luz"
  | "rango-del-dia"
  | "franja-de-nivel-bajo"
  | "iluminacion-lunar";

/** Las cinco, en orden de publicación. El censo compara contra esto, no contra lo que haya. */
export const REGLAS_DECLARADAS: readonly ReglaId[] = [
  "coincidencia-solunar-marea",
  "periodo-en-luz",
  "rango-del-dia",
  "franja-de-nivel-bajo",
  "iluminacion-lunar",
];

/** Unidad de una magnitud. `""` es adimensional (el coeficiente, un recuento). */
export type Unidad = "m" | "h" | "min" | "%" | "";

/**
 * Un número que **salió de un cálculo**, con su unidad y una clave estable.
 *
 * El censo T2 exige que cada regla aporte al menos una. Es lo que separa una observación derivada de
 * una frase con números escritos a mano: si no hay magnitud, no hay cálculo detrás.
 */
export interface MagnitudCalculada {
  /** Clave estable, en `snake_case`. Aparece en el censo publicado. */
  readonly clave: string;
  readonly valor: number;
  readonly unidad: Unidad;
}

/** De dónde sale el texto de una observación. Hoy sólo hay una forma: haberlo calculado. */
export interface Procedencia {
  readonly clase: "derivada";
  readonly reglaId: ReglaId;
  /** Las magnitudes del cálculo. **No vacío**: lo comprueba el censo. */
  readonly magnitudes: readonly MagnitudCalculada[];
  /**
   * Las entradas con las que se redactó, tal cual viajan al HTML.
   *
   * Es el tradeoff explícito de esta trayectoria: cuestan bytes en cada página de puerto, y a cambio
   * **T3 puede recomputar el texto** en vez de limitarse a comprobar que existe un atributo.
   */
  readonly entradas: unknown;
}

/**
 * Una frase publicable en la superficie de observaciones.
 *
 * La marca la hace **inconstruible fuera de este módulo**: sin ella, cualquier objeto con `texto` y
 * `procedencia` valdría como observación, y la promesa —«el texto lo produjo su regla»— dependería
 * de que nadie escriba un literal. Con ella, hacerlo exige un `as` que se ve en el diff.
 *
 * Lo que la marca **no** compra, dicho aquí para que nadie se fíe de más: no impide que la función
 * que la construye redacte mal. De eso responde **T3**, recomputando el texto desde el `dist/`.
 */
declare const MARCA_OBSERVACION: unique symbol;

export interface Observacion {
  /** Producido por la función pura de su regla. Nunca escrito. */
  readonly texto: string;
  readonly procedencia: Procedencia;
  readonly [MARCA_OBSERVACION]: true;
}

/** Lo que la superficie presta al módulo para escribir cifras con la coma decimal del sitio. */
export interface FormatoDeObservaciones {
  /** Un número con la coma decimal del sitio y los decimales que se le pidan. */
  readonly numero: (valor: number, decimales: number) => string;
  /** `HH:MM` en la zona horaria del puerto. */
  readonly hora: (timeUtcMs: number, timeZone: string) => string;
}
