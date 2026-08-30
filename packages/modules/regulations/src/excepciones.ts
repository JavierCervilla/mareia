/**
 * Qué excepciones de la norma **se pueden resolver** para el puerto en el que está quien lee, y
 * cuáles no.
 *
 * T-19 decidió que la nota viaja pegada a la cifra y no se resuelve por puerto, con este motivo:
 * resolverla exige saber en qué división del CIEM cae cada dársena —geometría, que este portal no
 * hace— y asignarla mal daría un número seguro y equivocado. Ese motivo es verdad para dos de las
 * tres notas que cambian la cifra en puertos de este catálogo (la lubina y el boquerón, que hablan
 * de divisiones del CIEM). **Para la tercera no**, y el pase adversario lo midió (hallazgo H-5): la
 * nota del pulpo del Anexo II excepciona a la **Comunidad Autónoma de las Illes Balears**, que es
 * un criterio **administrativo**, y la comunidad de cada puerto ya está en `data/geo/ports.json`,
 * se usa para construir la URL en la que el lector está y es con lo que el pipeline decide qué
 * anexo le toca. La única excepción resoluble con lo que ya hay en el repo era justamente la que se
 * dejaba sin resolver, dando por motivo el de otra.
 *
 * Las dos reglas que dan forma a este fichero:
 *
 * 1. **Resolver es AÑADIR, nunca quitar.** La nota entera se sigue publicando pegada a la cifra en
 *    los 80 puertos del caladero, y encima se dice si aplica aquí. Si la regla se equivocara, lo
 *    que queda a la vista sigue siendo la excepción literal del BOE: el fallo posible es un
 *    renglón de más, no una cifra desnuda.
 * 2. **Una regla describe a una nota concreta, no a un topónimo.** Se exige que el texto de la nota
 *    traiga *todos* los fragmentos declarados —el efecto y el sujeto—, así que una nota futura que
 *    mencione Illes Balears para decir otra cosa (por ejemplo, fijar allí una talla distinta) **no
 *    la resuelve nadie**: cae en `sin_resolver` y se publica entera, como hoy.
 */

/** La comunidad autónoma del puerto que publica la página, tal y como la trae el catálogo. */
export interface ComunidadDelPuerto {
  /** Slug en `data/geo/ports.json` (`illes-balears`). */
  readonly slug: string;
  /** Nombre para leer («Illes Balears»). */
  readonly nombre: string;
}

/** Una excepción que se resuelve con un dato administrativo que el portal ya tiene. */
export interface ExcepcionPorComunidad {
  /** Comunidad a la que la nota se refiere, por su slug en el catálogo. */
  readonly comunidad: string;
  /** Cómo se nombra esa comunidad al escribirlo. Sale de la norma, no del catálogo. */
  readonly nombre: string;
  /**
   * Todo lo que el texto de la nota tiene que decir para que esta regla la describa: el **efecto**
   * y el **sujeto**. Con un solo fragmento, una nota distinta sobre el mismo sitio se resolvería
   * mal, que es peor que no resolverla.
   */
  readonly exigeEnTexto: readonly string[];
}

/**
 * Las excepciones administrativas que este portal sabe resolver. **Una, hoy.**
 *
 * No es una lista corta por pereza: las otras dos notas hablan de divisiones del CIEM (8.a/8.b para
 * la lubina, IX a) para el boquerón) y eso es geometría marina que este portal no calcula.
 * Publicarlas resueltas exigiría asignar una división a cada dársena, y una división mal asignada da
 * un número seguro y falso, que es peor que una excepción visible.
 *
 * Y hay una prueba viva de que ese miedo está bien puesto: el plan de T-19 afirmaba que las 8.a/8.b
 * eran «los puertos cantábricos de este portal» y **es falso** —8.a/8.b son el Vizcaya norte y
 * central, la vertiente francesa; la costa española es la 8.c—. Si aquella glosa se hubiera llevado
 * a código en vez de quedarse en la prosa, estas 47 páginas publicarían 44 cm donde la norma dice
 * 36. La regla de no resolver lo que no se sabe evitó un error que ya estaba escrito.
 */
export const EXCEPCIONES_POR_COMUNIDAD: readonly ExcepcionPorComunidad[] = [
  {
    comunidad: "illes-balears",
    nombre: "Illes Balears",
    // Literal de la nota `(*)` del Anexo II: «La talla del pulpo (Octopus vulgaris) recogida en la
    // presente tabla no es de aplicación en las aguas interiores y la plataforma continental de la
    // Comunidad Autónoma de las Illes Balears.»
    exigeEnTexto: ["no es de aplicación", "Illes Balears"],
  },
];

/**
 * Qué se puede decirle a quien lee sobre si una nota le afecta.
 *
 * Unión cerrada, como `Talla` y como `EstadoDeVigencia`: quien la pinte escribe las tres ramas.
 */
export type ResolucionDeNota =
  /** La excepción es de esta comunidad: aquí la cifra de la tabla no rige. */
  | { readonly tipo: "no_aplica_aqui"; readonly comunidad: string }
  /** La excepción es de otra comunidad: aquí la cifra de la tabla rige tal cual. */
  | { readonly tipo: "aplica_aqui"; readonly comunidad: string }
  /** No se puede resolver con lo que el portal sabe. La nota va entera y la resuelve quien lee. */
  | { readonly tipo: "sin_resolver" };

/**
 * Resuelve una nota para el puerto de esta página, o dice que no puede.
 *
 * Devuelve `sin_resolver` siempre que no haya **exactamente una** regla que describa la nota: cero
 * es el caso normal (las notas del CIEM) y dos sería una ambigüedad que nadie ha decidido, y ante
 * la duda se publica la nota entera, que es lo que se venía haciendo con las tres.
 */
export function resolverNota(texto: string, comunidad: ComunidadDelPuerto): ResolucionDeNota {
  const reglas = EXCEPCIONES_POR_COMUNIDAD.filter((regla) =>
    regla.exigeEnTexto.every((fragmento) => texto.includes(fragmento)),
  );
  if (reglas.length !== 1) return { tipo: "sin_resolver" };
  const [regla] = reglas as [ExcepcionPorComunidad];
  return regla.comunidad === comunidad.slug
    ? { tipo: "no_aplica_aqui", comunidad: regla.nombre }
    : { tipo: "aplica_aqui", comunidad: regla.nombre };
}
