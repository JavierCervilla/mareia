/**
 * Lo que este fichero vigila es una **ausencia**, y por eso necesita test: que el dominio no
 * publique `/health`. Una ausencia no se nota mirando la aplicación funcionar; se nota el día
 * que alguien vuelve a montar el healthcheck por delante y nadie se entera.
 */

import { assertEquals, assertNotEquals, assertStringIncludes } from "@std/assert";
// @ts-types="@types/express"
import type { Express } from "express";

import { createPublicApp } from "./public-app.ts";
import { createServer } from "./server.ts";

/** Levanta la app en un puerto efímero y la cierra pase lo que pase. */
async function conApp(app: Express, prueba: (base: string) => Promise<void>): Promise<void> {
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("el servidor no expuso un puerto TCP");
    }
    await prueba(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
  }
}

Deno.test("la app pública no publica /health, ni en mayúsculas ni con barra final", async () => {
  await conApp(createPublicApp(createServer()), async (base) => {
    for (const ruta of ["/health", "/health/", "/HEALTH", "/health?x=1"]) {
      const response = await fetch(`${base}${ruta}`);
      const cuerpo = await response.text();
      assertEquals(response.status, 404, `${ruta} debería ser 404`);
      // Lo que de verdad importa no es el código, sino que el cuerpo no traiga la salud:
      // un 404 con el payload dentro seguiría siendo una fuga.
      assertNotEquals(cuerpo.includes("mareia-api"), true, `${ruta} filtró el payload de salud`);
    }
  });
});

Deno.test("el 404 de /health es el mismo que el de cualquier ruta inventada", async () => {
  await conApp(createPublicApp(createServer()), async (base) => {
    const health = await fetch(`${base}/health`);
    const inventada = await fetch(`${base}/no-existe`);

    assertEquals(health.status, inventada.status);
    assertEquals(health.headers.get("content-type"), inventada.headers.get("content-type"));
    // Los cuerpos solo se diferencian en la ruta que cada uno nombra: si `/health` tuviera un 404
    // propio, quien sondea sabría que esa ruta existe y está tapada.
    const cuerpoHealth = await health.text();
    const cuerpoInventada = await inventada.text();
    assertEquals(cuerpoHealth, cuerpoInventada.replaceAll("/no-existe", "/health"));
    assertStringIncludes(cuerpoHealth, "/health");
  });
});

Deno.test("la app pública sigue sirviendo /v1 sin tocarlo", async () => {
  await conApp(createPublicApp(createServer()), async (base) => {
    const response = await fetch(`${base}/v1/ports`);
    assertEquals(response.status, 200);
    const cuerpo = (await response.json()) as { ports: readonly unknown[] };
    assertNotEquals(cuerpo.ports.length, 0);

    const modules = await fetch(`${base}/v1/modules`);
    assertEquals(modules.status, 200);
    await modules.body?.cancel();
  });
});

Deno.test("la app de dentro conserva /health: es la que escucha en el puerto interno", async () => {
  await conApp(createServer(), async (base) => {
    const response = await fetch(`${base}/health`);
    assertEquals(response.status, 200);
    assertEquals(await response.json(), { status: "ok", service: "mareia-api" });
  });
});
