# Fallo de recorrido — adversarial/a12-la-misma-especie-partida-en-dos-filas.spec.ts > A12 · dos filas que son el mismo taxón lo dicen, o dan cuenta de todos sus caladeros

- **snapshotId:** `33065439f669` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-30T21-05-39-489Z`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a12-la-misma-especie-partida-en-dos-filas.spec.ts:66` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 12863 ms
- **URL al fallar:** http://127.0.0.1:4321/pesca/especies/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 5 | step | abrir el catálogo tal y como se publica |
| 31 | navigation | http://127.0.0.1:4321/pesca/especies/ |
| 12725 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 12726 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 12783 | step | agrupar por AphiaID: qué registros de WoRMS se publican en más de una fila |
| 12790 | step | 3 taxones en más de una fila: ¿lo sabe quien lee una sola? |

## El error

```
Error: filas que publican un registro de WoRMS que otra fila también publica, sin decirlo y sin dar cuenta de los caladeros que la otra se lleva

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 8

- Array []
+ Array [
+   "AphiaID 126032: «Mugil spp» publica Cantábrico y noroeste y golfo de Cádiz y no nombra a «Mugil spps», que es el mismo taxón",
+   "AphiaID 126032: «Mugil spps» publica Mediterráneo y no nombra a «Mugil spp», que es el mismo taxón",
+   "AphiaID 127029: «Thunnus Thynnus» publica Canario y no nombra a «Thunnus thynnus», que es el mismo taxón",
+   "AphiaID 127029: «Thunnus thynnus» publica Cantábrico y noroeste y golfo de Cádiz + Mediterráneo y no nombra a «Thunnus Thynnus», que es el mismo taxón",
+   "AphiaID 127027: «Thunnus aibacares» publica Canario y no nombra a «Thunnus albacares», que es el mismo taxón",
+   "AphiaID 127027: «Thunnus albacares» publica Cantábrico y noroeste y golfo de Cádiz y no nombra a «Thunnus aibacares», que es el mismo taxón",
+ ]
    at /home/user/mareia/tests/e2e/journeys/adversarial/a12-la-misma-especie-partida-en-dos-filas.spec.ts:110:5
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
