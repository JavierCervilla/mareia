/**
 * Las rutas **del core**: el catálogo de puertos y sus datos deterministas (marea, almanaque,
 * efemérides, solunar). No son un módulo — no se enchufan ni se desenchufan — y por eso se montan
 * en el composition root junto a `/health`, y no bajo `/v1/modules/<id>`.
 *
 * Este fichero es un adaptador de entrada y solo hace de adaptador: lee la petición, delega en el
 * caso de uso y traduce el resultado (o el fallo) a HTTP. Ninguna regla de negocio vive aquí; los
 * límites de rango, la ventana del almanaque y la validación de fechas están en `@mareia/usecases`,
 * que es donde los puede compartir cualquier otra superficie.
 */

// @ts-types="@types/express"
import type { Express, Request, RequestHandler, Response } from "express";
import {
  getAlmanac,
  getAstro,
  getPort,
  getSolunar,
  getTides,
  InvalidQueryError,
  listPorts,
  PortNotFoundError,
  type UseCaseDeps,
} from "@mareia/usecases";

/**
 * Un día. Todo lo que sirven estas rutas es **determinista**: las mismas constantes armónicas y la
 * misma fecha dan la misma respuesta siempre, así que se puede cachear largo en el CDN y en el
 * navegador. Lo que cambia (dataset nuevo, corrección del motor) llega con un despliegue.
 */
const CACHE_CONTROL_DETERMINISTIC = "public, max-age=86400";

/** Valor de un parámetro de query, exigiendo que llegue **una sola vez**. */
function queryParam(req: Request, name: string): string | undefined {
  const value = req.query[name];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new InvalidQueryError(`El parámetro '${name}' llegó repetido o con una forma inesperada`);
  }
  return value;
}

/** Parámetro obligatorio de la query. */
function requiredQueryParam(req: Request, name: string): string {
  const value = queryParam(req, name);
  if (value === undefined || value === "") {
    throw new InvalidQueryError(`Falta el parámetro obligatorio '${name}'`);
  }
  return value;
}

/** Segmento de la ruta. Express lo garantiza al casar el patrón; el tipo, no. */
function pathParam(req: Request, name: string): string {
  return req.params[name] ?? "";
}

function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

/**
 * Envuelve un handler asíncrono y traduce los fallos de la capa de aplicación a HTTP: slug
 * desconocido → 404, petición mal formada o fuera de los límites → 400 con el mensaje del caso de
 * uso. Cualquier otra cosa es culpa del servidor: se registra y sale un 500 sin detalles internos.
 *
 * Existe porque Express 4 **no** captura las promesas rechazadas de un handler: sin esto, un fallo
 * asíncrono deja la petición colgada hasta el timeout del cliente.
 */
function route(handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch((cause: unknown) => {
      if (res.headersSent) {
        next(cause);
        return;
      }
      if (cause instanceof PortNotFoundError) {
        sendError(res, 404, `No hay ningún puerto con el slug '${cause.slug}'`);
        return;
      }
      if (cause instanceof InvalidQueryError) {
        sendError(res, 400, cause.message);
        return;
      }
      console.error("fallo sirviendo %s: %o", req.originalUrl, cause);
      sendError(res, 500, "Error interno sirviendo la petición");
    });
  };
}

/** Respuesta determinista: mismo contenido siempre, así que se cachea largo. */
function sendDeterministic(res: Response, payload: unknown): void {
  res.set("Cache-Control", CACHE_CONTROL_DETERMINISTIC).json(payload);
}

/**
 * Monta las seis rutas del core sobre la app. Las dependencias llegan ya construidas: esta función
 * no lee ficheros ni sabe dónde está el dataset.
 */
export function registerCoreRoutes(app: Express, deps: UseCaseDeps): void {
  app.get(
    "/v1/ports",
    route(async (_req, res) => {
      sendDeterministic(res, await listPorts(deps));
    }),
  );

  app.get(
    "/v1/ports/:slug",
    route(async (req, res) => {
      sendDeterministic(res, await getPort(deps, pathParam(req, "slug")));
    }),
  );

  app.get(
    "/v1/ports/:slug/tides",
    route(async (req, res) => {
      const step = queryParam(req, "step");
      sendDeterministic(
        res,
        await getTides(deps, {
          slug: pathParam(req, "slug"),
          from: requiredQueryParam(req, "from"),
          to: requiredQueryParam(req, "to"),
          ...(step === undefined ? {} : { step }),
        }),
      );
    }),
  );

  app.get(
    "/v1/ports/:slug/almanac/:year",
    route(async (req, res) => {
      sendDeterministic(
        res,
        await getAlmanac(deps, { slug: pathParam(req, "slug"), year: pathParam(req, "year") }),
      );
    }),
  );

  app.get(
    "/v1/ports/:slug/astro",
    route(async (req, res) => {
      sendDeterministic(
        res,
        await getAstro(deps, {
          slug: pathParam(req, "slug"),
          date: requiredQueryParam(req, "date"),
        }),
      );
    }),
  );

  app.get(
    "/v1/ports/:slug/solunar",
    route(async (req, res) => {
      sendDeterministic(
        res,
        await getSolunar(deps, {
          slug: pathParam(req, "slug"),
          date: requiredQueryParam(req, "date"),
        }),
      );
    }),
  );
}
