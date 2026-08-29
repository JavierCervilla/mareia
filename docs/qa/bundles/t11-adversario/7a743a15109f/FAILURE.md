# Fallo de recorrido — adversarial/a10-bloque-rehen.spec.ts > A10 · el estado del mar se enseña sin esperar a que AEMET conteste

- **snapshotId:** `7a743a15109f` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `t11-adversario`
- **Test:** `/home/user/mareia-t11/tests/e2e/journeys/adversarial/a10-bloque-rehen.spec.ts:22` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 3352 ms
- **URL al fallar:** http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 4 | step | Open-Meteo contesta al momento; AEMET tarda 5 s (dentro de la espera de 8 s) |
| 74 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 105 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 105 | console | [error] Failed to load resource: net::ERR_FAILED |
| 211 | step | a los 3 s el mar ya tiene que estar en pantalla, con su sello |

## El error

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('#meteo-mar')
Expected substring: "1,68 m"
Timeout: 3000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 3000ms
  - waiting for locator('#meteo-mar')

    at /home/user/mareia-t11/tests/e2e/journeys/adversarial/a10-bloque-rehen.spec.ts:37:44
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
