# Fallo de recorrido — adversarial/a12-picker-sin-calidad.spec.ts > A12 · la lista de puertos de una región dice la calidad de cada uno, como la portada

- **snapshotId:** `771b521ac0ac` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-29T20-52-21-271Z`
- **Test:** `/home/user/mareia-t14b/tests/e2e/journeys/adversarial/a12-picker-sin-calidad.spec.ts:67` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 88639 ms
- **URL al fallar:** http://127.0.0.1:4321/mareas/region-de-murcia/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 19 | step | seguir el primer enlace de la portada: «Ver todas las regiones» |
| 37 | navigation | http://127.0.0.1:4321/ |
| 12589 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 12589 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 12706 | navigation | http://127.0.0.1:4321/mareas/ |
| 12762 | step | recorrer /mareas/andalucia/, que lista los puertos de la región |
| 12775 | navigation | http://127.0.0.1:4321/mareas/andalucia/ |
| 25256 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 25256 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 25294 | step | recorrer /mareas/asturias/, que lista los puertos de la región |
| 25312 | navigation | http://127.0.0.1:4321/mareas/asturias/ |
| 25374 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 25374 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 25400 | step | recorrer /mareas/canarias/, que lista los puertos de la región |
| 25412 | navigation | http://127.0.0.1:4321/mareas/canarias/ |
| 37838 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 37839 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 37869 | step | recorrer /mareas/cantabria/, que lista los puertos de la región |
| 37882 | navigation | http://127.0.0.1:4321/mareas/cantabria/ |
| 38077 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 38077 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 38105 | step | recorrer /mareas/cataluna/, que lista los puertos de la región |
| 38118 | navigation | http://127.0.0.1:4321/mareas/cataluna/ |
| 50499 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 50499 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 50530 | step | recorrer /mareas/ceuta/, que lista los puertos de la región |
| 50543 | navigation | http://127.0.0.1:4321/mareas/ceuta/ |
| 50715 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 50717 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 50745 | step | recorrer /mareas/comunitat-valenciana/, que lista los puertos de la región |
| 50756 | navigation | http://127.0.0.1:4321/mareas/comunitat-valenciana/ |
| 63099 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 63099 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 63135 | step | recorrer /mareas/galicia/, que lista los puertos de la región |
| 63147 | navigation | http://127.0.0.1:4321/mareas/galicia/ |
| 63352 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 63355 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 63392 | step | recorrer /mareas/illes-balears/, que lista los puertos de la región |
| 63416 | navigation | http://127.0.0.1:4321/mareas/illes-balears/ |
| 75714 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 75718 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 75748 | step | recorrer /mareas/melilla/, que lista los puertos de la región |
| 75761 | navigation | http://127.0.0.1:4321/mareas/melilla/ |
| 75955 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 75955 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 75984 | step | recorrer /mareas/pais-vasco/, que lista los puertos de la región |
| 75994 | navigation | http://127.0.0.1:4321/mareas/pais-vasco/ |
| 88419 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 88420 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 88450 | step | recorrer /mareas/region-de-murcia/, que lista los puertos de la región |
| 88464 | navigation | http://127.0.0.1:4321/mareas/region-de-murcia/ |
| 88560 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 88560 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |

## El error

```
Error: puertos que se eligen sin saber si su marea está medida (primeros 5 de 153): Adra (/mareas/andalucia/): «Adra» no dice «estimada» | Carboneras (/mareas/andalucia/): «Carboneras» no dice «medida» | Cuevas del Almanzora (/mareas/andalucia/): «Cuevas del Almanzora» no dice «estimada» | Garrucha (/mareas/andalucia/): «Garrucha» no dice «estimada» | Níjar (/mareas/andalucia/): «Níjar» no dice «estimada»

expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 153
    at /home/user/mareia-t14b/tests/e2e/journeys/adversarial/a12-picker-sin-calidad.spec.ts:103:5
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
