/**
 * Lo que comparten los ataques del pase adversario de T-21 (áreas marinas protegidas).
 *
 * La sección es **dato de build**: no hay endpoint que interceptar ni isla que hidratar, así que la
 * única forma de atacarla es cambiar lo único de lo que depende —el derivado
 * `data/geo/areas-protegidas.json`— y volver a construir. Es el mismo arnés que T-19 montó para las
 * tallas mínimas, apuntando a otro fichero: `apps/web/src/datos/deps.ts` deja mandar a
 * `MAREIA_DATA_DIR`, así que se levanta un `data/` efímero donde lo pesado va por enlace simbólico
 * y sólo el fichero atacado es una copia mutada, y `astro build --outDir` escribe fuera del repo.
 *
 * Que no se toque el árbol de trabajo importa por dos motivos que ya costaron caro en T-19: el
 * `dist/` que sirve el `webServer` de Playwright lo están leyendo otros recorridos a la vez, y un
 * ataque que deje el derivado estropeado al fallar convierte un hallazgo en una avería.
 *
 * No hay asserts aquí. Cada spec afirma en su cuerpo.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { RAIZ } from "./utiles";

/** El derivado de áreas protegidas, tal y como está commiteado. */
export const DATASET = join(RAIZ, "data", "geo", "areas-protegidas.json");

/** El catálogo de puertos: de aquí salen las rutas de las 153 páginas. */
const PORTS = join(RAIZ, "data", "geo", "ports.json");

/** Lo que se copia por enlace: es grande y ningún ataque de T-21 lo toca. */
const ENLAZADO = ["brest", "normativa", "stations"] as const;

/** Una relación puerto–área, en la forma en que la publica el derivado. */
export interface AreaPublicada {
  nombre: string;
  tipo: string;
  codigo: string;
  distanciaAproxKm: number;
  dentro: boolean;
}

/** Lo que el derivado dice de un puerto. */
export interface PuertoPublicado {
  slug: string;
  areas: AreaPublicada[];
  motivo: string | null;
}

/** El derivado `areas-protegidas/v1`, en la forma mínima que estos ataques necesitan tocar. */
export interface Derivado {
  schema: string;
  fuente: { aviso: string; [clave: string]: unknown };
  criterio: { radioKm: number; [clave: string]: unknown };
  comparativa: Record<string, unknown>;
  resumen: { puertos: number; conArea: number; sinArea: number; relaciones: number };
  puertos: PuertoPublicado[];
}

/** El derivado publicado, recién leído del disco. */
export function derivadoPublicado(): Derivado {
  return JSON.parse(readFileSync(DATASET, "utf8")) as Derivado;
}

/** Un puerto del derivado, por su slug. */
export function puertoDe(derivado: Derivado, slug: string): PuertoPublicado {
  const puerto = derivado.puertos.find((candidato) => candidato.slug === slug);
  if (puerto === undefined) throw new Error(`el derivado no publica el puerto ${slug}`);
  return puerto;
}

/** Una relación concreta de un puerto, por el código RAMPE del área. */
export function areaDe(puerto: PuertoPublicado, codigo: string): AreaPublicada {
  const area = puerto.areas.find((candidata) => candidata.codigo === codigo);
  if (area === undefined) throw new Error(`${puerto.slug} no publica el área ${codigo}`);
  return area;
}

interface FilaDelCatalogo {
  slug: string;
  name: string;
  region: { slug: string };
  province: { slug: string };
}

/** La ruta de la página de un puerto dentro del sitio, tal y como la construye Astro. */
export function rutaDePuerto(slug: string): string {
  const catalogo = JSON.parse(readFileSync(PORTS, "utf8")) as { ports: FilaDelCatalogo[] };
  const puerto = catalogo.ports.find((candidato) => candidato.slug === slug);
  if (puerto === undefined) throw new Error(`el catálogo no trae el puerto ${slug}`);
  return `mareas/${puerto.region.slug}/${puerto.province.slug}/${puerto.slug}`;
}

/**
 * Un `data/` efímero con el derivado ya mutado. Devuelve su ruta; el spec la borra al terminar.
 *
 * `geo/` es un directorio de verdad —no un enlace— porque es donde vive el fichero atacado;
 * `ports.json` viaja dentro por enlace, que es lo que hace que el catálogo siga siendo el mismo.
 */
export function dataDirEfimero(mutar: (derivado: Derivado) => void): string {
  const raiz = mkdtempSync(join(tmpdir(), "qa-adv-t21-"));
  for (const carpeta of ENLAZADO) {
    symlinkSync(join(RAIZ, "data", carpeta), join(raiz, carpeta), "dir");
  }
  mkdirSync(join(raiz, "geo"));
  symlinkSync(PORTS, join(raiz, "geo", "ports.json"));
  const derivado = derivadoPublicado();
  mutar(derivado);
  writeFileSync(join(raiz, "geo", "areas-protegidas.json"), JSON.stringify(derivado), "utf8");
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
 *
 * El fichero es **el mismo** que usa `utiles-normativa.ts`, y a propósito. Con un cerrojo por pase
 * los dos pueden construir a la vez, que es justo lo que el cerrojo existe para impedir: medido, un
 * `pnpm test:e2e` completo con los dos pases dejaba en rojo
 * `a2-sello-de-vigencia-que-no-caduca.spec.ts`, que en solitario pasa. El nombre se queda en
 * `qa-adv-t19-build.lock` porque renombrarlo obligaría a tocar el recorrido de otra trayectoria.
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
 * No lanza si el build falla: **el código de salida es parte de lo que se mide** —la pregunta de
 * varios de estos ataques es justo si algo se pone rojo—, así que se devuelve en vez de convertirse
 * en una excepción.
 */
export function construirConDataDir(dataDir: string): Construccion {
  return conCerrojo(() => {
    const destino = mkdtempSync(join(tmpdir(), "qa-adv-t21-dist-"));
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
export function paginaDePuerto(dist: string, slug: string): string | null {
  try {
    return readFileSync(join(dist, rutaDePuerto(slug), "index.html"), "utf8");
  } catch {
    return null;
  }
}

/** El trozo de HTML de la sección de áreas protegidas, y sólo ese. */
export function seccionDeAreas(html: string): string {
  const abre = html.indexOf('<section id="areas-protegidas"');
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

/** La fila de un área dentro de la sección, con su marcado. */
export function filaDe(seccion: string, codigo: string): string {
  const patron = new RegExp(`<tr data-area="${codigo}"[^>]*>([\\s\\S]*?)</tr>`, "u");
  return patron.exec(seccion)?.[1] ?? "";
}
