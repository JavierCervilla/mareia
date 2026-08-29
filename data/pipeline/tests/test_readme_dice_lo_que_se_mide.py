"""El README publica el reparto de licencias y las fuentes que el dataset **de verdad** usa.

Este es el gate de T-14A, y existe porque el README llevaba dos afirmaciones falsas sobre
exactamente aquello que el proyecto promete —que cada dato trae su fuente y su licencia—: decía que
el dataset «se publica bajo CC-BY 4.0» cuando dos tercios de los puertos son CC-BY-NC, y atribuía
las constantes a REDMAR y FES2022, de las que no sale ni un dato.

Dos decisiones de diseño, cada una pagada por una lección de esta épica:

1. **Recomputa, no lee una declaración.** Las cifras y el conjunto de fuentes salen de contar los
   JSON publicados de ``data/stations`` uno a uno, no de un campo resumen ni de un contador que el
   pipeline escriba: un gate que compara la declaración con otra declaración del mismo autor no
   comprueba nada. Si el dataset cambia y el README no, esto se pone en rojo.
2. **Obliga, no sólo prohíbe.** No basta con «no atribuyas lo que no usas», porque eso se satisface
   callando: el conjunto del README tiene que ser **exactamente** el medido. Sobrar es feo —una
   atribución es una afirmación de procedencia, y acreditar de más hace más difícil comprobar de
   dónde sale el dato que sí—; **faltar es la falta grave**, porque es usar un dato sin decir de
   quién es. Por eso son dos recorridos distintos con dos mensajes distintos: quien lo vea en rojo
   tiene que saber cuál de los dos le ha pasado.

El alcance del gate son los bloques delimitados con ``<!-- gate:... -->`` del README. Se delimitan a
propósito: fuera de ellos la prosa tiene que poder nombrar una fuente **descartada** con su motivo
(REDMAR, FES2022) sin que eso cuente como atribuirla.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

import pytest

from mareia_pipeline.schema import REPO_ROOT, station_files

README = REPO_ROOT / "README.md"
STATIONS_DIR = REPO_ROOT / "data" / "stations"

#: Nombre del bloque que lista las fuentes del dataset derivado.
SOURCES_BLOCK = "fuentes-del-dataset"

#: Nombre del bloque con el reparto de licencias.
LICENSES_BLOCK = "reparto-de-licencias"

_HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
_BACKTICKED = re.compile(r"`([^`]+)`")
_LICENSE_ROW = re.compile(r"^\|\s*`([^`]+)`\s*\|\s*(\d+)\s*\|", re.MULTILINE)


def _readme() -> str:
    return README.read_text(encoding="utf-8")


def _block(name: str) -> str:
    """El texto entre ``<!-- gate:name -->`` y su cierre, sin los comentarios HTML de dentro."""
    text = _readme()
    opening, closing = f"<!-- gate:{name} -->", f"<!-- /gate:{name} -->"
    assert opening in text and closing in text, (
        f"el README ya no tiene el bloque `{name}` delimitado por {opening} … {closing}. "
        "Borrar el bloque no es una forma de pasar el gate: es lo que el gate vigila."
    )
    body = text.split(opening, 1)[1].split(closing, 1)[0]
    return _HTML_COMMENT.sub("", body)


#: Los ficheros de puerto de ``data/stations`` (el schema no es un puerto).
STATION_PATHS = [p for p in sorted(STATIONS_DIR.glob("*.json")) if "schema" not in p.name]


def _station_documents() -> list[dict]:
    """Los puertos publicados en ``data/stations`` (el dataset del que habla el README)."""
    return [json.loads(path.read_text(encoding="utf-8")) for path in STATION_PATHS]


def _published_documents() -> list[dict]:
    """Todo documento ``station/v1`` publicado en el repo, ``data/brest`` incluido.

    El reparto de licencias habla de ``data/stations``, que es el dataset que el README describe,
    pero la obligación de atribuir no depende de en qué carpeta esté el fichero: para el conjunto de
    fuentes se miran todos.
    """
    return [json.loads(path.read_text(encoding="utf-8")) for path in station_files()]


def _measured_licenses() -> Counter[str]:
    return Counter(doc["source"]["primary"]["license"] for doc in _station_documents())


def _measured_sources() -> set[str]:
    return {
        attribution["name"]
        for doc in _published_documents()
        for attribution in doc["source"]["attribution"]
    }


def _declared_licenses() -> dict[str, int]:
    rows = _LICENSE_ROW.findall(_block(LICENSES_BLOCK))
    assert rows, "el bloque del reparto de licencias no tiene ninguna fila `licencia` | número"
    return {license_id: int(count) for license_id, count in rows}


def _declared_sources() -> set[str]:
    return set(_BACKTICKED.findall(_block(SOURCES_BLOCK)))


def test_los_bloques_que_el_gate_vigila_siguen_en_el_readme() -> None:
    assert _block(SOURCES_BLOCK).strip()
    assert _block(LICENSES_BLOCK).strip()


def test_el_reparto_de_licencias_del_readme_es_el_medido() -> None:
    """Cada cifra del README tiene que salir de contar los JSON, no de recordarla."""
    measured, declared = dict(_measured_licenses()), _declared_licenses()
    discrepancies = [
        f"`{license_id}`: el README dice {declared.get(license_id, '(nada)')} "
        f"y los JSON de data/stations dan {measured.get(license_id, 0)}"
        for license_id in sorted(set(measured) | set(declared))
        if measured.get(license_id, 0) != declared.get(license_id)
    ]
    assert not discrepancies, (
        "el reparto de licencias del README no es el del dataset publicado: "
        + " · ".join(discrepancies)
    )


def test_el_reparto_suma_todos_los_puertos_publicados() -> None:
    """Sin esto, añadir un puerto y no tocar la tabla dejaría el reparto callado y cuadrado."""
    declared = _declared_licenses()
    publicados = len(_station_documents())
    assert sum(declared.values()) == publicados, (
        f"el reparto del README suma {sum(declared.values())} puertos y en data/stations hay "
        f"{publicados}: falta alguna licencia en la tabla o alguna cifra está movida"
    )


def test_las_filas_del_reparto_van_de_mayor_a_menor() -> None:
    """La tabla se lee de arriba abajo: la primera fila tiene que ser la licencia mayoritaria."""
    counts = list(_declared_licenses().values())
    assert counts == sorted(counts, reverse=True), (
        f"las filas del reparto están desordenadas ({counts}): quien la lea por encima se llevará "
        "la impresión contraria a la que dicen las cifras"
    )


def test_el_readme_nombra_la_licencia_mayoritaria_que_se_ha_medido() -> None:
    """El titular en prosa también se recomputa: si el reparto se da la vuelta, la frase miente."""
    mayoritaria, _ = _measured_licenses().most_common(1)[0]
    frase = f"la mayoría de los puertos van con `{mayoritaria}`"
    assert frase in _readme(), (
        f"la licencia mayoritaria medida es `{mayoritaria}` y el README no lo dice: falta la frase "
        f"«{frase}». Es lo que hereda quien reutilice el dataset; enterrarlo en la tabla no basta"
    )


def test_al_readme_no_le_falta_ninguna_fuente_que_el_dataset_use() -> None:
    """La grave: usar un dato y no decir de dónde sale."""
    faltan = sorted(_measured_sources() - _declared_sources())
    assert not faltan, (
        "el dataset usa fuentes que el README NO atribuye: "
        + ", ".join(f"`{name}`" for name in faltan)
        + ". Es la falta grave de las dos: publicar un dato sin acreditar su procedencia"
    )


def test_al_readme_no_le_sobra_ninguna_fuente_que_el_dataset_no_use() -> None:
    """La otra: acreditar de más, que es ruido justo donde hay que poder comprobar la procedencia."""
    sobran = sorted(_declared_sources() - _measured_sources())
    assert not sobran, (
        "el README atribuye fuentes que NINGÚN dato del dataset usa: "
        + ", ".join(f"`{name}`" for name in sobran)
        + ". Una atribución es una afirmación de procedencia, no una lista de cortesía; si la "
        "fuente se evaluó y se descartó, va fuera del bloque y con su motivo"
    )


@pytest.mark.parametrize("path", STATION_PATHS, ids=lambda p: p.name)
def test_cada_puerto_declara_la_licencia_de_su_fuente_primaria(path: Path) -> None:
    """El reparto sólo se puede recomputar si el dato del que se recomputa está en cada fichero."""
    document = json.loads(path.read_text(encoding="utf-8"))
    assert document["schema"] == "station/v1"
    assert document["source"]["primary"]["license"]
