import type { Attribution, CorePorts } from "@mareia/module-contract";
// @ts-types="@types/express"
import express, { type Express, type Request, type Response } from "express";
import type { UseCaseDeps } from "@mareia/usecases";

import { createCoreDeps } from "../core-deps.ts";
import { activeModules, type ApiModule } from "../modules.config.ts";
import { registerCoreRoutes } from "./core-routes.ts";

/** Respuesta del endpoint de salud: contrato estable que consumen CI y el smoke de despliegue. */
export interface HealthPayload {
  readonly status: "ok";
  readonly service: "mareia-api";
}

/** Ficha pública de un módulo activo, tal y como la sirve `GET /v1/modules`. */
export interface ModuleDescriptor {
  readonly id: string;
  readonly version: string;
  readonly attributions: readonly Attribution[];
}

/** Respuesta de `GET /v1/modules`: qué módulos sirve esta instancia y con qué fuentes. */
export interface ModulesPayload {
  readonly modules: readonly ModuleDescriptor[];
}

function describe(module: ApiModule): ModuleDescriptor {
  return { id: module.id, version: module.version, attributions: module.attributions };
}

/**
 * Construye la app HTTP. No escucha: quien decide el puerto es el composition root
 * (`src/main.ts`), de modo que los tests puedan levantarla en un puerto efímero.
 *
 * Es además el composition root de los módulos: monta el router de cada módulo activo bajo
 * `/v1/modules/<id>` y los publica en `GET /v1/modules`. El registry y las dependencias del core
 * entran por inyección (por defecto, los de producción) para que los tests puedan levantar la API
 * con módulos dummy sin tocar `modules.config.ts`.
 *
 * Las rutas del **core** (`/v1/ports…`, T-07) se montan aquí mismo y no como módulo: el catálogo y
 * la marea no se enchufan ni se desenchufan, son la razón de ser del servicio. `core` se inyecta
 * por la misma razón que `modules`: para que un test pueda servir un dataset de prueba.
 */
export function createServer(
  modules: readonly ApiModule[] = activeModules,
  deps: CorePorts = {},
  core: UseCaseDeps = createCoreDeps(),
): Express {
  const app = express();
  app.disable("x-powered-by");

  app.get("/health", (_req: Request, res: Response) => {
    const payload: HealthPayload = { status: "ok", service: "mareia-api" };
    res.json(payload);
  });

  registerCoreRoutes(app, core);

  app.get("/v1/modules", (_req: Request, res: Response) => {
    const payload: ModulesPayload = { modules: modules.map(describe) };
    res.json(payload);
  });

  for (const module of modules) {
    const api = module.api?.(deps);
    if (api !== undefined) {
      app.use(`/v1/modules/${module.id}`, api.router);
    }
  }

  return app;
}
