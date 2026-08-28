"""Validación de los JSON emitidos contra el JSON Schema de ``station/v1``.

El schema vive junto al dataset (``data/stations/station.v1.schema.json``) y no dentro del pipeline
a propósito: es el contrato que también consume el motor TypeScript, no un detalle de esta
herramienta.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

REPO_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = REPO_ROOT / "data" / "stations" / "station.v1.schema.json"


def load_schema() -> dict[str, Any]:
    """Carga el JSON Schema de ``station/v1``."""
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def validation_errors(document: dict[str, Any]) -> list[str]:
    """Mensajes de error del documento contra el schema; lista vacía si es válido."""
    validator = Draft202012Validator(load_schema())
    return [
        f"{'/'.join(str(p) for p in error.absolute_path) or '<raíz>'}: {error.message}"
        for error in sorted(validator.iter_errors(document), key=lambda e: list(e.absolute_path))
    ]


def station_files() -> list[Path]:
    """Todos los JSON de estación commiteados en el repositorio."""
    stations = sorted(p for p in (REPO_ROOT / "data" / "stations").glob("*.json") if "schema" not in p.name)
    brest = REPO_ROOT / "data" / "brest" / "constituents.json"
    return [*stations, *([brest] if brest.exists() else [])]
