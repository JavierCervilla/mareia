/**
 * Recorridos **contra el dominio real**, que son otra cosa que los de `playwright.config.ts`.
 *
 * Aquéllos atacan el `dist/` construido en la máquina y sirven para saber si el sitio está bien
 * hecho; éstos preguntan por el dominio de verdad y sirven para saber si lo que está **publicado**
 * es lo que creemos. Son dos preguntas distintas y por eso son dos configuraciones: mezclarlas
 * obligaría a que un `pnpm test:e2e` de un PR dependiera de que producción esté en pie.
 *
 * Tres diferencias con la otra configuración, y las tres a propósito:
 *
 * - **sin `webServer`**: aquí no se levanta nada, se pregunta por lo que ya hay;
 * - **sin navegador**: todo se comprueba con el fixture `request` (HTTP a secas), así que esto
 *   corre sin `playwright install` — que es lo que hace que se pueda lanzar en el minuto siguiente
 *   a un despliegue, desde donde sea, sin bajarse 150 MB de Chromium;
 * - **sin reintentos**: si el dominio contesta a medias, eso *es* el hallazgo.
 *
 *     pnpm test:e2e:prod                                   # https://mareia.cervilla.es
 *     MAREIA_URL=https://otro.ejemplo pnpm test:e2e:prod    # otro despliegue
 */

import { defineConfig } from "@playwright/test";

const ORIGEN = process.env["MAREIA_URL"] ?? "https://mareia.cervilla.es";

export default defineConfig({
  testDir: "tests/e2e/produccion",
  retries: 0,
  forbidOnly: Boolean(process.env["CI"]),
  reporter: [["list"]],
  outputDir: "qa-bundles/produccion",
  // Generoso: se está preguntando por la red pública, y un timeout corto convertiría «la línea va
  // lenta» en «el despliegue está roto», que es justo la confusión que este recorrido evita.
  timeout: 60_000,
  use: {
    baseURL: ORIGEN,
    // El TLS se verifica. Es parte de lo que se está comprobando: un certificado caducado es una
    // avería del despliegue tan real como un 502.
    ignoreHTTPSErrors: false,
  },
});
