"""Cada uno de los 153 puertos del catálogo declara su caladero, y es el suyo.

El recorrido central va **puerto a puerto y nombra al que falta**. Comprobar el recuento total
—«153 puertos tienen caladero»— daría verde con uno sin asignar y otro asignado dos veces, que es
justo el fallo que no se ve mirando un número.

La curación del Estrecho está documentada en `data/normativa/README.md`; aquí se fija para que no
se pueda cambiar sin que alguien lo vea.
"""

from __future__ import annotations

import json
from collections import Counter
from typing import Any

import pytest

from mareia_pipeline import normativa

CALADEROS = {
    normativa.CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ,
    normativa.MEDITERRANEO,
    normativa.CANARIO,
}


@pytest.fixture
def catalogo() -> dict[str, Any]:
    return json.loads(normativa.PORTS_JSON.read_text(encoding="utf-8"))


def test_ningun_puerto_del_catalogo_se_queda_sin_caladero(catalogo: dict[str, Any]) -> None:
    """El recorrido que falla **nombrando** al puerto, no contando cuántos hay."""
    sin_caladero = [p["slug"] for p in catalogo["ports"] if p.get("caladero") not in CALADEROS]
    assert sin_caladero == [], f"puertos sin caladero válido: {', '.join(sin_caladero)}"


def test_el_caladero_publicado_es_el_que_le_corresponde_a_cada_puerto(
    catalogo: dict[str, Any],
) -> None:
    """Se recomputa desde la provincia y la curación, no se cree lo que dice el fichero.

    Un gate que comparase la declaración con otra declaración del mismo autor no comprobaría nada:
    es la misma decisión de diseño que el gate del README de T-14A.
    """
    discrepancias = [
        (p["slug"], p["caladero"], normativa.caladero_de_puerto(p["slug"], p["province"]["slug"]))
        for p in catalogo["ports"]
        if p.get("caladero") != normativa.caladero_de_puerto(p["slug"], p["province"]["slug"])
    ]
    assert discrepancias == []
    assert normativa.errores_de_caladeros_de_puertos(catalogo) == []


def test_el_reparto_por_caladero_es_el_medido(catalogo: dict[str, Any]) -> None:
    reparto = Counter(p["caladero"] for p in catalogo["ports"])
    assert dict(reparto) == {
        normativa.MEDITERRANEO: 80,
        normativa.CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ: 47,
        normativa.CANARIO: 26,
    }
    assert sum(reparto.values()) == len(catalogo["ports"]) == 153


def test_las_dos_provincias_canarias_van_enteras_al_anexo_iii(catalogo: dict[str, Any]) -> None:
    canarios = [p for p in catalogo["ports"] if p["region"]["slug"] == "canarias"]
    assert len(canarios) == 26
    assert {p["caladero"] for p in canarios} == {normativa.CANARIO}


@pytest.mark.parametrize(
    ("slug", "caladero"),
    [
        # Al oeste de Punta Marroquí: golfo de Cádiz, Anexo I.
        ("sanlucar-de-barrameda", normativa.CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ),
        ("chipiona", normativa.CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ),
        ("rota", normativa.CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ),
        ("cadiz", normativa.CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ),
        ("chiclana-de-la-frontera", normativa.CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ),
        ("conil-de-la-frontera", normativa.CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ),
        ("barbate", normativa.CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ),
        # El caso frontera: Tarifa está *sobre* el límite y se resuelve al Atlántico.
        ("tarifa", normativa.CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ),
        # Al este: bahía de Algeciras, Anexo II.
        ("algeciras", normativa.MEDITERRANEO),
        ("san-roque", normativa.MEDITERRANEO),
        ("la-linea-de-la-concepcion", normativa.MEDITERRANEO),
        # Puerto fluvial del Guadalquivir, 80 km río arriba del golfo de Cádiz.
        ("seville", normativa.CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ),
        # Las plazas del norte de África y las provincias del sureste, sin curación.
        ("ceuta", normativa.MEDITERRANEO),
        ("melilla", normativa.MEDITERRANEO),
        ("malaga", normativa.MEDITERRANEO),
        ("motril", normativa.MEDITERRANEO),
        ("almunecar", normativa.MEDITERRANEO),
        ("adra", normativa.MEDITERRANEO),
        # Y el Atlántico gallego y cantábrico, que es el otro extremo del Anexo I.
        ("vigo", normativa.CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ),
        ("huelva", normativa.CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ),
        ("bilbao", normativa.CANTABRICO_NOROESTE_Y_GOLFO_DE_CADIZ),
    ],
)
def test_el_estrecho_esta_curado_puerto_a_puerto(
    catalogo: dict[str, Any], slug: str, caladero: str
) -> None:
    puerto = next(p for p in catalogo["ports"] if p["slug"] == slug)
    assert puerto["caladero"] == caladero


def test_toda_curacion_dice_su_motivo() -> None:
    """Una curación sin motivo escrito es una opinión que nadie puede revisar."""
    sin_motivo = [
        slug for slug, curado in normativa.CURACION_POR_PUERTO.items() if not curado.motivo.strip()
    ]
    assert sin_motivo == []
    assert "caso frontera" in normativa.CURACION_POR_PUERTO["tarifa"].motivo


def test_el_readme_documenta_las_doce_curaciones() -> None:
    """La curación se publica o no vale.

    El motivo vive en el código y **la decisión se publica en el README**, que es lo que lee quien
    quiera discutirla. Si alguien añade una curación y no la documenta, esto se pone rojo: el gate
    obliga a declarar, igual que G1 con la procedencia.
    """
    readme = (normativa.REPO_ROOT / "data" / "normativa" / "README.md").read_text(encoding="utf-8")
    sin_documentar = [slug for slug in normativa.CURACION_POR_PUERTO if slug not in readme]
    assert sin_documentar == [], f"curaciones sin documentar en el README: {sin_documentar}"


def test_una_provincia_sin_caladero_asignado_levanta_en_vez_de_elegir_uno() -> None:
    """En rojo: si mañana el catálogo trae un puerto de una provincia nueva, no se le asigna un
    caladero por defecto — se para el `build` y lo decide una persona."""
    with pytest.raises(normativa.ErrorCaladero, match="no tiene caladero asignado"):
        normativa.caladero_de_puerto("port-nuevo", "una-provincia-que-no-existe")


def test_una_curacion_que_ya_no_describe_a_su_puerto_levanta() -> None:
    """El slug es la llave de la curación; si el puerto cambia de provincia, la curación caduca."""
    with pytest.raises(normativa.ErrorCaladero, match="ya no describe a este puerto"):
        normativa.caladero_de_puerto("tarifa", "malaga")


def test_el_gate_de_caladeros_caza_el_puerto_al_que_le_falta_y_al_que_le_sobra() -> None:
    catalogo = {
        "ports": [
            {"slug": "vigo", "province": {"slug": "pontevedra"}},
            {"slug": "tarifa", "province": {"slug": "cadiz"}, "caladero": normativa.MEDITERRANEO},
            {"slug": "malaga", "province": {"slug": "malaga"}, "caladero": "atlantico-norte"},
        ]
    }
    errores = normativa.errores_de_caladeros_de_puertos(catalogo)
    assert errores == [
        "vigo: no declara caladero",
        "tarifa: declara 'mediterraneo' y le corresponde 'cantabrico-noroeste-y-golfo-de-cadiz'",
        "malaga: declara el caladero 'atlantico-norte', que no existe",
    ]
