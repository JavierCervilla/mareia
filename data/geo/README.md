# data/geo

Geometrías y metadatos geográficos de los puertos.

## `ports.json` — el catálogo público (schema `ports/v1`)

Los puertos de la costa española: cómo se llaman, dónde están y de qué estación del dataset sale su
marea. Es la lista que sirve `GET /v1/ports` y la que decide qué páginas genera el sitio.

```json
{
  "slug": "vigo",
  "name": "Vigo",
  "province": { "slug": "pontevedra", "name": "Pontevedra" },
  "region": { "slug": "galicia", "name": "Galicia" },
  "lat": 42.2406,
  "lon": -8.7207,
  "timezone": "Europe/Madrid",
  "stationFile": "es-po-vigo.json"
}
```

| Campo | Qué cuenta |
|---|---|
| `slug` | Identificador del puerto en la URL y en el API |
| `province` / `region` | Jerarquía geográfica, con **nombre y slug**: los tramos de la URL pública son `/<region>/<province>/<slug>` (p. ej. `/galicia/pontevedra/vigo`, `/region-de-murcia/murcia/cabo-de-palos`) |
| `lat` / `lon` / `timezone` | **Copia** de los del JSON de la estación: es lo que usan las efemérides y lo que define el día civil del puerto |
| `stationFile` | Fichero de `../stations/` con las constantes armónicas. Es infraestructura: **no viaja en las respuestas del API** |

**Generado por `data/pipeline` desde T-13** (`make build` lo reescribe entero), que es la única
forma de tener toda la costa sin teclear doscientas coordenadas de memoria. Lo editorial no
desapareció, se movió a donde se puede revisar: la tabla `catalog.PROVINCES` del pipeline, que fija
el nombre y el slug **en español** de cada provincia y de cada región —los tramos de la URL— porque
las etiquetas de la fuente vienen en inglés y mezcladas; y `ports.PILOT_PORTS`, donde siguen escritos
a mano los doce del piloto con las coordenadas de dársena de T-05 intactas.

Lo que está automatizado es que no se desincronice —`packages/adapters/src/__tests__/dataset.test.ts`
comprueba que cada puerto apunta a una estación que existe, que copia sus coordenadas y su zona sin
desviarse, y que el catálogo cubre el dataset entero: ni estaciones huérfanas ni referencias
muertas—, y `python run.py check` repite esa comprobación sin red antes de que llegue a CI.

**Atribución**: la identidad de los puertos derivados (nombre del municipio y coordenadas de la
dársena) viene del volcado de [GeoNames](https://www.geonames.org/), **CC-BY 4.0**. El crédito no
vive aquí sino dentro de cada JSON de estación derivado (`source.attribution`), que es lo que la
página publica al pie: la atribución viaja con el dato que la obliga.

**Brest no está aquí a propósito**: `../brest/constituents.json` es la referencia del coeficiente de
mareas francés (T-04), no un puerto que se pueda visitar.
