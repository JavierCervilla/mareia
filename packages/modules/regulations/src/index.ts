/**
 * Módulo `regulations` — tallas mínimas de captura por caladero (RD 560/1995) en la página de
 * puerto.
 *
 * Superficie pública del package: el módulo para el registry (`module.ts`), la forma del dataset
 * que lee (`tipos.ts`), el criterio con el que se escribe una talla (`vista.ts`) y los textos que
 * sostienen su honestidad (`textos.ts`).
 *
 * Lo que **no** hay aquí es lectura de ficheros: quién abre `data/normativa/tallas-minimas.json` y
 * quién sabe qué caladero le toca a un puerto es la superficie (`apps/web/src/modulos/normativa.ts`),
 * igual que con `fishing`. El módulo no conoce el disco.
 */

export {
  ATRIBUCIONES_REGULATIONS,
  ID_SECCION_TALLAS,
  OFFLINE_REGULATIONS,
  regulationsModule,
  REGULATIONS_MODULE_VERSION,
  SECCION_TALLAS,
  SECCION_TALLAS_MINIMAS,
} from "./module.ts";

export {
  avisoDeVigencia,
  AVISO_SIN_RED,
  COLUMNA_ESPECIE,
  COLUMNA_LITERAL,
  COLUMNA_TALLA,
  POR_QUE_LA_NOTA_VA_PEGADA,
  QUE_ES_ESTO,
  ROTULO_FUENTES,
  ROTULO_NOMBRE_LOCAL,
  ROTULO_NOTAS,
  resolucionDeNota,
  ROTULO_PROCEDENCIA,
  rotuloDeVigencia,
  SIN_TALLA_FIJADA,
  TALLA_ILEGIBLE,
  tituloDeLaSeccion,
} from "./textos.ts";

// Qué excepciones se pueden resolver para el puerto de la página y cuáles no (ver `excepciones.ts`).
export { EXCEPCIONES_POR_COMUNIDAD, resolverNota } from "./excepciones.ts";
export type {
  ComunidadDelPuerto,
  ExcepcionPorComunidad,
  ResolucionDeNota,
} from "./excepciones.ts";

// El sello de vigencia y su degradación: los umbrales son del módulo, no de la página (ver
// `vigencia.ts`), igual que las ventanas de frescura de la meteo.
export {
  DIAS_SELLO_CORRIENTE,
  DIAS_SELLO_RANCIO,
  diasDesdeLaComprobacion,
  estadoDeVigencia,
} from "./vigencia.ts";
export type { EstadoDeVigencia } from "./vigencia.ts";

export type {
  Caladero,
  EspecieConTalla,
  FuenteNormativa,
  Normativa,
  NotaDeCaladero,
  Procedencia,
  Talla,
} from "./tipos.ts";

export type {
  FilaDeTalla,
  FormatoDeTallas,
  NombreSecundario,
  NotaVisible,
  TallaEscrita,
} from "./vista.ts";
export { claveDeFila, filasDeTallas, nombreSecundario, textoDeTalla } from "./vista.ts";
