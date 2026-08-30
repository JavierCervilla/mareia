"""El parser del BOE lee **la versión en vigor** y aborta antes que adivinar.

Los recorridos van contra las respuestas reales capturadas en ``tests/fixtures/boe`` el 2026-08-30
—``metadatos``, ``texto/indice`` y los tres bloques de anexo, tal cual los devuelve la API— y no
contra un XML de juguete recortado a la medida del parser. La diferencia importa: un fixture
resumido es una copia del instrumento, y un parser probado contra su propia idea de la fuente pasa
en verde el día que la fuente deja de parecerse a esa idea.

Los caminos de error sí usan XML sintético, porque son formas que el BOE **no** tiene hoy y hay que
fabricarlas para poder verlas en rojo.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

import pytest

from mareia_pipeline.sources import boe

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "boe"

#: El día en que se capturaron los fixtures. Fijo, para que estos recorridos digan lo mismo dentro
#: de un año: la selección de versión depende de la fecha y un `hoy` real haría que el test cambiara
#: de significado solo, sin que nadie tocara nada.
HOY = dt.date(2026, 8, 30)


def anexo(bloque: str, *, hoy: dt.date = HOY) -> boe.Anexo:
    return boe.parsear_anexo(
        FIXTURES.joinpath(f"{bloque}.xml").read_bytes(),
        bloque=bloque,
        fecha_actualizacion="20251101",
        hoy=hoy,
    )


def bloque_sintetico(cuerpo: str, *, bloque: str = "ani") -> bytes:
    return (
        '<response><status><code>200</code></status>'
        f'<data><bloque id="{bloque}">{cuerpo}</bloque></data></response>'
    ).encode()


def version_sintetica(filas: str, *, notas: str = "", vigencia: str = "20200101") -> str:
    return (
        f'<version id_norma="BOE-A-2020-1" fecha_publicacion="20191231" fecha_vigencia="{vigencia}">'
        f"<p>ANEXO I</p><p>Tallas mínimas de prueba</p>"
        f"<table><tbody><tr><td>Especie</td><td>Talla (en cm)</td></tr>{filas}</tbody></table>"
        f"{notas}</version>"
    )


def test_la_norma_sigue_vigente_y_se_comprueba_antes_de_leer_ninguna_tabla() -> None:
    metadatos = boe.leer_metadatos(FIXTURES.joinpath("metadatos.json").read_bytes())
    assert metadatos.identificador == "BOE-A-1995-8639"
    assert metadatos.eli == "https://www.boe.es/eli/es/rd/1995/04/07/560"
    boe.comprobar_vigente(metadatos)


@pytest.mark.parametrize(
    ("derogacion", "agotada"), [("S", "N"), ("N", "S")], ids=["derogada", "vigencia agotada"]
)
def test_una_norma_derogada_aborta_la_ingesta(derogacion: str, agotada: str) -> None:
    """En rojo: una norma derogada tiene anexos perfectamente parseables, y ahí está el peligro."""
    metadatos = boe.leer_metadatos(FIXTURES.joinpath("metadatos.json").read_bytes())
    caducada = boe.Metadatos(
        identificador=metadatos.identificador,
        titulo=metadatos.titulo,
        eli=metadatos.eli,
        url_html_consolidada=metadatos.url_html_consolidada,
        fecha_actualizacion=metadatos.fecha_actualizacion,
        fecha_disposicion=metadatos.fecha_disposicion,
        estatus_derogacion=derogacion,
        vigencia_agotada=agotada,
    )
    with pytest.raises(boe.ErrorBoe, match="no está vigente"):
        boe.comprobar_vigente(caducada)


def test_el_indice_trae_los_tres_bloques_de_anexo() -> None:
    indice = boe.leer_indice(FIXTURES.joinpath("indice.json").read_bytes())
    assert [indice[bloque] for bloque in boe.BLOQUES_DE_ANEXO] == ["20251101"] * 3


def test_se_lee_la_version_en_vigor_y_la_redaccion_historica_se_queda_atras() -> None:
    """El hallazgo que da nombre a la trayectoria, medido en los dos sentidos.

    Con la fecha de hoy sale la redacción de 2025; con una fecha de 1996, la de 1995. Si el parser
    leyera «todos los `<tr>` del bloque» —o simplemente la última versión del documento— este
    segundo recorrido no podría distinguirse del primero.
    """
    canario_hoy = anexo("aniii")
    canario_1996 = anexo("aniii", hoy=dt.date(1996, 1, 1))
    assert canario_hoy.fecha_vigencia == dt.date(2025, 11, 2)
    assert canario_hoy.norma_modificadora == "BOE-A-2025-22024"
    assert canario_1996.fecha_vigencia == dt.date(1995, 4, 9)
    assert _talla(canario_hoy, "Aligote") == boe.LongitudCm(cm=20.0)
    assert _talla(canario_1996, "Aligote") == boe.LongitudCm(cm=12.0)


def test_las_notas_tambien_salen_de_la_version_en_vigor() -> None:
    """La versión de 1995 del Anexo I tiene dos notas; la vigente, tres. Mezclarlas es lo mismo
    que mezclar las tallas: la lubina de hoy remite a una nota que en 1995 no existía."""
    assert [nota.marca for nota in anexo("ani").notas] == ["(*)", "(**)", "(***)"]
    assert [nota.marca for nota in anexo("ani", hoy=dt.date(1996, 1, 1)).notas] == ["(*)", "(**)"]


def test_sin_ninguna_version_se_aborta_en_vez_de_leer_el_bloque_entero() -> None:
    """El camino de repuesto que **no** existe, probado en rojo.

    Es el defecto que esta trayectoria existe para impedir: si un día no hubiera `<version>`, la
    salida cómoda sería leer todos los `<tr>` y publicar las tres redacciones mezcladas.
    """
    xml = bloque_sintetico(
        "<p>ANEXO I</p><table><tbody><tr><td>Abadejo (X y)</td><td>30</td></tr></tbody></table>"
    )
    with pytest.raises(boe.ErrorBoe, match="no trae ninguna <version>"):
        boe.parsear_anexo(xml, bloque="ani", fecha_actualizacion="20251101", hoy=HOY)


def test_una_version_que_aun_no_ha_entrado_en_vigor_no_se_publica() -> None:
    with pytest.raises(boe.ErrorBoe, match="entran en vigor en el futuro"):
        anexo("ani", hoy=dt.date(1990, 1, 1))


def test_el_bloque_que_devuelve_la_api_tiene_que_ser_el_que_se_pidio() -> None:
    with pytest.raises(boe.ErrorBoe, match="devolvió 'aniii'"):
        boe.parsear_anexo(
            FIXTURES.joinpath("aniii.xml").read_bytes(),
            bloque="ani",
            fecha_actualizacion="20251101",
            hoy=HOY,
        )


def test_una_cabecera_distinta_de_la_esperada_aborta() -> None:
    """Las columnas son la diferencia entre leer una talla y leer un topónimo."""
    xml = bloque_sintetico(
        '<version id_norma="BOE-A-2020-1" fecha_publicacion="20191231" fecha_vigencia="20200101">'
        "<p>ANEXO I</p><p>Prueba</p><table><tbody>"
        "<tr><td>Especie</td><td>Precio</td></tr>"
        "<tr><td>Abadejo (Pollachius pollachius)</td><td>30</td></tr>"
        "</tbody></table></version>"
    )
    with pytest.raises(boe.ErrorBoe, match="la cabecera de la tabla dice"):
        boe.parsear_anexo(xml, bloque="ani", fecha_actualizacion="20251101", hoy=HOY)


def test_una_marca_de_nota_sin_nota_que_la_explique_aborta() -> None:
    """Publicar «12» sin la excepción que la excepciona es publicar la cifra equivocada."""
    xml = bloque_sintetico(
        version_sintetica("<tr><td>Boquerón (Engraulis encrasicholus)</td><td>12 (**)</td></tr>")
    )
    with pytest.raises(boe.ErrorBoe, match=r"remite a la nota \(\*\*\)"):
        boe.parsear_anexo(xml, bloque="ani", fecha_actualizacion="20251101", hoy=HOY)


def test_una_nota_que_no_referencia_ninguna_especie_aborta() -> None:
    """Sobrar una nota significa que la tabla no se ha leído entera, y eso es perder filas."""
    xml = bloque_sintetico(
        version_sintetica(
            "<tr><td>Abadejo (Pollachius pollachius)</td><td>30</td></tr>",
            notas="<p>(*) Talla por determinar.</p>",
        )
    )
    with pytest.raises(boe.ErrorBoe, match="ninguna especie las referencia"):
        boe.parsear_anexo(xml, bloque="ani", fecha_actualizacion="20251101", hoy=HOY)


def test_una_celda_de_talla_vacia_que_no_es_cabecera_multifila_aborta() -> None:
    xml = bloque_sintetico(
        version_sintetica("<tr><td>Abadejo (Pollachius pollachius)</td><td></td></tr>")
    )
    with pytest.raises(boe.ErrorBoe, match="tampoco es cabecera"):
        boe.parsear_anexo(xml, bloque="ani", fecha_actualizacion="20251101", hoy=HOY)


def test_la_especie_multifila_publica_sus_hijas_y_no_la_cabecera_sin_cifra() -> None:
    """La cigala del Anexo I: la cabecera no es una especie a la que le falte la talla."""
    cantabrico = anexo("ani")
    cigalas = [e for e in cantabrico.especies if e.nombre_comun == "Cigala (entera)"]
    assert [(e.medida, e.talla) for e in cigalas] == [
        ("Longitud cefalotórax", boe.LongitudCm(cm=2.0)),
        ("Longitud total", boe.LongitudCm(cm=7.0)),
    ]
    assert all(
        isinstance(e.nombre_cientifico, boe.NombreDeclarado)
        and e.nombre_cientifico.valor == "Nephrops norvegicus"
        for e in cigalas
    )
    # Y la que va justo después, que sí trae cifra propia, no se cuelga de la cabecera anterior.
    colas = _especie(cantabrico, "Cigalas (colas)")
    assert colas.medida == ""
    assert colas.talla == boe.LongitudCm(cm=3.7)


def test_la_nota_del_pulpo_viaja_aunque_su_marca_este_en_la_celda_de_especie() -> None:
    """Medido en el Anexo II: el BOE marca ``Pulpo (Octopus vulgaris) *``, no la celda de talla.

    Mirar sólo la columna de talla dejaría a diecisiete puertos baleares con un «1 kg» al que no le
    acompaña la excepción que dice que ahí no se aplica.
    """
    mediterraneo = anexo("anii")
    pulpo = _especie(mediterraneo, "Pulpo")
    assert pulpo.talla == boe.PesoKg(kg=1.0)
    assert pulpo.notas == ("(*)",)
    assert "Illes Balears" in {n.marca: n.texto for n in mediterraneo.notas}["(*)"]


def test_el_nombre_cientifico_ausente_dice_por_que_no_esta() -> None:
    colas = _especie(anexo("ani"), "Cigalas (colas)")
    assert isinstance(colas.nombre_cientifico, boe.NombreAusente)
    assert "no se infiere" in colas.nombre_cientifico.motivo


def test_el_nombre_local_canario_solo_existe_en_el_anexo_iii_y_su_hueco_dice_por_que() -> None:
    canario = anexo("aniii")
    assert _especie(canario, "Aligote").nombre_local == "Besuguito aligote"
    morena = _especie(canario, "Morena negra")
    assert morena.nombre_local == ""
    assert "deja vacía" in morena.nombre_local_ausente
    assert all(e.nombre_local == "" and e.nombre_local_ausente == "" for e in anexo("anii").especies)


def test_el_censo_de_la_version_en_vigor_es_el_medido() -> None:
    """Las cifras que se publicaron en el feed de la trayectoria, fijadas aquí.

    Si un cambio de la fuente —o del parser— mueve el reparto, esto se pone rojo y obliga a mirar
    antes de que el dataset se regenere con otra cosa dentro.
    """
    censo = {a.bloque: (len(a.especies), len(a.notas)) for a in map(anexo, boe.BLOQUES_DE_ANEXO)}
    assert censo == {"ani": (53, 3), "anii": (34, 1), "aniii": (31, 0)}


def _especie(anexo_: boe.Anexo, nombre: str) -> boe.Especie:
    return next(e for e in anexo_.especies if e.nombre_comun == nombre)


def _talla(anexo_: boe.Anexo, nombre: str) -> boe.Talla:
    return _especie(anexo_, nombre).talla
