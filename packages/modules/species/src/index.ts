/**
 * Módulo `species` — el catálogo de las 86 especies que el BOE regula, con el nombre de la norma y
 * el taxón que la ciencia acepta hoy.
 *
 * Superficie pública del package: el módulo para el registry (`module.ts`), la forma del dataset que
 * lee (`tipos.ts`), el criterio con el que se escribe una fila (`vista.ts`) y los textos que
 * sostienen su honestidad (`textos.ts`).
 *
 * Lo que **no** hay aquí es lectura de ficheros: quién abre `data/especies/catalogo.json` es la
 * superficie (`apps/web/src/modulos/especies.ts`), igual que con `regulations` y con
 * `protected-areas`. El módulo no conoce el disco.
 */

export {
  ATRIBUCIONES_SPECIES,
  ID_SECCION_ESPECIES,
  SECCION_CATALOGO_DE_ESPECIES,
  SECCION_ESPECIES,
  speciesModule,
  SPECIES_MODULE_VERSION,
} from "./module.ts";

export {
  aphiaDelAceptado,
  cajaEscrita,
  COLUMNA_CALADEROS,
  COLUMNA_NOMBRE_BOE,
  COLUMNA_PRESENCIA,
  COLUMNA_TAXON,
  correspondenciaNuestra,
  EL_FILTRO_NO_RECORTA_LA_FILA,
  EL_GENERO_APLICA_A_TODO_EL_GENERO,
  enlaceAlCatalogo,
  fichaEnWorms,
  FILTRO_TODAS,
  LA_CAJA_NO_ES_LA_COSTA,
  LA_PRESENCIA_NO_ES_ABUNDANCIA,
  MISMO_NOMBRE,
  POR_QUE_DOS_NOMBRES,
  POR_QUE_UN_ENLACE,
  presenciaEscrita,
  QUE_ES_ESTE_CATALOGO,
  rangoEscrito,
  remiteA,
  ROTULO_CAJAS,
  ROTULO_FILTRO,
  ROTULO_FUENTES,
  SESGO_JUNTO_A_LA_CIFRA,
  SIN_RED_NO_ABRE,
  SIN_REGISTROS,
  tituloDeLaSeccion,
  tituloDelCatalogo,
} from "./textos.ts";

export { anclaDeCaladero, CatalogoIncompleto, censoDelCatalogo, filasDeEspecies } from "./vista.ts";
export type {
  CaladeroDelCatalogo,
  CaladeroDeLaFila,
  CensoDelCatalogo,
  FilaDeEspecie,
  FormatoDelCatalogo,
  TallaDeLaFila,
  TaxonDeLaFila,
} from "./vista.ts";

export type {
  CajaDelCaladero,
  CatalogoDeEspecies,
  CriterioDelCatalogo,
  EspecieDelCatalogo,
  EspecieEnCaladero,
  FuenteDelCatalogo,
  FuentesDelCatalogo,
  NombreEnWorms,
  OrigenDeLaCorrespondencia,
  PresenciaObis,
  RangoDelNombre,
  TaxonEnWorms,
} from "./tipos.ts";
