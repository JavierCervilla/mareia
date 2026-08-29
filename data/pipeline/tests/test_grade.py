"""El grade se gana por exactitud y nunca por redondeo."""

from __future__ import annotations

import dataclasses

import pytest

from mareia_pipeline import grade as grading
from mareia_pipeline.validate import Metrics

_EXCELLENT = Metrics(
    window_start="2026-07-29T00:00:00Z",
    window_days=30.0,
    samples=43000,
    predicted_range_m=4.0,
    rmse_m=0.05,
    nrmse=0.0125,
    r2=0.997,
    hw_time_err_p95_min=10.0,
    hw_height_err_p95_m=0.09,
    matched_extremes=116,
    predicted_extremes=116,
    predicted_extremes_in_window=116,
    observed_extremes=116,
    extremes_usable=True,
    cross_rmse_m=0.004,
    cross_source="otro-mareógrafo",
    cross_rmse_worst_m=0.02,
    cross_source_worst="otro-mareógrafo-viejo",
    truncation_rms_m=0.005,
    dropped_amplitude_m=0.03,
    dropped_amplitude_fraction=0.01,
    dropped_constituents=["EP2"],
    observation_source="IOC test",
    observation_code="test",
    observation_distance_km=1.0,
    observation_lat=42.24,
    observation_lon=-8.72,
)


def _with(**changes: object) -> Metrics:
    return dataclasses.replace(_EXCELLENT, **changes)


def test_an_excellent_port_earns_a() -> None:
    assert grading.assign(_EXCELLENT, epoch_years=19.0).grade == "A"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("nrmse", grading.MAX_NRMSE["A"] + 1e-9),
        ("hw_time_err_p95_min", grading.MAX_EXTREME_TIME_P95_MIN["A"] + 1e-9),
        ("truncation_rms_m", grading.MAX_TRUNCATION_RMS_M["A"] + 1e-9),
        ("cross_rmse_m", grading.MAX_CROSS_RMSE_M["A"] + 1e-9),
    ],
)
def test_a_hair_over_the_threshold_drops_the_grade(field: str, value: float) -> None:
    """Rebasar el umbral por una millonésima baja de grade: nada de redondear hacia arriba."""
    assert grading.assign(_with(**{field: value}), epoch_years=19.0).grade != "A"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("nrmse", grading.MAX_NRMSE["A"]),
        ("hw_time_err_p95_min", grading.MAX_EXTREME_TIME_P95_MIN["A"]),
        ("truncation_rms_m", grading.MAX_TRUNCATION_RMS_M["A"]),
    ],
)
def test_exactly_on_the_threshold_still_passes(field: str, value: float) -> None:
    assert grading.assign(_with(**{field: value}), epoch_years=19.0).grade == "A"


def test_a_short_record_cannot_reach_a() -> None:
    assert grading.assign(_EXCELLENT, epoch_years=3.0).grade == "B"


def test_a_distant_gauge_cannot_reach_a() -> None:
    """Un puerto sin mareógrafo propio no hereda el grade del que le presta las constantes."""
    borrowed = grading.assign(_EXCELLENT, epoch_years=19.0, gauge_distance_km=25.0)
    assert borrowed.grade == "B"
    assert "km" in borrowed.reason


def test_a_gauge_beyond_the_b_radius_is_grade_c() -> None:
    assert grading.assign(_EXCELLENT, epoch_years=19.0, gauge_distance_km=40.0).grade == "C"


def test_observations_alone_are_enough_for_a() -> None:
    """Un puerto con un solo mareógrafo no es peor por tenerlo: el contraste es veto, no requisito."""
    solitary = _with(cross_rmse_m=None, cross_source=None, cross_rmse_worst_m=None, cross_source_worst=None)
    assert grading.assign(solitary, epoch_years=19.0).grade == "A"


def test_a_contradicting_second_analysis_vetoes() -> None:
    assert grading.assign(_with(cross_rmse_m=0.4), epoch_years=19.0).grade == "C"


def test_without_observations_corroboration_only_reaches_b() -> None:
    blind = _with(
        rmse_m=None,
        nrmse=None,
        r2=None,
        hw_time_err_p95_min=None,
        observation_source=None,
        observation_code=None,
        observation_distance_km=None,
        observation_lat=None,
        observation_lon=None,
    )
    result = grading.assign(blind, epoch_years=19.0)
    assert result.grade == "B"
    assert "observaciones" in result.reason


def test_without_observations_nor_corroboration_the_grade_is_c() -> None:
    blind = _with(
        rmse_m=None,
        nrmse=None,
        r2=None,
        hw_time_err_p95_min=None,
        observation_source=None,
        observation_code=None,
        observation_distance_km=None,
        observation_lat=None,
        observation_lon=None,
        cross_rmse_m=None,
        cross_source=None,
        cross_rmse_worst_m=None,
        cross_source_worst=None,
    )
    assert grading.assign(blind, epoch_years=19.0).grade == "C"


def test_the_reason_always_explains_why_it_did_not_go_higher() -> None:
    for metrics, years in [(_EXCELLENT, 3.0), (_with(nrmse=0.3), 19.0)]:
        result = grading.assign(metrics, years)
        assert result.reason and result.grade in {"B", "C"}
        assert result.reason.startswith("no alcanza")


def test_the_reason_names_every_unmet_threshold_not_just_the_first() -> None:
    """Un puerto lejos **y** sin observación tiene que decir las dos cosas.

    Es el caso mayoritario desde T-13 —un puerto que toma prestadas las constantes de más de 30 km y
    no tiene mareógrafo propio con el que validar— y el primer arreglo de esto lo dejaba fuera: 39
    puertos publicaban un motivo que sólo culpaba a la distancia. La frase se imprime en la página,
    así que callar la mitad del motivo es publicar media verdad.
    """
    borrowed_and_blind = _with(
        rmse_m=None,
        nrmse=None,
        r2=None,
        hw_time_err_p95_min=None,
        observation_source=None,
        observation_code=None,
        observation_distance_km=None,
        observation_lat=None,
        observation_lon=None,
        cross_rmse_m=None,
        cross_source=None,
        cross_rmse_worst_m=None,
        cross_source_worst=None,
    )
    result = grading.assign(borrowed_and_blind, epoch_years=19.0, gauge_distance_km=46.2)
    assert result.grade == "C"
    assert "46.2 km" in result.reason
    assert "sin observaciones ni segunda fuente" in result.reason


def test_a_port_that_fails_two_a_thresholds_names_both() -> None:
    """El caso de Vigo en T-05: truncado alto **y** error de hora alto, y sólo se contaba uno."""
    two_faults = _with(truncation_rms_m=0.013, hw_time_err_p95_min=25.4)
    result = grading.assign(two_faults, epoch_years=19.0, gauge_distance_km=0.8)
    assert result.grade == "B"
    assert "coste de truncar" in result.reason
    assert "error de hora de extremo p95" in result.reason
