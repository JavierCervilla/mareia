# data/geo

Geometrías y metadatos geográficos de los puertos.

## `ports.json` — el catálogo público (schema `ports/v1`)

Los **12 puertos** del piloto: cómo se llaman, dónde están y de qué estación del dataset sale su
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

Escrito a mano, no generado: la jerarquía administrativa y los slugs son decisiones editoriales que
ningún pipeline puede tomar. Lo que sí está automatizado es que no se desincronice —
`packages/adapters/src/__tests__/dataset.test.ts` comprueba que cada puerto apunta a una estación
que existe, que copia sus coordenadas y su zona sin desviarse, y que el catálogo cubre el dataset
entero: ni estaciones huérfanas ni referencias muertas.

**Brest no está aquí a propósito**: `../brest/constituents.json` es la referencia del coeficiente de
mareas francés (T-04), no un puerto que se pueda visitar.
