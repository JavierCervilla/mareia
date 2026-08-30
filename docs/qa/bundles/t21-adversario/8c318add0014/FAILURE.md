# Fallo de recorrido — adversarial/a4-el-dentro-apaga-la-unica-cota-del-radio.spec.ts > A4 · una distancia publicada no puede pasar del radio que promete el título de la sección

- **snapshotId:** `8c318add0014` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `t21-adversario`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a4-el-dentro-apaga-la-unica-cota-del-radio.spec.ts:51` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 32004 ms
- **URL al fallar:** about:blank

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 8 | step | de partida: el criterio son 30 km y esa área está a 19,2 |
| 16 | step | mandar esa área a 480 km y marcarla como «dentro» |
| 18 | step | construir y leer la sección de Alicante |
| 31918 | step | el título sigue prometiendo 30 km |

## El error

```
Error: la sección publica una cota fuera del radio: [30,30,2,9,480,9]

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 30
Received:    480
    at /home/user/mareia/tests/e2e/journeys/adversarial/a4-el-dentro-apaga-la-unica-cota-del-radio.spec.ts:90:7
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
