# Fallo de recorrido — adversarial/a10-la-normativa-toma-de-rehen-la-marea.spec.ts > A10 · una marca de nota colgando en el Anexo II no puede dejar sin publicar la marea

- **snapshotId:** `141d616fcbbf` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-30T05-06-56-281Z`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a10-la-normativa-toma-de-rehen-la-marea.spec.ts:53` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 24921 ms
- **URL al fallar:** about:blank

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 4 | step | una fila del Anexo II queda apuntando a una nota que ese anexo no publica |
| 6 | step | construir el sitio con ese dataset |
| 24820 | step | comprobar que la que se rompe es DE VERDAD la fila que se tocó |
| 24829 | step | comprobar qué se ha publicado |

## El error

```
Error: una fila de la tabla de tallas del Anexo II deja sin publicar 3 de las 3 páginas de puerto medidas (build código 1)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 5

- Array []
+ Array [
+   "Vigo (Anexo I)",
+   "Valencia (Anexo II)",
+   "Telde (Anexo III)",
+ ]
    at /home/user/mareia/tests/e2e/journeys/adversarial/a10-la-normativa-toma-de-rehen-la-marea.spec.ts:85:7
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
