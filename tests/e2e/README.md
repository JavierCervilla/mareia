# Tests e2e

Esqueleto instalado por las skills `qa-staging` y `qa-adversarial` en T-01:

- `fixtures/qa-bundle.ts` — fixture del **failure bundle**: al fallar un test deja un directorio
  autoconsistente (relato + captura + DOM + consola + red) sellado con un `snapshotId`.
- `journeys/` — **recorridos** (gate duro): usan la app como un humano y afirman con asserts duros.
- `journeys/adversarial/` — reproducciones del pase adversario.

En T-01 **no hay recorridos todavía** (la UI real llega en T-02+): faltan `@playwright/test`, la
config de Playwright y los specs. El job `qa` de CI es de **presencia** e informativo hasta entonces.
