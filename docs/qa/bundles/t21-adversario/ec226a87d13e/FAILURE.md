# Fallo de recorrido — adversarial/a12-la-regla-dura-viaja-como-texto-libre.spec.ts > A12 · el aviso de la fuente se publica en las 153 páginas sin que nadie lea lo que dice

- **snapshotId:** `ec226a87d13e` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `t21-adversario`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a12-la-regla-dura-viaja-como-texto-libre.spec.ts:83` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 32997 ms
- **URL al fallar:** about:blank

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 4 | step | el derivado publicado trae el aviso bueno: si no, un rojo posterior no probaría nada |
| 17 | step | plantar un aviso que conserva la subcadena exigida y le añade un permiso detrás |
| 18 | step | construir el sitio con ese derivado |
| 32924 | step | leer la sección en un puerto con áreas y en uno de los diez que no tienen ninguna |

## El error

```
Error: vigo: la sección publica un permiso plantado en el dato

expect(received).not.toMatch(expected)

Expected pattern: not /no hay veda/iu
Received string:      "Áreas marinas protegidas a menos de 30 km Los espacios marinos protegidos que este puerto tiene cerca, según la Red de Áreas Marinas Protegidas de España. Esta página dice cuáles son y a qué distancia aproximada están; no dice qué se puede hacer dentro de cada uno, porque eso lo fija la declaración oficial de cada espacio y no está aquí. Y no dice en ningún caso dónde se puede pescar: para eso haría falta una fuente que no tenemos. Solo la declaración oficial de cada espacio define sus límites y su régimen. Que no haya un área protegida cerca no autoriza a pescar sin licencia; con ella, en el resto no hay veda. Áreas marinas protegidas a menos de 30 km de Vigo, de la más cercana a la más lejana Área Figura Distancia aproximada Corredor migratorio galaico-cantábrico occidental Código RAMPE: ES0000554 ZEPA Zona de Especial Protección para las Aves a menos de 8 km Las distancias son aproximadas y se publican como cota: se miden al borde del área y se redondean al kilómetro hacia arriba. Un área que aquí figura a menos de 9 km puede estar de verdad más cerca. No son una medida y no sirven para decidir dónde empieza un espacio protegido: eso solo lo dice su declaración oficial. La figura es la clase de protección con la que la fuente clasifica cada espacio. Aquí se desarrolla la sigla y nada más: lo que cada figura permite o prohíbe está en la declaración oficial del espacio, y varía de uno a otro aunque compartan figura. Si guardas este puerto, esta lista se guarda con él y se puede leer sin cobertura; el resto del sitio no se guarda solo. Lo que leas sin red puede ser una copia de hace semanas: los espacios protegidos se declaran y se amplían por norma, y esta página no se entera hasta que se vuelve a construir. Fuentes de esta sección · Ministerio para la Transición Ecológica y el Reto Demográfico · RAMPE 2025, Red de Áreas Marinas Protegidas de España (MITECO · RAMPE 2025 — condiciones de uso no declaradas en origen) · Ingesta de la fuente del domingo, 30 de agosto de 2026."
    at /home/user/mareia/tests/e2e/journeys/adversarial/a12-la-regla-dura-viaja-como-texto-libre.spec.ts:117:89
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
