# data/stations

Dataset canónico de constantes armónicas por puerto. Un fichero `<id>.json` por puerto, conforme a
[`station.v1.schema.json`](station.v1.schema.json), generado por [`data/pipeline`](../pipeline) y
commiteado: quien clona el repo tiene el dataset sin ejecutar nada.

`../brest/constituents.json` sigue el mismo schema; vive aparte porque no es un puerto del catálogo
sino la referencia del coeficiente de mareas francés (T-04).

## Licencia — leer antes de reutilizar

El dataset es derivado y **la licencia depende de la estación**, no del repositorio:

- La mayoría de los puertos vienen de mareógrafos publicados como **CC-BY 4.0**.
- Donde el único mareógrafo disponible llega vía CMEMS, la licencia de origen es **CC-BY-NC 4.0**
  (restricción del proveedor GESLA aguas arriba). Mareia es no comercial, así que el uso es
  conforme, pero **el dataset no se puede redistribuir entero como CC-BY 4.0**: quien lo reutilice
  comercialmente debe excluir esas estaciones.

La licencia de cada puerto está en su propio JSON, en `source.primary.license` y en
`source.attribution[].license`. La política de reconciliación prefiere CC-BY 4.0 cuando hay elección.

## Qué mirar dentro de cada fichero

| Campo | Qué cuenta |
|---|---|
| `datum` | Cero hidrográfico de referencia y altura del nivel medio sobre él |
| `constituents` | Constantes armónicas, ya truncadas al juego que soporta el motor de producción |
| `source.primary` | Mareógrafo elegido, su distancia a la dársena y la época de su análisis |
| `source.fallback` | Candidatas descartadas, para que la decisión sea auditable |
| `source.dropped_constituents` | Constantes que la fuente publica y el motor no soporta, con su amplitud |
| `quality` | RMSE contra observaciones, error de hora de extremo p95, `grade` y por qué |

`quality.rmse_m` es una **cota superior**: se mide contra nivel del mar observado, que incluye el
residuo meteorológico que ninguna predicción astronómica captura. El informe QC de
`../pipeline/reports/` explica los umbrales de cada grade y los desglosa puerto a puerto.

> ⚠️ **No apto para navegación.** Estas constantes son de fuentes abiertas y pueden diferir de las
> tablas oficiales de la autoridad hidrográfica correspondiente.
