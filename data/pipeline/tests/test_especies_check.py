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
* **La clave** no se lee, se recomputa del literal del nombre. Por eso hay dos sabotajes y no uno:
  repetir una clave (el caso real, `Thunnus Thynnus` colapsado sobre `Thunnus thynnus`) y teclear
  una que no salga del nombre, que no se repite con nadie y aun así deja de ser estable.
"""

from __future__ import annotations

import argparse
import copy
from typing import Any

import pytest

import run
from mareia_pipeline import especies, normativa
from mareia_pipeline.catalog import slugify


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
    assert "✓ las 86 claves salen del literal de la norma y ninguna se repite" in salida


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
# La clave · dos filas de la norma no acaban en una
# =====================================================================================


def test_la_clave_separa_las_dos_grafias_del_atun_que_escribe_la_norma() -> None:
    """El caso que obliga a que la clave lleve digest, medido sobre el artefacto publicado.

    El BOE escribe `Thunnus thynnus` en los Anexos I y II y `Thunnus Thynnus` en el III. Son dos
    filas del catálogo con sus tallas y sus caladeros, y **el mismo slug en minúsculas**: sin el
    digest, quien busca una encuentra siempre la primera.
    """
    dataset = especies.cargar()
    minusculas = _especie(dataset, "Thunnus thynnus")
    mayusculas = _especie(dataset, "Thunnus Thynnus")
    assert minusculas["clave"] != mayusculas["clave"]
    # Y el prefijo legible SÍ coincide, que es justo lo que hace falta que no baste.
    assert minusculas["clave"].rsplit("-", 1)[0] == mayusculas["clave"].rsplit("-", 1)[0]
    assert len({e["clave"] for e in dataset["especies"]}) == len(dataset["especies"])


def test_la_clave_no_depende_de_las_otras_filas_del_catalogo() -> None:
    """Es función sólo del nombre: quitar filas del dataset no le mueve la clave a nadie.

    Es la propiedad que no tiene un sufijo `-2` asignado al detectar la colisión, y la que impide
    que un `data-especie` cambie de sitio porque la norma haya ganado o perdido una especie.
    """
    antes = {e["nombreBoe"]: e["clave"] for e in especies.cargar()["especies"]}
    assert all(clave == especies.clave_de(nombre) for nombre, clave in antes.items())
    # Distinguir sólo por la caja sería apoyarse en una diferencia que cualquier `lower()` de
    # conveniencia borra; estas claves aguantan comparadas en minúsculas.
    assert len({clave.lower() for clave in antes.values()}) == len(antes)


def test_rojo_si_la_clave_colapsa_dos_grafias_de_la_norma(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """El sabotaje es **el slug en minúsculas**, que es la clave que esto vino a sustituir.

    No se edita ninguna fila a mano: se cambia **cómo** se construye la clave y se reconstruyen las
    86, que es la única forma en que esto pasaría de verdad. Las 86 siguen saliendo de su nombre
    —la recomputación se queda en verde y no es ella la que avisa— y aun así el atún del Anexo III
    y el de los Anexos I y II acaban en la misma fila.
    """
    monkeypatch.setattr(especies, "clave_de", slugify)
    dataset = _publicado()
    for especie in dataset["especies"]:
        especie["clave"] = especies.clave_de(especie["nombreBoe"])
    _con(monkeypatch, dataset)
    assert run.command_check(argparse.Namespace()) == 1
    salida = capsys.readouterr().err
    assert "✗ clave" in salida
    assert "comparten la clave 'thunnus-thynnus'" in salida
    assert "nadie puede distinguir" in salida


def test_rojo_si_la_clave_se_escribe_a_mano_en_vez_de_salir_del_nombre(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Una clave tecleada no se repite y tampoco es estable: el gate la recomputa, no la lee."""
    dataset = _publicado()
    _especie(dataset, "Alosa spp")["clave"] = "sabalos"
    _con(monkeypatch, dataset)
    assert run._check_especies() > 0
    assert "no se escribe" in capsys.readouterr().err


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


# =====================================================================================
# E5 · la talla legal publicada es la que dice la norma
# =====================================================================================


def test_e5_rojo_si_la_talla_del_catalogo_contradice_a_la_norma(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """El sabotaje que medía el agujero: la merluza a 12 cm en sus dos caladeros.

    Es el fallo que hacía falta cerrar y no un caso de laboratorio. Con esto puesto, el mismo
    `dist/` decía «Merluza … 12 cm, el BOE imprime "12"» en el índice y «Merluza … 27 cm» en la
    página de Vigo —dos superficies del mismo dato leyendo datasets distintos— con `run.py check`,
    `pnpm --filter web build` y `pnpm test` los tres en verde.

    El mensaje tiene que nombrar las cuatro cosas con las que se arregla: especie, caladero, cifra
    publicada y cifra de la norma. Un «hay una diferencia» obliga a buscarla a mano.
    """
    dataset = _publicado()
    for caladero in _especie(dataset, "Merluccius merluccius")["caladeros"]:
        for talla in caladero["tallas"]:
            talla["talla"]["cm"] = 12
            talla["textoOriginal"] = "12"
    _con(monkeypatch, dataset)
    assert run.command_check(argparse.Namespace()) == 1
    salida = capsys.readouterr().err
    assert "✗ E5 · talla: «Merluccius merluccius» · cantabrico-noroeste-y-golfo-de-cadiz" in salida
    assert "tallas[0].talla.cm: el catálogo publica 12 y la fuente dice 27" in salida
    assert (
        "«Merluccius merluccius» · mediterraneo.tallas[0].talla.cm: el catálogo publica 12 y la "
        "fuente dice 20"
    ) in salida


def test_e5_rojo_si_una_talla_pierde_la_medida_que_dice_de_que_es_la_cifra(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """`Nephrops norvegicus` publica 2 cm y 7 cm en el mismo caladero, y `medida` es lo único que
    dice que uno es longitud del cefalotórax y el otro longitud total.

    Sin ella la fila publica dos cifras juntas sin nada que las distinga, que se lee peor que una
    cifra mal: invita a quedarse con la pequeña. Por eso la reconstrucción compara la fila entera y
    no los campos que a alguien le parecieron los importantes.
    """
    dataset = _publicado()
    quitadas = 0
    for caladero in _especie(dataset, "Nephrops norvegicus")["caladeros"]:
        for talla in caladero["tallas"]:
            quitadas += talla.pop("medida", None) is not None
    assert quitadas == 4
    _con(monkeypatch, dataset)
    assert run.command_check(argparse.Namespace()) == 1
    salida = capsys.readouterr().err
    assert "«Nephrops norvegicus» · mediterraneo.tallas[0].medida" in salida
    assert "la fuente lo trae y el catálogo no lo publica" in salida


def test_e5_rojo_si_el_catalogo_le_inventa_un_caladero_a_una_especie(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """La otra forma de mentir con una talla: publicarla donde la norma no la fija.

    Una talla de más no contradice ninguna cifra —todas las publicadas serían correctas— y aun así
    dice que en ese caladero hay un mínimo que la norma no puso.
    """
    dataset = _publicado()
    especie = _especie(dataset, "Merluccius merluccius")
    inventado = copy.deepcopy(especie["caladeros"][0])
    inventado["id"] = "canarias"
    especie["caladeros"].append(inventado)
    _con(monkeypatch, dataset)
    assert run._check_especies() > 0
    assert "publica el caladero canarias y el RD 560/1995 no le fija talla ahí" in capsys.readouterr().err


def test_e5_no_mira_la_presencia_de_obis_porque_no_sale_del_boe() -> None:
    """El alcance del gate, dicho como afirmación y no sólo en el docstring.

    La presencia se pregunta a una API y no se puede rehacer sin red, así que E5 la deja fuera a
    propósito. Que viaje con su recorte y su frase de sesgo lo cubre `errores_de_presencia`; que
    un género no se pregunte como una especie, E3. Un gate con su alcance escrito vale; uno que
    aparente cubrir lo que no cubre es peor que no tenerlo.
    """
    dataset = _publicado()
    for especie in dataset["especies"]:
        for caladero in especie["caladeros"]:
            if caladero.get("presencia"):
                caladero["presencia"]["registros"] = 999999
    assert not especies.errores_de_tallas(dataset, normativa.cargar())


# =====================================================================================
# E6 · el taxón publicado es el que contestó WoRMS
# =====================================================================================


def test_e6_rojo_si_el_taxon_apunta_a_otra_especie_con_la_correspondencia_intacta(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """El sabotaje que medía el agujero, y ni siquiera hace falta tocar la correspondencia.

    `Conger conger` conserva su correspondencia `literal`/`worms` —o sea, E2 la da por buena, y
    hace bien: la decisión de con qué nombre preguntar sigue siendo la de la norma— y publica el
    AphiaID de la sardina. Antes de E6 esto dejaba `run.py check`, `pytest` y `pnpm test` en verde:
    de las 85 filas resueltas, ni el `aphiaId`, ni el `estado`, ni el `aceptado`, ni el `rango`, ni
    la `cita` tenían quien los contrastara.
    """
    dataset = _publicado()
    especie = _especie(dataset, "Conger conger")
    assert especie["correspondencia"]["tipo"] == "literal"
    especie["taxon"]["aphiaId"] = 126425
    especie["taxon"]["aceptado"] = {
        "aphiaId": 126425,
        "nombre": "Sardina pilchardus",
        "autoridad": "(Walbaum, 1792)",
    }
    _con(monkeypatch, dataset)
    assert run.command_check(argparse.Namespace()) == 1
    salida = capsys.readouterr().err
    assert (
        "✗ E6 · procedencia: «Conger conger» · taxon.aphiaId: el catálogo publica 126425 y la "
        "fuente dice 126285"
    ) in salida
    assert (
        "taxon.aceptado.nombre: el catálogo publica 'Sardina pilchardus' y la fuente dice "
        "'Conger conger'"
    ) in salida


@pytest.mark.parametrize(
    ("campo", "valor"),
    [
        ("estado", "accepted"),
        ("rango", "especie"),
        ("rangoWorms", "Species"),
        ("cita", "Mareia (2026). Se lo hemos preguntado a nadie."),
        ("url", "https://www.marinespecies.org/aphia.php?p=taxdetails&id=1"),
        ("autoridad", "(Nadie, 2026)"),
    ],
)
def test_e6_rojo_campo_a_campo_y_no_solo_en_el_aphiaid(campo: str, valor: str) -> None:
    """Los otros campos de la procedencia, uno por uno.

    `Trisopterus minutus capelanus` es una subespecie que WoRMS da por no aceptada: retocarle el
    estado o el rango la convierte en otra cosa taxonómica distinta sin tocar ningún identificador,
    y la `cita` es la atribución que la licencia de WoRMS obliga a publicar — una inventada no es
    un adorno roto, es atribuirle a la fuente algo que no ha dicho.
    """
    dataset = _publicado()
    especie = _especie(dataset, "Trisopterus minutus capelanus")
    assert especie["taxon"][campo] != valor
    especie["taxon"][campo] = valor
    fallos = especies.errores_de_procedencia(dataset)
    assert any(f"«Trisopterus minutus capelanus» · taxon.{campo}" in fallo for fallo in fallos)


def test_e6_rojo_si_se_publica_un_taxon_de_una_consulta_que_worms_no_contesta(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], tmp_path: Any
) -> None:
    """El 204 de WoRMS: cuando no encuentra nada responde **sin cuerpo**, y eso es un desenlace.

    Una fila que publique taxón resuelto contra una consulta que no devuelve nada está publicando
    una procedencia que la fuente no dio. La captura se sustituye por una donde esa respuesta está
    vacía, que es exactamente lo que habría en disco si WoRMS dejara de conocer ese nombre.
    """
    captura = tmp_path / "worms"
    captura.mkdir()
    for fichero in especies.FUENTE_WORMS_CAPTURADA.glob("*.json"):
        (captura / fichero.name).write_bytes(fichero.read_bytes())
    (captura / especies.fichero_de_captura("conger conger")).write_bytes(b"")
    monkeypatch.setattr(especies, "FUENTE_WORMS_CAPTURADA", captura)
    assert run._check_especies() > 0
    salida = capsys.readouterr().err
    assert "«Conger conger» · taxon.resuelto: el catálogo publica True y la fuente dice False" in salida
    assert "«Conger conger» · taxon.motivo: la fuente lo trae y el catálogo no lo publica" in salida
    assert "«Conger conger» · taxon.aphiaId: el catálogo lo publica y la fuente no lo dice" in salida


def test_e6_rojo_si_la_captura_no_trae_la_respuesta_de_una_fila(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], tmp_path: Any
) -> None:
    """Y no se da por bueno lo que no se puede comprobar: sin la respuesta, no hay verde.

    Es el modo de fallo barato de un gate que lee de disco —el fichero que falta— y el que más
    fácil pasa desapercibido, porque no hay ninguna diferencia que listar.
    """
    captura = tmp_path / "worms"
    captura.mkdir()
    for fichero in especies.FUENTE_WORMS_CAPTURADA.glob("*.json"):
        if fichero.name != especies.fichero_de_captura("merluccius merluccius"):
            (captura / fichero.name).write_bytes(fichero.read_bytes())
    monkeypatch.setattr(especies, "FUENTE_WORMS_CAPTURADA", captura)
    assert run._check_especies() > 0
    salida = capsys.readouterr().err
    assert "«Merluccius merluccius» publica un taxón que sale de preguntar «merluccius merluccius»" in salida
    assert "la captura no trae esa respuesta" in salida


def test_e6_rojo_si_falta_la_captura_entera(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], tmp_path: Any
) -> None:
    """Sin captura no hay nada que contrastar, y eso se cuenta como problema, no como verde."""
    monkeypatch.setattr(especies, "FUENTE_WORMS_CAPTURADA", tmp_path / "no-existe")
    assert run._check_especies() > 0
    assert "no está la captura de WoRMS" in capsys.readouterr().err


def test_e6_recomputa_la_consulta_en_vez_de_leerla_del_artefacto() -> None:
    """La consulta con la que se rehace el taxón sale de `correspondencia_de`, no del JSON.

    Si se leyera del artefacto, bastaría con reescribir `consultadoComo` para que el gate fuera a
    buscar la respuesta que le da la razón al taxón falseado. Aquí el `consultadoComo` cambiado es
    **una diferencia más**, no la instrucción de contra qué comparar.
    """
    dataset = _publicado()
    especie = _especie(dataset, "Conger conger")
    especie["correspondencia"]["consultadoComo"] = "sardina pilchardus"
    fallos = especies.errores_de_procedencia(dataset)
    assert any("correspondencia.consultadoComo" in fallo for fallo in fallos)
    assert "conger conger" in " ".join(fallos)


def test_e6_verde_sobre_el_artefacto_publicado() -> None:
    """Las 86 fichas se rehacen desde la captura y coinciden: el dato de hoy está bien.

    Se afirma aquí porque es la mitad que da sentido a los rojos de arriba: E5 y E6 son gates que
    faltaban sobre un dato correcto, no la corrección de un dato falso.
    """
    dataset = especies.cargar()
    assert not especies.errores_de_procedencia(dataset)
    assert not especies.errores_de_tallas(dataset, normativa.cargar())
    consultas = {
        especies.correspondencia_de(e["nombreBoe"]).consulta for e in dataset["especies"]
    }
    consultas.discard(None)
    assert len(consultas) == 82
    assert {f.name for f in especies.FUENTE_WORMS_CAPTURADA.glob("*.json")} == {
        especies.fichero_de_captura(consulta) for consulta in consultas
    }
