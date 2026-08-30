/**
 * Lo que comparten los ataques del pase adversario de T-20 (el catálogo de especies).
 *
 * El catálogo es **dato de build**: no hay endpoint que interceptar ni isla que hidratar, así que
 * un ataque contra la página se hace leyendo el `dist/` **servido por HTTP** (nunca `file://`: sin
 * webfonts las medidas de ancho mienten) y contrastándolo contra los dos datasets de los que sale.
 *
 * La regla de este fichero es la de sus hermanos (`utiles-areas.ts`, `utiles-normativa.ts`): **no
 * hay asserts aquí**. Un helper que afirma esconde el ataque dentro de la utilidad y luego nadie
 * sabe qué se estaba comprobando. Lo que sí hay es lo que las expectativas necesitan **derivar del
 * dato** en vez de tecleado: un gate que teclea las cifras que vigila deja de vigilarlas en cuanto
 * la norma cambia.
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { RAIZ } from "./utiles";

/** La página del catálogo, tal y como la publica el sitio. */
export const RUTA_CATALOGO = "/pesca/especies/";

/** El derivado del catálogo de especies, commiteado. */
const CATALOGO = join(RAIZ, "data", "especies", "catalogo.json");

/** El derivado de la norma: es la fuente de la que el catálogo **copia** la talla. */
const NORMATIVA = join(RAIZ, "data", "normativa", "tallas-minimas.json");

// -------------------------------------------------------------------------------------------
// `especies/v1`, en la forma mínima que estos ataques necesitan leer
// -------------------------------------------------------------------------------------------

export interface TallaPublicada {
  readonly medida?: string | null;
  readonly talla: Record<string, unknown>;
  readonly textoOriginal: string;
  readonly notas: readonly string[];
}

export interface CaladeroPublicado {
  readonly id: string;
  readonly nombre: string;
  readonly nombreComun: string;
  readonly tallas: readonly TallaPublicada[];
  readonly presencia: Record<string, unknown> | null;
  readonly presenciaAusente?: string | null;
}

export interface TaxonPublicado {
  readonly resuelto: boolean;
  readonly aphiaId?: number;
  readonly nombreCientifico?: string;
  readonly estado?: string;
  readonly rango?: string;
  readonly aceptado?: { readonly aphiaId: number; readonly nombre: string } | null;
  readonly motivo?: string;
}

export interface CorrespondenciaPublicada {
  readonly tipo: "literal" | "genero_de_spp" | "errata_de_la_norma" | "sin_correspondencia";
  readonly origen: "worms" | "mareia";
  readonly consultadoComo: string | null;
  readonly motivo: string | null;
}

export interface EspeciePublicada {
  readonly nombreBoe: string;
  readonly clave: string;
  readonly correspondencia: CorrespondenciaPublicada;
  readonly taxon: TaxonPublicado;
  readonly caladeros: readonly CaladeroPublicado[];
}

/** Una fila de la norma **sin binomio**: la norma le fija talla y el catálogo no la publica. */
export interface FilaSinNombreCientifico {
  readonly caladero: string;
  readonly nombreComun: string;
  readonly motivo: string;
  readonly textoOriginal: string;
  readonly talla: Record<string, unknown>;
}

export interface Catalogo {
  readonly especies: readonly EspeciePublicada[];
  readonly sinNombreCientifico: readonly FilaSinNombreCientifico[];
}

/** El catálogo publicado, recién leído del disco. */
export function catalogoPublicado(): Catalogo {
  return JSON.parse(readFileSync(CATALOGO, "utf8")) as Catalogo;
}

// -------------------------------------------------------------------------------------------
// `normativa/v1`, sólo las notas al pie
// -------------------------------------------------------------------------------------------

export interface NotaDelAnexo {
  readonly marca: string;
  readonly texto: string;
}

interface CaladeroDeLaNorma {
  readonly id: string;
  readonly nombre: string;
  readonly notas: readonly NotaDelAnexo[];
}

/**
 * Las notas al pie de cada anexo, indexadas por caladero y marca.
 *
 * Son las que convierten una cifra en otra —«(***) Excepto en las divisiones 8a y 8b … 44
 * centímetros»— y por eso se leen del dataset y no se teclean aquí.
 */
export function notasDeLaNorma(): Map<string, Map<string, string>> {
  const norma = JSON.parse(readFileSync(NORMATIVA, "utf8")) as {
    caladeros: readonly CaladeroDeLaNorma[];
  };
  return new Map(
    norma.caladeros.map((caladero) => [
      caladero.id,
      new Map(caladero.notas.map((nota) => [nota.marca, nota.texto])),
    ]),
  );
}

/** `true` cuando la talla publica una magnitud (y no «la norma no fija talla»). */
export function esUnaCifra(talla: Record<string, unknown>): boolean {
  return talla["tipo"] === "longitud_cm" || talla["tipo"] === "peso_kg" || talla["tipo"] === "longitud_o_peso";
}

// -------------------------------------------------------------------------------------------
// El `dist/` servido
// -------------------------------------------------------------------------------------------

/** Lo que el navegador leería: sin marcado, con las entidades resueltas y con espacios normales. */
export function textoDe(fragmento: string): string {
  return fragmento
    .replace(/<[^>]*>/gu, " ")
    .replace(/&#(\d+);/gu, (_, codigo: string) => String.fromCodePoint(Number(codigo)))
    .replace(/&#x([0-9a-fA-F]+);/gu, (_, codigo: string) => String.fromCodePoint(parseInt(codigo, 16)))
    .replace(/&quot;/gu, '"')
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/\s+/gu, " ")
    .trim();
}

/** La fila de una especie dentro del catálogo construido, ya sin marcado. */
export function filaDe(html: string, clave: string): string {
  const patron = new RegExp(`<tr data-especie="${clave}"[^>]*>([\\s\\S]*?)</tr>`, "u");
  return textoDe(patron.exec(html)?.[1] ?? "");
}

/** La celda del taxón (la segunda columna) de una fila, ya sin marcado. */
export function celdaDelTaxon(html: string, clave: string): string {
  const patron = new RegExp(`<tr data-especie="${clave}"[^>]*>([\\s\\S]*?)</tr>`, "u");
  const fila = patron.exec(html)?.[1] ?? "";
  return textoDe(/<td>([\s\S]*?)<\/td>/u.exec(fila)?.[1] ?? "");
}

/**
 * Si un texto **nombra** a otro, y no si lo contiene.
 *
 * Hace falta porque las tres parejas que este pase encuentra se distinguen por una letra: «Mugil
 * spp» es subcadena de «Mugil spps», así que un `includes` daría por publicado un nombre que la
 * página no publica. La comparación es sensible a la caja **a propósito**: `Thunnus thynnus` y
 * `Thunnus Thynnus` son dos filas distintas del catálogo justo por eso.
 */
export function nombra(texto: string, nombre: string): boolean {
  const escapado = nombre.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?<!\\p{L})${escapado}(?!\\p{L})`, "u").test(texto);
}

// -------------------------------------------------------------------------------------------
// Construir el sitio contra un catálogo mutado, sin tocar el árbol de trabajo
// -------------------------------------------------------------------------------------------
//
// Es el mismo arnés que montaron T-19 y T-21 apuntando a otro fichero: `apps/web/src/datos/deps.ts`
// deja mandar a `MAREIA_DATA_DIR`, así que se levanta un `data/` efímero donde lo pesado va por
// enlace simbólico y sólo el fichero atacado es una copia mutada, y `astro build --outDir` escribe
// fuera del repositorio. Importa que no se toque el árbol: el `dist/` que sirve el `webServer` lo
// están leyendo otros recorridos a la vez.

/** Lo que se copia por enlace: es grande y ningún ataque de T-20 lo toca. */
const ENLAZADO = ["brest", "normativa", "stations", "geo"] as const;

/** Un `data/` efímero con el catálogo de especies ya mutado. El spec lo borra al terminar. */
export function dataDirEfimero(mutar: (catalogo: Record<string, unknown>) => void): string {
  const raiz = mkdtempSync(join(tmpdir(), "qa-adv-t20-"));
  for (const carpeta of ENLAZADO) {
    symlinkSync(join(RAIZ, "data", carpeta), join(raiz, carpeta), "dir");
  }
  mkdirSync(join(raiz, "especies"));
  const catalogo = JSON.parse(readFileSync(CATALOGO, "utf8")) as Record<string, unknown>;
  mutar(catalogo);
  writeFileSync(join(raiz, "especies", "catalogo.json"), JSON.stringify(catalogo), "utf8");
  return raiz;
}

/** Cómo salió una construcción del sitio. */
export interface Construccion {
  readonly codigo: number;
  readonly salida: string;
  readonly destino: string;
}

/**
 * Cerrojo entre construcciones: Playwright reparte los ficheros de spec entre varios workers y
 * `astro build` escribe en la caché de `apps/web`. Es **el mismo fichero** que usan los pases de
 * T-19 y T-21, y a propósito: con un cerrojo por pase los tres podrían construir a la vez, que es
 * justo lo que el cerrojo existe para impedir.
 */
function conCerrojo<T>(hacer: () => T): T {
  const cerrojo = join(tmpdir(), "qa-adv-t19-build.lock");
  const limite = Date.now() + 600_000;
  for (;;) {
    try {
      mkdirSync(cerrojo);
      break;
    } catch {
      if (Date.now() > limite) throw new Error("no se libera el cerrojo de construcción");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    }
  }
  try {
    return hacer();
  } finally {
    rmSync(cerrojo, { recursive: true, force: true });
  }
}

/**
 * Construye el sitio contra un `data/` dado y lo escribe fuera del repositorio.
 *
 * No lanza si el build falla: **el código de salida es parte de lo que se mide** —la pregunta del
 * ataque es justo si algo se pone rojo—, así que se devuelve en vez de convertirse en excepción.
 */
export function construirConDataDir(dataDir: string): Construccion {
  return conCerrojo(() => {
    const destino = mkdtempSync(join(tmpdir(), "qa-adv-t20-dist-"));
    const astro = join(RAIZ, "apps", "web", "node_modules", ".bin", "astro");
    try {
      const salida = execFileSync(astro, ["build", "--outDir", destino], {
        cwd: join(RAIZ, "apps", "web"),
        env: { ...process.env, MAREIA_DATA_DIR: dataDir },
        encoding: "utf8",
        stdio: "pipe",
      });
      return { codigo: 0, salida, destino };
    } catch (fallo) {
      const error = fallo as { status?: number; stdout?: string; stderr?: string };
      return { codigo: error.status ?? 1, salida: `${error.stdout ?? ""}\n${error.stderr ?? ""}`, destino };
    }
  });
}

/** Los gates del pipeline sobre un catálogo dado, tal y como los encadena `run.py check`. */
export function gatesDelPipeline(dataDir: string): string[] {
  const python = existsSync(join(RAIZ, "data", "pipeline", ".venv", "bin", "python"))
    ? join(RAIZ, "data", "pipeline", ".venv", "bin", "python")
    : "python3";
  const programa = [
    "import sys, json",
    "from pathlib import Path",
    "from mareia_pipeline import especies, normativa",
    "d = especies.cargar(Path(sys.argv[1]))",
    "t = normativa.cargar()",
    "print(json.dumps(",
    "    especies.errores_de_cobertura(d, t)",
    "    + especies.errores_de_mapeo(d)",
    "    + especies.errores_de_genero(d)",
    "    + especies.errores_de_clave(d)",
    "    + especies.errores_de_presencia(d)",
    "    + especies.errores_de_tallas(d, t)",
    "    + especies.errores_de_procedencia(d)",
    "))",
  ].join("\n");
  const salida = execFileSync(python, ["-c", programa, join(dataDir, "especies", "catalogo.json")], {
    cwd: join(RAIZ, "data", "pipeline"),
    encoding: "utf8",
  });
  return JSON.parse(salida) as string[];
}
