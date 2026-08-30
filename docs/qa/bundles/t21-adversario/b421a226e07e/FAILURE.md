# Fallo de recorrido — adversarial/a12-la-regla-dura-viaja-como-texto-libre.spec.ts > A12 · y en los 10 puertos sin áreas el motivo es texto libre: sólo se exige que no esté vacío

- **snapshotId:** `b421a226e07e` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `t21-adversario`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a12-la-regla-dura-viaja-como-texto-libre.spec.ts:128` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 31993 ms
- **URL al fallar:** about:blank

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 4 | step | Valencia es uno de los diez puertos que no listan ninguna área |
| 11 | step | plantar un motivo que dice que ahí no hay nada que consultar |
| 12 | step | construir y leer la página de Valencia |
| 31932 | step | la página sigue diciendo «Ninguna a menos de 30 km», y ahora también el permiso |

## El error

```
Error: el motivo del dato convierte «no hay áreas» en «no hay nada que consultar»

expect(received).not.toMatch(expected)

Expected pattern: not /no hay ninguna limitación/iu
Received string:      "Áreas marinas protegidas a menos de 30 km Los espacios marinos protegidos que este puerto tiene cerca, según la Red de Áreas Marinas Protegidas de España. Esta página dice cuáles son y a qué distancia aproximada están; no dice qué se puede hacer dentro de cada uno, porque eso lo fija la declaración oficial de cada espacio y no está aquí. Y no dice en ningún caso dónde se puede pescar: para eso haría falta una fuente que no tenemos. Solo la declaración oficial de cada espacio define sus límites y su régimen. Que no haya un área protegida cerca no autoriza a pescar: esto dice dónde NO se puede, nunca dónde sí. Ninguna a menos de 30 km de este puerto. ninguna área marina protegida de RAMPE 2025 tiene su borde a menos de 30 km de este puerto, y el puerto tampoco cae dentro de ninguna, así que por este concepto no hay ninguna limitación que consultar antes de salir de este puerto. Si guardas este puerto, esta lista se guarda con él y se puede leer sin cobertura; el resto del sitio no se guarda solo. Lo que leas sin red puede ser una copia de hace semanas: los espacios protegidos se declaran y se amplían por norma, y esta página no se entera hasta que se vuelve a construir. Fuentes de esta sección · Ministerio para la Transición Ecológica y el Reto Demográfico · RAMPE 2025, Red de Áreas Marinas Protegidas de España (MITECO · RAMPE 2025 — condiciones de uso no declaradas en origen) · Ingesta de la fuente del domingo, 30 de agosto de 2026."
    at /home/user/mareia/tests/e2e/journeys/adversarial/a12-la-regla-dura-viaja-como-texto-libre.spec.ts:164:11
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
