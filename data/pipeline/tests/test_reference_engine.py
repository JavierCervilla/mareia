"""El motor propio coincide con la implementación de referencia `@neaps/tide-predictor`.

El fixture `reference_engine.golden.json` se generó una vez con esa librería (MIT, la misma que usa
`neaps/tide-database` para derivar sus datums, contrastados a su vez contra NOAA CO-OPS y CHS) sobre
una estación sintética que incluye a propósito los constituyentes de convenio delicado: `L2` (factor
nodal con el término `R`), `MSF` (compuesto `S2 − M2`), `M3` y `S3` (desfase de 180°), `MA2`/`MB2`
(modulación radiacional, sin corrección nodal lunar) y `2MK5`/`2MO5` (compuestos que heredan el
desfase de 90° de su progenitor diurno). Un fallo aquí significa que uno de esos convenios se ha
movido.

Ese pase es también el que descubrió los dos errores que este motor tuvo al nacer: una época de
Schureman desplazada 12 horas (que valía ~25 min de error en la hora de pleamar) y unos compuestos
de aguas someras con el desfase de 90° puesto a mano.
"""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import numpy as np
import pytest

from mareia_pipeline.tides.astro import (
    NodalState,
    fundamental_arguments,
    hours_since_epoch,
    obliquity_deg,
)
from mareia_pipeline.tides.predict import Harmonic, predict

GOLDEN = json.loads((Path(__file__).parent / "reference_engine.golden.json").read_text())
REFERENCE_TIME = dt.datetime(2026, 7, 15, tzinfo=dt.timezone.utc)


def _wrap(degrees: float) -> float:
    return (degrees + 180.0) % 360.0 - 180.0


#: Las tolerancias no son cero porque los polinomios de Schureman (ajustados en 1900) y la teoría
#: lunar moderna que usa la referencia difieren ~0,02° en la longitud media de la Luna hoy — unos 4
#: segundos en la hora de la pleamar. Son holgadas frente a eso y aun así 100 veces más estrictas
#: que el error que de verdad hay que cazar: media jornada de desfase en la época son 6,6° en `s`.
@pytest.mark.parametrize(
    ("index", "name", "tolerance_deg"),
    [(1, "s", 0.05), (2, "h", 0.01), (3, "p", 0.01), (5, "p1", 0.01)],
)
def test_mean_longitudes_match_reference(index: int, name: str, tolerance_deg: float) -> None:
    key = {"s": "s", "h": "h", "p": "p", "p1": "pp"}[name]
    mine = float(fundamental_arguments(hours_since_epoch(REFERENCE_TIME))[index, 0])
    assert _wrap(mine - GOLDEN["astro"][key]) == pytest.approx(0.0, abs=tolerance_deg)


def test_solar_hour_angle_is_180_at_midnight_utc() -> None:
    """A medianoche UTC el ángulo horario del sol medio vale 180°, no 0°."""
    mine = float(fundamental_arguments(hours_since_epoch(REFERENCE_TIME))[0, 0])
    assert mine % 360.0 == pytest.approx(180.0, abs=1e-6)


def test_lunar_node_matches_reference() -> None:
    node = -float(fundamental_arguments(hours_since_epoch(REFERENCE_TIME))[4, 0])
    assert _wrap(node - GOLDEN["astro"]["N"]) == pytest.approx(0.0, abs=0.01)


def test_obliquity_is_time_dependent_and_matches_reference() -> None:
    centuries = hours_since_epoch(REFERENCE_TIME) / 876600.0
    assert obliquity_deg(centuries) == pytest.approx(GOLDEN["astro"]["omega"], abs=1e-4)


@pytest.mark.parametrize(("attribute", "key", "tolerance"), [("inclination_deg", "I", 1e-3), ("xi_deg", "xi", 1e-3), ("nu_deg", "nu", 1e-3)])
def test_nodal_auxiliary_angles_match_reference(attribute: str, key: str, tolerance: float) -> None:
    state = NodalState(REFERENCE_TIME)
    assert _wrap(getattr(state, attribute) - GOLDEN["astro"][key]) == pytest.approx(0.0, abs=tolerance)


def test_predicted_series_matches_reference_implementation() -> None:
    """25 horas de predicción coinciden con la referencia por debajo del milímetro."""
    harmonics = [
        Harmonic(c["name"], float(c["amplitude"]), float(c["phase"]))
        for c in GOLDEN["constituents"]
    ]
    times = [REFERENCE_TIME + dt.timedelta(hours=i) for i in range(len(GOLDEN["levels"]))]
    hours = np.array([hours_since_epoch(t) for t in times])
    mine = predict(harmonics, hours, REFERENCE_TIME + dt.timedelta(hours=12))
    reference = np.array(GOLDEN["levels"])
    assert np.max(np.abs(mine - reference)) < 0.002


def test_every_golden_constituent_is_in_the_catalog() -> None:
    from mareia_pipeline.tides.constituents import CATALOG

    missing = [c["name"] for c in GOLDEN["constituents"] if c["name"] not in CATALOG]
    assert not missing


#: Constituyentes cuya corrección nodal difiere de la implementación de referencia y que aceptamos
#: a sabiendas: son todos de largo periodo o diurnos menores, con amplitudes ≤ 1 cm en los puertos
#: piloto, de modo que la discrepancia queda por debajo de los 3 mm. Se dejan documentados aquí en
#: vez de en un comentario suelto para que cualquiera que amplíe el catálogo sepa qué no está atado.
KNOWN_NODAL_DIVERGENCES = {
    "MM": "factor f de Schureman frente al de la referencia (~8%)",
    "MF": "factor f (~5%)",
    "MTM": "factor f (~40%); amplitud ≤ 0,5 cm",
    "MSQM": "factor f (~30%); amplitud ≤ 0,3 cm",
    "J1": "factor f (~8%); amplitud ≤ 0,3 cm",
    "OO1": "factor f (~11%) y u (~2°); amplitud ≤ 0,2 cm",
}


def test_known_divergences_are_absent_from_the_golden_fixture() -> None:
    """El fixture no debe tapar las divergencias conocidas incluyéndolas en el contraste."""
    names = {c["name"] for c in GOLDEN["constituents"]}
    assert not (names & set(KNOWN_NODAL_DIVERGENCES))
