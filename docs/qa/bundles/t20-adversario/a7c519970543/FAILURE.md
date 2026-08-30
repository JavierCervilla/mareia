# Fallo de recorrido — adversarial/a4-worms-no-acepta-el-nombre-que-la-fila-le-atribuye.spec.ts > A4 · la fila publica el nombre del registro de WoRMS al que manda a comprobarla

- **snapshotId:** `a7c519970543` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-30T21-03-41-276Z`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a4-worms-no-acepta-el-nombre-que-la-fila-le-atribuye.spec.ts:100` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 12877 ms
- **URL al fallar:** http://127.0.0.1:4321/pesca/especies/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 3 | step | abrir el catálogo tal y como se publica |
| 36 | navigation | http://127.0.0.1:4321/pesca/especies/ |
| 12671 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 12672 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 12764 | step | las filas donde la norma escribe una errata y WoRMS devolvió otro binomio |
| 12771 | step | 6 erratas de la norma: ¿publica la fila el taxón que WoRMS devolvió? |

## El error

```
Error: filas resueltas que no publican en ninguna parte el nombre del registro de WoRMS al que apuntan su AphiaID y su enlace

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 8

- Array []
+ Array [
+   "«Cáncer pagurus» publica el AphiaID 107276 y no dice que es el de «Cancer pagurus»",
+   "«Gliptocephalus cynoglossus» publica el AphiaID 127136 y no dice que es el de «Glyptocephalus cynoglossus»",
+   "«Melanogrammús aeglefinus» publica el AphiaID 126437 y no dice que es el de «Melanogrammus aeglefinus»",
+   "«Microstommus kitt» publica el AphiaID 127140 y no dice que es el de «Microstomus kitt»",
+   "«Panaeux kerathurus» publica el AphiaID 246388 y no dice que es el de «Penaeus kerathurus»",
+   "«Thunnus aibacares» publica el AphiaID 127027 y no dice que es el de «Thunnus albacares»",
+ ]
    at /home/user/mareia/tests/e2e/journeys/adversarial/a4-worms-no-acepta-el-nombre-que-la-fila-le-atribuye.spec.ts:137:5
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
