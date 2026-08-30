# Fallo de recorrido — adversarial/a12-el-trinquete-de-cifras-mira-seis-de-118.spec.ts > A12 · cambiar la talla de Vieja colorada (26 puertos) tiene que poner algún gate en rojo

- **snapshotId:** `8c682eb6ac5d` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-30T05-06-46-575Z`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a12-el-trinquete-de-cifras-mira-seis-de-118.spec.ts:105` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 713 ms
- **URL al fallar:** about:blank

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 4 | step | los gates tienen que estar vivos: verdes sobre el dataset publicado |
| 110 | step | plantar Vieja colorada = 5 cm en canario |
| 110 | step | correr G1 + G3, los mismos que corre `run.py check` |
| 204 | step | correr el gate de contenido de la web sobre ese mismo dataset |

## El error

```
Error: Vieja colorada se publica a 5 cm en 26 puertos y ningún gate lo ve (G1/G3 sin errores, gate de la web con código 0)

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
