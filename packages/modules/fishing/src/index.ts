/**
 * Módulo `fishing` — actividad solunar sobre la página de puerto.
 *
 * Superficie pública del package: el módulo en sí (para el registry), la traducción de los periodos
 * a lo que se lee (`actividad.ts`) y los textos que sostienen su honestidad (`textos.ts`). El
 * cálculo vive en `domain-core/src/solunar/` y entra por el caso de uso `getSolunar`: aquí no se
 * predice nada.
 */

export type {
  AnclaDePeriodo,
  DesgloseDelRating,
  DiaCivil,
  EnfasisDeVentana,
  FactorDelRating,
  FilaDeActividad,
  FormatoDeActividad,
  PeriodoSolunar,
  RatingSolunar,
  TipoDePeriodo,
  VentanaDeActividad,
} from "./actividad.ts";
export {
  desgloseDelRating,
  filasDeActividad,
  franjaDePeriodo,
  idDePeriodo,
  nombreDeEtiqueta,
  ventanasDeActividad,
} from "./actividad.ts";

export {
  ATRIBUCIONES_FISHING,
  fishingModule,
  FISHING_MODULE_VERSION,
  ID_SECCION_ACTIVIDAD,
  ID_SECCION_OBSERVACIONES,
  SECCION_ACTIVIDAD,
  SECCION_ACTIVIDAD_SOLUNAR,
  SECCION_OBSERVACIONES,
  SECCION_OBSERVACIONES_DEL_DIA,
} from "./module.ts";

export {
  EntradasIlegiblesError,
  observacionesDelDia,
  REGLAS,
  REGLAS_DECLARADAS,
  ReglaSinMagnitudesError,
  reglaPorId,
  reglasImplementadas,
} from "./observaciones/index.ts";
export type {
  ContextoDelDia,
  ExtremoDelDia,
  FaseLunar,
  FormatoDeObservaciones,
  MagnitudCalculada,
  MuestraDeCurva,
  Observacion,
  PeriodoDelDia,
  Procedencia,
  ReglaDefinida,
  ReglaId,
  SolunarDelDia,
  Unidad,
} from "./observaciones/index.ts";

export {
  AVISO_SIN_RESPALDO,
  COMO_SE_LEEN_LOS_PERIODOS,
  ENLACE_METODOLOGIA,
  NOTA_DE_REDONDEO,
  QUE_ES_ESTO,
  QUE_SON_LAS_OBSERVACIONES,
  RATING_ES_CONVENCION,
  ROTULO_OBSERVACIONES,
  SIN_OBSERVACIONES,
  ROTULO_DEL_RATING,
  TITULO_ACTIVIDAD,
  URL_METODOLOGIA_SOLUNAR,
} from "./textos.ts";
