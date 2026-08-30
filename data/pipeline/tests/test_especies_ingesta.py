"""La ingesta de WoRMS y de OBIS, por los caminos que no tocan la red.

Los tres modos de fallo que estos recorridos existen para impedir están medidos contra las fuentes
el 2026-08-30 y ninguno da error por su cuenta:

1. **WoRMS contesta 204 sin cuerpo cuando no encuentra**, no 404. Un cliente que mire 200/404 y haga
   `json.loads` del cuerpo vacío revienta con un error que no se parece en nada a «esa especie no
   está» — y no está pasa 22 veces de 86 en el catálogo del BOE.
2. **Un espacio de más convierte un nombre válido en un 204** (`thunnus  thynnus` → 204), así que la
   normalización no es cosmética.
3. **`yearrange` viene `[null, null]`** cuando no hay ni un registro en el recorte. Publicarlo como
   cero sería publicar el año cero.
"""

from __future__ import annotations

import json
from typing import Any

import pytest

from mareia_pipeline.sources import obis, worms

#: Respuesta real de WoRMS a `thunnus thynnus`, recortada a los campos que el módulo lee.
ATUN_ROJO: dict[str, Any] = {
    "AphiaID": 127029,
    "url": "https://www.marinespecies.org/aphia.php?p=taxdetails&id=127029",
    "scientificname": "Thunnus thynnus",
    "authority": "(Linnaeus, 1758)",
    "status": "accepted",
    "unacceptreason": None,
    "rank": "Species",
    "valid_AphiaID": 127029,
    "valid_name": "Thunnus thynnus",
    "valid_authority": "(Linnaeus, 1758)",
    "citation": "Froese, R. and D. Pauly. Editors. (2026). FishBase. Thunnus thynnus (Linnaeus, 1758).",
}

#: Respuesta real a `solea vulgaris`: la norma nombra un sinónimo y WoRMS dice a qué remite.
LENGUADO: dict[str, Any] = {
    **ATUN_ROJO,
    "AphiaID": 158796,
    "scientificname": "Solea vulgaris",
    "status": "unaccepted",
    "unacceptreason": "synonym",
    "valid_AphiaID": 127160,
    "valid_name": "Solea solea",
    "valid_authority": "(Linnaeus, 1758)",
}

#: Respuesta real a `alosa`: la fila `Alosa spp` del BOE regula el género entero.
GENERO_ALOSA: dict[str, Any] = {
    **ATUN_ROJO,
    "AphiaID": 125715,
    "scientificname": "Alosa",
    "authority": "Linck, 1790",
    "rank": "Genus",
    "valid_AphiaID": 125715,
    "valid_name": "Alosa",
    "citation": "WoRMS (2026). Alosa Linck, 1790.",
}


def _cuerpo(*registros: dict[str, Any]) -> bytes:
    return json.dumps(registros).encode()


# =====================================================================================
# WoRMS
# =====================================================================================


def test_el_204_sin_cuerpo_es_no_encontrado_y_no_una_averia() -> None:
    """El punto 1 de la cabecera: 22 de los 86 nombres del BOE llegan aquí."""
    resolucion = worms.leer_respuesta(b"", consultado="mugil spp")
    assert resolucion.desenlace == "no_encontrado"
    assert resolucion.registro is None
    assert "204" in (resolucion.motivo or "")


def test_un_nombre_aceptado_se_distingue_de_un_sinonimo() -> None:
    """Los dos primeros desenlaces, que la interfaz tiene que poder contar por separado."""
    aceptado = worms.leer_respuesta(_cuerpo(ATUN_ROJO), consultado="thunnus thynnus")
    assert aceptado.desenlace == "aceptado"
    assert aceptado.registro is not None
    assert aceptado.registro.aphia_id == 127029
    assert aceptado.registro.rango == "especie"

    sinonimo = worms.leer_respuesta(_cuerpo(LENGUADO), consultado="solea vulgaris")
    assert sinonimo.desenlace == "sinonimo"
    assert sinonimo.registro is not None
    assert sinonimo.registro.estado == "unaccepted"
    assert sinonimo.registro.nombre_aceptado == "Solea solea"
    assert sinonimo.registro.aphia_id_aceptado == 127160
    # Lo que la norma escribe sigue estando, porque es lo que tiene consecuencia legal.
    assert sinonimo.registro.nombre_cientifico == "Solea vulgaris"


def test_dos_registros_no_se_resuelven_eligiendo_el_primero() -> None:
    """Medido: hoy los 64 que resuelven devuelven exactamente uno. Justo por eso.

    El día que WoRMS devuelva un homónimo, quedarse con el de arriba es tomar una decisión
    taxonómica por orden de lista y publicarla como si fuera de la fuente.
    """
    resolucion = worms.leer_respuesta(_cuerpo(ATUN_ROJO, LENGUADO), consultado="thunnus thynnus")
    assert resolucion.desenlace == "ambiguo"
    assert resolucion.registro is None
    assert len(resolucion.candidatos) == 2
    assert "127029" in (resolucion.motivo or "") and "158796" in (resolucion.motivo or "")


def test_un_genero_se_publica_como_genero() -> None:
    """Las 15 filas `spp` del BOE pasan por aquí: el rango que llega es el que se publica."""
    resolucion = worms.leer_respuesta(_cuerpo(GENERO_ALOSA), consultado="alosa")
    assert resolucion.desenlace == "aceptado"
    assert resolucion.registro is not None
    assert resolucion.registro.rango == "genero"
    assert resolucion.registro.rango_worms == "Genus"


def test_un_rango_que_no_sabemos_nombrar_aborta() -> None:
    """Mapa cerrado, como `utm.PROYECCIONES`: un rango mal rotulado se lee igual que uno correcto."""
    with pytest.raises(worms.ErrorWorms, match="rango taxonómico"):
        worms.leer_respuesta(_cuerpo({**ATUN_ROJO, "rank": "Forma"}), consultado="lo que sea")


def test_un_registro_sin_estado_aborta() -> None:
    """Publicar media ficha de taxón es peor que no publicarla: no se sabría si está aceptado."""
    sin_estado = {**ATUN_ROJO, "status": None}
    with pytest.raises(worms.ErrorWorms, match="status"):
        worms.leer_respuesta(_cuerpo(sin_estado), consultado="thunnus thynnus")


def test_una_lista_vacia_con_200_no_se_confunde_con_el_204() -> None:
    """Son dos respuestas distintas y sólo una está documentada por la medición: se dice."""
    with pytest.raises(worms.ErrorWorms, match="204"):
        worms.leer_respuesta(b"[]", consultado="thunnus thynnus")


def test_la_insensibilidad_a_mayusculas_la_garantizamos_nosotros() -> None:
    """El BOE trae `Thunnus Thynnus` **y** `Thunnus thynnus`: son la misma especie.

    La normalización se hace aquí y no se confía en el tercero, y además colapsa los blancos, que
    es lo medido: `thunnus  thynnus` con dos espacios responde 204.
    """
    assert worms.normalizar("Thunnus Thynnus") == "thunnus thynnus"
    assert worms.normalizar("  THUNNUS   thynnus ") == "thunnus thynnus"
    assert worms.url_de("Thunnus Thynnus") == worms.url_de("thunnus thynnus")
    assert "thunnus%20thynnus" in worms.url_de("Thunnus  Thynnus")
    assert "like=false" in worms.url_de("Thunnus thynnus")


# =====================================================================================
# OBIS
# =====================================================================================


def test_un_recorte_de_una_caja_es_un_poligono_y_el_de_varias_un_multipoligono() -> None:
    """Medido: el MULTIPOLYGON deduplica datasets, así que preguntar una vez no es un capricho.

    La dorada en el Cantábrico da 5 datasets y en el golfo de Cádiz 3, y los dos rectángulos juntos
    devuelven **5**, no 8. Sumar recortes habría publicado ocho fuentes donde hay cinco.
    """
    canario = obis.RECORTES["canario"]
    assert canario.wkt.startswith("POLYGON((")
    atlantico = obis.RECORTES["cantabrico-noroeste-y-golfo-de-cadiz"]
    assert len(atlantico.cajas) == 3
    assert atlantico.wkt.startswith("MULTIPOLYGON(((")
    assert atlantico.wkt.count(")),((") == 2  # tres anillos, dos costuras entre ellos


def test_el_anillo_va_en_lon_lat_y_se_cierra() -> None:
    """El WKT habla en `lon lat` y el resto del pipeline en `lat, lon`: la conversión se hace aquí."""
    caja = obis.Caja("prueba", 40.0, 41.0, -3.0, -2.0)
    puntos = caja.anillo_wkt.split(",")
    assert puntos[0] == "-3.0 40.0"
    assert puntos[0] == puntos[-1]
    assert len(puntos) == 5


def test_sin_registros_los_anios_son_nulos_y_no_cero() -> None:
    """`yearrange: [null, null]` es «ahí no hay nada anotado», no el año cero."""
    cuerpo = json.dumps(
        {"records": 0, "species": 0, "taxa": 0, "datasets": 0, "yearrange": [None, None]}
    ).encode()
    presencia = obis.leer_estadisticas(
        cuerpo, nombre="Merluccius merluccius", recorte=obis.RECORTES["canario"]
    )
    assert presencia.registros == 0
    assert presencia.desde_anio is None
    assert presencia.hasta_anio is None


def test_los_recuentos_se_leen_tal_cual() -> None:
    cuerpo = json.dumps(
        {"records": 27, "species": 1, "taxa": 1, "datasets": 5, "yearrange": [2004, 2025]}
    ).encode()
    recorte = obis.RECORTES["cantabrico-noroeste-y-golfo-de-cadiz"]
    presencia = obis.leer_estadisticas(cuerpo, nombre="Sparus aurata", recorte=recorte)
    assert (presencia.registros, presencia.datasets) == (27, 5)
    assert (presencia.desde_anio, presencia.hasta_anio) == (2004, 2025)
    assert presencia.caladero == "cantabrico-noroeste-y-golfo-de-cadiz"
    assert presencia.consultado == "Sparus aurata"


def test_una_respuesta_sin_recuento_aborta() -> None:
    with pytest.raises(obis.ErrorObis, match="records"):
        obis.leer_estadisticas(
            b'{"species": 1}', nombre="Sparus aurata", recorte=obis.RECORTES["canario"]
        )


def test_un_puerto_fuera_de_su_recorte_pone_el_gate_en_rojo() -> None:
    """Si un puerto del caladero cae fuera, hay litoral regulado por el que no se pregunta."""
    catalogo = {
        "ports": [
            {"slug": "inventado", "caladero": "canario", "lat": 43.4, "lon": -8.4},
        ]
    }
    errores = obis.errores_de_recortes(catalogo)
    assert errores and "FUERA" in errores[0]


def test_un_puerto_de_otro_caladero_dentro_del_recorte_pone_el_gate_en_rojo() -> None:
    """Y si cae dentro del recorte ajeno, esa presencia cuenta registros de otro caladero."""
    catalogo = {
        "ports": [
            {"slug": "vigo-falso", "caladero": "mediterraneo", "lat": 42.24, "lon": -8.72},
        ]
    }
    errores = obis.errores_de_recortes(catalogo)
    assert any("DENTRO del recorte de cantabrico" in error for error in errores)


def test_un_caladero_sin_recorte_no_publica_presencia() -> None:
    catalogo = {"ports": [{"slug": "x", "caladero": "atlantico-norte", "lat": 43.0, "lon": -8.0}]}
    assert obis.errores_de_recortes(catalogo)
