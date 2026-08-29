# Fallo de recorrido — adversarial/a12-null-con-motivo-inventado.spec.ts > A12 · el mismo `null` no se explica con dos motivos contrarios en dos superficies

- **snapshotId:** `c5a1aadbb735` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-29T20-55-54-592Z`
- **Test:** `/home/user/mareia-t14b/tests/e2e/journeys/adversarial/a12-null-con-motivo-inventado.spec.ts:66` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 12762 ms
- **URL al fallar:** http://127.0.0.1:4321/mareas/region-de-murcia/murcia/mazarron/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 3 | step | leer del contrato del API qué dice que significa el null de hw_time_err_p95_min |
| 7 | step | recorrer las 153 fichas construidas y quedarse con las que niegan tener observación |
| 38 | step | abrir una de ellas en el navegador y leerle la celda con sus palabras |
| 60 | navigation | http://127.0.0.1:4321/mareas/region-de-murcia/murcia/mazarron/ |
| 12648 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 12648 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 12697 | step | «Error de hora de la pleamar (p95)» en mareas/region-de-murcia/murcia/mazarron/index.html: no hay observación de este puerto con la que medirlo |

## El error

```
Error: puertos cuya ficha dice que NO hay observación mientras el contrato de /v1/ports afirma que su hw_time_err_p95_min es null porque «la observación existe»: 118 de 153. Muestra: mareas/region-de-murcia/murcia/mazarron/index.html | mareas/region-de-murcia/murcia/la-manga-del-mar-menor/index.html | mareas/region-de-murcia/murcia/cabo-de-palos/index.html

expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 118
    at /home/user/mareia-t14b/tests/e2e/journeys/adversarial/a12-null-con-motivo-inventado.spec.ts:104:5
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
