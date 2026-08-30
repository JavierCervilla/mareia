/**
 * El cruce que necesita la ficha de especie (T-23): lo que la retícula publica y **no** sale del
 * catálogo de T-20.
 *
 * Son tres uniones, cada una con su fuente y su autoridad, y las tres viven aquí porque cruzar es
 * leer ficheros y el módulo `species` no conoce el disco (la misma frontera que `catalogo.ts`):
 *
 * 1. **El nombre local canario** (`normativa/v1`, T-19) — se une **por binomio**, que es lo único
 *    que comparten los dos derivados: el nombre común no vale (el mismo anexo escribe «Lisa» y
 *    «Lisas») y la clave del catálogo no existe en la norma. El texto lo resuelve `regulations` con
 *    su propia regla —un nombre o el motivo de que falte, nunca un hueco mudo—; aquí sólo se
 *    traduce su vocabulario al de la retícula.
 * 2. **Los espacios protegidos por caladero** (`areas-protegidas/v1`, T-21) — y esta unión es la
 *    que hay que mirar con cuidado, porque es la que se puede leer mal. **RAMPE no publica nada por
 *    especie**: no dice qué especie está protegida en cada espacio. Lo único que sostiene el dato es
 *    el **caladero** —dónde se aplica la talla de esa especie—, así que lo que se cuenta son puertos
 *    y espacios, nunca especies, y la frase que lo dice va delante en la propia página.
 * 3. **La foto** (`fotos/v1`, el carril de ingesta de esta misma trayectoria) — con **su** autor y
 *    **su** licencia por fichero, nunca un pie global: en la muestra de 12 ficheros del plan hay
 *    seis licencias distintas.
 *
 * **Ninguna de las tres inventa una magnitud.** Los recuentos de espacios se cuentan del derivado y
 * son puertos y códigos RAMPE distintos; no hay ninguna cifra derivada que se parezca a una
 * puntuación, y no la habrá: es el gate F4.
 */

import { fichasDeEspecies } from "@mareia/module-species";
import type {
  DatosDeLaFicha,
  EspaciosDelCaladero,
  FichaDeEspecie,
  Rellenado,
} from "@mareia/module-species";
import { FUERA_DEL_ANEXO_III } from "@mareia/module-species";
import type { NombreSecundario } from "@mareia/module-regulations";

import {
  cargarCaladeroDeCadaPuerto,
  cargarNombresLocales,
} from "../normativa.ts";
import { cargarEspaciosPorCaladero } from "../areas-protegidas.ts";
import { cargarCatalogoDeEspecies, FORMATO_DEL_CATALOGO } from "./catalogo.ts";
import { cargarFotos } from "./fotos.ts";

/**
 * Traduce el vocabulario de `regulations` al de la retícula. **Renombra; no reescribe valores**, que
 * es la misma regla del adaptador del catálogo.
 */
function comoRellenado(nombre: NombreSecundario): Rellenado<string> {
  return nombre.tipo === "nombre"
    ? { tipo: "dato", valor: nombre.valor }
    : { tipo: "hueco", motivo: nombre.motivo };
}

/**
 * El nombre local de cada especie del catálogo, o el motivo por el que no lo tiene. **Las 86.**
 *
 * Tres situaciones, y las tres se distinguen porque significan cosas distintas:
 *
 * - La norma se lo escribe en alguno de sus anexos → el nombre (28 de las 86 hoy).
 * - La norma la regula en un anexo que **sí** tiene columna de nombre local y deja la celda vacía →
 *   el motivo que escribe el propio dataset (3 de las 86).
 * - Ningún anexo que la regule tiene esa columna → `FUERA_DEL_ANEXO_III`: no es que la especie no
 *   tenga nombre en las islas, es que la norma no lo escribe fuera de Canarias (55 de las 86).
 *
 * **Levanta** si una especie está regulada por un anexo con esa columna y su binomio no aparece en
 * él: significaría que los dos derivados no hablan de las mismas filas, y el hueco que se publicaría
 * («la norma no lo escribe aquí») sería falso.
 */
async function nombresLocalesPorClave(): Promise<ReadonlyMap<string, Rellenado<string>>> {
  const [catalogo, porCaladero] = await Promise.all([
    cargarCatalogoDeEspecies(),
    cargarNombresLocales(),
  ]);
  return new Map(
    catalogo.especies.map((especie) => {
      for (const caladero of especie.caladeros) {
        const anexo = porCaladero.get(caladero.id);
        // Un anexo sin la columna no está en el mapa: eso es «este anexo no da nombres locales» y
        // no dice nada de esta especie. Se sigue mirando en los demás que la regulen.
        if (anexo === undefined || anexo.size === 0) continue;
        const encontrado = anexo.get(especie.nombreBoe);
        if (encontrado === undefined) {
          throw new Error(
            `${especie.nombreBoe}: el catálogo dice que la regula el anexo del caladero ` +
              `${JSON.stringify(caladero.id)}, que publica nombres locales, y ese anexo no tiene ` +
              `ninguna fila con ese binomio. Publicar «la norma no lo escribe aquí» sería falso: ` +
              `lo que pasa es que los dos derivados no hablan de las mismas filas.`,
          );
        }
        return [especie.clave, comoRellenado(encontrado)] as const;
      }
      return [especie.clave, { tipo: "hueco", motivo: FUERA_DEL_ANEXO_III }] as const;
    }),
  );
}

/**
 * Los espacios protegidos de cada caladero del catálogo, con **el nombre que le da el catálogo**.
 *
 * El nombre sale de aquí y no del derivado de áreas —que no lo tiene— para que la fila de espacios y
 * la de tallas de la misma ficha llamen igual al mismo caladero. Dos nombres del mismo anexo en la
 * misma página se leen como dos anexos.
 */
async function espaciosPorCaladero(): Promise<ReadonlyMap<string, EspaciosDelCaladero>> {
  const [catalogo, caladeroDeCadaPuerto] = await Promise.all([
    cargarCatalogoDeEspecies(),
    cargarCaladeroDeCadaPuerto(),
  ]);
  const espacios = await cargarEspaciosPorCaladero(caladeroDeCadaPuerto);
  const nombres = new Map(
    catalogo.especies.flatMap((especie) =>
      especie.caladeros.map((caladero) => [caladero.id, caladero.nombre] as const),
    ),
  );
  return new Map(
    [...espacios].map(([id, cuenta]) => [id, { nombre: nombres.get(id) ?? id, ...cuenta }]),
  );
}

/**
 * Las 86 fichas, listas para pintarse.
 *
 * Se construyen **todas de una vez** porque es lo que pide el `getStaticPaths` de la ruta dinámica, y
 * porque así las 86 páginas salen de una sola lectura de los cuatro derivados en vez de 86.
 */
export async function cargarFichasDeEspecies(): Promise<readonly FichaDeEspecie[]> {
  const [catalogo, nombreLocalCanario, espacios, fotos] = await Promise.all([
    cargarCatalogoDeEspecies(),
    nombresLocalesPorClave(),
    espaciosPorCaladero(),
    cargarFotos(),
  ]);
  const datos: DatosDeLaFicha = {
    nombreLocalCanario,
    espaciosPorCaladero: espacios,
    fotos,
  };
  return fichasDeEspecies(catalogo, datos, FORMATO_DEL_CATALOGO);
}
