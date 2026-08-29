# Fallo de recorrido — adversarial/a3-sello-sin-copia.spec.ts > A3 · con IndexedDB desalojada, el sello niega una copia que el worker sí tiene

- **snapshotId:** `a6345d9e9ceb` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-29T09-37-10-692Z`
- **Test:** `/home/user/mareia-t12/tests/e2e/journeys/adversarial/a3-sello-sin-copia.spec.ts:129` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 446 ms
- **URL al fallar:** http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 11 | step | guardar el puerto con cobertura |
| 35 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 54 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 54 | console | [error] Failed to load resource: net::ERR_FAILED |
| 269 | step | el navegador desaloja IndexedDB y deja la caché del worker en su sitio |
| 302 | navigation | http://127.0.0.1:4321/mareas/galicia/pontevedra/vigo/ |
| 311 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_FAILED |
| 313 | console | [error] Failed to load resource: net::ERR_FAILED |
| 376 | step | comprobar que el sello no da por perdida una copia que sigue guardada |

## El error

```
Error: el sello dice «Vigo no está guardado en este dispositivo» y en la caché del worker hay ["/offline/estaciones/vigo.json","/_astro/AlmanaqueLayout.CBCOLnoy.css","/_astro/Meteo.astro_astro_type_script_index_0_lang.CHfq3BIL.js","/_astro/index.astro_astro_type_script_index_0_lang.DtpkNpct.js","/_astro/sello.CfKIglLn.js","/_astro/dia-offline.CBzktAtG.js","/__mareia/favoritos","/mareas/galicia/pontevedra/vigo/"]

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
    at elSelloYLaCacheDicenLoMismo (/home/user/mareia-t12/tests/e2e/journeys/adversarial/a3-sello-sin-copia.spec.ts:73:5)
    at /home/user/mareia-t12/tests/e2e/journeys/adversarial/a3-sello-sin-copia.spec.ts:147:3
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
