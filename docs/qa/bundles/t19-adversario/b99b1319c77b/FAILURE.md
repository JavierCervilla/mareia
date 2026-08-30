# Fallo de recorrido — adversarial/a12-el-trinquete-de-cifras-mira-seis-de-118.spec.ts > A12 · cambiar la talla de Salmonete (80 puertos) tiene que poner algún gate en rojo

- **snapshotId:** `b99b1319c77b` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-30T05-06-44-301Z`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a12-el-trinquete-de-cifras-mira-seis-de-118.spec.ts:105` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 744 ms
- **URL al fallar:** about:blank

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 4 | step | los gates tienen que estar vivos: verdes sobre el dataset publicado |
| 102 | step | plantar Salmonete = 3 cm en mediterraneo |
| 102 | step | correr G1 + G3, los mismos que corre `run.py check` |
| 232 | step | correr el gate de contenido de la web sobre ese mismo dataset |

## El error

```
Error: Salmonete se publica a 3 cm en 80 puertos y ningún gate lo ve (G1/G3 sin errores, gate de la web con código 0)

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
    at /home/user/mareia/tests/e2e/journeys/adversarial/a12-el-trinquete-de-cifras-mira-seis-de-118.spec.ts:137:9
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
