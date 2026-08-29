# Fallo de recorrido — adversarial/a2-sello-congelado.spec.ts > A2 · el sello no envejece con la página abierta tres horas

- **snapshotId:** `c4c11c16326d` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `t11-adversario`
- **Test:** `/home/user/mareia-t11/tests/e2e/journeys/adversarial/a2-sello-congelado.spec.ts:24` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 5375 ms
- **URL al fallar:** http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 4 | step | congelar el reloj de la página antes de cargarla (así el adelanto es medible) |
| 29 | step | servir un dato fresco: ageSeconds 0, stale false |
| 79 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 109 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 109 | console | [error] Failed to load resource: net::ERR_FAILED |
| 290 | step | el usuario deja la pestaña abierta tres horas (bolsillo, playa, sobremesa) |
| 298 | step | comprobar que el sello ya no vende como recién consultado un dato de hace 3 h |

## El error

```
Error: expect(locator).toHaveText(expected) failed

Locator: locator('#meteo-mar .meteo__sello-titular')
Expected pattern: /hace (2 h 5\d min|3 h)/u
Received string:  "Consultado hace menos de un minuto"
Timeout: 5000ms

Call log:
  - Expect "toHaveText" with timeout 5000ms
  - waiting for locator('#meteo-mar .meteo__sello-titular')
    14 × locator resolved to <strong class="meteo__sello-titular">Consultado hace menos de un minuto</strong>
       - unexpected value "Consultado hace menos de un minuto"

    at /home/user/mareia-t11/tests/e2e/journeys/adversarial/a2-sello-congelado.spec.ts:48:23
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
