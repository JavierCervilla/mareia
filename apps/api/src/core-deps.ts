/**
 * Composition root de las dependencias del **core**: dónde está el dataset y quién lo lee.
 *
 * Es el único sitio del proceso que sabe que los puertos y las estaciones son ficheros JSON en
 * `data/`. Los casos de uso reciben ya las implementaciones; el motor de efemérides entra igual,
 * por la interfaz `AstronomyGateway`.
 *
 * La ruta se resuelve desde `import.meta.url` y **no desde el cwd**: la API se arranca desde
 * `apps/api` en desarrollo, desde la raíz en un contenedor y desde donde sea en los tests, y el
 * dataset está siempre en el mismo sitio respecto de este fichero.
 */

import { createPortsJsonRepository, createStationsJsonRepository } from "@mareia/adapters";
import { astronomyEngineGateway } from "@mareia/domain-core";
import type { UseCaseDeps } from "@mareia/usecases";
import { fileURLToPath } from "node:url";

/** Raíz del dataset commiteado (`<repo>/data`), sin barra final. */
export const DATA_DIR = fileURLToPath(new URL("../../../data", import.meta.url));

/**
 * Dependencias de producción. Se construyen una vez por proceso: los repositorios cachean en
 * memoria, así que crear dos juegos sería releer el dataset entero.
 */
export function createCoreDeps(dataDir: string = DATA_DIR): UseCaseDeps {
  return {
    ports: createPortsJsonRepository({ filePath: `${dataDir}/geo/ports.json` }),
    stations: createStationsJsonRepository({ directory: `${dataDir}/stations` }),
    astronomy: astronomyEngineGateway,
    now: () => Date.now(),
  };
}
