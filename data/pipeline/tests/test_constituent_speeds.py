"""El catálogo de Doodson reproduce las velocidades publicadas de cada constituyente.

Este es el test que atrapa la errata más cara del pipeline: un número de Doodson mal copiado no
rompe nada visiblemente, sólo desplaza la pleamar de ese constituyente para siempre. La tabla de
abajo es **independiente** del catálogo (son las velocidades publicadas en grados por hora solar
media, del listado estándar de Schureman/NOAA), así que compararlas cierra el lazo.
"""

from __future__ import annotations

import pytest

from mareia_pipeline.tides.astro import ARGUMENT_SPEEDS_DEG_PER_HOUR
from mareia_pipeline.tides.constituents import CATALOG

#: Velocidades publicadas, en grados por hora solar media.
PUBLISHED_SPEEDS_DEG_PER_HOUR = {
    "SA": 0.0410686,
    "SSA": 0.0821373,
    "MM": 0.5443747,
    "MSF": 1.0158958,
    "MF": 1.0980331,
    "MTM": 1.6424077,
    "MSQM": 2.1139288,
    "2Q1": 12.8542862,
    "SGM": 12.9271398,
    "Q1": 13.3986609,
    "RHO": 13.4715145,
    "O1": 13.9430356,
    "M1": 14.4920521,
    "P1": 14.9589314,
    "S1": 15.0000000,
    "K1": 15.0410686,
    "J1": 15.5854433,
    "OO1": 16.1391017,
    "EP2": 27.4238337,
    "2N2": 27.8953548,
    "MU2": 27.9682084,
    "N2": 28.4397295,
    "NU2": 28.5125831,
    "MA2": 28.9430356,
    "M2": 28.9841042,
    "MB2": 29.0251728,
    "MKS2": 29.0662415,
    "LAM2": 29.4556253,
    "L2": 29.5284789,
    "T2": 29.9589333,
    "S2": 30.0000000,
    "R2": 30.0410667,
    "K2": 30.0821373,
    "2SM2": 31.0158958,
    "M3": 43.4761563,
    "S3": 45.0000000,
    "N4": 56.8794590,
    "MN4": 57.4238337,
    "M4": 57.9682084,
    "MS4": 58.9841042,
    "S4": 60.0000000,
    "2MO5": 71.9112440,
    "2MK5": 73.0092770,
    "M6": 86.9523127,
    "2MS6": 87.9682084,
    "M8": 115.9364169,
}


def _speed(name: str) -> float:
    coefficients = CATALOG[name].doodson
    return sum(c * s for c, s in zip(coefficients, ARGUMENT_SPEEDS_DEG_PER_HOUR, strict=True))


@pytest.mark.parametrize("name", sorted(PUBLISHED_SPEEDS_DEG_PER_HOUR))
def test_speed_matches_published_table(name: str) -> None:
    assert _speed(name) == pytest.approx(PUBLISHED_SPEEDS_DEG_PER_HOUR[name], abs=1e-5)


def test_catalog_has_no_constituent_without_a_published_speed() -> None:
    assert set(CATALOG) == set(PUBLISHED_SPEEDS_DEG_PER_HOUR)


def test_compound_offsets_are_inherited_from_parents() -> None:
    """El desfase de 90° de un compuesto es la suma ponderada del de sus progenitores."""
    for name, constituent in CATALOG.items():
        if not constituent.compound:
            continue
        expected = sum(
            multiple * CATALOG[parent].offset_90deg
            for parent, multiple in constituent.compound.items()
        )
        assert constituent.offset_90deg == expected, name


def test_compound_doodson_numbers_are_the_sum_of_their_parents() -> None:
    """El argumento de un compuesto es la combinación lineal del de sus progenitores."""
    for name, constituent in CATALOG.items():
        if not constituent.compound:
            continue
        expected = tuple(
            sum(multiple * CATALOG[parent].doodson[i] for parent, multiple in constituent.compound.items())
            for i in range(6)
        )
        assert constituent.doodson == expected, name
