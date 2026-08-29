# mareia-api

API HTTP (Deno + Express) del core: el catálogo de puertos y todo lo que se puede calcular de ellos
sin depender de nadie —marea, almanaque, efemérides y periodos solunares—. Lo que sí depende de
terceros (meteorología) llega como **módulo** bajo `/v1/modules/<id>`, ver
[`src/modules.config.ts`](src/modules.config.ts).

```sh
deno task dev     # con recarga
deno task check   # tipos
deno task test    # contract tests contra el dataset real de ../../data
```

## Endpoints

| Ruta | Qué devuelve |
|---|---|
| `GET /health` | Salud del servicio |
| `GET /v1/modules` | Módulos activos y sus atribuciones |
| `GET /v1/ports` | Catálogo: los puertos de la costa española con su jerarquía región/provincia y la **calidad** de cada uno |
| `GET /v1/ports/:slug` | Ficha del puerto + estación, datum, calidad y atribuciones |
| `GET /v1/ports/:slug/tides?from&to[&step]` | Pleamares y bajamares + curva muestreada |
| `GET /v1/ports/:slug/almanac/:year` | El año entero de extremos, agrupado por día civil |
| `GET /v1/ports/:slug/astro?date` | Sol y Luna: ortos, ocasos, crepúsculos, tránsitos, fase |
| `GET /v1/ports/:slug/solunar?date` | Periodos mayores y menores con su rating |

### La calidad que publica el catálogo (T-14B)

Cada entrada de `GET /v1/ports` lleva un objeto `quality` con cuatro campos, para que **filtrar el
catálogo por calidad cueste una petición y no 153**:

| Campo | Tipo | Qué es |
|---|---|---|
| `grade` | `"A" \| "B" \| "C"` | El grade del control de calidad del pipeline. Sus umbrales, abajo. |
| `estimated` | `boolean` | `true` si la marea del puerto es una **estimación**: constantes armónicas prestadas de un mareógrafo que no está en su dársena, o sin observaciones suyas con las que contrastar la predicción. |
| `rmse_m` | `number \| null` | Error cuadrático medio de la predicción frente a la observación, en metros. `null` = **no hubo observación** con la que medirlo. |
| `hw_time_err_p95_min` | `number \| null` | Error de hora de la pleamar, percentil 95, en minutos. `null` = la observación existe pero **no tiene pleamares identificables** (marea de centímetros con residuo meteorológico por encima). |

Los dos `null` son **dato, no hueco**: viajan como `null` y no se omiten del objeto. Las frases que
explican *por qué* (`grade_reason`, `estimated_reason`) siguen solo en `GET /v1/ports/:slug`, dentro
de `station.quality`: son un párrafo por puerto y una lista no es donde se lee un párrafo.

#### Qué significa cada `grade`, con su umbral

Los umbrales se fijaron **antes** de medir y se comparan en crudo: un puerto que se queda a un pelo
**baja** de grade, no sube (`data/pipeline/mareia_pipeline/grade.py`).

| Umbral | Grade A | Grade B |
|---|---|---|
| Distancia del mareógrafo a la dársena | ≤ 5 km | ≤ 30 km |
| Antigüedad del registro del que se analizaron las constantes | ≥ 10 años | ≥ 1 año |
| Coste de truncar al catálogo de constituyentes del motor | ≤ 1 cm RMS | ≤ 3 cm RMS |
| RMSE normalizado por el rango de marea de la ventana validada | ≤ 0,05 | ≤ 0,15 |
| Error de hora de extremo (p95) | ≤ 20 min | ≤ 45 min |
| Discrepancia con el mejor análisis independiente, **si lo hay** | ≤ 0,05 m | ≤ 0,15 m |

- **A** — cumple **todos** los de su columna, incluida la validación contra observaciones propias.
- **B** — no llega a A pero cumple todos los de la suya. Un puerto **sin observaciones** puede llegar
  a B si un análisis independiente corrobora sus constantes; nunca a A, porque corroborar no es
  medir. Sin observaciones **ni** segunda fuente no hay con qué validar y se queda en C.
- **C** — no alcanza B. El motivo concreto —todos los umbrales que incumple, no solo el primero— va
  en `grade_reason` de la ficha.

El contraste entre fuentes es un **veto, no un requisito**: sirve para desmentir constantes, no para
acreditarlas, así que un puerto con un solo mareógrafo no baja de grade por tenerlo.

`estimated` es una pregunta distinta de `grade` y no se deduce de él: un puerto **no** es estimado
solo cuando se dan las dos cosas a la vez —mareógrafo a ≤ 5 km (el mismo umbral del grade A, para no
tener dos varas de medir) **y** observaciones suyas con las que contrastar—. En el catálogo de hoy,
**120 de 153 puertos son estimados**.

### Reglas que comparten todas las rutas del core

- **Las fechas son días civiles del puerto** (`YYYY-MM-DD` en su zona IANA), no ventanas UTC: pedir
  `from=to=2026-08-28` en Vigo devuelve de las 00:00 a las 24:00 locales, y el día del cambio de hora
  dura 23 o 25 horas.
- **Cada instante viaja dos veces**: `…UtcMs` (epoch ms UTC) y `…Utc` (ISO 8601). Nunca hay horas
  locales en la respuesta: la zona del puerto va aparte y quien pinta decide.
- **La procedencia acompaña al dato**: toda respuesta con alturas lleva `station.quality` (grade,
  RMSE, error de hora p95) y `station.attributions`, y el **catálogo** lleva su resumen en
  `quality` (ver arriba). En los puertos micromareales el error de hora no es medible y viaja como
  `null`: eso es el dato, no un hueco.
- **Límites publicados** (400 con `{ "error": "…" }` y el motivo): `tides` ≤ 40 días, `step` entre 1
  y 60 minutos y ≤ 6.000 puntos de curva, `almanac` solo el año en curso ±1.
- **Slug desconocido → 404**; parámetro repetido, ausente o mal formado → 400.
- **Caché**: las respuestas son deterministas (mismo dataset + misma fecha = misma respuesta), así
  que salen con `Cache-Control: public, max-age=86400`. Los errores, sin caché.

## Arquitectura

```
apps/api  →  @mareia/usecases  →  @mareia/domain-core
   │               ↑
   └──────  @mareia/adapters (data/geo/ports.json, data/stations/*.json)
```

`src/core-deps.ts` es el único sitio que sabe que el dataset son ficheros JSON en `data/`; las rutas
(`src/http/core-routes.ts`) solo traducen HTTP ↔ caso de uso, y los límites y la validación viven en
`@mareia/usecases` para que el build del sitio pueda reutilizarlos sin pasar por HTTP.
