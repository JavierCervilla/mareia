"""Áreas marinas protegidas de RAMPE 2025 (MITECO), leídas **con el CRS que declara el fichero**.

RAMPE es la Red de Áreas Marinas Protegidas de España. MITECO publica su capa anual como un ZIP con
dos GeoJSON, y hay tres cosas medidas contra la fuente el 2026-08-30 que dan forma entera a este
módulo. Las tres son de la misma familia: **modos de fallo que no dan error**.

**1 · No son GeoJSON estándar: las coordenadas están en metros.** Los dos ficheros declaran un CRS
proyectado en ``crs.properties.name``, ``EPSG:25830`` (ETRS89 / UTM 30N) el peninsular y
``EPSG:32628`` (WGS 84 / UTM 28N) el canario. El RFC 7946 dice que un GeoJSON es longitud/latitud en
WGS84 y **no admite otro CRS**, así que cualquier librería que los lea como GeoJSON estándar tratará
metros como grados en silencio. Por eso el CRS **se lee y no se supone**, y por eso el fichero cuyo
EPSG no esté en el mapa cerrado de ``utm.PROYECCIONES`` **aborta la ingesta**: no hay camino de
repuesto ni zona por defecto, porque reproyectar con la zona equivocada no falla, acierta a poner
las áreas canarias a más de mil kilómetros de Canarias sin decir nada.

**2 · ``Rampe_c`` no es «continental-costera»: es Canarias.** Sus 38 áreas son canarias —«Espacio
marino de la zona occidental de El Hierro», «de los Roques de Salmor», «del norte de La Palma»— y su
CRS es la zona 28, que es la de Canarias. Es la glosa plausible que el dato desmiente, y es también
la razón de que este módulo no derive nunca la zona del nombre del fichero.

**3 · La URL sin el segmento ``/rampe/`` no da 404.** Medido: redirige con un 302 a
``/es/error/404.html``, que responde **200 con 46.740 bytes de HTML**. Un ``curl`` descuidado deja
entonces un «ZIP» que es una página web, y el fallo aparece mucho más tarde y muy lejos de su causa.
Por eso ``descargar`` comprueba la firma del ZIP antes de mirar nada más.

Todo es público y anónimo: no se usa ninguna credencial.

**Licencia**: la página de descarga de MITECO **no declara licencia ni condiciones de uso**
(verificado el 2026-08-30). La consecuencia práctica manda sobre la etiqueta: se publican **hechos
derivados** —nombre oficial, tipo, distancia aproximada— y **no las geometrías**, que es justo lo
que una licencia no declarada no permite redistribuir.
"""

from __future__ import annotations

import io
import json
import zipfile
from dataclasses import dataclass

from mareia_pipeline import utm
from mareia_pipeline.sources import cache

URL = (
    "https://www.miteco.gob.es/content/dam/miteco/es/biodiversidad/temas/biodiversidad-marina/"
    "rampe/Rampe2025_geojson.zip"
)

#: Los dos miembros del ZIP, con lo que es cada uno. El reparto está aquí para poder **comprobarlo**
#: y para que quien lea el módulo no repita la glosa de «continental-costera»; la zona UTM con la
#: que se reproyecta cada uno no sale de aquí, sale del ``crs`` que trae el fichero.
FICHEROS: dict[str, str] = {
    "Rampe_p.geojson": "áreas peninsulares y de Baleares, Ceuta, Melilla y Alborán",
    "Rampe_c.geojson": "áreas canarias",
}

#: Propiedades que una feature tiene que traer para poder publicarse. ``OBJECTID`` no está, y es una
#: medición y no un olvido: ``Rampe_p`` lo llama ``OBJECTID`` y ``Rampe_c`` lo llama ``OBJECTID_1``.
#: Como es un identificador interno de ArcGIS que no publicamos, exigirlo sólo serviría para abortar
#: por un campo que no usamos.
PROPIEDADES_OBLIGATORIAS: tuple[str, ...] = ("SITE_NAME", "SITE_CODE", "TIPO")

#: Ventana en la que tiene que caer todo lo que reproyectemos, en grados. Medido sobre las 86 áreas
#: de RAMPE 2025: lat 27,5877 – 44,2000 y lon −18,2273 – 4,5569, o sea de El Hierro al Cantábrico y
#: del oeste canario al cabo de Creus.
#:
#: **Es una red de disparates, no un detector de zona equivocada, y conviene no confundirlas.** Caza
#: el caso en que la fuente republique en grados dejando el ``crs`` viejo (las latitudes saldrían por
#: los millones) o cambie de hemisferio. **No** caza usar la zona 29 en vez de la 28, porque el
#: resultado sigue cayendo dentro de esta ventana: eso lo cazan las anclas geográficas del gate P1,
#: que es exactamente para lo que están.
VENTANA_LAT = (26.0, 45.0)
VENTANA_LON = (-20.0, 6.0)

#: Firma de un fichero ZIP. Ver el punto 3 de la cabecera del módulo.
_FIRMA_ZIP = b"PK\x03\x04"

Anillo = tuple[tuple[float, float], ...]
Poligono = tuple[Anillo, ...]


class ErrorRampe(RuntimeError):
    """La fuente no dice lo que este módulo sabe leer, así que no se publica nada.

    Misma política que ``sources.boe``: se prefiere no publicar a publicar un dato del que no
    podemos responder. Aquí el dato del que no podríamos responder es *dónde está* un área.
    """


@dataclass(frozen=True)
class Area:
    """Un área marina protegida, ya en latitud y longitud.

    Los anillos vienen en ``(lat, lon)`` y no en ``(lon, lat)`` como el GeoJSON. Es a propósito: el
    resto del pipeline —``geo.haversine_km``, ``ports.Port``, ``ports.json``— habla en ese orden, y
    la conversión se hace una vez, aquí, en vez de en cada sitio que consuma esto.
    """

    nombre: str
    codigo: str
    tipo: str
    superficie_ha: float | None
    #: Fichero del ZIP del que sale, para poder rastrear cualquier cifra hasta su origen.
    fichero: str
    #: EPSG que **declaraba** ese fichero. Viaja con el área porque es la decisión que más caro
    #: sale equivocar y tiene que quedar por escrito en el rastro de la ingesta.
    epsg: int
    poligonos: tuple[Poligono, ...]

    @property
    def vertices(self) -> int:
        return sum(len(anillo) for poligono in self.poligonos for anillo in poligono)

    @property
    def caja(self) -> tuple[float, float, float, float]:
        """``(lat_min, lat_max, lon_min, lon_max)``: sirve para descartar barato lo que está lejos."""
        latitudes = [p[0] for pol in self.poligonos for anillo in pol for p in anillo]
        longitudes = [p[1] for pol in self.poligonos for anillo in pol for p in anillo]
        return min(latitudes), max(latitudes), min(longitudes), max(longitudes)


def descargar(*, refresh: bool = False) -> bytes:
    """El ZIP de RAMPE 2025, comprobando que lo que ha llegado es un ZIP.

    La comprobación de la firma no es paranoia de manual: es el punto 3 de la cabecera, medido. Sin
    ella, la avería que se ve es un ``BadZipFile`` a saber dónde, o peor, un fichero cacheado que
    hace fallar la siguiente ejecución sin que nadie relacione las dos cosas.
    """
    cuerpo = cache.fetch(URL, suffix=".zip", refresh=refresh)
    if not cuerpo.startswith(_FIRMA_ZIP):
        raise ErrorRampe(
            f"lo descargado de {URL} no empieza por la firma de un ZIP "
            f"({cuerpo[:4]!r}, {len(cuerpo)} bytes). MITECO responde 200 con una página de error "
            "HTML cuando la ruta no existe, así que esto no es «el servidor está caído»: casi "
            "seguro la URL ha cambiado. Compruébala antes de tocar nada más."
        )
    return cuerpo


def _colecciones(cuerpo: bytes) -> dict[str, bytes]:
    """Los dos GeoJSON del ZIP, comprobando que están los dos."""
    try:
        with zipfile.ZipFile(io.BytesIO(cuerpo)) as archivo:
            dentro = {nombre.rsplit("/", 1)[-1]: nombre for nombre in archivo.namelist()}
            faltan = [nombre for nombre in FICHEROS if nombre not in dentro]
            if faltan:
                raise ErrorRampe(
                    f"el ZIP de RAMPE no trae {', '.join(faltan)} (contiene "
                    f"{', '.join(sorted(dentro)) or 'nada'}). No se publica sólo la mitad que se "
                    "puede leer: media red de áreas protegidas se lee igual de bien que la entera "
                    "y dice algo que no es verdad."
                )
            return {nombre: archivo.read(dentro[nombre]) for nombre in FICHEROS}
    except zipfile.BadZipFile as error:
        raise ErrorRampe(f"el ZIP de RAMPE no se puede abrir: {error}") from error


def _crs_declarado(coleccion: dict, *, fichero: str) -> utm.Proyeccion:
    """**Gate P4**: lee el CRS del fichero y aborta si no lo reconoce.

    La ausencia del bloque ``crs`` aborta igual que un EPSG desconocido, y eso merece explicación
    porque el RFC 7946 dice justo lo contrario: sin ``crs``, un GeoJSON **es** WGS84 en grados. El
    problema es que ese valor por defecto es precisamente la suposición que arruina estos datos —sus
    números son metros—, así que aquí «no lo dice» y «dice algo que no entiendo» son la misma
    respuesta: no se toca.
    """
    crs = coleccion.get("crs")
    if not isinstance(crs, dict):
        raise ErrorRampe(
            f"{fichero}: no declara ningún CRS. El RFC 7946 diría entonces que son grados WGS84, y "
            "en esta fuente son metros: leerlos como grados no da error, coloca cada área a miles "
            "de kilómetros de su sitio. Sin CRS declarado no se reproyecta."
        )
    nombre = crs.get("properties", {}).get("name", "")
    if not nombre:
        raise ErrorRampe(
            f"{fichero}: el bloque crs no trae properties.name, así que no dice qué CRS es."
        )
    try:
        return utm.proyeccion_de_urn(nombre)
    except utm.ErrorCrs as error:
        raise ErrorRampe(f"{fichero}: {error}") from error


def _poligonos_crudos(geometria: dict, *, fichero: str, nombre: str) -> list[list[list[list[float]]]]:
    """Los polígonos de la geometría, venga como ``Polygon`` o como ``MultiPolygon``.

    Devuelve siempre la forma de ``MultiPolygon`` —lista de polígonos, cada uno lista de anillos—
    porque **el anidamiento es información y aplanarlo la pierde**: en cada polígono el primer
    anillo es el contorno y los siguientes son agujeros. RAMPE 2025 los usa de verdad, y mucho: hay
    polígonos de 824 y 362 anillos, que son las islas y los islotes que el área rodea sin incluir.
    Aplanarlos convertiría cada agujero en un área más y daría por «dentro del área protegida» un
    punto que está en tierra firme.

    ``Polygon`` se acepta porque es el mismo dato con una capa menos de anidamiento y rechazarlo
    sería romperse por una equivalencia. Todo lo demás aborta: una línea o un punto no delimitan un
    área protegida.
    """
    tipo = geometria.get("type")
    coordenadas = geometria.get("coordinates")
    if tipo == "MultiPolygon":
        return list(coordenadas)
    if tipo == "Polygon":
        return [list(coordenadas)]
    raise ErrorRampe(
        f"{fichero}: «{nombre}» tiene geometría {tipo!r} y un área protegida se delimita con "
        "Polygon o MultiPolygon"
    )


def _comprobar_que_son_metros(este: float, norte: float, *, fichero: str, epsg: int) -> None:
    """El CRS dice metros; los números tienen que decir lo mismo.

    Existe por un modo de fallo concreto y verosímil: que MITECO republique la capa ya en grados y
    se deje el bloque ``crs`` antiguo. Entonces el fichero *declara* una cosa y *contiene* otra, el
    gate P4 daría verde —el EPSG lo conocemos— y reproyectaríamos grados como si fueran metros, que
    manda las áreas a la Antártida. Un par de grados válidos jamás caben en un par UTM de esta red:
    los estes de RAMPE van por los cientos de miles y los nortes por los millones.
    """
    if abs(este) <= 180 and abs(norte) <= 90:
        raise ErrorRampe(
            f"{fichero}: declara EPSG:{epsg}, que es un CRS proyectado en metros, pero su primera "
            f"coordenada ({este}, {norte}) cabe en un par longitud/latitud en grados. El fichero "
            "dice una cosa y contiene otra: no se reproyecta hasta saber cuál de las dos vale."
        )


def _comprobar_ventana(latitud: float, longitud: float, *, fichero: str, nombre: str) -> None:
    """Lo reproyectado cae donde puede caer algo de la red española. Ver ``VENTANA_LAT``."""
    if not (VENTANA_LAT[0] <= latitud <= VENTANA_LAT[1]):
        raise ErrorRampe(
            f"{fichero}: «{nombre}» reproyectado cae en la latitud {latitud:.4f}°, fuera de la "
            f"ventana {VENTANA_LAT[0]}° – {VENTANA_LAT[1]}° en la que está la red española"
        )
    if not (VENTANA_LON[0] <= longitud <= VENTANA_LON[1]):
        raise ErrorRampe(
            f"{fichero}: «{nombre}» reproyectado cae en la longitud {longitud:.4f}°, fuera de la "
            f"ventana {VENTANA_LON[0]}° – {VENTANA_LON[1]}° en la que está la red española"
        )


def leer_coleccion(cuerpo: bytes, *, fichero: str) -> tuple[Area, ...]:
    """Un GeoJSON de RAMPE → sus áreas, ya reproyectadas con **el CRS que declara**.

    Parte pura: no toca la red, así que los recorridos pueden ejercitarla entera con un fixture.
    """
    try:
        coleccion = json.loads(cuerpo)
    except json.JSONDecodeError as error:
        raise ErrorRampe(f"{fichero}: no es JSON ({error})") from error
    if coleccion.get("type") != "FeatureCollection":
        raise ErrorRampe(
            f"{fichero}: declara type {coleccion.get('type')!r} y se esperaba FeatureCollection"
        )
    proyeccion = _crs_declarado(coleccion, fichero=fichero)
    rasgos = coleccion.get("features")
    if not isinstance(rasgos, list) or not rasgos:
        raise ErrorRampe(f"{fichero}: no trae ninguna feature")

    areas: list[Area] = []
    for rasgo in rasgos:
        propiedades = rasgo.get("properties") or {}
        nombre = str(propiedades.get("SITE_NAME", "")).strip()
        faltan = [campo for campo in PROPIEDADES_OBLIGATORIAS if not propiedades.get(campo)]
        if faltan:
            raise ErrorRampe(
                f"{fichero}: la feature «{nombre or 'sin nombre'}» no declara "
                f"{', '.join(faltan)}. Un área sin nombre oficial, sin código o sin tipo no se "
                "puede publicar: lo que hace útil el aviso es poder ir a buscarla."
            )
        crudos = _poligonos_crudos(rasgo.get("geometry") or {}, fichero=fichero, nombre=nombre)
        _comprobar_que_son_metros(
            *crudos[0][0][0][:2], fichero=fichero, epsg=proyeccion.epsg
        )
        poligonos: list[Poligono] = []
        for poligono in crudos:
            anillos: list[Anillo] = []
            for anillo in poligono:
                convertido = tuple(
                    utm.a_geograficas(este, norte, proyeccion) for este, norte, *_ in anillo
                )
                _comprobar_ventana(*convertido[0], fichero=fichero, nombre=nombre)
                anillos.append(convertido)
            poligonos.append(tuple(anillos))
        superficie = propiedades.get("SupGIS_ha")
        areas.append(
            Area(
                nombre=nombre,
                codigo=str(propiedades["SITE_CODE"]).strip(),
                tipo=str(propiedades["TIPO"]).strip(),
                superficie_ha=float(superficie) if isinstance(superficie, int | float) else None,
                fichero=fichero,
                epsg=proyeccion.epsg,
                poligonos=tuple(poligonos),
            )
        )
    return tuple(areas)


def leer_zip(cuerpo: bytes) -> tuple[Area, ...]:
    """El ZIP entero → las áreas de los dos ficheros, cada uno con su CRS."""
    return tuple(
        area
        for fichero, contenido in _colecciones(cuerpo).items()
        for area in leer_coleccion(contenido, fichero=fichero)
    )


def descargar_areas(*, refresh: bool = False) -> tuple[Area, ...]:
    """Camino completo con red: descarga → comprobación de que es un ZIP → lectura con su CRS."""
    return leer_zip(descargar(refresh=refresh))


# --------------------------------------------------------------------------------------------
# P4 · el gate de CRS sigue vivo, comprobable sin red
# --------------------------------------------------------------------------------------------

#: CRS que **tienen** que abortar, y por qué cada uno está en la lista. No son cadenas absurdas: son
#: las tres formas verosímiles de que esto se rompa un martes.
_CRS_QUE_DEBEN_ABORTAR: dict[str, str] = {
    "urn:ogc:def:crs:EPSG::25829": "UTM 29N: la zona de Galicia, real y a un dígito de la nuestra",
    "urn:ogc:def:crs:EPSG::4326": "WGS84 en grados: lo que la fuente declararía si republicara",
    "urn:ogc:def:crs:OGC:1.3:CRS84": "la otra forma de decir WGS84, y tampoco es UTM",
}


def errores_de_gate_de_crs() -> list[str]:
    """Gate P4, la parte que se puede comprobar en CI: el aborto por CRS desconocido sigue vivo.

    Un gate cuyo camino rojo se ha muerto no se distingue de uno que funciona: los dos dan verde
    todos los días. Así que esto **provoca** el aborto en vez de esperar a que la fuente lo provoque
    algún día, y de paso comprueba que los EPSG que sí conocemos siguen siendo aceptables.

    No sustituye a la lectura real del fichero —eso pasa en la ingesta, con red—: comprueba que la
    decisión de abortar sigue tomándose, que es lo que puede pudrirse en silencio.
    """
    fallos: list[str] = []
    for epsg in sorted(utm.PROYECCIONES):
        try:
            utm.proyeccion_de_urn(f"urn:ogc:def:crs:EPSG::{epsg}")
        except utm.ErrorCrs as error:
            fallos.append(f"EPSG:{epsg} está en el mapa de proyecciones y aun así aborta: {error}")
    for urn, motivo in _CRS_QUE_DEBEN_ABORTAR.items():
        try:
            proyeccion = utm.proyeccion_de_urn(urn)
        except utm.ErrorCrs:
            continue
        fallos.append(
            f"{urn} ({motivo}) NO aborta: lo acepta como {proyeccion.nombre}. El gate P4 ha dejado "
            "de morder y la ingesta reproyectaría con una zona que no es la del fichero."
        )
    return fallos

