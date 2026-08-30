# Fallo de recorrido — adversarial/a12-una-relacion-real-puede-desaparecer-de-su-puerto.spec.ts > A12 · quitarle a un puerto la reserva marina que tiene al lado tiene que poner algo en rojo

- **snapshotId:** `867abe4ad2f7` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `t21-adversario`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a12-una-relacion-real-puede-desaparecer-de-su-puerto.spec.ts:50` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 32015 ms
- **URL al fallar:** about:blank

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 5 | step | de partida: el Vendrell publica la reserva a 0,1 km y Carboneras no la publica |
| 15 | step | mover la relación: fuera de el Vendrell, dentro de Carboneras, y el total no se entera |
| 18 | step | construir el sitio con el derivado movido |
| 31935 | step | la página de el Vendrell ya no nombra la reserva que tiene a 100 metros |

## El error

```
Error: el Vendrell ha dejado de publicar una reserva marina real y ningún gate lo ha visto

expect(received).toContain(expected) // indexOf

Expected substring: "Reserva marina de Masía Blanca"
Received string:    "Áreas marinas protegidas a menos de 30 km Los espacios marinos protegidos que este puerto tiene cerca, según la Red de Áreas Marinas Protegidas de España. Esta página dice cuáles son y a qué distancia aproximada están; no dice qué se puede hacer dentro de cada uno, porque eso lo fija la declaración oficial de cada espacio y no está aquí. Y no dice en ningún caso dónde se puede pescar: para eso haría falta una fuente que no tenemos. Solo la declaración oficial de cada espacio define sus límites y su régimen. Que no haya un área protegida cerca no autoriza a pescar: esto dice dónde NO se puede, nunca dónde sí. Áreas marinas protegidas a menos de 30 km de el Vendrell, de la más cercana a la más lejana Área Figura Distancia aproximada Espacio marino del Baix Llobregat-Garraf Código RAMPE: ES0000513 ZEPA Zona de Especial Protección para las Aves a menos de 9 km Espacio marino del Delta de l'Ebre-Illes Columbretes Código RAMPE: ES0000512 ZEPA Zona de Especial Protección para las Aves a menos de 13 km Las distancias son aproximadas y se publican como cota: se miden al borde del área y se redondean al kilómetro hacia arriba. Un área que aquí figura a menos de 9 km puede estar de verdad más cerca. No son una medida y no sirven para decidir dónde empieza un espacio protegido: eso solo lo dice su declaración oficial. La figura es la clase de protección con la que la fuente clasifica cada espacio. Aquí se desarrolla la sigla y nada más: lo que cada figura permite o prohíbe está en la declaración oficial del espacio, y varía de uno a otro aunque compartan figura. Si guardas este puerto, esta lista se guarda con él y se puede leer sin cobertura; el resto del sitio no se guarda solo. Lo que leas sin red puede ser una copia de hace semanas: los espacios protegidos se declaran y se amplían por norma, y esta página no se entera hasta que se vuelve a construir. Fuentes de esta sección · Ministerio para la Transición Ecológica y el Reto Demográfico · RAMPE 2025, Red de Áreas Marinas Protegidas de España (MITECO · RAMPE 2025 — condiciones de uso no declaradas en origen) · Ingesta de la fuente del domingo, 30 de agosto de 2026."
    at /home/user/mareia/tests/e2e/journeys/adversarial/a12-una-relacion-real-puede-desaparecer-de-su-puerto.spec.ts:99:7
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
