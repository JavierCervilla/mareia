"""El gate F2 está **enchufado** a `run.py check`, y se pone rojo desde ahí.

Que una función de gate devuelva errores y que `check` termine en rojo son dos cosas distintas, y la
segunda es la que le importa a CI: un gate perfecto que nadie llama da verde igual que uno que no
existe. Así que cada sabotaje se aplica **sobre el dataset publicado** —el artefacto, no un doble—
y se comprueba que el recuento sube y que el motivo sale por `stderr`.

Los sabotajes están elegidos para **llegar al sitio donde F2 mira**, que es lo que separa un
recorrido rojo del recorrido rojo por otro motivo:

* **Cada campo del contrato, uno a uno.** Quitar `autor` y quitar `licenciaUrl` son dos fallos
  distintos —el primero deja de acreditar a una persona, el segundo deja de decir bajo qué
  condiciones se reutiliza— y los dos tienen que salir en rojo por separado. Vaciar un campo con
  `""` va aparte de borrarlo: un gate escrito con `in` se satisface con la cadena vacía.
* **La identificación no es nuestra**, así que hay un sabotaje que no borra nada y sólo cambia el
  dueño (`fuente: "Mareia"`), otro que cambia la propiedad de la que sale la imagen y otro que
  deja un ítem que nadie puede ir a mirar. Los tres dejan el JSON completo y bien formado.
* **El hueco tiene que llevar motivo**, así que se sabotea también por el otro lado: una especie
  que desaparece del fichero, una que aparece en los dos sitios y un `sinFoto` con el motivo vacío.
  Es la lección de los diez puertos sin área de T-21: un hueco mudo no se distingue de un olvido.
"""

from __future__ import annotations

import argparse
import copy
from typing import Any

import pytest

import run
from mareia_pipeline import especies, fotos


def _publicado() -> dict[str, Any]:
    return copy.deepcopy(fotos.cargar())


def _con(monkeypatch: pytest.MonkeyPatch, dataset: dict[str, Any]) -> None:
    monkeypatch.setattr(fotos, "cargar", lambda *_, **__: dataset)


def _una_foto(dataset: dict[str, Any]) -> dict[str, Any]:
    """La primera foto **con condiciones de licencia**, que es sobre la que se ceba cada sabotaje.

    No vale «la primera del fichero» desde que `licenciaUrl` es condicional: si el orden alfabético
    pusiera delante una foto de dominio público, los sabotajes que hablan de la URL de la licencia
    estarían cebándose sobre la única entrada que **no** tiene que traerla, y pasarían en verde por
    el motivo equivocado.
    """
    for entrada in dataset["fotos"].values():
        if entrada.get("licenciaCodigo") not in fotos.LICENCIAS_SIN_CONDICIONES:
            return entrada
    raise AssertionError("todas las fotos publicadas son de dominio público: revisa los sabotajes")


def _una_foto_de_dominio_publico(dataset: dict[str, Any]) -> dict[str, Any]:
    """La primera foto **sin condiciones**, que es la rama nueva del contrato."""
    for entrada in dataset["fotos"].values():
        if entrada.get("licenciaCodigo") in fotos.LICENCIAS_SIN_CONDICIONES:
            return entrada
    raise AssertionError(
        "ninguna foto publicada es de dominio público: o el dataset ha cambiado o la rama que "
        "estos recorridos vigilan ha dejado de existir"
    )


def _en_rojo(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    dataset: dict[str, Any],
    esperado: str,
) -> None:
    """Aplica el dataset saboteado y exige que `check` lo cace y lo diga."""
    _con(monkeypatch, dataset)
    assert run.command_check(argparse.Namespace()) > 0, (
        "el dataset saboteado pasó el check: el sabotaje no llega a donde el gate mira"
    )
    assert esperado in capsys.readouterr().err


# =====================================================================================
# El verde, y lo que dice
# =====================================================================================


def test_el_check_entero_pasa_en_verde(capsys: pytest.CaptureFixture[str]) -> None:
    """El camino que corre CI, entero y sin red."""
    assert run.command_check(argparse.Namespace()) == 0
    salida = capsys.readouterr().out
    assert "✓ F2 · las " in salida
    assert "publican autor y licencia" in salida


def test_el_dataset_publicado_respeta_el_contrato_congelado() -> None:
    """Los campos son **exactamente** los que fijó el plan, ni uno más.

    Existe por la lección de T-20: los dos carriles de aquella trayectoria divergieron en nueve
    campos y costó un ciclo entero de reconciliación. El contrato se congeló antes de escribir
    código precisamente para no repetirlo, así que añadir un campo «que no molesta» tiene que
    ponerse rojo aquí y discutirse, no aparecer en el JSON un martes.
    """
    dataset = fotos.cargar()
    assert set(dataset) == {"schema", "consultadoEn", "fotos", "sinFoto"}
    assert dataset["schema"] == fotos.SCHEMA
    for clave, entrada in dataset["fotos"].items():
        # `licenciaUrl` es el único campo condicional del contrato, y lo es en los dos sentidos:
        # obligatorio cuando la licencia tiene condiciones y **ausente** cuando no las tiene.
        esperados = {*fotos.CAMPOS_DE_FOTO, "identificadaPor"}
        if entrada.get("licenciaCodigo") not in fotos.LICENCIAS_SIN_CONDICIONES:
            esperados.add(fotos.CAMPO_LICENCIA_URL)
        assert set(entrada) == esperados, clave
        assert set(entrada["identificadaPor"]) == set(fotos.CAMPOS_DE_IDENTIFICACION), clave
    for clave, entrada in dataset["sinFoto"].items():
        assert set(entrada) == {"motivo"}, clave


def test_la_fecha_de_consulta_se_publica_a_la_vista() -> None:
    """Los metadatos se congelan el día de la ingesta: si mañana cambia la licencia en Commons, lo
    único que permite darse cuenta es saber de qué día es lo que publicamos."""
    assert fotos.cargar()["consultadoEn"].count("-") == 2


# =====================================================================================
# F2 · ninguna foto sin autor y sin licencia
# =====================================================================================


@pytest.mark.parametrize("campo", fotos.CAMPOS_DE_FOTO)
def test_una_foto_a_la_que_le_falta_un_campo_del_contrato_no_pasa(
    campo: str, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Borrar cualquiera de los seis campos pone F2 en rojo, y dice cuál falta."""
    dataset = _publicado()
    del _una_foto(dataset)[campo]
    _en_rojo(monkeypatch, capsys, dataset, f"sin «{campo}»")


@pytest.mark.parametrize("campo", ("autor", "licencia", "licenciaUrl"))
def test_un_campo_vaciado_tampoco_pasa(
    campo: str, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Vaciar no es distinto de borrar, y es lo que de verdad pasa en una migración descuidada.

    Va aparte del recorrido de arriba porque un gate escrito con `campo in entrada` da verde con la
    cadena vacía, y entonces la página publicaría una foto acreditada a nadie.
    """
    dataset = _publicado()
    _una_foto(dataset)[campo] = "   "
    _en_rojo(monkeypatch, capsys, dataset, f"sin «{campo}»")


def test_una_licencia_que_no_enlaza_a_sus_condiciones_no_pasa(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """`licenciaUrl` tiene que ser una URL: el nombre corto de la licencia no dice las condiciones.

    Medido en la muestra del plan: hay seis licencias distintas en doce ficheros, y una es una
    `CC BY-SA 3.0 de` de jurisdicción alemana. Con nombres tan parecidos, el enlace es lo único que
    distingue unas condiciones de otras.
    """
    dataset = _publicado()
    _una_foto(dataset)["licenciaUrl"] = "CC BY-SA 4.0"
    _en_rojo(monkeypatch, capsys, dataset, "que no es una URL")


def test_una_foto_de_dominio_publico_con_url_de_licencia_no_pasa(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """El dominio público no tiene condiciones, así que **no puede** traer URL de condiciones.

    La ausencia es obligatoria a propósito y no es una manía de forma: si en esta rama se admitiera
    una URL, la rama del dominio público sería el sitio exacto donde esconder una URL rota —nadie
    la comprobaría, porque «total, es dominio público»—. Y publicar unas condiciones donde no las
    hay es una afirmación falsa sobre lo que se puede hacer con la imagen.
    """
    dataset = _publicado()
    _una_foto_de_dominio_publico(dataset)["licenciaUrl"] = (
        "https://creativecommons.org/publicdomain/mark/1.0/"
    )
    _en_rojo(monkeypatch, capsys, dataset, "tiene que estar ausente")


def test_una_licencia_con_condiciones_sin_url_no_pasa_y_lo_dice_por_su_nombre(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """«Sin URL» no es un pase libre: sólo lo es para el allowlist de dominio público.

    Y el motivo tiene que decir **por qué** se exige aquí y no allí, que es lo único que impide que
    el siguiente que se lo encuentre lo arregle metiendo su licencia en el allowlist.
    """
    dataset = _publicado()
    foto = _una_foto(dataset)
    del foto[fotos.CAMPO_LICENCIA_URL]
    _en_rojo(monkeypatch, capsys, dataset, "que tiene condiciones")


def test_declararse_de_dominio_publico_no_borra_la_url_que_ya_estaba(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """El sabotaje que no borra nada: se cambia sólo el código de licencia.

    Es la forma barata de saltarse el contrato —«pongo `pd` y ya no me piden la URL»— y tiene que
    salir en rojo, porque el `licenciaCodigo` que se publica es el que dijo Commons, no el que nos
    venga bien.
    """
    dataset = _publicado()
    _una_foto(dataset)["licenciaCodigo"] = next(iter(fotos.LICENCIAS_SIN_CONDICIONES))
    _en_rojo(monkeypatch, capsys, dataset, "tiene que estar ausente")


def test_una_foto_sin_decir_quien_la_identifico_no_pasa(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Sin `identificadaPor`, la foto es una conjetura firmada por Mareia."""
    dataset = _publicado()
    del _una_foto(dataset)["identificadaPor"]
    _en_rojo(monkeypatch, capsys, dataset, "sin «identificadaPor»")


def test_apuntarse_la_identificacion_no_pasa(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """El sabotaje que no borra nada: el JSON queda completo y la afirmación es falsa.

    Quien decidió que esa foto es de ese animal fue Wikidata, y decirlo es la mitad de por qué la
    foto se puede publicar. Un gate que sólo exigiera que el campo exista se satisface aquí.
    """
    dataset = _publicado()
    _una_foto(dataset)["identificadaPor"]["fuente"] = "Mareia"
    _en_rojo(monkeypatch, capsys, dataset, "salen todas de «Wikidata»")


def test_cambiar_la_propiedad_de_la_que_sale_la_imagen_no_pasa(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """`P18` es una imagen vinculada al taxón; `P373` es una categoría de Commons.

    Decir que la foto sale de otra propiedad es decir que la identificación es otra: es el atajo
    que devolvería la búsqueda por texto con otro nombre.
    """
    dataset = _publicado()
    _una_foto(dataset)["identificadaPor"]["propiedad"] = "P373"
    _en_rojo(monkeypatch, capsys, dataset, "salen todas de «P18»")


def test_un_item_que_nadie_puede_ir_a_mirar_no_pasa(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Una cita que no se puede comprobar no es una cita."""
    dataset = _publicado()
    _una_foto(dataset)["identificadaPor"]["entidad"] = "el ítem del lubina"
    _en_rojo(monkeypatch, capsys, dataset, "que no es un ítem de Wikidata")


# =====================================================================================
# Ningún hueco mudo
# =====================================================================================


def test_una_especie_que_desaparece_del_fichero_no_pasa(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """El hueco mudo de T-21: sin foto **y** sin motivo, la ficha no puede decir por qué no la hay.

    Un dataset al que le falta una especie es internamente coherente y más corto, y ningún gate de
    forma lo nota: por eso la cobertura se recuenta contra el catálogo, que es quien fija las 86.
    """
    dataset = _publicado()
    clave = next(iter(dataset["fotos"]))
    del dataset["fotos"][clave]
    _en_rojo(monkeypatch, capsys, dataset, f"«{clave}» y el dataset de fotos no dice")


def test_un_hueco_sin_motivo_no_pasa(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """`sinFoto` sin motivo no se distingue de un olvido."""
    dataset = _publicado()
    dataset["sinFoto"][next(iter(dataset["sinFoto"]))]["motivo"] = ""
    _en_rojo(monkeypatch, capsys, dataset, "tampoco dice por qué")


def test_una_especie_en_los_dos_sitios_no_pasa(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Si una clave está en `fotos` y en `sinFoto`, nadie puede saber si tiene foto o no."""
    dataset = _publicado()
    clave = next(iter(dataset["fotos"]))
    dataset["sinFoto"][clave] = {"motivo": "da igual lo que ponga aquí"}
    _en_rojo(monkeypatch, capsys, dataset, "está a la vez en «fotos» y en «sinFoto»")


def test_una_foto_de_una_especie_que_no_regula_la_norma_no_pasa(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """El catálogo son las 86 del RD 560/1995: este dataset no añade especies por su cuenta."""
    dataset = _publicado()
    dataset["sinFoto"]["tiburon-blanco-000000"] = {"motivo": "no la regula ninguna norma española"}
    _en_rojo(monkeypatch, capsys, dataset, "que no está en el catálogo")


def test_borrar_el_objeto_sinfoto_no_es_una_forma_de_pasar_el_gate(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Quitar el sitio donde se dicen los motivos es lo contrario de arreglar los motivos."""
    dataset = _publicado()
    del dataset["sinFoto"]
    _en_rojo(monkeypatch, capsys, dataset, "es obligatorio aunque esté vacío")


# =====================================================================================
# El dataset publicado, contado sobre sí mismo
# =====================================================================================


def test_todas_las_especies_del_catalogo_estan_contadas() -> None:
    """Las 86 filas del catálogo están en un sitio y en uno solo."""
    dataset = fotos.cargar()
    catalogo = especies.cargar()
    claves = {e["clave"] for e in catalogo["especies"]}
    assert set(dataset["fotos"]) | set(dataset["sinFoto"]) == claves
    assert not set(dataset["fotos"]) & set(dataset["sinFoto"])
    assert len(dataset["fotos"]) + len(dataset["sinFoto"]) == len(claves)


def test_las_dos_ramas_de_la_licencia_existen_de_verdad_en_lo_publicado() -> None:
    """El dataset publica fotos **con** condiciones y fotos **sin** ellas, y cada una como toca.

    La premisa va en la misma aserción a propósito: el día en que el catálogo no publicara ninguna
    foto de dominio público, los tres sabotajes de la rama condicional dejarían de medir nada en
    silencio, y eso hay que verlo. Medido el 2026-08-30: 21 de dominio público y 57 con condiciones.
    """
    publicadas = fotos.cargar()["fotos"]
    sin_condiciones = {
        clave
        for clave, entrada in publicadas.items()
        if entrada["licenciaCodigo"] in fotos.LICENCIAS_SIN_CONDICIONES
    }
    assert sin_condiciones, "ninguna foto de dominio público: la rama condicional no se está midiendo"
    assert len(sin_condiciones) < len(publicadas), "todas de dominio público: falta la otra rama"
    for clave, entrada in publicadas.items():
        if clave in sin_condiciones:
            assert fotos.CAMPO_LICENCIA_URL not in entrada, clave
        else:
            assert entrada[fotos.CAMPO_LICENCIA_URL].startswith("http"), clave


def test_no_hay_una_licencia_de_las_fotos_sino_una_por_fichero() -> None:
    """La razón de que licencia y autor viajen dentro de cada entrada y no en un pie global.

    Si algún día el reparto fuera de una sola licencia, este recorrido se pondría rojo y habría que
    venir a mirarlo: sería la única circunstancia en la que un pie global no mentiría, y aun así el
    dataset no debería empezar a declararlo sin que alguien lo decida.
    """
    reparto = fotos.reparto_de_licencias(fotos.cargar())
    assert len(reparto) > 1, f"una sola licencia en todo el dataset: {reparto}"
    assert all(licencia.strip() for licencia in reparto)
