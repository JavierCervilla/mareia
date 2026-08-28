"""Catálogo de constituyentes armónicos (números de Doodson + familia nodal).

Cada constituyente se define por los coeficientes enteros de la expansión de Doodson sobre los
seis argumentos astronómicos fundamentales ``(T, s, h, p, N', p1)`` más un desfase entero de 90°:

    V(t) = c_T·T + c_s·s + c_h·h + c_p·p + c_N·N' + c_p1·p1 + 90°·offset

``T`` es el ángulo horario del sol medio en Greenwich (15°/h), ``s`` la longitud media de la Luna,
``h`` la del Sol, ``p`` la del perigeo lunar, ``N'`` = −N el nodo ascendente con signo invertido y
``p1`` el perigeo solar. La velocidad angular del constituyente es la misma combinación lineal
aplicada a las velocidades de esos argumentos (ver :mod:`mareia_pipeline.tides.astro`).

``nodal`` nombra la familia de corrección nodal de Schureman (factor ``f`` y ángulo ``u``) que le
corresponde; ``compound`` expresa los constituyentes de aguas someras como múltiplos enteros de sus
progenitores, de modo que ``f`` es el producto y ``u`` la suma ponderada de los de aquellos.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# Coeficientes de Doodson: (T, s, h, p, N', p1).
DoodsonNumbers = tuple[int, int, int, int, int, int]


@dataclass(frozen=True)
class Constituent:
    """Un constituyente armónico con su argumento astronómico y su corrección nodal."""

    name: str
    doodson: DoodsonNumbers
    offset_90deg: int = 0
    nodal: str = "unity"
    #: Descomposición en progenitores para constituyentes de aguas someras: {nombre: múltiplo}.
    compound: dict[str, int] = field(default_factory=dict)


def _c(
    name: str,
    doodson: DoodsonNumbers,
    offset_90deg: int = 0,
    nodal: str = "unity",
    compound: dict[str, int] | None = None,
) -> Constituent:
    return Constituent(name, doodson, offset_90deg, nodal, compound or {})


# --- Largo periodo ---------------------------------------------------------------------------
_LONG_PERIOD = [
    _c("SA", (0, 0, 1, 0, 0, 0)),
    _c("SSA", (0, 0, 2, 0, 0, 0)),
    _c("MM", (0, 1, 0, -1, 0, 0), nodal="Mm"),
    # MSF = S2 − M2: su corrección nodal es la de M2 con el ángulo cambiado de signo.
    _c("MSF", (0, 2, -2, 0, 0, 0), compound={"S2": 1, "M2": -1}),
    _c("MF", (0, 2, 0, 0, 0, 0), nodal="Mf"),
    _c("MTM", (0, 3, 0, -1, 0, 0), nodal="Mf"),
    _c("MSQM", (0, 4, -2, 0, 0, 0), nodal="Mf"),
]

# --- Diurnos ---------------------------------------------------------------------------------
_DIURNAL = [
    _c("2Q1", (1, -4, 1, 2, 0, 0), offset_90deg=1, nodal="O1"),
    _c("SGM", (1, -4, 3, 0, 0, 0), offset_90deg=1, nodal="O1"),
    _c("Q1", (1, -3, 1, 1, 0, 0), offset_90deg=1, nodal="O1"),
    _c("RHO", (1, -3, 3, -1, 0, 0), offset_90deg=1, nodal="O1"),
    _c("O1", (1, -2, 1, 0, 0, 0), offset_90deg=1, nodal="O1"),
    _c("M1", (1, -1, 1, 0, 0, 0), offset_90deg=1, nodal="M1"),
    _c("P1", (1, 0, -1, 0, 0, 0), offset_90deg=1),
    _c("S1", (1, 0, 0, 0, 0, 0)),
    _c("K1", (1, 0, 1, 0, 0, 0), offset_90deg=-1, nodal="K1"),
    _c("J1", (1, 1, 1, -1, 0, 0), offset_90deg=-1, nodal="J1"),
    _c("OO1", (1, 2, 1, 0, 0, 0), offset_90deg=-1, nodal="OO1"),
]

# --- Semidiurnos -----------------------------------------------------------------------------
_SEMIDIURNAL = [
    _c("EP2", (2, -5, 4, 1, 0, 0), nodal="M2"),
    _c("2N2", (2, -4, 2, 2, 0, 0), nodal="M2"),
    _c("MU2", (2, -4, 4, 0, 0, 0), nodal="M2"),
    _c("N2", (2, -3, 2, 1, 0, 0), nodal="M2"),
    _c("NU2", (2, -3, 4, -1, 0, 0), nodal="M2"),
    # MA2/MB2 son la modulación anual (radiacional) de M2: no llevan corrección nodal lunar.
    _c("MA2", (2, -2, 1, 0, 0, 0)),
    _c("M2", (2, -2, 2, 0, 0, 0), nodal="M2"),
    _c("MB2", (2, -2, 3, 0, 0, 0)),
    _c("LAM2", (2, -1, 0, 1, 0, 0), offset_90deg=2, nodal="M2"),
    _c("L2", (2, -1, 2, -1, 0, 0), offset_90deg=2, nodal="L2"),
    _c("T2", (2, 0, -1, 0, 0, 1)),
    _c("S2", (2, 0, 0, 0, 0, 0)),
    _c("R2", (2, 0, 1, 0, 0, -1), offset_90deg=2),
    _c("K2", (2, 0, 2, 0, 0, 0), nodal="K2"),
]

# --- Terdiurnos ------------------------------------------------------------------------------
_TERDIURNAL = [
    _c("M3", (3, -3, 3, 0, 0, 0), offset_90deg=2, nodal="M3"),
    _c("S3", (3, 0, 0, 0, 0, 0), offset_90deg=2),
]

# --- Aguas someras (compuestos) ---------------------------------------------------------------
_SHALLOW = [
    _c("2SM2", (2, 2, -2, 0, 0, 0), compound={"M2": -1, "S2": 2}),
    _c("MKS2", (2, -2, 4, 0, 0, 0), compound={"M2": 1, "K2": 1, "S2": -1}),
    _c("MN4", (4, -5, 4, 1, 0, 0), compound={"M2": 1, "N2": 1}),
    _c("M4", (4, -4, 4, 0, 0, 0), compound={"M2": 2}),
    _c("N4", (4, -6, 4, 2, 0, 0), compound={"N2": 2}),
    _c("MS4", (4, -2, 2, 0, 0, 0), compound={"M2": 1, "S2": 1}),
    _c("S4", (4, 0, 0, 0, 0, 0), compound={"S2": 2}),
    _c("2MO5", (5, -6, 5, 0, 0, 0), compound={"M2": 2, "O1": 1}),
    _c("2MK5", (5, -4, 5, 0, 0, 0), compound={"M2": 2, "K1": 1}),
    _c("M6", (6, -6, 6, 0, 0, 0), compound={"M2": 3}),
    _c("2MS6", (6, -4, 4, 0, 0, 0), compound={"M2": 2, "S2": 1}),
    _c("M8", (8, -8, 8, 0, 0, 0), compound={"M2": 4}),
]

def _with_inherited_offsets(entries: list[Constituent]) -> dict[str, Constituent]:
    """Deriva el desfase de 90° de los compuestos sumando el de sus progenitores.

    Escribir a mano el desfase de un compuesto es una fuente de erratas silenciosas (un ``2MK5``
    con el signo cambiado desplaza su pleamar media hora). Como el argumento del compuesto es por
    definición la combinación lineal de los de sus progenitores, el desfase también lo es.
    """
    catalog = {c.name: c for c in entries}
    for name, constituent in catalog.items():
        if not constituent.compound:
            continue
        inherited = sum(
            multiple * catalog[parent].offset_90deg
            for parent, multiple in constituent.compound.items()
        )
        catalog[name] = Constituent(
            name=constituent.name,
            doodson=constituent.doodson,
            offset_90deg=inherited,
            nodal=constituent.nodal,
            compound=constituent.compound,
        )
    return catalog


CATALOG: dict[str, Constituent] = _with_inherited_offsets(
    [*_LONG_PERIOD, *_DIURNAL, *_SEMIDIURNAL, *_TERDIURNAL, *_SHALLOW]
)

#: Constituyentes presentes en TICON-4 que este motor NO sintetiza, por no tener un número de
#: Doodson o un convenio de fase publicado del que fiarse (verificado contra la implementación de
#: referencia ``@neaps/tide-predictor``: ver ``tests/test_reference_engine.py``). Se conservan en el
#: dataset emitido —el dataset es fiel a la fuente— pero se excluyen de la predicción, y el informe
#: QC reporta cuánta amplitud queda fuera. Todos ellos son de amplitud ≤ 1 cm en los puertos piloto.
UNSUPPORTED: frozenset[str] = frozenset({"3L2", "3N2", "T3", "R3", "M1"})

#: Nombres con los que las fuentes externas designan constituyentes de nuestro catálogo. El nombre
#: canónico del proyecto es el que entiende el motor TypeScript (`packages/domain-core`), así que la
#: traducción se hace **una sola vez, al ingerir**, y de ahí en adelante todo habla el mismo idioma.
SOURCE_NAME_ALIASES: dict[str, str] = {
    "LAMBDA2": "LAM2",
    "RHO1": "RHO",
}


def canonical_name(name: str) -> str:
    """Traduce el nombre de un constituyente al canónico del proyecto."""
    return SOURCE_NAME_ALIASES.get(name, name)


def supported(names: list[str]) -> list[str]:
    """Devuelve los nombres del catálogo, preservando el orden de entrada."""
    return [n for n in names if n in CATALOG]
