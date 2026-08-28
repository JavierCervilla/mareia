/**
 * Resolución del puerto y su estación: el primer paso de los cinco casos de uso que hablan de un
 * puerto concreto. Vive aparte para que «slug desconocido = `PortNotFoundError`» esté escrito una
 * sola vez y ninguno pueda olvidarse de comprobarlo.
 */

import { PortNotFoundError } from "./errors.ts";
import type { Port, StationRecord, UseCaseDeps } from "./types.ts";

export async function resolvePort(deps: UseCaseDeps, slug: string): Promise<Port> {
  const port = await deps.ports.findBySlug(slug);
  if (port === undefined) {
    throw new PortNotFoundError(slug);
  }
  return port;
}

/** El puerto y sus constantes armónicas, en una sola lectura para quien necesita las dos cosas. */
export async function resolveStation(
  deps: UseCaseDeps,
  slug: string,
): Promise<{ readonly port: Port; readonly station: StationRecord }> {
  const port = await resolvePort(deps, slug);
  return { port, station: await deps.stations.load(port.stationFile) };
}
