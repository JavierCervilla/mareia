"""G2 · el gate diario de vigencia, con sus tres desenlaces y sus tres colores.

Lo que se prueba aquí no es «la función compara bien»: es que **el comando** distingue los tres
casos y que sólo uno de ellos escribe `verificadoEn`. La distinción es el gate entero:

* si «la fuente cambió» y «no pude preguntar» compartieran color, una caída del BOE rompería el
  despliegue de la web todos los días que el BOE tenga un mal día;
* si compartieran el color contrario, una derogación pasaría en silencio y el portal seguiría
  publicando tallas que ya no obligan a nadie.

`verificadoEn` sólo lo escribe una comprobación que **pudo hacerse y salió bien**. Tecleada, esa
fecha no diría nada; por eso no hay ningún camino que la escriba a mano.
"""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import json
import urllib.error
from pathlib import Path
from typing import Any

import pytest

import run
from mareia_pipeline import normativa
from mareia_pipeline.sources import boe

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "boe"

#: Lo que el BOE dice hoy, capturado el 2026-08-30: la norma vigente y los tres bloques de anexo
#: actualizados el 20251101.
METADATOS = boe.leer_metadatos(FIXTURES.joinpath("metadatos.json").read_bytes())
INDICE = boe.leer_indice(FIXTURES.joinpath("indice.json").read_bytes())


@pytest.fixture
def dataset() -> dict[str, Any]:
    return normativa.cargar()


def derogada() -> boe.Metadatos:
    ficha = dataclasses.replace(METADATOS, estatus_derogacion="S")
    assert not ficha.vigente
    return ficha


def test_en_verde_la_norma_sigue_en_vigor_y_nada_ha_cambiado(dataset: dict[str, Any]) -> None:
    resultado = normativa.comparar_vigencia(dataset, METADATOS, INDICE)
    assert resultado.estado == normativa.VIGENTE
    assert resultado.sella
    assert resultado.diferencias == ()


def test_en_rojo_si_la_norma_esta_derogada(dataset: dict[str, Any]) -> None:
    resultado = normativa.comparar_vigencia(dataset, derogada(), INDICE)
    assert resultado.estado == normativa.CAMBIO
    assert not resultado.sella
    assert "ya no está vigente" in resultado.motivo


def test_en_rojo_si_un_bloque_de_anexo_ha_cambiado(dataset: dict[str, Any]) -> None:
    """El sello del bloque basta para saber que hay que mirar: no hace falta diferenciar el texto."""
    movido = dict(INDICE, aniii="20270301")
    resultado = normativa.comparar_vigencia(dataset, METADATOS, movido)
    assert resultado.estado == normativa.CAMBIO
    assert not resultado.sella
    assert any("el bloque aniii (canario) cambió" in d for d in resultado.diferencias)


def test_en_rojo_si_la_norma_se_ha_vuelto_a_consolidar(dataset: dict[str, Any]) -> None:
    resultado = normativa.comparar_vigencia(
        dataset, dataclasses.replace(METADATOS, fecha_actualizacion="20270101T000000Z"), INDICE
    )
    assert resultado.estado == normativa.CAMBIO
    assert any("se consolidó de nuevo" in d for d in resultado.diferencias)


def test_el_sello_solo_lo_escribe_sellar_verificacion(dataset: dict[str, Any]) -> None:
    sellado = normativa.sellar_verificacion(dataset, dt.date(2027, 3, 1))
    assert sellado["fuente"]["verificadoEn"] == "2027-03-01"
    assert dataset["fuente"]["verificadoEn"] != "2027-03-01", "no debe mutar el original"


# --------------------------------------------------------------------------------------------
# El comando, que es lo que corre el job diario
# --------------------------------------------------------------------------------------------


class Espia:
    """Recoge lo que el comando habría escrito, para no tocar el dataset del repositorio."""

    def __init__(self) -> None:
        self.escrito: list[dict[str, Any]] = []

    def volcar(self, dataset: dict[str, Any]) -> None:
        self.escrito.append(dataset)


def preparar(
    monkeypatch: pytest.MonkeyPatch,
    *,
    metadatos: boe.Metadatos | None = None,
    indice: dict[str, str] | None = None,
    fallo: Exception | None = None,
) -> Espia:
    espia = Espia()
    dataset = normativa.cargar()

    def descargar_metadatos(**_: Any) -> boe.Metadatos:
        if fallo is not None:
            raise fallo
        return metadatos or METADATOS

    def descargar_indice(**_: Any) -> dict[str, str]:
        if fallo is not None:
            raise fallo
        return indice or INDICE

    monkeypatch.setattr(run.boe, "descargar_metadatos", descargar_metadatos)
    monkeypatch.setattr(run.boe, "descargar_indice", descargar_indice)
    monkeypatch.setattr(run.normativa, "cargar", lambda: json.loads(json.dumps(dataset)))
    monkeypatch.setattr(run.normativa, "volcar", espia.volcar)
    return espia


def test_el_comando_sella_verificadoen_cuando_la_norma_sigue_igual(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    espia = preparar(monkeypatch)
    assert run.command_verificar_normativa(argparse.Namespace()) == 0
    hoy = dt.datetime.now(dt.timezone.utc).date().isoformat()
    assert [d["fuente"]["verificadoEn"] for d in espia.escrito] == [hoy]


def test_el_comando_sale_rojo_y_no_sella_si_la_fuente_ha_cambiado(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    espia = preparar(monkeypatch, indice=dict(INDICE, ani="20270301"))
    assert run.command_verificar_normativa(argparse.Namespace()) == 1
    assert espia.escrito == [], "una fuente que ha cambiado no puede sellarse como verificada"


def test_el_comando_sale_rojo_y_no_sella_si_la_norma_esta_derogada(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    espia = preparar(monkeypatch, metadatos=derogada())
    assert run.command_verificar_normativa(argparse.Namespace()) == 1
    assert espia.escrito == []


@pytest.mark.parametrize(
    "fallo",
    [
        urllib.error.URLError("temporary failure in name resolution"),
        urllib.error.HTTPError("https://www.boe.es/", 503, "Service Unavailable", {}, None),  # type: ignore[arg-type]
        TimeoutError("timed out"),
    ],
    ids=["sin DNS", "BOE caído", "timeout"],
)
def test_el_comando_sale_ambar_cuando_no_se_puede_preguntar(
    monkeypatch: pytest.MonkeyPatch, fallo: Exception
) -> None:
    """Ámbar, código 2: `verificadoEn` **no se toca** y la página degrada sola al envejecer.

    Es la distinción que evita que una caída del BOE rompa el deploy. Si esto devolviera 1, el
    portal se quedaría sin desplegar cada vez que la fuente tenga un mal rato; si devolviera 0,
    sellaríamos como verificada una comprobación que no llegó a hacerse.
    """
    espia = preparar(monkeypatch, fallo=fallo)
    assert run.command_verificar_normativa(argparse.Namespace()) == 2
    assert espia.escrito == []
