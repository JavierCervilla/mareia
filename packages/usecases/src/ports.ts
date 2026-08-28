/**
 * Casos de uso del catálogo: qué puertos hay y qué se sabe de uno.
 */

import { toPortDto, toStationDto } from "./dto.ts";
import type { PortDto, StationDto } from "./dto.ts";
import { resolveStation } from "./resolve.ts";
import type { UseCaseDeps } from "./types.ts";

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
  return { ports: ports.map(toPortDto) };
}

export async function getPort(deps: UseCaseDeps, slug: string): Promise<GetPortResult> {
  const { port, station } = await resolveStation(deps, slug);
  return { port: toPortDto(port), station: toStationDto(station) };
}
