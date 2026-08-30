/**
 * Lo que comparten los ataques del pase adversario de T-19 (tallas mínimas del BOE).
 *
 * La sección de tallas es **dato de build**: no hay red que interceptar ni isla que engañar, así
 * que la única forma de atacarla es cambiar lo único de lo que depende —el dataset
 * `data/normativa/tallas-minimas.json`— y volver a construir. Estos ayudantes hacen eso **sin
 * tocar el árbol de trabajo**: `apps/web/src/datos/deps.ts` deja mandar a `MAREIA_DATA_DIR`, así
 * que se levanta un `data/` efímero con enlaces simbólicos a lo pesado (`stations`, `geo`,
 * `brest`) y una copia mutada del único fichero que interesa, y `astro build --outDir` escribe en
 * un directorio de usar y tirar.
 *
 * Que no se toque el repo importa por dos motivos: el `dist/` que sirve el `webServer` de
 * Playwright lo están leyendo otros recorridos a la vez, y un ataque que deje el dataset
 * estropeado al fallar convierte un hallazgo en una avería.
 *
 * No hay asserts aquí. Cada spec afirma en su cuerpo.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { RAIZ } from "./utiles";

/** El dataset de normativa, tal y como está commiteado. */
export const DATASET = join(RAIZ, "data", "normativa", "tallas-minimas.json");

/**
 * Lo que se copia por enlace: es grande y ningún ataque lo toca.
 *
 * Es **todo lo que el sitio necesita para construirse** menos lo que este pase ataca, así que un
 * dataset nuevo se añade aquí o el `astro build` de estos recorridos se queda sin él. `especies`
 * entró con T-20: la sección del catálogo la pintan las 153 páginas de puerto, así que sin ese
 * directorio la construcción efímera aborta con un ENOENT y el rojo deja de ser del defecto que se
 * está atacando.
 */
const ENLAZADO = ["geo", "stations", "brest", "especies"] as const;

/** El dataset ya parseado, en la forma mínima que estos ataques necesitan tocar. */
export interface Normativa {
  fuente: { verificadoEn: string; [clave: string]: unknown };
  caladeros: {
    id: string;
    notas: { marca: string; texto: string }[];
    especies: {
      nombreComun: string;
      textoOriginal: string;
      notas: string[];
      talla: Record<string, unknown>;
      [clave: string]: unknown;
    }[];
  }[];
}

/** El dataset publicado, recién leído del disco. */
export function datasetPublicado(): Normativa {
  return JSON.parse(readFileSync(DATASET, "utf8")) as Normativa;
}

/** Una especie concreta del dataset, por caladero y nombre común. */
export function especieDe(
  normativa: Normativa,
  caladero: string,
  nombreComun: string,
): Normativa["caladeros"][number]["especies"][number] {
  const tabla = normativa.caladeros.find((candidato) => candidato.id === caladero);
  if (tabla === undefined) throw new Error(`el dataset no publica el caladero ${caladero}`);
  const especie = tabla.especies.find((candidata) => candidata.nombreComun === nombreComun);
  if (especie === undefined) throw new Error(`${caladero} no publica ${nombreComun}`);
  return especie;
}

/**
 * Un `data/` efímero con el dataset ya mutado. Devuelve su ruta; el spec la borra al terminar.
 *
 * Lo demás del catálogo viaja por enlace simbólico: 154 estaciones copiadas por cada ataque serían
 * medio minuto de disco para no cambiar ni un byte de ellas.
 */
export function dataDirEfimero(mutar: (normativa: Normativa) => void): string {
  const raiz = mkdtempSync(join(tmpdir(), "qa-adv-t19-"));
  for (const carpeta of ENLAZADO) {
    symlinkSync(join(RAIZ, "data", carpeta), join(raiz, carpeta), "dir");
  }
  mkdirSync(join(raiz, "normativa"));
  const normativa = datasetPublicado();
  mutar(normativa);
  writeFileSync(join(raiz, "normativa", "tallas-minimas.json"), JSON.stringify(normativa), "utf8");
  return raiz;
}

/** Cómo salió una construcción del sitio. */
export interface Construccion {
  readonly codigo: number;
  readonly salida: string;
  /** Directorio donde se escribió, ya haya terminado o no. */
  readonly destino: string;
}

/**
 * Cerrojo entre construcciones. Playwright reparte los ficheros de spec entre varios workers y
 * `astro build` escribe en la caché de `apps/web`: dos a la vez se pisan y el rojo dejaría de ser
 * del defecto. `mkdirSync` es atómico, que es todo lo que hace falta.
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
 * Construye el sitio contra un `data/` dado y lo escribe fuera del repo.
 *
 * No lanza si el build falla: **el código de salida es parte de lo que se mide** (hay un ataque que
 * va justo de eso), así que se devuelve en vez de convertirse en una excepción.
 */
export function construirConDataDir(dataDir: string): Construccion {
  return conCerrojo(() => {
    const destino = mkdtempSync(join(tmpdir(), "qa-adv-t19-dist-"));
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
      return {
        codigo: error.status ?? 1,
        salida: `${error.stdout ?? ""}\n${error.stderr ?? ""}`,
        destino,
      };
    }
  });
}

/** La página de un puerto dentro de un `dist/`, o `null` si ese build no la publicó. */
export function paginaDePuerto(dist: string, ruta: string): string | null {
  try {
    return readFileSync(join(dist, ruta, "index.html"), "utf8");
  } catch {
    return null;
  }
}

/** El trozo de HTML de la sección de tallas mínimas, y solo ese. */
export function seccionDeTallas(html: string): string {
  const abre = html.indexOf('<section id="tallas-minimas"');
  if (abre < 0) return "";
  const cierra = html.indexOf("</section>", abre);
  return cierra > abre ? html.slice(abre, cierra) : "";
}

/** Lo que el navegador leería: sin marcado, con las entidades resueltas y con espacios normales. */
export function textoDe(fragmento: string): string {
  return fragmento
    .replace(/<[^>]*>/gu, " ")
    .replace(/&#39;/gu, "'")
    .replace(/&quot;/gu, '"')
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&")
    .replace(/\s+/gu, " ")
    .trim();
}

/** La fila de una especie dentro de la sección, con su marcado. */
export function filaDe(seccion: string, clave: string): string {
  const patron = new RegExp(`<tr data-especie="${clave}">([\\s\\S]*?)</tr>`, "u");
  return patron.exec(seccion)?.[1] ?? "";
}
