# data/pipeline — constantes armónicas → dataset canónico

Pipeline Python offline que convierte constantes armónicas públicas en el dataset canónico de
Mareia: `data/stations/<id>.json` (schema `station/v1`) para los doce puertos piloto, más
`data/brest/constituents.json`, que es la referencia del coeficiente de mareas (T-04).

Genera además el informe QC de `reports/`, que es donde vive la parte incómoda: qué mareógrafo se
eligió y por qué, cuánto se equivoca la predicción contra el mar de verdad y qué grade se ganó.

## Reproducirlo

```sh
cd data/pipeline
make all            # entorno + dataset + informe QC + tests
```

Paso a paso, si se prefiere:

```sh
make venv           # entorno virtual con las dependencias pinneadas de requirements.txt
make fetch          # calienta la caché de descargas
make build          # escribe los JSON de estación y el informe QC
make check          # valida contra el schema los JSON commiteados (sin red)
make test           # suite de tests (sin red)
make clean-cache    # borra las descargas para probar el camino desde cero
```

Requisitos: Python ≥ 3.11 y `git` (se usa para traer la fuente de constantes fijada a un commit).
Ninguna credencial: todas las fuentes son públicas y anónimas.

`make build` **no es determinista bit a bit**, y a propósito: la ventana de validación son los
últimos 30 días, así que las métricas de calidad cambian cada día que se ejecuta. Lo que sí es
reproducible es el **dataset**: las constantes salen de un commit fijado
(`sources/tide_database.PINNED_COMMIT`), y cada JSON lleva la huella sha256 del contenido del que
se derivó.

## De dónde salen los datos

| Fuente | Qué aporta | Licencia | ¿Se commitea? |
|---|---|---|---|
| [TICON-4](https://www.seanoe.org/data/00980/109129/) vía [`openwatersio/tide-database`](https://github.com/openwatersio/tide-database) | Constantes armónicas por mareógrafo | CC-BY 4.0 o CC-BY-NC 4.0 **según estación** | Sí, con su atribución dentro del JSON |
| [IOC Sea Level Monitoring](https://www.ioc-sealevelmonitoring.org/) | Nivel del mar observado, para medir el error | Sólo validación interna | **No**: se queda en la caché |
| REDMAR / Puertos del Estado | — | — | No viable hoy (ver informe QC) |

**Cuidado con la licencia**: no todas las estaciones son CC-BY 4.0. Donde el único mareógrafo
disponible llega vía CMEMS, la licencia de origen es **CC-BY-NC 4.0** (restricción del proveedor
GESLA aguas arriba). Va declarada estación por estación en `source.primary.license` y en
`source.attribution[].license`, y la política de reconciliación prefiere CC-BY 4.0 precisamente para
no contaminar el dataset más de lo necesario.

## Cómo está montado

```
mareia_pipeline/
  ports.py             los 11 puertos objetivo y su identidad canónica
  geo.py               distancia de círculo máximo
  sources/
    cache.py           descarga HTTP con caché en .cache (ignorada por git)
    tide_database.py   constantes armónicas, fijadas a un commit
    ioc.py             observaciones de nivel del mar (sólo validación)
  tides/
    constituents.py    catálogo de Doodson
    astro.py           argumentos astronómicos y correcciones nodales de Schureman
    predict.py         síntesis armónica y localización de extremos
  engine_contract.py   qué constituyentes acepta el motor de producción (truncado)
  reconcile.py         política de selección de mareógrafo → documento station/v1
  validate.py          métricas: RMSE, extremos, contraste entre fuentes, truncado
  grade.py             umbrales A/B/C
  report.py            informe QC en markdown
  schema.py            validación contra data/stations/station.v1.schema.json
run.py                 CLI: fetch | build | check
```

### El motor de predicción

La validación necesita predecir marea, así que el pipeline lleva su propia síntesis armónica
(números de Doodson + correcciones nodales de Schureman, sólo con `numpy`). No usa `utide` ni
`pytides2`: el segundo fija una versión de numpy que ya no compila en Python 3.11 y el primero es
mucha dependencia para lo que hace falta.

Un motor propio es superficie de error propia, así que está atado por dos sitios:

1. `tests/test_constituent_speeds.py` contrasta las velocidades que se derivan del catálogo contra
   la **tabla publicada** de velocidades. Caza las erratas de número de Doodson, que son mudas.
2. `tests/test_reference_engine.py` compara 25 horas de predicción contra la implementación de
   referencia `@neaps/tide-predictor`, sobre una estación sintética escogida para incluir los
   constituyentes de convenio delicado.

Ese segundo pase encontró los dos fallos que el motor tuvo al nacer: la época de Schureman
desplazada media jornada (unos 25 minutos de error en la hora de pleamar) y los compuestos de aguas
someras con el desfase de 90° puesto a mano en vez de heredado de sus progenitores. Contra
observaciones reales, el antes y el después en Brest fue de 0,375 m a 0,077 m de RMSE.

### El truncado al motor de producción

TICON-4 publica hasta 50 constantes por estación; el motor de `packages/domain-core` implementa el
juego estándar de **37** de NOAA y lanza `UnsupportedConstituentError` ante cualquier otra. El
dataset se trunca a ese juego **antes de emitirse** —un contrato que el consumidor no puede cumplir
no es un contrato— y lo descartado se conserva en `source.dropped_constituents` de cada JSON con su
amplitud y su fase. El coste medido de ese truncado aparece en el informe QC y **influye en el
grade**: en Brest son 2,2 cm RMS, suficiente para que no llegue a A.

### El grade

Los umbrales están en `grade.py` y se fijaron antes de medir. La comparación se hace sobre las
métricas **tal como se publican** en el informe, redondeadas a 4-5 decimales: no hay un valor
secreto distinto del de la tabla, y salvo dentro de esa última cifra no hay margen de gracia — quien
rebasa el umbral **baja**.

La jerarquía de la evidencia: las observaciones mandan; el contraste entre fuentes es un **veto**
(sirve para desmentir, no para acreditar), así que un puerto con un solo mareógrafo no es peor por
tenerlo; y la **distancia al mareógrafo elegido** es un umbral por sí sola, para que un puerto que
toma prestadas las constantes de 25 km más allá no herede el grade de quien se las presta.

Dos cosas que el grade **no** puede medir y por eso las declara en vez de inventarlas:

- En puertos **micromareales** (rango < 0,5 m) el residuo meteorológico domina la señal. La marea se
  calcula igual de bien, pero el RMSE normalizado se dispara y el grade baja. Ahí el valor para el
  usuario está en el solunar y la meteorología, no en la tabla de pleamares.
- Cuando la observación tiene muchos más extremos que la marea —justo el caso anterior—, el error de
  hora de pleamar **no se publica**. Emparejar contra un registro así siempre encuentra un extremo
  al lado y devuelve un número excelente y falso. El corte está en
  `validate.MAX_OBSERVED_EXTREMES_RATIO` (hoy **×2**) y se aplica contra los extremos predichos
  **dentro de la ventana que el mareógrafo llegó a cubrir**, no contra los de los 30 días: si la
  serie sólo abarca diez, comparar con treinta disimularía el exceso. Los dos contadores se publican
  en `quality.metrics` (`observed_extremes` y `predicted_extremes_in_window`), de modo que la
  decisión se puede rehacer desde el JSON sin ejecutar nada.

## Añadir un puerto

Añádelo a `PILOT_PORTS` en `ports.py` con su `id` canónico, sus coordenadas de dársena y su zona
horaria, y ejecuta `make build`. Si no hay mareógrafo a menos de 25 km, el pipeline falla en voz
alta en vez de emitir un JSON inventado.

Si el puerto de verdad no tiene mareógrafo cerca, se le puede ampliar el radio con
`search_radius_km=` —así entran Cabo de Palos y La Manga, que dependen del de Cartagena a 25 y
27 km—, pero eso no es gratis: la distancia es un umbral del grade y ninguno de los dos puede pasar
de B por ese solo hecho.
