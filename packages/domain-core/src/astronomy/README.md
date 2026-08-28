# astronomy/ — efemérides observacionales

Ortos y ocasos de Sol y Luna (con acimut), crepúsculos civil/náutico/astronómico, fase lunar
(edad, iluminación, próximos cuartos), tránsito superior e inferior y distancia lunar.

El instante entra y sale como **epoch ms UTC** (`EpochMs`), igual que en `tides/`. Aquí no hay
zonas horarias: proyectar sobre un día civil es cosa de `solunar/`.

## La dependencia de runtime

`astronomy-engine` (MIT, pinneado a una versión exacta, sin dependencias transitivas) es la
**única dependencia de runtime de `domain-core`**, y la importa **un solo fichero**: `engine.ts`.
Es la excepción aprobada en el Design Doc bajo el epígrafe «matemática vendorizada».

El motivo es de riesgo, no de comodidad: una efeméride mal implementada no explota, devuelve una
hora plausible y falsa: reimplementar VSOP87/ELP a mano es justo donde nace el slop numérico. A
cambio, el resto del paquete sigue siendo TypeScript puro y el acceso está detrás de la interfaz
`AstronomyGateway`, así que cambiar de motor es reescribir `engine.ts` y nada más.

## Convenciones (las que hay que respetar para comparar con efemérides publicadas)

| Magnitud | Convención |
|---|---|
| Orto / ocaso | Cruce del **borde superior** del disco por el horizonte, con refracción estándar y —para la Luna— su paralaje. Es la del USNO y el *Astronomical Almanac*. |
| Crepúsculos | Altura **geométrica** del centro del Sol, **sin** refracción: −6° (civil), −12° (náutico), −18° (astronómico). |
| Tránsito | Paso por el meridiano local: ángulo horario 0 h (superior) o 12 h sidéreas (inferior). |
| Acimut | Grados desde el norte hacia el este: 0 = N, 90 = E, 180 = S, 270 = O. |
| Longitud | Positiva al **este** (ISO 6709). Las Palmas y Madrid son negativas. |

La distinción refractada/geométrica no es cosmética: en el horizonte valen medio grado de
diferencia, es decir varios minutos de reloj. Por eso `horizontalPosition` la hace explícita
(`{ refraction: "standard" | "none" }`, `standard` por omisión) y la devuelve en el resultado, en
vez de dejarla implícita en la implementación.

## Casos sin evento: nunca `null`

En latitudes altas un día puede no tener orto, ocaso o crepúsculo astronómico. `SkySearch<T>` es
una unión discriminada: o `{ outcome: "event", … }` o `{ outcome: "no-event", reason:
"always-above" | "always-below", … }`. El consumidor está obligado a ramificar y no puede
tragarse un `null` mudo y pintar «--:--» sin saber si es sol de medianoche o noche polar.

El tránsito **no** usa esa unión: existe siempre, una vez por día sidéreo del cuerpo, también en
el polo.

## Edad lunar

`ageDays` es el tiempo transcurrido desde la **luna nueva anterior real**, no la elongación
reescalada a días. La diferencia entre ambas llega a medio día cerca del perigeo, porque la Luna
no recorre su órbita a velocidad constante. `phaseAngle_deg` sí es la elongación eclíptica
Luna−Sol en [0, 360).

`name` da nombre de cuarto (`new`, `first-quarter`, `full`, `last-quarter`) solo dentro de ±1° de
elongación (≈ ±2 h) del instante exacto: los cuartos son instantes, no intervalos, y sin esa
tolerancia esos cuatro nombres serían inalcanzables. **No confundir con el `curphase` del USNO**,
que es una etiqueta para el día entero.

## Verificación

Los tests contrastan contra efemérides del USNO commiteadas en
`__tests__/fixtures/usno/` (ver su README para la procedencia exacta). Errores máximos medidos
sobre 8 fechas de 2026 × 2 sitios (Madrid y Las Palmas):

| Magnitud | Error máximo | Tolerancia del test |
|---|---|---|
| Orto/ocaso del Sol | 0,49 min | ±2 min |
| Orto/ocaso de la Luna | 0,48 min | ±2 min |
| Tránsito superior (Sol y Luna) | 0,49 min | ±3 min |
| Crepúsculo civil | 0,49 min | ±2 min |
| Cuartos lunares de 2026 (50) | 1,33 min | ±1 h |

El USNO tabula al minuto, así que un error de ≤0,5 min es acuerdo perfecto: lo que queda es el
redondeo de la fuente, no error nuestro.
