"""Qué constituyentes acepta el motor de mareas de producción.

El motor TypeScript (`packages/domain-core`, T-02) implementa el juego estándar de 37
constituyentes de NOAA y lanza `UnsupportedConstituentError` ante cualquier otro: falla ruidoso a
propósito. TICON-4 publica hasta 50, así que el dataset **se trunca a este conjunto antes de
emitirse** y lo descartado se registra en el propio JSON, para que el error de truncado sea medible
y no un silencio.

Truncar en el pipeline y no en el consumidor es deliberado: el JSON de `data/stations` es el
contrato, y un contrato que el motor no puede cumplir no es un contrato. Si el motor amplía su
catálogo, este conjunto crece y el dataset se regenera.
"""

from __future__ import annotations

from dataclasses import dataclass

from mareia_pipeline.tides.predict import Harmonic

#: Los 37 constituyentes del juego estándar de NOAA que soporta el motor de producción, con los
#: nombres exactos que exporta `SUPPORTED_CONSTITUENTS` en `packages/domain-core`.
ENGINE_CONSTITUENTS: frozenset[str] = frozenset(
    {
        # Semidiurnos
        "M2", "S2", "N2", "K2", "2N2", "MU2", "NU2", "LAM2", "L2", "T2", "R2", "2SM2",
        # Diurnos
        "K1", "O1", "P1", "Q1", "2Q1", "J1", "M1", "S1", "OO1", "RHO",
        # Largo periodo
        "SA", "SSA", "MM", "MF", "MSF",
        # Aguas someras
        "M3", "M4", "M6", "M8", "S4", "S6", "MN4", "MS4", "MK3", "2MK3",
    }
)


@dataclass(frozen=True)
class Truncation:
    """El resultado de truncar las constantes de una estación al catálogo del motor."""

    kept: list[Harmonic]
    dropped: list[Harmonic]

    @property
    def dropped_amplitude_sum_m(self) -> float:
        """Suma de amplitudes descartadas: el peor caso, si todas se alinearan en fase."""
        return sum(h.amplitude_m for h in self.dropped)


def truncate(harmonics: list[Harmonic]) -> Truncation:
    """Separa las constantes en las que el motor entiende y las que hay que descartar."""
    kept = [h for h in harmonics if h.name in ENGINE_CONSTITUENTS]
    dropped = [h for h in harmonics if h.name not in ENGINE_CONSTITUENTS]
    return Truncation(kept=kept, dropped=sorted(dropped, key=lambda h: -h.amplitude_m))
