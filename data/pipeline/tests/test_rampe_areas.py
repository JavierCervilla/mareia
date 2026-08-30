"""El derivado publica hechos y ninguna geometría (P2), y el que no tiene nada cerca lo dice.

Los recorridos van por dos caminos distintos a propósito:

* La **geometría** —distancia, punto en polígono, agujeros— se prueba con polígonos sintéticos de
  coordenadas redondas, porque lo que hay que poder afirmar ahí es un resultado exacto y calculado a
  mano, no «lo que salió». Un cuadrado de un grado de lado no se parece a un espacio marino, pero
  sus respuestas se pueden escribir antes de ejecutarlo.
* El **derivado y su gate** se prueban contra el fixture recortado de RAMPE y contra el artefacto
  publicado, que es donde P2 tiene que mirar: sobre el fichero de verdad y no sobre la intención del
  código que lo escribe.
"""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import Any

import pytest

from mareia_pipeline import areas
from mareia_pipeline.sources import rampe

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "rampe"

#: Un cuadrado de 1° de lado con un agujero de 0,2° en el centro, en (lat, lon).
CUADRADO = (
    ((0.0, 0.0), (0.0, 1.0), (1.0, 1.0), (1.0, 0.0), (0.0, 0.0)),
    ((0.4, 0.4), (0.4, 0.6), (0.6, 0.6), (0.6, 0.4), (0.4, 0.4)),
)


def area_sintetica(*poligonos: rampe.Poligono) -> rampe.Area:
    return rampe.Area(
        nombre="Área de prueba",
        codigo="ES-TEST",
        tipo="ZEC",
        superficie_ha=1.0,
        fichero="sintetico.geojson",
        epsg=25830,
        poligonos=poligonos,
    )


def catalogo_de(*puertos: tuple[str, float, float]) -> dict[str, Any]:
    return {
        "schema": "ports/v1",
        "ports": [{"slug": slug, "lat": lat, "lon": lon} for slug, lat, lon in puertos],
    }


def del_fixture() -> tuple[rampe.Area, ...]:
    return tuple(
        area
        for fichero in ("Rampe_p.geojson", "Rampe_c.geojson")
        for area in rampe.leer_coleccion(FIXTURES.joinpath(fichero).read_bytes(), fichero=fichero)
    )


# --------------------------------------------------------------------------------------------
# Geometría, con respuestas que se pueden calcular a mano
# --------------------------------------------------------------------------------------------


def test_un_punto_dentro_del_agujero_no_esta_dentro_del_area() -> None:
    """El caso que decide si la tierra que un espacio marino rodea sale como protegida."""
    area = area_sintetica(CUADRADO)
    assert areas.dentro_del_area(0.2, 0.2, area) is True
    assert areas.dentro_del_area(0.5, 0.5, area) is False, "el centro es el agujero"
    assert areas.dentro_del_area(2.0, 2.0, area) is False


def test_el_punto_en_poligono_mira_todos_los_poligonos() -> None:
    lejano = (((10.0, 10.0), (10.0, 11.0), (11.0, 11.0), (11.0, 10.0), (10.0, 10.0)),)
    area = area_sintetica(CUADRADO, lejano)
    assert areas.dentro_del_area(10.5, 10.5, area) is True


def test_la_distancia_es_al_vertice_y_no_al_borde() -> None:
    """Y por eso **aleja**: el punto está a 0,5° del borde y la distancia publicada es la del vértice.

    Es la aproximación declarada del módulo, medida aquí en un caso donde las dos cifras se pueden
    comparar: desde (0,5 · −1,0), el borde del cuadrado está a 1° de longitud y el vértice más
    cercano, a 1° de longitud **y** 0,5° de latitud. Sale mayor, que es el lado bueno.
    """
    area = area_sintetica((CUADRADO[0],))
    al_vertice = areas.distancia_al_vertice_mas_cercano(0.5, -1.0, area)
    al_borde = 111.195  # 1° de longitud en el ecuador, con el radio medio que usa `geo`
    assert al_vertice > al_borde
    assert al_vertice == pytest.approx(124.3, abs=0.1)


def test_el_descarte_por_caja_no_pierde_ninguna_area() -> None:
    """La poda tiene que ser una optimización y no un criterio: mismo resultado que sin ella.

    Se compara contra la fuerza bruta sobre el recorte entero y una rejilla de puntos que barre la
    España marítima, Canarias incluida. Una poda que se quedara corta borraría áreas del derivado
    sin que nada se pusiera rojo, que es la clase de fallo que este proyecto no comete dos veces.
    """
    indexadas = areas.indexar(del_fixture())
    todas = tuple(areas.AreaIndexada(area=i.area, caja=(-90.0, 90.0, -180.0, 180.0)) for i in indexadas)
    for latitud in [x / 2 for x in range(54, 90)]:
        for longitud in [x / 2 for x in range(-38, 12)]:
            podado = areas.vecindad_de(latitud, longitud, indexadas)
            bruto = areas.vecindad_de(latitud, longitud, todas)
            assert [v.area.codigo for v in podado] == [v.area.codigo for v in bruto], (
                latitud,
                longitud,
            )


# --------------------------------------------------------------------------------------------
# El derivado
# --------------------------------------------------------------------------------------------


def dataset_del_fixture(*puertos: tuple[str, float, float]) -> dict[str, Any]:
    return areas.construir_dataset(
        catalogo_de(*puertos),
        del_fixture(),
        descargado_en=dt.date(2026, 8, 30),
        sha256="0" * 64,
    )


def test_el_puerto_sin_areas_lo_dice_en_vez_de_faltar() -> None:
    """Es el requisito entero: un puerto sin nada cerca **está** en el fichero, con su motivo.

    Sin él, la página no puede distinguir «ninguna a menos de 30 km» —que es un dato, y dice hasta
    dónde hemos mirado— de «aquí no hay sección», que se lee como que no hay nada que saber.
    """
    dataset = dataset_del_fixture(("nadie", 43.5, -2.0))
    puerto = dataset["puertos"][0]
    assert puerto["slug"] == "nadie"
    assert puerto["areas"] == []
    assert "30 km" in puerto["motivo"]
    assert dataset["resumen"]["sinArea"] == 1


def test_el_puerto_con_areas_las_trae_ordenadas_y_sin_motivo() -> None:
    dataset = dataset_del_fixture(("cabo-de-palos", 37.6338, -0.696))
    puerto = dataset["puertos"][0]
    assert puerto["motivo"] is None
    assert [area["nombre"] for area in puerto["areas"]] == [
        "Reserva marina de Cabo de Palos e Islas Hormigas"
    ]
    area = puerto["areas"][0]
    assert area["tipo"] == "RESERVA MARINA"
    assert area["codigo"] == "555552487"
    assert area["distanciaAproxKm"] == pytest.approx(1.0, abs=0.05)
    assert area["dentro"] is False


def test_el_resumen_sale_del_contenido_y_no_se_puede_tocar() -> None:
    """Un resumen tecleado envejece en silencio, y es la parte del fichero que más se lee."""
    dataset = dataset_del_fixture(("cabo-de-palos", 37.6338, -0.696), ("nadie", 43.5, -2.0))
    assert dataset["resumen"] == {
        "puertos": 2,
        "conArea": 1,
        "sinArea": 1,
        "relaciones": 1,
        "reparto": {"1": 1},
    }
    dataset["resumen"]["relaciones"] = 99
    fallos = areas.errores_de_cobertura(
        dataset, catalogo_de(("cabo-de-palos", 37.6338, -0.696), ("nadie", 43.5, -2.0))
    )
    assert any("el resumen publicado dice" in fallo for fallo in fallos)


def test_un_puerto_que_falta_en_el_derivado_es_un_fallo() -> None:
    catalogo = catalogo_de(("cabo-de-palos", 37.6338, -0.696), ("nadie", 43.5, -2.0))
    dataset = dataset_del_fixture(("cabo-de-palos", 37.6338, -0.696))
    fallos = areas.errores_de_cobertura(dataset, catalogo)
    assert any("'nadie'" in fallo and "no podría decir" in fallo for fallo in fallos)


def test_una_lista_vacia_sin_motivo_es_un_fallo() -> None:
    catalogo = catalogo_de(("nadie", 43.5, -2.0))
    dataset = dataset_del_fixture(("nadie", 43.5, -2.0))
    dataset["puertos"][0]["motivo"] = None
    fallos = areas.errores_de_cobertura(dataset, catalogo)
    assert any("tampoco dice por qué" in fallo for fallo in fallos)


# --------------------------------------------------------------------------------------------
# P2 · en verde y en rojo, sobre el artefacto
# --------------------------------------------------------------------------------------------


def publicado() -> dict[str, Any]:
    if not areas.DATASET.exists():  # pragma: no cover - lo cubre `run.py check`
        pytest.skip("todavía no se ha generado data/geo/areas-protegidas.json")
    return areas.cargar()


def test_p2_en_verde_sobre_el_artefacto_publicado() -> None:
    dataset = publicado()
    assert areas.errores_de_geometria(dataset) == []
    assert "coordinates" not in areas.DATASET.read_text(encoding="utf-8")


def test_p2_caza_la_geometria_por_el_nombre_de_la_clave() -> None:
    dataset = publicado()
    dataset["puertos"][0]["areas"][0]["coordinates"] = "lo que sea"
    fallos = areas.errores_de_geometria(dataset)
    assert any("clave de geometría" in fallo for fallo in fallos)


def test_p2_caza_la_geometria_con_un_nombre_inocente() -> None:
    """La regla que importa: un anillo no entraría llamándose ``coordinates``, entraría disfrazado.

    Aquí se cuela con la clave ``trazado``, que no está ni puede estar en ninguna lista de palabras
    prohibidas. Lo caza la regla de forma: en este documento no hay ninguna lista de números, porque
    una coordenada, un anillo y una caja envolvente son exactamente eso.
    """
    dataset = publicado()
    dataset["puertos"][0]["areas"][0]["trazado"] = [37.66, -0.61, 37.67, -0.62]
    fallos = areas.errores_de_geometria(dataset)
    assert any("lista con 4 número(s) sueltos" in fallo for fallo in fallos)
    assert not any("clave de geometría" in fallo for fallo in fallos)


def test_p2_caza_la_geometria_que_esquiva_las_otras_dos_reglas() -> None:
    """Y la tercera: geometría metida como texto, con nombre inocente y sin ninguna lista.

    No la ve la regla de nombres ni la de forma. La ve el tope de bytes, que es la única de las tres
    que no depende de cómo venga disfrazada: en 2 kB no cabe un polígono de RAMPE.
    """
    dataset = publicado()
    poligono = " ".join(f"{37.66 + i / 1000:.5f},{-0.61 - i / 1000:.5f}" for i in range(200))
    dataset["puertos"][0]["notaTecnica"] = poligono
    fallos = areas.errores_de_geometria(dataset)
    assert any("tope por puerto" in fallo for fallo in fallos)
    assert not any("clave de geometría" in fallo or "sueltos" in fallo for fallo in fallos)


def test_p2_caza_un_dataset_que_engorda_entero() -> None:
    dataset = publicado()
    for puerto in dataset["puertos"]:
        puerto["relleno"] = "x" * 500
    fallos = areas.errores_de_geometria(dataset)
    assert any("la primera sospecha es geometría" in fallo for fallo in fallos)


def test_el_artefacto_publicado_reproduce_las_cifras_medidas() -> None:
    """Trinquete del derivado: las cifras que la trayectoria midió contra la fuente real.

    Si un cambio las mueve, el gate no dice «ajusta el umbral»: dice que hay que volver a medir y
    explicar por qué han cambiado.
    """
    dataset = publicado()
    assert dataset["resumen"] == {
        "puertos": 153,
        "conArea": 143,
        "sinArea": 10,
        "relaciones": 342,
        "reparto": {"1": 54, "2": 34, "3": 19, "4": 22, "5": 9, "6": 5},
    }
    assert dataset["fuente"]["censo"] == {
        "areas": 86,
        "verticesEnOrigen": 1_076_504,
        "porFichero": {"Rampe_c.geojson": 38, "Rampe_p.geojson": 48},
        "porEpsg": {"25830": 48, "32628": 38},
        "porTipo": {"AMP": 1, "RESERVA MARINA": 10, "ZEC": 32, "ZEC/AMP": 1, "ZEPA": 42},
    }


def test_los_diez_puertos_sin_area_estan_y_lo_dicen() -> None:
    """Los diez, por su nombre. Es el dato que el plan midió y el que más fácil desaparece."""
    dataset = publicado()
    sin_area = {puerto["slug"] for puerto in dataset["puertos"] if not puerto["areas"]}
    assert sin_area == {
        "alboraya",
        "arenys-de-mar",
        "donostia",
        "getaria",
        "mataro",
        "melilla",
        "sagunto",
        "seville",
        "silla",
        "valencia",
    }
    assert all(
        puerto["motivo"] for puerto in dataset["puertos"] if puerto["slug"] in sin_area
    )


def test_el_derivado_declara_su_licencia_y_su_aviso() -> None:
    """MITECO no declara condiciones de uso, y eso se publica tal cual en vez de inventar una."""
    fuente = publicado()["fuente"]
    assert fuente["licencia"] == "MITECO · RAMPE 2025 — condiciones de uso no declaradas en origen"
    assert "no autoriza a pescar" in fuente["aviso"]
    assert len(fuente["sha256"]) == 64


def test_el_artefacto_publicado_cubre_el_catalogo_entero() -> None:
    catalogo = json.loads(areas.PORTS_JSON.read_text(encoding="utf-8"))
    assert areas.errores_de_cobertura(publicado(), catalogo) == []


# --------------------------------------------------------------------------------------------
# El README dice las cifras del dato, no las que se tecleaon el día que se escribió
# --------------------------------------------------------------------------------------------

README = areas.REPO_ROOT / "data" / "geo" / "README.md"

#: Delimitadores del bloque de cifras, en el mismo estilo que el gate del README de la raíz (T-14A).
#: Se delimita a propósito: fuera del bloque la prosa tiene que poder hablar de una zona equivocada
#: o de un método descartado citando cifras que **no** son las del dataset.
BLOQUE = ("<!-- gate:areas-protegidas -->", "<!-- /gate:areas-protegidas -->")


def bloque_del_readme() -> str:
    texto = README.read_text(encoding="utf-8")
    inicio = texto.index(BLOQUE[0]) + len(BLOQUE[0])
    return texto[inicio : texto.index(BLOQUE[1])]


def miles(numero: int) -> str:
    """1076504 → ``1.076.504``: el separador de millares en español es el punto."""
    return f"{numero:,}".replace(",", ".")


def test_el_readme_publica_las_cifras_que_publica_el_dato() -> None:
    """Recomputa, no lee una declaración: si el dato cambia y el README no, esto se pone rojo.

    Es la lección de T-19 con nombre y apellidos —allí se coló un censo que no reproducía y costó
    una corrección pública—, aplicada aquí antes de que pase y no después.
    """
    dataset = publicado()
    resumen, censo = dataset["resumen"], dataset["fuente"]["censo"]
    bloque = bloque_del_readme()
    esperados = [
        f"**{censo['areas']}**",
        f"({censo['porFichero']['Rampe_p.geojson']} en `Rampe_p.geojson`, "
        f"{censo['porFichero']['Rampe_c.geojson']} en `Rampe_c.geojson`)",
        f"**{miles(censo['verticesEnOrigen'])}**",
        f"**{resumen['conArea']} de {resumen['puertos']}**",
        f"**{resumen['relaciones']}**",
        f"**{resumen['sinArea']}**",
        f"≤ {dataset['criterio']['radioKm']:.0f} km",
    ]
    for esperado in esperados:
        assert esperado in bloque, f"el README no dice {esperado!r}"
    # El orden de los tipos lo decide la legibilidad del README (de más a menos), así que el gate
    # comprueba los pares y no la fila entera: lo que tiene que coincidir es el hecho.
    for tipo, cuantas in censo["porTipo"].items():
        assert f"{cuantas} {tipo}" in bloque, f"el README no dice «{cuantas} {tipo}»"
    reparto = resumen["reparto"]
    fila = " · ".join(
        [f"{reparto['1']} puertos con 1 área"]
        + [f"{cuantos} con {cuantas}" for cuantas, cuantos in reparto.items() if cuantas != "1"]
    )
    assert fila in bloque, f"el reparto del README no es «{fila}»"


def test_el_readme_describe_el_recorte_que_hay() -> None:
    """Las cifras del fixture también se recalculan: un recorte que cambia deja el README viejo."""
    lote = del_fixture()
    texto = README.read_text(encoding="utf-8")
    por_fichero = {
        fichero: sum(1 for area in lote if area.fichero == fichero)
        for fichero in ("Rampe_p.geojson", "Rampe_c.geojson")
    }
    assert f"{len(lote)} de las 86 áreas" in texto
    assert (
        f"{por_fichero['Rampe_p.geojson']} de `Rampe_p` y {por_fichero['Rampe_c.geojson']} de "
        f"`Rampe_c`, {miles(sum(area.vertices for area in lote))} vértices"
    ) in texto
    for area in lote:
        assert area.codigo in texto, f"el README no dice de dónde sale {area.codigo}"

