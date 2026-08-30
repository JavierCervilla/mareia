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
  AVISO_SIN_RED,
  COLUMNA_ESPECIE,
  COLUMNA_LITERAL,
  COLUMNA_TALLA,
  POR_QUE_LA_NOTA_VA_PEGADA,
  QUE_ES_ESTO,
  ROTULO_FUENTES,
  ROTULO_NOMBRE_LOCAL,
  ROTULO_NOTAS,
  ROTULO_PROCEDENCIA,
  SIN_TALLA_FIJADA,
  TALLA_ILEGIBLE,
  tituloDeLaSeccion,
} from "./textos.ts";

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
export { claveDeFila, filasDeTallas, textoDeTalla } from "./vista.ts";
