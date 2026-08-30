/**
 * El adaptador entre el módulo `regulations` y esta web: quién abre el dataset y quién sabe qué
 * caladero le toca a cada puerto.
 *
 * Es la misma costura que `actividad-solunar.ts` para pesca, y con la misma regla: **la sección
 * pide su dato por slug**, no lo recibe inyectado. `ContextoDeSeccion` lleva a propósito solo
 * slug/nombre/fecha/zona —lo mínimo con lo que un módulo puede hablar del sitio— y la plantilla de
 * la página no carga el dato de ningún módulo concreto. Si la página tuviera que resolver el
 * caladero para pasárselo hecho, quedaría atada a lo que hoy necesita este módulo, y el siguiente
 * necesitará otra cosa.
 *
 * **Por qué se lee `ports.json` aquí y no se arrastra `caladero` por el dominio**: `Port`
 * (`domain-core`) no tiene ese campo y el adaptador oficial lo descarta al leer. Añadírselo
 * obligaría a tocar la entidad, su repositorio y los casos de uso para que el dominio supiera qué
 * es un caladero de pesca — exactamente lo que el contrato de módulos existe para evitar. El precio
 * es que dos sitios conocen la forma de `ports.json` y que el fichero se lee dos veces en el build;
 * se paga una vez por proceso, cacheada, y a cambio el dominio sigue ciego a los módulos.
 *
 * Todo lo que no cuadra **levanta nombrando el campo o el puerto**. Un puerto al que se le publica
 * la tabla de otro mar se lee igual de bien que la correcta, y esta sección publica cifras con
 * consecuencia legal: degradar en silencio aquí sería publicar mal en 153 páginas.
 */

import { readFile } from "node:fs/promises";

import type {
  Caladero,
  ComunidadDelPuerto,
  EspecieConTalla,
  FormatoDeTallas,
  FuenteNormativa,
  Normativa,
  NotaDeCaladero,
  Procedencia,
  Talla,
} from "@mareia/module-regulations";

import { DATA_DIR } from "../datos/deps.ts";
import { numero } from "../formato.ts";
import type { ContextoDeSeccion } from "./contexto.ts";

/** Versión de schema que este código sabe leer. Otra cosa no se interpreta: se rechaza. */
const SCHEMA = "normativa/v1";

const FICHERO_NORMATIVA = `${DATA_DIR}/normativa/tallas-minimas.json`;
const FICHERO_PUERTOS = `${DATA_DIR}/geo/ports.json`;

/** El dataset no tiene la forma esperada. El mensaje señala fichero y campo. */
class NormativaMalFormada extends Error {
  constructor(fichero: string, detalle: string) {
    super(`Dataset con formato inesperado en ${fichero}: ${detalle}`);
    this.name = "NormativaMalFormada";
  }
}

// =================================================================================================
// Lectura defensiva
// =================================================================================================
//
// Los ficheros de `data/` son nuestros y CI los valida contra su schema, pero al cruzar la frontera
// del proceso vuelven a ser `unknown`. Estos ayudantes convierten esa incertidumbre en un error con
// el campo que falló, en vez de en un `any` que se propaga hasta pintar «NaN cm» en una tabla legal.

function objeto(fichero: string, valor: unknown, ruta: string): Record<string, unknown> {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    throw new NormativaMalFormada(fichero, `${ruta} debería ser un objeto`);
  }
  return valor as Record<string, unknown>;
}

function lista(fichero: string, fuente: Record<string, unknown>, clave: string, ruta: string): readonly unknown[] {
  const valor = fuente[clave];
  if (!Array.isArray(valor)) {
    throw new NormativaMalFormada(fichero, `${ruta}.${clave} debería ser un array`);
  }
  return valor;
}

function texto(fichero: string, fuente: Record<string, unknown>, clave: string, ruta: string): string {
  const valor = fuente[clave];
  if (typeof valor !== "string" || valor.length === 0) {
    throw new NormativaMalFormada(fichero, `${ruta}.${clave} debería ser una cadena no vacía`);
  }
  return valor;
}

function textoOpcional(fuente: Record<string, unknown>, clave: string): string | undefined {
  const valor = fuente[clave];
  return typeof valor === "string" && valor.length > 0 ? valor : undefined;
}

function magnitud(fichero: string, fuente: Record<string, unknown>, clave: string, ruta: string): number {
  const valor = fuente[clave];
  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    throw new NormativaMalFormada(fichero, `${ruta}.${clave} debería ser un número finito`);
  }
  return valor;
}

/**
 * La talla, validada contra la unión cerrada de cinco clases.
 *
 * Sin este portero, un `{"tipo":"longitud_cm","cm":"treinta"}` llegaría hasta la plantilla y se
 * publicaría como `NaN cm` en las 47 páginas del caladero. Una clase que no esté en la unión se
 * rechaza aquí y no se pinta «como se pueda».
 */
function leerTalla(fichero: string, valor: unknown, ruta: string): Talla {
  const crudo = objeto(fichero, valor, ruta);
  const tipo = texto(fichero, crudo, "tipo", ruta);
  switch (tipo) {
    case "longitud_cm":
      return { tipo, cm: magnitud(fichero, crudo, "cm", ruta) };
    case "peso_kg":
      return { tipo, kg: magnitud(fichero, crudo, "kg", ruta) };
    case "longitud_o_peso":
      return { tipo, cm: magnitud(fichero, crudo, "cm", ruta), kg: magnitud(fichero, crudo, "kg", ruta) };
    case "por_determinar":
      return { tipo, segunNota: texto(fichero, crudo, "segunNota", ruta) };
    case "sin_dato_legible":
      return { tipo, motivo: texto(fichero, crudo, "motivo", ruta) };
    default:
      throw new NormativaMalFormada(
        fichero,
        `${ruta}.tipo es ${JSON.stringify(tipo)}, que no es ninguna de las cinco clases de talla`,
      );
  }
}

function leerProcedencia(fichero: string, valor: unknown, ruta: string): Procedencia {
  const crudo = objeto(fichero, valor, ruta);
  return {
    bloque: texto(fichero, crudo, "bloque", ruta),
    fechaVigencia: texto(fichero, crudo, "fechaVigencia", ruta),
    eli: texto(fichero, crudo, "eli", ruta),
  };
}

function leerEspecie(fichero: string, valor: unknown, ruta: string): EspecieConTalla {
  const crudo = objeto(fichero, valor, ruta);
  // Los cinco campos opcionales se copian **solo si están**: con `exactOptionalPropertyTypes` un
  // `undefined` explícito no es lo mismo que la ausencia, y aquí la ausencia es un dato (el módulo
  // distingue «la norma no da el binomio» de «no se leyó»).
  const nombreCientifico = textoOpcional(crudo, "nombreCientifico");
  const nombreCientificoAusente = textoOpcional(crudo, "nombreCientificoAusente");
  const nombreLocalCanario = textoOpcional(crudo, "nombreLocalCanario");
  const nombreLocalCanarioAusente = textoOpcional(crudo, "nombreLocalCanarioAusente");
  const medida = textoOpcional(crudo, "medida");
  return {
    nombreComun: texto(fichero, crudo, "nombreComun", ruta),
    ...(nombreCientifico === undefined ? {} : { nombreCientifico }),
    ...(nombreCientificoAusente === undefined ? {} : { nombreCientificoAusente }),
    ...(nombreLocalCanario === undefined ? {} : { nombreLocalCanario }),
    ...(nombreLocalCanarioAusente === undefined ? {} : { nombreLocalCanarioAusente }),
    ...(medida === undefined ? {} : { medida }),
    talla: leerTalla(fichero, crudo["talla"], `${ruta}.talla`),
    textoOriginal: texto(fichero, crudo, "textoOriginal", ruta),
    notas: lista(fichero, crudo, "notas", ruta).map((marca, indice) => {
      if (typeof marca !== "string" || marca.length === 0) {
        throw new NormativaMalFormada(fichero, `${ruta}.notas[${indice}] debería ser una marca`);
      }
      return marca;
    }),
    procedencia: leerProcedencia(fichero, crudo["procedencia"], `${ruta}.procedencia`),
  };
}

function leerNota(fichero: string, valor: unknown, ruta: string): NotaDeCaladero {
  const crudo = objeto(fichero, valor, ruta);
  return { marca: texto(fichero, crudo, "marca", ruta), texto: texto(fichero, crudo, "texto", ruta) };
}

function leerCaladero(fichero: string, valor: unknown, indice: number): Caladero {
  const ruta = `$.caladeros[${indice}]`;
  const crudo = objeto(fichero, valor, ruta);
  return {
    id: texto(fichero, crudo, "id", ruta),
    nombre: texto(fichero, crudo, "nombre", ruta),
    titulo: texto(fichero, crudo, "titulo", ruta),
    anexo: texto(fichero, crudo, "anexo", ruta),
    bloque: texto(fichero, crudo, "bloque", ruta),
    fechaVigencia: texto(fichero, crudo, "fechaVigencia", ruta),
    fechaActualizacionBloque: texto(fichero, crudo, "fechaActualizacionBloque", ruta),
    normaModificadora: texto(fichero, crudo, "normaModificadora", ruta),
    notas: lista(fichero, crudo, "notas", ruta).map((nota, i) =>
      leerNota(fichero, nota, `${ruta}.notas[${i}]`),
    ),
    especies: lista(fichero, crudo, "especies", ruta).map((especie, i) =>
      leerEspecie(fichero, especie, `${ruta}.especies[${i}]`),
    ),
  };
}

function leerFuente(fichero: string, valor: unknown): FuenteNormativa {
  const ruta = "$.fuente";
  const crudo = objeto(fichero, valor, ruta);
  return {
    norma: texto(fichero, crudo, "norma", ruta),
    identificador: texto(fichero, crudo, "identificador", ruta),
    eli: texto(fichero, crudo, "eli", ruta),
    textoConsolidado: texto(fichero, crudo, "textoConsolidado", ruta),
    fechaActualizacion: texto(fichero, crudo, "fechaActualizacion", ruta),
    licencia: texto(fichero, crudo, "licencia", ruta),
    licenciaUrl: texto(fichero, crudo, "licenciaUrl", ruta),
    aviso: texto(fichero, crudo, "aviso", ruta),
    // El sello de G2. Si faltara, la sección no podría decir cuándo se comprobó la vigencia y se
    // leería como si fuese de hoy: se prefiere romper el build.
    verificadoEn: texto(fichero, crudo, "verificadoEn", ruta),
  };
}

/** El dataset entero, validado. */
function leerNormativa(fichero: string, crudo: unknown): Normativa {
  const documento = objeto(fichero, crudo, "$");
  const schema = texto(fichero, documento, "schema", "$");
  if (schema !== SCHEMA) {
    throw new NormativaMalFormada(
      fichero,
      `$.schema debería ser ${JSON.stringify(SCHEMA)} y es ${JSON.stringify(schema)}`,
    );
  }
  return {
    schema,
    fuente: leerFuente(fichero, documento["fuente"]),
    caladeros: lista(fichero, documento, "caladeros", "$").map((caladero, indice) =>
      leerCaladero(fichero, caladero, indice),
    ),
  };
}

// =================================================================================================
// Carga, una vez por proceso
// =================================================================================================

/**
 * Se cachea la **promesa** y no el resultado: el build genera 153 páginas y cada una pide su tabla
 * casi a la vez, así que dos llamadas concurrentes comparten el mismo trabajo en vez de releer el
 * fichero. Un fallo no se cachea: si el disco falló una vez, la siguiente vuelve a intentarlo.
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

const cargarNormativa = unaVez(async (): Promise<Normativa> => {
  const contenido = await readFile(FICHERO_NORMATIVA, "utf8");
  let crudo: unknown;
  try {
    crudo = JSON.parse(contenido);
  } catch (causa) {
    throw new NormativaMalFormada(
      FICHERO_NORMATIVA,
      `no es JSON válido (${causa instanceof Error ? causa.message : "error desconocido"})`,
    );
  }
  return leerNormativa(FICHERO_NORMATIVA, crudo);
});

/** Lo que el catálogo dice de un puerto y esta sección necesita: qué tabla le toca y dónde está. */
interface EncajeDelPuerto {
  readonly caladero: string;
  readonly comunidad: ComunidadDelPuerto;
}

/**
 * El caladero y la comunidad autónoma de cada puerto del catálogo, leídos de `ports.json`.
 *
 * Solo se leen esos tres campos: lo demás del catálogo ya lo sirve el caso de uso `listPorts` y
 * duplicar su lectura aquí sería un segundo camino al mismo dato.
 *
 * La **comunidad** entró en T-19 con el hallazgo H-5 y no es un dato de adorno: la nota `(*)` del
 * Anexo II excepciona a la Comunidad Autónoma de las Illes Balears, que es un criterio
 * administrativo y no geográfico, así que con este campo la sección puede decirle a quien lee si
 * esa excepción le afecta en vez de pasarle el trabajo. Es el mismo dato con el que se construye la
 * URL de la página en la que está.
 */
const cargarEncajeDePuertos = unaVez(async (): Promise<ReadonlyMap<string, EncajeDelPuerto>> => {
  const documento = objeto(FICHERO_PUERTOS, JSON.parse(await readFile(FICHERO_PUERTOS, "utf8")), "$");
  const puertos = lista(FICHERO_PUERTOS, documento, "ports", "$");
  return new Map(
    puertos.map((valor, indice) => {
      const ruta = `$.ports[${indice}]`;
      const puerto = objeto(FICHERO_PUERTOS, valor, ruta);
      const region = objeto(FICHERO_PUERTOS, puerto["region"], `${ruta}.region`);
      return [
        texto(FICHERO_PUERTOS, puerto, "slug", ruta),
        {
          caladero: texto(FICHERO_PUERTOS, puerto, "caladero", ruta),
          comunidad: {
            slug: texto(FICHERO_PUERTOS, region, "slug", `${ruta}.region`),
            nombre: texto(FICHERO_PUERTOS, region, "name", `${ruta}.region`),
          },
        },
      ] as const;
    }),
  );
});

// =================================================================================================
// Lo que consume la sección
// =================================================================================================

/** La norma y el caladero que le toca a un puerto: todo lo que la sección necesita pintar. */
export interface TablaDelPuerto {
  readonly fuente: FuenteNormativa;
  readonly caladero: Caladero;
  /** Dónde está el puerto, para resolver las excepciones que dependen de la comunidad autónoma. */
  readonly comunidad: ComunidadDelPuerto;
}

/**
 * La tabla de tallas mínimas del puerto de la página, pedida **por slug**.
 *
 * Levanta si el puerto no declara caladero o si declara uno que la norma no tiene: son los dos
 * casos en los que la alternativa —elegir uno, o no pintar nada— publica en silencio la tabla
 * equivocada o deja un hueco mudo en la página de un puerto real.
 */
export async function cargarTablaDeTallas(contexto: ContextoDeSeccion): Promise<TablaDelPuerto> {
  const [normativa, puertos] = await Promise.all([cargarNormativa(), cargarEncajeDePuertos()]);
  const encaje = puertos.get(contexto.slug);
  const id = encaje?.caladero;
  if (encaje === undefined || id === undefined) {
    throw new Error(
      `El puerto ${contexto.slug} no declara caladero en ${FICHERO_PUERTOS}: sin él no se sabe qué ` +
        `anexo del RD 560/1995 le aplica, y los tres publican cifras distintas para la misma especie.`,
    );
  }
  const caladero = normativa.caladeros.find((candidato) => candidato.id === id);
  if (caladero === undefined) {
    throw new Error(
      `El puerto ${contexto.slug} declara el caladero ${JSON.stringify(id)} y la normativa solo ` +
        `publica ${normativa.caladeros.map((c) => JSON.stringify(c.id)).join(", ")}.`,
    );
  }
  return { fuente: normativa.fuente, caladero, comunidad: encaje.comunidad };
}

/** El formato numérico del sitio, prestado al módulo (coma decimal, como el resto de la página). */
export const FORMATO_DE_TALLAS: FormatoDeTallas = { numero };
