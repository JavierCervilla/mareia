"""Síntesis armónica: constantes → serie de altura de marea y extremos.

    η(t) = Σ_i f_i · A_i · cos( V_i(t) + u_i − G_i )

con ``A_i`` la amplitud, ``G_i`` la fase de Greenwich (UTC) del constituyente, ``V_i`` su argumento
astronómico y ``(f_i, u_i)`` la corrección nodal de Schureman evaluada en el centro de la ventana.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

import numpy as np

from mareia_pipeline.tides.astro import NodalState, fundamental_arguments, hours_since_epoch
from mareia_pipeline.tides.constituents import CATALOG


@dataclass(frozen=True)
class Harmonic:
    """Una constante armónica: amplitud en metros y fase de Greenwich en grados."""

    name: str
    amplitude_m: float
    phase_deg: float


@dataclass(frozen=True)
class Extreme:
    """Una pleamar (``kind='high'``) o bajamar (``kind='low'``)."""

    when: dt.datetime
    height_m: float
    kind: str


def nodal_factors(harmonics: list[Harmonic], centre: dt.datetime) -> dict[str, tuple[float, float]]:
    """Devuelve ``{nombre: (f, u_grados)}`` para los constituyentes soportados del catálogo."""
    state = NodalState(centre)
    factors: dict[str, tuple[float, float]] = {}
    for harmonic in harmonics:
        constituent = CATALOG.get(harmonic.name)
        if constituent is None:
            continue
        if constituent.compound:
            factor = 1.0
            angle = 0.0
            for parent_name, multiple in constituent.compound.items():
                parent = CATALOG[parent_name]
                factor *= state.f[parent.nodal] ** abs(multiple)
                angle += multiple * state.u_deg[parent.nodal]
        else:
            factor = state.f[constituent.nodal]
            angle = state.u_deg[constituent.nodal]
        factors[harmonic.name] = (factor, angle)
    return factors


def time_grid(start: dt.datetime, days: float, step_minutes: float) -> np.ndarray:
    """Rejilla de instantes UTC como horas desde la época de Schureman."""
    count = int(round(days * 24 * 60 / step_minutes)) + 1
    base = hours_since_epoch(start)
    return base + np.arange(count) * (step_minutes / 60.0)


def predict(
    harmonics: list[Harmonic],
    hours: np.ndarray,
    centre: dt.datetime,
) -> np.ndarray:
    """Altura de marea sobre el nivel medio (metros) en cada instante de ``hours``.

    Los constituyentes ausentes del catálogo se ignoran silenciosamente aquí; quien necesite saber
    cuánta amplitud se descarta debe usar :func:`unsupported_amplitude`.
    """
    factors = nodal_factors(harmonics, centre)
    arguments = fundamental_arguments(hours)
    total = np.zeros(arguments.shape[1], dtype=float)
    for harmonic in harmonics:
        constituent = CATALOG.get(harmonic.name)
        if constituent is None or harmonic.amplitude_m == 0.0:
            continue
        factor, angle = factors[harmonic.name]
        speed_argument = np.zeros(arguments.shape[1], dtype=float)
        for coefficient, argument in zip(constituent.doodson, arguments, strict=True):
            if coefficient:
                speed_argument += coefficient * argument
        speed_argument += 90.0 * constituent.offset_90deg
        phase = np.radians(speed_argument + angle - harmonic.phase_deg)
        total += factor * harmonic.amplitude_m * np.cos(phase)
    return total


def find_extremes(
    hours: np.ndarray,
    heights: np.ndarray,
    start: dt.datetime,
    step_minutes: float,
) -> list[Extreme]:
    """Localiza pleamares y bajamares refinando cada extremo con una parábola por tres puntos.

    La interpolación parabólica sitúa el vértice con precisión muy superior al paso de la rejilla,
    que es lo que permite comparar horas de extremo entre series de distinta resolución.
    """
    if heights.size < 3:
        return []
    interior = heights[1:-1]
    is_high = (interior > heights[:-2]) & (interior >= heights[2:])
    is_low = (interior < heights[:-2]) & (interior <= heights[2:])
    extremes: list[Extreme] = []
    for index in np.flatnonzero(is_high | is_low):
        centre_index = index + 1
        before, here, after = heights[centre_index - 1 : centre_index + 2]
        denominator = before - 2.0 * here + after
        shift = 0.0 if denominator == 0.0 else 0.5 * (before - after) / denominator
        shift = float(np.clip(shift, -1.0, 1.0))
        height = here - 0.25 * (before - after) * shift
        offset_hours = float(hours[centre_index] - hours[0]) + shift * (step_minutes / 60.0)
        extremes.append(
            Extreme(
                when=start + dt.timedelta(hours=offset_hours),
                height_m=float(height),
                kind="high" if is_high[index] else "low",
            )
        )
    return extremes
