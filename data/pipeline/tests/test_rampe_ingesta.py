"""La ingesta de RAMPE lee el CRS que declara el fichero y aborta cuando no lo reconoce (P4).

**Sobre el fixture, y hay que decirlo antes que nada.** Los recorridos de ``sources.boe`` van
contra las respuestas reales capturadas byte a byte, y ahí eso se podía hacer. Aquí no: la fuente
son 54,8 MB de GeoJSON y no se commitean. El fixture de ``tests/fixtures/rampe`` es un **recorte**:
siete de las 86 áreas, elegidas a mano, con su bloque ``crs`` intacto y sus vértices **exactamente**
los de la fuente (los mismos ``float64``; el texto se re-serializa, así que no es un subconjunto de
bytes del original).

Lo que ese fixture garantiza y lo que no, para que nadie lea de más:

* **Garantiza** que el CRS se lee de verdad —los dos bloques ``crs`` son los de MITECO, uno por
  zona—, que las dos zonas se reproyectan cada una con la suya, que los agujeros de los polígonos
  sobreviven y que todos los caminos de aborto se recorren.
* **No garantiza** el censo (86 áreas, 1.076.504 vértices) ni ninguna cifra del derivado: eso vive
  en el artefacto publicado y lo comprueba ``run.py check``, no estos recorridos.

Los caminos de error usan GeoJSON sintético, construido deformando el fixture: son formas que RAMPE
**no** tiene hoy y hay que fabricarlas para poder verlas en rojo.
"""

from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path
from typing import Any

import pytest

from mareia_pipeline import utm
from mareia_pipeline.geo import haversine_km
from mareia_pipeline.sources import cache, rampe

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "rampe"

#: Lo que trae el recorte, medido contra la fuente el 2026-08-30: ``(áreas, vértices, EPSG)``.
RECORTE = {
    "Rampe_p.geojson": (4, 386, 25830),
    "Rampe_c.geojson": (3, 2009, 32628),
}


def crudo(fichero: str) -> dict[str, Any]:
    return json.loads(FIXTURES.joinpath(fichero).read_text(encoding="utf-8"))


def deformado(fichero: str, **cambios: Any) -> bytes:
    """El fixture con algo cambiado, para poder ver el camino de aborto que toca."""
    coleccion = crudo(fichero)
    coleccion.update(cambios)
    return json.dumps(coleccion, ensure_ascii=False).encode()


def zip_de(*ficheros: str) -> bytes:
    """Un ZIP como el de MITECO, montado con los ficheros del recorte que se le pidan."""
    buzon = io.BytesIO()
    with zipfile.ZipFile(buzon, "w", zipfile.ZIP_DEFLATED) as archivo:
        for fichero in ficheros:
            archivo.writestr(fichero, FIXTURES.joinpath(fichero).read_bytes())
    return buzon.getvalue()


# --------------------------------------------------------------------------------------------
# En verde
# --------------------------------------------------------------------------------------------


@pytest.mark.parametrize("fichero", sorted(RECORTE))
def test_cada_fichero_se_reproyecta_con_su_propio_crs(fichero: str) -> None:
    """La zona sale del ``crs`` del fichero, no de su nombre ni de una constante nuestra."""
    cuantas, vertices, epsg = RECORTE[fichero]
    areas = rampe.leer_coleccion(FIXTURES.joinpath(fichero).read_bytes(), fichero=fichero)
    assert len(areas) == cuantas
    assert sum(area.vertices for area in areas) == vertices
    assert {area.epsg for area in areas} == {epsg}
    assert {area.fichero for area in areas} == {fichero}


def test_las_dos_zonas_caen_donde_deben() -> None:
    """Las dos anclas del plan, esta vez saliendo de la ingesta entera y no de ``utm`` a pelo."""
    peninsular = rampe.leer_coleccion(
        FIXTURES.joinpath("Rampe_p.geojson").read_bytes(), fichero="Rampe_p.geojson"
    )
    canaria = rampe.leer_coleccion(
        FIXTURES.joinpath("Rampe_c.geojson").read_bytes(), fichero="Rampe_c.geojson"
    )
    assert peninsular[0].nombre == "Reserva marina de Cabo de Palos e Islas Hormigas"
    assert peninsular[0].poligonos[0][0][0] == pytest.approx((37.6604382, -0.6120267), abs=1e-7)
    assert canaria[0].nombre == "ZEPA Banco de la Concepción"
    # Canarias, no «continental-costera»: al norte de Lanzarote, no frente a la costa peninsular.
    latitud, longitud = canaria[0].poligonos[0][0][0]
    assert 29.0 < latitud < 31.5
    assert -14.0 < longitud < -12.0


def test_los_agujeros_de_los_poligonos_sobreviven() -> None:
    """Un área que rodea islas trae anillos interiores, y aplanarlos daría por protegida la tierra.

    Medido en el recorte: la reserva de Cabo de Palos es un polígono con **tres** anillos (contorno
    más dos islas) y el Área marina de la Isleta son **tres** polígonos con cinco anillos en total.
    """
    peninsular = rampe.leer_coleccion(
        FIXTURES.joinpath("Rampe_p.geojson").read_bytes(), fichero="Rampe_p.geojson"
    )
    canaria = rampe.leer_coleccion(
        FIXTURES.joinpath("Rampe_c.geojson").read_bytes(), fichero="Rampe_c.geojson"
    )
    cabo_de_palos = peninsular[0]
    assert len(cabo_de_palos.poligonos) == 1
    assert len(cabo_de_palos.poligonos[0]) == 3
    isleta = next(area for area in canaria if area.nombre == "Área marina de la Isleta")
    assert len(isleta.poligonos) == 3
    assert sum(len(poligono) for poligono in isleta.poligonos) == 5


def test_el_zip_da_las_areas_de_los_dos_ficheros() -> None:
    areas = rampe.leer_zip(zip_de(*RECORTE))
    assert len(areas) == sum(cuantas for cuantas, _, _ in RECORTE.values())
    assert {area.epsg for area in areas} == {25830, 32628}


def test_las_propiedades_publicables_llegan_enteras() -> None:
    areas = rampe.leer_zip(zip_de(*RECORTE))
    assert {area.tipo for area in areas} == {"RESERVA MARINA", "ZEC/AMP", "ZEPA", "ZEC"}
    assert all(area.nombre and area.codigo and area.tipo for area in areas)
    assert all(area.superficie_ha and area.superficie_ha > 0 for area in areas)
    # `OBJECTID` no se exige y esto dice por qué: los dos ficheros no lo llaman igual.
    assert "OBJECTID" in crudo("Rampe_p.geojson")["features"][0]["properties"]
    assert "OBJECTID_1" in crudo("Rampe_c.geojson")["features"][0]["properties"]


# --------------------------------------------------------------------------------------------
# P4 · en rojo
# --------------------------------------------------------------------------------------------


def test_p4_sin_crs_aborta() -> None:
    """Y aborta **a pesar** de que el RFC 7946 tendría un valor por defecto que aplicar.

    Es la decisión menos obvia del módulo: el estándar dice que un GeoJSON sin ``crs`` es WGS84 en
    grados, y aplicarlo aquí leería metros como grados sin dar ningún error. Cuando el valor por
    defecto del estándar es exactamente la suposición que arruina el dato, no se aplica.
    """
    sin_crs = crudo("Rampe_p.geojson")
    del sin_crs["crs"]
    with pytest.raises(rampe.ErrorRampe, match="no declara ningún CRS"):
        rampe.leer_coleccion(json.dumps(sin_crs).encode(), fichero="Rampe_p.geojson")


def test_p4_un_epsg_desconocido_aborta() -> None:
    """UTM 31N es una zona real, plausible en Cataluña, y no la sabemos reproyectar. Rojo."""
    cuerpo = deformado(
        "Rampe_p.geojson",
        crs={"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::25831"}},
    )
    with pytest.raises(rampe.ErrorRampe, match="No hay zona por defecto"):
        rampe.leer_coleccion(cuerpo, fichero="Rampe_p.geojson")


def test_p4_un_crs_sin_nombre_aborta() -> None:
    cuerpo = deformado("Rampe_p.geojson", crs={"type": "name", "properties": {}})
    with pytest.raises(rampe.ErrorRampe, match=r"properties\.name"):
        rampe.leer_coleccion(cuerpo, fichero="Rampe_p.geojson")


def test_p4_grados_con_un_crs_que_dice_metros_aborta() -> None:
    """El fichero declara una cosa y contiene otra: no se elige por nosotros cuál de las dos vale.

    Imita el modo de fallo verosímil de que MITECO republique la capa ya en WGS84 y se deje el
    bloque ``crs`` antiguo. El EPSG seguiría siendo conocido, así que la lectura del CRS daría
    verde, y reproyectar grados como metros manda las áreas al hemisferio equivocado.
    """
    coleccion = crudo("Rampe_p.geojson")
    coleccion["features"][0]["geometry"]["coordinates"] = [[[[-0.612, 37.660], [-0.611, 37.661]]]]
    with pytest.raises(rampe.ErrorRampe, match="cabe en un par longitud/latitud"):
        rampe.leer_coleccion(json.dumps(coleccion).encode(), fichero="Rampe_p.geojson")


def test_p4_lo_que_cae_fuera_de_la_ventana_aborta() -> None:
    """Y la red de disparates cazando uno: el fichero peninsular leído con la zona canaria.

    Sale a 23,2° oeste, en el Atlántico abierto al oeste de Canarias, y ahí no hay ninguna área de
    la red española.
    """
    cuerpo = deformado(
        "Rampe_p.geojson",
        crs={"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::32628"}},
    )
    with pytest.raises(rampe.ErrorRampe, match="fuera de la ventana"):
        rampe.leer_coleccion(cuerpo, fichero="Rampe_p.geojson")


def test_p4_no_alcanza_a_un_epsg_conocido_pero_equivocado() -> None:
    """**El límite del gate, escrito para que nadie lo suponga cubierto.**

    Al revés que el anterior: el fichero **canario** con el CRS peninsular. El EPSG es conocido, así
    que P4 lo acepta, y el resultado —29,73 N, 0,25 O— es el Mediterráneo frente a Alicante, dentro
    de la ventana y con toda la pinta de un dato bueno. Ninguna comprobación estructural puede verlo:
    lo único que lo caza es el ancla geográfica del gate P1, que sabe **dónde tiene que caer** un
    punto concreto. Ésta es la razón de que P1 tenga esa capa y no se conforme con las tres exactas.
    """
    cuerpo = deformado(
        "Rampe_c.geojson",
        crs={"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::25830"}},
    )
    areas = rampe.leer_coleccion(cuerpo, fichero="Rampe_c.geojson")
    latitud, longitud = areas[0].poligonos[0][0][0]
    assert (latitud, longitud) == pytest.approx((29.7322388, -0.2499390), abs=1e-7)
    assert rampe.VENTANA_LAT[0] < latitud < rampe.VENTANA_LAT[1]
    assert rampe.VENTANA_LON[0] < longitud < rampe.VENTANA_LON[1]
    # Y el ancla de P1 sí lo dice, que es lo que cierra el hueco: el mismo punto canario que la
    # ingesta acaba de dar por bueno cae a más de mil kilómetros de su puerto.
    ancla = next(a for a in utm.ANCLAS if a.epsg == 32628)
    lat_mala, lon_mala = utm.a_geograficas(ancla.este, ancla.norte, utm.PROYECCIONES[25830])
    assert haversine_km(lat_mala, lon_mala, ancla.lat_referencia, ancla.lon_referencia) > 1_000


def test_una_geometria_que_no_delimita_un_area_aborta() -> None:
    coleccion = crudo("Rampe_p.geojson")
    coleccion["features"][0]["geometry"] = {"type": "LineString", "coordinates": [[0, 0], [1, 1]]}
    with pytest.raises(rampe.ErrorRampe, match="Polygon o MultiPolygon"):
        rampe.leer_coleccion(json.dumps(coleccion).encode(), fichero="Rampe_p.geojson")


@pytest.mark.parametrize("campo", ["SITE_NAME", "SITE_CODE", "TIPO"])
def test_un_area_sin_nombre_codigo_o_tipo_aborta(campo: str) -> None:
    """Lo que hace útil el aviso es poder ir a buscar el área: sin esos tres no se publica."""
    coleccion = crudo("Rampe_p.geojson")
    del coleccion["features"][1]["properties"][campo]
    with pytest.raises(rampe.ErrorRampe, match=campo):
        rampe.leer_coleccion(json.dumps(coleccion).encode(), fichero="Rampe_p.geojson")


def test_una_coleccion_que_no_es_una_coleccion_aborta() -> None:
    with pytest.raises(rampe.ErrorRampe, match="FeatureCollection"):
        rampe.leer_coleccion(deformado("Rampe_p.geojson", type="Feature"), fichero="x.geojson")


def test_una_coleccion_vacia_aborta() -> None:
    with pytest.raises(rampe.ErrorRampe, match="ninguna feature"):
        rampe.leer_coleccion(deformado("Rampe_p.geojson", features=[]), fichero="x.geojson")


def test_medio_zip_no_es_media_red(monkeypatch: pytest.MonkeyPatch) -> None:
    """Publicar sólo el fichero que se pudo leer diría, en silencio, que Canarias no tiene áreas."""
    with pytest.raises(rampe.ErrorRampe, match=r"Rampe_c\.geojson"):
        rampe.leer_zip(zip_de("Rampe_p.geojson"))


def test_una_pagina_de_error_no_pasa_por_un_zip(monkeypatch: pytest.MonkeyPatch) -> None:
    """El 200 con HTML de MITECO, que es el modo de fallo medido de esta descarga.

    La ruta sin el segmento ``/rampe/`` redirige a ``/es/error/404.html``, que responde 200 con
    46.740 bytes de HTML. Sin esta comprobación eso se cachea como si fuera el ZIP y la avería
    aparece luego, lejos y sin relación aparente con la URL.
    """
    monkeypatch.setattr(cache, "fetch", lambda *_, **__: b"<!DOCTYPE HTML>\n<html lang='es'>")
    with pytest.raises(rampe.ErrorRampe, match="firma de un ZIP"):
        rampe.descargar()


def test_un_zip_ilegible_aborta_diciendolo() -> None:
    with pytest.raises(rampe.ErrorRampe, match="no se puede abrir"):
        rampe.leer_zip(b"PK\x03\x04 esto no es un zip")
