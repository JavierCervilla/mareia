/**
 * Configuración de los recorridos Playwright (rol `qa`, skill `qa-staging`).
 *
 * Los recorridos usan el sitio **construido** (`apps/web/dist/`), no un `astro dev`: lo que se ataca
 * tiene que ser el artefacto que se publica, con su HTML minificado y su bundle real, no una versión
 * de desarrollo que no existe en producción. De ahí que el `webServer` no construya: **hay que
 * construir antes** (`pnpm --filter web build`), igual que en los tests que leen `dist/`.
 *
 * Quien sirve el `dist/` es `tests/e2e/servidor-estatico.ts` y no `astro preview`: aquél se demoniza
 * —arranca, imprime su PID y sale—, así que Playwright lo da por caído nada más lanzarlo. Ver la
 * cabecera de ese fichero.
 *
 * `PLAYWRIGHT_BROWSERS_PATH` no se fija aquí: es del entorno (en este contenedor,
 * `/opt/pw-browsers`; en CI, la caché por defecto de `playwright install`).
 */

import { defineConfig, devices } from "@playwright/test";

const PUERTO = 4321;
const ORIGEN = `http://127.0.0.1:${PUERTO}`;

export default defineConfig({
  testDir: "tests/e2e/journeys",
  // Un recorrido en verde tiene que serlo siempre: sin reintentos que escondan intermitencias.
  retries: 0,
  forbidOnly: Boolean(process.env["CI"]),
  reporter: [["list"]],
  // Los failure bundles caen donde ya los espera el .gitignore y donde CI los sube como artifact.
  outputDir: "qa-bundles/playwright",
  use: {
    baseURL: ORIGEN,
    trace: "retain-on-failure",
  },
  // Un solo proyecto y móvil: el entorno de uso que manda en el design brief es un teléfono a pleno
  // sol en la playa. Si la sección meteo se lee ahí, se lee en cualquier sitio.
  projects: [{ name: "movil", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `node --experimental-strip-types tests/e2e/servidor-estatico.ts`,
    url: `${ORIGEN}/`,
    reuseExistingServer: !process.env["CI"],
    timeout: 60_000,
  },
});
