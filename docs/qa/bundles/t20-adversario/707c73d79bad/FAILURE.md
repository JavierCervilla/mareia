# Fallo de recorrido — adversarial/a12-la-talla-legal-sin-la-excepcion-que-la-cambia.spec.ts > A12 · toda cifra legal del catálogo publica la excepción que la norma le cuelga

- **snapshotId:** `707c73d79bad` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `run-2026-08-30T21-03-16-326Z`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a12-la-talla-legal-sin-la-excepcion-que-la-cambia.spec.ts:54` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 12893 ms
- **URL al fallar:** http://127.0.0.1:4321/pesca/especies/

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 5 | step | abrir el catálogo tal y como se publica |
| 93 | navigation | http://127.0.0.1:4321/pesca/especies/ |
| 12725 | requestfailed | GET https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap — net::ERR_CONNECTION_RESET |
| 12725 | console | [error] Failed to load resource: net::ERR_CONNECTION_RESET |
| 12807 | step | buscar en la norma qué cifras del catálogo llevan una excepción al pie |
| 12814 | step | 3 cifras con excepción: ¿la publica el catálogo? |

## El error

```
Error: cifras legales publicadas en el catálogo sin la excepción que la norma les pone, mientras la página de puerto de esos mismos caladeros sí la publica

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 5

- Array []
+ Array [
+   "Dicentrarchus labrax · Cantábrico y noroeste y golfo de Cádiz · «36 (***)» → falta «Excepto en las divisiones 8a y 8b del Consejo Internacional para la Exploración del Mar, t…»",
+   "Engraulis encrasicholus · Cantábrico y noroeste y golfo de Cádiz · «12 (**)» → falta «Excepto en la división IX, a), en la que la talla mínima es de 10 centímetros.…»",
+   "Octopus vulgaris · Mediterráneo · «1 kg» → falta «La talla del pulpo (Octopus vulgaris) recogida en la presente tabla no es de aplicación en…»",
+ ]
    at /home/user/mareia/tests/e2e/journeys/adversarial/a12-la-talla-legal-sin-la-excepcion-que-la-cambia.spec.ts:105:5
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
