"""Fuente primaria de constantes armónicas: la base pública ``neaps/tide-database``.

Es un agregador de constantes publicadas —NOAA y **TICON-4** (DGFI-TUM, derivado de los registros
mareográficos GESLA-4)— que normaliza cada estación a un JSON con amplitudes en metros y **fases
referidas a Greenwich (UTC)**, además de conservar la licencia de origen estación por estación.

Se trae el repositorio con un ``git fetch`` **superficial de un commit concreto** (una operación, no
~8000 peticiones a la API) y se leen las estaciones del árbol resultante. El pin es lo que hace el
pipeline reproducible: la misma orden dentro de un año produce el mismo dataset. Se usa `git` y no
el tarball de GitHub a propósito, porque los endpoints de archivo (``codeload``, ``/archive``,
``/tarball``) exigen credenciales en entornos con política de egreso y ``git`` no.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from mareia_pipeline.geo import haversine_km
from mareia_pipeline.sources.cache import CACHE_DIR
from mareia_pipeline.tides.constituents import canonical_name

#: Commit fijado de openwatersio/tide-database. Subirlo es un cambio de datos deliberado que debe
#: pasar por el informe QC (las métricas cambian y los grades pueden moverse).
PINNED_COMMIT = "ac4b610af86fc38850cd2cdcc6d4a7aed314dd56"
REPOSITORY_URL = "https://github.com/openwatersio/tide-database"
CLONE_DIR = CACHE_DIR / "tide-database"


@dataclass(frozen=True)
class GaugeRecord:
    """Una estación mareográfica de la base, con lo que necesitamos para reconciliar y emitir."""

    dataset: str
    station_id: str
    name: str
    lat: float
    lon: float
    country: str
    license_type: str
    license_url: str
    license_commercial_use: bool
    license_notes: str
    source_name: str
    source_url: str
    chart_datum: str
    datums: dict[str, float]
    datums_source: str
    epoch_start: str
    epoch_end: str
    disclaimers: str
    constituents: list[dict[str, float]]

    @property
    def epoch_years(self) -> float:
        """Longitud en años del registro del que se analizaron las constantes."""
        start_year = int(self.epoch_start[:4])
        end_year = int(self.epoch_end[:4])
        return float(end_year - start_year)

    @property
    def msl_offset_m(self) -> float | None:
        """Altura del nivel medio del mar sobre el cero hidrográfico de la estación."""
        if "MSL" not in self.datums or self.chart_datum not in self.datums:
            return None
        return round(self.datums["MSL"] - self.datums[self.chart_datum], 4)


def _to_record(dataset: str, raw: dict[str, Any]) -> GaugeRecord | None:
    source = raw.get("source") or {}
    licence = raw.get("license") or {}
    epoch = raw.get("epoch") or {}
    if raw.get("type") != "reference" or not raw.get("harmonic_constituents"):
        return None
    if "latitude" not in raw or "longitude" not in raw:
        return None
    return GaugeRecord(
        dataset=dataset,
        station_id=str(source.get("id", "")),
        name=str(raw.get("name", "")),
        lat=float(raw["latitude"]),
        lon=float(raw["longitude"]),
        country=str(raw.get("country", "")),
        license_type=str(licence.get("type", "unknown")),
        license_url=str(licence.get("url", "")),
        license_commercial_use=bool(licence.get("commercial_use", False)),
        license_notes=str(licence.get("notes", "")),
        source_name=str(source.get("name", dataset)),
        source_url=str(source.get("url", "")),
        chart_datum=str(raw.get("chart_datum", "")),
        datums={k: float(v) for k, v in (raw.get("datums") or {}).items()},
        datums_source=str(raw.get("datums_source", "")),
        epoch_start=str(epoch.get("start", "")),
        epoch_end=str(epoch.get("end", "")),
        disclaimers=str(raw.get("disclaimers", "")),
        constituents=[
            {
                "name": canonical_name(str(c["name"])),
                "amplitude": float(c["amplitude"]),
                "phase": float(c["phase"]),
            }
            for c in raw["harmonic_constituents"]
        ],
    )


def _git(*args: str, cwd: Path) -> None:
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True)  # noqa: S603, S607


def sync_clone(*, refresh: bool = False) -> Path:
    """Deja en la caché el árbol del repositorio en el commit fijado y devuelve su ruta."""
    if refresh and CLONE_DIR.exists():
        for path in sorted(CLONE_DIR.rglob("*"), reverse=True):
            path.rmdir() if path.is_dir() else path.unlink()
        CLONE_DIR.rmdir()
    if not (CLONE_DIR / "data").is_dir():
        CLONE_DIR.mkdir(parents=True, exist_ok=True)
        _git("init", "--quiet", ".", cwd=CLONE_DIR)
        _git("remote", "add", "origin", f"{REPOSITORY_URL}.git", cwd=CLONE_DIR)
        _git("fetch", "--depth", "1", "--quiet", "origin", PINNED_COMMIT, cwd=CLONE_DIR)
        _git("checkout", "--quiet", "FETCH_HEAD", cwd=CLONE_DIR)
    return CLONE_DIR


def load_gauges(*, refresh: bool = False) -> tuple[list[GaugeRecord], str]:
    """Lee las estaciones del commit fijado y devuelve ``(estaciones, huella del contenido)``.

    La huella es el sha256 del conjunto de ficheros leídos, no del commit: es lo que permite
    afirmar en el informe QC que dos ejecuciones partieron exactamente de los mismos datos.
    """
    root = sync_clone(refresh=refresh) / "data"
    records: list[GaugeRecord] = []
    digest = hashlib.sha256()
    for path in sorted(root.glob("*/*.json")):
        body = path.read_bytes()
        try:
            raw = json.loads(body)
        except json.JSONDecodeError:
            continue
        if not isinstance(raw, dict):
            continue
        record = _to_record(path.parent.name, raw)
        if record is not None:
            digest.update(path.name.encode())
            digest.update(body)
            records.append(record)
    if not records:
        raise RuntimeError(f"el commit fijado de {REPOSITORY_URL} no contenía estaciones legibles")
    return records, digest.hexdigest()


def candidates_near(
    gauges: list[GaugeRecord], lat: float, lon: float, max_km: float
) -> list[tuple[float, GaugeRecord]]:
    """Estaciones dentro de ``max_km`` del punto dado, ordenadas de más cerca a más lejos."""
    near = [
        (haversine_km(lat, lon, gauge.lat, gauge.lon), gauge)
        for gauge in gauges
        if abs(gauge.lat - lat) < 2.0 and abs(gauge.lon - lon) < 2.0
    ]
    return sorted((item for item in near if item[0] <= max_km), key=lambda item: item[0])
