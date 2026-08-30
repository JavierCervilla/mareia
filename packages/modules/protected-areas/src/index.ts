/**
 * Módulo `protected-areas` — las áreas marinas protegidas (RAMPE 2025, MITECO) que un puerto tiene
 * a menos de 30 km, en la página de puerto.
 *
 * Publica la mitad defendible del encargo original —«zonas de pesca y zonas prohibidas»—: dónde
 * **no** se puede, que tiene fuente oficial y cuyo error cae del lado conservador. La otra mitad no
 * se hace, y la sección lo dice: **la ausencia de un área protegida cerca no es un permiso**.
 *
 * Superficie pública del package: el módulo para el registry (`module.ts`), la forma del dataset
 * que lee (`tipos.ts`), el criterio con el que se escribe una distancia (`vista.ts`) y los textos
 * que sostienen su honestidad (`textos.ts`).
 *
 * Lo que **no** hay aquí es lectura de ficheros: quién abre `data/geo/areas-protegidas.json` es la
 * superficie (`apps/web/src/modulos/areas-protegidas.ts`), igual que con `fishing` y con
 * `regulations`. El módulo no conoce el disco.
 */

export {
  ATRIBUCIONES_PROTECTED_AREAS,
  ID_SECCION_AREAS,
  OFFLINE_PROTECTED_AREAS,
  PROTECTED_AREAS_MODULE_VERSION,
  protectedAreasModule,
  SECCION_AREAS,
  SECCION_AREAS_PROTEGIDAS,
} from "./module.ts";

export {
  AVISO_SIN_RED,
  COLUMNA_AREA,
  COLUMNA_DISTANCIA,
  COLUMNA_FIGURA,
  COMO_SE_MIDE_LA_DISTANCIA,
  DENTRO_DEL_AREA,
  glosaDeTipo,
  kmDelRadio,
  ningunaCerca,
  QUE_ES_ESTO,
  QUE_SON_LAS_SIGLAS,
  ROTULO_CODIGO,
  ROTULO_FUENTES,
  tituloDeLaSeccion,
} from "./textos.ts";

export { distanciaEscrita, filasDeAreas, proximidadDeArea } from "./vista.ts";
export type { FilaDeArea, ProximidadEscrita } from "./vista.ts";

export type {
  AreaProtegida,
  AreasDelPuerto,
  AreasProtegidas,
  CensoDeLaFuente,
  CriterioDeAreas,
  FuenteDeAreas,
  ResumenDeAreas,
  TipoDeArea,
} from "./tipos.ts";
