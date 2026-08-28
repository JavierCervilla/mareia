/**
 * `PortRepository` sobre `data/geo/ports.json`.
 *
 * La ruta se inyecta (no se deduce del cwd ni se incrusta): quien decide dónde está el dataset es
 * el composition root. El fichero se lee **una vez** y se cachea en memoria: es contenido
 * commiteado que no cambia mientras el proceso vive, y el catálogo se consulta en cada petición.
 */

import type { GeoSegment, Port, PortRepository } from "@mareia/usecases";

import { JsonReader } from "./json-parse.ts";
import { readTextFileFromDisk, type ReadTextFile } from "./read-text-file.ts";

export interface PortsJsonOptions {
  /** Ruta absoluta del `ports.json`. */
  readonly filePath: string;
  /** Lectura inyectable; por defecto, disco. */
  readonly readTextFile?: ReadTextFile;
}

const SCHEMA = "ports/v1";

function readSegment(reader: JsonReader, source: Record<string, unknown>, key: string, path: string): GeoSegment {
  const segment = reader.child(source, key, path);
  const at = `${path}.${key}`;
  return { slug: reader.string(segment, "slug", at), name: reader.string(segment, "name", at) };
}

function readPort(reader: JsonReader, value: unknown, index: number): Port {
  const path = `$.ports[${index}]`;
  const port = reader.record(value, path);
  return {
    slug: reader.string(port, "slug", path),
    name: reader.string(port, "name", path),
    province: readSegment(reader, port, "province", path),
    region: readSegment(reader, port, "region", path),
    lat: reader.number(port, "lat", path),
    lon: reader.number(port, "lon", path),
    timezone: reader.string(port, "timezone", path),
    stationFile: reader.string(port, "stationFile", path),
  };
}

export function createPortsJsonRepository(options: PortsJsonOptions): PortRepository {
  const { filePath } = options;
  const readTextFile = options.readTextFile ?? readTextFileFromDisk;
  let cached: Promise<readonly Port[]> | undefined;

  const load = async (): Promise<readonly Port[]> => {
    const reader = new JsonReader(filePath);
    const document = reader.parse(await readTextFile(filePath));
    const schema = reader.string(document, "schema", "$");
    if (schema !== SCHEMA) {
      reader.fail(`$.schema debería ser ${JSON.stringify(SCHEMA)} y es ${JSON.stringify(schema)}`);
    }
    return reader.array(document, "ports", "$").map((value, index) => readPort(reader, value, index));
  };

  const all = (): Promise<readonly Port[]> => {
    if (cached === undefined) {
      // Un fallo no se cachea: si el disco falló una vez, la siguiente petición vuelve a intentarlo.
      cached = load().catch((cause: unknown) => {
        cached = undefined;
        throw cause;
      });
    }
    return cached;
  };

  return {
    list: all,
    findBySlug: async (slug) => (await all()).find((port) => port.slug === slug),
  };
}
