# Fallo de recorrido — adversarial/a12-la-misma-especie-partida-en-dos-filas.spec.ts > A12 · con el filtro de un caladero puesto, todo taxón visible publica el nombre aceptado

- **snapshotId:** `7a7b9b7e2da8` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-30T21-06-02-542Z`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a12-la-misma-especie-partida-en-dos-filas.spec.ts:113` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 13119 ms
- **URL al fallar:** http://127.0.0.1:4321/pesca/especies/#cal-canario

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 10 | step | abrir el catálogo entero |
| 33 | navigation | http://127.0.0.1:4321/pesca/especies/ |
| 12688 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 12691 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 12723 | step | pulsar el filtro «Cantábrico y noroeste y golfo de Cádiz», que es a donde lleva el enlace de un puerto |
| 12816 | navigation | http://127.0.0.1:4321/pesca/especies/#cal-cantabrico-noroeste-y-golfo-de-cadiz |
| 12893 | step | pulsar el filtro «Mediterráneo», que es a donde lleva el enlace de un puerto |
| 12944 | navigation | http://127.0.0.1:4321/pesca/especies/#cal-mediterraneo |
| 12994 | step | pulsar el filtro «Canario», que es a donde lleva el enlace de un puerto |
| 13024 | navigation | http://127.0.0.1:4321/pesca/especies/#cal-canario |

## El error

```
Error: taxones que el filtro deja a la vista sin publicar en ninguna fila visible el nombre que WoRMS acepta para ellos

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 9

- Array []
+ Array [
+   "cantabrico-noroeste-y-golfo-de-cadiz: «Cáncer pagurus» sin «Cancer pagurus» a la vista",
+   "cantabrico-noroeste-y-golfo-de-cadiz: «Gliptocephalus cynoglossus» sin «Glyptocephalus cynoglossus» a la vista",
+   "cantabrico-noroeste-y-golfo-de-cadiz: «Melanogrammús aeglefinus» sin «Melanogrammus aeglefinus» a la vista",
+   "cantabrico-noroeste-y-golfo-de-cadiz: «Microstommus kitt» sin «Microstomus kitt» a la vista",
+   "mediterraneo: «Panaeux kerathurus» sin «Penaeus kerathurus» a la vista",
+   "canario: «Thunnus Thynnus» sin «Thunnus thynnus» a la vista",
+   "canario: «Thunnus aibacares» sin «Thunnus albacares» a la vista",
+ ]
    at /home/user/mareia/tests/e2e/journeys/adversarial/a12-la-misma-especie-partida-en-dos-filas.spec.ts:154:5
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
