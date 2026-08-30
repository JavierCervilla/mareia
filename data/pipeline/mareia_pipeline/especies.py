"""Catálogo publicable de especies: del nombre que dice la ley al taxón que dice la ciencia.

Aquí vive lo que es **de Mareia** y no de ninguna de las tres fuentes: qué se pregunta a WoRMS por
cada nombre del BOE, qué forma tiene el JSON ``especies/v1`` y qué tiene que declarar una fila para
poder publicarse (los gates E2 y E3). El parseo de cada fuente está en ``sources/worms.py``,
``sources/obis.py`` y ``sources/boe.py``.

**Tres reglas gobiernan el dataset entero**, y las tres están escritas como código y no como buena
intención:

1. **Nunca se sustituye el nombre del BOE.** Es el que tiene consecuencia legal, así que va literal
   en ``nombreBoe`` y el aceptado va aparte, con su estado. Los dos, cada uno con su fuente.
2. **El género no se convierte en especie.** Las 15 filas ``spp`` del catálogo (14 géneros: el
   Anexo II escribe además ``Mugil spps``) se resuelven **al género** y se rotulan como género.
   Elegirles una especie concreta inventaría un alcance que la norma no tiene, y una talla mínima
   que aplica a todo un género es un hecho jurídico, no una imprecisión que haya que arreglar.
   Lo comprueba ``errores_de_genero`` (gate E3) sobre el artefacto, no sobre esta promesa.
3. **Todo mapeo que no venga de WoRMS es nuestro y va firmado.** Si preguntamos a WoRMS por
   ``Thunnus albacares`` cuando la norma escribe ``Thunnus aibacares``, esa correspondencia la
   decidimos nosotros: va con su ``AphiaID``, su motivo y la marca ``laNormaNoDiceEso``. Un mapeo
   sin dueño es una cifra inventada con otro traje. Lo comprueba ``errores_de_mapeo`` (gate E2), y
   **recomputando**: compara con qué nombre se preguntó contra el nombre del BOE normalizado, así
   que no se puede satisfacer declarando.

**Dónde se paró el mapeo de erratas, y por qué justo ahí.** Se mapean las seis erratas que son una
correspondencia **uno a uno** y comprobable (una tilde que el latín no lleva, una ``i`` por una
``l``). **No** se mapea ``Lophius piscatorius, L. Budegassa``, que es una celda con **dos** especies
dentro: corregir una grafía no cambia ninguna consecuencia, pero repartir una fila legal en dos sí
—decide a qué alcance se aplica una talla mínima— y eso no lo hacemos nosotros. Esa fila se publica
sin taxón y con su motivo, que es lo mismo que T-19 hizo con el ``1 1`` ilegible de la boga.

La presencia de OBIS se publica **con su frase de sesgo dentro del mismo objeto** (ver
``sources.obis``): así la interfaz no puede pintar el número sin la advertencia sin borrarla antes
a mano.
"""

from __future__ import annotations

import datetime as dt
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from mareia_pipeline.sources import obis, worms

REPO_ROOT = Path(__file__).resolve().parents[3]
DATASET = REPO_ROOT / "data" / "especies" / "catalogo.json"

SCHEMA = "especies/v1"

#: Las cuatro clases de correspondencia entre el nombre del BOE y lo que se le pregunta a WoRMS.
#: ``literal`` es la única cuyo dueño es la fuente; las otras tres son decisiones de Mareia.
LITERAL = "literal"
GENERO_DE_SPP = "genero_de_spp"
ERRATA_DE_LA_NORMA = "errata_de_la_norma"
SIN_CORRESPONDENCIA = "sin_correspondencia"

#: Quién decide la correspondencia de cada clase. El gate E2 lo recomputa, no lo lee.
ORIGEN_DE: dict[str, str] = {
    LITERAL: "worms",
    GENERO_DE_SPP: "mareia",
    ERRATA_DE_LA_NORMA: "mareia",
    SIN_CORRESPONDENCIA: "mareia",
}

#: ``Alosa spp``, ``Mugil spps``. El grupo es el género que se consulta.
_SPP = re.compile(r"^(?P<genero>[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\s+spps?\.?$")

MOTIVO_SPP = (
    "«spp» —y «spps», que es como lo escribe el Anexo II— abrevia «species pluralis»: la norma "
    "regula el género entero, no una especie. Se consulta el género y se publica con rango género. "
    "Elegirle una especie sería inventar un alcance que la norma no tiene."
)


@dataclass(frozen=True)
class Errata:
    """Una grafía del BOE que no existe en ninguna nomenclatura, y a qué la hacemos corresponder.

    Es **nuestra**: la norma no dice esto. Por eso lleva motivo y por eso el gate E2 exige que
    viaje marcada en el artefacto.
    """

    consulta: str
    motivo: str


#: Las seis erratas del BOE que se mapean, cada una con su motivo. Son correspondencias uno a uno:
#: el nombre resultante existe en WoRMS (comprobado el 2026-08-30) y no cambia a qué animal se
#: refiere la fila, sólo cómo se escribe.
ERRATAS: dict[str, Errata] = {
    "Cáncer pagurus": Errata(
        "Cancer pagurus", "el género es «Cancer»: el latín no lleva la tilde que imprime la norma"
    ),
    "Melanogrammús aeglefinus": Errata(
        "Melanogrammus aeglefinus", "el género es «Melanogrammus»: el latín no lleva esa tilde"
    ),
    "Gliptocephalus cynoglossus": Errata(
        "Glyptocephalus cynoglossus", "el género se escribe con «y», «Glyptocephalus»"
    ),
    "Microstommus kitt": Errata(
        "Microstomus kitt", "el género es «Microstomus», con una sola «m»"
    ),
    "Panaeux kerathurus": Errata(
        "Penaeus kerathurus", "el género es «Penaeus»: «Panaeux» no existe en ninguna nomenclatura"
    ),
    "Thunnus aibacares": Errata(
        "Thunnus albacares", "el epíteto es «albacares»: la «l» aparece impresa como «i»"
    ),
}

#: Las erratas que **no** se mapean, con el motivo de parar ahí. Ver la cabecera del módulo.
ERRATAS_NO_MAPEADAS: dict[str, str] = {
    "Lophius piscatorius, L. Budegassa": (
        "la celda nombra dos especies dentro de una sola fila. Corregir una grafía no cambia "
        "ninguna consecuencia, pero repartir una fila legal en dos decide a qué alcance se aplica "
        "una talla mínima, y esa decisión no es nuestra. Se publica sin taxón, como el «1 1» "
        "ilegible de la boga."
    ),
}

#: De dónde sale cada campo del dataset. Se publica dentro del propio fichero: un dato cuya
#: procedencia hay que ir a buscar al repositorio no la tiene declarada.
ORIGENES: dict[str, str] = {
    "nombreBoe": "BOE · RD 560/1995, texto consolidado. Literal, sin corregir.",
    "nombreComun / nombresComunes": "BOE · el nombre común que escribe cada anexo.",
    "correspondencia": (
        "Mareia, salvo cuando «tipo» es «literal»: entonces se preguntó a WoRMS exactamente el "
        "nombre del BOE y la correspondencia es de la fuente."
    ),
    "taxon": "WoRMS · AphiaID, nombre aceptado, estado y rango, con la cita que pide la fuente.",
    "caladeros[].tallas": "BOE · la talla y su literal, con la procedencia por cifra que fija T-19.",
    "caladeros[].presencia": "OBIS · recuentos dentro del recorte declarado, con su frase de sesgo.",
    "recortes": "Mareia · rectángulos en grados, ajustados a los puertos de cada caladero.",
}


def es_genero(nombre: str) -> str | None:
    """El género que una fila ``spp`` regula, o ``None`` si la fila no es de género."""
    coincidencia = _SPP.match(nombre.strip())
    return coincidencia.group("genero") if coincidencia else None


@dataclass(frozen=True)
class Correspondencia:
    """Qué se le pregunta a WoRMS por un nombre del BOE, y de quién es esa decisión."""

    tipo: str
    #: El nombre que se consulta, ya normalizado. ``None`` cuando se decide no consultar.
    consulta: str | None
    motivo: str | None

    @property
    def origen(self) -> str:
        return ORIGEN_DE[self.tipo]

    @property
    def la_norma_no_dice_eso(self) -> bool:
        """Sólo las erratas: en las filas ``spp`` la norma **sí** regula el género."""
        return self.tipo == ERRATA_DE_LA_NORMA


def correspondencia_de(nombre_boe: str) -> Correspondencia:
    """Qué se consulta por un nombre del BOE. Es el único sitio donde se decide, y es puro."""
    if nombre_boe in ERRATAS_NO_MAPEADAS:
        return Correspondencia(SIN_CORRESPONDENCIA, None, ERRATAS_NO_MAPEADAS[nombre_boe])
    if nombre_boe in ERRATAS:
        errata = ERRATAS[nombre_boe]
        return Correspondencia(
            ERRATA_DE_LA_NORMA, worms.normalizar(errata.consulta), errata.motivo
        )
    genero = es_genero(nombre_boe)
    if genero:
        return Correspondencia(GENERO_DE_SPP, worms.normalizar(genero), MOTIVO_SPP)
    return Correspondencia(LITERAL, worms.normalizar(nombre_boe), None)


def filas_del_boe(tallas: dict[str, Any]) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    """Las filas de ``normativa/v1`` con el caladero al que pertenece cada una."""
    return [(caladero, especie) for caladero in tallas["caladeros"] for especie in caladero["especies"]]


def nombres_del_boe(tallas: dict[str, Any]) -> list[str]:
    """Los nombres científicos que regula la norma, sin repetir y en orden alfabético.

    Los que la norma no da —``Cigalas (colas)``, que no trae ningún latín entre paréntesis— no
    están aquí: no se les inventa uno. Se publican aparte, en ``sinNombreCientifico``.
    """
    return sorted({
        especie["nombreCientifico"]
        for _, especie in filas_del_boe(tallas)
        if "nombreCientifico" in especie
    })


def nombre_para_obis(registro: worms.Registro) -> str:
    """Con qué nombre se le pregunta a OBIS por un taxón: el aceptado si lo hay.

    OBIS documenta que su ``scientificName`` se resuelve contra WoRMS, así que preguntar por el
    nombre que WoRMS da por superado es preguntar por una etiqueta que ese índice ya no usa.
    """
    return registro.nombre_aceptado or registro.nombre_cientifico


# --------------------------------------------------------------------------------------------
# Construcción del dataset
# --------------------------------------------------------------------------------------------


def _talla_a_json(especie: dict[str, Any]) -> dict[str, Any]:
    """Una fila del BOE → su talla, tal cual la publicó T-19. No se reinterpreta ninguna cifra."""
    fila = {
        "talla": especie["talla"],
        "textoOriginal": especie["textoOriginal"],
        "notas": especie["notas"],
        "procedencia": especie["procedencia"],
    }
    if "medida" in especie:
        fila["medida"] = especie["medida"]
    return fila


def _taxon_a_json(
    resolucion: worms.Resolucion, *, consultado_en: dt.date
) -> dict[str, Any]:
    registro = resolucion.registro
    if registro is None:
        return {
            "resuelto": False,
            "motivo": resolucion.motivo,
            "fuente": worms.FUENTE,
            "consultadoEn": consultado_en.isoformat(),
        }
    aceptado: dict[str, Any] | None = None
    if registro.aphia_id_aceptado and registro.nombre_aceptado:
        aceptado = {
            "aphiaId": registro.aphia_id_aceptado,
            "nombre": registro.nombre_aceptado,
            "autoridad": registro.autoridad_aceptada,
        }
    return {
        "resuelto": True,
        "aphiaId": registro.aphia_id,
        "nombreCientifico": registro.nombre_cientifico,
        "autoridad": registro.autoridad,
        "estado": registro.estado,
        "motivoNoAceptado": registro.motivo_no_aceptado,
        "rango": registro.rango,
        "rangoWorms": registro.rango_worms,
        "aceptado": aceptado,
        "motivoSinAceptado": (
            None
            if aceptado or registro.aceptado
            else "WoRMS no da nombre válido al que remitir este registro"
        ),
        "url": registro.url,
        "cita": registro.cita,
        "fuente": worms.FUENTE,
        "consultadoEn": consultado_en.isoformat(),
    }


def _presencia_a_json(presencia: obis.Presencia, *, consultado_en: dt.date) -> dict[str, Any]:
    """La presencia, con el sesgo y el recorte **dentro del mismo objeto** que el número."""
    return {
        "fuente": obis.FUENTE,
        "consultadoComo": presencia.consultado,
        "recorte": presencia.caladero,
        "registros": presencia.registros,
        "especiesDistintas": presencia.especies,
        "datasets": presencia.datasets,
        "desdeAnio": presencia.desde_anio,
        "hastaAnio": presencia.hasta_anio,
        "sesgo": obis.SESGO,
        "consultadoEn": consultado_en.isoformat(),
    }


def _recortes_a_json() -> dict[str, Any]:
    return {
        caladero: {
            "advertencia": recorte.advertencia,
            "wkt": recorte.wkt,
            "cajas": [
                {
                    "nombre": caja.nombre,
                    "latMin": caja.lat_min,
                    "latMax": caja.lat_max,
                    "lonMin": caja.lon_min,
                    "lonMax": caja.lon_max,
                }
                for caja in recorte.cajas
            ],
        }
        for caladero, recorte in obis.RECORTES.items()
    }


def _fuentes_a_json(tallas: dict[str, Any], *, consultado_en: dt.date) -> dict[str, Any]:
    return {
        "boe": tallas["fuente"],
        "worms": {
            "nombre": worms.FUENTE,
            "url": worms.FUENTE_URL,
            "licencia": worms.LICENCIA,
            "licenciaUrl": worms.LICENCIA_URL,
            "aviso": worms.AVISO,
            "consultadoEn": consultado_en.isoformat(),
        },
        "obis": {
            "nombre": obis.FUENTE,
            "url": obis.FUENTE_URL,
            "licencia": obis.LICENCIA,
            "licenciaUrl": obis.LICENCIA_URL,
            "atribucion": obis.ATRIBUCION,
            "aviso": obis.AVISO,
            "sesgo": obis.SESGO,
            "consultadoEn": consultado_en.isoformat(),
        },
    }


def _caladeros_de(
    nombre_boe: str,
    tallas: dict[str, Any],
    resolucion: worms.Resolucion,
    presencias: dict[tuple[str, str], obis.Presencia],
    *,
    consultado_en: dt.date,
) -> list[dict[str, Any]]:
    """Los caladeros que regulan una especie, con sus tallas y su presencia."""
    publicados: list[dict[str, Any]] = []
    for caladero in tallas["caladeros"]:
        filas = [e for e in caladero["especies"] if e.get("nombreCientifico") == nombre_boe]
        if not filas:
            continue
        entrada: dict[str, Any] = {
            "id": caladero["id"],
            "nombre": caladero["nombre"],
            "anexo": caladero["anexo"],
            "nombreComun": filas[0]["nombreComun"],
            "tallas": [_talla_a_json(fila) for fila in filas],
        }
        local = next((f["nombreLocalCanario"] for f in filas if "nombreLocalCanario" in f), None)
        if local:
            entrada["nombreLocalCanario"] = local
        if resolucion.registro is None:
            entrada["presencia"] = None
            entrada["presenciaAusente"] = (
                "sin taxón resuelto no se pregunta a OBIS: un cero de una búsqueda que no puede "
                "acertar se lee como ausencia de la especie, y eso sería mentir sobre el mar."
            )
        else:
            clave = (nombre_para_obis(resolucion.registro), caladero["id"])
            if clave not in presencias:
                raise ValueError(
                    f"falta la presencia de «{clave[0]}» en el caladero {clave[1]}: el dataset no "
                    "se construye a medias, porque una presencia ausente se lee como un cero"
                )
            entrada["presencia"] = _presencia_a_json(presencias[clave], consultado_en=consultado_en)
        publicados.append(entrada)
    return publicados


def _sin_nombre_cientifico(tallas: dict[str, Any]) -> list[dict[str, Any]]:
    """Las filas del BOE que no se pueden llevar a un taxón porque la norma no da el latín.

    Se publican **contadas y con su motivo** en vez de desaparecer: 117 filas menos las 116 que
    tienen nombre científico es una, y quien sume tiene que poder encontrarla.
    """
    return [
        {
            "caladero": caladero["id"],
            "nombreComun": especie["nombreComun"],
            "motivo": especie["nombreCientificoAusente"],
            **_talla_a_json(especie),
        }
        for caladero, especie in filas_del_boe(tallas)
        if "nombreCientifico" not in especie
    ]


def construir_dataset(
    tallas: dict[str, Any],
    resoluciones: dict[str, worms.Resolucion],
    presencias: dict[tuple[str, str], obis.Presencia],
    *,
    consultado_en: dt.date,
) -> dict[str, Any]:
    """``normativa/v1`` + WoRMS + OBIS → el documento ``especies/v1``.

    Parte pura: no toca la red, así que la suite puede construir el dataset entero con fixtures.
    """
    especies: list[dict[str, Any]] = []
    for nombre in nombres_del_boe(tallas):
        resolucion = resoluciones[nombre]
        correspondencia = correspondencia_de(nombre)
        comunes = [
            especie["nombreComun"]
            for caladero, especie in filas_del_boe(tallas)
            if especie.get("nombreCientifico") == nombre
        ]
        distintos = list(dict.fromkeys(comunes))
        especies.append(
            {
                "nombreBoe": nombre,
                "nombreComun": distintos[0],
                "nombresComunes": distintos,
                "correspondencia": {
                    "tipo": correspondencia.tipo,
                    "origen": correspondencia.origen,
                    "consultadoComo": correspondencia.consulta,
                    "motivo": correspondencia.motivo,
                    "laNormaNoDiceEso": correspondencia.la_norma_no_dice_eso,
                },
                "taxon": _taxon_a_json(resolucion, consultado_en=consultado_en),
                "caladeros": _caladeros_de(
                    nombre, tallas, resolucion, presencias, consultado_en=consultado_en
                ),
            }
        )
    sin_latin = _sin_nombre_cientifico(tallas)
    return {
        "schema": SCHEMA,
        "fuentes": _fuentes_a_json(tallas, consultado_en=consultado_en),
        "origenes": ORIGENES,
        "recortes": _recortes_a_json(),
        "resumen": resumen_de(especies, sin_latin, tallas),
        "especies": especies,
        "sinNombreCientifico": sin_latin,
    }


def resumen_de(
    especies: list[dict[str, Any]], sin_latin: list[dict[str, Any]], tallas: dict[str, Any]
) -> dict[str, Any]:
    """El censo del dataset, recontado sobre lo que se publica y no sobre lo que se esperaba."""
    resueltas = [e for e in especies if e["taxon"]["resuelto"]]
    rangos: dict[str, int] = {}
    for especie in resueltas:
        rango = especie["taxon"]["rango"]
        rangos[rango] = rangos.get(rango, 0) + 1
    return {
        "especies": len(especies),
        "resueltas": len(resueltas),
        "aceptadas": sum(1 for e in resueltas if e["taxon"]["estado"] == worms.ACEPTADO),
        "conNombreAceptadoDistinto": sum(
            1 for e in resueltas if e["taxon"]["estado"] != worms.ACEPTADO
        ),
        "sinResolver": len(especies) - len(resueltas),
        "porRango": dict(sorted(rangos.items())),
        "correspondenciasDeMareia": sum(
            1 for e in especies if e["correspondencia"]["origen"] == "mareia"
        ),
        "filasDelBoe": len(filas_del_boe(tallas)),
        "filasSinNombreCientifico": len(sin_latin),
    }


def volcar(dataset: dict[str, Any], destino: Path = DATASET) -> None:
    """Escribe el dataset con el mismo formato que el resto de datos del repositorio."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(dataset, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def cargar(origen: Path = DATASET) -> dict[str, Any]:
    """Lee el dataset publicado."""
    return json.loads(origen.read_text(encoding="utf-8"))


# --------------------------------------------------------------------------------------------
# E2 · el mapeo tiene dueño
# --------------------------------------------------------------------------------------------


def _errores_de_mapeo_de(especie: dict[str, Any]) -> list[str]:
    """Los fallos de firma de una fila. Ver ``errores_de_mapeo``."""
    nombre = especie["nombreBoe"]
    correspondencia = especie.get("correspondencia") or {}
    tipo = correspondencia.get("tipo")
    consulta = correspondencia.get("consultadoComo")
    motivo = (correspondencia.get("motivo") or "").strip()
    origen = correspondencia.get("origen")
    taxon = especie.get("taxon") or {}
    fallos: list[str] = []
    if tipo not in ORIGEN_DE:
        return [f"«{nombre}» declara un tipo de correspondencia {tipo!r} que no existe"]
    if origen != ORIGEN_DE[tipo]:
        fallos.append(
            f"«{nombre}» es una correspondencia de clase «{tipo}» y declara origen {origen!r}: "
            f"tenía que ser «{ORIGEN_DE[tipo]}»"
        )
    if consulta is None:
        if tipo != SIN_CORRESPONDENCIA:
            fallos.append(f"«{nombre}» no dice con qué nombre se consultó a WoRMS")
        if taxon.get("resuelto"):
            fallos.append(
                f"«{nombre}» dice no tener correspondencia y aun así publica taxón resuelto"
            )
    elif consulta == worms.normalizar(nombre):
        if tipo != LITERAL:
            fallos.append(
                f"«{nombre}» se consultó con su propio nombre y se rotula como «{tipo}»: una "
                "correspondencia que es la de la norma no puede marcarse como decisión nuestra"
            )
    elif tipo == LITERAL:
        fallos.append(
            f"«{nombre}» se consultó como «{consulta}», que no es lo que dice la norma, y se "
            "publica como correspondencia «literal» de WoRMS. Ese mapeo es nuestro y no tiene dueño"
        )
    if tipo != LITERAL and not motivo:
        fallos.append(
            f"«{nombre}» lleva una correspondencia nuestra («{tipo}») sin motivo: un mapeo sin "
            "motivo es una decisión sin dueño"
        )
    if tipo == ERRATA_DE_LA_NORMA:
        if correspondencia.get("laNormaNoDiceEso") is not True:
            fallos.append(
                f"«{nombre}» corrige una errata del BOE y no marca «laNormaNoDiceEso»: quien lea "
                "el dataset creería que el nombre corregido lo dice la norma"
            )
        if not taxon.get("aphiaId"):
            fallos.append(
                f"«{nombre}» declara una correspondencia nuestra que no apunta a ningún AphiaID: "
                "un mapeo firmado que no lleva a ninguna parte no es un mapeo"
            )
    return fallos


def errores_de_mapeo(dataset: dict[str, Any]) -> list[str]:
    """**Gate E2**: toda correspondencia que no venga de WoRMS va marcada como nuestra, con motivo.

    Se mide sobre el artefacto y **recomputando**: la comprobación que manda es comparar
    ``consultadoComo`` con el nombre del BOE normalizado (``worms.normalizar``). Si difieren, a
    WoRMS se le preguntó por algo que la norma no dice y esa decisión es de Mareia; si coinciden, la
    fila no puede apuntarse el mérito de una decisión que no ha tomado. Un gate que se limitara a
    exigir que el campo ``origen`` exista se satisfaría escribiendo ``"worms"`` en todas partes.
    """
    return [fallo for especie in dataset["especies"] for fallo in _errores_de_mapeo_de(especie)]


# --------------------------------------------------------------------------------------------
# E3 · el género no se convierte en especie
# --------------------------------------------------------------------------------------------


def _binomio_de(genero: str) -> re.Pattern[str]:
    """Un binomio de ese género: ``Alosa alosa`` sí, ``Alosa spp`` no (``spp`` no es un epíteto).

    Distingue mayúsculas a propósito: el epíteto de una especie se escribe en minúscula, y la cita
    que devuelve WoRMS para un género trae detrás su autoridad —``Alosa Linck, 1790``—, que no es
    una especie. Ignorar la caja habría puesto el gate en rojo por la atribución de la fuente.
    """
    return re.compile(rf"\b{re.escape(genero)}\s+(?!spps?\b)[a-zñáéíóú]{{2,}}\b")


def _textos(nodo: Any) -> list[str]:
    if isinstance(nodo, str):
        return [nodo]
    if isinstance(nodo, dict):
        return [texto for valor in nodo.values() for texto in _textos(valor)]
    if isinstance(nodo, list):
        return [texto for valor in nodo for texto in _textos(valor)]
    return []


def _errores_de_genero_de(especie: dict[str, Any], genero: str) -> list[str]:
    nombre = especie["nombreBoe"]
    taxon = especie.get("taxon") or {}
    fallos: list[str] = []
    if not taxon.get("resuelto"):
        return [
            f"«{nombre}» regula un género entero y no publica taxón: el género se resuelve en "
            "WoRMS, que es lo que evita tener que elegirle una especie"
        ]
    if taxon.get("rango") != "genero":
        fallos.append(
            f"«{nombre}» publica rango «{taxon.get('rango')}» y la norma regula el género "
            f"«{genero}» entero"
        )
    if especie["correspondencia"].get("tipo") != GENERO_DE_SPP:
        fallos.append(
            f"«{nombre}» es una fila de género y su correspondencia se rotula "
            f"«{especie['correspondencia'].get('tipo')}»"
        )
    binomio = _binomio_de(genero)
    for texto in _textos(especie):
        encontrado = binomio.search(texto)
        if encontrado:
            fallos.append(
                f"«{nombre}» regula un género y su ficha nombra la especie concreta "
                f"«{encontrado.group(0)}» (en «{texto[:80]}»): eso es inventarle a la norma un "
                "alcance que no tiene"
            )
    for caladero in especie["caladeros"]:
        presencia = caladero.get("presencia")
        if presencia and presencia.get("consultadoComo", "").strip() != genero:
            fallos.append(
                f"«{nombre}» consulta la presencia de {caladero['id']} como "
                f"«{presencia.get('consultadoComo')}» en vez de como el género «{genero}»"
            )
    return fallos


def errores_de_genero(dataset: dict[str, Any]) -> list[str]:
    """**Gate E3**: las filas ``spp`` publican rango género y ninguna nombra una especie concreta.

    Las dos mitades hacen falta. La primera —el rango— caza el descuido; la segunda caza el atajo
    de verdad, que es dejar el rango en «género» y colar el nombre de una especie en cualquier otro
    campo de la ficha (el aceptado, el nombre con el que se preguntó a OBIS, un motivo). Por eso
    recorre **todas** las cadenas de la fila y no una lista de campos elegida a mano: la lista se
    queda corta el día que alguien añada un campo.
    """
    fallos: list[str] = []
    for especie in dataset["especies"]:
        genero = es_genero(especie["nombreBoe"])
        if genero:
            fallos.extend(_errores_de_genero_de(especie, genero))
    return fallos


def filas_de_genero(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    """Las filas que regulan un género entero, que son las que mira E3."""
    return [e for e in dataset["especies"] if es_genero(e["nombreBoe"])]


# --------------------------------------------------------------------------------------------
# Estructura: la presencia no se publica desnuda
# --------------------------------------------------------------------------------------------


def errores_de_presencia(dataset: dict[str, Any]) -> list[str]:
    """Ningún recuento de OBIS se publica sin su frase de sesgo y sin su recorte declarado.

    Es la condición que hace *posible* el gate E4 de la interfaz: si el sesgo viaja en el mismo
    objeto que el número, publicarlo desnudo exige borrarlo antes a mano.
    """
    fallos: list[str] = []
    for especie in dataset["especies"]:
        for caladero in especie["caladeros"]:
            presencia = caladero.get("presencia")
            if presencia is None:
                if not (caladero.get("presenciaAusente") or "").strip():
                    fallos.append(
                        f"«{especie['nombreBoe']}» no publica presencia en {caladero['id']} y "
                        "tampoco dice por qué"
                    )
                continue
            if presencia.get("sesgo") != obis.SESGO:
                fallos.append(
                    f"«{especie['nombreBoe']}» publica {presencia.get('registros')} registros en "
                    f"{caladero['id']} sin la frase de sesgo al lado del número"
                )
            if presencia.get("recorte") not in dataset["recortes"]:
                fallos.append(
                    f"«{especie['nombreBoe']}» publica presencia en {caladero['id']} con el "
                    f"recorte {presencia.get('recorte')!r}, que el dataset no declara"
                )
    return fallos


# --------------------------------------------------------------------------------------------
# Cobertura: el catálogo son las especies del BOE, ni una más ni una menos
# --------------------------------------------------------------------------------------------


def sin_consultar(correspondencia: Correspondencia) -> worms.Resolucion:
    """La resolución de un nombre al que **se decide no preguntar** (la celda con dos especies).

    Existe para que «no lo hemos preguntado» sea un desenlace con motivo y no un hueco: el taxón
    sale ``resuelto: false`` con la razón dentro, igual que un 204 de WoRMS.
    """
    return worms.Resolucion(
        consultado="",
        motivo=f"no se consulta a WoRMS: {correspondencia.motivo}",
    )


def errores_de_cobertura(dataset: dict[str, Any], tallas: dict[str, Any]) -> list[str]:
    """El catálogo publica **todos** los nombres del BOE y **todas** sus filas, sin perder ninguna.

    Se recuenta contra ``normativa/v1``, que es la fuente del catálogo: una regeneración que se
    dejara especies por el camino dejaría un dataset internamente coherente y más corto, y eso no
    lo nota ningún otro gate.
    """
    fallos: list[str] = []
    esperados = set(nombres_del_boe(tallas))
    publicados = {especie["nombreBoe"] for especie in dataset["especies"]}
    for falta in sorted(esperados - publicados):
        fallos.append(f"el BOE regula «{falta}» y el catálogo no lo publica")
    for sobra in sorted(publicados - esperados):
        fallos.append(f"el catálogo publica «{sobra}», que no está en el dataset de normativa")
    filas_publicadas = sum(
        len(caladero["tallas"]) for especie in dataset["especies"] for caladero in especie["caladeros"]
    )
    filas_totales = filas_publicadas + len(dataset["sinNombreCientifico"])
    filas_del_dataset = len(filas_del_boe(tallas))
    if filas_totales != filas_del_dataset:
        fallos.append(
            f"el catálogo da cuenta de {filas_totales} filas del BOE ({filas_publicadas} con taxón "
            f"y {len(dataset['sinNombreCientifico'])} sin nombre científico) y la norma tiene "
            f"{filas_del_dataset}: hay filas que no aparecen por ninguna parte"
        )
    return fallos
