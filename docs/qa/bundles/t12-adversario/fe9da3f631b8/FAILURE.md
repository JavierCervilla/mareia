# Fallo de recorrido — adversarial/a9-app-instalada-sin-red.spec.ts > A9 · con un puerto guardado, el icono de la pantalla de inicio no abre nada sin cobertura

- **snapshotId:** `fe9da3f631b8` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-29T09-37-15-267Z`
- **Test:** `/home/user/mareia-t12/tests/e2e/journeys/adversarial/a9-app-instalada-sin-red.spec.ts:32` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 447 ms
- **URL al fallar:** chrome-error://chromewebdata/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 9 | step | leer el start_url del manifiesto publicado, que es lo que abre la app instalada |
| 26 | step | entrar por / con cobertura y llegar al puerto, como hace cualquiera |
| 47 | navigation | http://127.0.0.1:4321/ |
| 60 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 61 | console | [error] Failed to load resource: net::ERR_FAILED |
| 99 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 114 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 114 | console | [error] Failed to load resource: net::ERR_FAILED |
| 186 | step | guardar el puerto: a partir de aquí el almanaque está en el teléfono |
| 368 | step | al día siguiente, en la playa y sin cobertura, se toca el icono de la app |
| 384 | requestfailed | GET http://127.0.0.1:4321/ — net::ERR_FAILED |
| 402 | step | comprobar que la app instalada abre algo de Mareia y no el error del navegador |
| 408 | navigation | chrome-error://chromewebdata/ |

## El error

```
Error: el arranque de la app instalada (/) no lleva a ninguna parte sin red

expect(received).toBeUndefined()

Received: "page.goto: net::ERR_FAILED at http://127.0.0.1:4321/"
    at /home/user/mareia-t12/tests/e2e/journeys/adversarial/a9-app-instalada-sin-red.spec.ts:61:5
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
