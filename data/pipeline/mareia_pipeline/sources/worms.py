"""Nombres científicos aceptados hoy, desde el World Register of Marine Species (WoRMS).

El RD 560/1995 nombra las especies en la nomenclatura de 1995 y la taxonomía se ha movido desde
entonces. Este módulo resuelve **el nombre que escribe la norma** contra WoRMS para poder publicar,
al lado del legal, el que sirve hoy para buscar la especie en cualquier otra base. **El nombre del
BOE no se sustituye nunca**: eso lo garantiza ``especies.py``, aquí sólo se pregunta.

Tres cosas medidas contra la fuente el 2026-08-30 dan forma al módulo, y las tres son modos de fallo
que **no dan error**:

**1 · Cuando no encuentra nada responde HTTP 204 SIN CUERPO, no 404.** Un cliente que mire 200/404 y
haga ``json.loads`` del cuerpo vacío revienta con un ``JSONDecodeError`` que no se parece en nada a
«esa especie no está». No encontrar es un desenlace legítimo —22 de los 86 nombres del BOE caen
ahí— y aquí se trata como tal.

**2 · La consulta se normaliza aquí y no se confía en el tercero.** WoRMS es insensible a mayúsculas
(medido: ``Thunnus Thynnus``, ``thunnus thynnus`` y ``THUNNUS THYNNUS`` devuelven los tres el
AphiaID 127029), y hace falta porque el catálogo del BOE trae ``Thunnus Thynnus`` **y**
``Thunnus thynnus``, que son la misma especie escrita de dos formas. Pero un espacio doble
—``thunnus  thynnus``— sí responde **204**, así que la normalización colapsa los blancos además de
bajar a minúsculas: no es cosmética, es lo único que separa «no está» de «lo has escrito con dos
espacios».

**3 · Más de un registro no se resuelve eligiendo el primero.** Medido sobre los 86 nombres: los 64
que resuelven devuelven **exactamente un** registro, así que hoy no hay ninguna elección que hacer.
Precisamente por eso, el día que WoRMS devuelva dos —un homónimo, una revisión a medias— la
respuesta correcta no es quedarse con el de arriba, sino decir que hay ambigüedad y no publicar
taxón: elegir por posición es inventarse una decisión taxonómica y presentarla como de la fuente.

Los tres desenlaces que el consumidor tiene que poder distinguir están en ``Resolucion.desenlace``:
``aceptado``, ``sinonimo`` (la norma nombra un sinónimo o una errata que WoRMS conoce, y hay nombre
válido al que apunta) y ``no_encontrado`` — más ``ambiguo``, que es el punto 3.

**Caché**: obligatoria, y por el mismo motivo que en ``sources.rampe``: es la API de un tercero y no
se le machaca en cada ejecución. Las consultas van **en serie**, nunca en paralelo.

**Licencia**: el texto de las páginas de WoRMS es **CC-BY** y *«Re-distribution of the entire
database is not permitted, unless by prior written agreement»* (verificado el 2026-08-30 en
``https://www.marinespecies.org/about.php?p=terms``). O sea: extracción curada de los 86 nombres que
la norma española regula, con la cita que la propia fuente devuelve por registro, y **jamás un
mirror**. La cita viaja en ``Registro.cita`` y se publica especie a especie.

Todo es público y anónimo: no se usa ninguna credencial.
"""

from __future__ import annotations

import json
import urllib.parse
from dataclasses import dataclass
from typing import Any

from mareia_pipeline.sources import cache

#: Búsqueda por nombre exacto y sólo marinos. ``like=false`` es deliberado: con ``like=true`` la API
#: hace coincidencia parcial y ``Venus`` traería medio catálogo, que es lo contrario de resolver.
URL_BASE = "https://www.marinespecies.org/rest/AphiaRecordsByName"

FUENTE = "World Register of Marine Species (WoRMS)"
FUENTE_URL = "https://www.marinespecies.org"
LICENCIA = "CC-BY 4.0 (texto de las páginas de WoRMS)"
LICENCIA_URL = "https://www.marinespecies.org/about.php?p=terms"
AVISO = (
    "WoRMS no permite redistribuir la base entera: esto es una extracción curada de los nombres "
    "que regula el RD 560/1995, con la cita que la propia fuente devuelve para cada registro."
)

#: Valor de ``status`` que significa que el nombre consultado es el vigente.
ACEPTADO = "accepted"

#: Los rangos taxonómicos que este pipeline sabe **nombrar en castellano**, y ninguno más. Es un
#: mapa cerrado por la misma razón que ``utm.PROYECCIONES``: publicar un rango con una etiqueta
#: inventada no falla, sale bien y dice algo que no es verdad. Medido sobre los 64 nombres que
#: resuelven: 62 ``Species``, 1 ``Family`` (``Palinuridae``) y 1 ``Subspecies``
#: (``Trisopterus minutus capelanus``); ``Genus`` aparece al resolver las filas ``spp``.
RANGOS: dict[str, str] = {
    "Species": "especie",
    "Subspecies": "subespecie",
    "Genus": "genero",
    "Family": "familia",
}


class ErrorWorms(RuntimeError):
    """La respuesta no dice lo que este módulo sabe leer, así que no se publica ningún taxón.

    Misma política que ``sources.boe`` y ``sources.rampe``: se prefiere no publicar a publicar un
    dato del que no podemos responder. Aquí el dato del que no podríamos responder es *qué animal*
    es el que la norma regula.
    """


@dataclass(frozen=True)
class Registro:
    """Un registro de WoRMS, con lo que hace falta para publicarlo y para poder auditarlo."""

    aphia_id: int
    nombre_cientifico: str
    autoridad: str | None
    #: ``status`` literal de la fuente. No se traduce ni se reduce a un booleano: hay al menos
    #: ``accepted``, ``unaccepted``, ``misspelling - incorrect subsequent spelling`` y
    #: ``superseded combination``, y la diferencia entre ellos es información.
    estado: str
    #: ``unacceptreason``: «misspelling», «synonym»… Puede ser ``None`` aun sin estar aceptado.
    motivo_no_aceptado: str | None
    #: El rango tal y como lo escribe WoRMS.
    rango_worms: str
    #: El rango ya en castellano, del mapa cerrado ``RANGOS``.
    rango: str
    aphia_id_aceptado: int | None
    nombre_aceptado: str | None
    autoridad_aceptada: str | None
    url: str
    #: La cita que la propia fuente pide para ese registro. Es la atribución, no un adorno.
    cita: str

    @property
    def aceptado(self) -> bool:
        return self.estado == ACEPTADO


@dataclass(frozen=True)
class Resolucion:
    """Qué contestó WoRMS a un nombre, incluidas las formas de no contestar."""

    #: Lo que se envió de verdad a la API, ya normalizado. Se guarda porque es la mitad de la
    #: procedencia: sin esto no se puede saber si el taxón salió del nombre del BOE o de otro.
    consultado: str
    registro: Registro | None = None
    #: Por qué no hay registro, cuando no lo hay. Nunca un hueco mudo.
    motivo: str | None = None
    #: Los candidatos, cuando hay más de uno y por eso no se elige ninguno.
    candidatos: tuple[Registro, ...] = ()

    @property
    def desenlace(self) -> str:
        """``aceptado`` · ``sinonimo`` · ``no_encontrado`` · ``ambiguo``."""
        if self.candidatos:
            return "ambiguo"
        if self.registro is None:
            return "no_encontrado"
        return "aceptado" if self.registro.aceptado else "sinonimo"


def normalizar(nombre: str) -> str:
    """La forma canónica en la que se consulta un nombre: blancos colapsados y en minúsculas.

    Las dos mitades están medidas y ninguna sobra (ver el punto 2 de la cabecera del módulo): las
    mayúsculas le dan igual a WoRMS pero el catálogo del BOE trae el mismo atún escrito de dos
    formas, y un espacio de más sí devuelve 204.
    """
    return " ".join(nombre.split()).lower()


def url_de(nombre: str) -> str:
    """La URL de consulta de un nombre ya normalizado."""
    ruta = urllib.parse.quote(normalizar(nombre))
    return f"{URL_BASE}/{ruta}?like=false&marine_only=true"


def _texto(valor: Any) -> str | None:
    if valor is None:
        return None
    texto = str(valor).strip()
    return texto or None


def _registro(crudo: dict[str, Any], *, consultado: str) -> Registro:
    """Un registro de la respuesta → ``Registro``, abortando si no trae lo imprescindible."""
    for campo in ("AphiaID", "scientificname", "status", "rank"):
        if crudo.get(campo) in (None, ""):
            raise ErrorWorms(
                f"el registro que WoRMS devuelve para «{consultado}» no trae {campo}. Sin ese "
                "campo no se puede decir ni qué taxón es ni si está aceptado, y publicar la mitad "
                "de un taxón es peor que no publicarlo."
            )
    rango_worms = str(crudo["rank"]).strip()
    if rango_worms not in RANGOS:
        raise ErrorWorms(
            f"«{consultado}» resuelve a un rango taxonómico «{rango_worms}» que este pipeline no "
            f"sabe nombrar en castellano (conoce {', '.join(sorted(RANGOS))}). No se le pone una "
            "etiqueta aproximada: un rango mal rotulado se lee igual de bien que uno correcto."
        )
    return Registro(
        aphia_id=int(crudo["AphiaID"]),
        nombre_cientifico=str(crudo["scientificname"]).strip(),
        autoridad=_texto(crudo.get("authority")),
        estado=str(crudo["status"]).strip(),
        motivo_no_aceptado=_texto(crudo.get("unacceptreason")),
        rango_worms=rango_worms,
        rango=RANGOS[rango_worms],
        aphia_id_aceptado=int(crudo["valid_AphiaID"]) if crudo.get("valid_AphiaID") else None,
        nombre_aceptado=_texto(crudo.get("valid_name")),
        autoridad_aceptada=_texto(crudo.get("valid_authority")),
        url=_texto(crudo.get("url")) or f"{FUENTE_URL}/aphia.php?p=taxdetails&id={crudo['AphiaID']}",
        cita=_texto(crudo.get("citation")) or "",
    )


def leer_respuesta(cuerpo: bytes, *, consultado: str) -> Resolucion:
    """El cuerpo de la respuesta → ``Resolucion``. Parte pura: no toca la red.

    El cuerpo **vacío** es el 204 del punto 1 de la cabecera, y es un desenlace, no una avería.
    """
    if not cuerpo.strip():
        return Resolucion(
            consultado=consultado,
            motivo=(
                "WoRMS responde 204 sin cuerpo: no tiene ningún registro con ese nombre exacto. "
                "En el catálogo del BOE esto pasa con las filas de género («spp») y con las "
                "erratas de la propia norma."
            ),
        )
    try:
        crudos = json.loads(cuerpo)
    except json.JSONDecodeError as error:
        raise ErrorWorms(f"la respuesta de WoRMS para «{consultado}» no es JSON: {error}") from error
    if not isinstance(crudos, list) or not crudos:
        raise ErrorWorms(
            f"la respuesta de WoRMS para «{consultado}» no es una lista de registros con algo "
            f"dentro ({crudos!r}). Cuando no hay nada, esta API contesta 204 sin cuerpo; una lista "
            "vacía con 200 es una tercera cosa que no sabemos interpretar."
        )
    registros = tuple(_registro(crudo, consultado=consultado) for crudo in crudos)
    if len(registros) > 1:
        return Resolucion(
            consultado=consultado,
            candidatos=registros,
            motivo=(
                f"WoRMS devuelve {len(registros)} registros para «{consultado}» "
                f"({', '.join(f'{r.nombre_cientifico} ({r.aphia_id}, {r.estado})' for r in registros)}"
                "). No se elige ninguno: quedarse con el primero es tomar una decisión taxonómica "
                "por orden de lista y publicarla como si fuera de la fuente."
            ),
        )
    return Resolucion(consultado=consultado, registro=registros[0])


def resolver(nombre: str, *, refresh: bool = False) -> Resolucion:
    """Camino completo con red: normaliza → consulta (o sirve de caché) → lee la respuesta."""
    consultado = normalizar(nombre)
    cuerpo = cache.fetch(url_de(consultado), suffix=".json", refresh=refresh)
    return leer_respuesta(cuerpo, consultado=consultado)
