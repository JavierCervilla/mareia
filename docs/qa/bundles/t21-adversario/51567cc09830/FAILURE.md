# Fallo de recorrido — adversarial/a12-el-derivado-desviado-se-publica-igual.spec.ts > A12 · un derivado salido de una reproyección desviada tiene que poner algo en rojo

- **snapshotId:** `51567cc09830` — lo comparten TODOS los artefactos de este bundle.
- **runId:** `t21-adversario`
- **Test:** `/home/user/mareia/tests/e2e/journeys/adversarial/a12-el-derivado-desviado-se-publica-igual.spec.ts:74` (project `movil`, intento 0)
- **Estado:** failed (se esperaba passed) en 16288 ms
- **URL al fallar:** about:blank

## Qué se hizo, en orden

| t (ms) | tipo | qué |
|-------:|------|-----|
| 4 | step | de partida: los cinco `dentro` publicados son los que dice el derivado de hoy |
| 15 | step | aplicar los cinco vuelcos que produce el elipsoide desviado |
| 17 | step | construir el sitio con ese derivado |
| 16208 | step | Níjar deja de decir que el puerto cae dentro de la reserva marina, y nadie chista |

## El error

```
Error: Níjar ha dejado de decir que está dentro de la Reserva marina del Cabo de Gata-Níjar

expect(received).toContain(expected) // indexOf

Expected substring: "cae dentro de esta área"
Received string:    "Áreas marinas protegidas a menos de 30 km Los espacios marinos protegidos que este puerto tiene cerca, según la Red de Áreas Marinas Protegidas de España. Esta página dice cuáles son y a qué distancia aproximada están; no dice qué se puede hacer dentro de cada uno, porque eso lo fija la declaración oficial de cada espacio y no está aquí. Y no dice en ningún caso dónde se puede pescar: para eso haría falta una fuente que no tenemos. Solo la declaración oficial de cada espacio define sus límites y su régimen. Que no haya un área protegida cerca no autoriza a pescar: esto dice dónde NO se puede, nunca dónde sí. Áreas marinas protegidas a menos de 30 km de Níjar, de la más cercana a la más lejana Área Figura Distancia aproximada Reserva marina del Cabo de Gata-Níjar Código RAMPE: 555552486 RESERVA MARINA a menos de 1 km Bahía de Almería Código RAMPE: ES0000506 ZEPA Zona de Especial Protección para las Aves a menos de 8 km Las distancias son aproximadas y se publican como cota: se miden al borde del área y se redondean al kilómetro hacia arriba. Un área que aquí figura a menos de 9 km puede estar de verdad más cerca. No son una medida y no sirven para decidir dónde empieza un espacio protegido: eso solo lo dice su declaración oficial. La figura es la clase de protección con la que la fuente clasifica cada espacio. Aquí se desarrolla la sigla y nada más: lo que cada figura permite o prohíbe está en la declaración oficial del espacio, y varía de uno a otro aunque compartan figura. Si guardas este puerto, esta lista se guarda con él y se puede leer sin cobertura; el resto del sitio no se guarda solo. Lo que leas sin red puede ser una copia de hace semanas: los espacios protegidos se declaran y se amplían por norma, y esta página no se entera hasta que se vuelve a construir. Fuentes de esta sección · Ministerio para la Transición Ecológica y el Reto Demográfico · RAMPE 2025, Red de Áreas Marinas Protegidas de España (MITECO · RAMPE 2025 — condiciones de uso no declaradas en origen) · Ingesta de la fuente del domingo, 30 de agosto de 2026."
    at /home/user/mareia/tests/e2e/journeys/adversarial/a12-el-derivado-desviado-se-publica-igual.spec.ts:110:7
```

## Artefactos

- **screenshot** → `screenshot.png`
- **dom** → `dom.html`
- **events** → `events.jsonl`
- **bundle** → `bundle.json`
