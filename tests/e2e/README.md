# Tests e2e

Esqueleto instalado por las skills `qa-staging` y `qa-adversarial` en T-01:

- `fixtures/qa-bundle.ts` — fixture del **failure bundle**: al fallar un test deja un directorio
  autoconsistente (relato + captura + DOM + consola + red) sellado con un `snapshotId`.
- `journeys/` — **recorridos** (gate duro): usan la app como un humano y afirman con asserts duros.
- `journeys/adversarial/` — reproducciones del pase adversario.

Desde **T-11** hay recorridos de verdad: `journeys/meteo.spec.ts` fuerza los cuatro estados de la
sección meteo (`ok`, caducado, no disponible y carga sin datos) contra el sitio **construido**, con
el API servido desde los fixtures capturados en `apps/web/src/modulos/meteo/fixtures/`.

- Config: `playwright.config.ts` (raíz). Comando: `pnpm test:e2e`.
- **Construye antes**: los recorridos atacan `apps/web/dist/`, no un servidor de desarrollo.
- Quien sirve el `dist/` es `servidor-estatico.ts` y no `astro preview`, que se demoniza y deja a
  Playwright creyendo que el servidor murió.
- **Cero red**: el spec aborta toda petición externa y afirma que los orígenes que la página llega a
  pedir son exactamente los conocidos. Un CDN o una analítica nuevos lo ponen en rojo.
- Navegador: en CI lo instala el job `e2e`; en local, `PLAYWRIGHT_BROWSERS_PATH` apunta a donde estén.

El job `qa` de CI sigue siendo de **presencia** e informativo; el gate duro es el job `e2e`.
