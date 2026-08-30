"""Los tres gates están **enchufados** a `run.py check`, y se ponen rojos desde ahí.

Que una función de gate devuelva errores y que `check` termine en rojo son dos cosas distintas, y
la segunda es la que le importa a CI. Un gate perfecto que nadie llama da verde exactamente igual
que uno que no existe, así que aquí se rompe cada uno por su lado y se comprueba que el recuento de
problemas sube.
"""

from __future__ import annotations

import argparse

import pytest

import run
from mareia_pipeline import areas, utm
from mareia_pipeline.sources import rampe


def test_check_entero_pasa_en_verde(capsys: pytest.CaptureFixture[str]) -> None:
    """El camino que corre CI, entero y sin red."""
    assert run.command_check(argparse.Namespace()) == 0
    salida = capsys.readouterr().out
    assert "✓ P1 · la inversa de Krüger" in salida
    assert "✓ P2 · las 86 áreas" in salida
    assert "✓ P4 · el CRS se lee de la fuente" in salida


def test_check_rojo_si_la_reproyeccion_se_desvia(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    original = utm._delta
    monkeypatch.setattr(utm, "_delta", lambda n: (original(n)[0] * 1.01, *original(n)[1:]))
    assert run._check_areas_protegidas() > 0
    assert "✗ P1 · reproyección" in capsys.readouterr().err


def test_check_rojo_si_el_gate_de_crs_deja_de_morder(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Abrir el mapa cerrado es justo lo que no se puede hacer, y esto lo dice en voz alta.

    Se simula el atajo tentador —«mete 4326, que total, WGS84 lo entiende todo el mundo»— y el gate
    lo caza: si un CRS en grados dejara de abortar, la ingesta reproyectaría grados como metros.
    """
    monkeypatch.setitem(
        utm.PROYECCIONES, 4326, utm.Proyeccion(4326, "WGS 84 (no es UTM)", 30, utm.WGS84)
    )
    assert run._check_areas_protegidas() > 0
    assert "✗ P4 · CRS" in capsys.readouterr().err


def test_check_rojo_si_se_cuela_geometria(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    con_geometria = areas.cargar()
    con_geometria["puertos"][0]["areas"][0]["coordinates"] = [[37.66, -0.61], [37.67, -0.62]]
    monkeypatch.setattr(areas, "cargar", lambda *_, **__: con_geometria)
    assert run._check_areas_protegidas() > 0
    assert "✗ P2 · geometría" in capsys.readouterr().err


def test_check_rojo_si_el_dataset_dice_venir_de_un_epsg_desconocido(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """El derivado tiene que poder decir de qué CRS salió, y ese CRS tiene que ser uno de los dos."""
    inventado = areas.cargar()
    inventado["fuente"]["censo"]["porEpsg"] = {"25829": 86}
    monkeypatch.setattr(areas, "cargar", lambda *_, **__: inventado)
    assert run._check_areas_protegidas() > 0
    assert "EPSG:25829" in capsys.readouterr().err


def test_check_rojo_si_falta_el_dataset(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Y no se inventa un verde por no tener nada que mirar: se dice que falta y se cuenta.

    El sustituto vive dentro del repositorio, no en un temporal, porque el mensaje del gate cita la
    ruta relativa a la raíz: es la misma forma que ya usa el gate de normativa.
    """
    monkeypatch.setattr(areas, "DATASET", areas.DATASET.with_name("todavia-no-existe.json"))
    assert run._check_areas_protegidas() > 0
    assert "genéralo con" in capsys.readouterr().err


def test_check_rojo_si_una_relacion_del_recorte_no_sale_de_la_geometria(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """**P6 enchufado al comando, y medido solo.**

    Se le quita a Cabo de Palos su reserva marina y se deja el resumen al día, que es la forma
    exacta del hallazgo H-2: el fichero queda internamente coherente y ni la cobertura ni la
    divergencia ni el gate de geometría tienen nada que decir. Se silencian los otros gates a
    propósito para que el rojo no pueda venir de ninguno de ellos: un gate al que nunca se le ve
    morder por su cuenta no es cobertura.
    """
    movido = areas.cargar()
    puerto = next(p for p in movido["puertos"] if p["slug"] == "cabo-de-palos")
    puerto["areas"] = [a for a in puerto["areas"] if a["codigo"] != "555552487"]
    movido["resumen"] = areas.resumen_de(movido["puertos"])
    monkeypatch.setattr(areas, "cargar", lambda *_, **__: movido)
    monkeypatch.setattr(areas, "errores_de_cobertura", lambda *_, **__: [])
    monkeypatch.setattr(areas, "errores_de_divergencia", lambda *_, **__: [])
    monkeypatch.setattr(areas, "errores_de_geometria", lambda *_, **__: [])
    assert run.command_check(argparse.Namespace()) == 1
    assert "✗ P6 · reconstrucción" in capsys.readouterr().err


def test_el_verde_de_p6_dice_cuanto_NO_cubre(capsys: pytest.CaptureFixture[str]) -> None:
    """Un gate parcial que no dice dónde acaba se lee como uno completo, y eso es peor que nada."""
    assert run._check_areas_protegidas() == 0
    salida = capsys.readouterr().out
    assert "✓ P6 · las 14 relaciones de las 7 áreas" in salida
    assert "NO cubre las otras 334 de 348" in salida


def test_check_rojo_si_falta_un_puerto_en_el_derivado(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    incompleto = areas.cargar()
    fuera = incompleto["puertos"].pop()
    monkeypatch.setattr(areas, "cargar", lambda *_, **__: incompleto)
    assert run._check_areas_protegidas() > 0
    assert fuera["slug"] in capsys.readouterr().err


def test_la_ingesta_aborta_antes_de_escribir_si_la_fuente_no_es_un_zip(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """El subcomando con red, por el camino que no toca el disco.

    Es la garantía que hace segura la ingesta: un ZIP que resultó ser una página de error revienta
    en la descarga, mucho antes de que nadie escriba nada en `data/geo`.
    """
    monkeypatch.setattr(rampe.cache, "fetch", lambda *_, **__: b"<!DOCTYPE HTML>")
    monkeypatch.setattr(
        areas, "volcar", lambda *_, **__: pytest.fail("no se debe escribir nada")
    )
    with pytest.raises(rampe.ErrorRampe):
        run.command_areas_protegidas(argparse.Namespace(refresh=False))
