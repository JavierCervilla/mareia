# Fallo de recorrido — adversarial/a12-trinquete-adr01-permeable.spec.ts > A12 · el gate de ADR-01 tiene que ver una magnitud escondida en atributo con el valor sin comillas

- **snapshotId:** `9cc1dea283bb` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `t11-adversario`
- **Test:** `/home/user/mareia-t11/tests/e2e/journeys/adversarial/a12-trinquete-adr01-permeable.spec.ts:106` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 433 ms
- **URL al fallar:** about:blank

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 9 | step | inyectar la carga en el dist/: atributo con el valor sin comillas |
| 9 | step | comprobar que la carga está DE VERDAD en el HTML publicado, dentro de #meteo |
| 11 | step | correr el gate de ADR-01 tal cual lo corre CI |

## El error

```
Error: el gate de ADR-01 da por bueno un HTML con meteo horneada dentro de #meteo

expect(received).not.toBe(expected) // Object.is equality

Expected: not 0
    at /home/user/mareia-t11/tests/e2e/journeys/adversarial/a12-trinquete-adr01-permeable.spec.ts:135:13
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
