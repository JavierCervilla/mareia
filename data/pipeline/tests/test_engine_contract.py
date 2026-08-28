"""El dataset emitido sólo contiene constantes que el motor de producción sabe calcular.

El motor TypeScript lanza `UnsupportedConstituentError` ante un nombre desconocido, así que un JSON
con una constante de más no degrada: revienta la página del puerto. Este test es el que impide que
eso llegue a `main`.
"""

from __future__ import annotations

import json

import pytest

from mareia_pipeline.engine_contract import ENGINE_CONSTITUENTS, truncate
from mareia_pipeline.schema import station_files
from mareia_pipeline.tides.constituents import CATALOG, SOURCE_NAME_ALIASES, canonical_name
from mareia_pipeline.tides.predict import Harmonic


def test_engine_catalog_has_the_37_noaa_constituents() -> None:
    assert len(ENGINE_CONSTITUENTS) == 37


def test_every_engine_constituent_the_sources_publish_is_synthesizable() -> None:
    """Toda constante que emitimos tiene que saber sintetizarla también el motor de este pipeline.

    `S6`, `MK3` y `2MK3` los soporta el motor de producción pero TICON-4 no los publica, así que no
    llegan nunca al dataset y no hace falta que estén en nuestro catálogo.
    """
    never_published = {"S6", "MK3", "2MK3"}
    missing = ENGINE_CONSTITUENTS - set(CATALOG) - never_published
    assert not missing


def test_aliases_resolve_to_catalog_entries() -> None:
    for source_name, canonical in SOURCE_NAME_ALIASES.items():
        assert canonical_name(source_name) == canonical
        assert canonical in CATALOG
        assert source_name not in CATALOG


def test_truncate_partitions_without_losing_anything() -> None:
    published = [
        Harmonic("M2", 1.0, 0.0),
        Harmonic("EP2", 0.02, 10.0),
        Harmonic("LAM2", 0.01, 20.0),
        Harmonic("2MS6", 0.03, 30.0),
    ]
    result = truncate(published)
    assert [h.name for h in result.kept] == ["M2", "LAM2"]
    assert [h.name for h in result.dropped] == ["2MS6", "EP2"]
    assert result.dropped_amplitude_sum_m == pytest.approx(0.05)


@pytest.mark.parametrize("path", station_files(), ids=lambda p: p.name)
def test_committed_stations_only_use_engine_constituents(path) -> None:
    document = json.loads(path.read_text(encoding="utf-8"))
    names = {c["name"] for c in document["constituents"]}
    assert names <= ENGINE_CONSTITUENTS, sorted(names - ENGINE_CONSTITUENTS)


@pytest.mark.parametrize("path", station_files(), ids=lambda p: p.name)
def test_dropped_constituents_are_recorded_and_disjoint(path) -> None:
    document = json.loads(path.read_text(encoding="utf-8"))
    emitted = {c["name"] for c in document["constituents"]}
    dropped = {c["name"] for c in document["source"]["dropped_constituents"]}
    assert not (emitted & dropped)
    assert not (dropped & ENGINE_CONSTITUENTS)
