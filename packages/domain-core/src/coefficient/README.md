# Coeficiente de marea (`@mareia/domain-core/coefficient`)

El **coeficiente de marea** de la escala francesa: un número adimensional entre 20 y 120 que dice
cómo de grande es la marea de un día, sin hablar de ningún puerto en concreto. Lo calcula el SHOM
sobre **Brest** y vale por igual desde Dunkerque hasta San Juan de Luz.

```
C = 100 · (semirrango de la marea semidiurna en Brest) / U        U = 3,05 m
```

`U` es la **unidad de altura**: el semirrango medio de la marea de sizigia equinoccial en Brest. Un
coeficiente 100 es, por definición, esa marea; 120 es el techo histórico de la escala y 20 el suelo.

Módulo puro como el resto del dominio: los constituyentes de Brest entran **por parámetro**. El
fichero `data/brest/constituents.json` los tiene, pero abrirlo es cosa del llamante.

## API

| Función | Qué hace |
|---|---|
| `tidalCoefficients(station, fromUtcMs, toUtcMs, options?)` | Un coeficiente por pleamar del rango |
| `tidalCoefficientDay(station, dateIso, options?)` | Los del día civil, repartidos en mañana y tarde |
| `semidiurnalTide(station)` | La estación reducida a su onda semidiurna (lo que se predice) |
| `BREST_UNIT_HEIGHT_M`, `BREST_TIME_ZONE`, `MIN_/MAX_TIDAL_COEFFICIENT` | Las constantes de la escala |

Cada `TidalCoefficient` trae su evidencia: la pleamar de la que sale (`highWaterUtcMs`,
`highWater_m`), el `semiRange_m` medido, el `rawValue` continuo y si hubo que recortarlo
(`clamped`). El `value` —entero, en `[20, 120]`— es lo único que se publica.

## Dos decisiones que no son obvias

1. **Se calcula sobre la onda semidiurna**, no sobre la predicción completa. Los coeficientes
   publicados de una misma jornada son casi iguales entre sí (102/102, 93/93…), mientras que la
   marea real de Brest tiene desigualdad diurna. Medido contra los valores publicados de 2026: la
   marea completa se desvía hasta **5 unidades** y la reducción semidiurna se queda en **2**. La
   escala caracteriza la parte semidiurna de la marea astronómica, así que la estación se filtra a
   los constituyentes de especie 2 (`τ = 2`) antes de predecir.
2. **El semirrango se mide contra las dos bajamares adyacentes**, promediadas, y no contra el nivel
   medio del datum: así el resultado no depende de que `msl_offset_m` sea exactamente el nivel
   medio, y no cambia según por qué lado se mire una marea asimétrica.

Un día civil tiene **dos** pleamares o **una** —el día lunar dura 24 h 50 min—, y los almanaques
publican exactamente eso: dos coeficientes, o uno. `morning` y `afternoon` parten por el mediodía
local.

## Verificación

`src/coefficient/__tests__/` — dos suites, deterministas y sin red:

1. **Golden contra los coeficientes publicados** de Brest 2026 (32 valores de 18 días de tres
   meses): acuerdo exigido **±2 unidades**, con sesgo medio por debajo de 1. No puede ser cero
   porque nuestras constantes son las de TICON-4 y no las del SHOM. Incluye el experimento que
   justifica la reducción semidiurna. Procedencia: `__tests__/fixtures/README.md`.
2. **Propiedades** sobre 2026 entero (706 pleamares): la escala se respeta y se recorta contando,
   las 25 sizigias dan marea viva (≥ 70) y las 25 cuadraturas marea muerta (≤ 65) en ventanas de
   ±2 días, no hay saltos de más de 20 unidades entre días consecutivos, y el contrato de errores
   (estación sin onda semidiurna, constituyente desconocido, unidad de altura o fecha inválidas).

## Referencias

- SHOM, *Annuaire des marées* — definición de la escala y de la unidad de altura de Brest.
- B. Simon, *La marée océanique côtière*, Institut Océanographique (2007) — el coeficiente
  como cociente entre el semirrango del día y el de la sizigia equinoccial media.
