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
import math
from pathlib import Path
from typing import Any

import pytest

from mareia_pipeline import areas, utm
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


def test_la_distancia_al_borde_es_la_del_segmento_y_no_la_del_vertice() -> None:
    """El caso que se puede resolver a mano y contra el que se comprueba la fórmula.

    Desde (0,5 · −1,0) el lado oeste del cuadrado es el meridiano λ=0 entre las latitudes 0 y 1, así
    que la distancia al borde tiene forma cerrada: ``R · asin(cos φ · sin Δλ)`` = 111,1908 km, y el
    pie de la perpendicular cae dentro del lado. El vértice más cercano está a 124,31 km, porque
    para llegar a él hay que subir además medio grado de latitud.

    Los 13,1 km de diferencia son lo que la métrica vieja alejaba en un cuadrado de 1° de lado. En
    RAMPE, con aristas de 160 km, la diferencia llegaba a 42,2 km.
    """
    area = area_sintetica((CUADRADO[0],))
    al_borde, al_vertice = areas.distancias_a(0.5, -1.0, area)
    cerrada = 6371.0088 * math.asin(math.cos(math.radians(0.5)) * math.sin(math.radians(1.0)))
    assert al_borde == pytest.approx(cerrada, abs=1e-9)
    assert al_borde == pytest.approx(111.1908, abs=1e-4)
    assert al_vertice == pytest.approx(124.31, abs=0.01)
    assert areas.distancia_al_borde_km(0.5, -1.0, area) == al_borde


def test_una_arista_larga_es_donde_la_cota_por_vertice_perdia_el_area() -> None:
    """El hallazgo de T-21, reducido a un polígono que se puede leer.

    Un rectángulo cuyo lado sur va de (40 · 0) a (40 · 2) —**170,4 km de una sola arista**, que es
    del orden de la mayor de RAMPE— y un puerto a 0,2° al sur de su punto medio. El borde le pasa a
    22,7 km; el vértice más cercano está a 88,2 km. Con el radio de 30 km, medir al borde publica el
    área y medir al vértice la pierde entera, sin que nada se ponga rojo y sin que la página tenga
    forma de saberlo.
    """
    area = area_sintetica(
        (((40.0, 0.0), (40.0, 2.0), (40.5, 2.0), (40.5, 0.0), (40.0, 0.0)),)
    )
    al_borde, al_vertice = areas.distancias_a(39.8, 1.0, area)
    assert al_borde == pytest.approx(22.7, abs=0.05)
    assert al_vertice == pytest.approx(88.2, abs=0.05)
    indexadas = areas.indexar((area,))
    assert [v.area.codigo for v in areas.vecindad_de(39.8, 1.0, indexadas)] == ["ES-TEST"]
    assert al_vertice > areas.RADIO_KM, "la métrica vieja no habría publicado esta relación"


def test_el_borde_nunca_queda_mas_lejos_que_el_vertice() -> None:
    """La desigualdad que hace del gate de divergencia algo más que un umbral.

    El vértice **es** un punto del borde, así que la distancia al borde es menor o igual, siempre y
    para cualquier punto. Se barre el recorte entero de RAMPE con una rejilla que cubre la España
    marítima: si esta desigualdad se rompe en un solo punto, la distancia punto-segmento está mal.
    """
    for area in del_fixture():
        for latitud in [x / 2 for x in range(54, 90)]:
            for longitud in [x / 2 for x in range(-38, 12)]:
                al_borde, al_vertice = areas.distancias_a(latitud, longitud, area)
                assert al_borde <= al_vertice + 1e-9, (area.codigo, latitud, longitud)


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
    # Medido: 1,0328 km al borde, que aquí coincide con el vértice más cercano porque el punto más
    # próximo de la reserva **es** un vértice. Se publica 1,1 y no 1,0 porque la décima se redondea
    # hacia arriba: la página escribe «a menos de N km» y el redondeo tiene que empujar hacia el
    # lado en el que esa frase es verdad.
    assert areas.distancias_a(37.6338, -0.696, next(
        a for a in del_fixture() if a.codigo == "555552487"
    )) == pytest.approx((1.0328, 1.0328), abs=1e-4)
    assert area["distanciaAproxKm"] == 1.1
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


# --------------------------------------------------------------------------------------------
# P5 · las dos métricas, comparadas, y el gate que se entera si la fuente cambia de densidad
# --------------------------------------------------------------------------------------------


def dataset_de_la_arista_larga() -> dict[str, Any]:
    """Un derivado de un solo puerto y una sola área, con una arista de 170 km entre los dos.

    Es el caso de Pollença en miniatura: el borde a 22,7 km, el vértice más cercano a 88,2 km, el
    radio en 30 km. Vale para ver la comparativa contar una relación que **sólo** entra por el borde
    sin depender de que el fichero de 86 áreas siga diciendo lo que dice hoy.
    """
    area = area_sintetica(
        (((40.0, 0.0), (40.0, 2.0), (40.5, 2.0), (40.5, 0.0), (40.0, 0.0)),)
    )
    return areas.construir_dataset(
        catalogo_de(("puerto-de-la-arista", 39.8, 1.0)),
        (area,),
        descargado_en=dt.date(2026, 8, 30),
        sha256="0" * 64,
    )


def test_la_comparativa_cuenta_lo_que_cada_metrica_publicaria() -> None:
    dataset = dataset_de_la_arista_larga()
    comparativa = dataset["comparativa"]
    assert comparativa["relacionesPorBorde"] == 1
    assert comparativa["relacionesPorVertice"] == 0
    assert comparativa["entranSoloPorElBorde"] == 1
    assert comparativa["salenAlMedirElBorde"] == 0
    assert comparativa["bordeMasLejosQueVertice"] == 0
    assert comparativa["mayorDiferenciaKm"] == pytest.approx(65.4, abs=0.1)
    assert comparativa["aristaMaxM"] == pytest.approx(170_357.2, abs=1.0)
    assert comparativa["aristasDeMasDeUnKm"] == 4


def test_el_gate_de_divergencia_se_pone_rojo_por_los_dos_lados() -> None:
    """El rojo que importa, y su simétrico, sobre el caso de la arista larga.

    **Hacia arriba**: la fuente pierde densidad y la métrica vieja habría perdido más áreas todavía.
    **Hacia abajo**: alguien vuelve a medir al vértice y la divergencia se desploma a cero. Con un
    techo solo, esa vuelta atrás —que es el fallo que esta trayectoria acaba de arreglar— daría
    **verde**, y por eso el trinquete tiene dos lados. Los dos mensajes mandan a **medir**, no a
    mover el número, porque un umbral que se ajusta solo no es un gate.
    """
    dataset = dataset_de_la_arista_larga()
    assert areas.errores_de_divergencia(dataset, divergencia=1) == []
    arriba = areas.errores_de_divergencia(dataset, divergencia=0)
    assert len(arriba) == 1
    assert "1 relaciones entran sólo al medir el borde y lo medido son 0" in arriba[0]
    assert "Vuelve a medir y explica el cambio" in arriba[0]
    abajo = areas.errores_de_divergencia(dataset, divergencia=2)
    assert len(abajo) == 1
    assert "sólo 1 relaciones entran por el borde y lo medido son 2" in abajo[0]
    assert "vuelto a medirse al vértice" in abajo[0]


def test_el_gate_de_divergencia_caza_lo_que_la_aritmetica_prohibe() -> None:
    """Que una relación *salga* al medir el borde es imposible, así que no lleva umbral.

    El vértice es un punto del borde: la distancia al borde es menor o igual, siempre. Si la
    comparativa dice otra cosa, lo que está roto es la distancia punto-segmento, y el gate tiene que
    decir eso y no ofrecer un número que ajustar.
    """
    dataset = dataset_de_la_arista_larga()
    dataset["comparativa"]["salenAlMedirElBorde"] = 1
    dataset["comparativa"]["bordeMasLejosQueVertice"] = 3
    fallos = areas.errores_de_divergencia(dataset)
    assert any("No ajustes el umbral" in fallo for fallo in fallos)
    assert any("la distancia punto-segmento está mal" in fallo for fallo in fallos)


def test_el_gate_de_divergencia_caza_una_comparativa_de_otra_ejecucion() -> None:
    """Una comparativa que no cuadra con el resumen no dice nada de este fichero."""
    dataset = dataset_de_la_arista_larga()
    dataset["comparativa"]["relacionesPorBorde"] = 99
    assert any(
        "la comparativa no es de este fichero" in fallo
        for fallo in areas.errores_de_divergencia(dataset)
    )
    sin_bloque = {clave: valor for clave, valor in dataset.items() if clave != "comparativa"}
    assert any(
        "no publica el bloque `comparativa`" in fallo
        for fallo in areas.errores_de_divergencia(sin_bloque)
    )


def test_p5_en_verde_sobre_el_artefacto_publicado() -> None:
    assert areas.errores_de_divergencia(publicado()) == []


def test_el_artefacto_publicado_reproduce_la_divergencia_medida() -> None:
    """Las seis relaciones que la cota por vértice perdía, y la arista que las explica.

    No es un snapshot de comodidad: es la cifra que justifica el cambio de métrica de T-21 y la que
    tiene que moverse si RAMPE cambia de densidad de vértices.
    """
    comparativa = publicado()["comparativa"]
    assert comparativa["relacionesPorBorde"] == 348
    assert comparativa["relacionesPorVertice"] == 342
    assert comparativa["entranSoloPorElBorde"] == 6
    assert comparativa["salenAlMedirElBorde"] == 0
    assert comparativa["bordeMasLejosQueVertice"] == 0
    assert comparativa["mayorDiferenciaKm"] == 42.2
    assert comparativa["mayorDiferenciaEn"] == (
        "pollenca · Corredor de Migración de Cetáceos del Mediterráneo"
    )
    assert comparativa["aristaMaxM"] == 159_552.5
    assert comparativa["aristasDeMasDeUnKm"] == 728
    assert comparativa["entranSoloPorElBorde"] == areas.DIVERGENCIA_MEDIDA_RELACIONES


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
        "relaciones": 348,
        "reparto": {"1": 53, "2": 32, "3": 21, "4": 22, "5": 10, "6": 5},
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


def con_decimal(numero: float) -> str:
    """159552.5 → ``159.552,5``: punto de millar y coma decimal, como se escribe en castellano."""
    return f"{numero:,.1f}".replace(",", "\x00").replace(".", ",").replace("\x00", ".")


def test_el_readme_publica_las_cifras_que_publica_el_dato() -> None:
    """Recomputa, no lee una declaración: si el dato cambia y el README no, esto se pone rojo.

    Es la lección de T-19 con nombre y apellidos —allí se coló un censo que no reproducía y costó
    una corrección pública—, aplicada aquí antes de que pase y no después.
    """
    dataset = publicado()
    resumen, censo = dataset["resumen"], dataset["fuente"]["censo"]
    comparativa = dataset["comparativa"]
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
        # Y la comparativa de métricas, que es la cifra que justifica el cambio de T-21: si el
        # README la deja vieja dirá que la métrica anterior perdía menos de lo que perdía.
        f"**{comparativa['entranSoloPorElBorde']}** ({comparativa['relacionesPorVertice']} → "
        f"{comparativa['relacionesPorBorde']}), la mayor separación "
        f"{con_decimal(comparativa['mayorDiferenciaKm'])} km",
        f"**{con_decimal(comparativa['aristaMaxM'])} m**, y "
        f"{comparativa['aristasDeMasDeUnKm']} aristas de más de 1 km",
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



# --------------------------------------------------------------------------------------------
# P6 · reconstrucción desde la geometría capturada
# --------------------------------------------------------------------------------------------
#
# El gate que faltaba, y el eje que atraviesa dos hallazgos del pase adversario: el derivado se
# commitea y **nada en CI lo vuelve a derivar de la fuente**, así que todos los demás gates del
# artefacto miran coherencia interna y cualquier fichero coherente se publica. Los recorridos de
# abajo son las dos formas medidas de romperlo —una fila movida de puerto (H-2) y un derivado salido
# de una reproyección desviada (H-4)— más el alcance del gate, que se mide en vez de prometerse.

#: Una relación del recorte, elegida porque es la más cercana de las 14 y porque su área es la única
#: RESERVA MARINA del fixture: es la forma exacta del ataque H-2, que le quitaba a un puerto la
#: reserva que tenía a 0,1 km.
_PALOS = ("cabo-de-palos", "555552487")


def test_p6_en_verde_las_relaciones_del_recorte_salen_de_su_geometria() -> None:
    """Las 14 relaciones de las 7 áreas capturadas se rehacen y coinciden campo a campo."""
    catalogo = json.loads(areas.PORTS_JSON.read_text(encoding="utf-8"))
    assert areas.errores_de_reconstruccion(publicado(), catalogo) == []


def test_p6_dice_lo_que_cubre_y_lo_que_no_en_numeros() -> None:
    """El alcance es parte del gate, no una nota al pie.

    Un gate de reconstrucción que cubriera las 348 relaciones exigiría commitear los 54,8 MB de
    RAMPE. Éste cubre las de las 7 áreas del recorte, y esa cifra se **mide** aquí para que el día
    que el fixture crezca o encoja haya que venir a mirarla en vez de enterarse por el ✓.
    """
    alcance = areas.alcance_de_la_reconstruccion(publicado())
    assert alcance == {
        "areasCubiertas": 7,
        "areasEnLaFuente": 86,
        "relacionesCubiertas": 14,
        "relacionesPublicadas": 348,
    }
    # Y lo que NO cubre, dicho como lo que es: la mayor parte. 334 de 348.
    assert alcance["relacionesPublicadas"] - alcance["relacionesCubiertas"] == 334


def test_p6_en_rojo_si_una_relacion_desaparece_de_su_puerto() -> None:
    """H-2, sobre un área del recorte: el total se conserva y el gate lo caza igual.

    `errores_de_cobertura` recalcula el resumen desde el contenido, así que a un fichero al que le
    falte una relación y traiga el resumen al día no le ve nada; y `errores_de_divergencia` compara
    dos cifras que tampoco se mueven. Éste no compara el fichero consigo mismo.
    """
    catalogo = json.loads(areas.PORTS_JSON.read_text(encoding="utf-8"))
    copia = json.loads(json.dumps(publicado()))
    puerto = next(p for p in copia["puertos"] if p["slug"] == _PALOS[0])
    puerto["areas"] = [a for a in puerto["areas"] if a["codigo"] != _PALOS[1]]
    copia["resumen"] = areas.resumen_de(copia["puertos"])
    errores = areas.errores_de_reconstruccion(copia, catalogo)
    assert any("y el dataset no la publica" in error for error in errores), errores
    assert any(_PALOS[0] in error for error in errores), errores
    # Y el resto de la escalera, en verde: es lo que hace falta este gate.
    assert areas.errores_de_cobertura(copia, catalogo) == []
    assert areas.errores_de_geometria(copia) == []


def test_p6_en_rojo_si_a_un_puerto_le_aparece_un_area_que_no_tiene_cerca() -> None:
    """La otra mitad de H-2: la relación no se pierde, se le regala a otro puerto."""
    catalogo = json.loads(areas.PORTS_JSON.read_text(encoding="utf-8"))
    copia = json.loads(json.dumps(publicado()))
    origen = next(p for p in copia["puertos"] if p["slug"] == _PALOS[0])
    fila = next(a for a in origen["areas"] if a["codigo"] == _PALOS[1])
    destino = next(p for p in copia["puertos"] if p["slug"] == "vigo")
    destino["areas"] = sorted(
        [*destino["areas"], {**fila, "distanciaAproxKm": 28.0}],
        key=lambda area: area["distanciaAproxKm"],
    )
    copia["resumen"] = areas.resumen_de(copia["puertos"])
    errores = areas.errores_de_reconstruccion(copia, catalogo)
    assert any("la geometría de la fuente no la pone" in error for error in errores), errores


@pytest.mark.parametrize(
    ("campo", "plantado"),
    [("distanciaAproxKm", 0.4), ("dentro", True), ("tipo", "ZEPA")],
    ids=["distancia", "dentro", "figura"],
)
def test_p6_en_rojo_si_un_campo_de_una_relacion_no_es_el_que_da_la_geometria(
    campo: str, plantado: Any
) -> None:
    """Los cuatro campos que se leen en la página, no sólo que la fila esté.

    El `dentro` importa aparte: es la frase más fuerte que la sección sabe decir —«el punto de este
    puerto cae dentro de esta área»— y hasta ahora no había nada que lo atara a la geometría.
    """
    catalogo = json.loads(areas.PORTS_JSON.read_text(encoding="utf-8"))
    copia = json.loads(json.dumps(publicado()))
    puerto = next(p for p in copia["puertos"] if p["slug"] == _PALOS[0])
    next(a for a in puerto["areas"] if a["codigo"] == _PALOS[1])[campo] = plantado
    errores = areas.errores_de_reconstruccion(copia, catalogo)
    assert any(f".{campo}: el dataset publica" in error for error in errores), errores


def test_p6_en_rojo_con_el_elipsoide_desviado_255_metros(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """**H-4.** El derivado que sale de una constante mal copiada deja de cuadrar con la fuente.

    Se reproduce la equivocación del pase adversario: el semieje mayor del GRS80 pasa de
    6.378.137,0 m a 6.378.392,1 —255,1 m, un 0,004 %, el tamaño de una errata— y se reconstruye. El
    montaje va al revés que el ataque (allí se desviaba la ingesta y se comparaba con el código
    bueno; aquí se desvía el código y se compara con el artefacto bueno) y mide lo mismo: si las dos
    cosas no salen del mismo elipsoide, el gate lo dice.

    Medido: **8 de las 14** relaciones del recorte cambian de distancia. El gate P1 no ve nada —su
    cuadratura usa el mismo semieje, las invariantes de UTM no dependen de la escala, el punto de
    Snyder corre sobre Clarke 1866 y las anclas tienen 25 km de tolerancia—, y eso se comprueba aquí
    también: un rojo de P6 con P1 en verde es exactamente la situación que el hallazgo describe.
    """
    catalogo = json.loads(areas.PORTS_JSON.read_text(encoding="utf-8"))
    desviado = utm.Elipsoide("GRS80", 6_378_392.1, 1 / 298.257222101)
    monkeypatch.setitem(
        utm.PROYECCIONES, 25830, utm.Proyeccion(25830, "ETRS89 / UTM zona 30N", 30, desviado)
    )
    assert utm.errores_de_reproyeccion() == [], "P1 sigue en verde, que es la mitad del hallazgo"
    errores = areas.errores_de_reconstruccion(publicado(), catalogo)
    distancias = [error for error in errores if ".distanciaAproxKm:" in error]
    assert len(distancias) == 8, errores


def test_p6_en_rojo_si_falta_la_fuente_capturada(tmp_path: Path) -> None:
    """Sin fuente no se da un verde: un gate que no puede comparar no ha comparado nada."""
    catalogo = json.loads(areas.PORTS_JSON.read_text(encoding="utf-8"))
    errores = areas.errores_de_reconstruccion(publicado(), catalogo, tmp_path / "no-existe")
    assert errores and "no está la fuente capturada" in errores[0]
