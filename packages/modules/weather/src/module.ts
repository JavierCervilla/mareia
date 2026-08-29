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

import type { AppModule, Health } from "@mareia/module-contract";
// @ts-types="@types/express"
import express, { type Request, type RequestHandler, type Response, type Router } from "express";

import { AEMET_ATTRIBUTION, fetchCoastalBulletin } from "./aemet.ts";
import type { AemetKeyState } from "./aemet-key.ts";
import { inspectAemetKey, needsHumanAction, publicCredentialView } from "./aemet-key.ts";
import type { WeatherCache } from "./cache.ts";
import { cellKey, toCell } from "./cell.ts";
import { BULLETIN_TTL_SECONDS, FORECAST_TTL_SECONDS, MARINE_TTL_SECONDS } from "./frescura.ts";
import { WEATHER_ATTRIBUTIONS, WEATHER_MODULE_VERSION } from "./meta.ts";
import { fetchForecast, fetchMarine } from "./open-meteo.ts";
import type { BulletinData, BulletinPayload, PortLocation, WeatherPayload } from "./payload.ts";
import type { SourceReport } from "./source.ts";
import { resolveSource } from "./source.ts";
import { WEATHER_PAGE_SECTIONS } from "./ui.ts";
import { zoneForPort } from "./zones.ts";

/**
 * Cuántos TTL sobrevive una entrada en la caché. La diferencia con el TTL es la ventana en la que
 * un dato caducado todavía se sirve (marcado `stale`) si la fuente no responde.
 */
const RETAIN_FACTOR = 4;

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

function createHealthTracker(keyState: () => AemetKeyState): HealthTracker {
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
      const credential = keyState();
      // La credencial entra en la salud aunque nadie haya pedido un boletín: una clave que caduca
      // en tres días es un problema hoy, no el día que devuelva 401.
      const credentialIsAProblem = credential.status === "missing" || needsHumanAction(credential);
      if (credentialIsAProblem) {
        // El `detail` sale por `/health`, que hoy es alcanzable sin autenticar: aquí va la frase
        // pública, no el aviso al operador. Que la salud degrade no cambia (T-18).
        problems.push(publicCredentialView(credential).message);
      }
      if (lastSeen.size === 0) {
        return credentialIsAProblem
          ? { status: "degraded", detail: problems.join("; ") }
          : { status: "ok", detail: "sin peticiones todavía" };
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
    const body: WeatherPayload = {
      port,
      cell,
      status,
      marine,
      forecast,
      attributions: WEATHER_ATTRIBUTIONS,
    };
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
          credential: publicCredentialView(inspectAemetKey(deps.aemetApiKey, deps.now())),
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

    const head = {
      port,
      zone,
      attributions: [AEMET_ATTRIBUTION],
      credential: publicCredentialView(inspectAemetKey(deps.aemetApiKey, deps.now())),
    };
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
  // El estado de la credencial se recalcula en cada consulta con el reloj inyectado: una clave
  // caduca por el paso del tiempo, no por un redespliegue.
  const credentialState = (): AemetKeyState => inspectAemetKey(deps.aemetApiKey, deps.now());
  const health = createHealthTracker(credentialState);

  return {
    id: "weather",
    version: WEATHER_MODULE_VERSION,
    attributions: WEATHER_ATTRIBUTIONS,
    // La sección de la página de puerto se declara aquí también —y no solo en `WEATHER_UI_MODULE`—
    // para que el módulo montado en la API publique la misma cara que la web renderiza: si algún
    // día `/v1/modules` expone las secciones, no puede contar una historia distinta.
    pageSections: WEATHER_PAGE_SECTIONS,
    api: () => {
      const router: Router = express.Router();
      router.get("/weather", weatherHandler(deps, health));
      router.get("/bulletin", bulletinHandler(deps, health));
      return { router, healthcheck: () => Promise.resolve(health.snapshot()) };
    },
  };
}
