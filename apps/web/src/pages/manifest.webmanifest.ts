/**
 * `/manifest.webmanifest` — lo que el sistema operativo lee para poder instalar el portal.
 *
 * Endpoint y no fichero estático para que el contenido salga del **mismo módulo** que dibuja el
 * icono y que declara los colores (`src/pwa/marca.ts`): así el manifiesto y el icono no pueden
 * decir dos cosas distintas, y los dos se testean sin construir el sitio.
 */

import type { APIRoute } from "astro";

import { MANIFIESTO } from "../pwa/marca.ts";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(MANIFIESTO, null, 2), {
    headers: { "content-type": "application/manifest+json; charset=utf-8" },
  });
