/**
 * El adaptador entre el módulo `protected-areas` y esta web: quién abre el derivado de RAMPE y
 * quién sabe qué áreas le tocan a cada puerto.
 *
 * Es la misma costura que `normativa.ts` para las tallas y `actividad-solunar.ts` para pesca, y con
 * la misma regla: **la sección pide su dato por slug**, no lo recibe inyectado. `ContextoDeSeccion`
 * lleva a propósito solo slug/nombre/fecha/zona —lo mínimo con lo que un módulo puede hablar del
 * sitio— y la plantilla de la página no carga el dato de ningún módulo concreto. Si la página
 * tuviera que resolver las áreas para pasárselas hechas, quedaría atada a lo que hoy necesita este
 * módulo, y el siguiente necesitará otra cosa.
 *
 * Aquí **no se calcula ninguna distancia**: el cruce puerto–área lo hizo el pipeline (`python
 * run.py areas-protegidas`) contra las geometrías, que son 54,8 MB que no entran en el repo y que
 * además no se pueden redistribuir. Este fichero lee hechos derivados.
 *
 * Todo lo que no cuadra **levanta nombrando el campo o el puerto**. Un puerto al que se le publican
 * las áreas de otro se lee igual de bien que el correcto, y esta sección es una advertencia:
 * degradar en silencio aquí sería avisar mal en 153 páginas.
 */

import { readFile } from "node:fs/promises";

import type {
  AreaProtegida,
  AreasDelPuerto,
  CriterioDeAreas,
  FuenteDeAreas,
  ResumenDeAreas,
  TipoDeArea,
} from "@mareia/module-protected-areas";

import { DATA_DIR } from "../datos/deps.ts";
import type { ContextoDeSeccion } from "./contexto.ts";

/** Versión de schema que este código sabe leer. Otra cosa no se interpreta: se rechaza. */
const SCHEMA = "areas-protegidas/v1";

const FICHERO_AREAS = `${DATA_DIR}/geo/areas-protegidas.json`;

/**
 * Las cinco figuras que publica RAMPE 2025, para validar lo que llega del disco.
 *
 * La unión de TypeScript se borra al compilar: sin esta lista, un `tipo` nuevo o mal escrito en el
 * fichero llegaría a `glosaDeTipo`, que **levanta** por su rama `never` —correcto, pero el mensaje
 * hablaría de una figura «no contemplada» sin decir de qué puerto ni de qué área—. Comprobarlo en
 * la frontera es lo que convierte eso en un error con el fichero y el área que lo trae.
 */
const FIGURAS: readonly TipoDeArea[] = ["ZEPA", "ZEC", "RESERVA MARINA", "ZEC/AMP", "AMP"];

/** El dataset no tiene la forma esperada. El mensaje señala fichero y campo. */
class AreasMalFormadas extends Error {
  constructor(detalle: string) {
    super(`Dataset con formato inesperado en ${FICHERO_AREAS}: ${detalle}`);
    this.name = "AreasMalFormadas";
  }
}

// =================================================================================================
// Lectura defensiva
// =================================================================================================
//
// El fichero de `data/` es nuestro y CI lo valida contra su schema, pero al cruzar la frontera del
// proceso vuelve a ser `unknown`. Estos ayudantes convierten esa incertidumbre en un error con el
// campo que falló, en vez de en un `any` que se propaga hasta publicar «a menos de NaN km».

function objeto(valor: unknown, ruta: string): Record<string, unknown> {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    throw new AreasMalFormadas(`${ruta} debería ser un objeto`);
  }
  return valor as Record<string, unknown>;
}

function lista(fuente: Record<string, unknown>, clave: string, ruta: string): readonly unknown[] {
  const valor = fuente[clave];
  if (!Array.isArray(valor)) throw new AreasMalFormadas(`${ruta}.${clave} debería ser un array`);
  return valor;
}

function texto(fuente: Record<string, unknown>, clave: string, ruta: string): string {
  const valor = fuente[clave];
  if (typeof valor !== "string" || valor.length === 0) {
    throw new AreasMalFormadas(`${ruta}.${clave} debería ser una cadena no vacía`);
  }
  return valor;
}

function magnitud(fuente: Record<string, unknown>, clave: string, ruta: string): number {
  const valor = fuente[clave];
  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    throw new AreasMalFormadas(`${ruta}.${clave} debería ser un número finito`);
  }
  return valor;
}

function booleano(fuente: Record<string, unknown>, clave: string, ruta: string): boolean {
  const valor = fuente[clave];
  if (typeof valor !== "boolean") {
    throw new AreasMalFormadas(`${ruta}.${clave} debería ser true o false`);
  }
  return valor;
}

function figura(fuente: Record<string, unknown>, ruta: string): TipoDeArea {
  const valor = texto(fuente, "tipo", ruta);
  const conocida = FIGURAS.find((candidata) => candidata === valor);
  if (conocida === undefined) {
    throw new AreasMalFormadas(
      `${ruta}.tipo es ${JSON.stringify(valor)}, que no es ninguna de las cinco figuras de RAMPE ` +
        `(${FIGURAS.join(", ")}). Una sigla sin glosa no se publica.`,
    );
  }
  return conocida;
}

function leerArea(valor: unknown, ruta: string): AreaProtegida {
  const crudo = objeto(valor, ruta);
  return {
    nombre: texto(crudo, "nombre", ruta),
    tipo: figura(crudo, ruta),
    codigo: texto(crudo, "codigo", ruta),
    distanciaAproxKm: magnitud(crudo, "distanciaAproxKm", ruta),
    dentro: booleano(crudo, "dentro", ruta),
  };
}

/**
 * Un puerto del derivado.
 *
 * `motivo` es obligatorio cuando no hay áreas y **tiene que estar ausente cuando las hay**: es la
 * frase que sostiene la sección en los 10 puertos sin ninguna, y un hueco ahí publicaría una
 * sección que dice «ninguna» sin decir hasta dónde se ha mirado.
 */
function leerPuerto(valor: unknown, indice: number): AreasDelPuerto {
  const ruta = `$.puertos[${indice}]`;
  const crudo = objeto(valor, ruta);
  const areas = lista(crudo, "areas", ruta).map((area, i) => leerArea(area, `${ruta}.areas[${i}]`));
  const motivo = crudo["motivo"];
  if (areas.length === 0 && (typeof motivo !== "string" || motivo.length === 0)) {
    throw new AreasMalFormadas(
      `${ruta} no publica ningún área y tampoco el motivo. Una sección vacía sin motivo se lee ` +
        `como «no hay nada que saber» en vez de como «ninguna a menos de 30 km».`,
    );
  }
  if (areas.length > 0 && motivo !== null && motivo !== undefined) {
    throw new AreasMalFormadas(`${ruta} trae áreas y además un motivo de ausencia`);
  }
  return {
    slug: texto(crudo, "slug", ruta),
    areas,
    motivo: typeof motivo === "string" ? motivo : null,
  };
}

function leerFuente(valor: unknown): FuenteDeAreas {
  const ruta = "$.fuente";
  const crudo = objeto(valor, ruta);
  const censo = objeto(crudo["censo"], `${ruta}.censo`);
  const porTipo = objeto(censo["porTipo"], `${ruta}.censo.porTipo`);
  return {
    nombre: texto(crudo, "nombre", ruta),
    organismo: texto(crudo, "organismo", ruta),
    url: texto(crudo, "url", ruta),
    paginaUrl: texto(crudo, "paginaUrl", ruta),
    // La licencia se publica: es un hecho sobre la fuente —aquí, un hueco de origen— y va con su
    // atribución. El aviso ya NO llega a la página (la regla dura es `NO_AUTORIZA_A_PESCAR`, del
    // módulo, desde el hallazgo H-1), pero se sigue exigiendo aquí: es el registro de lo que la
    // ingesta escribió, y un derivado que deje de traerlo es un derivado que hay que mirar.
    licencia: texto(crudo, "licencia", ruta),
    aviso: texto(crudo, "aviso", ruta),
    descargadoEn: texto(crudo, "descargadoEn", ruta),
    censo: {
      areas: magnitud(censo, "areas", `${ruta}.censo`),
      verticesEnOrigen: magnitud(censo, "verticesEnOrigen", `${ruta}.censo`),
      porTipo: Object.fromEntries(
        Object.keys(porTipo).map((tipo) => [tipo, magnitud(porTipo, tipo, `${ruta}.censo.porTipo`)]),
      ),
    },
  };
}

/** El recuento del propio derivado, que el pipeline recalcula desde el contenido y no teclea. */
function leerResumen(valor: unknown): ResumenDeAreas {
  const ruta = "$.resumen";
  const crudo = objeto(valor, ruta);
  return {
    puertos: magnitud(crudo, "puertos", ruta),
    conArea: magnitud(crudo, "conArea", ruta),
    sinArea: magnitud(crudo, "sinArea", ruta),
    relaciones: magnitud(crudo, "relaciones", ruta),
  };
}

function leerCriterio(valor: unknown): CriterioDeAreas {
  const ruta = "$.criterio";
  const crudo = objeto(valor, ruta);
  const radioKm = magnitud(crudo, "radioKm", ruta);
  if (radioKm <= 0) {
    throw new AreasMalFormadas(`${ruta}.radioKm es ${radioKm}: sin radio no hay «hasta dónde miramos»`);
  }
  return {
    radioKm,
    distancia: texto(crudo, "distancia", ruta),
    dentro: texto(crudo, "dentro", ruta),
    sinGeometria: texto(crudo, "sinGeometria", ruta),
  };
}

// =================================================================================================
// Carga, una vez por proceso
// =================================================================================================

/** Lo que el derivado publica, ya validado y con los puertos indexados por slug. */
interface DerivadoDeAreas {
  readonly fuente: FuenteDeAreas;
  readonly criterio: CriterioDeAreas;
  readonly resumen: ResumenDeAreas;
  readonly porPuerto: ReadonlyMap<string, AreasDelPuerto>;
}

/**
 * Se cachea la **promesa** y no el resultado: el build genera 153 páginas y cada una pide su lista
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

const cargarDerivado = unaVez(async (): Promise<DerivadoDeAreas> => {
  const contenido = await readFile(FICHERO_AREAS, "utf8");
  let crudo: unknown;
  try {
    crudo = JSON.parse(contenido);
  } catch (causa) {
    throw new AreasMalFormadas(
      `no es JSON válido (${causa instanceof Error ? causa.message : "error desconocido"})`,
    );
  }
  const documento = objeto(crudo, "$");
  const schema = texto(documento, "schema", "$");
  if (schema !== SCHEMA) {
    throw new AreasMalFormadas(
      `$.schema debería ser ${JSON.stringify(SCHEMA)} y es ${JSON.stringify(schema)}`,
    );
  }
  const puertos = lista(documento, "puertos", "$").map((puerto, indice) =>
    leerPuerto(puerto, indice),
  );
  return {
    fuente: leerFuente(documento["fuente"]),
    criterio: leerCriterio(documento["criterio"]),
    resumen: leerResumen(documento["resumen"]),
    porPuerto: new Map(puertos.map((puerto) => [puerto.slug, puerto])),
  };
});

// =================================================================================================
// Lo que consume la sección
// =================================================================================================

/** Las áreas de un puerto y lo que las califica: todo lo que la sección necesita pintar. */
export interface AreasDelPuertoDeLaPagina {
  readonly fuente: FuenteDeAreas;
  readonly criterio: CriterioDeAreas;
  /** Las áreas a menos del radio, de la más cercana a la más lejana. Puede estar vacía. */
  readonly areas: readonly AreaProtegida[];
  /** Por qué está vacía, cuando lo está. `null` cuando hay áreas. */
  readonly motivo: string | null;
}

/**
 * Las áreas protegidas del puerto de la página, pedidas **por slug**.
 *
 * Levanta si el puerto no está en el derivado, y esa es la decisión que importa: la alternativa
 * —tratar la ausencia como «no hay áreas»— publicaría «ninguna a menos de 30 km» en una página
 * sobre la que nadie ha mirado nada. Los 10 puertos que de verdad no tienen ninguna **sí están** en
 * el fichero, con su motivo; no estar y no tener áreas son cosas distintas y aquí se distinguen.
 */
export async function cargarAreasDelPuerto(
  contexto: ContextoDeSeccion,
): Promise<AreasDelPuertoDeLaPagina> {
  const { fuente, criterio, porPuerto } = await cargarDerivado();
  const puerto = porPuerto.get(contexto.slug);
  if (puerto === undefined) {
    throw new Error(
      `El puerto ${contexto.slug} no está en ${FICHERO_AREAS}. No es lo mismo que no tener áreas ` +
        `cerca: los puertos sin ninguna están en el fichero con su motivo, y publicar «ninguna a ` +
        `menos de ${criterio.radioKm}\u00a0km» sin haber mirado sería una advertencia inventada.`,
    );
  }
  return { fuente, criterio, areas: puerto.areas, motivo: puerto.motivo };
}

/**
 * La fuente, el criterio y el recuento del derivado, sin puerto.
 *
 * Existe para los **gates**: las cifras que esta trayectoria escribe en la documentación
 * —`design-brief.md`, `CHANGELOG.md`, `ROADMAP.md`— se comparan con esto en vez de teclearse. Es la
 * lección de T-19, donde se coló un censo que no reproducía y costó una corrección pública.
 */
export async function cargarResumenDeAreas(): Promise<{
  readonly fuente: FuenteDeAreas;
  readonly criterio: CriterioDeAreas;
  readonly resumen: ResumenDeAreas;
}> {
  const { fuente, criterio, resumen } = await cargarDerivado();
  return { fuente, criterio, resumen };
}

/**
 * Lo que el derivado de T-21 sabe de un caladero entero: **recuentos de puertos y de espacios**.
 *
 * No lleva el nombre del caladero a propósito. Ese nombre lo escribe el catálogo de especies —es de
 * su dataset, no del de áreas— y ponerlo aquí sería una segunda copia que puede discrepar de la que
 * se pinta tres líneas más abajo en la misma página.
 */
export interface EspaciosProtegidosDelCaladero {
  /** Puertos de ese caladero que publica el portal. */
  readonly puertos: number;
  /** Cuántos de ellos tienen algún espacio protegido a menos del radio. */
  readonly conEspacio: number;
  /** Cuántos espacios **distintos** son. No es el número de relaciones. */
  readonly espacios: number;
  /** El radio con el que se miró, declarado por el propio derivado. */
  readonly radioKm: number;
}

/**
 * El derivado agrupado **por caladero**: cuántos puertos de cada uno tienen algún espacio protegido
 * cerca, y cuántos espacios distintos son.
 *
 * Existe para la ficha de especie de T-23, y su forma es la de una limitación de la fuente: **RAMPE
 * no publica nada por especie**. El único vínculo que se puede sostener entre una especie y un
 * espacio protegido es el caladero donde se le fija la talla, así que lo que se cuenta son **puertos
 * y espacios**, no especies, y ningún campo de aquí se puede leer como que a una especie le afecte
 * el régimen de un espacio. La frase que lo dice con esas palabras vive en el código del módulo
 * (`RAMPE_NO_HABLA_DE_ESPECIES`).
 *
 * El reparto puerto→caladero **se le pide a quien ya lo sabe** (`cargarCaladeroDeCadaPuerto`, que lo
 * lee de `ports.json`) en vez de releer el catálogo aquí: un segundo camino al mismo dato es un
 * camino que puede discrepar, y discrepar aquí significa contarle a una especie los espacios de otro
 * caladero.
 *
 * **Levanta si un puerto del catálogo no está en el derivado.** Es la misma decisión que toma
 * `cargarAreasDelPuerto` y por el mismo motivo: contar como «sin espacios» un puerto sobre el que
 * nadie ha mirado rebajaría la cifra de una advertencia.
 */
export async function cargarEspaciosPorCaladero(
  caladeroDeCadaPuerto: ReadonlyMap<string, string>,
): Promise<ReadonlyMap<string, EspaciosProtegidosDelCaladero>> {
  const { criterio, porPuerto } = await cargarDerivado();
  const acumulado = new Map<string, { puertos: number; conEspacio: number; codigos: Set<string> }>();
  for (const [slug, caladero] of caladeroDeCadaPuerto) {
    const puerto = porPuerto.get(slug);
    if (puerto === undefined) {
      throw new Error(
        `El puerto ${slug} no está en ${FICHERO_AREAS}. No es lo mismo que no tener espacios ` +
          `cerca: los que no tienen ninguno están en el fichero con su motivo, y contarlo como ` +
          `«sin espacios» rebajaría la cifra que publica la ficha de especie.`,
      );
    }
    const cuenta = acumulado.get(caladero) ?? { puertos: 0, conEspacio: 0, codigos: new Set() };
    cuenta.puertos += 1;
    if (puerto.areas.length > 0) cuenta.conEspacio += 1;
    for (const area of puerto.areas) cuenta.codigos.add(area.codigo);
    acumulado.set(caladero, cuenta);
  }
  return new Map(
    [...acumulado].map(([caladero, cuenta]) => [
      caladero,
      {
        puertos: cuenta.puertos,
        conEspacio: cuenta.conEspacio,
        // Espacios DISTINTOS y no relaciones: un espacio a menos de 30 km de doce puertos es uno,
        // no doce, y sumar relaciones publicaría una cifra que no cuenta lo que dice contar.
        espacios: cuenta.codigos.size,
        radioKm: criterio.radioKm,
      },
    ]),
  );
}
