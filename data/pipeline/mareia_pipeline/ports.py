"""Los puertos objetivo del piloto y su identidad canónica.

El ``id`` sigue el patrón ``<país>-<provincia>-<slug>``: código ISO 3166-1 alpha-2 en minúsculas,
código de provincia ISO 3166-2 (o departamento, en Francia) y un slug ASCII del nombre del puerto.
"""

from __future__ import annotations

from dataclasses import dataclass


#: Radio por defecto en el que se busca mareógrafo para un puerto: lo que recorre una onda de marea
#: en costa abierta sin cambiar apreciablemente de forma.
DEFAULT_SEARCH_RADIUS_KM = 25.0


@dataclass(frozen=True)
class Port:
    """Un puerto del catálogo de Mareia, con las coordenadas de su dársena."""

    id: str
    name: str
    lat: float
    lon: float
    timezone: str
    #: Fichero de salida relativo a la raíz del repositorio.
    output: str
    #: Radio de búsqueda de mareógrafo. Ampliarlo es reconocer que el puerto no tiene uno propio, y
    #: se paga en el grade: la distancia al mareógrafo elegido es uno de los umbrales.
    search_radius_km: float = DEFAULT_SEARCH_RADIUS_KM


#: Los doce puertos españoles del piloto (T-05) más Brest, que es la referencia del coeficiente de
#: mareas francés que usa T-04. Coordenadas de la dársena/mareógrafo, no del centro urbano.
PILOT_PORTS: tuple[Port, ...] = (
    Port("es-po-vigo", "Vigo", 42.2406, -8.7207, "Europe/Madrid", "data/stations/es-po-vigo.json"),
    Port(
        "es-c-a-coruna",
        "A Coruña",
        43.3623,
        -8.3927,
        "Europe/Madrid",
        "data/stations/es-c-a-coruna.json",
    ),
    Port(
        "es-s-santander",
        "Santander",
        43.4623,
        -3.7900,
        "Europe/Madrid",
        "data/stations/es-s-santander.json",
    ),
    Port(
        "es-bi-bilbao", "Bilbao", 43.3550, -3.0450, "Europe/Madrid", "data/stations/es-bi-bilbao.json"
    ),
    Port("es-ca-cadiz", "Cádiz", 36.5340, -6.2800, "Europe/Madrid", "data/stations/es-ca-cadiz.json"),
    Port("es-h-huelva", "Huelva", 37.1300, -6.8340, "Europe/Madrid", "data/stations/es-h-huelva.json"),
    Port(
        "es-ma-malaga", "Málaga", 36.7130, -4.4160, "Europe/Madrid", "data/stations/es-ma-malaga.json"
    ),
    Port(
        "es-pm-palma",
        "Palma de Mallorca",
        39.5560,
        2.6300,
        "Europe/Madrid",
        "data/stations/es-pm-palma.json",
    ),
    # Costa de Murcia: el mareógrafo más cercano es el de Cartagena, a 25-27 km, así que ambos
    # ensanchan el radio de búsqueda a 30 km. Es zona micromareal (rango < 0,3 m): la marea
    # astronómica existe pero el residuo meteorológico la domina, y el grade lo refleja.
    Port(
        "es-mu-cabo-de-palos",
        "Cabo de Palos",
        37.6338,
        -0.6960,
        "Europe/Madrid",
        "data/stations/es-mu-cabo-de-palos.json",
        search_radius_km=30.0,
    ),
    # Lado mediterráneo de La Manga, NO la laguna interior del Mar Menor: el Mar Menor está casi
    # cerrado y no tiene marea astronómica utilizable.
    Port(
        "es-mu-la-manga",
        "La Manga del Mar Menor",
        37.7333,
        -0.7167,
        "Europe/Madrid",
        "data/stations/es-mu-la-manga.json",
        search_radius_km=30.0,
    ),
    Port(
        "es-gc-las-palmas",
        "Las Palmas de Gran Canaria",
        28.1420,
        -15.4130,
        "Atlantic/Canary",
        "data/stations/es-gc-las-palmas.json",
    ),
    Port(
        "es-tf-santa-cruz-de-tenerife",
        "Santa Cruz de Tenerife",
        28.4780,
        -16.2340,
        "Atlantic/Canary",
        "data/stations/es-tf-santa-cruz-de-tenerife.json",
    ),
    Port(
        "fr-29-brest",
        "Brest",
        48.3828,
        -4.4949,
        "Europe/Paris",
        "data/brest/constituents.json",
    ),
)
