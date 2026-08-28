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
#: a estos cinco nombres.
#:
#: Esta lista **no caduca sola**: la caduca el test de abajo, que exige que sea exactamente la
#: grieta que hay en el dataset. En cuanto T-13 regenere, los cinco dejarán de figurar como
#: descartados, el test se pondrá en rojo y habrá que borrar la lista —que es justo lo que se
#: quiere, porque una excepción que sobrevive a su motivo deja de ser una excepción y pasa a ser un
#: agujero: la aserción que relaja (`dropped ∩ ENGINE = ∅`) es la que avisaría de que T-13
#: regeneró sin recoger estos cinco.
PENDING_DATASET_REGENERATION: frozenset[str] = frozenset({"EP2", "MA2", "MB2", "MKS2", "2MS6"})


def test_the_pending_regeneration_gap_is_exactly_the_gap_in_the_dataset() -> None:
    """La grieta consentida tiene que ser un hecho del dataset committeado, no una excusa.

    Se compara por **igualdad** en los dos sentidos, y cada uno atrapa un fallo distinto:

    - Un nombre en la lista que ya no esté descartado en ningún JSON = la regeneración ocurrió y la
      excepción se quedó puesta. Rojo, y se borra la lista.
    - Un constituyente del motor descartado en algún JSON sin estar en la lista = deriva nueva entre
      catálogo y dataset, que es exactamente lo que este fichero existe para impedir.

    Aviso para T-13: regenerar mueve el coeficiente de marea. Brest descarta 6,75 cm en estos cinco
    (EP2 1,97 · 2MS6 1,68 · MB2 1,24 · MA2 1,10 · MKS2 0,76), de los que 5,07 cm son de especie 2 y
    entran por tanto en el cálculo del coeficiente. Simulado sobre los 32 valores publicados del
    golden `packages/domain-core/src/coefficient/__tests__/fixtures/`: los coeficientes se mueven
    hasta 2 unidades y tres de ellos se irían a 3 unidades de error, fuera de la tolerancia de ±2.
    Es un rojo honesto —el dataset mejora— y toca revisarlo allí, no silenciarlo aquí.
    """
    dropped_in_dataset: set[str] = set()
    for path in station_files():
        document = json.loads(path.read_text(encoding="utf-8"))
        dropped_in_dataset |= {c["name"] for c in document["source"]["dropped_constituents"]}
    assert PENDING_DATASET_REGENERATION == dropped_in_dataset & ENGINE_CONSTITUENTS


@pytest.mark.parametrize("path", station_files(), ids=lambda p: p.name)
def test_dropped_constituents_are_recorded_and_disjoint(path) -> None:
    document = json.loads(path.read_text(encoding="utf-8"))
    emitted = {c["name"] for c in document["constituents"]}
    dropped = {c["name"] for c in document["source"]["dropped_constituents"]}
    assert not (emitted & dropped)
    assert not (dropped & (ENGINE_CONSTITUENTS - PENDING_DATASET_REGENERATION))
