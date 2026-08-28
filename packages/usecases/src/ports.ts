/**
 * Casos de uso del catálogo: qué puertos hay y qué se sabe de uno.
 */

import { toPortDto, toStationDto } from "./dto.ts";
import type { PortDto, StationDto } from "./dto.ts";
import { resolveStation } from "./resolve.ts";
import type { Port, UseCaseDeps } from "./types.ts";

/**
 * Orden alfabético **en español**: con `<` o con el orden por defecto, «Á» va detrás de «Z» y
 * «Andalucía» acabaría después de «País Vasco». El colador se construye una vez porque crearlo es
 * caro y el catálogo se ordena en cada petición.
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

/** Respuesta de `listPorts`: el catálogo completo, ordenado por región, provincia y puerto. */
export interface ListPortsResult {
  readonly ports: readonly PortDto[];
}

/** Respuesta de `getPort`: la ficha del puerto con la procedencia y la calidad de su estación. */
export interface GetPortResult {
  readonly port: PortDto;
  readonly station: StationDto;
}

export async function listPorts(deps: UseCaseDeps): Promise<ListPortsResult> {
  const ports = await deps.ports.list();
  // Copia antes de ordenar: lo que devuelve el repositorio es su caché, no un array de usar y tirar.
  return { ports: [...ports].sort(byGeography).map(toPortDto) };
}

export async function getPort(deps: UseCaseDeps, slug: string): Promise<GetPortResult> {
  const { port, station } = await resolveStation(deps, slug);
  return { port: toPortDto(port), station: toStationDto(station) };
}
