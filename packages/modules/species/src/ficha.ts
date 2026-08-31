/**
 * La ficha de una especie: **la retícula fija**, con sus nueve campos y sus huecos rotulados.
 *
 * Todo el criterio de composición de `/pesca/especies/<clave>/`, sin Astro y sin `Intl`: funciones
 * puras que un `node --test` puede juzgar sin construir el sitio.
 *
 * **La regla que gobierna este fichero entero.** Un pokédex ayuda a la honradez porque tiene siempre
 * los mismos campos: un campo vacío es visible y dice «esto no lo sabemos». Un párrafo libre esconde
 * el hueco, porque no se ve lo que no se escribió. Por eso aquí:
 *
 * 1. **Las nueve filas se componen siempre**, también cuando no hay valor. Ningún camino de código
 *    devuelve `undefined` por un campo: devuelve `{ tipo: "hueco", motivo }`, y el motivo es
 *    obligatorio en el tipo. El gate F3 mide sobre el `dist/` que ninguna salga vacía.
 * 2. **Ninguna magnitud se inventa.** No hay puntuación, ni rareza, ni dificultad, ni un orden que
 *    sugiera «mejores especies»: cada campo o cita una fuente con su fecha o dice por qué no puede
 *    citarla. Lo mide el gate F4, sobre el artefacto y no sobre la intención.
 * 3. **La cifra legal se compone en un solo sitio del proyecto.** Las tallas, sus notas enteras y la
 *    presencia **no se vuelven a escribir aquí**: se piden a `filasDeEspecies`, que es lo que ya
 *    pinta el catálogo de T-20. La ficha es la **tercera** superficie de la misma cifra —la página
 *    de puerto, el catálogo y ésta— y en T-20 la segunda perdió la nota al pie porque la compuso
 *    por su cuenta. Dos caminos al mismo número se corrigen en uno y no en el otro. El precio es
 *    real y se acepta: leer una ficha recompone las 86 filas, que en un build son milisegundos.
 *
 * **Lo que esta ficha añade sobre la fila del catálogo son cuatro cosas y las cuatro vienen de
 * fuera**: el nombre local canario (`normativa/v1`, T-19), los espacios protegidos de sus caladeros
 * (`areas-protegidas/v1`, T-21), la foto con su licencia (`fotos/v1`, el carril de ingesta de T-23)
 * y el rótulo del rango cuando la norma nombra una especie —que en una tabla de 86 filas sería
 * ruido y en una retícula fija es la diferencia entre una fila que responde y un hueco mudo—.
 * Ninguna de las tres fuentes externas se lee aquí: el módulo no conoce el disco y las recibe ya
 * cruzadas por clave de especie (`DatosDeLaFicha`).
 */

import type { FormatoDeTallas } from "@mareia/module-regulations";

import {
  creditoDeLaFoto,
  enlaceALaLicencia,
  EL_GENERO_APLICA_A_TODO_EL_GENERO,
  DOMINIO_PUBLICO_SIN_CONDICIONES,
  espaciosEnElCaladero,
  FUERA_DEL_ANEXO_III,
  identificadaPor,
  LA_NORMA_NOMBRA_UNA_ESPECIE,
  RANGO_SIN_TAXON,
  rangoEscrito,
  SIN_DATASET_DE_FOTOS,
  SIN_NOMBRE_COMUN,
  textoAlternativoDeLaFoto,
  VER_EL_FICHERO_EN_COMMONS,
} from "./textos.ts";
import type { CatalogoDeEspecies, EspecieDelCatalogo } from "./tipos.ts";
import { CatalogoIncompleto, clavesDelMismoTaxon, filasDeEspecies } from "./vista.ts";
import type { CaladeroDeLaFila, FilaDeEspecie, TaxonDeLaFila } from "./vista.ts";

/**
 * Un campo de la retícula: **o trae dato, o trae el motivo de no traerlo**. Nunca ninguna de las dos
 * cosas es opcional.
 *
 * Es el tipo que hace imposible el hueco mudo: no existe la tercera forma —`null`, `undefined`, la
 * cadena vacía— en la que una ausencia se cuela sin explicarse. Es la misma doctrina que el
 * `NombreSecundario` de `regulations` y que el `sinResolver` del catálogo, generalizada, porque aquí
 * hay nueve campos y ocho pueden faltar.
 */
export type Rellenado<T> =
  | { readonly tipo: "dato"; readonly valor: T }
  | { readonly tipo: "hueco"; readonly motivo: string };

/** Envuelve un dato. */
function dato<T>(valor: T): Rellenado<T> {
  return { tipo: "dato", valor };
}

/** Envuelve una ausencia **con su motivo**, que es lo único que la hace publicable. */
function hueco<T>(motivo: string): Rellenado<T> {
  return { tipo: "hueco", motivo };
}

/**
 * Lo que el derivado de T-21 sabe de un caladero, contado por caladero y no por especie.
 *
 * **RAMPE no publica nada por especie** y este tipo es la forma de esa limitación: no hay ningún
 * campo del que se pueda leer que una especie esté protegida en un sitio. Son cuatro recuentos de
 * puertos y espacios, que es exactamente lo que el cruce de los dos datasets sostiene.
 */
export interface EspaciosDelCaladero {
  /** Nombre del caladero, para leer. */
  readonly nombre: string;
  /** Puertos de ese caladero que publica el portal. */
  readonly puertos: number;
  /** Cuántos de ellos tienen algún espacio protegido a menos del radio. */
  readonly conEspacio: number;
  /** Cuántos espacios distintos son, que no es lo mismo que cuántas relaciones hay. */
  readonly espacios: number;
  /** El radio con el que se miró, declarado por el propio derivado. */
  readonly radioKm: number;
}

/**
 * Los códigos de licencia que **no tienen condiciones de reutilización que enlazar**.
 *
 * Es el mismo allowlist cerrado que aplica la ingesta (`LICENCIAS_SIN_CONDICIONES` en
 * `sources/commons.py`), y está escrito aquí porque este módulo tiene que decidir **qué se pinta**
 * sin leer el disco. Hoy tiene un solo elemento: `pd`, el dominio público, donde la obra no está
 * sujeta a derechos y no hay texto de licencia al que mandar al lector. `cc0` **no** entra: es una
 * renuncia con texto y con URL, y la trae.
 */
export const LICENCIAS_SIN_CONDICIONES: ReadonlySet<string> = new Set(["pd"]);

/** Si una licencia no tiene condiciones que enlazar, dicho por su código legible por máquina. */
export function esDominioPublico(licenciaCodigo: string): boolean {
  return LICENCIAS_SIN_CONDICIONES.has(licenciaCodigo.trim().toLowerCase());
}

/**
 * Una foto de Commons con **todo lo que hace falta para poder publicarla**: su fichero, su autor, su
 * licencia y quién identificó el taxón.
 *
 * Es la forma del contrato `fotos/v1`. Los campos de crédito no son metadatos de adorno: una imagen
 * sin autor o sin licencia no se puede publicar, y una imagen cuya identificación no se atribuye
 * convierte en afirmación nuestra la decisión editorial de un tercero.
 *
 * **`licenciaUrl` es el único opcional, y lo es en los dos sentidos** (enmienda del 2026-08-30):
 * obligatoria cuando la licencia tiene condiciones, y **ausente** cuando no las tiene, porque el
 * dominio público no tiene condiciones que enlazar. `licenciaCodigo` es lo que permite distinguir
 * las dos cosas sin adivinarlo de la ausencia: sin él, «no hay condiciones» y «se perdió la URL»
 * son el mismo JSON.
 */
export interface FotoDeCommons {
  readonly fichero: string;
  readonly url: string;
  readonly descripcion: string;
  readonly autor: string;
  readonly licencia: string;
  readonly licenciaCodigo: string;
  readonly licenciaUrl?: string;
  readonly identificadaPor: {
    readonly fuente: string;
    readonly entidad: string;
    readonly propiedad: string;
  };
}

/**
 * Cómo se publica la licencia de una foto, que **son dos formas y no una**.
 *
 * Con condiciones, el crédito lleva al texto de la licencia, que es donde se leen. Sin ellas no hay
 * texto al que llevar, y un enlace vacío sería un crédito que no lleva a ninguna parte: se publica
 * el estado y queda el enlace a la página del fichero —obligatorio en toda foto— como evidencia de
 * quién lo declara. Que sean dos variantes de un tipo y no un `licenciaUrl` que a veces está vacío
 * es lo que impide pintar un `<a href="">`.
 */
export type LicenciaEscrita =
  /** La licencia tiene condiciones: el enlace va a su texto, rotulado con **cuál** es. */
  | { readonly tipo: "enlace"; readonly url: string; readonly rotulo: string }
  /** Dominio público: no hay condiciones que enlazar, y se dice en vez de callarlo. */
  | { readonly tipo: "sin_condiciones"; readonly estado: string };

/** La foto ya escrita: la imagen y **el crédito que viaja pegado a ella**, nunca en un pie global. */
export interface FotoEscrita {
  readonly url: string;
  /** Qué dice el `alt`: quién asocia la imagen al taxón, no que la imagen sea el taxón. */
  readonly alternativo: string;
  /** «Foto de X · CC BY-SA 4.0» — autor y licencia en la misma frase y en el mismo bloque. */
  readonly credito: string;
  /** La licencia, enlazada a su texto o dicha como estado. Nunca un crédito mudo. */
  readonly licencia: LicenciaEscrita;
  /** Enlace a la página del fichero, que es donde se comprueba el crédito sin fiarse de aquí. */
  readonly descripcionUrl: string;
  readonly rotuloDelFichero: string;
  /** Quién identificó el taxón de la foto, que no fuimos nosotros. */
  readonly identificacion: string;
}

/**
 * El estado del dataset de fotos, que **son tres y no dos**.
 *
 * Que el fichero no esté no es lo mismo que que una especie no tenga foto, y publicar lo segundo
 * cuando pasa lo primero sería afirmar sobre Wikidata algo que nadie ha comprobado. Es el mismo
 * reparto que `seLePreguntoAObis` hace con los dos silencios de la presencia.
 */
export type FotosDeLaFicha =
  /** El fichero todavía no existe en este build: ninguna ficha publica imagen, y lo dice. */
  | { readonly tipo: "sin_dataset" }
  /** El fichero está: cada clave trae su foto o **su motivo**, y no puede faltar ninguna. */
  | {
      readonly tipo: "ingerido";
      readonly consultadoEn: string;
      readonly porClave: ReadonlyMap<string, Rellenado<FotoDeCommons>>;
    };

/**
 * Lo que la superficie le presta al módulo: los tres cruces que la ficha necesita y que no salen del
 * catálogo de T-20.
 *
 * Llegan **ya cruzados por clave de especie** porque cruzarlos es leer ficheros, y el módulo no
 * conoce el disco (misma frontera que `cargarCatalogoDeEspecies`). Los mapas tienen que traer las 86
 * claves: una clave que falte es un hueco mudo, y `fichasDeEspecies` levanta antes que publicarlo.
 */
export interface DatosDeLaFicha {
  /** El nombre local canario de cada especie, o el motivo por el que no lo hay. Las 86 claves. */
  readonly nombreLocalCanario: ReadonlyMap<string, Rellenado<string>>;
  /** Los espacios protegidos de cada caladero, indexados por su identificador. */
  readonly espaciosPorCaladero: ReadonlyMap<string, EspaciosDelCaladero>;
  /** El estado del dataset de fotos. */
  readonly fotos: FotosDeLaFicha;
}

/**
 * Una ficha completa: **las nueve filas de la retícula**, en el orden de `CAMPOS_DE_LA_FICHA`.
 *
 * `nombreBoe` es el único campo que no es `Rellenado`, y no por comodidad: es el nombre con el que
 * la norma nombra a la especie —el que tiene consecuencia legal— y no hay ninguna ficha sin él. Que
 * el tipo no admita su ausencia es lo mismo que dice `EspecieDelCatalogo`.
 */
export interface FichaDeEspecie {
  /** La clave de T-20, que es el slug de la URL. Única y estable, y no colapsa dos grafías del BOE. */
  readonly clave: string;
  /** El nombre que escribe la norma, literal. **Obligatorio: no hay ficha sin él.** */
  readonly nombreBoe: string;
  readonly nombresComunes: Rellenado<readonly string[]>;
  readonly nombreLocalCanario: Rellenado<string>;
  readonly taxon: TaxonDeLaFila;
  /** A qué alcanza la talla. **Se rotula siempre**, también en las 68 filas que son una especie. */
  readonly rango: Rellenado<string>;
  /**
   * La glosa de qué significa que la norma regule un género entero, **sólo en las 17 filas que no
   * son una especie**; `null` en las otras 68.
   *
   * Va aparte del rango y no dentro porque es lo mismo que decide el catálogo con su rótulo: la
   * glosa explica un alcance que cambia lo que la norma dice, y pegada a las 68 filas donde el
   * alcance es el corriente sería un párrafo sobre géneros debajo de una fila que no habla de
   * ningún género — ruido que además le resta fuerza a las 17 donde importa.
   */
  readonly notaDelRango: string | null;
  /** Los caladeros que la regulan, con sus tallas (y sus notas enteras) y su presencia. Nunca vacío. */
  readonly caladeros: readonly CaladeroDeLaFila[];
  /** Que el mismo taxón está en otra ficha, con la otra grafía del BOE; `null` en las 80 sin hermana. */
  readonly tambienEn: string | null;
  /** Las claves de las fichas hermanas, para poder enlazarlas. Vacío en las 80 sin hermana. */
  readonly clavesHermanas: readonly string[];
  /** Una frase por caladero: cuántos de sus puertos tienen espacios protegidos cerca. Nunca vacío. */
  readonly espacios: readonly string[];
  readonly foto: Rellenado<FotoEscrita>;
}

/**
 * Las 86 fichas, **en el mismo orden y con el mismo criterio que las filas del catálogo**.
 *
 * Se construyen todas de una vez porque el `getStaticPaths` de la página las pide todas de una vez,
 * y porque así la ficha y la fila del índice salen literalmente de la misma llamada: no existe la
 * posibilidad de que una publique una nota al pie y la otra no.
 *
 * **Levanta** —y no publica— cuando falta un cruce: una clave sin entrada en el mapa del nombre
 * local canario, un caladero sin entrada en el de espacios protegidos, o una clave que el dataset de
 * fotos no menciona ni en `fotos` ni en `sinFoto`. Los tres casos son la misma avería: un hueco del
 * que no se sabe el motivo, que publicado no se distingue de un fallo nuestro.
 */
export function fichasDeEspecies(
  catalogo: CatalogoDeEspecies,
  datos: DatosDeLaFicha,
  formato: FormatoDeTallas,
): readonly FichaDeEspecie[] {
  const porClave = new Map(catalogo.especies.map((especie) => [especie.clave, especie] as const));
  const hermanas = clavesDelMismoTaxon(catalogo);
  return filasDeEspecies(catalogo, formato).map((fila) => {
    const especie = porClave.get(fila.clave);
    if (especie === undefined) {
      // Imposible por construcción —la fila sale de este mismo catálogo—, pero el `throw` es la
      // diferencia entre romper el build y publicar una ficha a medias si algún día deja de serlo.
      throw new CatalogoIncompleto(fila.nombreBoe, "su fila no sale de ninguna especie del catálogo");
    }
    return fichaDeEspecie(fila, especie, datos, hermanas.get(fila.clave) ?? []);
  });
}

function fichaDeEspecie(
  fila: FilaDeEspecie,
  especie: EspecieDelCatalogo,
  datos: DatosDeLaFicha,
  clavesHermanas: readonly string[],
): FichaDeEspecie {
  return {
    clave: fila.clave,
    nombreBoe: fila.nombreBoe,
    nombresComunes:
      fila.nombresComunes.length === 0 ? hueco(SIN_NOMBRE_COMUN) : dato(fila.nombresComunes),
    nombreLocalCanario: nombreLocalDe(fila, datos),
    taxon: fila.taxon,
    rango: rangoDeLaFicha(especie),
    notaDelRango: alcanceGlosado(especie) ? EL_GENERO_APLICA_A_TODO_EL_GENERO : null,
    caladeros: fila.caladeros,
    tambienEn: fila.tambienEn,
    // Las hermanas llegan ya resueltas a clave para poder enlazarlas: el aviso ya nombra la otra
    // grafía del BOE, y sin el enlace quien lo lee tiene que volver al catálogo y buscarla a mano.
    clavesHermanas,
    espacios: espaciosDeLaFicha(fila, datos),
    foto: fotoDeLaFicha(fila, datos),
  };
}

/**
 * El nombre local canario, o el motivo de que no lo haya.
 *
 * El cruce lo hace la superficie contra `normativa/v1`; aquí sólo se comprueba que trajo respuesta
 * para esta especie. Que falte la entrada no es «no tiene nombre local»: es que nadie ha mirado, y
 * eso no se publica.
 */
function nombreLocalDe(fila: FilaDeEspecie, datos: DatosDeLaFicha): Rellenado<string> {
  const encontrado = datos.nombreLocalCanario.get(fila.clave);
  if (encontrado === undefined) {
    throw new CatalogoIncompleto(
      fila.nombreBoe,
      "no se ha resuelto su nombre local canario ni el motivo por el que no lo tiene. Un campo de " +
        "la retícula sin respuesta se publicaría en blanco, y un hueco en blanco no se distingue " +
        `de un fallo nuestro (el motivo por defecto es «${FUERA_DEL_ANEXO_III.slice(0, 40)}…»).`,
    );
  }
  return encontrado;
}

/**
 * A qué alcanza la talla, **rotulado también cuando la norma nombra una especie**.
 *
 * Es la única divergencia deliberada con la fila del catálogo, y sale de la diferencia entre una
 * tabla y una retícula: en la tabla, `rangoEscrito` devuelve `null` para las 68 especies porque un
 * «especie» repetido 68 veces sería ruido que le restaría fuerza a las 17 filas donde el alcance
 * cambia lo que la norma dice. En una ficha de campos fijos, ese `null` sería una fila en blanco —el
 * defecto que la retícula existe para impedir—, así que se dice el hecho: la talla se aplica a esa
 * especie y a ninguna otra.
 *
 * Sin registro de WoRMS no hay rango, y el hueco lo dice: el rango es lo que la fuente dice del
 * nombre, no una deducción nuestra a partir de cómo está escrito.
 */
function rangoDeLaFicha(especie: EspecieDelCatalogo): Rellenado<string> {
  if (especie.worms === null) return hueco(RANGO_SIN_TAXON);
  return dato(rangoEscrito(especie.worms.rango) ?? LA_NORMA_NOMBRA_UNA_ESPECIE);
}

/** Si el alcance de esta fila es de los que hay que glosar: todo lo que no es una especie. */
function alcanceGlosado(especie: EspecieDelCatalogo): boolean {
  return especie.worms !== null && rangoEscrito(especie.worms.rango) !== null;
}

/**
 * Una frase por caladero: **cuántos de sus puertos tienen espacios protegidos cerca**.
 *
 * No es una afirmación sobre la especie y la fila lo dice antes de esta lista
 * (`RAMPE_NO_HABLA_DE_ESPECIES`): la fuente publica espacios, no especies, así que el único vínculo
 * que se puede sostener es el caladero donde la talla de esta especie se aplica.
 *
 * **Levanta** si un caladero del catálogo no está en el derivado de áreas: significaría que los dos
 * datasets hablan de caladeros distintos, y publicar una fila muda sobre eso es peor que romper.
 */
function espaciosDeLaFicha(fila: FilaDeEspecie, datos: DatosDeLaFicha): readonly string[] {
  return fila.caladeros.map((caladero) => {
    const espacios = datos.espaciosPorCaladero.get(caladero.id);
    if (espacios === undefined) {
      throw new CatalogoIncompleto(
        fila.nombreBoe,
        `el caladero ${JSON.stringify(caladero.id)} no está en el derivado de espacios protegidos. ` +
          "O los dos datasets hablan de caladeros distintos o el derivado se ha quedado corto; en " +
          "los dos casos la fila se publicaría en blanco.",
      );
    }
    return espaciosEnElCaladero(
      espacios.nombre,
      espacios.puertos,
      espacios.conEspacio,
      espacios.espacios,
      espacios.radioKm,
    );
  });
}

/**
 * La foto con **su** licencia y **su** autor, o el motivo de que no haya foto.
 *
 * Los tres estados posibles, y ninguno se puede confundir con otro: el dataset no está en el build
 * (ninguna ficha publica imagen), el dataset está y esta especie no tiene foto (con el motivo que
 * escribió la ingesta), y el dataset está y la tiene. Una clave que el dataset no mencione en
 * ninguno de sus dos mapas **levanta**: es el hueco mudo que `sinFoto` existe para impedir.
 */
/**
 * La licencia de una foto, escrita por la rama que le toca. **La manda el código de licencia**, no
 * la ausencia de la URL: adivinar la excepción de un campo que falta es exactamente lo que
 * `licenciaCodigo` vino a evitar.
 *
 * Y la tercera combinación —una licencia con condiciones a la que le falta su URL— **levanta**. No
 * se degrada a «dominio público», que sería publicar sobre esa imagen una afirmación jurídica que
 * nadie ha hecho, ni a un enlace vacío. Es la misma doctrina que el hueco mudo: si el dataset se
 * contradice con su propio contrato, la ficha no elige por él.
 */
function licenciaDeLaFoto(fila: FilaDeEspecie, foto: FotoDeCommons): LicenciaEscrita {
  if (esDominioPublico(foto.licenciaCodigo)) {
    return { tipo: "sin_condiciones", estado: DOMINIO_PUBLICO_SIN_CONDICIONES };
  }
  if (foto.licenciaUrl === undefined) {
    throw new CatalogoIncompleto(
      fila.nombreBoe,
      `su foto declara la licencia ${JSON.stringify(foto.licenciaCodigo)}, que tiene condiciones, ` +
        "y no dice dónde están. Publicarla sin eso sería reutilizar una imagen ajena sin decir " +
        "bajo qué permiso, y llamarla «dominio público» sería afirmarlo por nuestra cuenta.",
    );
  }
  return { tipo: "enlace", url: foto.licenciaUrl, rotulo: enlaceALaLicencia(foto.licencia) };
}

function fotoDeLaFicha(fila: FilaDeEspecie, datos: DatosDeLaFicha): Rellenado<FotoEscrita> {
  const { fotos } = datos;
  if (fotos.tipo === "sin_dataset") return hueco(SIN_DATASET_DE_FOTOS);
  const encontrada = fotos.porClave.get(fila.clave);
  if (encontrada === undefined) {
    throw new CatalogoIncompleto(
      fila.nombreBoe,
      "el dataset de fotos no la nombra ni en «fotos» ni en «sinFoto». Una especie ausente del " +
        "mapa es un hueco mudo, y el hueco tiene que llevar motivo.",
    );
  }
  if (encontrada.tipo === "hueco") return encontrada;
  const foto = encontrada.valor;
  return dato({
    url: foto.url,
    alternativo: textoAlternativoDeLaFoto(fila.nombreBoe, foto.identificadaPor.fuente),
    // Autor y licencia van en la MISMA frase y en el mismo bloque que la imagen, nunca en un pie
    // global de la página: en la muestra de 12 ficheros del plan hay seis licencias distintas, así
    // que un pie único sería falso para cinco de ellas. El gate F2 lo mide ahí.
    credito: creditoDeLaFoto(foto.autor, foto.licencia),
    licencia: licenciaDeLaFoto(fila, foto),
    descripcionUrl: foto.descripcion,
    rotuloDelFichero: VER_EL_FICHERO_EN_COMMONS,
    identificacion: identificadaPor(
      foto.identificadaPor.fuente,
      foto.identificadaPor.entidad,
      foto.identificadaPor.propiedad,
    ),
  });
}
