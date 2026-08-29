# Fallo de recorrido — adversarial/a12-picker-sin-calidad.spec.ts > A12 · el último clic antes del puerto —la página de la provincia— tampoco es a ciegas

- **snapshotId:** `f3053e774674` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-29T20-51-48-079Z`
- **Test:** `/home/user/mareia-t14b/tests/e2e/journeys/adversarial/a12-picker-sin-calidad.spec.ts:103` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 12697 ms
- **URL al fallar:** http://127.0.0.1:4321/mareas/galicia/pontevedra/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 17 | step | bajar hasta la lista de la provincia, el último índice antes de la ficha del puerto |
| 37 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/ |
| 12603 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 12603 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |

## El error

```
Error: en /mareas/galicia/pontevedra/, Vigo (medida) y Baiona (estimada) se presentan iguales

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 12

- Array []
+ Array [
+   "Baiona: «BaionaEurope/Madrid» no dice «estimada»",
+   "Bueu: «BueuEurope/Madrid» no dice «estimada»",
+   "Cambados: «CambadosEurope/Madrid» no dice «estimada»",
+   "Marín: «MarínEurope/Madrid» no dice «medida»",
+   "O Grove: «O GroveEurope/Madrid» no dice «estimada»",
+   "Poio: «PoioEurope/Madrid» no dice «medida»",
+   "Redondela: «RedondelaEurope/Madrid» no dice «estimada»",
+   "Sanxenxo: «SanxenxoEurope/Madrid» no dice «estimada»",
+   "Vigo: «VigoEurope/Madrid» no dice «medida»",
+   "Vilagarcía de Arousa: «Vilagarcía de ArousaEurope/Madrid» no dice «medida»",
+ ]
    at /home/user/mareia-t14b/tests/e2e/journeys/adversarial/a12-picker-sin-calidad.spec.ts:127:5
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
