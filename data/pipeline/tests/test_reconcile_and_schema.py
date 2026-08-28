"""La política de reconciliación ordena como dice, y lo emitido valida contra el schema."""

from __future__ import annotations

import json

import pytest

from mareia_pipeline.geo import haversine_km
from mareia_pipeline.ports import PILOT_PORTS
from mareia_pipeline.reconcile import select
from mareia_pipeline.schema import station_files, validation_errors
from mareia_pipeline.sources.tide_database import GaugeRecord


def _gauge(
    station_id: str,
    *,
    dataset: str = "ticon",
    license_type: str = "cc-by-4.0",
    start: str = "2000-01-01",
    end: str = "2019-01-01",
    lat: float = 42.24,
    lon: float = -8.72,
) -> GaugeRecord:
    return GaugeRecord(
        dataset=dataset,
        station_id=station_id,
        name=station_id,
        lat=lat,
        lon=lon,
        country="Spain",
        license_type=license_type,
        license_url="https://example.invalid/license",
        license_commercial_use=license_type == "cc-by-4.0",
        license_notes="",
        source_name="TICON-4",
        source_url="https://example.invalid/source",
        chart_datum="LAT",
        datums={"LAT": 0.0, "MSL": 2.0},
        datums_source="observed",
        epoch_start=start,
        epoch_end=end,
        disclaimers="",
        constituents=[{"name": "M2", "amplitude": 1.0, "phase": 30.0}],
    )


PORT = PILOT_PORTS[0]


def test_permissive_license_wins_over_proximity() -> None:
    """Entre dos mareógrafos de la misma dársena, la licencia decide antes que la distancia."""
    nearer_but_restricted = _gauge("nc", license_type="cc-by-nc-4.0", lat=PORT.lat, lon=PORT.lon)
    farther_but_open = _gauge("open", lat=PORT.lat + 0.01, lon=PORT.lon)
    chosen = select(PORT, [nearer_but_restricted, farther_but_open]).chosen
    assert chosen.station_id == "open"


def test_longer_record_wins_when_the_license_ties() -> None:
    short = _gauge("short", start="2015-01-01", end="2019-01-01", lat=PORT.lat, lon=PORT.lon)
    long = _gauge("long", start="2000-01-01", end="2019-01-01", lat=PORT.lat + 0.01, lon=PORT.lon)
    assert select(PORT, [short, long]).chosen.station_id == "long"


def test_redmar_would_outrank_ticon_even_if_restricted() -> None:
    """La rama REDMAR está escrita aunque hoy no tenga candidatos: cuando los tenga, manda."""
    ticon = _gauge("ticon", lat=PORT.lat, lon=PORT.lon)
    redmar = _gauge("redmar", dataset="redmar", license_type="cc-by-nc-4.0", lat=PORT.lat + 0.05, lon=PORT.lon)
    assert select(PORT, [ticon, redmar]).chosen.station_id == "redmar"


def test_rejected_candidates_are_kept_for_the_audit_trail() -> None:
    selection = select(
        PORT,
        [
            _gauge("open", lat=PORT.lat, lon=PORT.lon),
            _gauge("nc", license_type="cc-by-nc-4.0", lat=PORT.lat, lon=PORT.lon),
        ],
    )
    assert [g.station_id for _, g in selection.rejected] == ["nc"]


def test_a_port_without_any_gauge_fails_loudly() -> None:
    with pytest.raises(LookupError):
        select(PORT, [_gauge("far", lat=0.0, lon=0.0)])


def test_port_ids_are_unique_and_canonically_shaped() -> None:
    identifiers = [port.id for port in PILOT_PORTS]
    assert len(set(identifiers)) == len(identifiers)
    for port in PILOT_PORTS:
        assert port.id == port.id.lower()
        assert len(port.id.split("-")) >= 3


def test_every_pilot_port_has_a_committed_dataset_file() -> None:
    written = {path.name for path in station_files()}
    for port in PILOT_PORTS:
        assert port.output.rsplit("/", 1)[-1] in written


@pytest.mark.parametrize("path", station_files(), ids=lambda p: p.name)
def test_committed_station_validates_against_the_schema(path) -> None:
    errors = validation_errors(json.loads(path.read_text(encoding="utf-8")))
    assert not errors, errors


@pytest.mark.parametrize("path", station_files(), ids=lambda p: p.name)
def test_chosen_gauge_is_actually_near_the_port(path) -> None:
    """El JSON declara una distancia; que sea la que de verdad hay entre las coordenadas."""
    document = json.loads(path.read_text(encoding="utf-8"))
    primary = document["source"]["primary"]
    measured = haversine_km(document["lat"], document["lon"], primary["lat"], primary["lon"])
    assert measured == pytest.approx(primary["distance_km"], abs=0.01)
    assert measured < 25.0
