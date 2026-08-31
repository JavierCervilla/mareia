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

**1 · Al ítem se llega preguntando por el nombre declarado, no buscando texto; y se comprueba
igualmente el destino.** `wbsearchentities` resuelve `Dicentrarchus labrax` a `Q217129` por alias,
pero es una búsqueda y puede traer cualquier cosa (un apellido, un barco, una canción). Medido el
2026-08-31, en cuatro de los taxones de la norma traía justamente eso: `Sepia` llevaba a `Q286026`,
que declara «Sapia»; `Mugil` a `Q234014`, que declara «Mugil cephalus»; y `Venus` a `Q47652`, que no
declara nombre científico ninguno. La comprobación de `P225` cazaba los tres —por eso no se publicó
la foto de otro animal—, pero **el que se equivocaba era el buscador**.

Wikidata sabe responder la pregunta buena: *«qué ítem declara exactamente este nombre científico»*.
Se pregunta con `list=search` y `haswbstatement:"P225=<nombre>"` —**las comillas importan**: sin
ellas los nombres de dos palabras devuelven vacío— y los tres de arriba salen bien a la primera:
`Q3478857`, `Q631692` y `Q1408724`. La búsqueda de texto se queda **de reserva**, para cuando nadie
declara ese nombre, y **la comprobación de `P225` del ítem devuelto se queda en los dos caminos**:
por el primero es casi tautológica, pero el índice de búsqueda puede devolver ruido y no queremos
fiarnos de eso.

Y si el nombre lo declara **más de un ítem**, no se elige: la fila cae a `sinFoto` diciendo que hay
ambigüedad y **cuáles** son los ítems. Elegir sería justo la conjetura que este módulo no hace.

**2 · Un taxón puede tener varias `P18`.** `Q217129` trae **tres**. Elegir «la primera» no es aquí
una decisión taxonómica —las tres son imágenes del mismo taxón según Wikidata, a diferencia de los
homónimos de WoRMS—, así que se recorren en el orden que manda la propia fuente: primero las de
rango `preferred`, nunca las `deprecated`, y se publica **la primera cuyos metadatos estén
completos**. Descartar el ítem entero porque su imagen principal no acredite autor sería tirar una
identificación buena por un problema de otra cosa.

**3 · Sin licencia no se publica; el autor y la URL de la licencia son condicionales, y las
dos condiciones las declara la propia fuente.** `extmetadata` da `Artist`, `LicenseShortName` y
`LicenseUrl`, y los tres faltan a veces. La licencia y su código no tienen excepción: sin ellos la
fila cae a `sinFoto` con el motivo dicho, y **aborta la fila, no el proceso**.

El autor sí la tiene, y es una enmienda del 2026-08-31 pagada con otra medición. Exigirlo siempre
dejaba sin foto a dos especies —el bacalao y las lisas— cuya imagen es de la NOAA estadounidense:
medido, `File:Atlantic cod.jpg` y `File:Mugil cephalus.jpg` declaran `AttributionRequired = "false"`
y `Copyrighted = "False"`. **Quien dice que no hace falta atribuir es Commons, no nosotros**, y
publicar sin autor una imagen que su fuente declara libre de atribución no incumple nada; lo que
incumpliría es lo contrario. Por eso el autor sólo puede faltar cuando los **dos** campos están de
acuerdo, igual que con `licenciaUrl`: uno solo es una afirmación, dos que coinciden son una
comprobación. Y con `AttributionRequired = "true"` sin autor **no se publica jamás** —medido,
`File:Monkfish.jpg`, `cc-by-sa-3.0`, exige atribuir y no dice a quién—: ahí quien lo impide es la
licencia, no nosotros.

`atribucionRequerida` viaja **dentro de la foto** por el mismo motivo que `licenciaCodigo`: para que
el gate F2 pueda comprobar la excepción sobre el JSON publicado en vez de confiar en que la ingesta
la aplicó bien. Y cuando la fuente **no** publica el campo, se lee como «sí hace falta atribuir»:
el silencio de un tercero no es un permiso.

La URL sí la tiene, y es una enmienda del 2026-08-30 pagada con una medición. Exigirla en toda foto
dejó 15 especies sin imagen teniendo una perfectamente acreditada: **25 de los 26 ficheros** que
había detrás de los huecos son `License = "pd"`, `LicenseShortName = "Public domain"`,
`Copyrighted = "False"` y **sin `LicenseUrl`**. El dominio público no tiene condiciones, así que no
hay condiciones que enlazar: pedir su URL era un error de categoría, y encima publicaba un motivo
falso —«una imagen sin autor o sin licencia no se publica»— de ficheros que publican las dos cosas.

De ahí las dos piezas que este módulo añade. Se piden a la API **dos** campos más, `License` (el
código legible por máquina) y `Copyrighted`, y una licencia cuenta como sin condiciones **sólo si
los dos están de acuerdo**: el código en un allowlist cerrado (`LICENCIAS_SIN_CONDICIONES`) y
`Copyrighted == "False"`. Un campo solo es una afirmación; dos que coinciden es una comprobación.
Cualquier otra licencia sin URL sigue cayendo a `sinFoto`, y `descripcion` —la página del fichero en
Commons— es lo que el dominio público ofrece **en lugar** de la URL: el lector siempre llega a la
fuente.

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
doce del plan, incluida una `CC BY-SA 3.0 de` de jurisdicción alemana— y por eso `licencia`,
`licenciaCodigo`, `autor` y (cuando la hay) `licenciaUrl` viajan dentro de cada foto y no en un pie
global. **No se mirrorea Commons**: se guardan los metadatos y se enlaza el fichero.

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

#: `P225` (*taxon name*) es el nombre científico que el ítem declara. Es por lo que se pregunta
#: para llegar al ítem, y lo que se vuelve a comprobar en el ítem al que se llegue (punto 1).
PROPIEDAD_NOMBRE_CIENTIFICO = "P225"

#: `P31` (*instance of*) es lo que el ítem dice **ser**. Aquí sólo se mira para una cosa: descartar
#: los ítems que la propia Wikidata marca como duplicados al deshacer una ambigüedad.
PROPIEDAD_INSTANCIA_DE = "P31"

#: *Wikimedia duplicated page*: el ítem que Wikidata declara duplicado de otro. Cuando dos ítems
#: dicen ser el mismo taxón y uno lleva esta marca, la ambigüedad no la resolvemos nosotros — ya la
#: resolvió la fuente, y leerlo es lo contrario de elegir.
ENTIDAD_PAGINA_DUPLICADA = "Q17362920"

#: Cuántos ítems se piden al preguntar por un nombre científico declarado. No es 1 a propósito: con
#: `limit=1` una ambigüedad —dos taxones distintos declarando el mismo nombre— llegaría disfrazada
#: de respuesta única, y lo que hay que poder ver es justamente que hay más de uno.
LIMITE_DE_ITEMS = "5"

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

#: Los metadatos que se le piden a Commons, con el nombre que les da Commons. Los tres primeros son
#: lo que se publica; los dos últimos son los que deciden si hay condiciones que enlazar.
ARTISTA = "Artist"
LICENCIA_CORTA = "LicenseShortName"
LICENCIA_URL = "LicenseUrl"

#: El código de licencia legible por máquina (`cc-by-sa-4.0`, `pd`, `cc0`). Se publica porque es lo
#: que hace la excepción del dominio público **comprobable en el artefacto**: sin él, el gate F2
#: —que lee el JSON publicado, no la ingesta— no puede distinguir «dominio público, no hay
#: condiciones» de «se nos perdió la URL».
LICENCIA_CODIGO = "License"

#: Si Commons dice que la obra está sujeta a derechos de autor. Viene como `"True"`/`"False"`.
CON_DERECHOS = "Copyrighted"

#: Si Commons dice que reutilizar el fichero **obliga a atribuir**. Viene como `"true"`/`"false"`.
#: Es el campo que abre la única excepción a publicar el autor, y se publica en la foto para que el
#: gate F2 pueda comprobarla sobre el artefacto.
ATRIBUCION_REQUERIDA = "AttributionRequired"

#: El valor de `AttributionRequired` que significa «no hace falta atribuir». **La ausencia del campo
#: no cuenta**: se compara contra esto, así que un fichero que no lo declare exige autor.
NO_HACE_FALTA_ATRIBUIR = "false"

#: Los códigos de `License` que significan **no hay condiciones de reutilización que enlazar**.
#:
#: Es un **allowlist cerrado** y hoy tiene un solo elemento, y esa estrechez es la decisión. `pd` es
#: el dominio público: la obra no está sujeta a derechos, así que no hay texto de licencia al que
#: mandar al lector. Lo que **no** entra: `cc0` —que sí es una renuncia con texto y con URL, y la
#: trae—, ni ninguna `cc-*`, ni «no me consta la licencia». Una lista abierta («todo lo que no
#: traiga URL») convertiría el descuido de la fuente en un permiso.
LICENCIAS_SIN_CONDICIONES: frozenset[str] = frozenset({"pd"})

#: El valor de `Copyrighted` que corrobora al allowlist. Se compara en minúsculas porque lo que se
#: comprueba es lo que dijo la fuente, no cómo lo escribió.
SIN_DERECHOS_DE_AUTOR = "false"

_ETIQUETA_HTML = re.compile(r"<[^>]+>")
#: Forma de un ítem de Wikidata. Se comprueba aquí y lo vuelve a comprobar el gate F2
#: sobre el artefacto: una cita que no se puede ir a mirar no es una cita.
ENTIDAD = re.compile(r"^Q[1-9][0-9]*$")

#: Los parámetros de analítica que Commons pega a la URL del fichero (punto 4 de la cabecera).
_ANALITICA = ("utm_source", "utm_campaign", "utm_content")

#: Los seis desenlaces de preguntar por la foto de un taxón. Se publican contados en la salida de
#: la ingesta y son los que dicen **cuántas** especies se quedan sin foto y **por qué**: un censo de
#: huecos con una sola cifra («62 con foto») esconde justo lo que hay que poder discutir.
PUBLICABLE = "publicable"
SIN_ITEM = "sin_item"
#: Más de un ítem declara ese nombre científico. No es «no hay»: es «hay varios y no elegimos».
AMBIGUO = "ambiguo"
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
    """Lo que Commons dice de un fichero. Los campos publicables pueden faltar, y faltan."""

    fichero: str
    url: str | None
    descripcion: str | None
    autor: str | None
    licencia: str | None
    licencia_codigo: str | None
    licencia_url: str | None
    #: El `Copyrighted` crudo. No se publica: sólo corrobora —al código de licencia y al
    #: `AttributionRequired`—, que es lo que convierte las dos excepciones de este módulo en
    #: comprobaciones y no en afirmaciones.
    con_derechos: str | None
    #: El `AttributionRequired` crudo, tal y como lo escribe Commons. Sí se publica, convertido a
    #: booleano: es lo que permite al gate F2 comprobar sobre el artefacto por qué una foto se
    #: publica sin autor.
    atribucion_requerida: str | None

    @property
    def dominio_publico(self) -> bool:
        """Si esta imagen **no tiene condiciones de reutilización que enlazar**.

        Hacen falta tres cosas, y ninguna sobra:

        1. El código de licencia está en el allowlist cerrado (`LICENCIAS_SIN_CONDICIONES`).
        2. `Copyrighted` dice que **no** hay derechos. Es el segundo campo, independiente del
           primero: uno solo es una afirmación de la fuente; dos que coinciden es una comprobación.
        3. La fuente **no** da `LicenseUrl`. La excepción existe porque no hay condiciones que
           enlazar, así que el día en que Commons enlazara unas, el fichero se publica por el camino
           normal —con su URL— y no por la excepción. Es lo que hace imposible por construcción que
           una entrada de dominio público lleve URL: ni buena, ni rota.
        """
        return (
            (self.licencia_codigo or "").strip().lower() in LICENCIAS_SIN_CONDICIONES
            and (self.con_derechos or "").strip().lower() == SIN_DERECHOS_DE_AUTOR
            and not self.licencia_url
        )

    @property
    def exige_atribuir(self) -> bool:
        """Si la fuente dice que reutilizar este fichero **obliga a acreditar a su autor**.

        **La ausencia del campo cuenta como que sí.** Se compara contra el `"false"` explícito, no
        contra la falta: que Commons no diga nada sobre la atribución no es Commons diciendo que no
        hace falta, y leerlo así convertiría un hueco de metadatos en un permiso que nadie ha dado.
        """
        return (self.atribucion_requerida or "").strip().lower() != NO_HACE_FALTA_ATRIBUIR

    @property
    def puede_publicarse_sin_autor(self) -> bool:
        """Si esta imagen se puede publicar **sin acreditar a nadie**, porque su fuente lo dice.

        Hacen falta las dos cosas, y por el mismo motivo que en `dominio_publico`: `Copyrighted`
        es un campo independiente de `AttributionRequired`, y uno solo es una afirmación de la
        fuente mientras que dos que coinciden son una comprobación. Medido el 2026-08-31, los dos
        ficheros de la NOAA que estaban detrás de los huecos del bacalao y de las lisas los
        declaran los dos: `AttributionRequired = "false"` y `Copyrighted = "False"`.

        No es una excepción nuestra: es un campo que publica Commons. Y no se aplica al revés —con
        `AttributionRequired = "true"` y sin autor no se publica jamás—, porque ahí quien lo impide
        es la licencia del fichero.
        """
        return (
            not self.exige_atribuir
            and (self.con_derechos or "").strip().lower() == SIN_DERECHOS_DE_AUTOR
        )

    @property
    def carencias(self) -> tuple[str, ...]:
        """Qué le falta para poder publicarse, dicho con el nombre que usa el dataset.

        Dos campos son **condicionales**, y los dos lo son porque lo dice la propia fuente en un
        par de campos que tienen que coincidir: `autor` se exige salvo que Commons declare que no
        hace falta atribuir, y `licenciaUrl` salvo que declare que no hay condiciones que enlazar.
        La licencia y su código no tienen excepción ninguna.
        """
        faltan: dict[str, str | None] = {"url": self.url, "descripcion": self.descripcion}
        if not self.puede_publicarse_sin_autor:
            faltan["autor"] = self.autor
        faltan["licencia"] = self.licencia
        faltan["licenciaCodigo"] = self.licencia_codigo
        if not self.dominio_publico:
            faltan["licenciaUrl"] = self.licencia_url
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
    #: Quién hizo la foto, o ``None`` cuando Commons **no registra ninguno y declara que no hace
    #: falta atribuir**. `None` no es «se nos perdió»: es la única forma de decir «la fuente no lo
    #: sabe y su licencia no lo exige» sin inventarse un nombre, y la ficha lo dice con todas las
    #: letras en vez de pintar «Foto de  · Dominio público».
    autor: str | None
    #: Lo que la fuente declara sobre atribuir, tal cual, ya como booleano. Se publica **siempre**,
    #: también cuando hay autor: es la condición que hace comprobable la excepción de arriba.
    atribucion_requerida: bool
    licencia: str
    #: El código legible por máquina de la licencia. Obligatorio siempre.
    licencia_codigo: str
    #: La URL de las condiciones, o ``None`` cuando no hay condiciones que enlazar. `None` no es «se
    #: nos perdió»: es la única forma de decir «dominio público» sin inventarse un enlace, y el
    #: contrato exige entonces que el campo **no aparezca** en el JSON.
    licencia_url: str | None


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


def url_por_nombre_cientifico(nombre: str) -> str:
    """Los ítems que **declaran** ese nombre científico (`P225`). La pregunta buena del punto 1.

    `haswbstatement` es un filtro del índice de búsqueda de Wikidata, no una búsqueda de texto: pide
    los ítems que tienen ese enunciado con ese valor. **Las comillas alrededor del valor no son
    adorno**: medido el 2026-08-31, `haswbstatement:P225=Gadus morhua` sin ellas devuelve vacío
    —el espacio parte el filtro— y `haswbstatement:"P225=Gadus morhua"` devuelve `Q199788`. Con
    nombres de una palabra funcionan las dos, que es la forma en que un error así pasa la prueba
    fácil y se rompe en los taxones con binomio, o sea en casi todos.

    `srprop` va vacío a propósito: de cada resultado sólo hace falta el título —el ítem—, y pedir
    los extractos de texto sería guardar en caché párrafos ajenos que no se publican.
    """
    parametros = {
        "action": "query",
        "format": "json",
        "list": "search",
        "srsearch": f'haswbstatement:"{PROPIEDAD_NOMBRE_CIENTIFICO}={nombre}"',
        "srlimit": LIMITE_DE_ITEMS,
        "srprop": "",
    }
    return f"{URL_WIKIDATA}?{urllib.parse.urlencode(parametros)}"


def url_busqueda(nombre: str) -> str:
    """El ítem que mejor casa con un nombre científico. Es **la reserva** del punto 1: una búsqueda
    de texto, que se usa sólo cuando ningún ítem declara ese nombre."""
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
    """La URL del fichero y su `extmetadata`, pidiendo **sólo** los campos que hacen falta.

    Seis: los tres que se publican tal cual y los tres que deciden las dos condicionales —si hay
    condiciones que enlazar y si hace falta atribuir—. `extmetadata` trae por defecto decenas de
    campos —descripción, categorías, EXIF, fechas— y pedirlos todos sería guardar en caché un montón
    de dato ajeno del que no respondemos.
    """
    parametros = {
        "action": "query",
        "format": "json",
        "titles": fichero if fichero.startswith("File:") else f"File:{fichero}",
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
        "iiextmetadatafilter": (
            f"{LICENCIA_CORTA}|{ARTISTA}|{LICENCIA_URL}|{LICENCIA_CODIGO}|{CON_DERECHOS}"
            f"|{ATRIBUCION_REQUERIDA}"
        ),
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


def leer_items_por_nombre(cuerpo: bytes, *, consultado: str) -> tuple[str, ...]:
    """Los ítems que declaran ese nombre científico, **todos**, en el orden que los da Wikidata.

    Devuelve una tupla y no un ítem justamente para que «hay dos» sea representable: ese caso no es
    una respuesta que haya que reducir, es una pregunta que ``resolver`` tiene que dejar sin
    contestar. Un identificador que no tenga forma de ítem aborta, igual que en la búsqueda.
    """
    leido = _json(cuerpo, que=f"los ítems que declaran «{consultado}» en Wikidata")
    resultados = (leido.get("query") or {}).get("search")
    if not isinstance(resultados, list):
        raise ErrorCommons(
            f"la consulta de los ítems que declaran «{consultado}» no trae lista «search»: "
            f"{leido.keys()}"
        )
    items: list[str] = []
    for resultado in resultados:
        entidad = _texto((resultado or {}).get("title"))
        if entidad is None or not ENTIDAD.match(entidad):
            raise ErrorCommons(
                f"la consulta de los ítems que declaran «{consultado}» devuelve un identificador "
                f"{entidad!r} que no es un ítem de Wikidata"
            )
        items.append(entidad)
    return tuple(items)


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


def leer_instancias(cuerpo: bytes, *, entidad: str) -> tuple[str, ...]:
    """Los ítems que `P31` declara que este ítem **es**. Se usa sólo para ver marcas de duplicado."""
    instancias: list[str] = []
    for enunciado in _enunciados(cuerpo, PROPIEDAD_INSTANCIA_DE, entidad=entidad):
        if enunciado.get("rank") == RANGO_DESCARTADO:
            continue
        snak = enunciado.get("mainsnak") or {}
        if snak.get("snaktype") != "value":
            continue
        valor = (snak.get("datavalue") or {}).get("value")
        identificador = valor.get("id") if isinstance(valor, dict) else None
        if isinstance(identificador, str) and ENTIDAD.match(identificador):
            instancias.append(identificador)
    return tuple(instancias)


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
                         licencia_codigo=None, licencia_url=None, con_derechos=None,
                         atribucion_requerida=None)
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
        licencia_codigo=_texto(campo(LICENCIA_CODIGO)),
        licencia_url=_texto(campo(LICENCIA_URL)),
        con_derechos=_texto(campo(CON_DERECHOS)),
        atribucion_requerida=_texto(campo(ATRIBUCION_REQUERIDA)),
    )


# --------------------------------------------------------------------------------------------
# Camino con red
# --------------------------------------------------------------------------------------------


def descargar(url: str, *, refresh: bool = False) -> bytes:
    """Una descarga educada: con nuestro `User-Agent`, con caché y obedeciendo el `Retry-After`."""
    return cache.fetch_educado(
        url, suffix=".json", refresh=refresh, agente=AGENTE, pausa=PAUSA_SEGUNDOS
    )


#: Los campos cuya falta es «no acredita a su autor» y «no dice bajo qué condiciones», que son las
#: dos mitades del crédito. Se separan porque el motivo tiene que nombrar la que de verdad falta.
_ES_LICENCIA = frozenset({"licencia", "licenciaCodigo", "licenciaUrl"})


def _cierre_del_motivo(faltan: set[str]) -> str:
    """La última frase del motivo del hueco, que tiene que decir la verdad sobre lo que falta.

    Había una sola, escrita para el caso frecuente —«una imagen sin autor o sin licencia no se
    publica»— y se publicaba también donde no venía a cuento: el 2026-08-30, **15 fichas** daban
    esa razón de ficheros que acreditan autor **y** licencia y a los que sólo les faltaba una URL de
    condiciones que el dominio público no tiene. Un motivo que no es el motivo es peor que no dar
    ninguno, porque el que lo lee no vuelve a preguntar; y era, además, la única señal de que el
    contrato estaba mal.
    """
    partes = []
    if "autor" in faltan:
        partes.append("sin autor")
    if faltan & _ES_LICENCIA:
        partes.append("sin licencia")
    if faltan - _ES_LICENCIA - {"autor"}:
        partes.append("sin imagen ni página donde comprobarla")
    return f"Una foto {' y '.join(partes)} no se publica, y el hueco es más honrado"


def _sin_foto(
    consultado: str, motivo: str, desenlace: str, entidad: str | None = None
) -> Resultado:
    return Resultado(
        consultado=consultado, motivo=motivo, entidad=entidad, desenlace=desenlace
    )


@dataclass(frozen=True)
class _Identificacion:
    """A qué ítem se llegó preguntando por un nombre científico, o por qué no se llegó a ninguno."""

    entidad: str | None = None
    #: Cuando no hay ítem que valga, el resultado ya escrito con su motivo y su desenlace.
    fallo: Resultado | None = None


def _sin_duplicados(items: tuple[str, ...], *, refresh: bool) -> tuple[str, ...]:
    """Quita los ítems que Wikidata declara duplicados de otro (`P31 = Q17362920`).

    Es la primera mitad de deshacer una ambigüedad **sin elegir**: cuando dos ítems dicen ser el
    mismo taxón y uno lleva la marca de duplicado, la fuente ya ha dicho cuál sobra.

    Si al filtrar no quedara ninguno —todos marcados—, se devuelven los de entrada sin tocar: un
    filtro que se lo lleva todo no ha deshecho nada, y vaciar la lista convertiría «no sé cuál» en
    «no hay», que son dos frases distintas.
    """
    vivos = tuple(
        item
        for item in items
        if ENTIDAD_PAGINA_DUPLICADA
        not in leer_instancias(
            descargar(url_claims(item, PROPIEDAD_INSTANCIA_DE), refresh=refresh), entidad=item
        )
    )
    return vivos or items


def _los_dos_caminos_de_acuerdo(
    consultado: str, items: tuple[str, ...], *, refresh: bool
) -> tuple[str, ...]:
    """El ítem en el que coinciden preguntar por `P225` y buscar el nombre como texto.

    Segunda mitad de deshacer la ambigüedad sin elegir. Los dos caminos fallan de maneras
    **distintas** —el exacto trae de más cuando Wikidata tiene ítems repetidos; el de texto trae
    otra cosa cuando el nombre se parece a un apellido o a un planeta—, así que que ambos señalen al
    mismo ítem es una comprobación y no una preferencia. Es el mismo principio con el que este
    módulo acepta el dominio público: **una señal sola es una afirmación; dos que coinciden son una
    comprobación.**

    Si la búsqueda de texto no lleva a ninguno de los candidatos, se devuelven todos y el empate
    sigue en pie: la concordancia sólo puede confirmar, nunca desempatar por su cuenta.
    """
    entidad = leer_busqueda(
        descargar(url_busqueda(consultado), refresh=refresh), consultado=consultado
    )
    return (entidad,) if entidad in items else items


def _identificar(consultado: str, *, refresh: bool) -> _Identificacion:
    """El ítem del taxón: por el nombre que declara y, sólo si nadie lo declara, buscándolo.

    Los tres desenlaces del punto 1, y los tres son distintos entre sí:

    * **Uno lo declara** → ése es el ítem. Es el camino normal y el que arregla los cuatro taxones
      que la búsqueda de texto mandaba a otra parte.
    * **Lo declaran varios** → se intenta deshacer la ambigüedad **con la fuente, nunca con nuestro
      criterio**, y sólo por dos caminos. Primero, se descartan los ítems que Wikidata marca como
      duplicados (`P31 = Q17362920`): eso no es elegir, es leer lo que la fuente ya decidió. Y si
      aún quedan varios, se mira si el ítem al que llega **la búsqueda de texto** está entre ellos:
      cuando los dos caminos independientes coinciden, esa concordancia es la que decide, y sigue
      sin ser una decisión nuestra. Lo que **no** se hace nunca es desempatar por el primero, por el
      número más bajo o por cuál tiene foto — eso sí sería la conjetura que este módulo existe para
      no hacer. Si ninguno de los dos caminos deshace el empate, cae con los ítems nombrados, para
      que quien lea el hueco pueda ir a mirarlos.
    * **No lo declara ninguno** → se cae a la búsqueda de texto de siempre, que es peor pero es
      mejor que nada, y el `P225` del ítem que devuelva se comprueba igual.
    """
    items = leer_items_por_nombre(
        descargar(url_por_nombre_cientifico(consultado), refresh=refresh), consultado=consultado
    )
    if len(items) > 1:
        candidatos = _sin_duplicados(items, refresh=refresh)
        if len(candidatos) > 1:
            candidatos = _los_dos_caminos_de_acuerdo(consultado, candidatos, refresh=refresh)
        if len(candidatos) != 1:
            return _Identificacion(
                fallo=_sin_foto(
                    consultado,
                    f"«{consultado}» es el nombre científico ({PROPIEDAD_NOMBRE_CIENTIFICO}) que "
                    f"declaran {len(items)} ítems distintos de Wikidata "
                    f"({', '.join(items)}), ninguno marcado como duplicado y ninguno al que llegue "
                    "también la búsqueda de texto: elegir uno sería decidir por nuestra cuenta cuál "
                    "de ellos es el taxón que regula la norma",
                    AMBIGUO,
                )
            )
        items = candidatos
    if items:
        return _Identificacion(entidad=items[0])
    entidad = leer_busqueda(
        descargar(url_busqueda(consultado), refresh=refresh), consultado=consultado
    )
    if entidad is None:
        return _Identificacion(
            fallo=_sin_foto(
                consultado,
                f"ningún ítem de Wikidata declara «{consultado}» como nombre científico "
                f"({PROPIEDAD_NOMBRE_CIENTIFICO}), y buscar el nombre como texto tampoco lleva a "
                "ninguno",
                SIN_ITEM,
            )
        )
    return _Identificacion(entidad=entidad)


def resolver(nombre: str, *, refresh: bool = False) -> Resultado:
    """Nombre científico → foto publicable, o el motivo exacto de que no la haya.

    Los cinco motivos posibles son los de la cabecera del módulo, en orden: no hay ítem, el nombre
    lo declaran varios ítems, el ítem no es ese taxón, el ítem no tiene `P18`, o ninguna de sus
    `P18` acredita lo que hace falta para publicarla. Ninguno interrumpe la ingesta: **aborta la
    fila, no el proceso**.
    """
    consultado = " ".join(nombre.split())
    identificacion = _identificar(consultado, refresh=refresh)
    if identificacion.fallo is not None:
        return identificacion.fallo
    entidad = identificacion.entidad
    assert entidad is not None  # `_Identificacion` trae ítem o trae fallo, nunca ninguno de los dos

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
    faltan: set[str] = set()
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
                    autor=metadatos.autor,
                    atribucion_requerida=metadatos.exige_atribuir,
                    licencia=metadatos.licencia or "",
                    licencia_codigo=metadatos.licencia_codigo or "",
                    licencia_url=metadatos.licencia_url,
                ),
            )
        descartadas.append(f"«{fichero}» no publica {', '.join(metadatos.carencias)}")
        faltan.update(metadatos.carencias)
    return _sin_foto(
        consultado,
        f"ninguna de las {len(ficheros)} imágenes {PROPIEDAD_IMAGEN} de «{consultado}» ({entidad}) "
        f"se puede publicar: {'; '.join(descartadas)}. {_cierre_del_motivo(faltan)}",
        SIN_METADATOS,
        entidad,
    )
