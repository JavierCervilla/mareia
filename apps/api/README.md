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
| `GET /v1/ports` | Catálogo: los 12 puertos con su jerarquía región/provincia |
| `GET /v1/ports/:slug` | Ficha del puerto + estación, datum, calidad y atribuciones |
| `GET /v1/ports/:slug/tides?from&to[&step]` | Pleamares y bajamares + curva muestreada |
| `GET /v1/ports/:slug/almanac/:year` | El año entero de extremos, agrupado por día civil |
| `GET /v1/ports/:slug/astro?date` | Sol y Luna: ortos, ocasos, crepúsculos, tránsitos, fase |
| `GET /v1/ports/:slug/solunar?date` | Periodos mayores y menores con su rating |

### Reglas que comparten todas las rutas del core

- **Las fechas son días civiles del puerto** (`YYYY-MM-DD` en su zona IANA), no ventanas UTC: pedir
  `from=to=2026-08-28` en Vigo devuelve de las 00:00 a las 24:00 locales, y el día del cambio de hora
  dura 23 o 25 horas.
- **Cada instante viaja dos veces**: `…UtcMs` (epoch ms UTC) y `…Utc` (ISO 8601). Nunca hay horas
  locales en la respuesta: la zona del puerto va aparte y quien pinta decide.
- **La procedencia acompaña al dato**: toda respuesta con alturas lleva `station.quality` (grade,
  RMSE, error de hora p95) y `station.attributions`. En los puertos micromareales el error de hora
  no es medible y viaja como `null`: eso es el dato, no un hueco.
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
