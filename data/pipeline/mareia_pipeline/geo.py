"""Distancias geográficas."""

from __future__ import annotations

import math

_EARTH_RADIUS_KM = 6371.0088


def haversine_km(lat_a: float, lon_a: float, lat_b: float, lon_b: float) -> float:
    """Distancia de círculo máximo entre dos puntos, en kilómetros."""
    phi_a, phi_b = math.radians(lat_a), math.radians(lat_b)
    delta_phi = math.radians(lat_b - lat_a)
    delta_lambda = math.radians(lon_b - lon_a)
    inner = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi_a) * math.cos(phi_b) * math.sin(delta_lambda / 2) ** 2
    )
    return 2 * _EARTH_RADIUS_KM * math.asin(math.sqrt(inner))
