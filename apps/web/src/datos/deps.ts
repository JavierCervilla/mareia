/**
 * Composition root del **build del sitio**: quién lee el dataset y con qué motor de efemérides,
 * para que las páginas puedan llamar a los casos de uso sin saber nada de ficheros.
 *
 * Es el gemelo de `apps/api/src/core-deps.ts` y **no se importa de allí a propósito**: aquel es el
 * composition root de un proceso Deno de larga vida y éste el de un build de Node que arranca y
 * muere. Lo que comparten —el dominio y los casos de uso— ya está compartido de verdad
 * (`@mareia/usecases` + `@mareia/adapters`); duplicar cinco líneas de cableado es más barato que
 * acoplar el build de la web al arranque del API.
 *
 * La raíz del dataset **se busca subiendo desde el cwd** hasta encontrar `data/geo/ports.json`, y no
 * se calcula desde `import.meta.url` como en la API. El motivo es del build: Astro empaqueta este
 * módulo dentro de `dist/.prerender/chunks/`, así que en tiempo de generación `import.meta.url`
 * apunta al bundle y no al fuente — una ruta relativa desde ahí daba `apps/data` (comprobado: el
 * build falló con ENOENT antes de que existiera esta búsqueda). Subir desde el cwd funciona igual
 * si se construye desde `apps/web`, desde la raíz del repo o desde un test, y `MAREIA_DATA_DIR`
 * sigue mandando cuando el dataset esté en otro sitio (un contenedor, por ejemplo).
 */

import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";

import { createPortsJsonRepository, createStationsJsonRepository } from "@mareia/adapters";
import { astronomyEngineGateway } from "@mareia/domain-core";
import type { StationRecord, UseCaseDeps } from "@mareia/usecases";

/** Fichero que identifica la raíz del dataset: si está, `data/` es el bueno. */
const MARCADOR = join("data", "geo", "ports.json");

/**
 * Busca `data/` subiendo directorio a directorio desde `desde`.
 *
 * @throws {Error} si no aparece antes de la raíz del sistema de ficheros. Falla ruidoso: sin
 * dataset no hay páginas, y un build que continúa con el catálogo vacío publicaría un sitio sin
 * puertos y en verde.
 */
export function localizarDataDir(desde: string = process.cwd()): string {
  const raiz = parse(desde).root;
  let candidato = desde;
  while (true) {
    if (existsSync(join(candidato, MARCADOR))) {
      return join(candidato, "data");
    }
    if (candidato === raiz) {
      throw new Error(
        `No encuentro el dataset: he subido desde ${JSON.stringify(desde)} hasta la raíz sin dar ` +
          `con ${MARCADOR}. Define MAREIA_DATA_DIR si vive fuera del repositorio.`,
      );
    }
    candidato = dirname(candidato);
  }
}

/** Raíz del dataset commiteado (`<repo>/data`), sin barra final. */
export const DATA_DIR = process.env["MAREIA_DATA_DIR"] ?? localizarDataDir();

/**
 * Fichero de constantes armónicas de Brest, el puerto de referencia de la escala francesa de
 * coeficientes. Vive fuera de `data/stations` porque **no es un puerto del catálogo**: no tiene
 * página ni aparece en `ports.json` (lo comprueba `packages/adapters/src/__tests__/dataset.test.ts`).
 */
const BREST_DIR = `${DATA_DIR}/brest`;
const BREST_FILE = "constituents.json";

/**
 * Dependencias del build. Se construyen **una vez por proceso** y se reutilizan en las 12 páginas:
 * los repositorios cachean en memoria, así que un juego por página releería el dataset entero.
 *
 * `now` no lo usa ninguna de las páginas —el día que se publica lo fija `BUILD_DATE`, no el reloj,
 * para que el build sea reproducible— pero el contrato `UseCaseDeps` lo exige y `getAlmanac` lo
 * usará cuando la PWA (T-12) precachee el año.
 */
export function crearDepsDeBuild(dataDir: string = DATA_DIR): UseCaseDeps {
  return {
    ports: createPortsJsonRepository({ filePath: `${dataDir}/geo/ports.json` }),
    stations: createStationsJsonRepository({ directory: `${dataDir}/stations` }),
    astronomy: astronomyEngineGateway,
    now: () => Date.now(),
  };
}

/** Las dependencias del build, compartidas por todas las páginas del sitio. */
export const deps: UseCaseDeps = crearDepsDeBuild();

const brest = createStationsJsonRepository({ directory: BREST_DIR });

/** Constantes armónicas de Brest, con la misma caché en memoria que las demás estaciones. */
export function cargarEstacionDeReferencia(): Promise<StationRecord> {
  return brest.load(BREST_FILE);
}
