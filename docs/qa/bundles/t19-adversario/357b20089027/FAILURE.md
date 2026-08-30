# Fallo de recorrido — adversarial/a4-la-excepcion-balear-no-se-resuelve-y-si-se-sabe.spec.ts > A4 · en un puerto balear la talla del pulpo no puede leerse igual que en uno peninsular

- **snapshotId:** `357b20089027` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-30T05-05-48-639Z`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a4-la-excepcion-balear-no-se-resuelve-y-si-se-sabe.spec.ts:60` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 25464 ms
- **URL al fallar:** http://127.0.0.1:4321/mareas/illes-balears/illes-balears/palma-de-mallorca/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 4 | step | abrir Valencia, un puerto del Anexo II donde la talla del pulpo SÍ rige |
| 31 | navigation | http://127.0.0.1:4321/mareas/comunitat-valenciana/valencia/valencia/ |
| 12549 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 12549 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 12586 | httperror | HTTP 404 GET http://127.0.0.1:4321/v1/modules/weather/weather?port=valencia |
| 12586 | console | [error] Failed to load resource: the server responded with a status of 404 (Not Found) |
| 12586 | httperror | HTTP 404 GET http://127.0.0.1:4321/v1/modules/weather/bulletin?port=valencia |
| 12586 | console | [error] Failed to load resource: the server responded with a status of 404 (Not Found) |
| 12710 | step | abrir Palma de Mallorca, uno de los 17 puertos que la nota excepciona |
| 12737 | navigation | http://127.0.0.1:4321/mareas/illes-balears/illes-balears/palma-de-mallorca/ |
| 25274 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 25274 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 25298 | httperror | HTTP 404 GET http://127.0.0.1:4321/v1/modules/weather/weather?port=palma-de-mallorca |
| 25298 | console | [error] Failed to load resource: the server responded with a status of 404 (Not Found) |
| 25299 | httperror | HTTP 404 GET http://127.0.0.1:4321/v1/modules/weather/bulletin?port=palma-de-mallorca |
| 25299 | console | [error] Failed to load resource: the server responded with a status of 404 (Not Found) |
| 25398 | step | comprobar que la nota que excepciona está de verdad ahí (el gate de T-19 lo asegura) |

## El error

```
Error: la página de un puerto balear publica la talla del pulpo con exactamente el mismo texto que la de Valencia, aunque su propia nota diga que en Balears no es de aplicación

expect(received).not.toBe(expected) // Object.is equality

Expected: not "1 kg de peso(*) La talla del pulpo (Octopus vulgaris) recogida en la presente tabla no es de aplicación en las aguas interiores y la plataforma continental de la Comunidad Autónoma de las Illes Balears."
    at /home/user/mareia/tests/e2e/journeys/adversarial/a4-la-excepcion-balear-no-se-resuelve-y-si-se-sabe.spec.ts:80:9
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
