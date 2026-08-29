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
    count = round(days * 24 * 60 / step_minutes) + 1
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
    min_prominence_m: float,
) -> list[Extreme]:
    """Localiza pleamares y bajamares alternadas, refinando cada una con una parábola.

    Un extremo sólo se acepta cuando la señal se ha alejado de él al menos ``min_prominence_m`` en
    sentido contrario. Comparar tres puntos vecinos, que es lo obvio, no vale: sobre un registro
    real cualquier rizo de una décima de milímetro cuenta como pleamar, y en un puerto micromareal
    muestreado cada seis segundos eso son **decenas de miles** de extremos inventados donde debería
    haber cuarenta. Con extremos así de espesos, cualquier predicción encuentra siempre uno
    observado al lado y el error de hora sale ridículamente bueno: la métrica se mide a sí misma.

    La histéresis además fuerza la alternancia pleamar/bajamar, que es como se comporta una marea.
    La interpolación parabólica sitúa después el vértice con precisión muy superior al paso de la
    rejilla, que es lo que permite comparar horas entre series de distinta cadencia.
    """
    if heights.size < 3:
        return []

    accepted: list[tuple[int, str]] = []
    highest_index = lowest_index = 0
    allowed = "any"
    for index in range(heights.size):
        if heights[index] > heights[highest_index]:
            highest_index = index
        if heights[index] < heights[lowest_index]:
            lowest_index = index
        if (
            allowed in ("any", "high")
            and heights[highest_index] - heights[index] >= min_prominence_m
        ):
            accepted.append((highest_index, "high"))
            allowed = "low"
            lowest_index = index
        elif (
            allowed in ("any", "low")
            and heights[index] - heights[lowest_index] >= min_prominence_m
        ):
            accepted.append((lowest_index, "low"))
            allowed = "high"
            highest_index = index

    extremes: list[Extreme] = []
    for centre_index, kind in accepted:
        if centre_index == 0 or centre_index >= heights.size - 1:
            continue
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
                kind=kind,
            )
        )
    return extremes
