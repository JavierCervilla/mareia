"""La foto de cada taxón, cogida por **Wikidata `P18`** y con los metadatos que da Commons.

**La imagen no se busca por texto, y ésa es la decisión entera del módulo.** Buscar en Commons el
nombre científico funciona —12 de 12 en la muestra del plan devuelven algo— y ése es justo el
problema: **devuelve siempre algo**. Lo primero que sale puede ser un mapa de distribución, un
grabado del XIX, un sello o directamente otra especie, y publicar una foto equivocada bajo el nombre
de un animal es exactamente lo que este proyecto no hace. `P18` es la imagen que alguien vinculó
**a mano** al ítem del taxón en Wikidata: la identificación es entonces una decisión editorial
citable y con dueño, y no una conjetura nuestra sobre una cadena de búsqueda. **Sin `P18`, no hay
foto**, y el hueco se rotula con su motivo.

Cuatro cosas medidas contra las dos APIs el 2026-08-30 dan forma al módulo:

**1 · Llegar al ítem sigue siendo una búsqueda de texto, así que se comprueba el destino.**
`wbsearchentities` resuelve `Dicentrarchus labrax` a `Q217129` por alias, pero es una búsqueda y
puede traer cualquier cosa (un apellido, un barco, una canción). Por eso se lee además `P225` —el
nombre científico que el propio ítem declara— y **si no es el nombre por el que se preguntaba, no se
publica foto**. Es una petición más por especie contra una API que limita, y compra que la
identificación no dependa de un buscador.

**2 · Un taxón puede tener varias `P18`.** `Q217129` trae **tres**. Elegir «la primera» no es aquí
una decisión taxonómica —las tres son imágenes del mismo taxón según Wikidata, a diferencia de los
homónimos de WoRMS—, así que se recorren en el orden que manda la propia fuente: primero las de
rango `preferred`, nunca las `deprecated`, y se publica **la primera cuyos metadatos estén
completos**. Descartar el ítem entero porque su imagen principal no acredite autor sería tirar una
identificación buena por un problema de otra cosa.

**3 · Sin autor o sin licencia, no se publica.** `extmetadata` da `Artist`, `LicenseShortName` y
`LicenseUrl`, y los tres faltan a veces. Una imagen sin autor o sin licencia **no se puede
publicar**: la fila cae a `sinFoto` con el motivo dicho, y **aborta la fila, no el proceso**.

**4 · La URL que devuelve la API viene con parámetros de analítica.** Medido: el `url` del
`imageinfo` acaba en `?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original`.
Publicarlos tal cual atribuiría a Commons un tráfico que sale de nuestras páginas, que es una
afirmación falsa sobre su origen; se quitan y se publica la URL del fichero.

**Educado, porque Wikimedia limita por IP.** Medido: un `429` con `retry-after: 16` y
`server: envoy`, o sea que el límite es de la fuente y no de nuestro proxy, y es de la IP compartida
del datacenter. De ahí el `User-Agent` que dice quiénes somos y dónde encontrarnos, el respeto al
`Retry-After` (`cache.fetch_educado`), la pausa entre peticiones, las consultas **en serie** y la
caché, igual que en `sources.worms` y `sources.rampe`.

**Licencia**: no hay «la licencia de las fotos». Es **por fichero** —seis distintas en la muestra de
doce del plan, incluida una `CC BY-SA 3.0 de` de jurisdicción alemana— y por eso `licencia`, `autor`
y `licenciaUrl` viajan dentro de cada foto y no en un pie global. **No se mirrorea Commons**: se
guardan los metadatos y se enlaza el fichero.

Todo es público y anónimo: no se usa ninguna credencial.
"""

from __future__ import annotations

import html
import json
import re
import urllib.parse
from dataclasses import dataclass
from typing import Any

from mareia_pipeline.sources import cache

URL_WIKIDATA = "https://www.wikidata.org/w/api.php"
URL_COMMONS = "https://commons.wikimedia.org/w/api.php"

FUENTE = "Wikimedia Commons"
FUENTE_URL = "https://commons.wikimedia.org"

#: Quién hace la identificación. No es Mareia: se cita a Wikidata, que es quien vinculó la imagen al
#: taxón, con el ítem y la propiedad exactos para que cualquiera pueda ir a comprobarlo.
FUENTE_IDENTIFICACION = "Wikidata"
FUENTE_IDENTIFICACION_URL = "https://www.wikidata.org"
PROPIEDAD_IMAGEN = "P18"

#: `P225` (*taxon name*) es el nombre científico que el ítem declara. Es lo que convierte la
#: búsqueda de texto del punto 1 en una comprobación.
PROPIEDAD_NOMBRE_CIENTIFICO = "P225"

#: `User-Agent` de la política de Wikimedia: producto, versión y **dónde encontrarnos**. La URL del
#: repositorio y no un correo personal: el contacto tiene que poder seguir existiendo cuando quien
#: lanzó la ingesta ya no esté, y un correo de una persona en la cabecera de cada petición a un
#: tercero es un dato personal que no hace falta enviar.
AGENTE = "mareia-pipeline/1.0 (https://github.com/universelle-io/mareia) python-urllib"

#: Segundos entre dos peticiones que salen de verdad a la red. No lo pide ninguna cabecera: es la
#: mitad de ser educado que no depende de que el servidor se queje primero.
PAUSA_SEGUNDOS = 0.5

#: Rango de un enunciado de Wikidata que significa «esto está mal o ya no vale». Nunca se publica.
RANGO_DESCARTADO = "deprecated"

#: Rango de los enunciados que la propia Wikidata pone por delante.
RANGO_PREFERIDO = "preferred"

#: Los tres metadatos sin los cuales la foto no se publica, con el nombre que les da Commons.
ARTISTA = "Artist"
LICENCIA_CORTA = "LicenseShortName"
LICENCIA_URL = "LicenseUrl"

_ETIQUETA_HTML = re.compile(r"<[^>]+>")
#: Forma de un ítem de Wikidata. Se comprueba aquí y lo vuelve a comprobar el gate F2
#: sobre el artefacto: una cita que no se puede ir a mirar no es una cita.
ENTIDAD = re.compile(r"^Q[1-9][0-9]*$")

#: Los parámetros de analítica que Commons pega a la URL del fichero (punto 4 de la cabecera).
_ANALITICA = ("utm_source", "utm_campaign", "utm_content")

#: Los cinco desenlaces de preguntar por la foto de un taxón. Se publican contados en la salida de
#: la ingesta y son los que dicen **cuántas** especies se quedan sin foto y **por qué**: un censo de
#: huecos con una sola cifra («62 con foto») esconde justo lo que hay que poder discutir.
PUBLICABLE = "publicable"
SIN_ITEM = "sin_item"
OTRO_TAXON = "otro_taxon"
SIN_IMAGEN = "sin_p18"
SIN_METADATOS = "sin_metadatos"


class ErrorCommons(RuntimeError):
    """La respuesta no dice lo que este módulo sabe leer, así que no se publica ninguna foto.

    Misma política que ``sources.worms`` y ``sources.rampe``: se prefiere no publicar a publicar un
    dato del que no podemos responder. Aquí el dato del que no podríamos responder es **de quién es
    la foto** y **de qué animal es**.

    No es lo mismo que no encontrar: «este taxón no tiene imagen», «el ítem no es el que se
    buscaba» y «la imagen no acredita a su autor» son desenlaces legítimos y viajan como
    ``Resultado.motivo``, no como excepción.
    """


@dataclass(frozen=True)
class Metadatos:
    """Lo que Commons dice de un fichero. Los tres campos publicables pueden faltar, y faltan."""

    fichero: str
    url: str | None
    descripcion: str | None
    autor: str | None
    licencia: str | None
    licencia_url: str | None

    @property
    def carencias(self) -> tuple[str, ...]:
        """Qué le falta para poder publicarse, dicho con el nombre que usa el dataset."""
        faltan = {
            "url": self.url,
            "descripcion": self.descripcion,
            "autor": self.autor,
            "licencia": self.licencia,
            "licenciaUrl": self.licencia_url,
        }
        return tuple(campo for campo, valor in faltan.items() if not valor)

    @property
    def completa(self) -> bool:
        return not self.carencias


@dataclass(frozen=True)
class Foto:
    """Una foto publicable: el fichero, sus metadatos completos y quién identificó el taxón."""

    entidad: str
    fichero: str
    url: str
    descripcion: str
    autor: str
    licencia: str
    licencia_url: str


@dataclass(frozen=True)
class Resultado:
    """Qué se pudo publicar de un nombre científico, incluidas las formas de no poder.

    ``motivo`` no es opcional cuando no hay foto: un hueco sin motivo es un hueco mudo, y el
    catálogo de T-21 ya enseñó lo que cuestan (diez puertos sin área y sin explicación).
    """

    consultado: str
    foto: Foto | None = None
    motivo: str | None = None
    #: Cuál de los cinco desenlaces es, para poder contarlos sin adivinarlo del texto del motivo.
    desenlace: str = PUBLICABLE
    #: El ítem al que llegó la búsqueda, aunque no acabe habiendo foto: es la mitad de la
    #: procedencia del «no» («Q123 no tiene P18» se puede comprobar; «no hay foto» no).
    entidad: str | None = None


# --------------------------------------------------------------------------------------------
# URLs. Separadas de la descarga porque son la mitad de la procedencia: se citan en el README y se
# comprueban en la suite sin tocar la red.
# --------------------------------------------------------------------------------------------


def url_busqueda(nombre: str) -> str:
    """El ítem de Wikidata que mejor casa con un nombre científico. Es una búsqueda: ver punto 1."""
    parametros = {
        "action": "wbsearchentities",
        "format": "json",
        "language": "es",
        "type": "item",
        "limit": "1",
        "search": nombre,
    }
    return f"{URL_WIKIDATA}?{urllib.parse.urlencode(parametros)}"


def url_claims(entidad: str, propiedad: str) -> str:
    """Los enunciados de una propiedad de un ítem (``P18`` las imágenes, ``P225`` el nombre)."""
    parametros = {
        "action": "wbgetclaims",
        "format": "json",
        "entity": entidad,
        "property": propiedad,
    }
    return f"{URL_WIKIDATA}?{urllib.parse.urlencode(parametros)}"


def url_imageinfo(fichero: str) -> str:
    """La URL del fichero y su `extmetadata`, pidiendo **sólo** los tres campos que se publican."""
    parametros = {
        "action": "query",
        "format": "json",
        "titles": fichero if fichero.startswith("File:") else f"File:{fichero}",
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
        "iiextmetadatafilter": f"{LICENCIA_CORTA}|{ARTISTA}|{LICENCIA_URL}",
    }
    return f"{URL_COMMONS}?{urllib.parse.urlencode(parametros)}"


# --------------------------------------------------------------------------------------------
# Lectura de las respuestas. Partes puras: no tocan la red, así que la suite las prueba enteras.
# --------------------------------------------------------------------------------------------


def _json(cuerpo: bytes, *, que: str) -> dict[str, Any]:
    try:
        leido = json.loads(cuerpo)
    except json.JSONDecodeError as error:
        raise ErrorCommons(f"la respuesta de {que} no es JSON: {error}") from error
    if not isinstance(leido, dict):
        raise ErrorCommons(f"la respuesta de {que} no es un objeto JSON ({type(leido).__name__})")
    if "error" in leido:
        raise ErrorCommons(f"{que} responde con error: {leido['error']}")
    return leido


def _texto(valor: Any) -> str | None:
    if valor is None:
        return None
    texto = " ".join(str(valor).split())
    return texto or None


def texto_plano(crudo: Any) -> str | None:
    """`extmetadata` devuelve HTML; el dataset publica texto.

    El `Artist` de Commons casi siempre es un enlace al perfil de quien hizo la foto
    (``<a href="…">Bjoertvedt</a>``). Guardar el HTML metería marcado ajeno en un JSON que después
    alguien pinta en una página, así que aquí se queda el nombre y nada más. Si al quitar las
    etiquetas no queda texto, la foto **no tiene autor legible** y no se publica.
    """
    if crudo is None:
        return None
    return _texto(html.unescape(_ETIQUETA_HTML.sub(" ", str(crudo))))


def sin_analitica(url: str) -> str:
    """La URL del fichero sin los ``utm_*`` que le pega la API (punto 4 de la cabecera)."""
    partes = urllib.parse.urlsplit(url)
    query = [
        (clave, valor)
        for clave, valor in urllib.parse.parse_qsl(partes.query, keep_blank_values=True)
        if clave not in _ANALITICA
    ]
    return urllib.parse.urlunsplit(partes._replace(query=urllib.parse.urlencode(query)))


def leer_busqueda(cuerpo: bytes, *, consultado: str) -> str | None:
    """El ítem que devuelve la búsqueda, o ``None`` si Wikidata no tiene nada con ese nombre."""
    leido = _json(cuerpo, que=f"la búsqueda de «{consultado}» en Wikidata")
    resultados = leido.get("search")
    if not isinstance(resultados, list):
        raise ErrorCommons(
            f"la búsqueda de «{consultado}» en Wikidata no trae lista «search»: {leido.keys()}"
        )
    if not resultados:
        return None
    entidad = _texto(resultados[0].get("id"))
    if entidad is None or not ENTIDAD.match(entidad):
        raise ErrorCommons(
            f"la búsqueda de «{consultado}» devuelve un identificador {entidad!r} que no es un "
            "ítem de Wikidata"
        )
    return entidad


def _enunciados(cuerpo: bytes, propiedad: str, *, entidad: str) -> list[dict[str, Any]]:
    leido = _json(cuerpo, que=f"los enunciados {propiedad} de {entidad}")
    claims = leido.get("claims")
    if not isinstance(claims, dict):
        raise ErrorCommons(f"la respuesta de {propiedad} de {entidad} no trae «claims»")
    enunciados = claims.get(propiedad, [])
    if not isinstance(enunciados, list):
        raise ErrorCommons(f"«claims.{propiedad}» de {entidad} no es una lista")
    return enunciados


def _valor(enunciado: dict[str, Any]) -> str | None:
    """El valor de un enunciado, o ``None`` si es de los que no tienen (``somevalue``/``novalue``)."""
    snak = enunciado.get("mainsnak") or {}
    if snak.get("snaktype") != "value":
        return None
    return _texto((snak.get("datavalue") or {}).get("value"))


def leer_nombre_cientifico(cuerpo: bytes, *, entidad: str) -> str | None:
    """El `P225` que declara el ítem, o ``None`` si no declara ninguno (o sea: no es un taxón)."""
    for enunciado in _enunciados(cuerpo, PROPIEDAD_NOMBRE_CIENTIFICO, entidad=entidad):
        if enunciado.get("rank") == RANGO_DESCARTADO:
            continue
        valor = _valor(enunciado)
        if valor:
            return valor
    return None


def leer_imagenes(cuerpo: bytes, *, entidad: str) -> tuple[str, ...]:
    """Los ficheros `P18` del ítem, **preferidos primero** y sin los descartados (punto 2).

    El orden es el de la fuente salvo por el rango, que también es de la fuente: no se reordena por
    ningún criterio nuestro —ni por tamaño, ni por nombre, ni por «parece una foto»—, porque eso
    volvería a ser una elección editorial nuestra disfrazada de la de Wikidata.
    """
    enunciados = [
        enunciado
        for enunciado in _enunciados(cuerpo, PROPIEDAD_IMAGEN, entidad=entidad)
        if enunciado.get("rank") != RANGO_DESCARTADO
    ]
    preferidos = [e for e in enunciados if e.get("rank") == RANGO_PREFERIDO]
    resto = [e for e in enunciados if e.get("rank") != RANGO_PREFERIDO]
    ficheros = [_valor(enunciado) for enunciado in [*preferidos, *resto]]
    return tuple(f"File:{fichero}" for fichero in ficheros if fichero)


def leer_metadatos(cuerpo: bytes, *, fichero: str) -> Metadatos:
    """El `imageinfo` de un fichero → `Metadatos`, con los huecos que Commons tenga.

    Que falte el autor o la licencia **no es un error**: es el desenlace del punto 3, y quien decide
    qué hacer con él es ``resolver``. Lo que sí aborta es que la respuesta no se parezca a un
    `imageinfo`, porque entonces no sabemos ni lo que estamos leyendo.
    """
    leido = _json(cuerpo, que=f"el imageinfo de «{fichero}»")
    paginas = (leido.get("query") or {}).get("pages")
    if not isinstance(paginas, dict) or not paginas:
        raise ErrorCommons(f"el imageinfo de «{fichero}» no trae páginas: {leido}")
    pagina = next(iter(paginas.values()))
    if "missing" in pagina or not pagina.get("imageinfo"):
        return Metadatos(fichero=fichero, url=None, descripcion=None, autor=None, licencia=None,
                         licencia_url=None)
    info = pagina["imageinfo"][0]
    extra = info.get("extmetadata") or {}

    def campo(nombre: str) -> Any:
        return (extra.get(nombre) or {}).get("value")

    url = _texto(info.get("url"))
    return Metadatos(
        fichero=_texto(pagina.get("title")) or fichero,
        url=sin_analitica(url) if url else None,
        descripcion=_texto(info.get("descriptionurl")),
        autor=texto_plano(campo(ARTISTA)),
        licencia=_texto(campo(LICENCIA_CORTA)),
        licencia_url=_texto(campo(LICENCIA_URL)),
    )


# --------------------------------------------------------------------------------------------
# Camino con red
# --------------------------------------------------------------------------------------------


def descargar(url: str, *, refresh: bool = False) -> bytes:
    """Una descarga educada: con nuestro `User-Agent`, con caché y obedeciendo el `Retry-After`."""
    return cache.fetch_educado(
        url, suffix=".json", refresh=refresh, agente=AGENTE, pausa=PAUSA_SEGUNDOS
    )


def _sin_foto(
    consultado: str, motivo: str, desenlace: str, entidad: str | None = None
) -> Resultado:
    return Resultado(
        consultado=consultado, motivo=motivo, entidad=entidad, desenlace=desenlace
    )


def resolver(nombre: str, *, refresh: bool = False) -> Resultado:
    """Nombre científico → foto publicable, o el motivo exacto de que no la haya.

    Los cuatro motivos posibles son los cuatro puntos de la cabecera del módulo, en orden: no hay
    ítem, el ítem no es ese taxón, el ítem no tiene `P18`, o ninguna de sus `P18` acredita lo que
    hace falta para publicarla. Ninguno interrumpe la ingesta: **aborta la fila, no el proceso**.
    """
    consultado = " ".join(nombre.split())
    entidad = leer_busqueda(descargar(url_busqueda(consultado), refresh=refresh),
                            consultado=consultado)
    if entidad is None:
        return _sin_foto(
            consultado, f"Wikidata no tiene ningún ítem para «{consultado}»", SIN_ITEM
        )

    declarado = leer_nombre_cientifico(
        descargar(url_claims(entidad, PROPIEDAD_NOMBRE_CIENTIFICO), refresh=refresh),
        entidad=entidad,
    )
    if declarado is None:
        return _sin_foto(
            consultado,
            f"el ítem {entidad} al que llega la búsqueda de «{consultado}» no declara nombre "
            f"científico ({PROPIEDAD_NOMBRE_CIENTIFICO}), así que no se puede comprobar que sea "
            "ese taxón",
            OTRO_TAXON,
            entidad,
        )
    if declarado.lower() != consultado.lower():
        return _sin_foto(
            consultado,
            f"la búsqueda de «{consultado}» lleva al ítem {entidad}, que declara ser «{declarado}»: "
            "no es el mismo taxón y no se publica su foto",
            OTRO_TAXON,
            entidad,
        )

    ficheros = leer_imagenes(
        descargar(url_claims(entidad, PROPIEDAD_IMAGEN), refresh=refresh), entidad=entidad
    )
    if not ficheros:
        return _sin_foto(
            consultado,
            f"el taxón «{consultado}» ({entidad}) no tiene {PROPIEDAD_IMAGEN} en Wikidata: sin "
            "imagen vinculada al ítem no se busca ninguna por texto",
            SIN_IMAGEN,
            entidad,
        )

    descartadas: list[str] = []
    for fichero in ficheros:
        metadatos = leer_metadatos(
            descargar(url_imageinfo(fichero), refresh=refresh), fichero=fichero
        )
        if metadatos.completa:
            return Resultado(
                consultado=consultado,
                entidad=entidad,
                foto=Foto(
                    entidad=entidad,
                    fichero=metadatos.fichero,
                    url=metadatos.url or "",
                    descripcion=metadatos.descripcion or "",
                    autor=metadatos.autor or "",
                    licencia=metadatos.licencia or "",
                    licencia_url=metadatos.licencia_url or "",
                ),
            )
        descartadas.append(f"«{fichero}» no publica {', '.join(metadatos.carencias)}")
    return _sin_foto(
        consultado,
        f"ninguna de las {len(ficheros)} imágenes {PROPIEDAD_IMAGEN} de «{consultado}» ({entidad}) "
        f"se puede publicar: {'; '.join(descartadas)}. Una imagen sin autor o sin licencia no se "
        "publica, y el hueco es más honrado",
        SIN_METADATOS,
        entidad,
    )
