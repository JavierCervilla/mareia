"""Normativa pesquera publicable: del texto consolidado del BOE al dataset ``normativa/v1``.

Aquí vive lo que es **de Mareia** y no del BOE: cómo se llaman los tres caladeros en el portal, qué
puerto pertenece a cuál, qué forma tiene el JSON que se publica y qué es lo que un dato tiene que
declarar para poder publicarse (el gate G1). El parseo de la fuente está en ``sources/boe.py``.

Dos decisiones que dan forma al módulo, cada una con su motivo:

1. **La procedencia se declara por cifra, no por documento.** Cada especie lleva su
   ``procedencia`` —bloque, fecha de vigencia y ELI— aunque el caladero ya la declare arriba, y G1
   comprueba que las dos coinciden. Un gate que sólo prohibiera la ausencia se satisface callando;
   éste obliga a decir de dónde sale **cada** cifra, y de paso caza la fila copiada de otro anexo,
   que es el error que ninguna revisión humana ve en una tabla de ciento y pico filas.
2. **Las especies que se miden de varias formas se publican como filas hijas con su rótulo.** El
   BOE escribe ``Cigala (entera) (Nephrops norvegicus):`` sin cifra y cuelga de ella ``Longitud
   cefalotórax`` y ``Longitud total``. La cabecera **no** se publica como una especie a la que le
   falta la talla —no le falta: la llevan sus hijas—, así que cada hija sale como una entrada con
   el nombre de la cabecera y su ``medida``. La alternativa era un array de medidas dentro de la
   especie, y se descartó porque cambiaba la forma de ``talla``/``textoOriginal`` que el resto del
   sistema consume: una fila del dataset siempre tiene **una** talla y **un** literal.
"""

from __future__ import annotations

import datetime as dt
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from mareia_pipeline.sources import boe

REPO_ROOT = Path(__file__).resolve().parents[3]
DATASET = REPO_ROOT / "data" / "normativa" / "tallas-minimas.json"
PORTS_JSON = REPO_ROOT / "data" / "geo" / "ports.json"

SCHEMA = "normativa/v1"

#: Los tres caladeros, con el bloque del BOE del que sale cada uno. El identificador es el que
#: viajará en la URL y en el API, así que se escribe aquí y no se deriva del título del anexo: un
#: cambio de redacción del BOE no debe renombrar una ruta pública.
CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ = "cantabrico-noroeste-y-golfo-de-cadiz"
MEDITERRANEO = "mediterraneo"
CANARIO = "canario"

CALADERO_DE_BLOQUE: dict[str, tuple[str, str]] = {
    "ani": (CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ, "Cantábrico y noroeste y golfo de Cádiz"),
    "anii": (MEDITERRANEO, "Mediterráneo"),
    "aniii": (CANARIO, "Canario"),
}

LICENCIA = "Reutilización de la legislación (art. 13 Ley 37/2007 y RD 1495/2011)"
LICENCIA_URL = "https://www.boe.es/informacion/aviso_legal/"
AVISO = "Solo el texto publicado en el BOE tiene carácter auténtico."


class ErrorCaladero(ValueError):
    """Un puerto del catálogo no tiene caladero asignado, así que el catálogo no se publica.

    Falla en vez de elegir uno por defecto: un puerto al que se le asigna el caladero equivocado
    publica la tabla de tallas de otro mar, y eso se lee igual de bien que la correcta.
    """


@dataclass(frozen=True)
class Curacion:
    """Un puerto cuyo caladero **no** sale de su provincia y se decide uno a uno, con su motivo."""

    caladero: str
    provincia: str
    motivo: str


#: Provincia → caladero. Sale entero de la geografía salvo el Estrecho y Sevilla, que van abajo.
CALADERO_POR_PROVINCIA: dict[str, str] = {
    # Anexo I: cornisa cantábrica, Galicia y el golfo de Cádiz atlántico.
    "gipuzkoa": CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ,
    "bizkaia": CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ,
    "cantabria": CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ,
    "asturias": CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ,
    "lugo": CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ,
    "a-coruna": CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ,
    "pontevedra": CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ,
    "huelva": CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ,
    # Anexo II: del Estrecho al Cap de Creus, más Baleares, Ceuta y Melilla.
    "malaga": MEDITERRANEO,
    "granada": MEDITERRANEO,
    "almeria": MEDITERRANEO,
    "murcia": MEDITERRANEO,
    "alicante": MEDITERRANEO,
    "valencia": MEDITERRANEO,
    "castellon": MEDITERRANEO,
    "tarragona": MEDITERRANEO,
    "barcelona": MEDITERRANEO,
    "illes-balears": MEDITERRANEO,
    "ceuta": MEDITERRANEO,
    "melilla": MEDITERRANEO,
    # Anexo III: las dos provincias canarias, sin excepciones.
    "las-palmas": CANARIO,
    "santa-cruz-de-tenerife": CANARIO,
}

#: Los puertos que **no** hereda su caladero de la provincia. Cádiz entera es el caso: es la única
#: provincia española que cruza el límite entre dos caladeros —Punta Marroquí, en Tarifa— y
#: asignarla en bloque pondría la tabla del Mediterráneo en Sanlúcar o la del Atlántico en
#: Algeciras. El motivo de cada uno viaja en el propio dato y está publicado en
#: ``data/normativa/README.md``: una curación sin motivo escrito es una opinión que nadie puede
#: revisar.
CURACION_POR_PUERTO: dict[str, Curacion] = {
    "sanlucar-de-barrameda": Curacion(
        CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ, "cadiz", "desembocadura del Guadalquivir, Atlántico"
    ),
    "chipiona": Curacion(
        CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ, "cadiz", "golfo de Cádiz, al oeste de Punta Marroquí"
    ),
    "rota": Curacion(
        CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ, "cadiz", "golfo de Cádiz, al oeste de Punta Marroquí"
    ),
    "cadiz": Curacion(
        CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ, "cadiz", "golfo de Cádiz, al oeste de Punta Marroquí"
    ),
    "chiclana-de-la-frontera": Curacion(
        CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ, "cadiz", "golfo de Cádiz, al oeste de Punta Marroquí"
    ),
    "conil-de-la-frontera": Curacion(
        CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ, "cadiz", "golfo de Cádiz, al oeste de Punta Marroquí"
    ),
    "barbate": Curacion(
        CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ, "cadiz", "golfo de Cádiz, al oeste de Punta Marroquí"
    ),
    # El caso frontera, y se dice que lo es. Tarifa está **sobre** Punta Marroquí (lon −5,606), el
    # punto en el que la norma separa el caladero del golfo de Cádiz del mediterráneo: su flota
    # faena a los dos lados y ninguna asignación es limpia. Se resuelve al Atlántico —el puerto y
    # la playa de los Lances quedan al oeste del cabo— y se publica el motivo para que quien lo
    # lea sepa que aquí hay una decisión y no un dato.
    "tarifa": Curacion(
        CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ,
        "cadiz",
        "sobre Punta Marroquí: es el caso frontera y se resuelve al Atlántico",
    ),
    "algeciras": Curacion(MEDITERRANEO, "cadiz", "bahía de Algeciras, al este de Punta Marroquí"),
    "san-roque": Curacion(MEDITERRANEO, "cadiz", "bahía de Algeciras, al este de Punta Marroquí"),
    "la-linea-de-la-concepcion": Curacion(
        MEDITERRANEO, "cadiz", "bahía de Algeciras, al este de Punta Marroquí"
    ),
    # Sevilla no está en el mar: es un puerto fluvial 80 km Guadalquivir arriba, en tramo mareal
    # —por eso tiene marea y por eso está en el catálogo—. Su caladero es el del estuario al que
    # sale, no el de una provincia costera que no tiene.
    "seville": Curacion(
        CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ,
        "sevilla",
        "puerto fluvial en el tramo mareal del Guadalquivir, 80 km río arriba del golfo de Cádiz",
    ),
}


def caladero_de_puerto(slug: str, provincia: str) -> str:
    """Caladero de un puerto del catálogo. **Levanta** si no lo sabe; nunca elige por defecto."""
    curado = CURACION_POR_PUERTO.get(slug)
    if curado is not None:
        if curado.provincia != provincia:
            raise ErrorCaladero(
                f"el puerto «{slug}» está curado como de {curado.provincia} y el catálogo lo pone "
                f"en {provincia}: la curación ya no describe a este puerto"
            )
        return curado.caladero
    caladero = CALADERO_POR_PROVINCIA.get(provincia)
    if caladero is None:
        raise ErrorCaladero(
            f"el puerto «{slug}» está en la provincia «{provincia}», que no tiene caladero "
            "asignado. Asígnalo en CALADERO_POR_PROVINCIA (o puerto a puerto en "
            "CURACION_POR_PUERTO si la provincia cruza el límite entre dos caladeros)."
        )
    return caladero


def _cifra(valor: float) -> float | int:
    """Publica ``36`` y no ``36.0``, pero deja ``6,4`` como ``6.4``."""
    return int(valor) if float(valor).is_integer() else valor


def talla_a_json(talla: boe.Talla) -> dict[str, Any]:
    """La unión discriminada, cerrada, tal y como se publica.

    Sin rama por defecto a propósito: una clase de talla nueva tiene que romper aquí y obligar a
    decidir cómo se publica, no colarse como un objeto vacío que la interfaz pintará como si no
    hubiera talla.
    """
    if isinstance(talla, boe.LongitudCm):
        return {"tipo": "longitud_cm", "cm": _cifra(talla.cm)}
    if isinstance(talla, boe.PesoKg):
        return {"tipo": "peso_kg", "kg": _cifra(talla.kg)}
    if isinstance(talla, boe.LongitudOPeso):
        return {"tipo": "longitud_o_peso", "cm": _cifra(talla.cm), "kg": _cifra(talla.kg)}
    if isinstance(talla, boe.PorDeterminar):
        return {"tipo": "por_determinar", "segunNota": talla.segun_nota}
    if isinstance(talla, boe.SinDatoLegible):
        return {"tipo": "sin_dato_legible", "motivo": talla.motivo}
    raise TypeError(f"clase de talla sin forma publicable: {type(talla).__name__}")


#: Claves exactas de cada clase de talla. El gate G1 las compara con las que trae el dataset, así
#: que un ``longitud_cm`` sin ``cm`` —o con un campo de más— no pasa.
CLAVES_DE_TALLA: dict[str, set[str]] = {
    "longitud_cm": {"tipo", "cm"},
    "peso_kg": {"tipo", "kg"},
    "longitud_o_peso": {"tipo", "cm", "kg"},
    "por_determinar": {"tipo", "segunNota"},
    "sin_dato_legible": {"tipo", "motivo"},
}


def _especie_a_json(especie: boe.Especie, *, procedencia: dict[str, str]) -> dict[str, Any]:
    documento: dict[str, Any] = {"nombreComun": especie.nombre_comun}
    if isinstance(especie.nombre_cientifico, boe.NombreDeclarado):
        documento["nombreCientifico"] = especie.nombre_cientifico.valor
    else:
        documento["nombreCientificoAusente"] = especie.nombre_cientifico.motivo
    if especie.nombre_local:
        documento["nombreLocalCanario"] = especie.nombre_local
    elif especie.nombre_local_ausente:
        documento["nombreLocalCanarioAusente"] = especie.nombre_local_ausente
    if especie.medida:
        documento["medida"] = especie.medida
    documento["talla"] = talla_a_json(especie.talla)
    documento["textoOriginal"] = especie.texto_original
    documento["notas"] = list(especie.notas)
    documento["procedencia"] = procedencia
    return documento


def _iso(sello: str) -> str:
    """``20251101`` o ``20251218T134342Z`` → ``2025-11-01``. Vacío si el BOE no lo declara."""
    if len(sello) < 8 or not sello[:8].isdigit():
        return ""
    return f"{sello[:4]}-{sello[4:6]}-{sello[6:8]}"


def construir_dataset(
    metadatos: boe.Metadatos, anexos: tuple[boe.Anexo, ...], *, verificado_en: dt.date
) -> dict[str, Any]:
    """El documento ``normativa/v1`` completo, listo para escribirse."""
    caladeros = []
    for anexo in anexos:
        identificador, nombre = CALADERO_DE_BLOQUE[anexo.bloque]
        procedencia = {
            "bloque": anexo.bloque,
            "fechaVigencia": anexo.fecha_vigencia.isoformat(),
            "eli": metadatos.eli,
        }
        caladeros.append(
            {
                "id": identificador,
                "nombre": nombre,
                "anexo": anexo.anexo,
                "bloque": anexo.bloque,
                "titulo": anexo.titulo,
                "fechaVigencia": anexo.fecha_vigencia.isoformat(),
                "fechaActualizacionBloque": _iso(anexo.fecha_actualizacion),
                "normaModificadora": anexo.norma_modificadora,
                "notas": [{"marca": nota.marca, "texto": nota.texto} for nota in anexo.notas],
                "especies": [
                    _especie_a_json(especie, procedencia=dict(procedencia))
                    for especie in anexo.especies
                ],
            }
        )
    return {
        "schema": SCHEMA,
        "fuente": {
            "norma": metadatos.titulo,
            "identificador": metadatos.identificador,
            "eli": metadatos.eli,
            "textoConsolidado": metadatos.url_html_consolidada,
            "fechaActualizacion": _iso(metadatos.fecha_actualizacion),
            "licencia": LICENCIA,
            "licenciaUrl": LICENCIA_URL,
            "aviso": AVISO,
            "verificadoEn": verificado_en.isoformat(),
        },
        "caladeros": caladeros,
    }


def sellar_verificacion(dataset: dict[str, Any], fecha: dt.date) -> dict[str, Any]:
    """Escribe ``fuente.verificadoEn``. **Es el único sitio desde el que se escribe.**

    Lo llaman los dos caminos que acaban de hablar con el BOE —la ingesta y el gate diario de
    vigencia—, nunca una mano: la fecha dice «alguien comprobó ese día que la norma sigue en vigor»,
    y tecleada no diría nada.
    """
    sellado = json.loads(json.dumps(dataset))
    sellado["fuente"]["verificadoEn"] = fecha.isoformat()
    return sellado


def volcar(dataset: dict[str, Any], destino: Path = DATASET) -> None:
    """Escribe el dataset con el mismo formato que el resto de datos del repositorio."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(dataset, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def cargar(origen: Path = DATASET) -> dict[str, Any]:
    """Lee el dataset publicado."""
    return json.loads(origen.read_text(encoding="utf-8"))


# --------------------------------------------------------------------------------------------
# G1 · procedencia
# --------------------------------------------------------------------------------------------


def errores_de_procedencia(dataset: dict[str, Any]) -> list[str]:
    """Toda cifra publicada tiene que **declarar** de dónde sale: bloque, vigencia y ELI.

    Obliga a declarar en vez de limitarse a prohibir la ausencia, que es la diferencia entre un
    gate y una buena intención: prohibir se satisface callando —una tabla sin campo de procedencia
    no incumple nada—, así que aquí la procedencia es obligatoria, se compara con la que declara el
    caladero y con el ELI de la fuente, y una discrepancia es un fallo. Así también salta la fila
    copiada de otro anexo, que en una tabla de ciento y pico filas no la ve nadie leyendo.
    """
    fallos: list[str] = []
    if dataset.get("schema") != SCHEMA:
        fallos.append(f"el dataset declara schema {dataset.get('schema')!r} y se esperaba {SCHEMA!r}")
    fuente = dataset.get("fuente", {})
    for campo in ("norma", "identificador", "eli", "licencia", "aviso", "verificadoEn"):
        if not fuente.get(campo):
            fallos.append(f"fuente: no declara {campo}")
    eli = fuente.get("eli", "")
    caladeros = dataset.get("caladeros", [])
    if not caladeros:
        fallos.append("el dataset no publica ningún caladero")
    vistos: set[str] = set()
    for caladero in caladeros:
        identificador = caladero.get("id", "")
        etiqueta = identificador or "<caladero sin id>"
        if identificador not in {ident for ident, _ in CALADERO_DE_BLOQUE.values()}:
            fallos.append(f"{etiqueta}: no es uno de los tres caladeros de la norma")
        if identificador in vistos:
            fallos.append(f"{etiqueta}: aparece dos veces")
        vistos.add(identificador)
        for campo in ("anexo", "bloque", "fechaVigencia", "normaModificadora"):
            if not caladero.get(campo):
                fallos.append(f"{etiqueta}: no declara {campo}")
        notas = {nota.get("marca", "") for nota in caladero.get("notas", [])}
        especies = caladero.get("especies", [])
        if not especies:
            fallos.append(f"{etiqueta}: no publica ninguna especie")
        for especie in especies:
            fallos.extend(_errores_de_especie(especie, caladero=caladero, eli=eli, notas=notas))
    return fallos


def _errores_de_especie(
    especie: dict[str, Any], *, caladero: dict[str, Any], eli: str, notas: set[str]
) -> list[str]:
    nombre = especie.get("nombreComun") or "<especie sin nombre>"
    etiqueta = f"{caladero.get('id', '?')} · {nombre}"
    fallos: list[str] = []
    if not especie.get("nombreComun"):
        fallos.append(f"{etiqueta}: no declara nombreComun")
    if not (especie.get("nombreCientifico") or especie.get("nombreCientificoAusente")):
        fallos.append(
            f"{etiqueta}: no declara nombreCientifico ni el motivo por el que no lo tiene"
        )
    if not especie.get("textoOriginal"):
        fallos.append(f"{etiqueta}: no conserva el literal de la celda (textoOriginal)")
    talla = especie.get("talla")
    if not isinstance(talla, dict):
        fallos.append(f"{etiqueta}: no declara talla")
    else:
        tipo = talla.get("tipo")
        esperadas = CLAVES_DE_TALLA.get(str(tipo))
        if esperadas is None:
            fallos.append(f"{etiqueta}: la talla dice tipo {tipo!r}, que no es de la unión cerrada")
        elif set(talla) != esperadas:
            fallos.append(
                f"{etiqueta}: la talla {tipo!r} trae los campos {sorted(talla)} y la unión declara "
                f"{sorted(esperadas)}"
            )
    for marca in especie.get("notas", []):
        if marca not in notas:
            fallos.append(f"{etiqueta}: remite a la nota {marca}, que el caladero no publica")
    procedencia = especie.get("procedencia")
    if not isinstance(procedencia, dict):
        fallos.append(f"{etiqueta}: no declara procedencia (bloque, fechaVigencia, eli)")
        return fallos
    esperada = {
        "bloque": caladero.get("bloque"),
        "fechaVigencia": caladero.get("fechaVigencia"),
        "eli": eli,
    }
    for campo, valor in esperada.items():
        declarado = procedencia.get(campo)
        if not declarado:
            fallos.append(f"{etiqueta}: la procedencia no declara {campo}")
        elif declarado != valor:
            fallos.append(
                f"{etiqueta}: la procedencia dice {campo}={declarado!r} y el caladero {valor!r}"
            )
    return fallos


def errores_de_caladeros_de_puertos(catalogo: dict[str, Any]) -> list[str]:
    """Todo puerto del catálogo tiene que declarar un caladero, y tiene que ser el suyo.

    Se recorre puerto a puerto y se nombra al que falta: comprobar sólo el recuento total daría
    verde con un puerto sin caladero y otro de más.
    """
    validos = {identificador for identificador, _ in CALADERO_DE_BLOQUE.values()}
    fallos: list[str] = []
    for puerto in catalogo.get("ports", []):
        slug = puerto.get("slug", "<puerto sin slug>")
        declarado = puerto.get("caladero")
        if not declarado:
            fallos.append(f"{slug}: no declara caladero")
            continue
        if declarado not in validos:
            fallos.append(f"{slug}: declara el caladero {declarado!r}, que no existe")
            continue
        try:
            esperado = caladero_de_puerto(slug, puerto.get("province", {}).get("slug", ""))
        except ErrorCaladero as error:
            fallos.append(str(error))
            continue
        if declarado != esperado:
            fallos.append(f"{slug}: declara {declarado!r} y le corresponde {esperado!r}")
    return fallos


# --------------------------------------------------------------------------------------------
# G3 · trinquete de versión en vigor
# --------------------------------------------------------------------------------------------

#: Las seis especies canarias que el Real Decreto 936/2025 movió, con su talla **vigente** y la
#: **derogada** de 1995. Cinco de las seis subieron: publicar la de 1995 sería decirle a quien pesca
#: que puede quedarse un ejemplar por el que le pueden sancionar.
#:
#: ``especie → (cm vigente, cm derogado en 1995)``
TRINQUETE_CANARIO: dict[str, tuple[int, int]] = {
    "Aligote": (20, 12),
    "Cabrilla": (19, 15),
    "Cachucho": (22, 18),
    "Chopa": (23, 19),
    "Serrano imperial": (20, 15),
    "Pargo": (28, 33),
}


def errores_de_trinquete(dataset: dict[str, Any]) -> list[str]:
    """Comprueba que el **dataset publicado** trae la redacción de 2025 y no la de 1995.

    Se mide el artefacto y no la función del parser a propósito: un trinquete que mide una copia
    del instrumento deja de morder en cuanto el instrumento cambia (lección de T-13). Aquí se abre
    el JSON que se publica, se buscan las seis especies y se comparan sus cifras.

    Si algún día la norma vuelve a moverlas, esto se pone rojo **y hay que actualizarlo a mano**:
    es justo el momento en el que alguien tiene que mirar qué cambió, que es para lo que existe.
    """
    canario = [c for c in dataset.get("caladeros", []) if c.get("id") == CANARIO]
    if len(canario) != 1:
        return [f"el dataset no publica exactamente un caladero {CANARIO!r}"]
    por_nombre = {especie.get("nombreComun"): especie for especie in canario[0]["especies"]}
    fallos: list[str] = []
    for nombre, (vigente, derogada) in TRINQUETE_CANARIO.items():
        especie = por_nombre.get(nombre)
        if especie is None:
            fallos.append(f"{nombre}: ya no está en el caladero canario del dataset")
            continue
        talla = especie.get("talla", {})
        if talla == {"tipo": "longitud_cm", "cm": vigente}:
            continue
        if talla == {"tipo": "longitud_cm", "cm": derogada}:
            fallos.append(
                f"{nombre}: el dataset publica {derogada} cm, que es la redacción de 1995 "
                f"DEROGADA; la vigente desde el RD 936/2025 son {vigente} cm"
            )
        else:
            fallos.append(
                f"{nombre}: el dataset publica {talla}, y el trinquete esperaba {vigente} cm. Si la "
                "norma ha vuelto a cambiar, mira qué se movió antes de tocar este valor"
            )
    return fallos


# --------------------------------------------------------------------------------------------
# G4 · reconstrucción: las 118 cifras publicadas son las que dice la fuente
# --------------------------------------------------------------------------------------------

#: Las respuestas del BOE **capturadas** el día de la ingesta: ``metadatos``, ``texto/indice`` y los
#: tres bloques de anexo, byte a byte tal y como los sirve la API.
#:
#: Viven bajo ``tests/fixtures`` porque es donde se capturaron para los recorridos del parser, y
#: **no se duplican aquí a propósito**: dos copias de la misma fuente se desincronizan, y la que se
#: quedase vieja daría verde comparando el dataset contra una fuente que ya nadie mira. Que un gate
#: de producción lea de ``tests/`` es el precio de tener **una sola** copia de la fuente.
FUENTE_CAPTURADA = REPO_ROOT / "data" / "pipeline" / "tests" / "fixtures" / "boe"


def reconstruir_desde_fuente(
    origen: Path = FUENTE_CAPTURADA, *, hoy: dt.date | None = None
) -> dict[str, Any]:
    """Rehace el dataset entero desde la fuente capturada, **sin tocar la red**.

    Es el mismo camino que ``run.py normativa`` —los mismos parser, las mismas reglas de selección
    de versión y el mismo constructor— con la descarga sustituida por los ficheros capturados. El
    sello ``verificadoEn`` sale de ``hoy`` y lo pisa quien compare: esa fecha la escribe G2 y no la
    fuente.

    ``hoy`` manda sobre la **selección de versión** (la de mayor ``fecha_vigencia`` que no sea
    futura), así que por defecto es el día real: si la fuente capturada trajera una redacción con
    entrada en vigor futura, el día que entre en vigor este gate se pondrá rojo pidiendo regenerar,
    que es exactamente lo que hay que hacer ese día.
    """
    fecha = hoy or dt.datetime.now(dt.timezone.utc).date()
    metadatos = boe.leer_metadatos((origen / "metadatos.json").read_bytes())
    indice = boe.leer_indice((origen / "indice.json").read_bytes())
    anexos = tuple(
        boe.parsear_anexo(
            (origen / f"{bloque}.xml").read_bytes(),
            bloque=bloque,
            fecha_actualizacion=indice[bloque],
            hoy=fecha,
        )
        for bloque in boe.BLOQUES_DE_ANEXO
    )
    return construir_dataset(metadatos, anexos, verificado_en=fecha)


#: Cuántas diferencias se listan antes de callar. Un dataset regenerado de una fuente que cambió
#: difiere en cientos de campos y volcarlos todos esconde el primero, que es el que se lee.
TOPE_DE_DIFERENCIAS = 20


def _etiqueta(entrada: Any, indice: int) -> str:
    """Cómo se nombra una entrada de lista en el camino del error: por su nombre, no por su índice."""
    if isinstance(entrada, dict):
        nombre = entrada.get("id") or entrada.get("nombreComun") or entrada.get("marca")
        if nombre:
            return str(nombre)
    return str(indice)


def _diferencias(publicado: Any, esperado: Any, camino: str, fallos: list[str]) -> None:
    """Compara campo a campo y **nombra el camino** de cada diferencia."""
    if len(fallos) >= TOPE_DE_DIFERENCIAS:
        return
    if isinstance(esperado, dict) and isinstance(publicado, dict):
        for clave in sorted(set(esperado) | set(publicado)):
            if clave not in publicado:
                fallos.append(f"{camino}.{clave}: la fuente lo trae y el dataset publicado no")
            elif clave not in esperado:
                fallos.append(f"{camino}.{clave}: el dataset lo publica y la fuente no lo dice")
            else:
                _diferencias(publicado[clave], esperado[clave], f"{camino}.{clave}", fallos)
        return
    if isinstance(esperado, list) and isinstance(publicado, list):
        if len(esperado) != len(publicado):
            fallos.append(
                f"{camino}: el dataset publica {len(publicado)} entradas y la fuente da "
                f"{len(esperado)}"
            )
            return
        for indice, (uno, otro) in enumerate(zip(publicado, esperado, strict=True)):
            _diferencias(uno, otro, f"{camino}[{_etiqueta(otro, indice)}]", fallos)
        return
    if publicado != esperado:
        fallos.append(f"{camino}: el dataset publica {publicado!r} y la fuente dice {esperado!r}")


def errores_de_reconstruccion(
    dataset: dict[str, Any], origen: Path = FUENTE_CAPTURADA, *, hoy: dt.date | None = None
) -> list[str]:
    """Regenera el dataset desde la fuente capturada y lo compara con el que se publica.

    **Cubre las 118 cifras, las tres tablas y todo lo que las acompaña** —nombres, literales,
    notas, marcas, procedencias—, que es lo que G3 no puede hacer: el trinquete canario fija seis
    especies elegidas a mano y sigue siendo el gate específico de la selección de versión, pero la
    fila de al lado no la miraba nadie. Aquí no hay selección de qué vigilar: o el dataset es el
    que sale de la fuente, o no se publica.

    Lo que **no** hace, y por eso G2 sigue existiendo: preguntarle al BOE si la fuente capturada
    sigue siendo la de hoy. Este gate es offline y determinista —corre en CI sin red y dice lo
    mismo hoy que dentro de un año—; el de «¿ha cambiado la norma?» es diario y va contra la API.
    Juntar los dos haría que un mal día del BOE rompiera el build, que es justo el fallo que la
    rama ámbar de G2 existe para evitar.

    ``verificadoEn`` se excluye de la comparación **por definición**: lo escribe G2 el día que
    pregunta, no la fuente, y compararlo aquí pondría el gate en rojo cada mañana.
    """
    if not origen.is_dir():
        return [
            f"no está la fuente capturada ({origen}): sin ella no se puede comprobar que las "
            "cifras publicadas son las de la norma"
        ]
    try:
        esperado = reconstruir_desde_fuente(origen, hoy=hoy)
    except (boe.ErrorBoe, OSError, KeyError) as error:
        return [f"la fuente capturada ya no se puede leer con el parser de hoy: {error}"]
    esperado["fuente"]["verificadoEn"] = dataset.get("fuente", {}).get("verificadoEn")
    fallos: list[str] = []
    _diferencias(dataset, esperado, "$", fallos)
    if len(fallos) >= TOPE_DE_DIFERENCIAS:
        fallos.append(
            "… y más: la lista se corta en "
            f"{TOPE_DE_DIFERENCIAS}. Regenera el dataset con `python run.py normativa` y mira el "
            "diff entero"
        )
    return fallos


# --------------------------------------------------------------------------------------------
# G5 · rango sano
# --------------------------------------------------------------------------------------------

#: Los campos de ``talla`` que son una magnitud medible. Los otros dos —``segunNota`` y
#: ``motivo``— son texto y dicen por qué no hay número.
MAGNITUDES_DE_TALLA = ("cm", "kg")


def errores_de_rango(dataset: dict[str, Any]) -> list[str]:
    """Ninguna magnitud publicada puede ser cero ni negativa.

    No es una validación de tipos —de eso ya se ocupa G1 con las claves de cada clase— sino de
    **lectura**: un cero no se lee como una cifra rara, se lee como que **no hay mínimo**, y por ahí
    se cuela lo contrario de lo que la sección existe para decir. Un negativo ni siquiera es una
    magnitud. Las dos formas llegan hasta la página sin que nada se queje, porque la lectura
    defensiva de la web sólo exige que sea un número finito.

    Es un gate barato y de rango, no de valor: quién dice cuál es la cifra correcta es G4.
    """
    fallos: list[str] = []
    for caladero in dataset.get("caladeros", []):
        for especie in caladero.get("especies", []):
            talla = especie.get("talla")
            if not isinstance(talla, dict):
                continue
            etiqueta = f"{caladero.get('id', '?')} · {especie.get('nombreComun', '?')}"
            for campo in MAGNITUDES_DE_TALLA:
                if campo not in talla:
                    continue
                valor = talla[campo]
                if not isinstance(valor, (int, float)) or isinstance(valor, bool):
                    fallos.append(f"{etiqueta}: la talla publica {campo}={valor!r}, que no es un número")
                elif valor <= 0:
                    fallos.append(
                        f"{etiqueta}: la talla publica {campo}={valor}. Una talla mínima de cero o "
                        "negativa no se lee como un error: se lee como que esa especie no tiene "
                        "mínimo, que es lo contrario de lo que dice la norma"
                    )
    return fallos


# --------------------------------------------------------------------------------------------
# G2 · vigencia
# --------------------------------------------------------------------------------------------

#: Los tres desenlaces del gate diario, y son tres a propósito. Confundir «la fuente cambió» con
#: «no pude preguntar» significa o romper el despliegue cada vez que el BOE tenga un mal día, o
#: dejar pasar en silencio una derogación: son fallos opuestos y no pueden compartir color.
VIGENTE = "vigente"
CAMBIO = "cambio"
INCONSULTABLE = "inconsultable"


@dataclass(frozen=True)
class Verificacion:
    """Resultado del gate G2."""

    estado: str
    #: Frase publicable: lo que verá quien mire el job en rojo o en ámbar.
    motivo: str
    #: Diferencias medidas contra el dataset publicado, una por línea.
    diferencias: tuple[str, ...] = ()

    @property
    def sella(self) -> bool:
        """Sólo una comprobación que **pudo hacerse y salió bien** escribe ``verificadoEn``."""
        return self.estado == VIGENTE


def comparar_vigencia(
    dataset: dict[str, Any], metadatos: boe.Metadatos, indice: dict[str, str]
) -> Verificacion:
    """Compara el dataset publicado con lo que el BOE dice hoy.

    No descarga el texto ni lo diferencia: el sello ``fecha_actualizacion`` del bloque basta para
    saber que **hay que mirar**, y mirar es trabajo de una persona, no de este gate.
    """
    if not metadatos.vigente:
        return Verificacion(
            estado=CAMBIO,
            motivo=(
                f"{metadatos.identificador} ya no está vigente (estatus_derogacion="
                f"{metadatos.estatus_derogacion}, vigencia_agotada={metadatos.vigencia_agotada}): "
                "el portal está publicando tallas de una norma derogada"
            ),
        )
    diferencias: list[str] = []
    publicada = dataset.get("fuente", {}).get("fechaActualizacion", "")
    ahora = _iso(metadatos.fecha_actualizacion)
    if publicada != ahora:
        diferencias.append(
            f"la norma se consolidó de nuevo: el dataset publica {publicada or 'nada'} y el BOE "
            f"dice {ahora or 'nada'}"
        )
    for caladero in dataset.get("caladeros", []):
        bloque = caladero.get("bloque", "")
        publicado = caladero.get("fechaActualizacionBloque", "")
        vigente = _iso(indice.get(bloque, ""))
        if publicado != vigente:
            diferencias.append(
                f"el bloque {bloque} ({caladero.get('id', '?')}) cambió: el dataset publica "
                f"{publicado or 'nada'} y el BOE dice {vigente or 'nada'}"
            )
    if diferencias:
        return Verificacion(
            estado=CAMBIO,
            motivo=(
                "el texto consolidado ha cambiado desde la última ingesta: hay que regenerar el "
                "dataset y revisar qué cifras se movieron"
            ),
            diferencias=tuple(diferencias),
        )
    return Verificacion(
        estado=VIGENTE,
        motivo=(
            f"{metadatos.identificador} sigue en vigor y ni la norma ni los tres bloques de anexo "
            "han cambiado desde la ingesta"
        ),
    )
