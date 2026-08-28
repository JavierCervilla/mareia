// @ts-types="@types/express"
import express, { type Express, type Request, type Response } from "express";

/** Respuesta del endpoint de salud: contrato estable que consumen CI y el smoke de despliegue. */
export interface HealthPayload {
  readonly status: "ok";
  readonly service: "mareia-api";
}

/**
 * Construye la app HTTP. No escucha: quien decide el puerto es el composition root
 * (`src/main.ts`), de modo que los tests puedan levantarla en un puerto efímero.
 */
export function createServer(): Express {
  const app = express();
  app.disable("x-powered-by");

  app.get("/health", (_req: Request, res: Response) => {
    const payload: HealthPayload = { status: "ok", service: "mareia-api" };
    res.json(payload);
  });

  return app;
}
