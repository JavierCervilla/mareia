/**
 * `StationRepository` sobre `data/stations/<id>.json` (schema `station/v1`).
 *
 * Como el de puertos: directorio inyectado y caché en memoria, aquí por fichero, porque una
 * instancia sirve varios puertos y no tiene sentido releer el mismo JSON en cada petición.
 *
 * La traducción del fichero al `StationRecord` de la capa de aplicación vive aquí y no en el caso
 * de uso: `source.attribution` → `attributions`, `quality` con sus `null` intactos. El caso de uso
 * no sabe cómo está guardado el dataset.
 */

import type {
  SourceAttribution,
  StationQuality,
  StationRecord,
  StationRepository,
} from "@mareia/usecases";
import type { StationConstituent } from "@mareia/domain-core";

import { JsonReader } from "./json-parse.ts";
import { readTextFileFromDisk, type ReadTextFile } from "./read-text-file.ts";

export interface StationsJsonOptions {
  /** Directorio absoluto que contiene los `<id>.json`. */
  readonly directory: string;
  /** Lectura inyectable; por defecto, disco. */
  readonly readTextFile?: ReadTextFile;
}

const SCHEMA = "station/v1";

/**
 * Nombres de fichero admitidos. El nombre viene de nuestro propio `ports.json`, pero un repositorio
 * que concatena rutas sin mirar es un travesía de directorios esperando a que alguien conecte la
 * entrada del usuario: se rechaza aquí, donde la regla es una sola línea.
 */
const STATION_FILE_PATTERN = /^[a-z0-9-]+\.json$/;

function readConstituent(reader: JsonReader, value: unknown, index: number): StationConstituent {
  const path = `$.constituents[${index}]`;
  const constituent = reader.record(value, path);
  return {
    name: reader.string(constituent, "name", path),
    amplitude_m: reader.number(constituent, "amplitude_m", path),
    phase_deg: reader.number(constituent, "phase_deg", path),
  };
}

function readQuality(reader: JsonReader, document: Record<string, unknown>): StationQuality {
  const path = "$.quality";
  const quality = reader.child(document, "quality", "$");
  return {
    grade: reader.string(quality, "grade", path),
    rmse_m: reader.nullableNumber(quality, "rmse_m", path),
    hw_time_err_p95_min: reader.nullableNumber(quality, "hw_time_err_p95_min", path),
    grade_reason: reader.nullableString(quality, "grade_reason", path),
    validated_against: reader.nullableString(quality, "validated_against", path),
  };
}

function readAttributions(
  reader: JsonReader,
  document: Record<string, unknown>,
): readonly SourceAttribution[] {
  const source = reader.child(document, "source", "$");
  return reader.array(source, "attribution", "$.source").map((value, index) => {
    const path = `$.source.attribution[${index}]`;
    const attribution = reader.record(value, path);
    return {
      name: reader.string(attribution, "name", path),
      url: reader.string(attribution, "url", path),
      license: reader.string(attribution, "license", path),
      license_url: reader.nullableString(attribution, "license_url", path),
      role: reader.nullableString(attribution, "role", path),
    };
  });
}

export function createStationsJsonRepository(options: StationsJsonOptions): StationRepository {
  const { directory } = options;
  const readTextFile = options.readTextFile ?? readTextFileFromDisk;
  const cache = new Map<string, Promise<StationRecord>>();

  const load = async (stationFile: string): Promise<StationRecord> => {
    const filePath = `${directory}/${stationFile}`;
    const reader = new JsonReader(filePath);
    const document = reader.parse(await readTextFile(filePath));
    const schema = reader.string(document, "schema", "$");
    if (schema !== SCHEMA) {
      reader.fail(`$.schema debería ser ${JSON.stringify(SCHEMA)} y es ${JSON.stringify(schema)}`);
    }
    const datum = reader.child(document, "datum", "$");
    return {
      schema: SCHEMA,
      id: reader.string(document, "id", "$"),
      name: reader.string(document, "name", "$"),
      lat: reader.number(document, "lat", "$"),
      lon: reader.number(document, "lon", "$"),
      timezone: reader.string(document, "timezone", "$"),
      datum: {
        reference: reader.string(datum, "reference", "$.datum"),
        msl_offset_m: reader.number(datum, "msl_offset_m", "$.datum"),
      },
      constituents: reader
        .array(document, "constituents", "$")
        .map((value, index) => readConstituent(reader, value, index)),
      quality: readQuality(reader, document),
      attributions: readAttributions(reader, document),
    };
  };

  return {
    load: (stationFile) => {
      if (!STATION_FILE_PATTERN.test(stationFile)) {
        return Promise.reject(
          new RangeError(`Nombre de fichero de estación no admitido: ${JSON.stringify(stationFile)}`),
        );
      }
      const cached = cache.get(stationFile);
      if (cached !== undefined) {
        return cached;
      }
      const pending = load(stationFile).catch((cause: unknown) => {
        cache.delete(stationFile);
        throw cause;
      });
      cache.set(stationFile, pending);
      return pending;
    },
  };
}
