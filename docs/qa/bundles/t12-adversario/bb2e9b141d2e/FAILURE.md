# Fallo de recorrido — adversarial/a4-registro-que-miente.spec.ts > A4 · el registro que escribe el fail-safe deja al otro favorito sin un solo fichero

- **snapshotId:** `bb2e9b141d2e` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-29T09-37-12-937Z`
- **Test:** `/home/user/mareia-t12/tests/e2e/journeys/adversarial/a4-registro-que-miente.spec.ts:48` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 659 ms
- **URL al fallar:** http://127.0.0.1:4321/mareas/cantabria/cantabria/santander/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 12 | step | guardar Vigo con cobertura: es el favorito que hay que proteger |
| 37 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 50 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 50 | console | [error] Failed to load resource: net::ERR_FAILED |
| 310 | step | el registro se queda ilegible (escritura a medias por cuota, o un worker anterior) |
| 316 | step | llega el rebuild diario y se guarda un segundo puerto: aquí el fail-safe NO poda… |
| 346 | navigation | http://127.0.0.1:4321/mareas/cantabria/cantabria/santander/ |
| 358 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 358 | console | [error] Failed to load resource: net::ERR_FAILED |
| 561 | step | …pero deja escrito un registro de un solo puerto que afirma ser el censo completo |
| 561 | step | y ahora se deja de guardar ese mismo puerto, que es cuando la poda se lo cree |
| 609 | step | comprobar que el favorito de Vigo conserva los ficheros con los que se pinta |

## El error

```
Error: el favorito de Vigo se ha quedado sin /_astro/AlmanaqueLayout.CBCOLnoy.css

expect(received).toContain(expected) // indexOf

Expected value: "/_astro/AlmanaqueLayout.CBCOLnoy.css"
Received array: []
    at /home/user/mareia-t12/tests/e2e/journeys/adversarial/a4-registro-que-miente.spec.ts:80:74
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
