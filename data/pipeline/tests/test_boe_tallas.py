"""La columna «Talla (en cm)» no contiene sólo tallas en cm, y el tipo lo dice.

``talla: number`` sería un tipo falso: de las 118 celdas publicadas, 17 no son un entero de
centímetros. Estos recorridos fijan la unión cerrada celda a celda, con literales **medidos** en el
texto consolidado, no inventados para el test.
"""

from __future__ import annotations

import pytest

from mareia_pipeline.sources import boe

#: Las notas de la versión en vigor del Anexo I, que son las que dan sentido a las celdas sin cifra.
NOTAS_ANEXO_I = {
    "(*)": "Talla por determinar.",
    "(**)": "Excepto en la división IX, a), en la que la talla mínima es de 10 centímetros.",
    "(***)": "Excepto en las divisiones 8a y 8b del Consejo Internacional para la Exploración del "
    "Mar, tanto para la pesca profesional como para la pesca recreativa, en las que la talla "
    "mínima es de 44 centímetros.",
}


def clasificar(literal: str, notas: dict[str, str] | None = None) -> boe.Talla:
    """Clasifica un literal tal y como lo hace el parser: quitando antes sus marcas de nota."""
    marcas, texto = boe._marcas(literal)
    return boe.clasificar_talla(texto, marcas=marcas, notas=notas or NOTAS_ANEXO_I)


@pytest.mark.parametrize(
    ("literal", "esperada"),
    [
        ("30", boe.LongitudCm(cm=30.0)),
        ("36 (***)", boe.LongitudCm(cm=36.0)),
        ("3,7", boe.LongitudCm(cm=3.7)),
        ("2,5", boe.LongitudCm(cm=2.5)),
        ("8,5", boe.LongitudCm(cm=8.5)),
        ("6,4 kg", boe.PesoKg(kg=6.4)),
        ("3,2 kg", boe.PesoKg(kg=3.2)),
        ("1 kg", boe.PesoKg(kg=1.0)),
        ("80 cm o 10 kg de peso", boe.LongitudOPeso(cm=80.0, kg=10.0)),
        ("(*)", boe.PorDeterminar(segun_nota="(*)")),
    ],
    ids=[
        "entero",
        "entero con nota",
        "decimal con coma",
        "almeja y chirla",
        "cefalotórax de bogavante",
        "atún rojo por peso",
        "patudo y rabil",
        "pulpo",
        "disyunción longitud o peso",
        "talla por determinar",
    ],
)
def test_cada_literal_medido_cae_en_su_clase(literal: str, esperada: boe.Talla) -> None:
    assert clasificar(literal) == esperada


def test_la_boga_del_anexo_i_se_publica_ilegible_y_no_corregida() -> None:
    """El BOE imprime ``1 1`` donde casi con seguridad quiso decir ``11``. **No se arregla.**

    Corregir una cifra legal por inferencia es exactamente lo que este proyecto no hace: se publica
    el literal, con el motivo a la vista y el enlace al texto auténtico.
    """
    talla = clasificar("1 1")
    assert isinstance(talla, boe.SinDatoLegible)
    assert "«1 1»" in talla.motivo
    assert talla != boe.LongitudCm(cm=11.0)


def test_una_celda_sin_cifra_solo_es_por_determinar_si_la_nota_lo_dice() -> None:
    """La diferencia entre «la norma no fija talla» y «no supimos leer la celda».

    La primera es un dato de la norma —seis especies del Anexo I— y la segunda un fallo nuestro.
    Clasificar la segunda como la primera publicaría nuestro fallo con la voz del BOE.
    """
    assert clasificar("(*)", {"(*)": "Talla por determinar."}) == boe.PorDeterminar(segun_nota="(*)")
    otra = clasificar("(*)", {"(*)": "Salvo en aguas interiores de Illes Balears."})
    assert isinstance(otra, boe.SinDatoLegible)
    assert "no fija ninguna talla" in otra.motivo


def test_un_formato_que_no_sabemos_leer_no_se_publica_como_cifra() -> None:
    """En rojo: si el BOE cambiara de formato, la celda sale ilegible y **nunca** un número a ojo."""
    talla = clasificar("de 12 a 15")
    assert isinstance(talla, boe.SinDatoLegible)
    assert "de 12 a 15" in talla.motivo


@pytest.mark.parametrize(
    ("celda", "comun", "cientifico"),
    [
        ("Lubina (Dicentrarchus labrax)", "Lubina", "Dicentrarchus labrax"),
        ("Caballa, Estornino (Scomber spp)", "Caballa, Estornino", "Scomber spp"),
        ("Langosta (Palinuridae)", "Langosta", "Palinuridae"),
        (
            "Rape (Lophius piscatorius, L. Budegassa)",
            "Rape",
            "Lophius piscatorius, L. Budegassa",
        ),
        ("Bacaladilla (Micromesistius poutassou).", "Bacaladilla", "Micromesistius poutassou"),
        ("Cigala (entera) (Nephrops norvegicus):", "Cigala (entera)", "Nephrops norvegicus"),
    ],
)
def test_el_nombre_cientifico_sale_del_ultimo_parentesis(
    celda: str, comun: str, cientifico: str
) -> None:
    nombre_comun, nombre = boe.separar_nombre(celda)
    assert nombre_comun == comun
    assert nombre == boe.NombreDeclarado(cientifico)


def test_una_aclaracion_en_castellano_no_se_hace_pasar_por_nombre_cientifico() -> None:
    comun, nombre = boe.separar_nombre("Cigalas (colas)")
    assert comun == "Cigalas (colas)"
    assert isinstance(nombre, boe.NombreAusente)
    assert "no se infiere" in nombre.motivo
