"""Los gates G1 (procedencia) y G3 (trinquete) sobre el **dataset publicado**.

Los dos se miden contra `data/normativa/tallas-minimas.json`, el fichero que se commitea y que
sirve la web, no contra la función que lo construye. Es deliberado y es la lección de T-13: un gate
que mide una copia del instrumento deja de morder en cuanto el instrumento cambia. Si mañana el
dataset se generase con otra herramienta, estos recorridos seguirían diciendo lo mismo.

Cada gate se prueba **en verde y en rojo**: se muta una copia del dataset publicado y se comprueba
que el gate la caza. Un gate que no se ha visto fallar no es cobertura, es decoración.
"""

from __future__ import annotations

import argparse
import copy
import json
from typing import Any

import pytest

import run
from mareia_pipeline import normativa


@pytest.fixture
def dataset() -> dict[str, Any]:
    """El dataset tal y como está commiteado."""
    return normativa.cargar()


@pytest.fixture
def copia(dataset: dict[str, Any]) -> dict[str, Any]:
    """Una copia que los recorridos en rojo pueden estropear sin tocar el fichero real."""
    return copy.deepcopy(dataset)


def especies(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    return [especie for caladero in dataset["caladeros"] for especie in caladero["especies"]]


# --------------------------------------------------------------------------------------------
# Lo que el dataset publica, medido
# --------------------------------------------------------------------------------------------


def test_el_dataset_publica_los_tres_caladeros_con_su_version_en_vigor(
    dataset: dict[str, Any],
) -> None:
    assert dataset["schema"] == "normativa/v1"
    assert [(c["id"], c["bloque"], c["fechaVigencia"]) for c in dataset["caladeros"]] == [
        ("cantabrico-noroeste-y-golfo-de-cadiz", "ani", "2025-11-02"),
        ("mediterraneo", "anii", "2025-11-02"),
        ("canario", "aniii", "2025-11-02"),
    ]
    assert all(c["normaModificadora"] == "BOE-A-2025-22024" for c in dataset["caladeros"])


def test_la_fuente_declara_licencia_y_aviso_de_autenticidad(dataset: dict[str, Any]) -> None:
    """Sólo el texto del BOE es auténtico, y el dataset tiene que decirlo donde viaja el dato."""
    fuente = dataset["fuente"]
    assert fuente["identificador"] == "BOE-A-1995-8639"
    assert fuente["eli"] == "https://www.boe.es/eli/es/rd/1995/04/07/560"
    assert "Ley 37/2007" in fuente["licencia"]
    assert fuente["aviso"] == "Solo el texto publicado en el BOE tiene carácter auténtico."
    assert fuente["verificadoEn"]


def test_el_reparto_de_clases_de_talla_es_el_medido(dataset: dict[str, Any]) -> None:
    """Las cifras del censo, fijadas: 118 tallas y 17 que no son un entero de centímetros."""
    reparto: dict[str, int] = {}
    for especie in especies(dataset):
        reparto[especie["talla"]["tipo"]] = reparto.get(especie["talla"]["tipo"], 0) + 1
    assert reparto == {
        "longitud_cm": 101,
        "peso_kg": 9,
        "por_determinar": 6,
        "longitud_o_peso": 1,
        "sin_dato_legible": 1,
    }


def test_toda_talla_conserva_el_literal_de_su_celda(dataset: dict[str, Any]) -> None:
    """En las cinco clases, sin excepción: es lo que permite comprobar la cifra contra el BOE."""
    sin_literal = [e["nombreComun"] for e in especies(dataset) if not e.get("textoOriginal")]
    assert sin_literal == []


def test_la_boga_del_anexo_i_sigue_publicandose_ilegible_y_no_corregida(
    dataset: dict[str, Any],
) -> None:
    """El ``1 1`` del BOE. Que este recorrido exista es la promesa de que nadie lo «arregló»."""
    cantabrico = dataset["caladeros"][0]
    boga = next(e for e in cantabrico["especies"] if e["nombreComun"] == "Boga")
    assert boga["textoOriginal"] == "1 1"
    assert boga["talla"]["tipo"] == "sin_dato_legible"
    assert "«1 1»" in boga["talla"]["motivo"]
    ilegibles = [
        e["nombreComun"] for e in especies(dataset) if e["talla"]["tipo"] == "sin_dato_legible"
    ]
    assert ilegibles == ["Boga"], (
        "sólo hay una celda ilegible en la fuente; si aparecen más, lo que ha cambiado es la forma "
        "de la tabla y el parser está dejando de leer cifras que sí están"
    )


def test_las_notas_viajan_pegadas_a_las_cifras_que_excepcionan(dataset: dict[str, Any]) -> None:
    """Nunca se publica un número al que le aplica una nota sin la nota.

    Resolverla por puerto exige saber la división CIEM de cada dársena —geometría, que T-19 no
    hace—, así que la excepción viaja visible: una excepción a la vista es honrada; un número
    seguro y equivocado, no.
    """
    cantabrico, mediterraneo, _ = dataset["caladeros"]
    lubina = next(e for e in cantabrico["especies"] if e["nombreComun"] == "Lubina")
    assert lubina["talla"] == {"tipo": "longitud_cm", "cm": 36}
    assert lubina["notas"] == ["(***)"]
    assert "44 centímetros" in {n["marca"]: n["texto"] for n in cantabrico["notas"]}["(***)"]
    pulpo = next(e for e in mediterraneo["especies"] if e["nombreComun"] == "Pulpo")
    assert pulpo["notas"] == ["(*)"]
    ligadas = sum(1 for e in especies(dataset) if e["notas"])
    assert ligadas == 9


def test_la_especie_multifila_se_publica_con_su_rotulo_y_sin_cabecera_vacia(
    dataset: dict[str, Any],
) -> None:
    """La cigala y el bogavante: ninguna cabecera se publica como especie con talla ausente."""
    hijas = [e for e in especies(dataset) if "medida" in e]
    assert [(e["nombreComun"], e["medida"], e["talla"]["cm"]) for e in hijas] == [
        ("Cigala (entera)", "Longitud cefalotórax", 2),
        ("Cigala (entera)", "Longitud total", 7),
        ("Bogavante", "Longitud cefalotórax", 8.5),
        ("Cigala", "Longitud cefalotórax", 2),
        ("Cigala", "Longitud total", 7),
    ]
    # Y ninguna cabecera se cuela como especie sin cifra: no hay filas con la talla vacía.
    assert all(e["talla"]["tipo"] != "por_determinar" for e in hijas)
    colas = next(e for e in especies(dataset) if e["nombreComun"] == "Cigalas (colas)")
    assert "medida" not in colas
    assert colas["talla"] == {"tipo": "longitud_cm", "cm": 3.7}


# --------------------------------------------------------------------------------------------
# G1 · procedencia
# --------------------------------------------------------------------------------------------


def test_g1_en_verde_toda_cifra_declara_bloque_vigencia_y_eli(dataset: dict[str, Any]) -> None:
    assert normativa.errores_de_procedencia(dataset) == []
    for especie in especies(dataset):
        assert set(especie["procedencia"]) == {"bloque", "fechaVigencia", "eli"}


def test_g1_en_rojo_una_cifra_sin_procedencia_no_pasa(copia: dict[str, Any]) -> None:
    """El gate **obliga a declarar**: una prohibición se satisface callando."""
    del copia["caladeros"][2]["especies"][0]["procedencia"]
    errores = normativa.errores_de_procedencia(copia)
    assert any("no declara procedencia" in error for error in errores)


def test_g1_en_rojo_una_fila_copiada_de_otro_anexo_no_pasa(copia: dict[str, Any]) -> None:
    """El error que nadie ve leyendo una tabla de ciento y pico filas."""
    copia["caladeros"][0]["especies"][0]["procedencia"]["bloque"] = "aniii"
    errores = normativa.errores_de_procedencia(copia)
    assert any("la procedencia dice bloque='aniii'" in error for error in errores)


def test_g1_en_rojo_una_talla_fuera_de_la_union_cerrada_no_pasa(copia: dict[str, Any]) -> None:
    """Ni un tipo inventado ni un campo de más: la unión es cerrada y el gate la cierra."""
    copia["caladeros"][0]["especies"][0]["talla"] = {"tipo": "aproximada", "cm": 30}
    copia["caladeros"][1]["especies"][0]["talla"]["default"] = 0
    errores = normativa.errores_de_procedencia(copia)
    assert any("no es de la unión cerrada" in error for error in errores)
    assert any("la unión declara" in error for error in errores)


def test_g1_en_rojo_una_especie_sin_literal_no_pasa(copia: dict[str, Any]) -> None:
    copia["caladeros"][1]["especies"][3]["textoOriginal"] = ""
    assert any(
        "no conserva el literal" in error for error in normativa.errores_de_procedencia(copia)
    )


def test_g1_en_rojo_una_nota_que_el_caladero_no_publica_no_pasa(copia: dict[str, Any]) -> None:
    copia["caladeros"][2]["especies"][0]["notas"] = ["(*)"]
    assert any(
        "que el caladero no publica" in error for error in normativa.errores_de_procedencia(copia)
    )


# --------------------------------------------------------------------------------------------
# G3 · trinquete de versión en vigor
# --------------------------------------------------------------------------------------------


def test_g3_en_verde_las_seis_especies_canarias_traen_su_talla_de_2025(
    dataset: dict[str, Any],
) -> None:
    """El hallazgo de la trayectoria, fijado sobre el artefacto publicado."""
    assert normativa.errores_de_trinquete(dataset) == []
    canario = next(c for c in dataset["caladeros"] if c["id"] == "canario")
    medidas = {e["nombreComun"]: e["talla"] for e in canario["especies"]}
    assert medidas["Aligote"] == {"tipo": "longitud_cm", "cm": 20}
    assert medidas["Cabrilla"] == {"tipo": "longitud_cm", "cm": 19}
    assert medidas["Cachucho"] == {"tipo": "longitud_cm", "cm": 22}
    assert medidas["Chopa"] == {"tipo": "longitud_cm", "cm": 23}
    assert medidas["Serrano imperial"] == {"tipo": "longitud_cm", "cm": 20}
    assert medidas["Pargo"] == {"tipo": "longitud_cm", "cm": 28}


@pytest.mark.parametrize(
    ("especie", "derogada"),
    [
        ("Aligote", 12),
        ("Cabrilla", 15),
        ("Cachucho", 18),
        ("Chopa", 19),
        ("Serrano imperial", 15),
        ("Pargo", 33),
    ],
)
def test_g3_en_rojo_cualquier_cifra_de_1995_que_llegue_al_dataset_lo_para(
    copia: dict[str, Any], especie: str, derogada: int
) -> None:
    """Cinco de las seis cifras derogadas son **menores** que la vigente: publicarlas multa."""
    canario = next(c for c in copia["caladeros"] if c["id"] == "canario")
    fila = next(e for e in canario["especies"] if e["nombreComun"] == especie)
    fila["talla"] = {"tipo": "longitud_cm", "cm": derogada}
    errores = normativa.errores_de_trinquete(copia)
    assert len(errores) == 1
    assert f"publica {derogada} cm, que es la redacción de 1995 DEROGADA" in errores[0]


def test_g3_en_rojo_si_una_de_las_seis_desaparece_del_dataset(copia: dict[str, Any]) -> None:
    canario = next(c for c in copia["caladeros"] if c["id"] == "canario")
    canario["especies"] = [e for e in canario["especies"] if e["nombreComun"] != "Chopa"]
    assert normativa.errores_de_trinquete(copia) == [
        "Chopa: ya no está en el caladero canario del dataset"
    ]


# --------------------------------------------------------------------------------------------
# Los gates están ENCHUFADOS al comando que corre CI, no sólo escritos
# --------------------------------------------------------------------------------------------


def test_check_pasa_con_el_dataset_publicado() -> None:
    assert run.command_check(argparse.Namespace()) == 0


def test_check_se_pone_rojo_con_una_cifra_derogada_y_con_una_procedencia_ausente(
    monkeypatch: pytest.MonkeyPatch, copia: dict[str, Any]
) -> None:
    """Se ataca el **comando**, no la función: probar la función y no el artefacto es el fallo
    que T-18 pagó. Si un día alguien desconecta el gate de `run.py check`, esto se pone rojo."""
    canario = next(c for c in copia["caladeros"] if c["id"] == "canario")
    next(e for e in canario["especies"] if e["nombreComun"] == "Aligote")["talla"] = {
        "tipo": "longitud_cm",
        "cm": 12,
    }
    del copia["caladeros"][0]["especies"][0]["procedencia"]
    monkeypatch.setattr(normativa, "cargar", lambda: json.loads(json.dumps(copia)))
    assert run.command_check(argparse.Namespace()) == 1
