/**
 * El catálogo de puertos visto como **jerarquía geográfica**: región → provincia → puerto, que es
 * la forma que tienen las URL del portal y los índices que llevan a ellas.
 *
 * El dato sale del caso de uso `listPorts` (el mismo que sirve `/v1/ports`); aquí solo se agrupa y
 * se ordena. El orden es alfabético **en español** (`localeCompare` con acentos y con la Ñ en su
 * sitio) y es estable: dos builds del mismo dataset producen los mismos índices.
 */

import { listPorts } from "@mareia/usecases";
import type { PortSummaryDto } from "@mareia/usecases";

import { deps } from "./deps.ts";

export interface Provincia {
  readonly slug: string;
  readonly nombre: string;
  readonly puertos: readonly PortSummaryDto[];
}

export interface Region {
  readonly slug: string;
  readonly nombre: string;
  readonly provincias: readonly Provincia[];
}

const enEspanol = (a: string, b: string): number => a.localeCompare(b, "es");

/**
 * El catálogo completo, tal y como lo publica el caso de uso: cada puerto con su calidad (T-14B),
 * que es lo que la portada necesita para decir de cuáles está medida la marea y para filtrarlos.
 */
export async function cargarPuertos(): Promise<readonly PortSummaryDto[]> {
  const { ports } = await listPorts(deps);
  return [...ports].sort((a, b) => enEspanol(a.name, b.name));
}

function agruparPorProvincia(puertos: readonly PortSummaryDto[]): readonly Provincia[] {
  const provincias = new Map<string, PortSummaryDto[]>();
  for (const puerto of puertos) {
    const grupo = provincias.get(puerto.province.slug);
    if (grupo === undefined) {
      provincias.set(puerto.province.slug, [puerto]);
    } else {
      grupo.push(puerto);
    }
  }
  return [...provincias.entries()]
    .map(([slug, grupo]) => ({
      slug,
      nombre: grupo[0]?.province.name ?? slug,
      puertos: [...grupo].sort((a, b) => enEspanol(a.name, b.name)),
    }))
    .sort((a, b) => enEspanol(a.nombre, b.nombre));
}

/** Regiones con sus provincias y sus puertos, todo ordenado alfabéticamente en español. */
export async function cargarCatalogo(): Promise<readonly Region[]> {
  const puertos = await cargarPuertos();
  const regiones = new Map<string, PortSummaryDto[]>();
  for (const puerto of puertos) {
    const grupo = regiones.get(puerto.region.slug);
    if (grupo === undefined) {
      regiones.set(puerto.region.slug, [puerto]);
    } else {
      grupo.push(puerto);
    }
  }
  return [...regiones.entries()]
    .map(([slug, grupo]) => ({
      slug,
      nombre: grupo[0]?.region.name ?? slug,
      provincias: agruparPorProvincia(grupo),
    }))
    .sort((a, b) => enEspanol(a.nombre, b.nombre));
}

/** Cuántos puertos cuelgan de una región (para no repetir el `flatMap` en cada índice). */
export function puertosDeRegion(region: Region): readonly PortSummaryDto[] {
  return region.provincias.flatMap((provincia) => provincia.puertos);
}
