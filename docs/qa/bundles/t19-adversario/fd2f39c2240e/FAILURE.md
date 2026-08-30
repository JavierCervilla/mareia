# Fallo de recorrido — adversarial/a12-el-trinquete-de-cifras-mira-seis-de-118.spec.ts > A12 · cambiar la talla de Merluza (47 puertos) tiene que poner algún gate en rojo

- **snapshotId:** `fd2f39c2240e` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-30T05-06-41-974Z`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a12-el-trinquete-de-cifras-mira-seis-de-118.spec.ts:105` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 725 ms
- **URL al fallar:** about:blank

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 4 | step | los gates tienen que estar vivos: verdes sobre el dataset publicado |
| 106 | step | plantar Merluza = 7 cm en cantabrico-noroeste-y-golfo-de-cadiz |
| 106 | step | correr G1 + G3, los mismos que corre `run.py check` |
| 199 | step | correr el gate de contenido de la web sobre ese mismo dataset |

## El error

```
Error: Merluza se publica a 7 cm en 47 puertos y ningún gate lo ve (G1/G3 sin errores, gate de la web con código 0)

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
