/**
 * Adaptador de **AEMET Open Data**: el boletín marítimo costero de una zona.
 *
 * AEMET sirve en dos pasos: la primera llamada devuelve un sobre con una URL temporal (`datos`) y
 * la segunda trae el documento. Se implementan los dos aquí porque para el resto del módulo esto es
 * una sola fuente.
 *
 * **La API key nunca viaja en la URL**: va en la cabecera `api_key`. Una query string acaba en los
 * logs del proxy, en el `reason` de un error y en el historial del navegador de quien depure; una
 * cabecera, no. Y si no hay clave, el adaptador **no inventa nada**: falla con un motivo explícito
 * y `resolveSource` lo traduce a `status: "unavailable"`. Sin clave el módulo degrada, no rompe.
 *
 * TODO(T-08): los códigos de zona de `aemet-zones.json` son los códigos INE de provincia y están
 * sin verificar (`verified: false`) porque el catálogo de zonas de AEMET solo se consulta con una
 * API key y este repositorio no tiene ninguna. Con una clave: llamar a
 * `/prediccion/maritima/costera/costa/{code}` para las 11 zonas, comprobar el `nombre` que devuelve
 * y poner `verified: true`. Es un cambio de datos, no de código.
 */

import { WeatherSourceError } from "./errors.ts";
import { asRecord, fetchJson, requiredString } from "./http-json.ts";
import type { CoastalZone } from "./zones.ts";

/** Raíz de la API de AEMET Open Data. Inyectable para poder apuntar a un doble en un test. */
export const AEMET_BASE_URL = "https://opendata.aemet.es/opendata/api";

/** Atribución exigida por la nota legal de AEMET. */
export const AEMET_ATTRIBUTION = {
  name: "AEMET — Agencia Estatal de Meteorología",
  url: "https://www.aemet.es/es/nota_legal",
  license: "Uso condicionado al reconocimiento de AEMET como autora de los datos",
} as const;

/** Milisegundos de espera: AEMET tarda más que Open-Meteo y son dos saltos. */
const AEMET_TIMEOUT_MS = 10_000;

const LABEL = "AEMET boletín costero";

/** Boletín costero tal y como lo publica el módulo. */
export interface CoastalBulletin {
  /** Zona a la que corresponde el boletín. */
  readonly zone: CoastalZone;
  /** Instante de elaboración declarado por AEMET, ISO, o `null` si el documento no lo trae. */
  readonly issuedAt: string | null;
  /**
   * El documento de AEMET **tal cual**, sin re-modelar.
   *
   * Es deliberado: el esquema del boletín costero no se puede verificar sin API key, así que
   * inventar aquí un modelo propio sería adivinar. Se pasa el documento y se marca como `unknown`
   * para que ningún consumidor asuma una forma que no hemos comprobado. Cuando haya clave y el
   * esquema esté verificado, se normaliza (y ese cambio se ve en un test, no en producción).
   */
  readonly document: unknown;
}

export interface AemetDeps {
  readonly fetch: typeof fetch;
  /** Clave de AEMET Open Data. `undefined` = la API no la tiene configurada; se degrada. */
  readonly apiKey?: string | undefined;
  readonly baseUrl?: string | undefined;
}

/**
 * Descarga el documento de la URL temporal y lo decodifica con **el charset que declare**.
 *
 * AEMET sirve buena parte de sus documentos en ISO-8859-15: leerlos como UTF-8 convierte cada
 * «Cádiz» en «CÃ¡diz». `Response.json()` asume siempre UTF-8, así que aquí se lee en crudo y se
 * decodifica a mano.
 */
async function readDocument(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const declared = /charset=\s*"?([\w-]+)/iu.exec(contentType)?.[1] ?? "utf-8";
  const bytes = await response.arrayBuffer();
  let text: string;
  try {
    text = new TextDecoder(declared).decode(bytes);
  } catch {
    text = new TextDecoder().decode(bytes);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new WeatherSourceError(`${LABEL} devolvió un documento que no es JSON`);
  }
}

/**
 * Instante de elaboración, buscado donde AEMET suele ponerlo.
 *
 * Es best-effort **a propósito**: sin clave no se puede verificar el esquema, y un `null` honesto
 * es mejor que una fecha inventada. El documento completo viaja igualmente en `document`.
 */
function issuedAtFrom(document: unknown): string | null {
  const first = Array.isArray(document) ? document[0] : document;
  if (typeof first !== "object" || first === null) {
    return null;
  }
  const record = first as Record<string, unknown>;
  const origin = typeof record["origen"] === "object" && record["origen"] !== null
    ? (record["origen"] as Record<string, unknown>)
    : {};
  const raw = record["elaborado"] ?? origin["elaborado"] ?? record["fechaElaboracion"];
  if (typeof raw !== "string") {
    return null;
  }
  const epochMs = Date.parse(raw);
  return Number.isFinite(epochMs) ? new Date(epochMs).toISOString().replace(/\.\d{3}Z$/u, "Z") : null;
}

/**
 * Boletín costero de una zona, o `WeatherSourceError` si AEMET no lo sirve (clave ausente
 * incluida).
 */
export async function fetchCoastalBulletin(
  deps: AemetDeps,
  zone: CoastalZone,
): Promise<CoastalBulletin> {
  const apiKey = deps.apiKey?.trim();
  if (apiKey === undefined || apiKey === "") {
    // Este motivo viaja al cliente en `reason` (ver `errors.ts`), así que dice el hecho y no
    // cómo se arregla: el nombre de la variable de entorno es del canal del operador (T-18).
    throw new WeatherSourceError(
      "AEMET no está configurada en esta instancia: no hay credencial con la que pedir el boletín",
    );
  }

  const baseUrl = deps.baseUrl ?? AEMET_BASE_URL;
  const envelope = asRecord(
    await fetchJson({
      fetch: deps.fetch,
      url: `${baseUrl}/prediccion/maritima/costera/costa/${zone.code}`,
      label: LABEL,
      headers: { api_key: apiKey },
      timeoutMs: AEMET_TIMEOUT_MS,
    }),
    LABEL,
  );

  const estado = envelope["estado"];
  if (typeof estado === "number" && estado !== 200) {
    const descripcion = typeof envelope["descripcion"] === "string" ? envelope["descripcion"] : "";
    throw new WeatherSourceError(`${LABEL} rechazó la petición (estado ${estado}): ${descripcion}`);
  }

  const datosUrl = requiredString(envelope, "datos", LABEL);
  // La segunda URL llega **en el cuerpo de la primera respuesta**: seguirla a ciegas sería dejar
  // que un upstream comprometido nos apunte a donde quiera. Se exige que sea del mismo origen.
  if (!datosUrl.startsWith(`${new URL(baseUrl).origin}/`)) {
    throw new WeatherSourceError(`${LABEL} apuntó a un origen que no es el suyo`);
  }

  const response = await deps.fetch(datosUrl, { signal: AbortSignal.timeout(AEMET_TIMEOUT_MS) });
  if (!response.ok) {
    throw new WeatherSourceError(`${LABEL} no sirvió los datos: HTTP ${response.status}`);
  }
  const document = await readDocument(response);

  return { zone, issuedAt: issuedAtFrom(document), document };
}
