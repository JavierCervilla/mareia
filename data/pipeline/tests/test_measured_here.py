"""El invariante de T-13: **un puerto sólo publica el error que se ha medido en él**.

T-05 tenía un atajo: si no había mareógrafo del IOC en la dársena, se medía la predicción allí donde
estuviera el mareógrafo que presta las constantes y ese RMSE se publicaba como del puerto. Cabo de
Palos enseñaba el error medido en Cartagena, a 24,8 km. T-13 lo retiró — y la primera versión lo
retiró **sólo en el dato**: se pudo volver a inyectar a mano el RMSE de Alicante en Altea (a 46,2 km)
y toda la suite siguió en verde, porque lo único que cazaba el caso era una aserción clavada a Cabo
de Palos. Un arreglo sin trinquete es un arreglo que dura hasta el siguiente que no lo sepa.

Este fichero es ese trinquete, y ataca por los tres sitios por los que el atajo puede volver:

1. **El artefacto publica la procedencia del número** (`observation_code`, `observation_distance_km`)
   y aquí se comprueba que el número y su procedencia cuadran. Sin esos dos campos, mirando un JSON
   no se puede saber si su RMSE se midió en ese puerto o a treinta kilómetros.
2. **El código busca la observación en la dársena y en ningún otro sitio**, comprobado sobre la
   función que lo hace y no sobre su resultado.
3. **`estimate()` clasifica bien las cuatro combinaciones** de (mareógrafo propio, observación
   propia), que son las cuatro que existen.
"""

from __future__ import annotations

import json
import math

import pytest

import run as pipeline
from mareia_pipeline import grade as grading
from mareia_pipeline.geo import haversine_km
from mareia_pipeline.ports import PILOT_PORTS
from mareia_pipeline.schema import station_files
from mareia_pipeline.sources.ioc import Observations
from tests.test_reconcile_and_schema import _gauge

PORT = PILOT_PORTS[0]


# =====================================================================================
# 1 · El artefacto: el número publicado y su procedencia tienen que cuadrar
# =====================================================================================


@pytest.mark.parametrize("path", station_files(), ids=lambda p: p.name)
def test_a_published_error_was_measured_in_this_port(path) -> None:
    """Si un puerto publica RMSE, la observación con la que se midió estaba **en su dársena**.

    Es la aserción que la regresión de Altea tenía que haber puesto en rojo: allí el RMSE venía del
    mareógrafo de Alicante, a 46,2 km, y ninguna comprobación de coherencia entre campos lo nota
    porque los campos eran coherentes entre sí. Lo que no cuadraba era la **procedencia**, y para
    comprobarla hay que publicarla.
    """
    document = json.loads(path.read_text(encoding="utf-8"))
    quality = document["quality"]
    metrics = quality["metrics"]
    if quality["rmse_m"] is None:
        assert metrics["observation_source"] is None, "hay observación pero no se publica su RMSE"
        assert metrics["observation_distance_km"] is None
        assert metrics["samples"] == 0
        return
    assert metrics["observation_source"] is not None, "RMSE sin decir contra qué se midió"
    assert metrics["samples"] > 0, "RMSE medido contra cero muestras"
    distance = metrics["observation_distance_km"]
    assert distance is not None, "RMSE sin decir a qué distancia se midió"
    assert distance <= pipeline.OBSERVATION_RADIUS_KM, (
        f"el error se midió a {distance} km de la dársena, por encima de los "
        f"{pipeline.OBSERVATION_RADIUS_KM} km que definen «medido aquí»"
    )


@pytest.mark.parametrize("path", station_files(), ids=lambda p: p.name)
def test_the_observation_distance_is_recomputed_not_believed(path) -> None:
    """La distancia a la que se midió se **recalcula** desde las coordenadas publicadas.

    Sin esto, la procedencia de la observación era el único número autodeclarado del artefacto: la
    distancia al mareógrafo de constantes ya se recomputa por haversine desde T-05, pero bastaba
    escribir «0,9 km» junto a un RMSE ajeno para que todas las comprobaciones cuadrasen. Ahora hay
    que falsificar también un par de coordenadas que caigan de verdad en la dársena.
    """
    document = json.loads(path.read_text(encoding="utf-8"))
    metrics = document["quality"]["metrics"]
    if metrics["observation_distance_km"] is None:
        assert metrics["observation_lat"] is None
        assert metrics["observation_lon"] is None
        return
    measured = haversine_km(
        document["lat"], document["lon"], metrics["observation_lat"], metrics["observation_lon"]
    )
    assert measured == pytest.approx(metrics["observation_distance_km"], abs=0.01), (
        "la distancia declarada no es la que hay entre el puerto y el mareógrafo que dice"
    )
    assert measured <= pipeline.OBSERVATION_RADIUS_KM


@pytest.mark.parametrize("path", station_files(), ids=lambda p: p.name)
def test_a_time_error_cannot_exist_without_an_observation(path) -> None:
    """El error de hora sale de emparejar extremos observados: sin observación no puede haberlo."""
    quality = json.loads(path.read_text(encoding="utf-8"))["quality"]
    if quality["rmse_m"] is None:
        assert quality["hw_time_err_p95_min"] is None


@pytest.mark.parametrize("path", station_files(), ids=lambda p: p.name)
def test_the_estimated_flag_is_re_derivable_from_the_artifact(path) -> None:
    """`estimated` no se cree, se recalcula desde el JSON: distancia al mareógrafo + observación.

    Así el flag deja de ser una afirmación del pipeline y pasa a ser una consecuencia comprobable de
    lo que el propio fichero publica. Si alguien lo pone a `false` para que un puerto parezca medido,
    esto lo caza sin salir a la red.
    """
    document = json.loads(path.read_text(encoding="utf-8"))
    quality = document["quality"]
    own_gauge = document["source"]["primary"]["distance_km"] <= grading.MAX_GAUGE_DISTANCE_KM["A"]
    own_observation = quality["metrics"]["observation_source"] is not None
    assert quality["estimated"] == (not (own_gauge and own_observation))
    assert (quality["estimated_reason"] is not None) == quality["estimated"]


# =====================================================================================
# 2 · El código: la observación se busca en la dársena, no donde esté el mareógrafo
# =====================================================================================


def test_the_observation_is_only_looked_for_in_the_port_itself(monkeypatch) -> None:
    """Un solo intento, con las coordenadas del puerto y el radio de la dársena.

    Comprobar el resultado no basta: el atajo de T-05 era una **segunda llamada** con las
    coordenadas del mareógrafo, y desde fuera se veía igual que la primera. Lo que este test fija es
    que esa segunda llamada no existe.
    """
    calls: list[dict[str, object]] = []

    def spy(lat, lon, *, days, max_km, refresh):
        calls.append({"lat": lat, "lon": lon, "days": days, "max_km": max_km})
        return

    far_away = _gauge("prestado", lat=PORT.lat + 0.15, lon=PORT.lon)
    monkeypatch.setattr(pipeline.ioc, "fetch_observations", spy)
    selection, metrics = pipeline._evaluate_port(PORT, [far_away], refresh=False)

    assert len(calls) == 1, f"se buscó la observación en {len(calls)} sitios, no sólo en la dársena"
    assert calls[0]["lat"] == PORT.lat
    assert calls[0]["lon"] == PORT.lon
    assert calls[0]["max_km"] == pipeline.OBSERVATION_RADIUS_KM
    # Y sin observación propia no se publica ningún error, por muy bueno que fuera el mareógrafo.
    assert selection.chosen.station_id == "prestado"
    assert metrics.rmse_m is None
    assert metrics.hw_time_err_p95_min is None
    assert metrics.observation_distance_km is None


def test_an_observation_in_the_harbour_is_published_with_its_provenance(monkeypatch) -> None:
    """El caso contrario: cuando la observación existe, viaja con su código y su distancia."""
    import datetime as dt

    times = [
        dt.datetime(2026, 8, 1, tzinfo=dt.timezone.utc) + dt.timedelta(minutes=i) for i in range(600)
    ]
    observed = Observations(
        code="vig2",
        location="Vigo",
        distance_km=1.234,
        lat=PORT.lat + 0.01,
        lon=PORT.lon,
        times=times,
        # Una señal que se mueve: con nivel constante la varianza es cero y el R² sale de dividir
        # por cero, que es ruido del fixture y no del código bajo prueba.
        levels=[2.0 + math.sin(i / 60.0) for i in range(len(times))],
    )
    monkeypatch.setattr(
        pipeline.ioc, "fetch_observations", lambda *a, **k: observed
    )
    _, metrics = pipeline._evaluate_port(
        PORT, [_gauge("propio", lat=PORT.lat, lon=PORT.lon)], refresh=False
    )
    assert metrics.observation_code == "vig2"
    assert metrics.observation_distance_km == 1.234
    assert metrics.observation_lat == PORT.lat + 0.01
    assert metrics.rmse_m is not None


# =====================================================================================
# 3 · Las cuatro combinaciones de `estimate()`, que son todas las que hay
# =====================================================================================


def test_only_own_gauge_and_own_observation_counts_as_measured() -> None:
    result = grading.estimate(gauge_id="g", gauge_distance_km=0.8, observation_source="IOC vig2")
    assert result.estimated is False
    assert result.reason is None


def test_a_borrowed_gauge_without_observation_is_estimated_and_says_both_things() -> None:
    result = grading.estimate(gauge_id="cartagenatg", gauge_distance_km=24.8, observation_source=None)
    assert result.estimated is True
    assert "24.8 km" in result.reason
    assert "no hay observaciones" in result.reason


def test_a_borrowed_gauge_with_its_own_observation_is_still_estimated() -> None:
    """Garachico: hay error medido aquí, pero las constantes describen otro sitio."""
    result = grading.estimate(
        gauge_id="tenerife-228a", gauge_distance_km=20.6, observation_source="IOC tene"
    )
    assert result.estimated is True
    assert "20.6 km" in result.reason
    assert "no hay observaciones" not in result.reason


def test_an_own_gauge_without_observation_is_estimated_for_the_other_reason() -> None:
    """Cádiz: el mareógrafo está en la dársena, pero nadie ha contrastado su predicción aquí."""
    result = grading.estimate(gauge_id="cadiz-cadi", gauge_distance_km=0.72, observation_source=None)
    assert result.estimated is True
    assert "no hay observaciones" in result.reason
    assert "de la dársena" not in result.reason


def test_the_measured_threshold_is_the_same_one_the_grade_uses() -> None:
    """Si el umbral de «mareógrafo propio» y el de grade A se separan, hay dos varas de medir."""
    a_threshold = grading.MAX_GAUGE_DISTANCE_KM["A"]
    assert grading.estimate(
        gauge_id="g", gauge_distance_km=a_threshold, observation_source="IOC x"
    ).estimated is False
    assert grading.estimate(
        gauge_id="g", gauge_distance_km=a_threshold + 0.001, observation_source="IOC x"
    ).estimated is True
