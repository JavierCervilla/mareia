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
import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from mareia_pipeline.catalog import slugify
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
    "clave": (
        "Mareia · slug del nombre del BOE más el digest de su literal exacto. Ni corrige la grafía "
        "de la norma ni la colapsa: «Thunnus thynnus» y «Thunnus Thynnus» son dos claves."
    ),
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


def clave_de(nombre_boe: str) -> str:
    """La clave con la que se identifica una especie del catálogo, **única y estable**.

    Es un slug legible **más el digest del literal exacto de la norma**, y el sufijo no es adorno:
    lo pide un caso medido. El BOE escribe ``Thunnus thynnus`` (Anexos I y II) y ``Thunnus
    Thynnus`` (Anexo III), que son dos filas distintas del catálogo, y **cualquier slug en
    minúsculas las colapsa en una**. Con la clave repetida, quien busca una fila encuentra siempre
    la primera y la segunda puede publicarse a medias sin que nada se ponga rojo.

    Tres propiedades, y las tres son el motivo de que la clave se construya así y no de otra forma:

    1. **Única**, porque el digest se calcula sobre el literal **sin normalizar**: dos grafías
       distintas de la norma dan dos claves distintas. La ortografía del BOE no se corrige aquí ni
       en ningún sitio; lo que cambia es que ahora se distingue.
    2. **Estable**, porque es función **sólo** del nombre: no depende de la posición de la fila, de
       cuántas filas haya ni de qué otras grafías existan. Un sufijo ``-2`` puesto al detectar la
       colisión cumpliría lo primero y no lo segundo —bastaría con que la norma ganara o perdiera
       una fila para repuntar claves ajenas—, y un ``data-especie`` que cambia de sitio en silencio
       es justo lo que esta clave existe para evitar.
    3. **No se apoya en las mayúsculas para distinguir.** ``thunnus-thynnus`` y ``Thunnus-Thynnus``
       sólo se diferencian en la caja, y cualquier comparación insensible a ella —un selector con
       ``i``, un sistema de ficheros, un ``lower()`` de conveniencia— las vuelve a colapsar. El
       digest las separa en cualquier comparación.

    El sufijo va **siempre**, también en las 84 filas que no colisionan con nadie: una clave que
    cambia de forma según lo que hagan las demás vuelve a depender de las demás, que es lo que la
    propiedad 2 descarta. Seis dígitos hexadecimales, y una colisión del propio digest tampoco
    pasaría callada: la caza ``errores_de_clave`` antes de escribir y el lector de la web al leer.
    """
    return f"{slugify(nombre_boe)}-{hashlib.sha256(nombre_boe.encode('utf-8')).hexdigest()[:6]}"


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


#: Lo que en un caladero publicado **no** sale del BOE, sino de OBIS. Es lo que el gate E5 deja
#: fuera de la reconstrucción: la presencia se pregunta a una API y no se puede rehacer sin red,
#: y de que viaje con su sesgo y su recorte ya responde ``errores_de_presencia``.
CAMPOS_QUE_NO_SON_DEL_BOE = ("presencia", "presenciaAusente")


def caladeros_del_boe(nombre_boe: str, tallas: dict[str, Any]) -> list[dict[str, Any]]:
    """Los caladeros que regulan una especie con **sólo** lo que sale de ``normativa/v1``.

    Es el único sitio donde la talla legal se copia del dataset de normativa al catálogo, y por eso
    la llaman los dos lados: ``construir_dataset`` para publicar y el gate E5
    (``errores_de_tallas``) para comprobar que lo publicado es exactamente esto. Si el gate tuviera
    su propia lectura de la norma, compararía el catálogo contra una **segunda interpretación** en
    vez de contra la norma, y las dos podrían estar de acuerdo en lo mismo equivocado.

    Devuelve la fila entera —``tallas`` con su ``talla``, su ``textoOriginal``, sus ``notas``, su
    ``procedencia`` y su ``medida`` cuando la hay— y no una selección de campos: qué se compara lo
    decide lo que la norma dice de esa especie, no una lista escrita a mano que se queda corta el
    día que ``normativa/v1`` gane un campo.
    """
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
        publicados.append(entrada)
    return publicados


def _caladeros_de(
    nombre_boe: str,
    tallas: dict[str, Any],
    resolucion: worms.Resolucion,
    presencias: dict[tuple[str, str], obis.Presencia],
    *,
    consultado_en: dt.date,
) -> list[dict[str, Any]]:
    """Los caladeros del BOE de una especie, más la presencia de OBIS de cada uno."""
    publicados = caladeros_del_boe(nombre_boe, tallas)
    for entrada in publicados:
        if resolucion.registro is None:
            entrada["presencia"] = None
            entrada["presenciaAusente"] = (
                "sin taxón resuelto no se pregunta a OBIS: un cero de una búsqueda que no puede "
                "acertar se lee como ausencia de la especie, y eso sería mentir sobre el mar."
            )
        else:
            clave = (nombre_para_obis(resolucion.registro), entrada["id"])
            if clave not in presencias:
                raise ValueError(
                    f"falta la presencia de «{clave[0]}» en el caladero {clave[1]}: el dataset no "
                    "se construye a medias, porque una presencia ausente se lee como un cero"
                )
            entrada["presencia"] = _presencia_a_json(presencias[clave], consultado_en=consultado_en)
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
                "clave": clave_de(nombre),
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
# Estructura: dos filas de la norma no acaban en una
# --------------------------------------------------------------------------------------------


def errores_de_clave(dataset: dict[str, Any]) -> list[str]:
    """Cada especie trae su ``clave``, y **no hay dos iguales**.

    Son dos comprobaciones y hacen falta las dos:

    * **No hay dos iguales**, porque dos filas con la misma clave son dos filas que nadie puede
      distinguir: quien busca una encuentra siempre la primera, y la segunda se puede publicar a
      medias en verde. El caso está medido —``Thunnus thynnus`` y ``Thunnus Thynnus``— y hoy sólo
      lo puede provocar una colisión del propio digest o una edición a mano del JSON.
    * **La clave sale del nombre**, recomputada con ``clave_de`` en vez de leída. Una clave
      tecleada podría no repetirse con ninguna y aun así haber dejado de ser función del literal,
      que es de donde sale su estabilidad.

    La repetición se mira **antes**, para que el sabotaje que de verdad ocurre —colapsar una grafía
    sobre otra— salga nombrando las dos filas que colisionan y no la recomputación.
    """
    fallos: list[str] = []
    vistas: dict[str, str] = {}
    for especie in dataset["especies"]:
        nombre = especie["nombreBoe"]
        clave = especie.get("clave")
        esperada = clave_de(nombre)
        if clave in vistas:
            fallos.append(
                f"«{nombre}» y «{vistas[clave]}» comparten la clave {clave!r}: son dos filas de la "
                "norma que nadie puede distinguir"
            )
        elif clave != esperada:
            fallos.append(
                f"«{nombre}» publica la clave {clave!r} y la que sale de su nombre es {esperada!r}: "
                "la clave se calcula del literal de la norma, no se escribe"
            )
        else:
            vistas[clave] = nombre
    return fallos


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


# --------------------------------------------------------------------------------------------
# Reconstrucción: el catálogo es lo que dicen sus fuentes, no lo que él dice de sí mismo
# --------------------------------------------------------------------------------------------

#: Cuántas diferencias se listan antes de callar, por el mismo motivo que en ``normativa``: un
#: catálogo regenerado de una fuente que cambió difiere en cientos de campos, y volcarlos todos
#: esconde el primero, que es el que se lee.
TOPE_DE_DIFERENCIAS = 20


def _diferencias(publicado: Any, esperado: Any, camino: str, fallos: list[str]) -> None:
    """Compara campo a campo y **nombra el camino** de cada diferencia.

    Recorre la estructura entera en vez de una lista de campos: es lo que hace que un campo nuevo
    de la fuente quede vigilado el día que aparezca, sin que nadie tenga que acordarse de añadirlo.
    """
    if len(fallos) >= TOPE_DE_DIFERENCIAS:
        return
    if isinstance(esperado, dict) and isinstance(publicado, dict):
        for clave in sorted(set(esperado) | set(publicado)):
            if clave not in publicado:
                fallos.append(f"{camino}.{clave}: la fuente lo trae y el catálogo no lo publica")
            elif clave not in esperado:
                fallos.append(f"{camino}.{clave}: el catálogo lo publica y la fuente no lo dice")
            else:
                _diferencias(publicado[clave], esperado[clave], f"{camino}.{clave}", fallos)
        return
    if isinstance(esperado, list) and isinstance(publicado, list):
        if len(esperado) != len(publicado):
            fallos.append(
                f"{camino}: el catálogo publica {len(publicado)} entradas y la fuente da "
                f"{len(esperado)}"
            )
            return
        for indice, (uno, otro) in enumerate(zip(publicado, esperado, strict=True)):
            _diferencias(uno, otro, f"{camino}[{indice}]", fallos)
        return
    if publicado != esperado:
        fallos.append(f"{camino}: el catálogo publica {publicado!r} y la fuente dice {esperado!r}")


def _cortadas(fallos: list[str], regenerar: str) -> list[str]:
    """La coletilla que se añade cuando la lista de diferencias llegó al tope."""
    if len(fallos) >= TOPE_DE_DIFERENCIAS:
        fallos.append(
            f"… y más: la lista se corta en {TOPE_DE_DIFERENCIAS}. Regenera el catálogo con "
            f"`{regenerar}` y mira el diff entero"
        )
    return fallos


# --------------------------------------------------------------------------------------------
# E5 · la talla legal publicada es la que dice la norma
# --------------------------------------------------------------------------------------------


def errores_de_tallas(dataset: dict[str, Any], tallas: dict[str, Any]) -> list[str]:
    """**Gate E5**: las tallas del catálogo se **rehacen** desde ``normativa/v1`` y se diffean.

    **Por qué existe.** La talla mínima de una especie se publica en **dos** superficies —la ficha
    del catálogo y la sección de cada puerto— y las dos leen datasets distintos: el catálogo copia
    la cifra de ``tallas-minimas.json`` en el momento de la ingesta y nadie volvía a contrastarla.
    G4 cubre ``tallas-minimas.json`` contra el BOE capturado, pero no cubría la **copia**. Medido:
    poner ``Merluccius merluccius`` a 12 cm en el catálogo dejaba el índice diciendo «12 cm, el BOE
    imprime "12"» y la página de Vigo diciendo «27 cm» en el mismo ``dist/``, con `run.py check`, el
    build y los tests en verde. Una cifra con consecuencia legal, atribuida al BOE, y contradicha
    por el propio sitio.

    **Qué compara.** Todo lo que en un caladero publicado viene del BOE: el caladero y su anexo, el
    nombre común, y cada fila de ``tallas`` entera —``talla``, ``textoOriginal``, ``notas``,
    ``procedencia`` y ``medida``—. ``medida`` no es un extra: sin ella ``Nephrops norvegicus``
    publica 2 cm y 7 cm en el mismo caladero sin nada que distinga la longitud del cefalotórax de
    la total, y eso también pasaba en verde. Lo único que se deja fuera es lo de OBIS
    (``CAMPOS_QUE_NO_SON_DEL_BOE``), que no se puede rehacer sin red.

    **Qué no puede cazar por construcción**: que ``tallas-minimas.json`` esté mal. De eso responde
    G4, que lo contrasta contra la captura del BOE. Los dos hacen falta y ninguno cubre al otro:
    G4 mira la norma contra su fuente y E5 mira la copia contra la norma.
    """
    fallos: list[str] = []
    for especie in dataset["especies"]:
        if len(fallos) >= TOPE_DE_DIFERENCIAS:
            break
        nombre = especie["nombreBoe"]
        try:
            esperados = {c["id"]: c for c in caladeros_del_boe(nombre, tallas)}
        except KeyError as error:
            # Un gate que revienta no es un gate: deja el check a medias y se lleva por delante a
            # los que venían detrás. Si la norma publicada está incompleta lo dice G1, y aquí lo
            # que toca decir es que sin ella no hay con qué contrastar esta fila.
            fallos.append(
                f"«{nombre}»: al RD 560/1995 publicado le falta {error} en alguna de sus filas, "
                "así que no hay contra qué contrastar la talla que publica el catálogo"
            )
            continue
        publicados: dict[str, dict[str, Any]] = {}
        for indice, caladero in enumerate(especie.get("caladeros") or []):
            clave = caladero.get("id") or f"#{indice}"
            if clave in publicados:
                fallos.append(
                    f"«{nombre}» publica dos veces el caladero {clave}: la norma le da una tabla "
                    "por caladero y dos filas para el mismo no se pueden contrastar"
                )
                continue
            publicados[clave] = {
                campo: valor
                for campo, valor in caladero.items()
                if campo not in CAMPOS_QUE_NO_SON_DEL_BOE
            }
        for falta in sorted(set(esperados) - set(publicados)):
            fallos.append(
                f"«{nombre}» tiene talla mínima en {falta} y el catálogo no publica ese caladero"
            )
        for sobra in sorted(set(publicados) - set(esperados)):
            fallos.append(
                f"«{nombre}» publica el caladero {sobra} y el RD 560/1995 no le fija talla ahí"
            )
        for clave in sorted(set(esperados) & set(publicados)):
            _diferencias(publicados[clave], esperados[clave], f"«{nombre}» · {clave}", fallos)
    return _cortadas(fallos, "python run.py especies")


# --------------------------------------------------------------------------------------------
# E6 · la procedencia taxonómica es la que contestó WoRMS
# --------------------------------------------------------------------------------------------

#: Las respuestas de WoRMS **capturadas** el día de la ingesta, una por consulta y byte a byte tal
#: y como las sirve la API. Las escribe ``run.py especies`` junto al dataset —ver ``volcar_captura``
#: — para que no puedan desincronizarse con él.
#:
#: Viven bajo ``tests/fixtures`` por el mismo motivo que las del BOE y las de RAMPE: es donde se
#: capturan las fuentes de este pipeline y **no se duplican**, porque dos copias se desincronizan y
#: la que se quedase vieja daría verde contra una fuente que ya nadie mira. Que un gate de
#: producción lea de ``tests/`` es el precio de tener una sola copia.
#:
#: **No es un mirror de WoRMS**, que su licencia prohíbe: son los 82 nombres que el RD 560/1995
#: obliga a resolver, con la cita que la propia fuente devuelve para cada uno — la misma extracción
#: curada que ya publica ``catalogo.json``.
FUENTE_WORMS_CAPTURADA = REPO_ROOT / "data" / "pipeline" / "tests" / "fixtures" / "worms"


def fichero_de_captura(consulta: str) -> str:
    """El nombre del fichero donde vive la respuesta a una consulta ya normalizada.

    La consulta normalizada es minúsculas y blancos simples (``worms.normalizar``), así que el
    guion sustituye al espacio y no colisiona con nada. ``volcar_captura`` lo comprueba en vez de
    confiarlo: dos consultas en el mismo fichero dejarían a una fila contrastándose contra la
    respuesta de otra.
    """
    return f"{consulta.replace(' ', '-')}.json"


def volcar_captura(
    cuerpos: dict[str, bytes], destino: Path = FUENTE_WORMS_CAPTURADA
) -> list[Path]:
    """Escribe la captura de WoRMS: un fichero por consulta, y **ninguno de más**.

    Se llama desde la ingesta y no a mano, que es lo que garantiza que la captura y el dataset son
    de la misma tanda: el gate E6 compara uno contra otra, y una captura vieja daría verde
    describiendo un WoRMS que ya no es el que se publicó. Por eso también borra los ficheros que
    sobran —una consulta que la norma deje de exigir no se queda ahí de adorno.
    """
    destino.mkdir(parents=True, exist_ok=True)
    escritos: dict[str, str] = {}
    for consulta, cuerpo in sorted(cuerpos.items()):
        fichero = fichero_de_captura(consulta)
        if fichero in escritos:
            raise ValueError(
                f"«{consulta}» y «{escritos[fichero]}» caen en el mismo fichero de captura "
                f"({fichero}): dos consultas distintas no pueden compartir respuesta"
            )
        escritos[fichero] = consulta
        (destino / fichero).write_bytes(cuerpo)
    for viejo in destino.glob("*.json"):
        if viejo.name not in escritos:
            viejo.unlink()
    return [destino / fichero for fichero in sorted(escritos)]


def respuesta_capturada(consulta: str, origen: Path = FUENTE_WORMS_CAPTURADA) -> bytes | None:
    """El cuerpo capturado de una consulta, o ``None`` si la captura no la trae."""
    ruta = origen / fichero_de_captura(consulta)
    return ruta.read_bytes() if ruta.is_file() else None


def errores_de_procedencia(
    dataset: dict[str, Any], origen: Path | None = None
) -> list[str]:
    """**Gate E6**: el taxón publicado se **rehace** desde la captura de WoRMS y se diffea.

    **Por qué existe.** El taxón son 85 filas resueltas y hasta aquí no lo contrastaba nada: E2
    audita de quién es la *decisión* de a qué nombre se pregunta, no *qué contestó* la fuente. El
    hueco está medido: en ``Conger conger``, con la correspondencia ``literal``/``worms`` intacta,
    cambiar el ``aphiaId`` a 126425 y el aceptado a ``Sardina pilchardus`` dejaba `run.py check`,
    `pytest` y `pnpm test` en verde. Ni el ``aphiaId``, ni el ``estado``, ni el ``aceptado``, ni el
    ``rango``, ni la ``cita`` tenían quien los mirara.

    **Cómo se rehace.** Es el mismo camino que ``run.py especies`` con la descarga sustituida por
    la captura: la consulta se **recomputa** con ``correspondencia_de`` —no se lee del artefacto,
    que es justo lo que se puede falsear—, sus bytes se pasan por ``worms.leer_respuesta`` y el
    resultado por ``_taxon_a_json``. Así los cuatro modos de fallo caen solos y sin lista de
    campos: la consulta que no está en la captura, la respuesta vacía (el 204 de WoRMS, que
    reconstruye ``resuelto: false`` y choca con cualquier taxón publicado), el ``aphiaId`` que no
    es el que devuelve esa consulta, y ``estado``/``aceptado``/``rango`` campo a campo.

    ``consultadoEn`` se toma de ``fuentes.worms.consultadoEn`` y por eso queda fuera de la
    comparación **por definición**: es el sello del día en que se preguntó, no algo que diga la
    respuesta. Lo que sí queda dentro es que las 86 fichas declaren ese mismo día.

    **Qué no puede cazar por construcción**: que la captura y el dataset se falsifiquen juntos, o
    que WoRMS haya cambiado de opinión desde la ingesta. Lo primero es el mismo límite que tienen
    G4 y P6; lo segundo no es trabajo de un gate offline y determinista, que tiene que decir lo
    mismo hoy que dentro de un año.

    ``origen`` se resuelve **al llamar** y no al importar: apuntar el gate a otra captura es como
    se comprueba que sabe ponerse rojo —una respuesta vaciada, un fichero que falta— sin tener que
    tocar la que se publica.
    """
    origen = origen or FUENTE_WORMS_CAPTURADA
    if not origen.is_dir():
        return [
            f"no está la captura de WoRMS ({origen}): sin ella no se puede comprobar que el taxón "
            "publicado es el que contestó la fuente"
        ]
    sello = (dataset.get("fuentes", {}).get("worms") or {}).get("consultadoEn")
    try:
        consultado_en = dt.date.fromisoformat(str(sello))
    except (TypeError, ValueError):
        return [
            f"el catálogo no dice cuándo se consultó a WoRMS ({sello!r}): sin esa fecha no se sabe "
            "de qué día es la procedencia que publica"
        ]
    fallos: list[str] = []
    for especie in dataset["especies"]:
        if len(fallos) >= TOPE_DE_DIFERENCIAS:
            break
        nombre = especie["nombreBoe"]
        correspondencia = correspondencia_de(nombre)
        _diferencias(
            especie.get("correspondencia") or {},
            {
                "tipo": correspondencia.tipo,
                "origen": correspondencia.origen,
                "consultadoComo": correspondencia.consulta,
                "motivo": correspondencia.motivo,
                "laNormaNoDiceEso": correspondencia.la_norma_no_dice_eso,
            },
            f"«{nombre}» · correspondencia",
            fallos,
        )
        if correspondencia.consulta is None:
            resolucion = sin_consultar(correspondencia)
        else:
            cuerpo = respuesta_capturada(correspondencia.consulta, origen)
            if cuerpo is None:
                fallos.append(
                    f"«{nombre}» publica un taxón que sale de preguntar «{correspondencia.consulta}» "
                    "a WoRMS y la captura no trae esa respuesta: regenera catálogo y captura con "
                    "`python run.py especies`"
                )
                continue
            try:
                resolucion = worms.leer_respuesta(cuerpo, consultado=correspondencia.consulta)
            except worms.ErrorWorms as error:
                fallos.append(
                    f"«{nombre}»: la respuesta capturada de «{correspondencia.consulta}» ya no se "
                    f"puede leer con el parser de hoy: {error}"
                )
                continue
        _diferencias(
            especie.get("taxon") or {},
            _taxon_a_json(resolucion, consultado_en=consultado_en),
            f"«{nombre}» · taxon",
            fallos,
        )
    return _cortadas(fallos, "python run.py especies")
