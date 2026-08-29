/**
 * `/icono.svg` — el icono de instalación, dibujado en `src/pwa/marca.ts`.
 *
 * Se publica desde un endpoint por la misma razón que el manifiesto: el icono y los colores que
 * declara el manifiesto salen del mismo módulo y no pueden desincronizarse.
 */

import type { APIRoute } from "astro";

import { iconoSvg } from "../pwa/marca.ts";

export const GET: APIRoute = () =>
  new Response(iconoSvg(), { headers: { "content-type": "image/svg+xml; charset=utf-8" } });
