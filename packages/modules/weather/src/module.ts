/**
 * El módulo `weather` propiamente dicho: dos endpoints, un healthcheck y sus atribuciones.
 *
 * Cumple el contrato `AppModule` de `@mareia/module-contract`, así que darlo de alta en la API es
 * añadirlo al array de `modules.config.ts` y nada más. Y **no construye ninguna de sus
 * dependencias**: el `fetch`, la caché, el reloj, el catálogo de puertos y la clave de AEMET entran
 * por `WeatherModuleDeps` desde el composition root. Por eso los tests pueden montar el módulo
 * entero sin red, sin disco y sin secretos.
 *
 * Las dos rutas cuelgan de donde el core monte el módulo (`/v1/modules/weather`):
 *   - `GET .../weather?port=<slug>`  — estado del mar y de la atmósfera, agregado por celda.
 *   - `GET .../bulletin?port=<slug>` — boletín costero de AEMET para la zona del puerto.
 */

import type { AppModule, Attribution, Health } from "@mareia/module-contract";
// @ts-types="@types/express"
import express, { type Request, type RequestHandler, type Response, type Router } from "express";

import { AEMET_ATTRIBUTION, fetchCoastalBulletin } from "./aemet.ts";
import type { WeatherCache } from "./cache.ts";
import type { Cell } from "./cell.ts";
import { cellKey, toCell } from "./cell.ts";
import type { ForecastConditions, MarineConditions } from "./open-meteo.ts";
import { OPEN_METEO_ATTRIBUTION, fetchForecast, fetchMarine } from "./open-meteo.ts";
import type { SourceReport } from "./source.ts";
import { resolveSource } from "./source.ts";
import type { CoastalZone } from "./zones.ts";
import { zoneForPort } from "./zones.ts";

/** Versión del módulo, publicada en `/v1/modules`. Debe ir a la par con su `package.json`. */
export const WEATHER_MODULE_VERSION = "0.1.0";

/**
 * Cuánto tiempo se considera fresco cada dato. Salen de la cadencia real de las fuentes: los
 * modelos de oleaje se actualizan cada pocas horas, el de atmósfera con más frecuencia y un boletín
 * costero se emite tres veces al día.
 */
export const MARINE_TTL_SECONDS = 3_600;
export const FORECAST_TTL_SECONDS = 1_800;
export const BULLETIN_TTL_SECONDS = 21_600;

/**
 * Cuántos TTL sobrevive una entrada en la caché. La diferencia con el TTL es la ventana en la que
 * un dato caducado todavía se sirve (marcado `stale`) si la fuente no responde.
 */
const RETAIN_FACTOR = 4;

/** Lo mínimo que el módulo necesita saber de un puerto: dónde está. */
export interface PortLocation {
  readonly slug: string;
  readonly lat: number;
  readonly lon: number;
}

/**
 * Catálogo de puertos visto por el módulo. Es a propósito **más estrecho** que el `PortRepository`
 * de `@mareia/usecases`: el módulo no necesita saber de estaciones ni de constantes armónicas, y
 * cualquier implementación de aquél encaja aquí sin adaptador.
 */
export interface PortLocationRepository {
  findBySlug(slug: string): Promise<PortLocation | undefined>;
}

/** Todo lo que el módulo recibe del composition root. */
export interface WeatherModuleDeps {
  /** El `fetch` con el que salir a la red. Inyectado: en los tests no sale nadie. */
  readonly fetch: typeof fetch;
  readonly cache: WeatherCache;
  readonly now: () => number;
  readonly ports: PortLocationRepository;
  /** Clave de AEMET Open Data. `undefined` = sin boletines, con estado explícito. */
  readonly aemetApiKey?: string | undefined;
  /** Endpoints alternativos (tests, espejos). Por defecto, los públicos de cada fuente. */
  readonly urls?: {
    readonly marine?: string | undefined;
    readonly forecast?: string | undefined;
    readonly aemet?: string | undefined;
  };
}

/** Respuesta de `GET .../weather?port=<slug>`. */
export interface WeatherPayload {
  readonly port: PortLocation;
  /**
   * Celda de la malla a la que corresponde el dato: dice a qué punto se le pidió, no solo qué se
   * pidió. **Cuándo** no va aquí sino en cada fuente (`fetchedAt`, `ageSeconds`, `stale` y el
   * `observedAt` del dato): marine y forecast se refrescan por separado y pueden traer instantes
   * distintos, así que un único instante en la raíz solo podría ser verdad para una de las dos.
   */
  readonly cell: Cell;
  /** `partial` = una de las dos fuentes respondió; `unavailable` = ninguna. */
  readonly status: "ok" | "partial" | "unavailable";
  readonly marine: SourceReport<MarineConditions>;
  readonly forecast: SourceReport<ForecastConditions>;
  readonly attributions: readonly Attribution[];
}

/** Datos del boletín, cuando AEMET responde. */
export interface BulletinData {
  readonly issuedAt: string | null;
  readonly document: unknown;
}

/**
 * Respuesta de `GET .../bulletin?port=<slug>`.
 *
 * Aquí el estado va **en la raíz** y no anidado como en `weather`: hay una sola fuente, y quien
 * consume el boletín pregunta antes que nada si lo hay. Sin clave de AEMET esto es
 * `{"status": "unavailable", "reason": "..."}` con HTTP 200: la instancia funciona, lo que falta es
 * una credencial, y eso no es un error del cliente ni una caída del servidor.
 */
export type BulletinPayload = {
  readonly port: { readonly slug: string };
  /** `null` si el puerto no tiene zona marítima asignada en `aemet-zones.json`. */
  readonly zone: CoastalZone | null;
  readonly attributions: readonly Attribution[];
} & (
  | {
      readonly status: "ok";
      readonly fetchedAt: string;
      readonly ageSeconds: number;
      readonly stale: boolean;
      readonly issuedAt: string | null;
      readonly document: unknown;
    }
  | { readonly status: "unavailable"; readonly reason: string }
);

const ATTRIBUTIONS: readonly [Attribution, ...Attribution[]] = [
  OPEN_METEO_ATTRIBUTION,
  AEMET_ATTRIBUTION,
];

/** Resultado de un handler antes de convertirse en respuesta HTTP. */
interface HttpResult {
  readonly status: number;
  readonly body: unknown;
  /** Vacío = `no-store`. Solo se deja cachear fuera lo que salió entero. */
  readonly maxAgeSeconds?: number;
}

/** Estado de la última llamada a cada fuente, que es lo que contesta el healthcheck. */
interface HealthTracker {
  record(source: string, report: SourceReport<unknown>): void;
  snapshot(): Health;
}

function createHealthTracker(hasAemetKey: boolean): HealthTracker {
  const lastSeen = new Map<string, string>();

  return {
    record(source, report) {
      if (report.status === "unavailable") {
        lastSeen.set(source, `${source}: ${report.reason}`);
        return;
      }
      lastSeen.set(source, report.stale ? `${source}: sirviendo dato caducado` : "");
    },

    snapshot(): Health {
      const problems = [...lastSeen.values()].filter((problem) => problem !== "");
      if (!hasAemetKey) {
        problems.push("AEMET no configurada (falta AEMET_API_KEY): no se sirven boletines");
      }
      if (lastSeen.size === 0) {
        return hasAemetKey
          ? { status: "ok", detail: "sin peticiones todavía" }
          : { status: "degraded", detail: problems.join("; ") };
      }
      if (problems.length === 0) {
        return { status: "ok" };
      }
      const allDown = [...lastSeen.values()].every((problem) => problem !== "");
      return { status: allDown ? "down" : "degraded", detail: problems.join("; ") };
    },
  };
}

/** Valor de un parámetro de query exigiendo que llegue una sola vez y no vacío. */
function singleQueryParam(req: Request, name: string): string | undefined {
  const value = req.query[name];
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * Envuelve un handler asíncrono. Existe porque Express 4 **no** captura las promesas rechazadas:
 * sin esto, un fallo inesperado deja la petición colgada hasta el timeout del cliente.
 */
function jsonRoute(handler: (req: Request) => Promise<HttpResult>): RequestHandler {
  return (req, res: Response, next) => {
    handler(req)
      .then((result) => {
        const cacheControl = result.maxAgeSeconds === undefined
          ? "no-store"
          : `public, max-age=${result.maxAgeSeconds}`;
        res.status(result.status).set("Cache-Control", cacheControl).json(result.body);
      })
      .catch((cause: unknown) => {
        if (res.headersSent) {
          next(cause);
          return;
        }
        console.error("módulo weather: fallo sirviendo %s: %o", req.originalUrl, cause);
        res.status(500).json({ error: "Error interno sirviendo la petición" });
      });
  };
}

/** Resuelve el puerto de la query, o el resultado HTTP que hay que devolver en su lugar. */
async function resolvePort(
  deps: WeatherModuleDeps,
  req: Request,
): Promise<{ readonly port: PortLocation } | { readonly failure: HttpResult }> {
  const slug = singleQueryParam(req, "port");
  if (slug === undefined) {
    return {
      failure: {
        status: 400,
        body: { error: "Falta el parámetro obligatorio 'port' con el slug del puerto" },
      },
    };
  }
  const port = await deps.ports.findBySlug(slug);
  if (port === undefined) {
    return {
      failure: { status: 404, body: { error: `No hay ningún puerto con el slug '${slug}'` } },
    };
  }
  return { port: { slug: port.slug, lat: port.lat, lon: port.lon } };
}

function aggregateStatus(reports: readonly SourceReport<unknown>[]): WeatherPayload["status"] {
  const served = reports.filter((report) => report.status === "ok").length;
  if (served === reports.length) {
    return "ok";
  }
  return served === 0 ? "unavailable" : "partial";
}

/** `GET .../weather?port=<slug>`: mar y atmósfera de la celda del puerto. */
function weatherHandler(deps: WeatherModuleDeps, health: HealthTracker): RequestHandler {
  return jsonRoute(async (req) => {
    const resolved = await resolvePort(deps, req);
    if ("failure" in resolved) {
      return resolved.failure;
    }
    const { port } = resolved;
    const cell = toCell(port.lat, port.lon);
    const openMeteo = {
      fetch: deps.fetch,
      marineUrl: deps.urls?.marine,
      forecastUrl: deps.urls?.forecast,
    };

    const [marine, forecast] = await Promise.all([
      resolveSource({
        cache: deps.cache,
        key: cellKey("marine", cell),
        ttlSeconds: MARINE_TTL_SECONDS,
        retainSeconds: MARINE_TTL_SECONDS * RETAIN_FACTOR,
        now: deps.now,
        load: () => fetchMarine(openMeteo, cell),
      }),
      resolveSource({
        cache: deps.cache,
        key: cellKey("forecast", cell),
        ttlSeconds: FORECAST_TTL_SECONDS,
        retainSeconds: FORECAST_TTL_SECONDS * RETAIN_FACTOR,
        now: deps.now,
        load: () => fetchForecast(openMeteo, cell),
      }),
    ]);
    health.record("marine", marine);
    health.record("forecast", forecast);

    const status = aggregateStatus([marine, forecast]);
    const body: WeatherPayload = { port, cell, status, marine, forecast, attributions: ATTRIBUTIONS };
    // Solo se deja cachear fuera la respuesta entera: congelar una degradada en el CDN es alargar
    // la avería más allá de lo que dure.
    return status === "ok" ? { status: 200, body, maxAgeSeconds: 300 } : { status: 200, body };
  });
}

/** `GET .../bulletin?port=<slug>`: boletín costero de AEMET para la zona del puerto. */
function bulletinHandler(deps: WeatherModuleDeps, health: HealthTracker): RequestHandler {
  return jsonRoute(async (req) => {
    const resolved = await resolvePort(deps, req);
    if ("failure" in resolved) {
      return resolved.failure;
    }
    const port = { slug: resolved.port.slug };
    const zone = zoneForPort(port.slug);
    if (zone === undefined) {
      return {
        status: 200,
        body: {
          port,
          zone: null,
          status: "unavailable",
          reason: `El puerto '${port.slug}' no tiene zona marítima de AEMET asignada`,
          attributions: [AEMET_ATTRIBUTION],
        } satisfies BulletinPayload,
      };
    }

    const report = await resolveSource({
      cache: deps.cache,
      key: `bulletin:${zone.code}`,
      ttlSeconds: BULLETIN_TTL_SECONDS,
      retainSeconds: BULLETIN_TTL_SECONDS * RETAIN_FACTOR,
      now: deps.now,
      load: async () => {
        const bulletin = await fetchCoastalBulletin(
          { fetch: deps.fetch, apiKey: deps.aemetApiKey, baseUrl: deps.urls?.aemet },
          zone,
        );
        return { issuedAt: bulletin.issuedAt, document: bulletin.document } satisfies BulletinData;
      },
    });
    health.record("bulletin", report);

    const head = { port, zone, attributions: [AEMET_ATTRIBUTION] };
    if (report.status === "unavailable") {
      return { status: 200, body: { ...head, status: "unavailable", reason: report.reason } };
    }
    const body: BulletinPayload = {
      ...head,
      status: "ok",
      fetchedAt: report.fetchedAt,
      ageSeconds: report.ageSeconds,
      stale: report.stale,
      issuedAt: report.data.issuedAt,
      document: report.data.document,
    };
    return { status: 200, body, maxAgeSeconds: 1_800 };
  });
}

/**
 * Construye el módulo con sus dependencias ya resueltas.
 *
 * El `healthcheck` es el **estado de las últimas llamadas**, no un ping: preguntar por la salud no
 * puede costar dos peticiones a fuentes externas con límite de cuota, y lo que de verdad interesa
 * saber es si lo último que se sirvió salió bien.
 */
export function createWeatherModule(deps: WeatherModuleDeps): AppModule<Router> {
  const health = createHealthTracker(
    deps.aemetApiKey !== undefined && deps.aemetApiKey.trim() !== "",
  );

  return {
    id: "weather",
    version: WEATHER_MODULE_VERSION,
    attributions: ATTRIBUTIONS,
    api: () => {
      const router: Router = express.Router();
      router.get("/weather", weatherHandler(deps, health));
      router.get("/bulletin", bulletinHandler(deps, health));
      return { router, healthcheck: () => Promise.resolve(health.snapshot()) };
    },
  };
}
