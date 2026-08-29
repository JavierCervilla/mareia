# Fallo de recorrido — adversarial/a5-boletin-desborda.spec.ts > A5 · un enlace en el boletín no puede desbordar la página a 360 px

- **snapshotId:** `4efa92723f8e` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `t11-adversario`
- **Test:** `/home/user/mareia-t11/tests/e2e/journeys/adversarial/a5-boletin-desborda.spec.ts:27` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 317 ms
- **URL al fallar:** http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 4 | step | ventana de 360 px (el ancho de un móvil pequeño y el de uno normal) |
| 16 | step | AEMET emite un aviso con el enlace a su boletín completo |
| 57 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 79 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 79 | console | [error] Failed to load resource: net::ERR_FAILED |
| 220 | step | medir si la página se desplaza en horizontal |

## El error

```
Error: la sección desborda 130 px · DIV.meteo, DIV.meteo__bloques, ARTICLE.meteo__bloque, BLOCKQUOTE.meteo__cita, P.

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 361
Received:    490
    at /home/user/mareia-t11/tests/e2e/journeys/adversarial/a5-boletin-desborda.spec.ts:58:7
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
