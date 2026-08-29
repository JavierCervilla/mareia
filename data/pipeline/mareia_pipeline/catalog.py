"""El catálogo de puertos de la costa española, derivado del volcado de GeoNames.

Doce puertos se escriben a mano; doscientos, no. Este módulo convierte el volcado público de
GeoNames (ver ``sources/geonames.py``) en la lista de puertos que se publica, y —tan importante como
la lista— en el **registro de lo que se descartó y por qué**, que es lo que el informe QC enseña
para que nadie tenga que fiarse de que el filtro hizo lo correcto.

La política, en el orden en que se aplica:

1. **Sólo provincias costeras**, de la tabla editorial ``PROVINCES``. Esa tabla es la única parte
   escrita a mano de la jerarquía: el nombre y el slug de la provincia y de la región son los tramos
   de la URL pública, y las etiquetas de GeoNames (en inglés y mezcladas: «Andalusia», «Balearic
   Islands») no sirven para un portal en español.
2. **Una instalación portuaria real** como coordenada del puerto: ``PRT``, ``HBR``, ``MAR``,
   ``ANCH``, ``DCK`` o ``QUAY``. La coordenada publicada es la de la dársena, no la del centro del
   pueblo, porque es la que decide qué mareógrafo queda cerca.
3. **Altitud de costa**: se descarta la instalación por encima de ``MAX_HARBOUR_ELEVATION_M``, que
   es como se van los embalses y los pantanos con club náutico sin necesidad de una lista negra.
4. **Nombre del municipio**, no del muelle. La instalación se ata al núcleo de población más cercano
   y de ahí se sube al municipio (``ADM3``), que es quien tiene el nombre oficial y acentuado.
   «Puerto de A Coruña» → núcleo «A Coruña» → municipio «A Coruña»; «La Algameca Grande» → núcleo
   «Barrio de la Concepción» → municipio «Cartagena».
5. **Un puerto por municipio**, el de su núcleo más poblado. Dos dársenas del mismo municipio son el
   mismo puerto a efectos de marea mucho antes que dos puertos distintos.
6. **Aguas sin marea astronómica utilizable**: la laguna del Mar Menor está casi cerrada y su nivel
   lo mueve el viento, no la Luna. Es la única exclusión geográfica explícita y va con su motivo.
7. **Mareógrafo a menos de ``MAX_BORROW_KM``**. Más allá, el puerto no se publica: no hay constantes
   que prestarle sin describir otro sitio. Es el descarte que más puertos se lleva y el que más
   caro sería equivocarse en la otra dirección.
8. **Los doce del piloto mandan**: un candidato que caiga sobre uno de ellos —a menos de
   ``PILOT_EXCLUSION_KM`` o con su mismo slug— se descarta. Sus coordenadas y su identidad ya están
   publicadas y no se tocan.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass

from mareia_pipeline.geo import haversine_km
from mareia_pipeline.ports import Port
from mareia_pipeline.sources.geonames import GeoName
from mareia_pipeline.sources.tide_database import GaugeRecord

#: Códigos de instalación portuaria de GeoNames, **de más a menos representativa del puerto**. El
#: orden desempata cuando un municipio tiene varias: un puerto (``PRT``) describe mejor la dársena
#: que un fondeadero (``ANCH``) o un muelle suelto (``QUAY``).
HARBOUR_CODES: tuple[str, ...] = ("PRT", "HBR", "MAR", "ANCH", "DCK", "QUAY")

#: Altitud máxima admitida para una instalación portuaria, en metros. Un puerto de mar está al nivel
#: del mar; lo que está a 300 m es un club náutico de embalse, y ahí no hay marea que publicar.
MAX_HARBOUR_ELEVATION_M = 20

#: Radio en el que se busca el núcleo de población que da nombre al puerto.
NAMING_RADIUS_KM = 8.0

#: Distancia máxima al mareógrafo del que se toman prestadas las constantes. Es el **doble** del
#: umbral de grade B (30 km): dentro de esa horquilla el puerto se publica marcado como estimado y
#: con grade C, porque la distancia ya es un umbral del grade; más allá, describir la marea de otro
#: sitio deja de ser una estimación y pasa a ser otra cosa, así que el puerto no se publica.
MAX_BORROW_KM = 60.0

#: Radio alrededor de un puerto del piloto dentro del cual un candidato de GeoNames es ese mismo
#: puerto con otro nombre.
PILOT_EXCLUSION_KM = 6.0

#: La laguna del Mar Menor, en ``(lat_min, lat_max, lon_min, lon_max)``. Está prácticamente cerrada:
#: la marea astronómica que le entra por las golas es de milímetros y su nivel lo manda el viento.
#: El lado mediterráneo de La Manga (que sí tiene marea, y es el puerto del piloto) queda al este de
#: ``lon_max`` a propósito.
MAR_MENOR_BOX = (37.62, 37.82, -0.88, -0.72)


@dataclass(frozen=True)
class Province:
    """Una provincia costera, con la jerarquía que forma la URL pública del portal."""

    #: Código de provincia de GeoNames (``admin2``), que es la matrícula española.
    code: str
    name: str
    slug: str
    region_name: str
    region_slug: str
    timezone: str


def _province(code: str, name: str, slug: str, region: str, region_slug: str, tz: str) -> Province:
    return Province(code, name, slug, region, region_slug, tz)


#: Las provincias con costa, con el nombre y el slug **en español** que ya usan las URL publicadas
#: en T-09. La zona horaria es un hecho de la provincia entera y se declara aquí en vez de leerse de
#: GeoNames, que la publica entrada por entrada y se contradice a sí misma (dos muelles de Ceuta con
#: dos zonas distintas).
PROVINCES: tuple[Province, ...] = (
    _province("C", "A Coruña", "a-coruna", "Galicia", "galicia", "Europe/Madrid"),
    _province("LU", "Lugo", "lugo", "Galicia", "galicia", "Europe/Madrid"),
    _province("PO", "Pontevedra", "pontevedra", "Galicia", "galicia", "Europe/Madrid"),
    _province("O", "Asturias", "asturias", "Asturias", "asturias", "Europe/Madrid"),
    _province("S", "Cantabria", "cantabria", "Cantabria", "cantabria", "Europe/Madrid"),
    _province("BI", "Bizkaia", "bizkaia", "País Vasco", "pais-vasco", "Europe/Madrid"),
    _province("SS", "Gipuzkoa", "gipuzkoa", "País Vasco", "pais-vasco", "Europe/Madrid"),
    _province("GI", "Girona", "girona", "Cataluña", "cataluna", "Europe/Madrid"),
    _province("B", "Barcelona", "barcelona", "Cataluña", "cataluna", "Europe/Madrid"),
    _province("T", "Tarragona", "tarragona", "Cataluña", "cataluna", "Europe/Madrid"),
    _province(
        "CS", "Castellón", "castellon", "Comunitat Valenciana", "comunitat-valenciana",
        "Europe/Madrid",
    ),
    _province(
        "V", "Valencia", "valencia", "Comunitat Valenciana", "comunitat-valenciana", "Europe/Madrid"
    ),
    _province(
        "A", "Alicante", "alicante", "Comunitat Valenciana", "comunitat-valenciana", "Europe/Madrid"
    ),
    _province("MU", "Murcia", "murcia", "Región de Murcia", "region-de-murcia", "Europe/Madrid"),
    _province("AL", "Almería", "almeria", "Andalucía", "andalucia", "Europe/Madrid"),
    _province("GR", "Granada", "granada", "Andalucía", "andalucia", "Europe/Madrid"),
    _province("MA", "Málaga", "malaga", "Andalucía", "andalucia", "Europe/Madrid"),
    _province("CA", "Cádiz", "cadiz", "Andalucía", "andalucia", "Europe/Madrid"),
    _province("H", "Huelva", "huelva", "Andalucía", "andalucia", "Europe/Madrid"),
    _province("SE", "Sevilla", "sevilla", "Andalucía", "andalucia", "Europe/Madrid"),
    _province("PM", "Illes Balears", "illes-balears", "Illes Balears", "illes-balears", "Europe/Madrid"),
    _province("GC", "Las Palmas", "las-palmas", "Canarias", "canarias", "Atlantic/Canary"),
    _province(
        "TF", "Santa Cruz de Tenerife", "santa-cruz-de-tenerife", "Canarias", "canarias",
        "Atlantic/Canary",
    ),
    _province("CE", "Ceuta", "ceuta", "Ceuta", "ceuta", "Africa/Ceuta"),
    _province("ME", "Melilla", "melilla", "Melilla", "melilla", "Africa/Ceuta"),
)

BY_CODE: dict[str, Province] = {province.code: province for province in PROVINCES}


@dataclass(frozen=True)
class Discard:
    """Un candidato que no llegó al catálogo, con el motivo exacto por el que se quedó fuera."""

    name: str
    province: str
    lat: float
    lon: float
    #: Familia del motivo, para poder agregar el descarte en el informe QC.
    reason_kind: str
    reason: str


@dataclass(frozen=True)
class Catalogue:
    """El resultado de derivar el catálogo: lo que se publica y lo que no, con sus motivos."""

    ports: list[Port]
    discards: list[Discard]


def slugify(name: str) -> str:
    """Slug ASCII en minúsculas de un topónimo, tal y como aparece en la URL pública."""
    ascii_name = unicodedata.normalize("NFD", name)
    ascii_name = "".join(c for c in ascii_name if unicodedata.category(c) != "Mn")
    ascii_name = ascii_name.replace("ñ", "n").replace("Ñ", "n")
    slug = "".join(c.lower() if c.isalnum() else "-" for c in ascii_name)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")


def official_name(raw: str) -> str:
    """Normaliza el nombre de un municipio de GeoNames a la forma que se publica.

    Dos formas del volcado no valen tal cual en una página: la del artículo pospuesto («Masnou, El»)
    y la bilingüe con barra («Castellón de la Plana/Castelló»). Se deshace la primera y se toma la
    primera denominación de la segunda; no se traduce nada ni se elige por criterio lingüístico, que
    sería inventar.
    """
    name = raw.split("/")[0].strip()
    if "," in name:
        head, _, tail = name.partition(",")
        article = tail.strip()
        if article and len(article.split()) == 1:
            name = f"{article} {head.strip()}"
    return " ".join(name.split())


def _in_mar_menor(lat: float, lon: float) -> bool:
    lat_min, lat_max, lon_min, lon_max = MAR_MENOR_BOX
    return lat_min <= lat <= lat_max and lon_min <= lon <= lon_max


def _nearest(lat: float, lon: float, candidates: list[GeoName]) -> tuple[float, GeoName] | None:
    """El candidato más cercano al punto, filtrando antes por una caja para no medirlos todos."""
    near = [
        (haversine_km(lat, lon, item.lat, item.lon), item)
        for item in candidates
        if abs(item.lat - lat) < 0.12 and abs(item.lon - lon) < 0.16
    ]
    return min(near, key=lambda pair: pair[0]) if near else None


def _nearest_gauge(lat: float, lon: float, gauges: list[GaugeRecord]) -> tuple[float, GaugeRecord]:
    return min(
        ((haversine_km(lat, lon, gauge.lat, gauge.lon), gauge) for gauge in gauges),
        key=lambda pair: pair[0],
    )


@dataclass
class _Candidate:
    """Una instalación portuaria ya resuelta a municipio, antes de competir por representarlo."""

    harbour: GeoName
    settlement: GeoName
    municipality: str
    province: Province

    @property
    def rank(self) -> tuple[int, int, str]:
        """Orden de preferencia dentro de un municipio: núcleo más poblado, luego instalación mayor.

        El núcleo manda sobre el tipo de instalación porque es lo que distingue el puerto del pueblo
        de un fondeadero en un cabo: en Alicante, «Marina Alicante» (junto a la ciudad) y «Port la
        Caleta» (en Tabarca, 19 km mar adentro) son las dos del mismo municipio.
        """
        return (-self.settlement.population, HARBOUR_CODES.index(self.harbour.feature_code), self.harbour.name)


def _harbours(entries: list[GeoName]) -> list[GeoName]:
    return [
        entry
        for entry in entries
        if entry.feature_code in HARBOUR_CODES and entry.admin2 in BY_CODE and entry.admin1
    ]


def build(
    entries: list[GeoName], gauges: list[GaugeRecord], pilots: tuple[Port, ...]
) -> Catalogue:
    """Deriva el catálogo de puertos y el registro de descartes a partir del volcado."""
    municipalities = {
        (entry.admin1, entry.admin2, entry.admin3): entry
        for entry in entries
        if entry.feature_code == "ADM3"
    }
    settlements = [
        entry for entry in entries if entry.feature_class == "P" and entry.admin3 and entry.admin2
    ]
    discards: list[Discard] = []
    candidates: dict[tuple[str, str, str], _Candidate] = {}

    for harbour in _harbours(entries):
        province = BY_CODE[harbour.admin2]
        if harbour.dem > MAX_HARBOUR_ELEVATION_M:
            discards.append(
                Discard(
                    harbour.name, province.name, harbour.lat, harbour.lon, "tierra adentro",
                    f"la instalación está a {harbour.dem} m de altitud, por encima de los "
                    f"{MAX_HARBOUR_ELEVATION_M} m admitidos: no es un puerto de mar",
                )
            )
            continue
        if _in_mar_menor(harbour.lat, harbour.lon):
            discards.append(
                Discard(
                    harbour.name, province.name, harbour.lat, harbour.lon, "sin marea utilizable",
                    "está en la laguna del Mar Menor, prácticamente cerrada: el nivel lo mueve el "
                    "viento y no la marea astronómica",
                )
            )
            continue
        found = _nearest(harbour.lat, harbour.lon, settlements)
        if found is None or found[0] > NAMING_RADIUS_KM:
            discards.append(
                Discard(
                    harbour.name, province.name, harbour.lat, harbour.lon, "sin municipio",
                    f"no hay núcleo de población a menos de {NAMING_RADIUS_KM:.0f} km del que tomar "
                    "el nombre del puerto",
                )
            )
            continue
        _, settlement = found
        key = (settlement.admin1, settlement.admin2, settlement.admin3)
        municipality = municipalities.get(key)
        if municipality is None or settlement.admin2 not in BY_CODE:
            discards.append(
                Discard(
                    harbour.name, province.name, harbour.lat, harbour.lon, "sin municipio",
                    "el núcleo de población más cercano no declara municipio en el volcado",
                )
            )
            continue
        candidate = _Candidate(
            harbour=harbour,
            settlement=settlement,
            municipality=official_name(municipality.name),
            province=BY_CODE[settlement.admin2],
        )
        current = candidates.get(key)
        if current is None:
            candidates[key] = candidate
        elif candidate.rank < current.rank:
            candidates[key] = candidate
            discards.append(
                Discard(
                    current.harbour.name, current.province.name, current.harbour.lat,
                    current.harbour.lon, "segunda dársena",
                    f"{candidate.municipality} ya se publica con «{candidate.harbour.name}»: dos "
                    "dársenas del mismo municipio son el mismo puerto a efectos de marea",
                )
            )
        else:
            discards.append(
                Discard(
                    harbour.name, province.name, harbour.lat, harbour.lon, "segunda dársena",
                    f"{current.municipality} ya se publica con «{current.harbour.name}»: dos "
                    "dársenas del mismo municipio son el mismo puerto a efectos de marea",
                )
            )

    pilot_slugs = {port.slug for port in pilots if port.in_catalogue}
    ports: list[Port] = []
    taken: set[str] = {port.id for port in pilots}
    for candidate in sorted(candidates.values(), key=lambda c: (c.province.code, c.municipality)):
        harbour, province = candidate.harbour, candidate.province
        name = candidate.municipality
        slug = slugify(name)
        nearest_pilot = min(
            (
                (haversine_km(harbour.lat, harbour.lon, pilot.lat, pilot.lon), pilot)
                for pilot in pilots
                if pilot.in_catalogue
            ),
            key=lambda pair: pair[0],
        )
        if nearest_pilot[0] <= PILOT_EXCLUSION_KM or slug in pilot_slugs:
            discards.append(
                Discard(
                    name, province.name, harbour.lat, harbour.lon, "ya en el piloto",
                    f"es el puerto de «{nearest_pilot[1].name}» ({nearest_pilot[1].id}), que ya se "
                    f"publica con las coordenadas de dársena de T-05 a {nearest_pilot[0]:.1f} km",
                )
            )
            continue
        distance_km, gauge = _nearest_gauge(harbour.lat, harbour.lon, gauges)
        if distance_km > MAX_BORROW_KM:
            discards.append(
                Discard(
                    name, province.name, harbour.lat, harbour.lon, "sin mareógrafo",
                    f"el mareógrafo más cercano (`{gauge.station_id}`) está a {distance_km:.0f} km, "
                    f"por encima de los {MAX_BORROW_KM:.0f} km admitidos para prestar constantes",
                )
            )
            continue
        station_id = f"es-{province.code.lower()}-{slug}"
        if station_id in taken:
            discards.append(
                Discard(
                    name, province.name, harbour.lat, harbour.lon, "identidad repetida",
                    f"el identificador `{station_id}` ya está ocupado en el catálogo",
                )
            )
            continue
        taken.add(station_id)
        ports.append(
            Port(
                id=station_id,
                name=name,
                lat=round(harbour.lat, 4),
                lon=round(harbour.lon, 4),
                timezone=province.timezone,
                output=f"data/stations/{station_id}.json",
                search_radius_km=MAX_BORROW_KM,
                slug=slug,
                province_code=province.code,
            )
        )
    return Catalogue(ports=ports, discards=discards)


def province_of(port: Port) -> Province:
    """La provincia de un puerto del catálogo."""
    return BY_CODE[port.province_code]
