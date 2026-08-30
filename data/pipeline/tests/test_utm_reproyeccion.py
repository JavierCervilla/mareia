"""La inversa de Krüger cae donde debe, y el gate P1 se pone rojo cuando no.

Un reproyector roto no falla: **acierta** a producir una coordenada perfectamente formada a
cientos de kilómetros de su sitio, y por ahí no salta ninguna excepción. Así que probarlo en verde
no dice gran cosa; lo que dice algo es probar que cada capa del gate **caza un fallo que las otras
cuatro no ven**, y eso es lo que hacen los cinco recorridos en rojo de abajo.

Las mutaciones no son arbitrarias: cada una imita un modo de avería real —un coeficiente de la
serie mal transcrito, un cero de longitud mal puesto, una escala que se va, un ``K0`` que no es el
de UTM, la zona equivocada— y se elige del tamaño justo para que las demás capas la dejen pasar.
"""

from __future__ import annotations

import math

import pytest

from mareia_pipeline import utm
from mareia_pipeline.geo import haversine_km

#: Lo que midió la trayectoria contra la fuente real el 2026-08-30, en grados decimales.
MEDIDO = {
    25830: (37.66043819567445, -0.6120266811975973),
    32628: (27.756656769304758, -18.105941679985797),
}


def desviada(*, latitud: float = 0.0, longitud: float = 0.0, escala_longitud: float = 1.0):
    """Una ``a_geograficas`` estropeada a medida, para poder ver el gate en rojo.

    ``escala_longitud`` estira la separación respecto al meridiano central, que es la forma que
    tiene un error de escala: sobre el meridiano central sigue siendo exacto y se va abriendo al
    alejarse.
    """
    original = utm.a_geograficas

    def envoltorio(este: float, norte: float, proyeccion: utm.Proyeccion) -> tuple[float, float]:
        lat, lon = original(este, norte, proyeccion)
        centro = proyeccion.meridiano_central
        return lat + latitud, centro + (lon - centro) * escala_longitud + longitud

    return envoltorio


def test_las_anclas_caen_donde_las_midio_la_trayectoria() -> None:
    """Trinquete de la implementación: las dos cifras del plan, con la coma donde estaba.

    No es una verificación externa —son nuestras propias cifras— y por eso no basta: es lo que
    congela el resultado para que un cambio en la serie no pase de largo. Quien valida contra algo
    ajeno es el gate.
    """
    for epsg, esperado in MEDIDO.items():
        ancla = next(a for a in utm.ANCLAS if a.epsg == epsg)
        obtenido = utm.a_geograficas(ancla.este, ancla.norte, utm.PROYECCIONES[epsg])
        assert obtenido == pytest.approx(esperado, abs=1e-9)


def test_las_anclas_caen_cerca_de_su_puerto() -> None:
    """Y donde dice el catálogo público, que es una fuente que no es nuestra."""
    for ancla in utm.ANCLAS:
        lat, lon = utm.a_geograficas(ancla.este, ancla.norte, utm.PROYECCIONES[ancla.epsg])
        distancia = haversine_km(lat, lon, ancla.lat_referencia, ancla.lon_referencia)
        assert distancia == pytest.approx(ancla.distancia_medida_km, abs=0.05)
        assert distancia < utm.TOLERANCIA_ANCLA_KM


def test_p1_en_verde() -> None:
    assert utm.errores_de_reproyeccion() == []


def test_p1_caza_un_coeficiente_mal_transcrito(monkeypatch: pytest.MonkeyPatch) -> None:
    """Un dígito de más en δ₁ y la latitud se va: lo caza el arco de meridiano.

    La perturbación es de una parte en diez mil sobre δ₁ ≈ 2n, y sobre el terreno son 2,14 m de
    latitud en el peor punto del rango: invisible para las anclas geográficas, que toleran 25 km, y
    por debajo de la décima de kilómetro con la que se publican las distancias. La capa que la ve
    es la cuadratura, que es la única que no comparte código con la serie.
    """
    original = utm._delta
    monkeypatch.setattr(utm, "_delta", lambda n: (original(n)[0] * 1.0001, *original(n)[1:]))
    fallos = utm.errores_de_reproyeccion()
    assert any("arco de meridiano" in fallo for fallo in fallos)
    assert utm._errores_de_anclas() == [], "las anclas no ven un error de un par de metros"


def test_p1_caza_un_signo_cambiado_en_la_serie(monkeypatch: pytest.MonkeyPatch) -> None:
    """β₁ con el signo al revés. Es el error de transcripción clásico y hay que verlo en rojo."""
    original = utm._beta
    monkeypatch.setattr(utm, "_beta", lambda n: (-original(n)[0], *original(n)[1:]))
    assert utm._errores_de_meridiano() != []


def test_p1_caza_un_cero_de_longitud_mal_puesto(monkeypatch: pytest.MonkeyPatch) -> None:
    """Noventa metros constantes de longitud de más: sólo lo ven las invariantes exactas.

    Es el recorrido que justifica que el gate tenga cinco capas y no una. Un desplazamiento
    uniforme de 0,001° —88 m en el ancla de Cabo de Palos, 98 m en la de El Hierro— no llega a la
    décima de kilómetro con la que se publican las distancias, no lo ve la cuadratura (que sólo
    mira la latitud), no lo ve la escala (porque se cancela en la diferencia) y no lo ven las
    anclas (que toleran 25 km). Lo ve la igualdad exacta «sobre el falso este, la longitud **es**
    la del meridiano central», y sólo ella.
    """
    monkeypatch.setattr(utm, "a_geograficas", desviada(longitud=0.001))
    assert utm._errores_de_invariantes() != []
    assert utm._errores_de_meridiano() == []
    assert utm._errores_de_escala() == []
    assert utm._errores_de_anclas() == []


def test_p1_caza_una_escala_que_se_va(monkeypatch: pytest.MonkeyPatch) -> None:
    """Y el simétrico: una escala de longitud mal, que las invariantes no pueden ver.

    Una parte por millón sobre la separación al meridiano central es exacta **sobre** el meridiano
    central —así que las tres invariantes siguen cumpliéndose—, son 21 cm en el ancla de Cabo de
    Palos, y aun así la capa de escala la mide.
    """
    monkeypatch.setattr(utm, "a_geograficas", desviada(escala_longitud=1 + 1e-6))
    assert utm._errores_de_escala() != []
    assert utm._errores_de_invariantes() == []
    assert utm._errores_de_anclas() == []


def test_el_punto_publicado_cae_donde_lo_publica_su_fuente() -> None:
    """La única cifra de este gate que no ha calculado este repositorio.

    Snyder publica las dos coordenadas del mismo punto —la UTM y la geográfica— y nosotros sólo
    ponemos la inversa. Que reproduzca a 4,7 cm sobre unos valores redondeados a la décima de metro
    en origen es la comprobación entera: no hay nada nuestro en el otro lado de la comparación.
    """
    punto = utm.PUNTO_PUBLICADO
    lat, lon = utm.a_geograficas(punto.este, punto.norte, punto.proyeccion)
    desvio_m = haversine_km(lat, lon, punto.lat_publicada, punto.lon_publicada) * 1_000.0
    assert desvio_m == pytest.approx(punto.desvio_medido_m, abs=0.01)
    assert desvio_m < utm.TOLERANCIA_PUNTO_PUBLICADO_M


def test_p1_caza_un_k0_que_no_es_el_de_utm(monkeypatch: pytest.MonkeyPatch) -> None:
    """``K0`` mal, y **sólo** el punto publicado se entera. Es el hallazgo que trajo esta capa.

    Se prueba con el error más gordo imaginable —``K0 = 1``, o sea olvidarse entero del factor de
    escala de UTM, que sobre el terreno son 1,8 km— y las otras cuatro capas siguen devolviendo la
    lista vacía. No es que sean flojas: es que las cuatro comparan este código contra otro cálculo
    que arranca del mismo ``K0``, y un ``K0`` equivocado entra por los dos lados y **se cancela**.
    Las anclas geográficas lo verían si midieran en metros, pero miden contra un puerto y toleran
    25 km, así que 1,8 km no las mueve.
    """
    monkeypatch.setattr(utm, "K0", 1.0)
    assert utm._errores_de_meridiano() == []
    assert utm._errores_de_invariantes() == []
    assert utm._errores_de_escala() == []
    assert utm._errores_de_anclas() == []
    fallos = utm._errores_de_punto_publicado()
    assert len(fallos) == 1
    assert "1797.221 m de desvío" in fallos[0]
    assert "Lo primero que hay que mirar es K0" in fallos[0]


def test_el_gate_de_k0_muerde_en_la_septima_cifra(monkeypatch: pytest.MonkeyPatch) -> None:
    """Y no sólo con la avería grosera: el hueco de la tolerancia, medido por los dos lados.

    Un gate cuyo rojo sólo se ha visto con el desastre no dice dónde está su línea. Ésta está en
    2,2 × 10⁻⁷ relativo sobre ``K0``, que es un metro de desvío sobre el punto publicado.
    """
    monkeypatch.setattr(utm, "K0", 0.9996 + 2.0e-7)
    assert utm._errores_de_punto_publicado() == []
    monkeypatch.setattr(utm, "K0", 0.9996 + 2.2e-7)
    assert utm._errores_de_punto_publicado() != []


def test_p1_caza_la_zona_equivocada(monkeypatch: pytest.MonkeyPatch) -> None:
    """El fallo que este gate existe para impedir: reproyectar Canarias con la zona peninsular.

    No da error, no rompe nada y coloca el área a más de mil kilómetros. Ninguna de las otras
    cuatro capas puede verlo —la serie está perfecta, es el sitio el que está mal— y por eso las
    anclas geográficas son irrenunciables.
    """
    canaria = next(a for a in utm.ANCLAS if a.epsg == 32628)
    peninsular = next(a for a in utm.ANCLAS if a.epsg == 25830)
    cruzadas = (
        type(canaria)(**{**vars(canaria), "epsg": 25830}),
        type(peninsular)(**{**vars(peninsular), "epsg": 32628}),
    )
    monkeypatch.setattr(utm, "ANCLAS", cruzadas)
    fallos = utm.errores_de_reproyeccion()
    assert len(fallos) == 2
    assert all("comprueba qué EPSG se está usando" in fallo for fallo in fallos)
    # Y el orden de magnitud del desastre, medido: con la zona equivocada el error no es de
    # kilómetros, es de centenares. Es el hueco en el que vive la tolerancia de 25 km.
    for ancla in cruzadas:
        lat, lon = utm.a_geograficas(ancla.este, ancla.norte, utm.PROYECCIONES[ancla.epsg])
        assert haversine_km(lat, lon, ancla.lat_referencia, ancla.lon_referencia) > 500


def test_el_arco_de_meridiano_converge() -> None:
    """La cuadratura que valida la serie está ella misma convergida: no valida con su propio error.

    Si la Simpson estuviera mal resuelta, el gate compararía la serie contra un número inventado y
    daría verde igual. Doblar los pasos no mueve el resultado ni una milésima de milímetro.
    """
    for elipsoide in (utm.GRS80, utm.WGS84):
        latitud = math.radians(43.0)
        grueso = utm._arco_de_meridiano(latitud, elipsoide, pasos=2_000)
        fino = utm._arco_de_meridiano(latitud, elipsoide, pasos=20_000)
        assert abs(grueso - fino) < 1e-6


@pytest.mark.parametrize(
    "urn",
    [
        "urn:ogc:def:crs:EPSG::25830",
        "urn:ogc:def:crs:EPSG:9.1:25830",
        "EPSG:25830",
        "  urn:ogc:def:crs:EPSG::25830  ",
    ],
)
def test_el_urn_es_tolerante_con_el_formato(urn: str) -> None:
    """Cuatro formas legales de escribir la misma zona; ponerse rojo por la puntuación sería ruido."""
    assert utm.proyeccion_de_urn(urn).epsg == 25830


@pytest.mark.parametrize(
    "urn",
    [
        "urn:ogc:def:crs:EPSG::25831",  # UTM 31N: existe, es plausible, y no la sabemos reproyectar
        "urn:ogc:def:crs:EPSG::4326",  # WGS84 en grados: ni siquiera es UTM
        "urn:ogc:def:crs:OGC:1.3:CRS84",
        "",
        "ETRS89 / UTM zone 30N",
    ],
)
def test_el_codigo_epsg_es_estricto(urn: str) -> None:
    """Y estricta con el código: lo que no está en el mapa cerrado aborta, sin zona de repuesto."""
    with pytest.raises(utm.ErrorCrs):
        utm.proyeccion_de_urn(urn)
