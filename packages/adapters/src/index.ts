/**
 * Adaptadores de salida: las implementaciones de los puertos de `@mareia/usecases` sobre el
 * dataset commiteado en `data/`. Aquí vive el conocimiento de **cómo** está guardado el dato
 * (ficheros JSON, nombres de campo, caché); ni el dominio ni los casos de uso lo saben.
 */

export const PACKAGE = "adapters" as const;

export { DatasetFormatError } from "./json-parse.ts";
export type { ReadTextFile } from "./read-text-file.ts";
export { readTextFileFromDisk } from "./read-text-file.ts";

export type { PortsJsonOptions } from "./ports-json.ts";
export { createPortsJsonRepository } from "./ports-json.ts";

export type { StationsJsonOptions } from "./stations-json.ts";
export { createStationsJsonRepository } from "./stations-json.ts";
