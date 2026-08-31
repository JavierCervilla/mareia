/**
 * El lector de `data/especies/fotos.json` (`fotos/v1`): la foto de cada especie con **su** autor y
 * **su** licencia.
 *
 * **Este fichero se escribió contra un contrato congelado, no contra un dataset existente.** T-23 va
 * por dos carriles a la vez —la ingesta de Wikidata/Commons por un lado y la ficha por el otro— y en
 * T-20 los dos carriles divergieron en **nueve campos** porque el contrato no estaba escrito en
 * ninguna parte. Aquí sí lo está (`docs/trayectorias/T-23-plan.md`, entregable 2) y este lector lo
 * respeta al pie de la letra: `schema`, `consultadoEn`, `fotos` por clave de T-20 con
 * `fichero`/`url`/`descripcion`/`autor`/`atribucionRequerida`/`licencia`/`licenciaCodigo`/
 * `licenciaUrl`/`prestadaDe`/`identificadaPor`, y `sinFoto` por clave con su `motivo`. Ni un nombre
 * inventado. El contrato se **enmendó** dos veces —el 2026-08-30 `licenciaUrl` pasó a condicional y
 * nació `licenciaCodigo`; el 2026-08-31 `autor` pasó a condicional y nacieron `atribucionRequerida`
 * y `prestadaDe`— y las dos enmiendas están escritas en el mismo sitio que el contrato, que es lo
 * que las hace enmiendas y no divergencias de carril.
 *
 * Las tres decisiones que dan forma al fichero:
 *
 * 1. **Que el dataset no exista no es que una especie no tenga foto**, y son dos frases distintas en
 *    la página. Mientras el carril de la ingesta no aterrice, esto devuelve `sin_dataset` y la ficha
 *    publica su motivo: «aún no se ha preguntado». Publicar «esta especie no tiene foto» sería
 *    afirmar sobre Wikidata algo que nadie ha comprobado — el mismo reparto que `seLePreguntoAObis`
 *    hace con los dos silencios de OBIS.
 * 2. **Una foto sin autor o sin licencia no se publica: levanta.** No se degrada a «foto sin
 *    crédito» ni se salta la fila en silencio. El plan lo dice de la ingesta («aborta la fila, no el
 *    proceso») y aquí es más duro a propósito: si una fila llegase igualmente sin crédito, el
 *    silencio publicaría una imagen ajena sin atribuir, que es lo único de esta ficha que además de
 *    deshonesto es ilegal.
 * 3. **`sinFoto` es obligatorio y explícito.** Una clave que no esté ni en `fotos` ni en `sinFoto`
 *    hace levantar a `fichasDeEspecies`: una especie ausente del mapa es un hueco mudo. Es la
 *    lección de los 10 puertos sin área de T-21.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { esDominioPublico, TIPOS_DE_PRESTAMO } from "@mareia/module-species";
import type {
  FotoDeCommons,
  FotoPrestada,
  FotosDeLaFicha,
  Rellenado,
} from "@mareia/module-species";

import { DATA_DIR } from "../../datos/deps.ts";

/** El derivado que publica el carril de ingesta de T-23. */
const FICHERO_FOTOS = `${DATA_DIR}/especies/fotos.json`;

/** Contrato congelado en el plan. Un `schema` distinto no se lee: se rompe. */
const SCHEMA = "fotos/v1";

/** El dataset no tiene la forma del contrato congelado. El mensaje señala fichero y campo. */
export class FotosMalFormadas extends Error {
  constructor(detalle: string) {
    super(`Dataset con formato inesperado en ${FICHERO_FOTOS}: ${detalle}`);
    this.name = "FotosMalFormadas";
  }
}

// =================================================================================================
// Lectura defensiva
// =================================================================================================

function objeto(valor: unknown, ruta: string): Record<string, unknown> {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    throw new FotosMalFormadas(`${ruta} debería ser un objeto`);
  }
  return valor as Record<string, unknown>;
}

function texto(fuente: Record<string, unknown>, clave: string, ruta: string): string {
  const valor = fuente[clave];
  // **En blanco es tan vacío como vacío.** Comprobar sólo `length === 0` dejaba pasar `"  "`, y un
  // autor de dos espacios pinta «Foto de   · CC BY-SA 4.0»: una atribución que no atribuye a nadie,
  // con todo verde. Los siete campos de este contrato son texto que se publica, así que ninguno
  // admite una cadena que no diga nada.
  if (typeof valor !== "string" || valor.trim().length === 0) {
    throw new FotosMalFormadas(`${ruta}.${clave} debería ser una cadena no vacía`);
  }
  return valor;
}

/**
 * La URL de la licencia, que es **condicional en los dos sentidos** y por eso se lee aparte.
 *
 * Con condiciones, obligatoria y no vacía: la cadena vacía es la forma en que un enlace desaparece
 * sin que nada enrojezca. Sin condiciones (dominio público), **ausente**: ni `""`, ni `null`, ni
 * presente. Que la ausencia sea obligatoria y no meramente tolerada es lo que impide que esa rama
 * —la única del dataset cuyo enlace nadie iría a comprobar, «total, es dominio público»— sea donde
 * acabe escondida una URL rota.
 */
function leerLicenciaUrl(
  crudo: Record<string, unknown>,
  licenciaCodigo: string,
  ruta: string,
): string | undefined {
  if (!esDominioPublico(licenciaCodigo)) return texto(crudo, "licenciaUrl", ruta);
  if (!("licenciaUrl" in crudo)) return undefined;
  throw new FotosMalFormadas(
    `${ruta}.licenciaUrl no debería estar: ${ruta}.licenciaCodigo es ` +
      `${JSON.stringify(licenciaCodigo)}, que no tiene condiciones de reutilización, así que no ` +
      `hay URL de condiciones que enlazar (y es ${JSON.stringify(crudo["licenciaUrl"])})`,
  );
}

/**
 * El booleano que declara la fuente. **Booleano de verdad**, no la cadena `"false"`.
 *
 * La distinción no es preciosismo: `"false"` es un valor verdadero en JavaScript, así que un
 * contrato que aceptase la cadena convertiría «Commons dice que no hace falta atribuir» en «sí hace
 * falta» —o al revés, según quién lo lea— en el sitio exacto donde eso decide si una foto se
 * publica con crédito o sin él.
 */
function booleano(fuente: Record<string, unknown>, clave: string, ruta: string): boolean {
  const valor = fuente[clave];
  if (typeof valor !== "boolean") {
    throw new FotosMalFormadas(
      `${ruta}.${clave} debería ser un booleano y es ${JSON.stringify(valor)}`,
    );
  }
  return valor;
}

/**
 * El autor, que es **condicional y en un solo sentido** (enmienda del 2026-08-31).
 *
 * Obligatorio y no vacío mientras la foto declare que hay que atribuir —la cadena vacía es la forma
 * en que un crédito desaparece sin que nada enrojezca: `autor: ""` pinta «Foto de  · CC BY-SA 4.0»,
 * que es una atribución que no atribuye a nadie—. Y puede faltar sólo con
 * `atribucionRequerida: false`, que es lo que Commons publica de los dos ficheros de la NOAA que
 * estaban detrás de los huecos del bacalao y de las lisas.
 *
 * Al revés que `licenciaUrl`, aquí la ausencia **no** es obligatoria: una foto que no exija
 * atribuir y que además acredite a su autor lo publica, porque acreditar de más no engaña a nadie.
 */
function leerAutor(
  crudo: Record<string, unknown>,
  atribucionRequerida: boolean,
  ruta: string,
): string | undefined {
  if (!atribucionRequerida && !("autor" in crudo)) return undefined;
  return texto(crudo, "autor", ruta);
}

/**
 * De qué otra especie es la foto, cuando la fila no puede ilustrarse con su propio taxón.
 *
 * Los tres campos son obligatorios y el `tipo` tiene que ser uno de los que la ficha sabe rotular:
 * una foto prestada que la página no supiera explicar se publicaría muda, y una foto muda de otro
 * animal bajo el nombre de éste es peor que no publicar ninguna.
 */
function leerPrestadaDe(crudo: Record<string, unknown>, ruta: string): FotoPrestada | undefined {
  if (!("prestadaDe" in crudo)) return undefined;
  const prestada = objeto(crudo["prestadaDe"], `${ruta}.prestadaDe`);
  const tipo = texto(prestada, "tipo", `${ruta}.prestadaDe`);
  if (!TIPOS_DE_PRESTAMO.has(tipo)) {
    throw new FotosMalFormadas(
      `${ruta}.prestadaDe.tipo es ${JSON.stringify(tipo)}, que no es ninguno de los préstamos ` +
        `que la ficha sabe rotular (${[...TIPOS_DE_PRESTAMO].join(", ")})`,
    );
  }
  return {
    tipo,
    nombre: texto(prestada, "nombre", `${ruta}.prestadaDe`),
    nombreBoe: texto(prestada, "nombreBoe", `${ruta}.prestadaDe`),
  };
}

/**
 * Una foto, con los campos que hacen falta para poder publicarla.
 *
 * Todos son obligatorios menos `autor`, `licenciaUrl` y `prestadaDe`, y ninguno admite cadena
 * vacía. Los dos condicionales lo son porque **lo dice la fuente**, no porque nos venga bien:
 * `licenciaCodigo` y `atribucionRequerida` son lo que hace que las dos excepciones se comprueben
 * sobre el JSON publicado en vez de confiarse a lo que la ingesta se acuerde de haber hecho.
 */
function leerFoto(valor: unknown, clave: string): FotoDeCommons {
  const ruta = `$.fotos[${JSON.stringify(clave)}]`;
  const crudo = objeto(valor, ruta);
  const identificada = objeto(crudo["identificadaPor"], `${ruta}.identificadaPor`);
  const licenciaCodigo = texto(crudo, "licenciaCodigo", ruta);
  const licenciaUrl = leerLicenciaUrl(crudo, licenciaCodigo, ruta);
  const atribucionRequerida = booleano(crudo, "atribucionRequerida", ruta);
  const autor = leerAutor(crudo, atribucionRequerida, ruta);
  const prestadaDe = leerPrestadaDe(crudo, ruta);
  return {
    fichero: texto(crudo, "fichero", ruta),
    url: texto(crudo, "url", ruta),
    descripcion: texto(crudo, "descripcion", ruta),
    ...(autor === undefined ? {} : { autor }),
    atribucionRequerida,
    licencia: texto(crudo, "licencia", ruta),
    licenciaCodigo,
    ...(licenciaUrl === undefined ? {} : { licenciaUrl }),
    ...(prestadaDe === undefined ? {} : { prestadaDe }),
    identificadaPor: {
      fuente: texto(identificada, "fuente", `${ruta}.identificadaPor`),
      entidad: texto(identificada, "entidad", `${ruta}.identificadaPor`),
      propiedad: texto(identificada, "propiedad", `${ruta}.identificadaPor`),
    },
  };
}

/**
 * El dataset entero, o `sin_dataset` si todavía no está en el build.
 *
 * **Levanta si una clave aparece en los dos mapas**: una especie que tiene foto y a la vez el motivo
 * de no tenerla es una contradicción del dataset, y publicar cualquiera de las dos ramas sería
 * elegir por nuestra cuenta cuál de las dos afirmaciones de la ingesta es la buena.
 */
export function leerFotos(crudo: unknown): FotosDeLaFicha {
  const documento = objeto(crudo, "$");
  const schema = texto(documento, "schema", "$");
  if (schema !== SCHEMA) {
    throw new FotosMalFormadas(
      `$.schema debería ser ${JSON.stringify(SCHEMA)} y es ${JSON.stringify(schema)}`,
    );
  }
  const fotos = objeto(documento["fotos"], "$.fotos");
  const sinFoto = objeto(documento["sinFoto"], "$.sinFoto");
  const porClave = new Map<string, Rellenado<FotoDeCommons>>();
  for (const [clave, valor] of Object.entries(fotos)) {
    porClave.set(clave, { tipo: "dato", valor: leerFoto(valor, clave) });
  }
  for (const [clave, valor] of Object.entries(sinFoto)) {
    if (porClave.has(clave)) {
      throw new FotosMalFormadas(
        `${JSON.stringify(clave)} está a la vez en $.fotos y en $.sinFoto. Una especie con foto y ` +
          `con el motivo de no tenerla es una contradicción, y elegir una de las dos sería ` +
          `decidir por la ingesta cuál de sus dos afirmaciones vale.`,
      );
    }
    const ruta = `$.sinFoto[${JSON.stringify(clave)}]`;
    porClave.set(clave, { tipo: "hueco", motivo: texto(objeto(valor, ruta), "motivo", ruta) });
  }
  return { tipo: "ingerido", consultadoEn: texto(documento, "consultadoEn", "$"), porClave };
}

/**
 * Se cachea la **promesa** y no el resultado, igual que en `catalogo.ts`: el build genera 86 fichas
 * y todas piden el dataset casi a la vez. Un fallo no se cachea.
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

/**
 * Las fotos, leídas del derivado commiteado; `sin_dataset` mientras el carril de ingesta no aterrice.
 *
 * **La ausencia del fichero es el único fallo que no rompe el build**, y está acotada a eso: si el
 * fichero está y no se puede leer, o no cumple el contrato, se levanta. Un `catch` genérico aquí
 * convertiría un dataset corrupto en «todavía no hay fotos», que es la avería silenciosa que este
 * portal no se permite.
 */
export const cargarFotos = unaVez(async (): Promise<FotosDeLaFicha> => {
  if (!existsSync(FICHERO_FOTOS)) return { tipo: "sin_dataset" };
  const contenido = await readFile(FICHERO_FOTOS, "utf8");
  let crudo: unknown;
  try {
    crudo = JSON.parse(contenido);
  } catch (causa) {
    throw new FotosMalFormadas(
      `no es JSON válido (${causa instanceof Error ? causa.message : "error desconocido"})`,
    );
  }
  return leerFotos(crudo);
});
