# Fallo de recorrido — adversarial/a6-la-unica-frase-de-presencia-que-viaja-en-el-dato.spec.ts > A6 · ninguna frase de la columna de presencia afirma qué hay en el mar

- **snapshotId:** `0326e106f80a` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-30T21-11-06-251Z`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a6-la-unica-frase-de-presencia-que-viaja-en-el-dato.spec.ts:70` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 16305 ms
- **URL al fallar:** about:blank

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 3 | step | comprobar que los gates del pipeline están verdes sobre el catálogo publicado |
| 122 | step | plantar una afirmación de ausencia en la única frase de presencia que sale del JSON |
| 131 | step | los gates del pipeline, sobre el catálogo con la frase plantada |
| 235 | step | construir el sitio con ese catálogo y leer la página del catálogo |

## El error

```
Error: «Sin registros: OBIS confirma que la especie no está presente en este caladero.» se publica en la columna de presencia del catálogo. Gates del pipeline que lo vieron: ninguno. Build: 0.

expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
    at /home/user/mareia/tests/e2e/journeys/adversarial/a6-la-unica-frase-de-presencia-que-viaja-en-el-dato.spec.ts:121:7
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
