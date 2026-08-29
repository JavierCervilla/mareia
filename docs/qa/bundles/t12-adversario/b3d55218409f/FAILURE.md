# Fallo de recorrido — adversarial/a3-sello-sin-copia.spec.ts > A3 · un fichero que ya no está deja el favorito sin página, y la recarga se lleva el aviso

- **snapshotId:** `b3d55218409f` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-29T09-37-06-420Z`
- **Test:** `/home/user/mareia-t12/tests/e2e/journeys/adversarial/a3-sello-sin-copia.spec.ts:76` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 414 ms
- **URL al fallar:** http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 8 | step | abrir el puerto y esperar al worker |
| 30 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 45 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 45 | console | [error] Failed to load resource: net::ERR_FAILED |
| 146 | step | la pestaña lleva abierta desde ayer: el rebuild diario se llevó su hoja de estilos |
| 147 | step | guardar el puerto: las constantes bajan, los bytes de la página no |
| 258 | step | y quien lee recarga, que es lo primero que hace cualquiera al volver a la página |
| 274 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 287 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 288 | console | [error] Failed to load resource: net::ERR_FAILED |
| 288 | httperror | HTTP 404 GET http://127.0.0.1:4321/_astro/AlmanaqueLayout.CBCOLnoy.css |
| 289 | console | [error] Failed to load resource: the server responded with a status of 404 (Not Found) |
| 289 | requestfailed | GET http://127.0.0.1:4321/_astro/AlmanaqueLayout.CBCOLnoy.css — net::ERR_ABORTED |
| 354 | step | comprobar que el sello no afirma un offline que no existe |

## El error

```
Error: el sello dice «Guardado en este dispositivo hace menos de un minutoOcupa 2,5 kB de constantes armónicas y calcula cualquier día entre 2025 y 2027 sin cobertura. La página se guarda con su hoja de estilos; la tipografía no, y sin red se lee en Georgia.» y en la caché del worker hay []

expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
    at elSelloYLaCacheDicenLoMismo (/home/user/mareia-t12/tests/e2e/journeys/adversarial/a3-sello-sin-copia.spec.ts:73:5)
    at /home/user/mareia-t12/tests/e2e/journeys/adversarial/a3-sello-sin-copia.spec.ts:104:3
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
