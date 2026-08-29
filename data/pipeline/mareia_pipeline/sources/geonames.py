"""Fuente del **catálogo de puertos**: el volcado público de GeoNames para España.

Hasta T-05 los doce puertos del piloto estaban escritos a mano, y eso escalaba mal por la razón que
gobierna esta trayectoria: doscientas coordenadas tecleadas de memoria son doscientos números que
nadie ha medido. El volcado de GeoNames es un fichero único (``ES.zip``, ~3 MB) que trae, con
licencia **CC-BY 4.0**, tres cosas que necesitamos y no podemos inventar:

* las **instalaciones portuarias** reales (``PRT``, ``HBR``, ``MAR``, ``ANCH``, ``DCK``, ``QUAY``)
  con sus coordenadas, que son las que se publican como coordenadas del puerto;
* los **núcleos de población** con su municipio, que es de donde sale el nombre del puerto;
* los **municipios** (``ADM3``) con su nombre oficial y acentuado.

Se descarga entero y de una vez a propósito. La alternativa evaluada —consultas a Overpass/OSM por
provincia— quedó descartada aquí: la política de egreso del entorno corta cualquier petición que
tarde más de unos segundos en responder, que es justo lo que hace una consulta de área de Overpass.
Un fichero que se baja en dos segundos no tiene ese problema y además no depende de que un servicio
público nos deje sitio en su cola.

**Sobre la reproducibilidad**: GeoNames no publica versiones, así que aquí no hay un equivalente al
commit fijado de ``tide_database``. Lo que sí se registra —y se cita en el informe QC— es la huella
sha256 del volcado que se usó, de modo que dos ejecuciones que coincidan en huella partieron del
mismo dato y una que no coincida se ve. El artefacto congelado es ``data/geo/ports.json``, que se
commitea.
"""

from __future__ import annotations

import io
import zipfile
from dataclasses import dataclass

from mareia_pipeline.sources import cache

DUMP_URL = "https://download.geonames.org/export/dump/ES.zip"
ATTRIBUTION_URL = "https://www.geonames.org/"
LICENSE = "cc-by-4.0"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"

#: Columnas del volcado de GeoNames que usamos, por su posición en el TSV.
_GEONAME_ID = 0
_NAME = 1
_LAT = 4
_LON = 5
_FEATURE_CLASS = 6
_FEATURE_CODE = 7
_ADMIN1 = 10
_ADMIN2 = 11
_ADMIN3 = 12
_POPULATION = 14
_ELEVATION_DEM = 16

_COLUMNS = 19


@dataclass(frozen=True)
class GeoName:
    """Una entrada del volcado: instalación portuaria, núcleo de población o municipio."""

    geoname_id: str
    name: str
    lat: float
    lon: float
    feature_class: str
    feature_code: str
    #: Código de comunidad autónoma de GeoNames (``58`` Galicia, ``CE`` Ceuta…).
    admin1: str
    #: Código de provincia de GeoNames, que coincide con la matrícula (``PO``, ``BI``, ``TF``…).
    admin2: str
    #: Código de municipio (INE) al que pertenece la entrada.
    admin3: str
    population: int
    #: Altitud del modelo digital de elevaciones, en metros. ``-9999``/``-10000`` es «sin dato».
    dem: int


def _to_int(raw: str, default: int = 0) -> int:
    try:
        return int(raw)
    except ValueError:
        return default


def _parse(body: bytes) -> list[GeoName]:
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        text = archive.read("ES.txt").decode("utf-8")
    entries: list[GeoName] = []
    for line in text.splitlines():
        columns = line.split("\t")
        if len(columns) < _COLUMNS:
            continue
        try:
            lat = float(columns[_LAT])
            lon = float(columns[_LON])
        except ValueError:
            continue
        entries.append(
            GeoName(
                geoname_id=columns[_GEONAME_ID],
                name=columns[_NAME],
                lat=lat,
                lon=lon,
                feature_class=columns[_FEATURE_CLASS],
                feature_code=columns[_FEATURE_CODE],
                admin1=columns[_ADMIN1],
                admin2=columns[_ADMIN2],
                admin3=columns[_ADMIN3],
                population=_to_int(columns[_POPULATION]),
                dem=_to_int(columns[_ELEVATION_DEM], -9999),
            )
        )
    if not entries:
        raise RuntimeError(f"el volcado de GeoNames en {DUMP_URL} no traía entradas legibles")
    return entries


def load_dump(*, refresh: bool = False) -> tuple[list[GeoName], str]:
    """Descarga (o sirve de caché) el volcado de España y devuelve ``(entradas, huella sha256)``."""
    body = cache.fetch(DUMP_URL, suffix=".zip", refresh=refresh)
    return _parse(body), cache.sha256(body)
