"""Reconciliación: de un puñado de mareógrafos candidatos a un registro ``station/v1`` por puerto.

La política de selección es determinista y está ordenada así:

1. **Prioridad de fuente** — REDMAR/Puertos del Estado por delante de TICON-4, cuando exista. Hoy no
   existe: Puertos del Estado no publica constantes armónicas por una vía automatizable (ver el
   informe QC), así que en el piloto todos los puertos salen de TICON-4 y la rama REDMAR queda
   escrita pero sin candidatos.
2. **Licencia** — ``cc-by-4.0`` por delante de ``cc-by-nc-4.0``. La licencia del dataset es **la de
   cada estación**, no una del repositorio: se hereda de la fuente y viaja dentro del propio JSON
   (``source.primary.license`` y ``source.attribution[].license``). Preferir las permisivas es lo que
   evita restringir la reutilización del conjunto más de lo necesario; donde no hay alternativa se
   usa la restrictiva y se declara.
3. **Longitud del registro analizado** — más años de mareógrafo, mejor separación de constituyentes.
4. **Distancia al puerto** — como último desempate.

La distancia manda poco *al elegir* y a propósito: entre dos mareógrafos de la misma dársena
separados cientos de metros las constantes son intercambiables, y lo que de verdad distingue a un
candidato de otro es la licencia y la longitud de su registro. Donde sí manda es *al calificar*: la
distancia del mareógrafo elegido es uno de los umbrales del grade, así que un puerto que sólo tiene
mareógrafo a decenas de kilómetros lo paga ahí y no en una selección peor.

Las candidatas descartadas se emiten en ``source.fallback``, así que la decisión es auditable y
reversible sin volver a ejecutar nada.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Any

from mareia_pipeline.engine_contract import ENGINE_CONSTITUENTS
from mareia_pipeline.ports import Port
from mareia_pipeline.sources.tide_database import REPOSITORY_URL, GaugeRecord, candidates_near

#: Prioridad de conjunto de datos: menor es mejor.
_DATASET_RANK = {"redmar": 0, "noaa": 1, "ticon": 2}

#: Prioridad de licencia: menor es mejor. Una licencia desconocida se ordena la última.
_LICENSE_RANK = {"cc-by-4.0": 0, "public-domain": 0, "cc-by-nc-4.0": 1}

#: Nombre del proyecto que agrega y normaliza las constantes, para la atribución.
_AGGREGATOR_NAME = "openwatersio/tide-database"

#: Dos mareógrafos separados por menos de esto miden, a efectos de constantes, la misma marea. Es el
#: mismo número que el umbral de distancia del grade A (``grade.MAX_GAUGE_DISTANCE_KM['A']``) y lo
#: es a propósito: si a esa distancia el grade considera que el mareógrafo describe el puerto, la
#: selección puede considerar que dos mareógrafos a esa distancia describen el mismo sitio.
SAME_PLACE_RADIUS_KM = 5.0


@dataclass(frozen=True)
class Selection:
    """La estación elegida para un puerto, con las descartadas y por qué se ordenaron así."""

    port: Port
    chosen: GaugeRecord
    chosen_distance_km: float
    rejected: list[tuple[float, GaugeRecord]]


def _sort_key(distance_km: float, gauge: GaugeRecord) -> tuple[int, int, float, float]:
    return (
        _DATASET_RANK.get(gauge.dataset, 9),
        _LICENSE_RANK.get(gauge.license_type, 9),
        -gauge.epoch_years,
        distance_km,
    )


def select(port: Port, gauges: list[GaugeRecord]) -> Selection:
    """Aplica la política de selección al puerto dado.

    La licencia y los años de registro deciden **entre los mareógrafos del mismo sitio**, no entre
    sitios distintos: primero se acota a los que están a menos de ``SAME_PLACE_RADIUS_KM`` del más
    cercano y sólo dentro de ese grupo se ordena por el criterio de arriba. Sin esa acotación, al
    ensanchar el radio de búsqueda a los 60 km que T-13 necesita para la costa sin mareógrafo, un
    puerto podía acabar con las constantes de un mareógrafo mejor documentado a 54 km teniendo otro
    en su propia bocana —le pasó a Gandía en la primera pasada del catálogo completo—, y eso no es
    elegir mejor análisis: es elegir otro mar.
    """
    candidates = candidates_near(gauges, port.lat, port.lon, port.search_radius_km)
    if not candidates:
        raise LookupError(
            f"sin mareógrafos a menos de {port.search_radius_km:g} km de {port.name} ({port.id})"
        )
    nearest_km = min(distance for distance, _ in candidates)
    same_place = [
        item for item in candidates if item[0] <= nearest_km + SAME_PLACE_RADIUS_KM
    ]
    ordered = sorted(same_place, key=lambda item: _sort_key(item[0], item[1]))
    best_distance, best = ordered[0]
    rest = [item for item in candidates if item[1].station_id != best.station_id]
    return Selection(
        port=port,
        chosen=best,
        chosen_distance_km=round(best_distance, 3),
        rejected=sorted(rest, key=lambda item: _sort_key(item[0], item[1])),
    )


def _gauge_reference(distance_km: float, gauge: GaugeRecord) -> dict[str, Any]:
    return {
        "dataset": gauge.source_name,
        "station_id": gauge.station_id,
        "station_name": gauge.name,
        "lat": gauge.lat,
        "lon": gauge.lon,
        "distance_km": round(distance_km, 3),
        "analysis_epoch": {"start": gauge.epoch_start, "end": gauge.epoch_end},
        "license": gauge.license_type,
    }


def _attribution(gauge: GaugeRecord, tarball_sha256: str) -> list[dict[str, str]]:
    entries = [
        {
            "name": gauge.source_name,
            "url": gauge.source_url,
            "license": gauge.license_type,
            "license_url": gauge.license_url,
            "role": "constantes armónicas",
        },
        {
            "name": _AGGREGATOR_NAME,
            "url": REPOSITORY_URL,
            "license": "MIT (código) · licencia de origen por estación (datos)",
            "license_url": f"{REPOSITORY_URL}/blob/main/LICENSE",
            "role": f"agregación y normalización · huella sha256 del contenido {tarball_sha256[:16]}…",
        },
    ]
    if gauge.license_notes:
        entries[0]["notes"] = gauge.license_notes
    return entries


def to_station_v1(
    selection: Selection,
    *,
    quality: dict[str, Any],
    derived_at: dt.datetime,
    tarball_sha256: str,
    extra_attribution: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    """Construye el documento ``station/v1`` de un puerto.

    ``extra_attribution`` es para las fuentes que no aportan constantes pero sí exigen crédito: el
    volcado de GeoNames (CC-BY 4.0) del que sale la identidad de los puertos derivados en T-13. Va
    dentro del propio JSON, como el resto, porque la atribución tiene que viajar con el dato que la
    obliga y no vivir en un README que nadie sirve.
    """
    gauge = selection.chosen
    msl_offset = gauge.msl_offset_m
    if msl_offset is None:
        raise ValueError(f"la estación {gauge.station_id} no publica MSL sobre {gauge.chart_datum!r}")
    return {
        "schema": "station/v1",
        "id": selection.port.id,
        "name": selection.port.name,
        "lat": selection.port.lat,
        "lon": selection.port.lon,
        "timezone": selection.port.timezone,
        "datum": {
            "reference": gauge.chart_datum,
            "msl_offset_m": msl_offset,
        },
        "source": {
            "primary": _gauge_reference(selection.chosen_distance_km, gauge),
            "fallback": [
                _gauge_reference(distance, other) for distance, other in selection.rejected
            ],
            "dropped_constituents": dropped_constituents(gauge),
            "derived_at": derived_at.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "attribution": [*_attribution(gauge, tarball_sha256), *(extra_attribution or [])],
        },
        "constituents": [
            _emit_constituent(constituent)
            for constituent in gauge.constituents
            if constituent["name"] in ENGINE_CONSTITUENTS
        ],
        "quality": quality,
    }


def _emit_constituent(constituent: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": constituent["name"],
        "amplitude_m": round(float(constituent["amplitude"]), 6),
        "phase_deg": round(float(constituent["phase"]) % 360.0, 4),
    }


def dropped_constituents(gauge: GaugeRecord) -> list[dict[str, Any]]:
    """Constantes que la fuente publica y el motor de producción no entiende, de mayor a menor.

    Se emiten dentro del propio JSON para que el error de truncado sea auditable sin volver a
    descargar la fuente: quien lea el dataset ve exactamente qué se dejó fuera y cuánto pesaba.
    """
    return [
        _emit_constituent(constituent)
        for constituent in sorted(gauge.constituents, key=lambda c: -float(c["amplitude"]))
        if constituent["name"] not in ENGINE_CONSTITUENTS
    ]
