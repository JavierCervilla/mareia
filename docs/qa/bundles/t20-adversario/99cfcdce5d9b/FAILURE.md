# Fallo de recorrido — adversarial/a12-la-talla-legal-sin-la-excepcion-que-la-cambia.spec.ts > A12 · ninguna marca de nota se publica sin la nota a la que llama

- **snapshotId:** `99cfcdce5d9b` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-30T21-03-41-329Z`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a12-la-talla-legal-sin-la-excepcion-que-la-cambia.spec.ts:108` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 12837 ms
- **URL al fallar:** http://127.0.0.1:4321/pesca/especies/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 5 | step | abrir el catálogo tal y como se publica |
| 54 | navigation | http://127.0.0.1:4321/pesca/especies/ |
| 12646 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 12651 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 12758 | step | recoger las marcas que la página imprime dentro del literal del BOE |
| 12766 | step | 2 marcas impresas: ¿publica la página el pie de cada una? |

## El error

```
Error: marcas de nota impresas en el catálogo sin ningún pie que las explique en toda la página

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "(***) → «Excepto en las divisiones 8a y 8b del Consejo Internacional para la Exploración del Mar, t…»",
+   "(**) → «Excepto en la división IX, a), en la que la talla mínima es de 10 centímetros.…»",
+ ]
    at /home/user/mareia/tests/e2e/journeys/adversarial/a12-la-talla-legal-sin-la-excepcion-que-la-cambia.spec.ts:150:5
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
