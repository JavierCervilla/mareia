"""Presencia registrada de una especie en un caladero, desde OBIS (Ocean Biodiversity Info System).

Lo que este módulo trae **no es abundancia**. Es cuántas veces alguien vio la especie ahí, la anotó
y publicó el registro en OBIS. Dos cifras medidas el 2026-08-30 y comprobables con el propio módulo:

* La dorada (*Sparus aurata*) sale con **56 registros de 7 datasets** en el recorte del caladero
  cantábrico-noroeste, y en el conjunto de OBIS tiene **3.190**. Nadie que conozca la ría de Arousa
  diría que en toda esa costa hay cincuenta y seis doradas.
* El centollo que la norma llama *Maja squinado* sale con **0 registros** en ese mismo recorte,
  cuando en todo OBIS tiene 27.348. No es que no haya centollos en Galicia: el atlántico se registra
  hoy como *Maja brachydactyla*, que ahí tiene **117 registros de 2 datasets**. El número habla del
  nombre con el que se pregunta, no del animal.

Por eso la frase de sesgo (``SESGO``) viaja **pegada al número dentro del propio dataset**: no en un
pie de página que la interfaz pueda perder por el camino, sino en el mismo objeto, de modo que quien
quiera publicar la cifra desnuda tenga que borrar antes la advertencia a mano.

**El recorte de cada caladero son rectángulos en grados, declarados**, y eso también hay que
decirlo: un rectángulo no es un caladero, mete mar de más (y tierra, donde OBIS no tiene registros
marinos que dar). La alternativa era traerse una fuente de demarcaciones marinas reales para afinar
el método de un dato que ya publicamos como pobre; publicar un dato pobre con su método a la vista
es honrado, afinarle el método sin afinar el dato es maquillaje.

Dos decisiones medidas contra la API:

**1 · Un caladero puede necesitar más de un rectángulo, y se consulta con un MULTIPOLYGON, no
sumando.** El caladero «Cantábrico y noroeste y golfo de Cádiz» son dos fachadas que un solo
rectángulo no envuelve sin tragarse el mar de Alborán entero, que es del caladero de al lado. Y hay
que preguntar **una vez**, no una por rectángulo: medido con la dorada, el rectángulo cantábrico da
27 registros de 5 datasets y el del golfo de Cádiz 19 de 3, y el MULTIPOLYGON de los dos devuelve 46
registros de **5** datasets, no de 8. O sea que ``datasets`` y ``species`` **no son sumables**:
sumarlos habría publicado 8 fuentes donde hay 5.

**2 · Se consulta con el nombre ACEPTADO, no con el literal del BOE.** No es una preferencia: la
propia documentación de OBIS dice que su ``scientificName`` es *«Valid scientific name based on the
scientificNameID or derived by matching the provided scientificName with WoRMS»*. Preguntar por
``Mugil auratus`` cuando WoRMS dice que hoy es ``Chelon auratus`` es preguntar por una etiqueta que
ese índice ya no usa. Cada cifra publica con qué nombre se preguntó.

OBIS pide expresamente no paralelizar las descargas (*«Do not parallelize downloads»*, página de
acceso a datos). Aquí van **en serie** y con caché en disco, como el resto del pipeline.

**Licencia**: *«Most OBIS data are available under a Creative Commons Attribution (CC BY 4.0)
License… Some datasets follow particular licences, such as CC BY-NC, CC BY-NC-ND, or CC BY-SA»*, y
*«Users must cite the original data sources and the OBIS database»* (política de datos de OBIS,
verificada el 2026-08-30). De ahí sale la forma de este módulo: **no se republica ni un registro**,
sólo recuentos —que son hechos sobre el índice, no los datos de nadie— y se atribuye a OBIS. Los
datasets de origen conservan su licencia porque no redistribuimos sus registros.

Todo es público y anónimo: no se usa ninguna credencial.
"""

from __future__ import annotations

import json
import urllib.parse
from dataclasses import dataclass
from typing import Any

from mareia_pipeline.sources import cache

URL_BASE = "https://api.obis.org/v3/statistics"

FUENTE = "Ocean Biodiversity Information System (OBIS)"
FUENTE_URL = "https://obis.org"
LICENCIA = (
    "La mayoría de los datos de OBIS son CC-BY 4.0; algunos datasets llevan CC BY-NC, "
    "CC BY-NC-ND o CC BY-SA"
)
LICENCIA_URL = "https://obis.org/data/datapolicy"
ATRIBUCION = (
    "OBIS (2026). Ocean Biodiversity Information System. Intergovernmental Oceanographic "
    "Commission of UNESCO. https://obis.org"
)
AVISO = (
    "No se republica ningún registro de OBIS, sólo recuentos: los datasets de origen conservan su "
    "licencia y su atribución."
)

#: La frase que acompaña **siempre** a cualquier cifra de presencia. Es el equivalente de lo que
#: `rmse_m` hace con la precisión: publicar la cota y no dejar que se lea como otra cosa.
SESGO = (
    "Es esfuerzo de muestreo, no abundancia: cuenta los registros que alguien anotó y publicó en "
    "OBIS dentro del recorte, no cuántos animales hay. Un número bajo puede significar sólo que "
    "ahí no se ha muestreado, y uno alto, que hay una campaña científica cerca."
)


class ErrorObis(RuntimeError):
    """La respuesta no dice lo que este módulo sabe leer, así que no se publica presencia."""


@dataclass(frozen=True)
class Caja:
    """Un rectángulo en grados. ``lat``/``lon`` en el orden del resto del pipeline, no el del WKT."""

    nombre: str
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float

    def contiene(self, lat: float, lon: float) -> bool:
        return self.lat_min <= lat <= self.lat_max and self.lon_min <= lon <= self.lon_max

    @property
    def anillo_wkt(self) -> str:
        """El anillo cerrado, en el orden ``lon lat`` que exige el WKT."""
        esquinas = (
            (self.lon_min, self.lat_min),
            (self.lon_max, self.lat_min),
            (self.lon_max, self.lat_max),
            (self.lon_min, self.lat_max),
            (self.lon_min, self.lat_min),
        )
        return ",".join(f"{lon} {lat}" for lon, lat in esquinas)


@dataclass(frozen=True)
class Recorte:
    """Los rectángulos con los que se consulta un caladero, y qué se le mete de más."""

    caladero: str
    cajas: tuple[Caja, ...]
    advertencia: str

    @property
    def wkt(self) -> str:
        """``POLYGON`` si es un rectángulo, ``MULTIPOLYGON`` si son varios (ver punto 1)."""
        if len(self.cajas) == 1:
            return f"POLYGON(({self.cajas[0].anillo_wkt}))"
        anillos = ",".join(f"(({caja.anillo_wkt}))" for caja in self.cajas)
        return f"MULTIPOLYGON({anillos})"

    def contiene(self, lat: float, lon: float) -> bool:
        return any(caja.contiene(lat, lon) for caja in self.cajas)


_ADVERTENCIA = (
    "Son rectángulos en grados, no la demarcación del caladero: incluyen mar que el caladero no "
    "abarca "
)

#: Los tres recortes, uno por caladero de ``normativa``. **Están aquí y se publican en el dataset**:
#: una caja escondida en el código es un método que el lector no puede comprobar.
#:
#: Los límites no son a ojo: se ajustaron hasta que cada recorte contiene **los 153 puertos de su
#: caladero y ni uno de otro** (`data/geo/ports.json`), que es lo que comprueba
#: ``errores_de_recortes``. No los hace exactos —siguen metiendo aguas francesas, portuguesas y
#: norteafricanas—, pero sí impide el fallo que de verdad rompería la cifra: que el recorte de un
#: caladero se trague el litoral del de al lado.
RECORTES: dict[str, Recorte] = {
    "cantabrico-noroeste-y-golfo-de-cadiz": Recorte(
        caladero="cantabrico-noroeste-y-golfo-de-cadiz",
        cajas=(
            Caja("Cantábrico", 43.0, 44.2, -9.5, -1.4),
            Caja("Noroeste (fachada atlántica gallega)", 41.7, 43.9, -10.0, -8.0),
            Caja("Golfo de Cádiz", 35.9, 37.4, -7.6, -5.6),
        ),
        advertencia=(
            _ADVERTENCIA + "(aguas francesas del golfo de Vizcaya, el norte de Portugal y el "
            "Algarve oriental). Son tres y no uno porque el caladero son dos fachadas: un único "
            "rectángulo que llegara del Cantábrico al golfo de Cádiz se tragaría el mar de "
            "Alborán, que es del caladero mediterráneo."
        ),
    ),
    "mediterraneo": Recorte(
        caladero="mediterraneo",
        cajas=(
            Caja("Alborán y Levante", 35.1, 41.0, -5.5, 0.8),
            Caja("Baleares y costa catalana", 38.4, 42.6, 0.0, 4.6),
        ),
        advertencia=(
            _ADVERTENCIA + "(la costa norteafricana de Marruecos y Argelia y el golfo de León "
            "francés). Son dos para no tener que estirar el rectángulo de Alborán hasta Cataluña "
            "y meter con él medio Mediterráneo occidental."
        ),
    ),
    "canario": Recorte(
        caladero="canario",
        cajas=(Caja("Archipiélago canario", 27.3, 29.6, -18.3, -13.2),),
        advertencia=_ADVERTENCIA + "(aguas del banco sahariano, al este del archipiélago).",
    ),
}


@dataclass(frozen=True)
class Presencia:
    """Los recuentos de OBIS para un nombre dentro de un recorte. Sin interpretación."""

    #: Con qué nombre se preguntó (el aceptado, ver el punto 2 de la cabecera).
    consultado: str
    caladero: str
    registros: int
    #: Cuántas especies distintas hay detrás del recuento. Es 1 en una especie y más en un género
    #: o una familia, que es justo lo que hace legible una fila de género.
    especies: int
    datasets: int
    desde_anio: int | None
    hasta_anio: int | None


def url_de(nombre: str, recorte: Recorte) -> str:
    consulta = urllib.parse.urlencode({"scientificname": nombre, "geometry": recorte.wkt})
    return f"{URL_BASE}?{consulta}"


def _entero(datos: dict[str, Any], campo: str, *, nombre: str) -> int:
    valor = datos.get(campo)
    if not isinstance(valor, int):
        raise ErrorObis(
            f"la respuesta de OBIS para «{nombre}» no trae un entero en «{campo}» ({valor!r}). Sin "
            "recuento no hay presencia que publicar."
        )
    return valor


def leer_estadisticas(cuerpo: bytes, *, nombre: str, recorte: Recorte) -> Presencia:
    """El cuerpo de la respuesta → ``Presencia``. Parte pura: no toca la red.

    ``yearrange`` viene como ``[null, null]`` cuando no hay ni un registro (medido con
    ``Merluccius merluccius`` en el recorte canario), y eso **no** es un error: es que ahí no hay
    nada anotado. Se publica como ``None`` y no como un cero, que sería un año.
    """
    try:
        datos = json.loads(cuerpo)
    except json.JSONDecodeError as error:
        raise ErrorObis(f"la respuesta de OBIS para «{nombre}» no es JSON: {error}") from error
    if not isinstance(datos, dict):
        raise ErrorObis(f"la respuesta de OBIS para «{nombre}» no es un objeto ({datos!r})")
    rango = datos.get("yearrange") or [None, None]
    if not isinstance(rango, list) or len(rango) != 2:
        raise ErrorObis(
            f"la respuesta de OBIS para «{nombre}» trae un yearrange que no son dos valores "
            f"({rango!r})"
        )
    return Presencia(
        consultado=nombre,
        caladero=recorte.caladero,
        registros=_entero(datos, "records", nombre=nombre),
        especies=_entero(datos, "species", nombre=nombre),
        datasets=_entero(datos, "datasets", nombre=nombre),
        desde_anio=int(rango[0]) if rango[0] is not None else None,
        hasta_anio=int(rango[1]) if rango[1] is not None else None,
    )


def consultar(nombre: str, recorte: Recorte, *, refresh: bool = False) -> Presencia:
    """Camino completo con red: consulta (o sirve de caché) → lectura de los recuentos."""
    cuerpo = cache.fetch(url_de(nombre, recorte), suffix=".json", refresh=refresh)
    return leer_estadisticas(cuerpo, nombre=nombre, recorte=recorte)


def errores_de_recortes(catalogo: dict[str, Any]) -> list[str]:
    """Cada recorte cubre **todos** los puertos de su caladero y **ninguno** de otro.

    Es lo que hace que la cifra de presencia sea de ese caladero y no de la costa de al lado, y se
    comprueba sobre el catálogo de puertos publicado, no sobre una declaración nuestra. Un puerto
    del caladero que se quede fuera del recorte significa que hay litoral regulado del que no
    estamos preguntando; uno ajeno dentro significa que la cifra cuenta registros de otro caladero.

    No necesita red, así que corre en CI: es donde se pudriría en silencio si alguien retocara un
    límite «para que entre un puerto más».
    """
    fallos: list[str] = []
    for puerto in catalogo["ports"]:
        caladero = puerto.get("caladero")
        if caladero not in RECORTES:
            fallos.append(
                f"el puerto {puerto['slug']} declara el caladero {caladero!r}, que no tiene "
                "recorte de OBIS: no se puede publicar su presencia"
            )
            continue
        if not RECORTES[caladero].contiene(puerto["lat"], puerto["lon"]):
            fallos.append(
                f"{puerto['slug']} ({puerto['lat']}, {puerto['lon']}) es del caladero {caladero} y "
                "cae FUERA de su recorte de OBIS: hay litoral regulado por el que no se pregunta"
            )
        for otro, recorte in RECORTES.items():
            if otro != caladero and recorte.contiene(puerto["lat"], puerto["lon"]):
                fallos.append(
                    f"{puerto['slug']} es del caladero {caladero} y cae DENTRO del recorte de "
                    f"{otro}: la presencia de {otro} estaría contando registros de otro caladero"
                )
    return fallos
