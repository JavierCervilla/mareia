"""Observaciones de nivel del mar del IOC Sea Level Monitoring Facility.

**Sólo para validación interna.** El nivel observado se usa para medir el error de nuestra
predicción y no se redistribuye ni se commitea: se queda en la caché ignorada por git. Lo que sí se
publica son las métricas agregadas (RMSE, error de extremos) del informe QC.

El servicio ``service.php`` trunca la respuesta a ~1.000 filas independientemente del periodo
pedido, así que usamos ``bgraph.php?output=tab``, que devuelve la serie completa como tabla HTML.
"""

from __future__ import annotations

import datetime as dt
import json
import re
from dataclasses import dataclass

from mareia_pipeline.geo import haversine_km
from mareia_pipeline.sources import cache

STATION_LIST_URL = (
    "https://www.ioc-sealevelmonitoring.org/service.php?query=stationlist&showall=all&format=json"
)
ATTRIBUTION_URL = "https://www.ioc-sealevelmonitoring.org/"

_ROW = re.compile(
    r"<tr><td>(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)</td><td[^>]*>\s*(-?\d+(?:\.\d+)?)\s*</td></tr>"
)


@dataclass(frozen=True)
class Observations:
    """Serie observada de nivel del mar en un mareógrafo, en UTC y metros."""

    code: str
    location: str
    distance_km: float
    times: list[dt.datetime]
    levels: list[float]

    @property
    def span_days(self) -> float:
        if len(self.times) < 2:
            return 0.0
        return (self.times[-1] - self.times[0]).total_seconds() / 86400.0


def _series_url(code: str, days: int) -> str:
    return f"https://www.ioc-sealevelmonitoring.org/bgraph.php?code={code}&output=tab&period={days}"


def nearby_codes(lat: float, lon: float, *, max_km: float, refresh: bool = False) -> list[tuple[float, str, str]]:
    """``(distancia_km, código, nombre)`` de los mareógrafos IOC cercanos, de más cerca a más lejos."""
    stations = json.loads(cache.fetch(STATION_LIST_URL, suffix=".json", refresh=refresh))
    found: list[tuple[float, str, str]] = []
    for station in stations:
        if station.get("Lat") is None or station.get("Lon") is None:
            continue
        distance = haversine_km(lat, lon, float(station["Lat"]), float(station["Lon"]))
        if distance <= max_km:
            found.append((distance, str(station.get("Code", "")), str(station.get("Location", ""))))
    return sorted(found)


def fetch_observations(
    lat: float,
    lon: float,
    *,
    days: int,
    max_km: float = 5.0,
    min_samples: int = 5000,
    refresh: bool = False,
) -> Observations | None:
    """Serie observada más cercana con datos suficientes, o ``None`` si ninguna sirve.

    Se prueban los mareógrafos por proximidad y se acepta el primero que devuelva al menos
    ``min_samples`` medidas: un código puede existir en el catálogo y estar mudo.
    """
    for distance, code, location in nearby_codes(lat, lon, max_km=max_km, refresh=refresh):
        if not code:
            continue
        try:
            body = cache.fetch(_series_url(code, days), suffix=".html", refresh=refresh)
        except OSError:
            continue
        rows = _ROW.findall(body.decode("utf-8", "replace"))
        if len(rows) < min_samples:
            continue
        parsed = sorted(
            (
                dt.datetime.strptime(stamp, "%Y-%m-%d %H:%M:%S").replace(tzinfo=dt.timezone.utc),
                float(level),
            )
            for stamp, level in rows
        )
        return Observations(
            code=code,
            location=location,
            distance_km=round(distance, 3),
            times=[t for t, _ in parsed],
            levels=[v for _, v in parsed],
        )
    return None
