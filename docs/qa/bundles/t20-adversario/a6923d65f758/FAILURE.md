# Fallo de recorrido — adversarial/a4-worms-no-acepta-el-nombre-que-la-fila-le-atribuye.spec.ts > A4 · sólo dice «WoRMS acepta el nombre de la norma» la fila cuyo nombre se preguntó

- **snapshotId:** `a6923d65f758` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-30T21-03-16-426Z`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a4-worms-no-acepta-el-nombre-que-la-fila-le-atribuye.spec.ts:59` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 12732 ms
- **URL al fallar:** http://127.0.0.1:4321/pesca/especies/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 4 | step | abrir el catálogo tal y como se publica |
| 23 | navigation | http://127.0.0.1:4321/pesca/especies/ |
| 12577 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 12577 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 12647 | step | separar las filas a las que WoRMS nunca vio el nombre que escribe la norma |
| 12655 | step | 21 filas con una consulta distinta: ¿qué dicen de WoRMS? |

## El error

```
Error: filas que publican «WoRMS acepta el nombre de la norma» sobre un nombre que WoRMS nunca vio porque fuimos nosotros quienes decidimos preguntarle otro

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 22

- Array []
+ Array [
+   "«Alosa spp» (a WoRMS se le preguntó «alosa»)",
+   "«Cáncer pagurus» (a WoRMS se le preguntó «cancer pagurus»)",
+   "«Diplodus spp» (a WoRMS se le preguntó «diplodus»)",
+   "«Epinephelus spp» (a WoRMS se le preguntó «epinephelus»)",
+   "«Gliptocephalus cynoglossus» (a WoRMS se le preguntó «glyptocephalus cynoglossus»)",
+   "«Lepidorhombus spp» (a WoRMS se le preguntó «lepidorhombus»)",
+   "«Lophius spp» (a WoRMS se le preguntó «lophius»)",
+   "«Melanogrammús aeglefinus» (a WoRMS se le preguntó «melanogrammus aeglefinus»)",
+   "«Microstommus kitt» (a WoRMS se le preguntó «microstomus kitt»)",
+   "«Mugil spp» (a WoRMS se le preguntó «mugil»)",
+   "«Mugil spps» (a WoRMS se le preguntó «mugil»)",
+   "«Mullus spp» (a WoRMS se le preguntó «mullus»)",
+   "«Pagellus spp» (a WoRMS se le preguntó «pagellus»)",
+   "«Pecten spp» (a WoRMS se le preguntó «pecten»)",
+   "«Scomber spp» (a WoRMS se le preguntó «scomber»)",
+   "«Sepia spp» (a WoRMS se le preguntó «sepia»)",
+   "«Thunnus aibacares» (a WoRMS se le preguntó «thunnus albacares»)",
+   "«Trachurus spp» (a WoRMS se le preguntó «trachurus»)",
+   "«Venerupis spp» (a WoRMS se le preguntó «venerupis»)",
+   "«Venus spp» (a WoRMS se le preguntó «venus»)",
+ ]
    at /home/user/mareia/tests/e2e/journeys/adversarial/a4-worms-no-acepta-el-nombre-que-la-fila-le-atribuye.spec.ts:97:5
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
