# Fallo de recorrido — adversarial/a9-sin-anuncio-a-lector.spec.ts > A9 · el cambio de estado de la sección se anuncia a un lector de pantalla

- **snapshotId:** `72a13d0b64fc` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `t11-adversario`
- **Test:** `/home/user/mareia-t11/tests/e2e/journeys/adversarial/a9-sin-anuncio-a-lector.spec.ts:22` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 317 ms
- **URL al fallar:** http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 4 | step | cargar la página con el API sirviendo un dato normal |
| 49 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 79 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 79 | console | [error] Failed to load resource: net::ERR_FAILED |
| 220 | step | mirar si algo de la sección declara región viva |

## El error

```
Error: nada en la sección meteo es región viva: el contenido se sustituye en silencio

expect(received).not.toEqual(expected) // deep equality

Expected: not []

    at /home/user/mareia-t11/tests/e2e/journeys/adversarial/a9-sin-anuncio-a-lector.spec.ts:49:9
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
