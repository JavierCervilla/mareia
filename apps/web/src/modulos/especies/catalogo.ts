/**
 * El adaptador entre el módulo `species` y esta web: quién abre el catálogo de especies y quién
 * sabe qué caladero le toca al puerto de la página.
 *
 * Es la misma costura que `normativa.ts` para las tallas y `areas-protegidas.ts` para las áreas, y
 * con la misma regla: **la sección pide su dato por slug**, no lo recibe inyectado.
 * `ContextoDeSeccion` lleva a propósito solo slug/nombre/fecha/zona —lo mínimo con lo que un módulo
 * puede hablar del sitio— y la plantilla de la página no carga el dato de ningún módulo concreto.
 *
 * **El caladero del puerto no se vuelve a resolver aquí**: se le pide a `normativa.ts`, que es quien
 * ya sabe leerlo de `data/geo/ports.json` y quien decide con él qué tabla de tallas se publica. Un
 * segundo camino al mismo dato es un camino que puede discrepar, y discrepar aquí significa que la
 * página de un puerto publica la tabla de un caladero y, tres párrafos más abajo, un enlace al
 * catálogo filtrado por **otro**. Cuesta cargar el dataset de la normativa en las páginas de puerto,
 * y no cuesta nada: la sección de tallas ya lo ha cargado y la caché es por proceso.
 *
 * Aquí no se resuelve ninguna taxonomía ni se consulta ninguna API: quien preguntó a WoRMS y a OBIS
 * fue el pipeline. Este fichero lee hechos ya derivados y **levanta nombrando el campo** cuando no
 * cuadran: una fila que se publica a medias es una fila que dice algo que no sabemos.
 *
 * **Y es literalmente un adaptador**: el dataset publicado y lo que el módulo consume no tienen la
 * misma forma, y no la tienen a propósito. `especies/v1` lleva bastante más de lo que se pinta —la
 * cita que WoRMS pide por cada registro, la autoridad de cada nombre, el WKT del recorte, la
 * procedencia por cifra que fija T-19— porque es un dato publicable por sí mismo; `tipos.ts` es lo
 * mínimo con lo que se escribe una fila sin mentir. La traducción entre los dos vive aquí, y tiene
 * **una regla**:
 *
 * > **Se renombran campos; no se reescriben valores.**
 *
 * `taxon` se lee como `worms` porque cómo se llame el campo es cosa nuestra. En cambio el origen de
 * una correspondencia llega como `"mareia"` y se publica como `"mareia"`, sin traducirlo a un
 * «nuestro» más cómodo: es una **firma de procedencia**, y un adaptador que reescribe firmas acaba
 * publicando una que no estampó nadie. La única conversión que sí cambia un valor está acotada y
 * dicha donde ocurre: **cero registros de OBIS no es una cifra**, es la ausencia que `SIN_REGISTROS`
 * explica (ver `leerPresencia`).
 */

import { readFile } from "node:fs/promises";

import type {
  CajaDelCaladero,
  CatalogoDeEspecies,
  CriterioDelCatalogo,
  EspecieDelCatalogo,
  EspecieEnCaladero,
  FormatoDelCatalogo,
  FuenteDelCatalogo,
  FuentesDelCatalogo,
  NombreEnWorms,
  OrigenDeLaCorrespondencia,
  PresenciaObis,
  RangoDelNombre,
  TallaDelAnexo,
  TaxonEnWorms,
} from "@mareia/module-species";
import type { Talla } from "@mareia/module-regulations";

import { anclaDeCaladero } from "@mareia/module-species";

import { DATA_DIR } from "../../datos/deps.ts";
import { numero } from "../../formato.ts";
import { RUTA_ESPECIES } from "../../rutas.ts";
import type { ContextoDeSeccion } from "../contexto.ts";
import { cargarTablaDeTallas } from "../normativa.ts";

/** Versión de schema que este código sabe leer. Otra cosa no se interpreta: se rechaza. */
const SCHEMA = "especies/v1";

const FICHERO_CATALOGO = `${DATA_DIR}/especies/catalogo.json`;

/**
 * Los rangos que la norma nombra, **medidos sobre el dataset**: 68 especies, 15 géneros, la familia
 * `Palinuridae` y la subespecie `Trisopterus minutus capelanus`. Fuera de aquí, no se publica.
 */
const RANGOS: readonly RangoDelNombre[] = ["especie", "genero", "familia", "subespecie"];

/** Cómo se pudo llegar a un registro de WoRMS. Un tercer origen sería un origen sin dueño. */
const ORIGENES: readonly OrigenDeLaCorrespondencia[] = ["worms", "mareia"];

/** El dataset no tiene la forma esperada. El mensaje señala fichero y campo. */
class CatalogoMalFormado extends Error {
  constructor(detalle: string) {
    super(`Dataset con formato inesperado en ${FICHERO_CATALOGO}: ${detalle}`);
    this.name = "CatalogoMalFormado";
  }
}

// =================================================================================================
// Lectura defensiva
// =================================================================================================
//
// El fichero de `data/` es nuestro y CI lo valida contra su schema, pero al cruzar la frontera del
// proceso vuelve a ser `unknown`. Estos ayudantes convierten esa incertidumbre en un error con el
// campo que falló, en vez de en un `any` que se propaga hasta publicar «NaN registros».

function objeto(valor: unknown, ruta: string): Record<string, unknown> {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    throw new CatalogoMalFormado(`${ruta} debería ser un objeto`);
  }
  return valor as Record<string, unknown>;
}

function lista(fuente: Record<string, unknown>, clave: string, ruta: string): readonly unknown[] {
  const valor = fuente[clave];
  if (!Array.isArray(valor)) throw new CatalogoMalFormado(`${ruta}.${clave} debería ser un array`);
  return valor;
}

function texto(fuente: Record<string, unknown>, clave: string, ruta: string): string {
  const valor = fuente[clave];
  if (typeof valor !== "string" || valor.length === 0) {
    throw new CatalogoMalFormado(`${ruta}.${clave} debería ser una cadena no vacía`);
  }
  return valor;
}

/** Un texto que puede faltar **legítimamente**, y cuya ausencia es un dato (nunca una cadena vacía). */
function textoONulo(fuente: Record<string, unknown>, clave: string, ruta: string): string | null {
  const valor = fuente[clave];
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== "string" || valor.length === 0) {
    throw new CatalogoMalFormado(`${ruta}.${clave} debería ser una cadena no vacía o null`);
  }
  return valor;
}

function magnitud(fuente: Record<string, unknown>, clave: string, ruta: string): number {
  const valor = fuente[clave];
  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    throw new CatalogoMalFormado(`${ruta}.${clave} debería ser un número finito`);
  }
  return valor;
}

/** Un año, que puede faltar: OBIS no siempre publica el rango. `0` no es un año. */
function anioONulo(fuente: Record<string, unknown>, clave: string, ruta: string): number | null {
  const valor = fuente[clave];
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== "number" || !Number.isInteger(valor) || valor < 1500) {
    throw new CatalogoMalFormado(`${ruta}.${clave} debería ser un año o null`);
  }
  return valor;
}

/**
 * Una cuenta de OBIS que ya se sabe que hay que publicar. **Entera y mayor que cero**, y las dos
 * condiciones son del dominio: medio registro no existe, y un cero no llega hasta aquí porque
 * `leerPresencia` lo ha convertido antes en la ausencia que es. Si llegara —un `0` conjuntos de
 * datos junto a 12 registros, por ejemplo— sería una cifra que se contradice a sí misma.
 */
function cuenta(fuente: Record<string, unknown>, clave: string, ruta: string): number {
  const valor = magnitud(fuente, clave, ruta);
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new CatalogoMalFormado(
      `${ruta}.${clave} es ${valor} y debería ser un entero mayor que cero: una presencia que se ` +
        `publica es una presencia con registros y con conjuntos de datos de los que salen.`,
    );
  }
  return valor;
}

function unaDe<T extends string>(valor: string, permitidos: readonly T[], ruta: string): T {
  const encontrado = permitidos.find((candidato) => candidato === valor);
  if (encontrado === undefined) {
    throw new CatalogoMalFormado(
      `${ruta} es ${JSON.stringify(valor)} y solo puede ser ${permitidos.join(" o ")}`,
    );
  }
  return encontrado;
}

// =================================================================================================
// El dataset, campo a campo
// =================================================================================================

/**
 * La talla, validada contra la **misma unión cerrada de cinco clases** que `normativa/v1`.
 *
 * Es una segunda frontera para el mismo tipo y no sobra: este fichero es otro derivado, escrito por
 * otra ingesta, y un `{"tipo":"longitud_cm","cm":"treinta"}` aquí publicaría «NaN cm» en el catálogo
 * aunque la tabla de tallas de las 153 páginas de puerto estuviera perfecta.
 */
function leerTalla(valor: unknown, ruta: string): Talla {
  const crudo = objeto(valor, ruta);
  const tipo = texto(crudo, "tipo", ruta);
  switch (tipo) {
    case "longitud_cm":
      return { tipo, cm: magnitud(crudo, "cm", ruta) };
    case "peso_kg":
      return { tipo, kg: magnitud(crudo, "kg", ruta) };
    case "longitud_o_peso":
      return { tipo, cm: magnitud(crudo, "cm", ruta), kg: magnitud(crudo, "kg", ruta) };
    case "por_determinar":
      return { tipo, segunNota: texto(crudo, "segunNota", ruta) };
    case "sin_dato_legible":
      return { tipo, motivo: texto(crudo, "motivo", ruta) };
    default:
      throw new CatalogoMalFormado(
        `${ruta}.tipo es ${JSON.stringify(tipo)}, que no es ninguna de las cinco clases de talla`,
      );
  }
}

/**
 * Lo que OBIS registra, o **la ausencia que es un cero**.
 *
 * Aquí está la única conversión del adaptador que cambia un valor y no un nombre, y está acotada a
 * propósito: el dataset publica los recuentos tal y como los devolvió OBIS —con su recorte y su
 * frase de sesgo dentro del mismo objeto—, **incluidos los ceros**, que son 9 de los 115 pares
 * especie-caladero (`Maja squinado` en el Cantábrico, `Clupea harengus`…). Un cero no es una cifra
 * que publicar: publicado como número se lee como «aquí no hay esa especie», que es exactamente lo
 * que OBIS no puede afirmar. Así que se devuelve `null`, y el módulo escribe la frase que sí dice
 * lo que sabemos: que nadie lo ha anotado ahí (`SIN_REGISTROS`).
 *
 * No se pierde nada por el camino: los dos silencios siguen siendo distinguibles, porque el de «no
 * se preguntó» viaja aparte en `presenciaAusente`.
 */
function leerPresencia(valor: unknown, ruta: string): PresenciaObis | null {
  if (valor === null || valor === undefined) return null;
  const crudo = objeto(valor, ruta);
  if (magnitud(crudo, "registros", ruta) === 0) return null;
  return {
    registros: cuenta(crudo, "registros", ruta),
    datasets: cuenta(crudo, "datasets", ruta),
    desde: anioONulo(crudo, "desdeAnio", ruta),
    hasta: anioONulo(crudo, "hastaAnio", ruta),
  };
}

/** Una de las tallas que un anexo le fija a la especie: la cifra, qué mide y el literal del BOE. */
function leerTallaDelAnexo(valor: unknown, ruta: string): TallaDelAnexo {
  const crudo = objeto(valor, ruta);
  return {
    medida: textoONulo(crudo, "medida", ruta),
    talla: leerTalla(crudo["talla"], `${ruta}.talla`),
    textoOriginal: texto(crudo, "textoOriginal", ruta),
  };
}

/**
 * Una especie en un caladero: sus tallas y su presencia.
 *
 * **Sin tallas no hay entrada**, y no es una comprobación de forma: el catálogo son exactamente las
 * especies a las que la norma les fija una talla, así que un caladero que aparece sin ninguna es un
 * caladero que se ha metido en la fila sin regularla.
 */
function leerCaladeroDeEspecie(valor: unknown, ruta: string): EspecieEnCaladero {
  const crudo = objeto(valor, ruta);
  const tallas = lista(crudo, "tallas", ruta).map((talla, i) =>
    leerTallaDelAnexo(talla, `${ruta}.tallas[${i}]`),
  );
  if (tallas.length === 0) {
    throw new CatalogoMalFormado(
      `${ruta}.tallas está vacío: un caladero está en la fila porque le fija una talla a esa ` +
        `especie, así que sin ninguna no tiene por qué estar`,
    );
  }
  return {
    id: texto(crudo, "id", ruta),
    nombre: texto(crudo, "nombre", ruta),
    nombreComun: texto(crudo, "nombreComun", ruta),
    tallas,
    presencia: leerPresencia(crudo["presencia"], `${ruta}.presencia`),
    presenciaAusente: textoONulo(crudo, "presenciaAusente", ruta),
  };
}

function leerNombreEnWorms(valor: unknown, ruta: string): NombreEnWorms {
  const crudo = objeto(valor, ruta);
  return { aphiaId: magnitud(crudo, "aphiaId", ruta), nombre: texto(crudo, "nombre", ruta) };
}

/**
 * El taxón, cuando resuelve; `null` cuando no. Es `$.especies[i].taxon` leído en dos campos.
 *
 * El dataset lo cuenta con un discriminante (`resuelto`) y el módulo con un nulo más su motivo. Son
 * dos formas de decir lo mismo y ninguna es mejor: lo que no vale es que aquí se mezclen, así que
 * este par de funciones es toda la traducción y **fuera de ellas no hay nadie que mire `resuelto`**.
 *
 * `aceptado` sí se interpreta, y se dice por qué: el dataset publica el nombre aceptado **siempre**
 * que WoRMS lo dé, también en las 74 filas en que es el mismo nombre de la norma. Lo que la página
 * escribe sale de si hay un nombre **distinto** que añadir, así que aquí se deja en `null` cuando
 * coincide. Repetir el binomio en esas 74 filas perdería las 11 que de verdad difieren.
 */
function leerTaxon(valor: unknown, correspondencia: Correspondencia, ruta: string): TaxonEnWorms | null {
  const crudo = objeto(valor, ruta);
  const resuelto = crudo["resuelto"];
  if (typeof resuelto !== "boolean") {
    throw new CatalogoMalFormado(`${ruta}.resuelto debería ser true o false`);
  }
  if (!resuelto) return null;
  const nombre = texto(crudo, "nombreCientifico", ruta);
  const aceptado = crudo["aceptado"];
  const nombreAceptado =
    aceptado === null || aceptado === undefined
      ? null
      : leerNombreEnWorms(aceptado, `${ruta}.aceptado`);
  return {
    aphiaId: magnitud(crudo, "aphiaId", ruta),
    nombre,
    // El estado se lee tal cual y no se valida contra ninguna lista: es una cita del vocabulario de
    // WoRMS y cerrarlo aquí rompería el build el día que la fuente use uno nuevo (ver `tipos.ts`).
    estado: texto(crudo, "estado", ruta),
    rango: unaDe(texto(crudo, "rango", ruta), RANGOS, `${ruta}.rango`),
    url: texto(crudo, "url", ruta),
    aceptado: nombreAceptado?.nombre === nombre ? null : nombreAceptado,
    origen: correspondencia.origen,
    comoSeLlego: correspondencia.motivo,
  };
}

/** De quién es la decisión de preguntarle a WoRMS ese nombre, y por qué. */
interface Correspondencia {
  readonly origen: OrigenDeLaCorrespondencia;
  readonly motivo: string | null;
}

/**
 * La correspondencia, que vive **fuera** del taxón en el dataset y **dentro** en el contrato.
 *
 * Está separada allí porque hay una fila a la que se decidió no preguntarle nada —`Lophius
 * piscatorius, L. Budegassa`, dos especies en una celda— y esa decisión también tiene dueño y
 * motivo aunque no haya taxón del que colgarlos. Aquí se junta con el taxón porque es donde la
 * página la lee: al lado del nombre al que llevó.
 *
 * El `origen` **no se traduce**: lo que el dataset firma como `mareia` se publica como `mareia`.
 */
function leerCorrespondencia(valor: unknown, ruta: string): Correspondencia {
  const crudo = objeto(valor, ruta);
  return {
    origen: unaDe(texto(crudo, "origen", ruta), ORIGENES, `${ruta}.origen`),
    motivo: textoONulo(crudo, "motivo", ruta),
  };
}

/**
 * Una especie del catálogo.
 *
 * Las dos comprobaciones de coherencia que hay aquí son las que impiden publicar una fila que
 * afirma algo que no sabemos, y **fallan el build en vez de degradar**: una especie que no resuelve
 * y no dice por qué (un hueco mudo no se distingue de un fallo nuestro) y una que dice que no
 * resuelve trayendo a la vez el registro que lo desmiente —un `AphiaID` colgando de un taxón que se
 * declara sin resolver—. La tercera —correspondencia nuestra sin motivo— la hace el módulo, en
 * `filasDeEspecies`, porque es criterio de publicación y no de forma.
 */
function leerEspecie(valor: unknown, indice: number): EspecieDelCatalogo {
  const ruta = `$.especies[${indice}]`;
  const crudo = objeto(valor, ruta);
  const nombreBoe = texto(crudo, "nombreBoe", ruta);
  const taxon = objeto(crudo["taxon"], `${ruta}.taxon`);
  const worms = leerTaxon(
    taxon,
    leerCorrespondencia(crudo["correspondencia"], `${ruta}.correspondencia`),
    `${ruta}.taxon`,
  );
  const sinResolver = worms === null ? textoONulo(taxon, "motivo", `${ruta}.taxon`) : null;
  if (worms === null && sinResolver === null) {
    throw new CatalogoMalFormado(
      `${ruta} (${nombreBoe}) no trae taxón de WoRMS y tampoco el motivo. Una ausencia sin motivo ` +
        `se publica como un hueco del catálogo y no como lo que es.`,
    );
  }
  if (worms === null && taxon["aphiaId"] !== undefined) {
    throw new CatalogoMalFormado(
      `${ruta} (${nombreBoe}) dice no resolver y trae el AphiaID ${String(taxon["aphiaId"])}, que ` +
        `es el registro que lo desmiente`,
    );
  }
  const caladeros = lista(crudo, "caladeros", ruta).map((caladero, i) =>
    leerCaladeroDeEspecie(caladero, `${ruta}.caladeros[${i}]`),
  );
  if (caladeros.length === 0) {
    throw new CatalogoMalFormado(
      `${ruta} (${nombreBoe}) no la regula ningún caladero, y el catálogo son exactamente las ` +
        `especies a las que la norma les fija una talla`,
    );
  }
  return { nombreBoe, clave: texto(crudo, "clave", ruta), worms, sinResolver, caladeros };
}

function leerFuente(valor: unknown, ruta: string): FuenteDelCatalogo {
  const crudo = objeto(valor, ruta);
  return {
    nombre: texto(crudo, "nombre", ruta),
    url: texto(crudo, "url", ruta),
    licencia: texto(crudo, "licencia", ruta),
    consultadoEn: texto(crudo, "consultadoEn", ruta),
  };
}

function leerFuentes(valor: unknown): FuentesDelCatalogo {
  const crudo = objeto(valor, "$.fuentes");
  return {
    worms: leerFuente(crudo["worms"], "$.fuentes.worms"),
    obis: leerFuente(crudo["obis"], "$.fuentes.obis"),
  };
}

function leerCaja(valor: unknown, caladero: string, ruta: string): CajaDelCaladero {
  const crudo = objeto(valor, ruta);
  return {
    caladero,
    nombre: texto(crudo, "nombre", ruta),
    latMin: magnitud(crudo, "latMin", ruta),
    latMax: magnitud(crudo, "latMax", ruta),
    lonMin: magnitud(crudo, "lonMin", ruta),
    lonMax: magnitud(crudo, "lonMax", ruta),
  };
}

/**
 * Con qué se consultó OBIS, y **sin eso no hay catálogo**.
 *
 * Es la única parte del recorte que se exige, porque es la que hace interpretable cada cifra de
 * presencia: «12 registros en Galicia» no significa nada si no se sabe qué rectángulo es Galicia. Si
 * el dataset dejara de traerla, la página seguiría pintando números perfectamente legibles y
 * perfectamente huecos.
 *
 * El dataset la publica como `recortes`, **un objeto indexado por caladero** y con más cosas dentro
 * de las que aquí se leen (el WKT con el que se consultó, la advertencia de qué mar sobra en cada
 * rectángulo). Se aplana a una lista con el caladero metido en cada caja, que es como la pinta la
 * página; el caladero viaja dentro y no como agrupación porque **hay caladeros con varios
 * rectángulos** —el del Cantábrico, noroeste y golfo de Cádiz tiene tres— y una lista de pares no
 * obliga a la plantilla a saber eso.
 */
function leerCriterio(valor: unknown): CriterioDelCatalogo {
  const recortes = objeto(valor, "$.recortes");
  const cajas = Object.entries(recortes).flatMap(([caladero, recorte]) => {
    const ruta = `$.recortes.${caladero}`;
    const propias = lista(objeto(recorte, ruta), "cajas", ruta);
    if (propias.length === 0) {
      throw new CatalogoMalFormado(
        `${ruta}.cajas está vacío: el caladero ${caladero} publica cifras de presencia y ningún ` +
          `rectángulo con el que se hayan sacado`,
      );
    }
    return propias.map((caja, i) => leerCaja(caja, caladero, `${ruta}.cajas[${i}]`));
  });
  if (cajas.length === 0) {
    throw new CatalogoMalFormado(
      `$.recortes está vacío: sin el rectángulo con el que se consultó OBIS, ninguna cifra de ` +
        `presencia se puede interpretar ni repetir`,
    );
  }
  return { cajas };
}

/** El dataset entero, validado. */
export function leerCatalogo(crudo: unknown): CatalogoDeEspecies {
  const documento = objeto(crudo, "$");
  const schema = texto(documento, "schema", "$");
  if (schema !== SCHEMA) {
    throw new CatalogoMalFormado(
      `$.schema debería ser ${JSON.stringify(SCHEMA)} y es ${JSON.stringify(schema)}`,
    );
  }
  const especies = lista(documento, "especies", "$").map(leerEspecie);
  if (especies.length === 0) {
    throw new CatalogoMalFormado("$.especies está vacío: un catálogo sin especies no es un catálogo");
  }
  // Dos especies con la misma `clave` son dos filas indistinguibles: comparten el `data-especie`,
  // así que el gate E1 encuentra siempre la primera y la segunda podría publicarse a medias —o no
  // publicarse— sin que nada se pusiera rojo. No es hipotético: el BOE escribe **`Thunnus thynnus`**
  // en los anexos I y II y **`Thunnus Thynnus`** en el III, dos nombres distintos que cualquier
  // slug en minúsculas colapsa en uno. Lo cazó este gate al construir por primera vez.
  const repetidas = especies
    .map((especie) => especie.clave)
    .filter((clave, indice, todas) => todas.indexOf(clave) !== indice);
  if (repetidas.length > 0) {
    throw new CatalogoMalFormado(
      `$.especies repite la clave ${[...new Set(repetidas)].map((c) => JSON.stringify(c)).join(", ")}. ` +
        `Dos especies con la misma clave son dos filas que la página no puede distinguir.`,
    );
  }
  return {
    schema,
    fuentes: leerFuentes(documento["fuentes"]),
    criterio: leerCriterio(documento["recortes"]),
    especies,
  };
}

// =================================================================================================
// Carga, una vez por proceso
// =================================================================================================

/**
 * Se cachea la **promesa** y no el resultado, igual que en `normativa.ts`: el build genera 153
 * páginas de puerto y todas piden el catálogo casi a la vez. Un fallo no se cachea.
 */
function unaVez<T>(cargar: () => Promise<T>): () => Promise<T> {
  let enCurso: Promise<T> | undefined;
  return () => {
    if (enCurso === undefined) {
      enCurso = cargar().catch((causa: unknown) => {
        enCurso = undefined;
        throw causa;
      });
    }
    return enCurso;
  };
}

/** El catálogo de especies, leído del derivado commiteado. */
export const cargarCatalogoDeEspecies = unaVez(async (): Promise<CatalogoDeEspecies> => {
  const contenido = await readFile(FICHERO_CATALOGO, "utf8");
  let crudo: unknown;
  try {
    crudo = JSON.parse(contenido);
  } catch (causa) {
    throw new CatalogoMalFormado(
      `no es JSON válido (${causa instanceof Error ? causa.message : "error desconocido"})`,
    );
  }
  return leerCatalogo(crudo);
});

// =================================================================================================
// Lo que consume la sección de la página de puerto
// =================================================================================================

/** El caladero de este puerto, visto desde el catálogo: cómo se llama y cuántas especies regula. */
export interface CatalogoDelPuerto {
  readonly id: string;
  readonly nombre: string;
  readonly especies: number;
}

/**
 * El caladero del puerto de la página y cuántas especies del catálogo regula, pedido **por slug**.
 *
 * Levanta si el catálogo no conoce el caladero que el puerto declara: es el mismo caso que una
 * página de puerto sin tabla de tallas, y la alternativa —enlazar al catálogo sin filtro— publicaría
 * en esa página un enlace que dice «las N especies de tu caladero» y lleva a las 86.
 */
export async function cargarCatalogoDelPuerto(
  contexto: ContextoDeSeccion,
): Promise<CatalogoDelPuerto> {
  const [catalogo, tabla] = await Promise.all([
    cargarCatalogoDeEspecies(),
    cargarTablaDeTallas(contexto),
  ]);
  const especies = catalogo.especies.filter((especie) =>
    especie.caladeros.some((caladero) => caladero.id === tabla.caladero.id),
  ).length;
  if (especies === 0) {
    throw new Error(
      `El puerto ${contexto.slug} declara el caladero ${JSON.stringify(tabla.caladero.id)} y el ` +
        `catálogo de especies no publica ninguna especie suya. O el catálogo se ha quedado corto o ` +
        `los dos derivados hablan de caladeros distintos; en los dos casos, el enlace de esta ` +
        `sección llevaría a una lista vacía.`,
    );
  }
  return { id: tabla.caladero.id, nombre: tabla.caladero.nombre, especies };
}

/**
 * La URL del catálogo **ya filtrado por un caladero**, que es lo que enlaza la sección del puerto.
 *
 * Vive aquí y no en `rutas.ts` porque la mitad de la URL es del módulo: el ancla la nombra
 * `anclaDeCaladero`, y `rutas.ts` es de la web —lo importan el sitemap y las migas— y no tiene por
 * qué saber cómo filtra el catálogo de especies. La otra mitad, la ruta, sí es del portal y viene de
 * `RUTA_ESPECIES`.
 *
 * El filtro viaja en el **fragmento** y no en una query porque el sitio es estático: `?caladero=x`
 * exigiría o una página por caladero o JavaScript, y el fragmento lo resuelve el navegador con
 * `:target` y cero bytes. Ver la cabecera de `estilos/especies.css`.
 */
export function rutaDelCatalogoFiltrado(idDelCaladero: string): string {
  return `${RUTA_ESPECIES}#${anclaDeCaladero(idDelCaladero)}`;
}

/** El formato numérico del sitio, prestado al módulo (coma decimal, como el resto de la página). */
export const FORMATO_DEL_CATALOGO: FormatoDelCatalogo = { numero };
