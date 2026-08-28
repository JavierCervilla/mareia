/**
 * Lo que la sección de actividad **dice**, en un solo sitio.
 *
 * Los textos viven aquí y no en la plantilla por dos razones que no son de estilo:
 *
 * 1. **Son requisito de producto, no adorno.** La teoría solunar no tiene respaldo experimental
 *    sólido y el rating es una convención: si la página publica el número sin decir eso, publica
 *    una promesa que no puede cumplir. Con los textos como constantes, un test comprueba que están
 *    en las 12 páginas construidas y el CI se entera si alguien los borra o los suaviza.
 * 2. **Se pueden auditar sin abrir Astro.** Son cadenas de un package sin dependencias de UI.
 *
 * Regla de escritura para quien los edite: **aquí no se promete pesca**. Se describe un cálculo.
 */

/**
 * Metodología del cálculo: el README del módulo `solunar/` del dominio, con la fórmula, sus
 * constantes y sus límites.
 *
 * Es un enlace **externo** (al repositorio) a propósito: el portal no tiene página de metodología
 * —el hallazgo A-3 del pase adversario de T-09 fue precisamente un enlace a `/metodologia/` que
 * daba 404— y prometer una que no existe sería repetir aquel fallo. El código es público: se
 * enlaza el código.
 */
export const URL_METODOLOGIA_SOLUNAR =
  "https://github.com/JavierCervilla/mareia/blob/main/packages/domain-core/src/solunar/README.md";

/** Título de la sección en la página de puerto. */
export const TITULO_ACTIVIDAD = "Actividad solunar";

/**
 * Qué es lo que se está publicando, antes de enseñar ningún número. Va **encima** del rating: el
 * orden de lectura es parte del mensaje.
 */
export const QUE_ES_ESTO =
  "La teoría solunar de John Alden Knight (1926) sitúa la actividad de los peces en cuatro " +
  "ventanas del día, ancladas a la Luna: dos mayores en sus tránsitos y dos menores en su salida " +
  "y su puesta. Esto es el cálculo de esas ventanas para este puerto y este día.";

/**
 * La frase que impide leer el rating como una medida. Se escribe con estas palabras exactas —«una
 * convención, no una medida»— porque es la diferencia entre publicar un método y aparentar un
 * instrumento.
 */
export const RATING_ES_CONVENCION =
  "El rating es una convención, no una medida: no existe un patrón oro de «cuánto pica hoy». Lo " +
  "que sí se puede publicar con honradez es la fórmula, sus umbrales y el desglose de por qué sale " +
  "este número.";

/**
 * El aviso que sostiene la honestidad de toda la sección, y el que vigila el CI en las 12 páginas.
 *
 * No cita estudios: decir «los estudios lo desmienten» exigiría haberlos leído y referenciado. Dice
 * lo que sí se sostiene — que es tradición, no resultado contrastado— y remite a la metodología
 * para que quien discrepe pueda discrepar del método y no de la aritmética.
 */
export const AVISO_SIN_RESPALDO =
  "La teoría solunar no tiene respaldo experimental sólido: es una convención tradicional, no un " +
  "resultado contrastado. Aquí se publica un cálculo reproducible de sus ventanas horarias, no una " +
  "predicción de capturas.";

/** Cómo se lee la tabla de periodos: qué es un mayor y qué es un menor, con sus duraciones. */
export const COMO_SE_LEEN_LOS_PERIODOS =
  "Cada periodo es una ventana centrada en un fenómeno lunar: 2 horas en los tránsitos (mayores) " +
  "y 1 hora y media en la salida y la puesta de la Luna (menores). Un día civil contiene entre 1 y " +
  "4: el día lunar dura 24 h 50 min, así que a veces un fenómeno se salta el día.";

/** Pie del desglose: por qué el total y el número publicado no siempre coinciden al decimal. */
export const NOTA_DE_REDONDEO =
  "El total se redondea al entero. 100 y 0 solo salen si la fórmula da exactamente eso: un 99,6 se " +
  "publica como 99, porque un «día perfecto» conseguido redondeando sería una mentira barata.";

/** Rótulo del enlace a la metodología. */
export const ENLACE_METODOLOGIA = "Fórmula, constantes y límites del cálculo";
