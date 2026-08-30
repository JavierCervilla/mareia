"""Los gates E2 y E3 están **enchufados** a `run.py check`, y se ponen rojos desde ahí.

Que una función de gate devuelva errores y que `check` termine en rojo son dos cosas distintas, y la
segunda es la que le importa a CI: un gate perfecto que nadie llama da verde exactamente igual que
uno que no existe. Así que cada sabotaje se aplica **sobre el dataset publicado** —el artefacto, no
un doble— y se comprueba que el recuento de problemas sube y que el mensaje sale por stderr.

Los sabotajes están elegidos para llegar al sitio donde cada gate mira, que es lo que separa un
recorrido rojo de uno que se pone rojo por otro motivo:

* **E2** no mira si el campo `origen` existe: recomputa `consultadoComo` contra el nombre del BOE
  normalizado. Por eso los cuatro sabotajes son las cuatro formas de quitarle el dueño a un mapeo
  sin tocar esa comparación —cambiar el origen, rebajarlo a «literal», vaciarle el motivo y quitarle
  la marca de que la norma no dice eso—, y no «borrar un campo».
* **E3** no mira sólo el rango: recorre **todas** las cadenas de la ficha. Por eso hay un sabotaje
  que deja el rango intacto en «genero» y cuela el nombre de una especie por otro campo, que es
  exactamente el atajo que un gate de rango no vería.
"""

from __future__ import annotations

import argparse
import copy
from typing import Any

import pytest

import run
from mareia_pipeline import especies, normativa


def _publicado() -> dict[str, Any]:
    return copy.deepcopy(especies.cargar())


def _especie(dataset: dict[str, Any], nombre: str) -> dict[str, Any]:
    return next(e for e in dataset["especies"] if e["nombreBoe"] == nombre)


def _con(monkeypatch: pytest.MonkeyPatch, dataset: dict[str, Any]) -> None:
    monkeypatch.setattr(especies, "cargar", lambda *_, **__: dataset)


# =====================================================================================
# El verde, y lo que dice
# =====================================================================================


def test_el_check_entero_pasa_en_verde(capsys: pytest.CaptureFixture[str]) -> None:
    """El camino que corre CI, entero y sin red."""
    assert run.command_check(argparse.Namespace()) == 0
    salida = capsys.readouterr().out
    assert "✓ E2 · las 22 correspondencias que no salen de WoRMS" in salida
    assert "✓ E3 · las 15 filas «spp» (14 géneros)" in salida


def test_el_catalogo_publica_las_86_especies_del_boe() -> None:
    """Ni una más ni una menos: el catálogo lo fija la norma, no nosotros."""
    dataset = especies.cargar()
    assert sorted(e["nombreBoe"] for e in dataset["especies"]) == especies.nombres_del_boe(
        normativa.cargar()
    )
    assert dataset["resumen"]["especies"] == 86


def test_el_reparto_medido_contra_worms_es_el_que_se_publica() -> None:
    """Las cifras del plan, recontadas sobre el artefacto.

    64 nombres del BOE se preguntaron **tal cual** y los 64 resuelven; de esos, **10** resuelven a
    un nombre distinto del que usa la norma. Los otros 22 son las 15 filas de género, las 6 erratas
    que mapeamos firmando y la celda con dos especies que no se mapea.
    """
    dataset = especies.cargar()
    literales = [e for e in dataset["especies"] if e["correspondencia"]["tipo"] == "literal"]
    assert len(literales) == 64
    assert all(e["taxon"]["resuelto"] for e in literales)
    distintos = [e for e in literales if e["taxon"]["estado"] != "accepted"]
    assert len(distintos) == 10
    assert {e["nombreBoe"]: e["taxon"]["aceptado"]["aphiaId"] for e in distintos} == {
        "Dentex filosus": 273964,
        "Dentex macrophtalmus": 273965,
        "Dicologoglossa cuneata": 127154,
        "Engraulis encrasicholus": 126426,
        "Merlangus merlangus": 126438,
        "Mugil auratus": 1044127,
        "Psetta maxima": 127149,
        "Solea vulgaris": 127160,
        "Sparus auratus": 151523,
        "Trisopterus minutus capelanus": 712475,
    }
    reparto: dict[str, int] = {}
    for especie in dataset["especies"]:
        tipo = especie["correspondencia"]["tipo"]
        reparto[tipo] = reparto.get(tipo, 0) + 1
    assert reparto == {
        "literal": 64,
        "genero_de_spp": 15,
        "errata_de_la_norma": 6,
        "sin_correspondencia": 1,
    }


def test_el_nombre_del_boe_se_publica_literal_y_nunca_sustituido() -> None:
    """La primera de las tres reglas: el nombre con consecuencia legal va tal cual."""
    dataset = especies.cargar()
    del_boe = set(especies.nombres_del_boe(normativa.cargar()))
    for especie in dataset["especies"]:
        assert especie["nombreBoe"] in del_boe
    corregida = _especie(dataset, "Thunnus aibacares")
    assert corregida["nombreBoe"] == "Thunnus aibacares"
    assert corregida["taxon"]["nombreCientifico"] == "Thunnus albacares"


def test_la_celda_con_dos_especies_se_publica_sin_taxon_y_con_su_motivo() -> None:
    """Corregir una grafía no cambia nada; repartir una fila legal en dos decide un alcance."""
    rape = _especie(especies.cargar(), "Lophius piscatorius, L. Budegassa")
    assert rape["correspondencia"]["tipo"] == "sin_correspondencia"
    assert rape["correspondencia"]["consultadoComo"] is None
    assert "dos especies" in rape["correspondencia"]["motivo"]
    assert rape["taxon"]["resuelto"] is False
    assert all(caladero["presencia"] is None for caladero in rape["caladeros"])


# =====================================================================================
# E2 · el mapeo tiene dueño
# =====================================================================================


def test_e2_rojo_si_un_mapeo_nuestro_dice_venir_de_worms(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    dataset = _publicado()
    _especie(dataset, "Thunnus aibacares")["correspondencia"]["origen"] = "worms"
    _con(monkeypatch, dataset)
    assert run._check_especies() > 0
    assert "✗ E2 · mapeo" in capsys.readouterr().err


def test_e2_rojo_si_un_mapeo_nuestro_se_disfraza_de_literal(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """El disfraz completo: se rebaja a «literal» y se le pone el origen que le tocaría.

    Aquí es donde se ve que el gate recomputa: los campos quedan coherentes entre sí y lo único que
    no cuadra es que a WoRMS se le preguntó por «thunnus albacares» y la norma escribe otra cosa.
    """
    dataset = _publicado()
    correspondencia = _especie(dataset, "Thunnus aibacares")["correspondencia"]
    correspondencia.update(tipo="literal", origen="worms", laNormaNoDiceEso=False)
    _con(monkeypatch, dataset)
    assert run.command_check(argparse.Namespace()) == 1
    assert "no tiene dueño" in capsys.readouterr().err


def test_e2_rojo_si_el_mapeo_no_dice_por_que(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    dataset = _publicado()
    _especie(dataset, "Cáncer pagurus")["correspondencia"]["motivo"] = "   "
    _con(monkeypatch, dataset)
    assert run._check_especies() > 0
    assert "sin motivo" in capsys.readouterr().err


def test_e2_rojo_si_una_errata_no_avisa_de_que_la_norma_no_dice_eso(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    dataset = _publicado()
    _especie(dataset, "Panaeux kerathurus")["correspondencia"]["laNormaNoDiceEso"] = False
    _con(monkeypatch, dataset)
    assert run._check_especies() > 0
    assert "laNormaNoDiceEso" in capsys.readouterr().err


def test_e2_rojo_si_una_fila_se_apunta_una_decision_que_no_ha_tomado(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Sobrar también es mentir: marcar como nuestro lo que dice la norma diluye las marcas.

    Si todo va firmado, la firma deja de señalar nada, y las 22 correspondencias que de verdad
    decidimos nosotros se pierden entre las 86.
    """
    dataset = _publicado()
    correspondencia = _especie(dataset, "Thunnus thynnus")["correspondencia"]
    correspondencia.update(tipo="errata_de_la_norma", origen="mareia", motivo="porque sí")
    _con(monkeypatch, dataset)
    assert run._check_especies() > 0
    assert "no puede marcarse como decisión nuestra" in capsys.readouterr().err


def test_e2_rojo_si_una_errata_firmada_no_apunta_a_ningun_aphiaid(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    dataset = _publicado()
    _especie(dataset, "Microstommus kitt")["taxon"] = {"resuelto": False, "motivo": "lo que sea"}
    _con(monkeypatch, dataset)
    assert run._check_especies() > 0
    assert "no lleva a ninguna parte" in capsys.readouterr().err


# =====================================================================================
# E3 · el género no se convierte en especie
# =====================================================================================


def test_e3_rojo_si_una_fila_de_genero_publica_rango_especie(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    dataset = _publicado()
    _especie(dataset, "Alosa spp")["taxon"]["rango"] = "especie"
    _con(monkeypatch, dataset)
    assert run._check_especies() > 0
    assert "✗ E3 · género" in capsys.readouterr().err


def test_e3_rojo_si_al_genero_se_le_elige_una_especie(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """El atajo de verdad: `Lepidorhombus spp` son dos gallos y el BOE regula los dos."""
    dataset = _publicado()
    taxon = _especie(dataset, "Lepidorhombus spp")["taxon"]
    taxon["aceptado"] = {
        "aphiaId": 127146,
        "nombre": "Lepidorhombus whiffiagonis",
        "autoridad": None,
    }
    _con(monkeypatch, dataset)
    assert run._check_especies() > 0
    assert "Lepidorhombus whiffiagonis" in capsys.readouterr().err


def test_e3_rojo_aunque_la_especie_se_cuele_por_un_campo_que_nadie_mira(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Rango intacto, taxón intacto, y el nombre de una especie metido en el nombre común.

    Es el sabotaje que un gate «comprueba el rango» daría por bueno, y por eso E3 recorre todas las
    cadenas de la ficha en vez de una lista de campos elegida a mano.
    """
    dataset = _publicado()
    especie = _especie(dataset, "Venus spp")
    assert especie["taxon"]["rango"] == "genero"
    especie["nombresComunes"] = ["Chirla (Venus verrucosa)"]
    _con(monkeypatch, dataset)
    assert run.command_check(argparse.Namespace()) == 1
    assert "Venus verrucosa" in capsys.readouterr().err


def test_e3_rojo_si_la_presencia_del_genero_se_pregunta_por_una_especie(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """La presencia de un género tiene que ser la del género: preguntar por una especie la encoge."""
    dataset = _publicado()
    presencia = _especie(dataset, "Mullus spp")["caladeros"][0]["presencia"]
    presencia["consultadoComo"] = "Mullus barbatus"
    _con(monkeypatch, dataset)
    assert run._check_especies() > 0
    assert "en vez de como el género" in capsys.readouterr().err


def test_e3_no_se_traga_la_errata_spps_del_anexo_ii() -> None:
    """`Mugil spps` es una errata de la norma y sigue siendo una fila de género."""
    assert especies.es_genero("Mugil spps") == "Mugil"
    assert especies.es_genero("Mugil spp") == "Mugil"
    assert especies.es_genero("Mugil auratus") is None
    filas = especies.filas_de_genero(especies.cargar())
    assert len(filas) == 15
    assert len({especies.es_genero(f["nombreBoe"]) for f in filas}) == 14


def test_e3_no_confunde_la_autoridad_del_genero_con_una_especie() -> None:
    """`Alosa Linck, 1790` es la atribución que devuelve WoRMS, no un binomio.

    El epíteto de una especie va en minúscula: si el gate ignorara la caja, la propia cita de la
    fuente lo pondría en rojo y el rojo mandaría a arreglar lo que no está roto.
    """
    assert not especies.errores_de_genero(especies.cargar())
    cita = _especie(especies.cargar(), "Alosa spp")["taxon"]["cita"]
    assert "Alosa Linck, 1790" in cita


# =====================================================================================
# El resto del gate: cobertura y presencia
# =====================================================================================


def test_rojo_si_una_especie_desaparece_del_catalogo(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Una regeneración que pierda filas deja un dataset coherente consigo mismo y más corto."""
    dataset = _publicado()
    fuera = dataset["especies"].pop()
    _con(monkeypatch, dataset)
    assert run._check_especies() > 0
    assert fuera["nombreBoe"] in capsys.readouterr().err


def test_rojo_si_la_presencia_se_publica_sin_su_frase_de_sesgo(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Doce registros de dorada en Galicia no son doce doradas, y el número no viaja solo."""
    dataset = _publicado()
    _especie(dataset, "Sparus aurata")["caladeros"][0]["presencia"]["sesgo"] = ""
    _con(monkeypatch, dataset)
    assert run._check_especies() > 0
    assert "sin la frase de sesgo" in capsys.readouterr().err


def test_rojo_si_falta_el_dataset(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Y no se inventa un verde por no tener nada que mirar: se dice que falta y se cuenta."""
    monkeypatch.setattr(especies, "DATASET", especies.DATASET.with_name("todavia-no-existe.json"))
    assert run._check_especies() > 0
    assert "genéralo con" in capsys.readouterr().err


def test_la_ingesta_aborta_antes_de_escribir_si_un_mapeo_pierde_su_dueño(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """El subcomando con red, por el camino que no toca el disco ni la red.

    Es la garantía que hace segura la ingesta: un dataset con un mapeo sin firmar no llega ni al
    disco, así que el gate de CI no es la primera línea de defensa sino la última.
    """
    vacio = {"fuente": especies.cargar()["fuentes"]["boe"], "caladeros": []}
    monkeypatch.setattr(normativa, "cargar", lambda *_, **__: vacio)
    monkeypatch.setattr(especies, "errores_de_mapeo", lambda *_, **__: ["un mapeo sin dueño"])
    monkeypatch.setattr(especies, "volcar", lambda *_, **__: pytest.fail("no se debe escribir nada"))
    assert run.command_especies(argparse.Namespace(refresh=False)) == 1
