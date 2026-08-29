/**
 * Casos de uso del catálogo: qué puertos hay y qué se sabe de uno.
 */

import { toPortDto, toPortSummaryDto, toStationDto } from "./dto.ts";
import type { PortDto, PortSummaryDto, StationDto } from "./dto.ts";
import { resolveStation } from "./resolve.ts";
import type { Port, UseCaseDeps } from "./types.ts";

/**
 * Orden alfabético **en español**: comparar con `<` compara unidades de código, así que «Á» (U+00C1)
 * va detrás de «Z» y «Águilas» acabaría después de «Zumaia» —y la «ñ», detrás de la «z», en vez de
 * entre la «n» y la «o»—. El colador se construye una vez porque crearlo es caro y el catálogo se
 * ordena en cada petición.
 */
const SPANISH = new Intl.Collator("es");

/**
 * Orden de publicación del catálogo: región, luego provincia, luego puerto.
 *
 * Vive en el caso de uso y no en el dataset ni en cada superficie: `ports.json` está escrito a mano
 * (y un puerto nuevo se añade al final), y la web, el API y lo que venga después deben enseñar la
 * misma lista en el mismo orden sin ponerse de acuerdo.
 */
function byGeography(left: Port, right: Port): number {
  return (
    SPANISH.compare(left.region.name, right.region.name) ||
    SPANISH.compare(left.province.name, right.province.name) ||
    SPANISH.compare(left.name, right.name)
  );
}

/**
 * Respuesta de `listPorts`: el catálogo completo, ordenado por región, provincia y puerto, y con la
 * calidad medida de cada uno (T-14B).
 */
export interface ListPortsResult {
  readonly ports: readonly PortSummaryDto[];
}

/** Respuesta de `getPort`: la ficha del puerto con la procedencia y la calidad de su estación. */
export interface GetPortResult {
  readonly port: PortDto;
  readonly station: StationDto;
}

/**
 * El catálogo entero, cada puerto con su calidad.
 *
 * Leer la estación de cada puerto es lo que hace que el catálogo se pueda **filtrar en una sola
 * petición** en vez de en 153, y cuesta poco: el repositorio de estaciones cachea por fichero, así
 * que el dataset se lee una vez por proceso y las peticiones siguientes salen de memoria.
 *
 * Si la estación de un puerto no se puede leer, esto falla entero en vez de servir ese puerto sin
 * calidad. Es deliberado: un catálogo que lista un puerto del que no sabe decir si está medido es
 * exactamente el problema que esta trayectoria vino a quitar, y disimularlo con un hueco lo
 * devuelve callando.
 */
export async function listPorts(deps: UseCaseDeps): Promise<ListPortsResult> {
  const ports = await deps.ports.list();
  // Copia antes de ordenar: lo que devuelve el repositorio es su caché, no un array de usar y tirar.
  const ordenados = [...ports].sort(byGeography);
  return {
    ports: await Promise.all(
      ordenados.map(async (port) =>
        toPortSummaryDto(port, await deps.stations.load(port.stationFile)),
      ),
    ),
  };
}

export async function getPort(deps: UseCaseDeps, slug: string): Promise<GetPortResult> {
  const { port, station } = await resolveStation(deps, slug);
  return { port: toPortDto(port), station: toStationDto(station) };
}
