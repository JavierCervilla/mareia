import { assertEquals } from "@std/assert";
import { createServer } from "./server.ts";

Deno.test("GET /health devuelve el estado del servicio", async () => {
  const server = createServer().listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));

    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("el servidor no expuso un puerto TCP");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    assertEquals(response.status, 200);
    assertEquals(await response.json(), { status: "ok", service: "mareia-api" });
  } finally {
    server.close();
  }
});
