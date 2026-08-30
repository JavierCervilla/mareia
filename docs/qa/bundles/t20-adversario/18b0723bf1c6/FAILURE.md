# Fallo de recorrido — adversarial/a12-la-fila-que-el-boe-regula-y-el-catalogo-calla.spec.ts > A12 · lo que la página de un puerto publica y el catálogo al que enlaza no tiene

- **snapshotId:** `18b0723bf1c6` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-30T21-07-33-572Z`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a12-la-fila-que-el-boe-regula-y-el-catalogo-calla.spec.ts:87` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 25583 ms
- **URL al fallar:** http://127.0.0.1:4321/pesca/especies/#cal-cantabrico-noroeste-y-golfo-de-cadiz

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 13 | step | un puerto del caladero cantábrico: su tabla de la norma trae la fila |
| 36 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 12664 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 12664 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 12692 | httperror | HTTP 404 GET http://127.0.0.1:4321/v1/modules/weather/weather?port=vigo |
| 12692 | console | [error] Failed to load resource: the server responded with a status of 404 (Not Found) |
| 12692 | httperror | HTTP 404 GET http://127.0.0.1:4321/v1/modules/weather/bulletin?port=vigo |
| 12692 | console | [error] Failed to load resource: the server responded with a status of 404 (Not Found) |
| 12769 | step | seguir el enlace de esa misma página al catálogo del caladero |
| 12905 | navigation | http://127.0.0.1:4321/pesca/especies/#cal-cantabrico-noroeste-y-golfo-de-cadiz |
| 25489 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 25489 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |

## El error

```
Error: la página de puerto publica «Cigalas (colas)» con su talla y el catálogo al que enlaza no la nombra ni dice por qué no está

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
    at /home/user/mareia/tests/e2e/journeys/adversarial/a12-la-fila-que-el-boe-regula-y-el-catalogo-calla.spec.ts:117:5
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
