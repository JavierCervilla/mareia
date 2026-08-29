"""Validación: predicción vs. observación, métricas y grade de calidad.

Se contrastan tres cosas distintas, porque miden cosas distintas:

* **RMSE contra observaciones** (IOC) — el error real frente al nivel del mar que hubo. Incluye el
  residuo meteorológico, que no es predecible con astronomía: es una **cota superior honesta**, no
  el error de las constantes.
* **RMSE cruzado entre fuentes** — la misma ventana predicha con las constantes del mareógrafo
  elegido y con las del mejor candidato alternativo. Aísla la calidad de las constantes: si dos
  análisis independientes del mismo puerto coinciden, las constantes son sólidas.
* **Error de los extremos** — hora y altura de pleamares y bajamares, que es lo que el usuario mira
  en la tabla de mareas y lo que hay que medir de verdad.

Todo se mide sobre **las constantes que realmente se emiten** (truncadas al juego que soporta el
motor de producción), no sobre las 50 que publica la fuente: un informe QC que midiera algo distinto
de lo que se sirve no sería un informe, sería una coartada. El coste de ese truncado se mide aparte
en ``truncation_rms_m``, comparando la predicción emitida con la del juego completo.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import asdict, dataclass

import numpy as np

from mareia_pipeline.engine_contract import truncate
from mareia_pipeline.sources.ioc import Observations
from mareia_pipeline.tides.astro import hours_since_epoch
from mareia_pipeline.tides.predict import Extreme, Harmonic, find_extremes, predict, time_grid

#: Resolución de la rejilla de predicción. Un minuto es más fino que la propia observación IOC y
#: hace que el error de hora de pleamar no esté dominado por la discretización.
STEP_MINUTES = 1.0

#: Semiventana para emparejar un extremo predicho con el observado correspondiente.
MATCH_WINDOW_MINUTES = 180.0

#: Semiancho de la media móvil que suaviza la observación antes de buscarle extremos, **en minutos**.
#: El registro crudo trae ruido de oleaje y de sensor que inventa extremos espurios; un cuarto de
#: hora a cada lado no mueve la hora de una pleamar real (la señal es semidiurna) y sí mata ese
#: ruido. Va en minutos y no en muestras porque los mareógrafos del IOC no comparten cadencia —los
#: hay de 1 minuto y los hay de 6 segundos— y un semiancho fijo en muestras suavizaría a estos
#: últimos diez veces menos, llenándolos de extremos inventados.
SMOOTHING_HALF_WIDTH_MINUTES = 15.0

#: Prominencia mínima para aceptar un extremo, como fracción del rango de marea predicho. Se aplica
#: **igual a la serie predicha y a la observada** para que las dos se midan con la misma vara.
PROMINENCE_FRACTION_OF_RANGE = 0.05

#: Cuántos extremos observados de más se toleran, en proporción a los predichos en la misma ventana,
#: antes de declarar que el registro no tiene pleamares identificables. En un puerto micromareal el
#: residuo meteorológico crea extremos **reales** que no son la marea, y multiplican por diez los que
#: debería haber; emparejar contra ellos daría un error de hora ridículamente bueno y falso, porque
#: siempre habría un extremo observado al lado de cualquier predicción. Cuando pasa, no se publica
#: un número malo: no se publica ninguno.
MAX_OBSERVED_EXTREMES_RATIO = 2.0


@dataclass(frozen=True)
class Metrics:
    """Las métricas de calidad de un puerto. Todas en metros y minutos."""

    window_start: str
    window_days: float
    samples: int
    predicted_range_m: float
    rmse_m: float | None
    nrmse: float | None
    r2: float | None
    hw_time_err_p95_min: float | None
    hw_height_err_p95_m: float | None
    matched_extremes: int
    predicted_extremes: int
    #: Extremos predichos que caen **dentro de la ventana realmente observada**. Es el término con
    #: el que se compara ``observed_extremes``, así que sin él la decisión de medibilidad no se
    #: puede rehacer desde los artefactos publicados.
    predicted_extremes_in_window: int
    observed_extremes: int
    #: ``False`` cuando la observación tiene tantos extremos que no son la marea (residuo
    #: meteorológico en puerto micromareal) que emparejarlos no mediría nada.
    extremes_usable: bool
    #: Mejor acuerdo con un análisis independiente del mismo puerto: **corroboración**. Que una
    #: reanálisis antiguo y peor discrepe no invalida las constantes elegidas; que ninguno las
    #: corrobore, sí es una señal.
    cross_rmse_m: float | None
    cross_source: str | None
    #: Peor acuerdo, para que la dispersión entre análisis quede a la vista y no sólo el mejor.
    cross_rmse_worst_m: float | None
    cross_source_worst: str | None
    #: RMS de la diferencia entre la predicción que se emite y la del juego completo de la fuente:
    #: el coste medido de truncar al catálogo del motor de producción, en metros.
    truncation_rms_m: float
    #: Suma de las amplitudes descartadas: el peor caso, si todas coincidieran en fase.
    dropped_amplitude_m: float
    dropped_amplitude_fraction: float
    dropped_constituents: list[str]
    observation_source: str | None
    #: Código del mareógrafo del IOC con el que se midió, y **a qué distancia de la dársena
    #: estaba**. Sin este par, el RMSE publicado es un número sin procedencia: mirando el JSON no
    #: se puede saber si se midió en este puerto o en otro a treinta kilómetros, y eso es
    #: exactamente lo que T-13 vino a impedir. Con él, un test lo comprueba sin salir a la red.
    observation_code: str | None
    observation_distance_km: float | None
    #: Coordenadas del mareógrafo con el que se midió, para que la distancia de arriba se pueda
    #: **recomputar** desde el JSON en vez de creérsela. Sin ellas, la procedencia de la observación
    #: era autodeclarada: bastaba escribir «0,9 km» al lado de un RMSE ajeno para que cuadrara.
    observation_lat: float | None
    observation_lon: float | None

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


def _percentile95(values: list[float]) -> float | None:
    return None if not values else float(np.percentile(np.abs(values), 95))


def _smooth(values: np.ndarray, half_width: int) -> np.ndarray:
    """Media móvil centrada, con los bordes recortados por convolución 'same'."""
    if half_width <= 0:
        return values
    window = np.ones(2 * half_width + 1) / (2 * half_width + 1)
    return np.convolve(values, window, mode="same")


def match_extremes(
    predicted: list[Extreme], observed: list[Extreme]
) -> tuple[list[float], list[float]]:
    """Empareja extremos del mismo tipo y devuelve ``(errores de hora en min, de altura en m)``.

    El error de altura se mide sobre series con la media alineada, así que no incluye el desfase de
    cero del mareógrafo: mide la amplitud del extremo, no su cota absoluta.
    """
    time_errors: list[float] = []
    height_errors: list[float] = []
    by_kind: dict[str, list[Extreme]] = {"high": [], "low": []}
    for extreme in observed:
        by_kind[extreme.kind].append(extreme)
    for target in predicted:
        pool = by_kind[target.kind]
        if not pool:
            continue
        nearest = min(pool, key=lambda o: abs((o.when - target.when).total_seconds()))
        delta_minutes = (nearest.when - target.when).total_seconds() / 60.0
        if abs(delta_minutes) > MATCH_WINDOW_MINUTES:
            continue
        time_errors.append(delta_minutes)
        height_errors.append(nearest.height_m - target.height_m)
    return time_errors, height_errors


def evaluate(
    published: list[Harmonic],
    observations: Observations | None,
    *,
    window_start: dt.datetime,
    window_days: float,
    alternatives: list[tuple[str, list[Harmonic]]] | None = None,
) -> Metrics:
    """Calcula todas las métricas de un puerto sobre la ventana pedida.

    ``published`` son todas las constantes de la fuente; se truncan aquí al juego del motor de
    producción y **es esa versión truncada la que se mide**.
    """
    truncation = truncate(published)
    harmonics = truncation.kept
    dropped_m = truncation.dropped_amplitude_sum_m
    total_m = sum(h.amplitude_m for h in published)
    dropped_names = [h.name for h in truncation.dropped]
    hours = time_grid(window_start, window_days, STEP_MINUTES)
    centre = window_start + dt.timedelta(days=window_days / 2)
    predicted = predict(harmonics, hours, centre)
    prominence = PROMINENCE_FRACTION_OF_RANGE * float(predicted.max() - predicted.min())
    predicted_extremes = find_extremes(hours, predicted, window_start, STEP_MINUTES, prominence)

    truncation_difference = predict(published, hours, centre) - predicted
    truncation_rms = float(np.sqrt(np.mean(truncation_difference**2)))

    agreements: list[tuple[float, str]] = []
    for label, alternative in alternatives or []:
        difference = predicted - predict(truncate(alternative).kept, hours, centre)
        agreements.append(
            (float(np.sqrt(np.mean((difference - difference.mean()) ** 2))), label)
        )
    agreements.sort()
    best = agreements[0] if agreements else None
    worst = agreements[-1] if agreements else None

    rmse = r2 = None
    time_p95 = height_p95 = None
    matched = 0
    samples = 0
    observed_count = 0
    in_window = 0
    extremes_usable = False
    if observations is not None and len(observations.times) > 2:
        observed_hours = np.array([hours_since_epoch(t) for t in observations.times])
        observed_levels = np.array(observations.levels, dtype=float)
        samples = int(observed_levels.size)
        at_observations = predict(harmonics, observed_hours, centre)
        residual = observed_levels - at_observations
        residual = residual - residual.mean()
        rmse = float(np.sqrt(np.mean(residual**2)))
        r2 = float(1.0 - residual.var() / observed_levels.var())
        # Cadencia real del mareógrafo: la mediana de los intervalos, no el primero, porque las
        # series del IOC tienen huecos y un primer salto anómalo desajustaría todo lo que sigue.
        observed_step = float(np.median(np.diff(observed_hours)) * 60.0) or 1.0
        half_width = max(1, round(SMOOTHING_HALF_WIDTH_MINUTES / observed_step))
        smoothed = _smooth(observed_levels - observed_levels.mean(), half_width)
        observed_extremes = find_extremes(
            observed_hours, smoothed, observations.times[0], observed_step, prominence
        )
        centred_predicted = [
            Extreme(e.when, e.height_m - predicted.mean(), e.kind)
            for e in predicted_extremes
            if observations.times[0] <= e.when <= observations.times[-1]
        ]
        observed_count = len(observed_extremes)
        # El término de comparación es el número de extremos predichos **dentro de la ventana que
        # el mareógrafo llegó a cubrir**, no los de los 30 días: si la serie sólo abarca 10 días,
        # contrastar contra los 30 disimularía el exceso de extremos y la decisión saldría al revés.
        in_window = len(centred_predicted)
        extremes_usable = observed_count <= MAX_OBSERVED_EXTREMES_RATIO * max(in_window, 1)
        if extremes_usable:
            time_errors, height_errors = match_extremes(centred_predicted, observed_extremes)
            matched = len(time_errors)
            time_p95 = _percentile95(time_errors)
            height_p95 = _percentile95(height_errors)

    predicted_range = float(predicted.max() - predicted.min())
    return Metrics(
        window_start=window_start.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        window_days=window_days,
        samples=samples,
        predicted_range_m=round(predicted_range, 4),
        rmse_m=None if rmse is None else round(rmse, 4),
        nrmse=None if rmse is None else round(rmse / predicted_range, 5),
        r2=None if r2 is None else round(r2, 5),
        hw_time_err_p95_min=None if time_p95 is None else round(time_p95, 2),
        hw_height_err_p95_m=None if height_p95 is None else round(height_p95, 4),
        matched_extremes=matched,
        predicted_extremes=len(predicted_extremes),
        predicted_extremes_in_window=in_window,
        observed_extremes=observed_count,
        extremes_usable=extremes_usable,
        cross_rmse_m=None if best is None else round(best[0], 4),
        cross_source=None if best is None else best[1],
        cross_rmse_worst_m=None if worst is None else round(worst[0], 4),
        cross_source_worst=None if worst is None else worst[1],
        truncation_rms_m=round(truncation_rms, 5),
        dropped_amplitude_m=round(dropped_m, 5),
        dropped_amplitude_fraction=round(dropped_m / total_m, 6) if total_m else 0.0,
        dropped_constituents=dropped_names,
        observation_source=None if observations is None else f"IOC {observations.code}",
        observation_code=None if observations is None else observations.code,
        observation_distance_km=None if observations is None else observations.distance_km,
        observation_lat=None if observations is None else observations.lat,
        observation_lon=None if observations is None else observations.lon,
    )
