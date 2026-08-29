/**
 * `/sw.js` — el service worker del sitio, generado en build.
 *
 * Un endpoint estático y no un fichero de `public/` porque el worker **es código nuestro** y tiene
 * que pasar por el `tsc`, por el linter y por los tests como todo lo demás: en `public/` viviría en
 * JavaScript suelto, sin tipos y sin nadie mirándolo. Aquí el fuente es `src/pwa/sw.ts` —tipado
 * contra el protocolo y contra el contrato `AppModule`— y este endpoint lo publica.
 *
 * El fichero **tiene que servirse desde la raíz**: el ámbito de un service worker no puede subir por
 * encima de su propia URL, así que un `/_astro/sw.<hash>.js` solo controlaría `/_astro/`. Por eso no
 * pasa por el bundler y por eso el worker no puede tener imports (ver `pwa/generar-sw.ts`).
 *
 * `?raw` es de Vite: trae el fuente como cadena en tiempo de build. Se lee así y no con `readFile`
 * porque Astro empaqueta este módulo dentro de `dist/.prerender/`, donde `import.meta.url` ya no
 * apunta al fuente (la misma trampa que documenta `src/datos/deps.ts`).
 */

import type { APIRoute } from "astro";

import fuenteDelWorker from "../pwa/sw.ts?raw";
import { FECHA_DE_BUILD } from "../datos/fecha-build.ts";
import { activeModules } from "../modules.config.ts";
import { generarServiceWorker } from "../pwa/generar-sw.ts";
import { politicasDeModulos } from "../pwa/precacheo.ts";
import { PROTOCOLO } from "../pwa/protocolo.ts";

export const GET: APIRoute = () =>
  new Response(
    generarServiceWorker({
      fuente: fuenteDelWorker,
      fechaIso: FECHA_DE_BUILD,
      protocolo: PROTOCOLO,
      politicas: politicasDeModulos(activeModules),
    }),
    { headers: { "content-type": "text/javascript; charset=utf-8" } },
  );
