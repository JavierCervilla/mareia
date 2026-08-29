# Fallo de recorrido — adversarial/a3-sello-sin-copia.spec.ts > A3 · con la caché de páginas barrida, el sello sigue prometiendo la copia que ya no hay

- **snapshotId:** `e5174ab760e4` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-29T09-37-08-610Z`
- **Test:** `/home/user/mareia-t12/tests/e2e/journeys/adversarial/a3-sello-sin-copia.spec.ts:107` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 437 ms
- **URL al fallar:** http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 9 | step | guardar el puerto con cobertura |
| 29 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 43 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 43 | console | [error] Failed to load resource: net::ERR_FAILED |
| 281 | step | barrer la caché de páginas sin tocar IndexedDB (el barrido de ESQUEMA_CACHE v1→v2) |
| 287 | step | volver a la página con cobertura, que es cuando se podría arreglar sola |
| 306 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 315 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 315 | console | [error] Failed to load resource: net::ERR_FAILED |
| 378 | step | comprobar que el sello no promete un offline que ya no existe |

## El error

```
Error: el sello dice «Guardado en este dispositivo hace menos de un minuto» y en la caché del worker hay []

expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
    at elSelloYLaCacheDicenLoMismo (/home/user/mareia-t12/tests/e2e/journeys/adversarial/a3-sello-sin-copia.spec.ts:73:5)
    at /home/user/mareia-t12/tests/e2e/journeys/adversarial/a3-sello-sin-copia.spec.ts:126:3
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
