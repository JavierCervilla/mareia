/**
 * Carga de los fixtures del coeficiente. Es código de test: lee ficheros, cosa que el dominio no
 * hace nunca —los constituyentes entran al módulo por parámetro, y este es el parámetro—.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TideStation } from "../../tides/types.ts";

/** `packages/domain-core/src/coefficient/__tests__` → raíz del repositorio. */
const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..", "..");

/** Coeficientes publicados de un día civil, en orden cronológico (uno por pleamar). */
export interface PublishedDay {
  readonly dateIso: string;
  readonly coefficients: readonly number[];
}

interface PublishedFixture {
  readonly timeZone: string;
  readonly unitHeight_m: number;
  readonly toleranceUnits: number;
  readonly days: readonly PublishedDay[];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/**
 * Las constantes armónicas de Brest que emitió el pipeline (TICON-4). Es el puerto de referencia
 * de la escala: `data/brest/` vive aparte del catálogo justo por esto.
 */
export function loadBrestStation(): TideStation {
  return readJson<TideStation>(join(REPO_ROOT, "data", "brest", "constituents.json"));
}

/** Coeficientes publicados de 2026 con los que se contrasta el cálculo (ver `fixtures/README.md`). */
export function loadPublishedCoefficients(): PublishedFixture {
  return readJson<PublishedFixture>(join(import.meta.dirname, "fixtures", "brest-2026-published.json"));
}
