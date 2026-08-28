"""El dataset emitido sólo contiene constantes que el motor de producción sabe calcular.

El motor TypeScript lanza `UnsupportedConstituentError` ante un nombre desconocido, así que un JSON
con una constante de más no degrada: revienta la página del puerto. Este test es el que impide que
eso llegue a `main`.
"""

from __future__ import annotations

import json
import re

import pytest

from mareia_pipeline.engine_contract import ENGINE_CONSTITUENTS, truncate
from mareia_pipeline.schema import REPO_ROOT, station_files
from mareia_pipeline.tides.constituents import CATALOG, SOURCE_NAME_ALIASES, canonical_name
from mareia_pipeline.tides.predict import Harmonic

ENGINE_SOURCE = REPO_ROOT / "packages/domain-core/src/tides/constituents.ts"


def test_engine_catalog_has_the_37_noaa_constituents_plus_the_five_of_t04() -> None:
    """37 de NOAA + EP2, MA2, MB2, MKS2 y 2MS6, que T-04 añadió al motor para no truncarlos."""
    assert len(ENGINE_CONSTITUENTS) == 42
    assert {"EP2", "MA2", "MB2", "MKS2", "2MS6"} <= ENGINE_CONSTITUENTS


def test_engine_catalog_matches_the_typescript_engine() -> None:
    """El contrato vive en dos idiomas; este test impide que se separen.

    `ENGINE_CONSTITUENTS` es una copia en Python de `SUPPORTED_CONSTITUENTS` de
    `packages/domain-core`. Una copia sin vigilancia se desincroniza sola: alguien amplía el motor,
    el pipeline sigue truncando de más y nadie se entera hasta que faltan centímetros en la
    predicción. Si esto se rompe porque cambió el formato del fichero TypeScript, arréglalo
    mirando: sale más barato que descubrir la deriva en producción.
    """
    declared = set(re.findall(r'define\("([A-Z0-9]+)"', ENGINE_SOURCE.read_text(encoding="utf-8")))
    assert declared, "no se pudo leer la tabla de constituyentes del motor TypeScript"
    assert declared == set(ENGINE_CONSTITUENTS)


def test_source_aliases_match_the_typescript_engine() -> None:
    """Las grafías alternativas también son contrato: `LAMBDA2`→`LAM2`, `RHO1`→`RHO`."""
    block = re.search(
        r"const ALIASES[^{]*\{(.*?)\}", ENGINE_SOURCE.read_text(encoding="utf-8"), re.DOTALL
    )
    assert block is not None
    declared = dict(re.findall(r'([A-Z0-9]+):\s*"([A-Z0-9]+)"', block.group(1)))
    for source_name, canonical in SOURCE_NAME_ALIASES.items():
        assert declared.get(source_name) == canonical


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
        Harmonic("3L2", 0.02, 10.0),
        Harmonic("LAM2", 0.01, 20.0),
        Harmonic("T3", 0.03, 30.0),
    ]
    result = truncate(published)
    assert [h.name for h in result.kept] == ["M2", "LAM2"]
    assert [h.name for h in result.dropped] == ["T3", "3L2"]
    assert result.dropped_amplitude_sum_m == pytest.approx(0.05)


@pytest.mark.parametrize("path", station_files(), ids=lambda p: p.name)
def test_committed_stations_only_use_engine_constituents(path) -> None:
    document = json.loads(path.read_text(encoding="utf-8"))
    names = {c["name"] for c in document["constituents"]}
    assert names <= ENGINE_CONSTITUENTS, sorted(names - ENGINE_CONSTITUENTS)


#: Constituyentes que el motor **ya** soporta (T-04) pero que el dataset committeado sigue
#: registrando como descartados, porque se generó con el catálogo anterior. La regeneración es
#: T-13; hasta entonces esta es la única grieta consentida entre catálogo y dataset, y está acotada
#: a estos cinco nombres. Cuando el pipeline se re-ejecute, el conjunto se vacía y el test vuelve a
#: ser estricto solo, sin tocar nada.
PENDING_DATASET_REGENERATION: frozenset[str] = frozenset({"EP2", "MA2", "MB2", "MKS2", "2MS6"})


def test_the_pending_regeneration_gap_is_a_subset_of_the_engine_catalog() -> None:
    """La grieta consentida solo puede contener constituyentes que el motor ya sabe calcular."""
    assert PENDING_DATASET_REGENERATION <= ENGINE_CONSTITUENTS


@pytest.mark.parametrize("path", station_files(), ids=lambda p: p.name)
def test_dropped_constituents_are_recorded_and_disjoint(path) -> None:
    document = json.loads(path.read_text(encoding="utf-8"))
    emitted = {c["name"] for c in document["constituents"]}
    dropped = {c["name"] for c in document["source"]["dropped_constituents"]}
    assert not (emitted & dropped)
    assert not (dropped & (ENGINE_CONSTITUENTS - PENDING_DATASET_REGENERATION))
