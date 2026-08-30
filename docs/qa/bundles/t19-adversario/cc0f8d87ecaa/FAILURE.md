# Fallo de recorrido — adversarial/a11-la-tabla-que-dice-guardarse-y-no-se-guarda.spec.ts > A11 · la tabla que dice guardarse sola no está cuando se va la cobertura

- **snapshotId:** `cc0f8d87ecaa` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-30T05-08-59-264Z`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a11-la-tabla-que-dice-guardarse-y-no-se-guarda.spec.ts:47` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 15460 ms
- **URL al fallar:** chrome-error://chromewebdata/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 16 | step | abrir la página de un puerto con cobertura y leer la sección de tallas |
| 50 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 74 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 74 | console | [error] Failed to load resource: net::ERR_FAILED |
| 272 | step | comprobar que la página promete DE VERDAD que la tabla se guarda |
| 287 | step | dejar que el worker se instale, como en cualquier visita |
| 322 | step | se va la cobertura y el lector vuelve a la misma página |
| 351 | requestfailed | GET http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ — net::ERR_FAILED |
| 391 | navigation | chrome-error://chromewebdata/ |

## El error

```
Error: la página prometía que la tabla se guarda para leerla sin cobertura y sin cobertura no hay tabla: el worker solo guarda la página de un puerto si el lector lo marcó como favorito

expect(locator).toContainText(expected) failed

Locator: locator('#tallas-minimas')
Expected substring: "Talla mínima legal de captura"
Timeout: 15000ms
Error: element(s) not found

Call log:
  - la página prometía que la tabla se guarda para leerla sin cobertura y sin cobertura no hay tabla: el worker solo guarda la página de un puerto si el lector lo marcó como favorito with timeout 15000ms
  - waiting for locator('#tallas-minimas')

    at /home/user/mareia/tests/e2e/journeys/adversarial/a11-la-tabla-que-dice-guardarse-y-no-se-guarda.spec.ts:78:5
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
