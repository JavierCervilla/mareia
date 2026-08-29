# Fallo de recorrido — adversarial/a11-olvidar-sin-red.spec.ts > A11 · sin red, un toque destruye la única copia del almanaque sin preguntar nada

- **snapshotId:** `71fa5adff241` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-29T09-37-47-592Z`
- **Test:** `/home/user/mareia-t12/tests/e2e/journeys/adversarial/a11-olvidar-sin-red.spec.ts:33` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 5506 ms
- **URL al fallar:** http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 10 | step | guardar el puerto con cobertura |
| 33 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 46 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 47 | console | [error] Failed to load resource: net::ERR_FAILED |
| 306 | step | se acaba la cobertura y se vuelve a la página, que ahora la sirve la copia guardada |
| 324 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 337 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_INTERNET_DISCONNECTED |
| 337 | console | [error] Failed to load resource: net::ERR_INTERNET_DISCONNECTED |
| 349 | requestfailed | GET http://127.0.0.1:4321/v1/modules/weather/weather?port=vigo — net::ERR_FAILED |
| 349 | console | [error] Failed to load resource: net::ERR_FAILED |
| 361 | requestfailed | GET http://127.0.0.1:4321/v1/modules/weather/bulletin?port=vigo — net::ERR_FAILED |
| 361 | console | [error] Failed to load resource: net::ERR_FAILED |
| 385 | step | el botón que la sección ofrece en ese estado, tal y como lo encuentra quien lee |
| 399 | step | un solo toque en «Dejar de guardar Vigo», sin cobertura para deshacerlo |
| 5434 | step | comprobar que el almanaque que se estaba leyendo sigue alcanzable |

## El error

```
Error: un toque sin confirmación ha dejado la página fuera de la caché del worker, y sin red no se puede volver a guardar

expect(received).toContain(expected) // indexOf

Expected value: "/mareas/galicia/pontevedra/vigo/"
Received array: ["/__mareia/favoritos"]
    at /home/user/mareia-t12/tests/e2e/journeys/adversarial/a11-olvidar-sin-red.spec.ts:63:5
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
