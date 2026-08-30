# Fallo de recorrido — adversarial/a12-la-fila-que-el-boe-regula-y-el-catalogo-calla.spec.ts > A12 · la fila del BOE que el catálogo no publica aparece con su motivo

- **snapshotId:** `17f423ce6f10` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-30T21-07-12-051Z`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a12-la-fila-que-el-boe-regula-y-el-catalogo-calla.spec.ts:53` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 12853 ms
- **URL al fallar:** http://127.0.0.1:4321/pesca/especies/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 3 | step | abrir el catálogo tal y como se publica |
| 29 | navigation | http://127.0.0.1:4321/pesca/especies/ |
| 12729 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 12729 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 12796 | step | qué filas de la norma se quedaron fuera, según el propio dataset |
| 12802 | step | 1 filas fuera: ¿dice la página que existen y por qué no están? |

## El error

```
Error: filas con talla mínima en el RD 560/1995 que el catálogo no publica y de las que no dice nada

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "«Cigalas (colas)» (cantabrico-noroeste-y-golfo-de-cadiz, el BOE imprime «3,7») no se nombra en la página, y su motivo tampoco: «la norma escribe «Cigalas (colas)» y ahí no hay ningún nombre latino entre parén…»",
+ ]
    at /home/user/mareia/tests/e2e/journeys/adversarial/a12-la-fila-que-el-boe-regula-y-el-catalogo-calla.spec.ts:84:5
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
