import { createServer } from "./http/server.ts";

const DEFAULT_PORT = 8787;

const port = Number(Deno.env.get("PORT") ?? DEFAULT_PORT);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error(`PORT inválido: ${Deno.env.get("PORT")}`);
}

createServer().listen(port, () => {
  // eslint-disable-next-line no-console -- banner de arranque: única salida a stdout del proceso
  console.info(`mareia-api listening on http://localhost:${port}`);
});
