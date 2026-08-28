"""Grade A/B/C por umbrales fijados **antes** de medir.

Regla del proyecto: el grade se gana por exactitud, nunca por redondeo. Los umbrales de abajo se
escribieron antes de correr la primera validación y las comparaciones se hacen sobre los valores en
crudo, así que un puerto que se quede a un pelo del umbral baja de grade — no sube.

Por qué los umbrales son mixtos (absolutos *y* relativos): un RMSE de 6 cm es excelente en Vigo
(rango 3,6 m) y mediocre en Palma (rango 0,25 m). Normalizar por el rango predicho de la ventana
hace comparables puertos macromareales y micromareales.

Jerarquía de la evidencia, que es lo que decide la forma de las reglas:

* **Las observaciones mandan.** Treinta días de nivel del mar medido cada minuto son la prueba más
  fuerte que tenemos, y un puerto que las supera no necesita nada más para llegar a A.
* **El contraste entre fuentes es un veto, no un requisito.** Sirve para desmentir, no para
  acreditar: si un análisis independiente del mismo puerto discrepa mucho, hay que mirarlo; pero
  que un puerto tenga un solo mareógrafo no lo hace peor. Antes esto se pedía como requisito y
  hundía a grade C puertos como Bilbao, que valida contra observaciones mejor que ninguno.
* **Si no hay observaciones**, el contraste entre fuentes es la única prueba que queda y entonces sí
  hace falta — pero sólo alcanza para B, porque corroborar no es medir.
"""

from __future__ import annotations

from dataclasses import dataclass

from mareia_pipeline.validate import Metrics

#: Error de hora de extremo (p95) tolerado para cada grade, en minutos.
MAX_EXTREME_TIME_P95_MIN = {"A": 20.0, "B": 45.0}

#: RMSE normalizado por el rango de marea de la ventana.
MAX_NRMSE = {"A": 0.05, "B": 0.15}

#: Discrepancia tolerada entre las constantes elegidas y las del mejor candidato alternativo.
MAX_CROSS_RMSE_M = {"A": 0.05, "B": 0.15}

#: Años mínimos del registro mareográfico del que se analizaron las constantes.
MIN_EPOCH_YEARS = {"A": 10.0, "B": 1.0}

#: Distancia máxima del mareógrafo elegido a la dársena, en kilómetros. Dentro de unos pocos
#: kilómetros de costa abierta la onda llega prácticamente igual y las constantes son
#: intercambiables; a decenas de kilómetros ya no se describe el mismo sitio, por bueno que sea el
#: análisis. Sin este umbral, un puerto sin mareógrafo propio heredaría el grade del mareógrafo
#: ajeno que le presta las constantes, que es precisamente lo que no debe pasar.
MAX_GAUGE_DISTANCE_KM = {"A": 5.0, "B": 30.0}

#: Coste tolerado del truncado al catálogo del motor de producción, en metros RMS. El bar lo fija
#: el contrato con T-02 ("una amplitud agregada descartada relevante son 1-2 cm"), no este módulo:
#: por encima de 1 cm el dataset ya no es indistinguible del que publica la fuente.
MAX_TRUNCATION_RMS_M = {"A": 0.01, "B": 0.03}


@dataclass(frozen=True)
class GradeResult:
    """El grade concedido y el motivo legible por el que no subió más."""

    grade: str
    reason: str


def _fails(level: str, metrics: Metrics, epoch_years: float, gauge_distance_km: float) -> str | None:
    """Primer umbral de ``level`` que el puerto incumple, o ``None`` si los cumple todos."""
    if gauge_distance_km > MAX_GAUGE_DISTANCE_KM[level]:
        return (
            f"el mareógrafo más cercano está a {gauge_distance_km:.1f} km > "
            f"{MAX_GAUGE_DISTANCE_KM[level]:.0f} km"
        )
    if metrics.truncation_rms_m > MAX_TRUNCATION_RMS_M[level]:
        return (
            f"coste de truncar al catálogo del motor {metrics.truncation_rms_m * 100:.1f} cm RMS > "
            f"{MAX_TRUNCATION_RMS_M[level] * 100:.0f} cm"
        )
    if epoch_years < MIN_EPOCH_YEARS[level]:
        return f"registro de {epoch_years:.0f} años < {MIN_EPOCH_YEARS[level]:.0f}"
    # El contraste entre fuentes veta cuando existe y desmiente.
    if metrics.cross_rmse_m is not None and metrics.cross_rmse_m > MAX_CROSS_RMSE_M[level]:
        return (
            f"ningún análisis independiente corrobora las constantes "
            f"(mejor acuerdo {metrics.cross_rmse_m:.3f} m > {MAX_CROSS_RMSE_M[level]:.2f} m)"
        )
    if metrics.nrmse is None or metrics.hw_time_err_p95_min is None:
        if level == "A":
            if metrics.nrmse is not None and not metrics.extremes_usable:
                return (
                    "la observación no tiene pleamares identificables (el residuo meteorológico "
                    "genera más extremos que la marea), así que no se puede medir su hora"
                )
            return "sin observaciones con las que medir la predicción"
        if metrics.cross_rmse_m is None and metrics.nrmse is None:
            return "sin observaciones ni segunda fuente: no hay con qué validar"
        if metrics.nrmse is not None and metrics.nrmse > MAX_NRMSE[level]:
            return f"RMSE normalizado {metrics.nrmse:.3f} > {MAX_NRMSE[level]:.2f}"
        return None
    if metrics.nrmse > MAX_NRMSE[level]:
        return f"RMSE normalizado {metrics.nrmse:.3f} > {MAX_NRMSE[level]:.2f}"
    if metrics.hw_time_err_p95_min > MAX_EXTREME_TIME_P95_MIN[level]:
        return (
            f"error de hora de extremo p95 {metrics.hw_time_err_p95_min:.0f} min > "
            f"{MAX_EXTREME_TIME_P95_MIN[level]:.0f} min"
        )
    return None


def assign(metrics: Metrics, epoch_years: float, gauge_distance_km: float = 0.0) -> GradeResult:
    """Concede el grade más alto cuyos umbrales se cumplen todos."""
    blocked_from_a = _fails("A", metrics, epoch_years, gauge_distance_km)
    if blocked_from_a is None:
        return GradeResult("A", "cumple todos los umbrales de grade A")
    blocked_from_b = _fails("B", metrics, epoch_years, gauge_distance_km)
    if blocked_from_b is None:
        return GradeResult("B", f"no alcanza A: {blocked_from_a}")
    return GradeResult("C", f"no alcanza B: {blocked_from_b}")
