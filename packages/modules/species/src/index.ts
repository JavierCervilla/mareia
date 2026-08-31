/**
 * Módulo `species` — el catálogo de las 86 especies que el BOE regula, con el nombre de la norma y
 * el taxón que la ciencia acepta hoy.
 *
 * Superficie pública del package: el módulo para el registry (`module.ts`), la forma del dataset que
 * lee (`tipos.ts`), el criterio con el que se escribe una fila (`vista.ts`), el de la ficha de una
 * especie con su retícula fija (`ficha.ts`, T-23) y los textos que sostienen su honestidad
 * (`textos.ts`).
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
  AQUI_NO_SE_PUNTUA_NADA,
  aphiaDelAceptado,
  cajaEscrita,
  CAMPOS_DE_LA_FICHA,
  COLUMNA_CALADEROS,
  COLUMNA_NOMBRE_BOE,
  COLUMNA_PRESENCIA,
  COLUMNA_TAXON,
  correspondenciaNuestra,
  creditoDeLaFoto,
  creditoSinAutor,
  DOMINIO_PUBLICO_SIN_CONDICIONES,
  EL_FILTRO_NO_RECORTA_LA_FILA,
  EL_GENERO_APLICA_A_TODO_EL_GENERO,
  enElCaladero,
  enlaceALaLicencia,
  enlaceAlCatalogo,
  espaciosEnElCaladero,
  fichaEnWorms,
  FILTRO_TODAS,
  fotoDeLaPrimeraEspecieDeLaFila,
  fotoDeUnaEspecieDelGenero,
  fotosConsultadasEn,
  FUERA_DEL_ANEXO_III,
  identificadaPor,
  LA_CAJA_NO_ES_LA_COSTA,
  LA_FOTO_NO_IDENTIFICA,
  LA_NORMA_NOMBRA_UNA_ESPECIE,
  LA_PRESENCIA_NO_ES_ABUNDANCIA,
  MISMO_NOMBRE,
  NO_SE_PREGUNTO_A_OBIS,
  notaDeLaTalla,
  noSePreguntoEsteNombre,
  POR_QUE_DOS_NOMBRES,
  POR_QUE_NO_ESTAN_EN_LA_TABLA,
  POR_QUE_UN_ENLACE,
  presenciaEscrita,
  QUE_ES_ESTA_FICHA,
  QUE_ES_ESTE_CATALOGO,
  RAMPE_NO_HABLA_DE_ESPECIES,
  RANGO_SIN_TAXON,
  rangoEscrito,
  remiteA,
  ROTULO_CAJAS,
  ROTULO_FILTRO,
  ROTULO_FUENTES,
  rotuloSinBinomio,
  SESGO_JUNTO_A_LA_CIFRA,
  SIN_DATASET_DE_FOTOS,
  SIN_NOMBRE_COMUN,
  SIN_RED_NO_ABRE,
  SIN_REGISTROS,
  tambienEnOtraFila,
  textoAlternativoDeLaFoto,
  tituloDeLaFicha,
  tituloDelCampo,
  tituloDeLaSeccion,
  tituloDelCatalogo,
  VER_EL_FICHERO_EN_COMMONS,
  volverAlCatalogo,
} from "./textos.ts";
export type { CampoDeLaFicha, IdDeCampo } from "./textos.ts";

export {
  esDominioPublico,
  fichasDeEspecies,
  LICENCIAS_SIN_CONDICIONES,
  PRESTAMO_LA_PRIMERA_DE_LA_FILA,
  PRESTAMO_UNA_DEL_GENERO,
  TIPOS_DE_PRESTAMO,
} from "./ficha.ts";
export type {
  DatosDeLaFicha,
  FotoPrestada,
  EspaciosDelCaladero,
  FichaDeEspecie,
  FotoDeCommons,
  FotoEscrita,
  FotosDeLaFicha,
  LicenciaEscrita,
  Rellenado,
} from "./ficha.ts";

export {
  anclaDeCaladero,
  CatalogoIncompleto,
  censoDelCatalogo,
  clavesDelMismoTaxon,
  filasDeEspecies,
  filasSinBinomio,
} from "./vista.ts";
export type {
  CaladeroDelCatalogo,
  CaladeroDeLaFila,
  CensoDelCatalogo,
  FilaDeEspecie,
  FilaSinBinomioEscrita,
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
  FilaDelBoeSinBinomio,
  FuenteDelCatalogo,
  FuentesDelCatalogo,
  NombreEnWorms,
  NotaDeLaTalla,
  OrigenDeLaCorrespondencia,
  PresenciaObis,
  RangoDelNombre,
  TallaDelAnexo,
  TaxonEnWorms,
} from "./tipos.ts";
