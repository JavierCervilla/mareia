# Fallo de recorrido — adversarial/a3-respuesta-hostil.spec.ts > A3 · un 200 con fetchedAt que no es una fecha no puede dejar la sección pidiendo para siempre

- **snapshotId:** `92a0fe01f43d` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `t11-adversario`
- **Test:** `/home/user/mareia-t11/tests/e2e/journeys/adversarial/a3-respuesta-hostil.spec.ts:51` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 10267 ms
- **URL al fallar:** http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 4 | step | servir 200 con fetchedAt que no es una fecha |
| 57 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 80 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 81 | console | [error] Failed to load resource: net::ERR_FAILED |
| 162 | step | esperar a que la sección resuelva a alguno de sus cuatro estados |
| 184 | pageerror | Invalid time value — RangeError: Invalid time value ⏎ at r (http://127.0.0.1:4321/_astro/Meteo.astro_astro_type_script_index_0_lang.BDu69t5Y.js:1:219) ⏎ at _ (http://127.0.0.1:4321/_astro/Meteo.astro_astro_type_script_index_0_lang.BDu69t5Y.js:1:1374) ⏎ at j (http://127.0.0.1:4321/_astro/Meteo.astro_astro_type_script_index_0_lang.BDu69t5Y.js:1:3543) ⏎ at H (http://127.0.0.1:4321/_astro/Meteo.astro_astro_type_script_index_0_lang.BDu69t5Y.js:1:5870) ⏎ at ee (http://127.0.0.1:4321/_astro/Meteo.astro_astro_type_script_index_0_lang.BDu69t5Y.js:1:9028) |

## El error

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('#meteo-mar')
Expected substring: "No se ha podido traer"
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 10000ms
  - waiting for locator('#meteo-mar')

    at /home/user/mareia-t11/tests/e2e/journeys/adversarial/a3-respuesta-hostil.spec.ts:65:46
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
