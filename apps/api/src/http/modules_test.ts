import { assertEquals } from "@std/assert";
// @ts-types="@types/express"
import express, { type Request, type Response, type Router } from "express";

import { activeModules, type ApiModule } from "../modules.config.ts";
import { createServer } from "./server.ts";

/**
 * Módulo dummy: existe **solo en este test**. Demuestra el test de arquitectura del contrato — dar
 * de alta un módulo es añadirlo al array `activeModules` de `modules.config.ts` y nada más; darlo
 * de baja es quitarlo — sin que ningún dummy llegue a producción.
 */
function dummyModule(): ApiModule {
  return {
    id: "fishing",
    version: "9.9.9-dummy",
    attributions: [{ name: "Dummy", url: "https://example.invalid", license: "CC0-1.0" }],
    api: () => {
      const router: Router = express.Router();
      router.get("/ping", (_req: Request, res: Response) => {
        res.json({ pong: true });
      });
      return { router, healthcheck: () => Promise.resolve({ status: "ok" as const }) };
    },
  };
}

/** Levanta la API en un puerto efímero, corre la prueba y la cierra siempre. */
async function withServer(
  modules: readonly ApiModule[],
  probe: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createServer(modules).listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("el servidor no expuso un puerto TCP");
    }
    await probe(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
  }
}

Deno.test("el registry de producción declara weather, y todo módulo suyo trae atribuciones", () => {
  assertEquals(
    activeModules.map((module) => module.id),
    ["weather"],
  );
  for (const module of activeModules) {
    assertEquals(module.attributions.length > 0, true, `${module.id} no declara atribuciones`);
  }
});

Deno.test("sin módulos activos, /v1/modules lista vacío y /health sigue intacto", async () => {
  await withServer([], async (baseUrl) => {
    const modules = await fetch(`${baseUrl}/v1/modules`);
    assertEquals(modules.status, 200);
    assertEquals(await modules.json(), { modules: [] });

    const health = await fetch(`${baseUrl}/health`);
    assertEquals(health.status, 200);
    assertEquals(await health.json(), { status: "ok", service: "mareia-api" });
  });
});

Deno.test("dar de alta un módulo = añadirlo al registry: se lista y se monta su router", async () => {
  await withServer([dummyModule()], async (baseUrl) => {
    const listing = await fetch(`${baseUrl}/v1/modules`);
    assertEquals(await listing.json(), {
      modules: [
        {
          id: "fishing",
          version: "9.9.9-dummy",
          attributions: [{ name: "Dummy", url: "https://example.invalid", license: "CC0-1.0" }],
        },
      ],
    });

    const mounted = await fetch(`${baseUrl}/v1/modules/fishing/ping`);
    assertEquals(mounted.status, 200);
    assertEquals(await mounted.json(), { pong: true });
  });
});

Deno.test("dar de baja un módulo = quitarlo del registry: su ruta deja de existir", async () => {
  await withServer([], async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/modules/fishing/ping`);
    assertEquals(response.status, 404);
    await response.body?.cancel();
  });
});

Deno.test("el core puede consultar la salud de un módulo por su contrato", async () => {
  const api = dummyModule().api?.({});
  assertEquals(await api?.healthcheck(), { status: "ok" });
});
