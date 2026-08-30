"""Texto consolidado del RD 560/1995 (tallas mínimas) desde la API del BOE.

Este módulo es más largo que «bajarse una tabla» por una razón que se midió antes de escribirlo:
**un bloque de anexo del texto consolidado no es una tabla, son tres**. El BOE conserva dentro del
mismo bloque la redacción de cada versión histórica, cada una envuelta en
``<version id_norma fecha_publicacion fecha_vigencia>``, y sólo la última está en vigor:

    ani   → 19950409 (54 filas) · 20230721 (54) · 20251102 (55)
    anii  → 19950409 (39 filas) · 20060120 (36) · 20251102 (37)
    aniii → 19950409 (29 filas) · 20151130 (31) · 20251102 (32)

Un parser que leyera todos los ``<tr>`` del bloque publicaría, para el caladero canario, aligote 12
en vez de 20, cabrilla 15 en vez de 19, cachucho 18 en vez de 22, chopa 19 en vez de 23 y serrano
imperial 15 en vez de 20: **cinco cifras derogadas y las cinco por debajo de la vigente**, o sea del
lado que le cuesta una sanción a quien se fíe. Por eso ``_version_en_vigor`` **aborta** cuando no
encuentra ninguna ``<version>`` en lugar de caer hacia atrás a leer el bloque entero: el modo de
fallo que este módulo existe para impedir es exactamente ese apaño.

La segunda medición que da forma al módulo: la columna «Talla (en cm)» no contiene sólo tallas en
cm. Hay pesos (``6,4 kg``), disyunciones (``80 cm o 10 kg de peso``), celdas que sólo remiten a una
nota (``(*)``), decimales con coma (``3,7``), especies cuya cifra vive en filas hijas (la cigala,
el bogavante) y una celda ilegible en origen (``1 1`` en la boga del Anexo I). ``talla: number``
sería un tipo falso, así que se clasifica en una unión cerrada y **cada celda conserva su literal**.

Acceso: la API exige cabecera ``Accept`` y la exige distinta según el recurso —``metadatos`` e
``indice`` responden JSON, y los bloques de texto **sólo** responden XML: con
``Accept: application/json`` devuelven 400—. Sin ``Accept`` ninguno de los dos responde. Todo es
público y anónimo: no se usa ninguna credencial.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass

from mareia_pipeline.sources.cache import CACHE_DIR

API_BASE = "https://www.boe.es/datosabiertos/api/legislacion-consolidada/id"

#: Real Decreto 560/1995, de 7 de abril, por el que se establecen las tallas mínimas.
IDENTIFICADOR = "BOE-A-1995-8639"

#: Los tres bloques de anexo, en el orden en el que la norma los publica.
BLOQUES_DE_ANEXO: tuple[str, ...] = ("ani", "anii", "aniii")

#: Título del anexo que cada bloque tiene que traer. Es una comprobación estructural, no adorno: si
#: el BOE reordenara los bloques, publicar el Anexo III como si fuera el I asignaría las tallas
#: canarias al Cantábrico sin que nada se pusiera rojo.
ANEXO_ESPERADO: dict[str, str] = {"ani": "ANEXO I", "anii": "ANEXO II", "aniii": "ANEXO III"}

_USER_AGENT = "mareia-pipeline/1.0 (+https://github.com/universelle-io/mareia) python-urllib"
_TIMEOUT_SECONDS = 120

#: Marca de nota al pie. En la celda de talla el BOE la escribe entre paréntesis —``(*)``,
#: ``12 (**)``, ``36 (***)``— y en la de especie a veces suelta: ``Pulpo (Octopus vulgaris) *`` en
#: el Anexo II. Se buscan las dos formas en las dos celdas porque, si sólo se mirara la talla, la
#: excepción del pulpo en aguas de Illes Balears —diecisiete puertos del portal— se publicaría sin
#: la nota que la excepciona.
_ASTERISCOS = re.compile(r"\(?(\*{1,3})\)?")

#: Una nota al pie: un párrafo de la versión, fuera de la tabla, que abre con su marca.
_NOTA = re.compile(r"^\((\*{1,3})\)\s*(.+)$", re.DOTALL)

_LONGITUD = re.compile(r"^(\d+(?:,\d+)?)$")
_PESO = re.compile(r"^(\d+(?:,\d+)?)\s*kg$", re.IGNORECASE)
_LONGITUD_O_PESO = re.compile(
    r"^(\d+(?:,\d+)?)\s*cm\s+o\s+(\d+(?:,\d+)?)\s*kg(?:\s+de\s+peso)?$", re.IGNORECASE
)

#: Lo que tiene que decir la nota para que una celda sin cifra sea «talla por determinar» y no una
#: celda que no supimos leer. La diferencia importa: la primera es un dato de la norma —seis
#: especies del Anexo I no tienen talla fijada— y la segunda es un fallo nuestro.
_POR_DETERMINAR = re.compile(r"^talla\s+por\s+determinar\.?$", re.IGNORECASE)

#: Nombre común y nombre científico: ``Nombre común (Genus species)``. El paréntesis que cuenta es
#: **el último** —``Cigala (entera) (Nephrops norvegicus)``— y tiene que abrir en mayúscula, que es
#: lo que separa un nombre latino de una aclaración en castellano como ``Cigalas (colas)``.
_NOMBRE_CIENTIFICO = re.compile(r"^(?P<comun>.+?)\s*\((?P<cientifico>[A-ZÁÉÍÓÚÑ][^()]*)\)$")


class ErrorBoe(RuntimeError):
    """La fuente no dice lo que este módulo sabe leer, así que no se publica nada.

    Todos los caminos que levantan esto tienen la misma forma: **preferimos no publicar a publicar
    una cifra de la que no podemos responder**. Es la misma política con la que un puerto sin
    mareógrafo propio publica ``rmse_m: null`` en vez de la precisión del puerto de al lado.
    """


@dataclass(frozen=True)
class Metadatos:
    """Ficha de la norma consolidada: quién es, dónde vive y si sigue viva."""

    identificador: str
    titulo: str
    eli: str
    url_html_consolidada: str
    #: Sello de la última consolidación de la norma entera, ``AAAAMMDDThhmmssZ``.
    fecha_actualizacion: str
    fecha_disposicion: str
    #: ``"N"`` mientras la norma no esté derogada; cualquier otra cosa es motivo de aborto.
    estatus_derogacion: str
    vigencia_agotada: str

    @property
    def vigente(self) -> bool:
        return self.estatus_derogacion == "N" and self.vigencia_agotada == "N"


@dataclass(frozen=True)
class Nota:
    """Una nota al pie de la versión en vigor, con su marca tal y como la imprime el BOE."""

    marca: str
    texto: str


@dataclass(frozen=True)
class NombreDeclarado:
    """El nombre científico que la norma escribe entre paréntesis, literal."""

    valor: str


@dataclass(frozen=True)
class NombreAusente:
    """La norma no da ese nombre en esa fila, y aquí se dice por qué no está.

    Existe para que la ausencia sea un dato con motivo y no un hueco: inventar el binomio latino de
    «Cigalas (colas)» sería exactamente la clase de relleno que este dataset no hace.
    """

    motivo: str


Nombre = NombreDeclarado | NombreAusente


@dataclass(frozen=True)
class LongitudCm:
    """Talla mínima como longitud en centímetros."""

    cm: float


@dataclass(frozen=True)
class PesoKg:
    """Talla mínima expresada como peso: los túnidos y el pulpo del Anexo II y III."""

    kg: float


@dataclass(frozen=True)
class LongitudOPeso:
    """Cualquiera de las dos: ``80 cm o 10 kg de peso`` (atún rojo del Anexo II)."""

    cm: float
    kg: float


@dataclass(frozen=True)
class PorDeterminar:
    """La norma no fija talla y **lo dice**: seis especies del Anexo I con la nota «(*)».

    No es un dato que falte: es un dato que la norma declara pendiente, y omitir la fila lo
    escondería. Viaja con la marca de la nota que lo declara para que la celda se explique sola.
    """

    segun_nota: str


@dataclass(frozen=True)
class SinDatoLegible:
    """La celda no se puede leer como una talla y no se arregla por inferencia.

    El caso medido es la boga del Anexo I, donde el BOE imprime ``1 1`` y casi con seguridad quiso
    decir ``11``. Corregir una cifra legal por inferencia es lo que este proyecto no hace: se
    publica el literal, el motivo y el enlace al texto auténtico.
    """

    motivo: str


Talla = LongitudCm | PesoKg | LongitudOPeso | PorDeterminar | SinDatoLegible


@dataclass(frozen=True)
class Especie:
    """Una fila publicable de la tabla de un anexo, con su literal y sus notas."""

    nombre_comun: str
    nombre_cientifico: Nombre
    talla: Talla
    #: El literal de la celda de talla, tal cual lo imprime el BOE. Va siempre, en las cinco clases.
    texto_original: str
    #: Marcas de las notas que le aplican, en el orden en el que aparecen.
    notas: tuple[str, ...]
    #: Rótulo de la fila hija en las especies que se miden de varias formas (``Longitud
    #: cefalotórax``, ``Longitud total``). Vacío en las filas normales, que es la mayoría.
    medida: str = ""
    #: Nombre local canario (sólo Anexo III). Vacío también cuando la norma deja la celda vacía, y
    #: en ese caso ``nombre_local_ausente`` dice por qué.
    nombre_local: str = ""
    nombre_local_ausente: str = ""


@dataclass(frozen=True)
class Anexo:
    """Un anexo del RD, ya reducido a **su versión en vigor** y nada más."""

    bloque: str
    anexo: str
    titulo: str
    fecha_vigencia: dt.date
    fecha_publicacion: dt.date
    #: Identificador BOE de la norma que dio esta redacción (``BOE-A-2025-22024`` hoy en los tres).
    norma_modificadora: str
    #: Sello de actualización del bloque según el índice, ``AAAAMMDD``. Es la señal que el gate
    #: diario de vigencia compara: para saber que hay que mirar no hace falta diferenciar el texto.
    fecha_actualizacion: str
    notas: tuple[Nota, ...]
    especies: tuple[Especie, ...]


def _descargar(url: str, *, accept: str, refresh: bool) -> bytes:
    """Descarga con cabecera ``Accept`` y caché en disco.

    No usa ``cache.fetch`` porque ese ayudante no toma cabeceras y esta API las exige: sin
    ``Accept`` responde 400, y a los bloques de texto hay que pedirles XML mientras que a los
    metadatos hay que pedirles JSON. La copia vive en el mismo ``.cache`` que el resto del
    pipeline, así que ``make clean-cache`` sigue forzando el camino desde cero.
    """
    destino = CACHE_DIR / f"boe-{_clave(url, accept)}"
    if destino.exists() and not refresh:
        return destino.read_bytes()
    peticion = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT, "Accept": accept})
    with urllib.request.urlopen(peticion, timeout=_TIMEOUT_SECONDS) as respuesta:
        cuerpo = respuesta.read()
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(cuerpo)
    return cuerpo


def _clave(url: str, accept: str) -> str:
    sufijo = ".xml" if "xml" in accept else ".json"
    return hashlib.sha256(f"{accept} {url}".encode()).hexdigest()[:32] + sufijo


def _datos(cuerpo: bytes, *, que: str) -> list[dict]:
    """El array ``data`` de una respuesta JSON de la API, comprobando que la petición fue bien."""
    try:
        respuesta = json.loads(cuerpo)
    except json.JSONDecodeError as error:  # pragma: no cover - la API responde JSON o 400
        raise ErrorBoe(f"{que}: la respuesta no es JSON ({error})") from error
    codigo = str(respuesta.get("status", {}).get("code", ""))
    if codigo != "200":
        raise ErrorBoe(f"{que}: la API responde status {codigo or 'sin código'}")
    datos = respuesta.get("data")
    if not isinstance(datos, list) or not datos:
        raise ErrorBoe(f"{que}: la respuesta no trae datos")
    return datos


def descargar_metadatos(*, refresh: bool = False, identificador: str = IDENTIFICADOR) -> Metadatos:
    """Ficha de la norma consolidada."""
    cuerpo = _descargar(
        f"{API_BASE}/{identificador}/metadatos", accept="application/json", refresh=refresh
    )
    return leer_metadatos(cuerpo)


def leer_metadatos(cuerpo: bytes) -> Metadatos:
    """Parte pura de ``descargar_metadatos``, para poder probarla sin red."""
    ficha = _datos(cuerpo, que="metadatos")[0]
    faltan = [
        campo
        for campo in ("identificador", "titulo", "url_eli", "estatus_derogacion", "vigencia_agotada")
        if not ficha.get(campo)
    ]
    if faltan:
        raise ErrorBoe(f"metadatos: la ficha no declara {', '.join(faltan)}")
    return Metadatos(
        identificador=ficha["identificador"],
        titulo=ficha["titulo"],
        eli=ficha["url_eli"],
        url_html_consolidada=ficha.get("url_html_consolidada", ""),
        fecha_actualizacion=ficha.get("fecha_actualizacion", ""),
        fecha_disposicion=ficha.get("fecha_disposicion", ""),
        estatus_derogacion=ficha["estatus_derogacion"],
        vigencia_agotada=ficha["vigencia_agotada"],
    )


def comprobar_vigente(metadatos: Metadatos) -> None:
    """Aborta si la norma está derogada o su vigencia agotada.

    Se comprueba **antes** de mirar ninguna tabla: una norma derogada tiene anexos perfectamente
    parseables, y publicarlos sería publicar tallas que ya no obligan a nadie.
    """
    if not metadatos.vigente:
        raise ErrorBoe(
            f"{metadatos.identificador} no está vigente: estatus_derogacion="
            f"{metadatos.estatus_derogacion!r}, vigencia_agotada={metadatos.vigencia_agotada!r}. "
            "No se publica nada."
        )


def descargar_indice(*, refresh: bool = False, identificador: str = IDENTIFICADOR) -> dict[str, str]:
    """``id de bloque → fecha_actualizacion`` del índice del texto consolidado."""
    cuerpo = _descargar(
        f"{API_BASE}/{identificador}/texto/indice", accept="application/json", refresh=refresh
    )
    return leer_indice(cuerpo)


def leer_indice(cuerpo: bytes) -> dict[str, str]:
    """Parte pura de ``descargar_indice``."""
    bloques = _datos(cuerpo, que="índice")[0].get("bloque", [])
    indice = {b["id"]: b.get("fecha_actualizacion", "") for b in bloques if b.get("id")}
    faltan = [bloque for bloque in BLOQUES_DE_ANEXO if bloque not in indice]
    if faltan:
        raise ErrorBoe(f"índice: el texto consolidado ya no trae los bloques {', '.join(faltan)}")
    return indice


def descargar_bloque(
    bloque: str, *, refresh: bool = False, identificador: str = IDENTIFICADOR
) -> bytes:
    """XML de un bloque del texto consolidado. Sólo responde a ``Accept: application/xml``."""
    return _descargar(
        f"{API_BASE}/{identificador}/texto/bloque/{bloque}",
        accept="application/xml",
        refresh=refresh,
    )


def _texto(elemento: ET.Element) -> str:
    """Texto plano de un elemento, con los espacios de maquetación del BOE colapsados."""
    return re.sub(r"\s+", " ", "".join(elemento.itertext()).replace("\xa0", " ")).strip()


def _fecha(valor: str, *, que: str) -> dt.date:
    try:
        return dt.datetime.strptime(valor, "%Y%m%d").date()
    except ValueError as error:
        raise ErrorBoe(f"{que}: {valor!r} no es una fecha AAAAMMDD") from error


def _version_en_vigor(bloque_el: ET.Element, *, bloque: str, hoy: dt.date) -> ET.Element:
    """La ``<version>`` de mayor ``fecha_vigencia`` que no sea futura.

    **Sin camino de repuesto a propósito.** La tentación de «si no hay versiones, leo el bloque
    entero» es justo lo que mezcla la redacción de 1995 con la de 2025 y publica cifras derogadas,
    así que aquí no existe: si la fuente cambia de forma, esto se pone rojo y el dataset no se
    regenera.
    """
    versiones = bloque_el.findall("version")
    if not versiones:
        raise ErrorBoe(
            f"bloque {bloque}: no trae ninguna <version>, así que no se puede saber qué redacción "
            "está en vigor. No se lee el bloque entero: mezclaría las redacciones histórica y "
            "vigente en la misma tabla."
        )
    fechadas = [
        (_fecha(version.get("fecha_vigencia", ""), que=f"bloque {bloque}"), version)
        for version in versiones
    ]
    en_vigor = [par for par in fechadas if par[0] <= hoy]
    if not en_vigor:
        pendiente = min(fecha for fecha, _ in fechadas)
        raise ErrorBoe(
            f"bloque {bloque}: todas las versiones entran en vigor en el futuro (la más próxima, "
            f"el {pendiente.isoformat()}). No hay redacción aplicable hoy."
        )
    return max(en_vigor, key=lambda par: par[0])[1]


def _notas_de(version: ET.Element) -> tuple[Nota, ...]:
    """Notas al pie de la versión: los ``<p>`` fuera de la tabla que abren con su marca."""
    notas: list[Nota] = []
    for parrafo in version.findall("p"):
        casa = _NOTA.match(_texto(parrafo))
        if casa:
            notas.append(Nota(marca=f"({casa.group(1)})", texto=casa.group(2).strip()))
    return tuple(notas)


def _filas_de(version: ET.Element, *, bloque: str) -> list[list[str]]:
    """Las filas de la única tabla de la versión, ya en texto plano."""
    tablas = version.findall("table")
    if len(tablas) != 1:
        raise ErrorBoe(
            f"bloque {bloque}: la versión en vigor trae {len(tablas)} tablas y se esperaba una."
        )
    return [[_texto(celda) for celda in fila] for fila in tablas[0].findall(".//tr")]


def _cabecera(filas: list[list[str]], *, bloque: str) -> bool:
    """Comprueba la cabecera de la tabla y dice si el anexo trae nombre local canario.

    Se valida en vez de darse por supuesta porque las columnas son la diferencia entre leer una
    talla y leer un topónimo: el Anexo III mete «Nombre local canario» en medio.
    """
    if not filas:
        raise ErrorBoe(f"bloque {bloque}: la tabla de la versión en vigor está vacía")
    cabecera = filas[0]
    if len(cabecera) not in (2, 3):
        raise ErrorBoe(f"bloque {bloque}: cabecera de {len(cabecera)} columnas, se esperaban 2 o 3")
    if not cabecera[0].startswith("Especie") or not cabecera[-1].startswith("Talla"):
        raise ErrorBoe(f"bloque {bloque}: la cabecera de la tabla dice {cabecera!r}")
    if len(cabecera) == 3 and not cabecera[1].startswith("Nombre local"):
        raise ErrorBoe(f"bloque {bloque}: la columna intermedia dice {cabecera[1]!r}")
    return len(cabecera) == 3


def _marcas(texto: str) -> tuple[tuple[str, ...], str]:
    """Marcas de nota que hay en un texto y lo que queda del texto al quitarlas."""
    marcas = tuple(f"({grupo})" for grupo in _ASTERISCOS.findall(texto))
    return marcas, _ASTERISCOS.sub("", texto).strip()


def _numero(literal: str) -> float:
    """Cifra del BOE a número: el separador decimal de la norma es la coma."""
    return float(literal.replace(",", "."))


def clasificar_talla(texto: str, *, marcas: tuple[str, ...], notas: dict[str, str]) -> Talla:
    """Clasifica el literal de una celda de talla en la unión cerrada.

    ``texto`` llega ya sin las marcas de nota; ``marcas`` son las que llevaba y ``notas`` el texto
    de cada una, que hace falta para distinguir «la norma no fija talla y lo dice» de «esta celda no
    la sabemos leer». Confundirlas sería publicar un fallo nuestro como si fuera un dato de la
    norma, o al revés.
    """
    disyuncion = _LONGITUD_O_PESO.match(texto)
    if disyuncion:
        return LongitudOPeso(cm=_numero(disyuncion.group(1)), kg=_numero(disyuncion.group(2)))
    peso = _PESO.match(texto)
    if peso:
        return PesoKg(kg=_numero(peso.group(1)))
    longitud = _LONGITUD.match(texto)
    if longitud:
        return LongitudCm(cm=_numero(longitud.group(1)))
    if not texto:
        for marca in marcas:
            if _POR_DETERMINAR.match(notas.get(marca, "")):
                return PorDeterminar(segun_nota=marca)
        return SinDatoLegible(
            motivo=(
                "la celda no trae cifra y "
                + (
                    f"la nota {', '.join(marcas)} a la que remite no fija ninguna talla"
                    if marcas
                    else "tampoco remite a ninguna nota"
                )
            )
        )
    return SinDatoLegible(
        motivo=(
            f"la norma imprime «{texto}», que no se lee como una talla en cm ni como un peso; se "
            "publica el literal porque corregir por inferencia una cifra legal es inventarla"
        )
    )


def separar_nombre(celda: str) -> tuple[str, Nombre]:
    """``Nombre común (Genus species)`` → los dos nombres; si no casa, la ausencia dice por qué."""
    limpio = celda.rstrip(" .:")
    casa = _NOMBRE_CIENTIFICO.match(limpio)
    if casa:
        return casa.group("comun").strip(), NombreDeclarado(casa.group("cientifico").strip())
    return limpio, NombreAusente(
        motivo=(
            f"la norma escribe «{celda}» y ahí no hay ningún nombre latino entre paréntesis; no se "
            "infiere"
        )
    )


def _especie_de_fila(
    fila: list[str], *, con_nombre_local: bool, notas: dict[str, str], cabecera: str
) -> Especie:
    """Convierte una fila de datos en una especie publicable."""
    marcas_especie, especie_txt = _marcas(fila[0])
    talla_txt_bruto = fila[-1]
    marcas_talla, talla_txt = _marcas(talla_txt_bruto)
    marcas = tuple(dict.fromkeys(marcas_especie + marcas_talla))
    huerfanas = [marca for marca in marcas if marca not in notas]
    if huerfanas:
        raise ErrorBoe(
            f"«{especie_txt}» remite a la nota {', '.join(huerfanas)}, que la versión en vigor no "
            "declara: no se publica una cifra con una excepción que no sabemos leer"
        )
    # Fila hija de una especie multifila: no trae nombre latino y cuelga de la cabecera anterior
    # (`Cigala (entera) (Nephrops norvegicus):` → `Longitud cefalotórax` / `Longitud total`). La
    # cabecera no se publica como especie con talla ausente —no le falta la talla: la llevan sus
    # hijas—, así que cada hija se publica con el nombre de la cabecera y su propio rótulo.
    if "(" not in especie_txt:
        if not cabecera:
            raise ErrorBoe(
                f"fila «{especie_txt}»: no trae nombre científico y no cuelga de ninguna cabecera "
                "de especie multifila"
            )
        nombre_comun, cientifico = separar_nombre(cabecera)
        medida = especie_txt
    else:
        nombre_comun, cientifico = separar_nombre(especie_txt)
        medida = ""
    local, local_ausente = "", ""
    if con_nombre_local:
        local = fila[1].strip()
        if not local:
            local_ausente = "la norma deja vacía la celda de nombre local canario en esta fila"
    return Especie(
        nombre_comun=nombre_comun,
        nombre_cientifico=cientifico,
        talla=clasificar_talla(talla_txt, marcas=marcas, notas=notas),
        texto_original=talla_txt_bruto,
        notas=marcas,
        medida=medida,
        nombre_local=local,
        nombre_local_ausente=local_ausente,
    )


def parsear_anexo(xml: bytes, *, bloque: str, fecha_actualizacion: str, hoy: dt.date) -> Anexo:
    """Un bloque de anexo → su versión en vigor, con sus notas y sus especies."""
    raiz = ET.fromstring(xml)
    bloque_el = raiz.find("data/bloque")
    if bloque_el is None:
        raise ErrorBoe(f"bloque {bloque}: la respuesta no trae <data><bloque>")
    if bloque_el.get("id") != bloque:
        raise ErrorBoe(f"se pidió el bloque {bloque} y la API devolvió {bloque_el.get('id')!r}")
    version = _version_en_vigor(bloque_el, bloque=bloque, hoy=hoy)
    parrafos = [_texto(p) for p in version.findall("p")]
    if not parrafos or parrafos[0] != ANEXO_ESPERADO[bloque]:
        raise ErrorBoe(
            f"bloque {bloque}: la versión en vigor titula "
            f"{(parrafos[0] if parrafos else '')!r} y se esperaba {ANEXO_ESPERADO[bloque]!r}"
        )
    notas = _notas_de(version)
    por_marca = {nota.marca: nota.texto for nota in notas}
    filas = _filas_de(version, bloque=bloque)
    con_nombre_local = _cabecera(filas, bloque=bloque)
    columnas = 3 if con_nombre_local else 2
    especies: list[Especie] = []
    cabecera_multifila = ""
    for fila in filas[1:]:
        if len(fila) != columnas:
            raise ErrorBoe(
                f"bloque {bloque}: la fila {fila!r} trae {len(fila)} columnas y la cabecera declara "
                f"{columnas}"
            )
        if not fila[-1].strip():
            # Cabecera de especie multifila: la cifra la traen sus filas hijas. Sólo se acepta con
            # los dos puntos que el BOE le pone; una celda de talla vacía en cualquier otra fila es
            # un fallo de lectura y no un dato.
            if not fila[0].rstrip().endswith(":"):
                raise ErrorBoe(
                    f"bloque {bloque}: la fila «{fila[0]}» no trae talla y tampoco es cabecera de "
                    "una especie multifila"
                )
            cabecera_multifila = fila[0]
            continue
        especie = _especie_de_fila(
            fila, con_nombre_local=con_nombre_local, notas=por_marca, cabecera=cabecera_multifila
        )
        if not especie.medida:
            cabecera_multifila = ""
        especies.append(especie)
    usadas = {marca for especie in especies for marca in especie.notas}
    sobran = [nota.marca for nota in notas if nota.marca not in usadas]
    if sobran:
        raise ErrorBoe(
            f"bloque {bloque}: la versión en vigor declara las notas {', '.join(sobran)} y ninguna "
            "especie las referencia; es señal de que la tabla no se ha leído entera"
        )
    if not especies:
        raise ErrorBoe(f"bloque {bloque}: la versión en vigor no trae ninguna especie")
    return Anexo(
        bloque=bloque,
        anexo=parrafos[0],
        titulo=parrafos[1] if len(parrafos) > 1 else "",
        fecha_vigencia=_fecha(version.get("fecha_vigencia", ""), que=f"bloque {bloque}"),
        fecha_publicacion=_fecha(version.get("fecha_publicacion", ""), que=f"bloque {bloque}"),
        norma_modificadora=version.get("id_norma", ""),
        fecha_actualizacion=fecha_actualizacion,
        notas=notas,
        especies=tuple(especies),
    )


def descargar_anexos(
    *, hoy: dt.date, refresh: bool = False
) -> tuple[Metadatos, tuple[Anexo, ...]]:
    """Camino completo con red: metadatos → comprobación de vigencia → los tres anexos."""
    metadatos = descargar_metadatos(refresh=refresh)
    comprobar_vigente(metadatos)
    indice = descargar_indice(refresh=refresh)
    anexos = tuple(
        parsear_anexo(
            descargar_bloque(bloque, refresh=refresh),
            bloque=bloque,
            fecha_actualizacion=indice[bloque],
            hoy=hoy,
        )
        for bloque in BLOQUES_DE_ANEXO
    )
    return metadatos, anexos
