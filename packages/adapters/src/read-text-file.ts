/**
 * La única operación de entrada/salida que necesitan estos adaptadores, como función inyectable.
 *
 * Por defecto es `node:fs/promises`, que **Deno también implementa**: así el mismo adaptador sirve
 * a la API (Deno) y a los tests de los packages (Node) sin ramas por runtime. Y como es un
 * parámetro, un test puede pasar una lectura de memoria y no tocar el disco.
 */

import { readFile } from "node:fs/promises";

export type ReadTextFile = (filePath: string) => Promise<string>;

export const readTextFileFromDisk: ReadTextFile = (filePath) => readFile(filePath, "utf8");
