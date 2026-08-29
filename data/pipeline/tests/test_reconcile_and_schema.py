"""La política de reconciliación ordena como dice, y lo emitido valida contra el schema."""

from __future__ import annotations

import datetime as dt
import json
import pathlib

import pytest

from mareia_pipeline import catalog, validate
from mareia_pipeline import grade as grading
from mareia_pipeline.geo import haversine_km
from mareia_pipeline.ports import PILOT_PORTS
from mareia_pipeline.reconcile import is_redistributable, select, to_station_v1
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


def _latest_qc_report() -> str:
    """El informe QC más reciente de `reports/`, que es el que acompaña al dataset commiteado."""
    reports = sorted((pathlib.Path(__file__).parents[1] / "reports").glob("QC-*.md"))
    assert reports, "no hay informe QC commiteado"
    return reports[-1].read_text(encoding="utf-8")


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
    """La rama REDMAR está escrita aunque hoy no tenga candidatos: cuando los tenga, manda.

    «Restringida» aquí es no comercial, que **sí** se puede redistribuir: el rango sigue decidiendo
    entre las publicables, que es justo lo que el filtro de T-14A no toca. La otra mitad de la
    frase —una fuente que no se puede republicar no gana ni con el mejor rango— es el gate de
    inyección de más abajo.
    """
    ticon = _gauge("ticon", lat=PORT.lat, lon=PORT.lon)
    redmar = _gauge(
        "redmar", dataset="redmar", license_type="cc-by-nc-4.0", lat=PORT.lat + 0.02, lon=PORT.lon
    )
    assert select(PORT, [ticon, redmar]).chosen.station_id == "redmar"


# --- Gate de inyección (T-14A): el permiso de redistribución filtra ANTES de que el rango ordene ---
#
# La mina que esto desactiva: `_DATASET_RANK` daba a REDMAR la máxima prioridad de fuente, y las
# condiciones del banco de datos de Puertos del Estado dicen «en ningún caso se permite la
# transferencia de los datos a terceros». Hoy no hay vía de ingesta y ninguna estación viene de ahí,
# así que no hay incidente: lo que había era que el día que la hubiera, el pipeline la habría
# elegido la primera y publicado lo que no puede publicarse. Estos recorridos **inyectan** esa
# fuente en la elección —el mejor rango, la más cercana y el registro más largo— y exigen que pierda.

#: Una licencia que no autoriza republicar. No es «no comercial» (esas sí valen y son 104 estaciones
#: del catálogo): es la cláusula de no transferencia a terceros.
NO_REDISTRIBUTION = "puertos-del-estado-banco-de-datos"


def test_a_source_that_cannot_be_redistributed_loses_despite_the_best_rank() -> None:
    """Inyectada con rango 0, en la propia dársena y con el registro más largo: no gana."""
    injected = _gauge(
        "redmar-inyectada",
        dataset="redmar",
        license_type=NO_REDISTRIBUTION,
        start="1990-01-01",
        lat=PORT.lat,
        lon=PORT.lon,
    )
    publishable = _gauge("ticon", start="2010-01-01", lat=PORT.lat + 0.02, lon=PORT.lon)
    selection = select(PORT, [injected, publishable])
    assert selection.chosen.station_id == "ticon"
    assert [g.station_id for _, g in selection.excluded_by_license] == ["redmar-inyectada"]
    assert [g.station_id for _, g in selection.rejected] == []


def test_an_excluded_source_does_not_even_reach_the_published_json() -> None:
    """Ni elegida ni como `fallback`: el artefacto publicado no la menciona en ningún sitio."""
    injected = _gauge(
        "redmar-inyectada", dataset="redmar", license_type=NO_REDISTRIBUTION,
        lat=PORT.lat, lon=PORT.lon,
    )
    selection = select(PORT, [injected, _gauge("ticon", lat=PORT.lat + 0.02, lon=PORT.lon)])
    document = to_station_v1(
        selection,
        quality={},
        derived_at=dt.datetime(2026, 1, 1, tzinfo=dt.UTC),
        tarball_sha256="0" * 64,
    )
    assert "redmar-inyectada" not in json.dumps(document)
    assert NO_REDISTRIBUTION not in json.dumps(document)


def test_a_license_nobody_has_read_is_excluded_by_default() -> None:
    """El defecto es excluir: una licencia nueva no entra por el hecho de existir."""
    assert not is_redistributable("licencia-nueva-de-la-fuente-de-aguas-arriba")
    unknown = _gauge(
        "sin-revisar", license_type="licencia-nueva-de-la-fuente-de-aguas-arriba",
        start="1990-01-01", lat=PORT.lat, lon=PORT.lon,
    )
    known = _gauge("ticon", start="2010-01-01", lat=PORT.lat + 0.02, lon=PORT.lon)
    assert select(PORT, [unknown, known]).chosen.station_id == "ticon"


def test_the_licenses_of_the_committed_dataset_are_all_redistributable() -> None:
    """Lo publicado cumple el filtro: si algún día no lo cumpliera, no habría que descubrirlo fuera."""
    for path in station_files():
        document = json.loads(path.read_text(encoding="utf-8"))
        license_type = document["source"]["primary"]["license"]
        assert is_redistributable(license_type), f"{path.name} publica {license_type}"


def test_a_port_whose_only_gauge_cannot_be_redistributed_is_not_published() -> None:
    """Sin candidata publicable no se publica el puerto, y el fallo nombra a la excluida.

    La alternativa —elegirla igualmente y avisar— es la que no tiene arreglo posterior: un puerto
    que falta se ve el mismo día; un dato republicado sin permiso, ya está fuera.
    """
    only = _gauge("redmar-inyectada", dataset="redmar", license_type=NO_REDISTRIBUTION,
                  lat=PORT.lat, lon=PORT.lon)
    with pytest.raises(LookupError, match="redmar-inyectada"):
        select(PORT, [only])


def test_the_nearest_darsena_wins_before_the_license_and_the_record() -> None:
    """Licencia y años de registro deciden **dentro** del mismo sitio, nunca entre sitios distintos.

    Es el fallo que destapó el primer catálogo completo de T-13: con el radio de búsqueda ensanchado
    a 60 km, Gandía se llevó las constantes del mareógrafo de Valencia (mejor licencia y registro
    más largo, a 54 km) teniendo uno en su propia bocana. Elegir mejor análisis a 54 km no es elegir
    mejor: es describir otro mar.
    """
    in_the_harbour = _gauge("bocana", license_type="cc-by-nc-4.0", start="2015-01-01",
                            lat=PORT.lat, lon=PORT.lon)
    far_but_better = _gauge("lejos", lat=PORT.lat + 0.15, lon=PORT.lon)
    selection = select(PORT, [in_the_harbour, far_but_better])
    assert selection.chosen.station_id == "bocana"
    assert [g.station_id for _, g in selection.rejected] == ["lejos"]


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
    # Los puertos derivados del catálogo (T-13) no están en `PILOT_PORTS`, así que su cota es la
    # general: ningún puerto del dataset toma prestadas constantes de más lejos de `MAX_BORROW_KM`,
    # y los del piloto siguen atados además a su radio propio, más estrecho.
    assert measured <= catalog.MAX_BORROW_KM
    pilot = next((p for p in PILOT_PORTS if p.id == document["id"]), None)
    if pilot is not None:
        assert measured <= pilot.search_radius_km


@pytest.mark.parametrize("path", station_files(), ids=lambda p: p.name)
def test_a_borrowed_gauge_cannot_be_published_as_grade_a(path) -> None:
    """Un puerto que toma prestadas las constantes de lejos no puede figurar como grade A."""
    document = json.loads(path.read_text(encoding="utf-8"))
    if document["source"]["primary"]["distance_km"] > grading.MAX_GAUGE_DISTANCE_KM["A"]:
        assert document["quality"]["grade"] != "A"


def test_report_justifies_unmeasurability_with_the_in_window_counter() -> None:
    """El informe debe citar el mismo contador con el que se toma la decisión.

    El término de comparación es el de la ventana observada, no el de los 30 días. Publicar el de
    los 30 días dejaba un informe cuyas propias cuentas contradecían su conclusión: en Cartagena,
    "197 frente a 104" da ×1,9 —por debajo del corte— cuando el ratio realmente aplicado era ×5,8.
    """
    report_text = _latest_qc_report()
    for path in station_files():
        document = json.loads(path.read_text(encoding="utf-8"))
        metrics = document["quality"]["metrics"]
        if metrics["extremes_usable"] or not metrics["samples"]:
            continue
        in_window = metrics["predicted_extremes_in_window"]
        observed = metrics["observed_extremes"]
        assert observed > validate.MAX_OBSERVED_EXTREMES_RATIO * max(in_window, 1)
        assert f"{observed} extremos observados frente a {in_window} de marea" in report_text


def test_report_publishes_the_measurability_threshold() -> None:
    assert "Extremos observados por cada uno de marea" in _latest_qc_report()


def test_every_station_publishes_both_extreme_counters() -> None:
    """Sin los dos contadores en el JSON, la decisión no es reproducible desde los artefactos."""
    for path in station_files():
        metrics = json.loads(path.read_text(encoding="utf-8"))["quality"]["metrics"]
        assert "observed_extremes" in metrics
        assert "predicted_extremes_in_window" in metrics
