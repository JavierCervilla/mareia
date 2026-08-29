# Fallo de recorrido — adversarial/a3-respuesta-hostil.spec.ts > A3 · un 200 con basura no se puede confundir con «el navegador no pudo preguntar»

- **snapshotId:** `6af5dbe76a62` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `t11-adversario`
- **Test:** `/home/user/mareia-t11/tests/e2e/journeys/adversarial/a3-respuesta-hostil.spec.ts:75` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 442 ms
- **URL al fallar:** http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 4 | step | caso A: el API contesta 200 con un cuerpo que no es JSON (un proxy de por medio) |
| 58 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 77 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 77 | console | [error] Failed to load resource: net::ERR_FAILED |
| 246 | step | caso B: la petición ni siquiera sale (el API está caído de verdad) |
| 275 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 290 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 290 | console | [error] Failed to load resource: net::ERR_FAILED |
| 317 | requestfailed | GET http://127.0.0.1:4321/v1/modules/weather/weather?port=vigo — net::ERR_CONNECTION_REFUSED |
| 317 | console | [error] Failed to load resource: net::ERR_CONNECTION_REFUSED |
| 317 | requestfailed | GET http://127.0.0.1:4321/v1/modules/weather/bulletin?port=vigo — net::ERR_CONNECTION_REFUSED |
| 317 | console | [error] Failed to load resource: net::ERR_CONNECTION_REFUSED |
| 373 | step | comparar las dos frases: son dos ausencias distintas y tienen que leerse distinto |

## El error

```
Error: el 200 ilegible y el API caído dicen exactamente lo mismo

expect(received).not.toEqual(expected) // deep equality

Expected: not "No se ha podido traer
No se ha podido pedir el estado del mar al servidor de Mareia."

    at /home/user/mareia-t11/tests/e2e/journeys/adversarial/a3-respuesta-hostil.spec.ts:110:86
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
