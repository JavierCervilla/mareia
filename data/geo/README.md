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

## `areas-protegidas.json` — las áreas marinas protegidas de cada puerto (schema `areas-protegidas/v1`)

Por puerto, las áreas marinas protegidas que tiene a menos de **30 km**: su nombre oficial, su tipo,
su código y a qué distancia aproximada están. Sale de **RAMPE 2025** (MITECO), la Red de Áreas
Marinas Protegidas de España, y lo genera `python run.py areas-protegidas` desde `data/pipeline`.

```json
{
  "slug": "cabo-de-palos",
  "areas": [
    {
      "nombre": "Reserva marina de Cabo de Palos e Islas Hormigas",
      "tipo": "RESERVA MARINA",
      "codigo": "555552487",
      "distanciaAproxKm": 1.0,
      "dentro": false
    }
  ],
  "motivo": null
}
```

<!-- gate:areas-protegidas -->
| | |
|---|---|
| Áreas en la fuente | **86** (48 en `Rampe_p.geojson`, 38 en `Rampe_c.geojson`) |
| Vértices en la fuente | **1.076.504**, y **ninguno** se publica |
| Tipos | 42 ZEPA · 32 ZEC · 10 RESERVA MARINA · 1 ZEC/AMP · 1 AMP |
| Puertos con al menos un área a ≤ 30 km | **143 de 153** |
| Relaciones puerto–área publicadas | **342** |
| Puertos sin ninguna, que lo dicen en el propio dato | **10** |
| Reparto | 54 puertos con 1 área · 34 con 2 · 19 con 3 · 22 con 4 · 9 con 5 · 5 con 6 |
<!-- /gate:areas-protegidas -->

Las cifras de este bloque **no están tecleadas**: `tests/test_rampe_areas.py` las recalcula desde el
JSON publicado y se pone en rojo si el README y el dato dejan de decir lo mismo. Es la lección de
T-19, donde se coló un censo que no reproducía.

### Tres cosas que hay que saber antes de usarlo

**1 · La distancia es una aproximación, y el nombre del campo lo dice.** `distanciaAproxKm` es la
distancia al **vértice más cercano** del área, redondeada a la décima de kilómetro. No es la
distancia al borde real del polígono: el vértice está igual de lejos o más lejos, así que este
número **aleja y nunca acerca**. Un área que aparezca a 12 km puede estar de verdad a 11; una que no
aparezca no está a menos de 30. No debe presentarse como una medida.

**2 · Por eso está `dentro`.** El único caso en que la distancia al vértice engañaría hacia el lado
peligroso es un puerto **dentro** de un área grande y lejos de todos sus vértices, así que además se
comprueba si el punto cae dentro del polígono, huecos excluidos. Medido sobre RAMPE 2025: hay **10**
puertos dentro de un área y los diez están además a 0,1 km o menos de un vértice, o sea que hoy esta
comprobación no rescata ninguna relación que la distancia no encontrara. Se queda igual porque
publica un hecho distinto y más fuerte —«estás dentro»— y porque el modo de fallo que tapa seguiría
siendo invisible el día que RAMPE publique un área mayor.

**3 · Los diez puertos sin ninguna área están en el fichero, con su motivo.** No faltan: traen
`areas: []` y un `motivo` que dice hasta dónde se ha mirado. Una sección que desaparece se lee como
«no hay nada que saber»; una que dice «ninguna a menos de 30 km» dice lo que sabemos. Y el aviso que
viaja en `fuente.aviso` es el que manda sobre todo lo demás: **que no haya un área protegida cerca no
autoriza a pescar**. Este dato dice dónde **no** se puede, nunca dónde sí.

### Licencia: no declarada en origen, y qué consecuencia tiene

La página de descarga de RAMPE **no declara licencia ni condiciones de uso** (verificado el
2026-08-30). No se le inventa una: el dataset publica
`"licencia": "MITECO · RAMPE 2025 — condiciones de uso no declaradas en origen"`. La consecuencia
práctica es la que manda y es la que da forma al fichero: se publican **hechos derivados** —nombre
oficial, tipo, código, distancia aproximada— y **no las geometrías**, que es justo lo que una
licencia no declarada no permite redistribuir. Ni un vértice, ni un polígono, ni una caja
envolvente, ni geometría simplificada.

Sólo la declaración oficial de cada espacio define sus límites y su régimen. Este dataset no publica
qué se puede hacer en cada área: eso vive en fichas sin estructurar y sería un puntero, no un dato.

### Los cuatro gates, y qué garantiza cada uno

Los tres primeros corren en `python run.py check`, o sea sin red y en CI. Los cuatro tienen su
recorrido **en rojo** además del verde: un gate que no se ha visto fallar cuenta como cobertura y no
lo es.

| Gate | Qué ata | Dónde |
|---|---|---|
| **P1 · reproyección** | La inversa de Krüger cae donde debe: arco de meridiano por cuadratura, invariantes exactas de UTM, escala `k0` y dos anclas geográficas contra el puerto homónimo de `ports.json` | `mareia_pipeline/utm.py` |
| **P2 · sin geometría** | En el artefacto no hay ni una clave de geometría, ni una lista de números, ni un puerto que pase de 2 kB | `mareia_pipeline/areas.py` |
| **P4 · CRS leído** | El EPSG sale del fichero y se compara con un mapa cerrado; lo desconocido **aborta**, sin zona por defecto | `mareia_pipeline/sources/rampe.py` |
| **Cobertura** | Están los 153 puertos, una vez cada uno, y el resumen se recalcula desde el contenido | `mareia_pipeline/areas.py` |

**Por qué P1 mide contra cuatro cosas y no contra una.** Un reproyector roto no falla: acierta a
producir una coordenada perfectamente formada a cientos de kilómetros de su sitio. La capa que lo
desmiente en vez de repetirlo es el **arco de meridiano por cuadratura numérica**, que no comparte
una línea de código con la serie de Krüger; las invariantes cazan un signo cambiado; la escala ata
la longitud; y las **anclas geográficas** —Cabo de Palos a 7,96 km de su puerto, El Hierro a 17,93 km
del suyo, con 25 km de tolerancia— son las únicas que pueden cazar la **zona equivocada**, que con
los mismos puntos da errores de entre 520 y 1.169 km.

**Y lo que P4 no alcanza, escrito para que nadie lo suponga cubierto.** P4 caza que el CRS falte, que
sea desconocido o que el fichero declare metros y contenga grados. **No** caza un EPSG conocido pero
equivocado: `Rampe_c.geojson` leído con `EPSG:25830` cae en 29,73 N · 0,25 O, el Mediterráneo frente
a Alicante, con toda la pinta de un dato bueno. Eso sólo lo ve el ancla geográfica de P1.

### El fixture: qué garantiza y qué no

Los 54,8 MB de GeoJSON de la fuente no se commitean, así que `data/pipeline/tests/fixtures/rampe`
es un **recorte**: 7 de las 86 áreas —4 de `Rampe_p` y 3 de `Rampe_c`, 2.395 vértices— con su bloque
`crs` intacto y sus coordenadas exactamente las de la fuente (los mismos `float64`; el texto se
re-serializa, así que **no** es un subconjunto de bytes del original, como sí lo eran los fixtures
del BOE en T-19).

* **Garantiza** que el CRS se lee de verdad y no se supone —los dos bloques `crs` son los de MITECO,
  uno por zona—, que cada zona se reproyecta con la suya, que los agujeros de los polígonos
  sobreviven (la reserva de Cabo de Palos es un polígono de tres anillos; el Área marina de la
  Isleta, tres polígonos y cinco anillos) y que se recorren todos los caminos de aborto.
* **No garantiza** el censo ni ninguna cifra del derivado. Eso vive en el artefacto publicado y lo
  comprueba `run.py check`, no los recorridos con fixture.

Las áreas elegidas para el recorte, y por qué cada una: `555552487` Cabo de Palos (el ancla de P1, y
trae agujeros), `ES90ATL01` El Cachucho (el único `ZEC/AMP`), `ES0000498` Banco de Galicia y
`ES6170036` Estepona (pequeñas), `ES0000535` Banco de la Concepción, `ES7020120` Sebadal de San
Andrés y `ES7010016` Área marina de la Isleta (multipolígono con agujeros). El único tipo que el
recorte no cubre es `AMP`, porque su única área —el Corredor de Migración de Cetáceos del
Mediterráneo— trae 7.425 vértices y no cabe en un fixture.

**Nota de método**: se probó usar `SupGIS_ha` —la superficie que la propia fuente declara— como
comprobación cruzada de la reproyección, y **se descartó tras medirla**: reproduce el área con una
desviación mediana del 0,2 %, pero **no discrimina la zona equivocada** (reproyectar con la zona de
al lado casi conserva el área). Un gate que no separa lo bueno de lo malo no es un gate.
