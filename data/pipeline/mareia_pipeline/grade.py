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


def _first_failure(
    level: str, metrics: Metrics, epoch_years: float, gauge_distance_km: float
) -> str | None:
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


def _failures(level: str, metrics: Metrics, epoch_years: float, gauge_distance_km: float) -> list[str]:
    """**Todos** los umbrales de ``level`` que el puerto incumple, no sólo el primero.

    La diferencia no es cosmética. En T-05 el informe decía que a Vigo lo que le impedía llegar a A
    era el coste de truncar el dataset, y de ahí salió la predicción de que añadir los cinco
    constituyentes que faltaban lo subiría a A. El coste bajó como estaba previsto —de 1,30 a
    0,69 cm RMS— y Vigo siguió en B, porque también incumplía el error de hora de pleamar (25,4 min
    sobre un umbral de 20) y el motivo, que se paraba en el primer fallo, nunca lo dijo. Un informe
    que sólo nombra un obstáculo invita a predecir que quitarlo basta.
    """
    unmet: list[str] = []
    remaining = metrics
    failure = _first_failure(level, remaining, epoch_years, gauge_distance_km)
    if failure is not None:
        unmet.append(failure)
    # El resto de umbrales se comprueban aparte porque `_first_failure` corta en el primero: aquí se
    # repasan todos los que se pueden evaluar de forma independiente.
    checks: list[tuple[bool, str]] = [
        (
            gauge_distance_km > MAX_GAUGE_DISTANCE_KM[level],
            f"el mareógrafo más cercano está a {gauge_distance_km:.1f} km > "
            f"{MAX_GAUGE_DISTANCE_KM[level]:.0f} km",
        ),
        (
            metrics.truncation_rms_m > MAX_TRUNCATION_RMS_M[level],
            f"coste de truncar al catálogo del motor {metrics.truncation_rms_m * 100:.1f} cm RMS > "
            f"{MAX_TRUNCATION_RMS_M[level] * 100:.0f} cm",
        ),
        (
            epoch_years < MIN_EPOCH_YEARS[level],
            f"registro de {epoch_years:.0f} años < {MIN_EPOCH_YEARS[level]:.0f}",
        ),
        (
            metrics.cross_rmse_m is not None and metrics.cross_rmse_m > MAX_CROSS_RMSE_M[level],
            f"ningún análisis independiente corrobora las constantes "
            f"(mejor acuerdo {metrics.cross_rmse_m:.3f} m > {MAX_CROSS_RMSE_M[level]:.2f} m)"
            if metrics.cross_rmse_m is not None
            else "",
        ),
        (
            metrics.nrmse is not None and metrics.nrmse > MAX_NRMSE[level],
            f"RMSE normalizado {metrics.nrmse:.3f} > {MAX_NRMSE[level]:.2f}"
            if metrics.nrmse is not None
            else "",
        ),
        (
            metrics.hw_time_err_p95_min is not None
            and metrics.hw_time_err_p95_min > MAX_EXTREME_TIME_P95_MIN[level],
            f"error de hora de extremo p95 {metrics.hw_time_err_p95_min:.0f} min > "
            f"{MAX_EXTREME_TIME_P95_MIN[level]:.0f} min"
            if metrics.hw_time_err_p95_min is not None
            else "",
        ),
    ]
    for failed, message in checks:
        if failed and message and message not in unmet:
            unmet.append(message)
    return unmet


def assign(metrics: Metrics, epoch_years: float, gauge_distance_km: float = 0.0) -> GradeResult:
    """Concede el grade más alto cuyos umbrales se cumplen todos.

    El motivo enumera **todos** los umbrales que el puerto incumple del nivel al que no llega, para
    que nadie deduzca del informe que quitando el primero sube de grade.
    """
    blocked_from_a = _failures("A", metrics, epoch_years, gauge_distance_km)
    if not blocked_from_a:
        return GradeResult("A", "cumple todos los umbrales de grade A")
    blocked_from_b = _failures("B", metrics, epoch_years, gauge_distance_km)
    if not blocked_from_b:
        return GradeResult("B", f"no alcanza A: {'; y '.join(blocked_from_a)}")
    return GradeResult("C", f"no alcanza B: {'; y '.join(blocked_from_b)}")


@dataclass(frozen=True)
class Estimation:
    """Si la marea de un puerto es una **estimación** y, si lo es, por qué."""

    estimated: bool
    #: Frase publicable —va a la página, no sólo al JSON— con el motivo. ``None`` si no es estimada.
    reason: str | None


def estimate(
    *, gauge_id: str, gauge_distance_km: float, observation_source: str | None
) -> Estimation:
    """Decide si el puerto publica una marea medida en él o prestada de otro sitio.

    Un puerto **no** es estimado sólo cuando se dan las dos cosas a la vez: sus constantes salen de
    un mareógrafo que está en su propia dársena —el mismo umbral de distancia que exige el grade A,
    ``MAX_GAUGE_DISTANCE_KM['A']``, para no tener dos varas de medir— y hemos podido contrastar la
    predicción contra observaciones de ese puerto. Cualquier otra combinación es una estimación y se
    dice: en la duda se marca, porque el error caro de esta trayectoria es el contrario.
    """
    own_harbour = gauge_distance_km <= MAX_GAUGE_DISTANCE_KM["A"]
    if own_harbour and observation_source is not None:
        return Estimation(False, None)
    if not own_harbour and observation_source is None:
        return Estimation(
            True,
            f"las constantes armónicas son las del mareógrafo `{gauge_id}`, a "
            f"{gauge_distance_km:.1f} km de la dársena, y no hay observaciones de este puerto con "
            "las que comprobar la predicción",
        )
    if not own_harbour:
        return Estimation(
            True,
            f"las constantes armónicas son las del mareógrafo `{gauge_id}`, a "
            f"{gauge_distance_km:.1f} km de la dársena: describen la marea de ese punto, no la de "
            "este puerto",
        )
    return Estimation(
        True,
        "no hay observaciones de este puerto con las que comprobar la predicción: las constantes "
        f"son las de `{gauge_id}`, en la propia dársena, pero nadie las ha contrastado aquí",
    )
