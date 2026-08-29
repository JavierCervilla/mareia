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


def _cifra(valor: float, decimales: int) -> str:
    """Formatea un número **para publicarlo**: separador decimal español.

    Los motivos de esta función no se quedan en el JSON: son las dos frases que la página de cada
    puerto enseña —«las constantes son las del mareógrafo `X`, a 24,8 km de la dársena» y «no
    alcanza B: RMSE normalizado 0,221 > 0,15»— y son justo las que sostienen la promesa de que un
    puerto no publica una precisión que no tiene. Escritas con ``f"{km:.1f}"`` salían en formato
    inglés («24.8») en páginas es-ES donde el punto **sí** separa millares dos bloques más abajo
    («381.367 km» a la Luna): la misma pantalla le enseñaba al lector dos significados del punto
    (hallazgo A-19 del pase adversario de T-13, **130 de 153 páginas y 283 ocurrencias**).

    Se arregla aquí, que es donde el número se convierte en texto, y no en la plantilla: la página
    recibe una frase ya escrita y ahí sólo cabría un reemplazo a ciegas sobre prosa.

    No pone separador de millares porque ninguna de las magnitudes que publica lo alcanza —km hasta
    decenas, cm hasta unidades, RMSE normalizado por debajo de uno—; el día que alguna lo alcance,
    éste es el sitio.
    """
    return f"{valor:.{decimales}f}".replace(".", ",")


@dataclass(frozen=True)
class GradeResult:
    """El grade concedido y el motivo legible por el que no subió más."""

    grade: str
    reason: str


def _failures(level: str, metrics: Metrics, epoch_years: float, gauge_distance_km: float) -> list[str]:
    """**Todos** los umbrales de ``level`` que el puerto incumple, en el orden en que se comprueban.

    La diferencia con devolver sólo el primero no es cosmética. En T-05 el informe decía que a Vigo
    lo que le impedía llegar a A era el coste de truncar el dataset, y de ahí salió la predicción de
    que añadir los cinco constituyentes que faltaban lo subiría a A. El coste bajó como estaba
    previsto —de 1,30 a 0,69 cm RMS— y Vigo siguió en B, porque también incumplía el error de hora
    de pleamar (25,4 min sobre un umbral de 20) y el motivo, que se paraba en el primer fallo, nunca
    lo dijo. Un informe que sólo nombra un obstáculo invita a predecir que quitarlo basta.

    El primer intento de arreglo dejó fuera justo las ramas de «sin observaciones», que son las
    mayoritarias desde que T-13 amplió el catálogo: 39 puertos publicaban un motivo que sólo culpaba
    a la distancia al mareógrafo y callaba que tampoco había con qué validar. Por eso ahora hay una
    sola función, la que evalúa, y no dos listas que puedan desincronizarse.
    """
    unmet: list[str] = []
    if gauge_distance_km > MAX_GAUGE_DISTANCE_KM[level]:
        unmet.append(
            f"el mareógrafo más cercano está a {_cifra(gauge_distance_km, 1)} km > "
            f"{MAX_GAUGE_DISTANCE_KM[level]:.0f} km"
        )
    if metrics.truncation_rms_m > MAX_TRUNCATION_RMS_M[level]:
        unmet.append(
            f"coste de truncar al catálogo del motor {_cifra(metrics.truncation_rms_m * 100, 1)} cm "
            f"RMS > {MAX_TRUNCATION_RMS_M[level] * 100:.0f} cm"
        )
    if epoch_years < MIN_EPOCH_YEARS[level]:
        unmet.append(f"registro de {epoch_years:.0f} años < {MIN_EPOCH_YEARS[level]:.0f}")
    # El contraste entre fuentes veta cuando existe y desmiente.
    if metrics.cross_rmse_m is not None and metrics.cross_rmse_m > MAX_CROSS_RMSE_M[level]:
        unmet.append(
            f"ningún análisis independiente corrobora las constantes "
            f"(mejor acuerdo {_cifra(metrics.cross_rmse_m, 3)} m > "
            f"{_cifra(MAX_CROSS_RMSE_M[level], 2)} m)"
        )
    if metrics.nrmse is None or metrics.hw_time_err_p95_min is None:
        if level == "A":
            if metrics.nrmse is not None and not metrics.extremes_usable:
                unmet.append(
                    "la observación no tiene pleamares identificables (el residuo meteorológico "
                    "genera más extremos que la marea), así que no se puede medir su hora"
                )
            else:
                unmet.append("sin observaciones con las que medir la predicción")
        elif metrics.cross_rmse_m is None and metrics.nrmse is None:
            unmet.append("sin observaciones ni segunda fuente: no hay con qué validar")
        if metrics.nrmse is not None and metrics.nrmse > MAX_NRMSE[level]:
            unmet.append(
                f"RMSE normalizado {_cifra(metrics.nrmse, 3)} > {_cifra(MAX_NRMSE[level], 2)}"
            )
        return unmet
    if metrics.nrmse > MAX_NRMSE[level]:
        unmet.append(
            f"RMSE normalizado {_cifra(metrics.nrmse, 3)} > {_cifra(MAX_NRMSE[level], 2)}"
        )
    if metrics.hw_time_err_p95_min > MAX_EXTREME_TIME_P95_MIN[level]:
        unmet.append(
            f"error de hora de extremo p95 {metrics.hw_time_err_p95_min:.0f} min > "
            f"{MAX_EXTREME_TIME_P95_MIN[level]:.0f} min"
        )
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
            f"{_cifra(gauge_distance_km, 1)} km de la dársena, y no hay observaciones de este "
            "puerto con las que comprobar la predicción",
        )
    if not own_harbour:
        return Estimation(
            True,
            f"las constantes armónicas son las del mareógrafo `{gauge_id}`, a "
            f"{_cifra(gauge_distance_km, 1)} km de la dársena: describen la marea de ese punto, no "
            "la de este puerto",
        )
    return Estimation(
        True,
        "no hay observaciones de este puerto con las que comprobar la predicción: las constantes "
        f"son las de `{gauge_id}`, en la propia dársena, pero nadie las ha contrastado aquí",
    )
