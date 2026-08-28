"""Generación del informe QC en markdown."""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

from mareia_pipeline import grade as grading
from mareia_pipeline.reconcile import Selection
from mareia_pipeline.validate import Metrics


#: Rango de marea por debajo del cual el residuo meteorológico domina sobre la marea astronómica.
MICRO_TIDAL_RANGE_M = 0.50


@dataclass(frozen=True)
class PortOutcome:
    """Lo que salió para un puerto: qué estación se eligió, qué se midió y qué grade se concedió."""

    selection: Selection
    metrics: Metrics
    grade: grading.GradeResult


def _fmt(value: float | None, spec: str = ".3f") -> str:
    return "—" if value is None else format(value, spec)


def _thresholds_table() -> str:
    rows = [
        ("Error de hora de extremo p95", "min", grading.MAX_EXTREME_TIME_P95_MIN),
        ("RMSE normalizado por el rango", "—", grading.MAX_NRMSE),
        ("RMSE cruzado entre fuentes", "m", grading.MAX_CROSS_RMSE_M),
        ("Coste del truncado al motor", "m RMS", grading.MAX_TRUNCATION_RMS_M),
        ("Distancia al mareógrafo elegido", "km", grading.MAX_GAUGE_DISTANCE_KM),
    ]
    lines = ["| Umbral | Unidad | A ≤ | B ≤ |", "|---|---|---|---|"]
    for label, unit, table in rows:
        lines.append(f"| {label} | {unit} | {table['A']} | {table['B']} |")
    lines.append(
        f"| Años de registro analizado | años | ≥ {grading.MIN_EPOCH_YEARS['A']:.0f} "
        f"| ≥ {grading.MIN_EPOCH_YEARS['B']:.0f} |"
    )
    return "\n".join(lines)


def render(
    outcomes: list[PortOutcome],
    *,
    generated_at: dt.datetime,
    tarball_sha256: str,
    pinned_commit: str,
    notes: list[str],
) -> str:
    """Compone el informe QC completo."""
    stamp = generated_at.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    lines = [
        f"# Informe QC del dataset de estaciones — {generated_at.date().isoformat()}",
        "",
        f"Generado por `data/pipeline` el {stamp}. Reproducible con `make all` desde "
        "`data/pipeline` (ver su `README.md`).",
        "",
        "## Procedencia",
        "",
        f"- Fuente de constantes: **TICON-4** vía `openwatersio/tide-database`, commit "
        f"`{pinned_commit[:12]}`.",
        f"- Huella sha256 del contenido leído de ese commit: `{tarball_sha256}`.",
        "- Referencia de validación: observaciones de nivel del mar del **IOC Sea Level Monitoring "
        "Facility** (1 min, UTC). Se usan **sólo para medir**: no se redistribuyen ni se commitean.",
        "",
        "## Umbrales de grade",
        "",
        "Fijados **antes** de medir, y un puerto necesita cumplir *todos* los de un nivel para "
        "alcanzarlo. La comparación se hace sobre las métricas **tal como se publican aquí**, que "
        "van redondeadas a 4-5 decimales: no hay un valor secreto distinto del de la tabla. Dentro "
        "de esa última cifra el redondeo puede favorecer a un puerto por menos de una diezmilésima; "
        "por encima de eso no hay margen de gracia y quien rebasa el umbral **baja** de grade.",
        "",
        _thresholds_table(),
        "",
        "El RMSE contra observaciones es una **cota superior**: incluye el residuo meteorológico "
        "(marea de viento y de presión), que ninguna predicción astronómica puede capturar. Por eso "
        "el grade se apoya en el RMSE **normalizado por el rango de marea** y en el error de los "
        "extremos, y usa el **RMSE cruzado entre fuentes** para aislar la calidad de las constantes.",
        "",
        "## Resultados por puerto",
        "",
        "| Puerto | Mareógrafo elegido | Dist. | Licencia | Registro | Rango | RMSE obs. | nRMSE | R² | p95 hora | p95 altura | Cruzado | Trunc. | Grade |",
        "|---|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|:-:|",
    ]
    for outcome in outcomes:
        gauge = outcome.selection.chosen
        metrics = outcome.metrics
        lines.append(
            f"| {outcome.selection.port.name} "
            f"| `{gauge.station_id}` "
            f"| {outcome.selection.chosen_distance_km:.2f} km "
            f"| {gauge.license_type} "
            f"| {gauge.epoch_start[:4]}–{gauge.epoch_end[:4]} "
            f"| {metrics.predicted_range_m:.2f} m "
            f"| {_fmt(metrics.rmse_m)} m "
            f"| {_fmt(metrics.nrmse, '.4f')} "
            f"| {_fmt(metrics.r2, '.4f')} "
            f"| {_fmt(metrics.hw_time_err_p95_min, '.1f')} min "
            f"| {_fmt(metrics.hw_height_err_p95_m)} m "
            f"| {_fmt(metrics.cross_rmse_m)} m "
            f"| {metrics.truncation_rms_m * 100:.2f} cm "
            f"| **{outcome.grade.grade}** |"
        )

    micro_tidal = [o for o in outcomes if o.metrics.predicted_range_m < MICRO_TIDAL_RANGE_M]
    if micro_tidal:
        named = ", ".join(f"**{o.selection.port.name}**" for o in micro_tidal)
        lines += [
            "",
            "### Aviso: puertos micromareales",
            "",
            f"{named} tienen un rango de marea por debajo de {MICRO_TIDAL_RANGE_M:.2f} m. Ahí la "
            "marea astronómica existe y se calcula igual de bien —las constantes son las mismas y "
            "el motor no se equivoca más—, pero **el residuo meteorológico la domina**: un cambio "
            "de presión o un par de días de viento mueven el nivel más que la propia marea, y eso "
            "no lo predice ninguna suma armónica. Por eso su RMSE normalizado se dispara y su grade "
            "baja, aunque el error absoluto en metros sea de los mejores del conjunto.",
            "",
            "Consecuencia de producto: en estos puertos la tabla de mareas es un dato menor y el "
            "valor para el usuario está en el solunar y en la meteorología marina. La página debe "
            "decirlo, no esconderlo detrás de una tabla de pleamares de precisión aparente.",
        ]

    lines += ["", "### Por qué cada puerto tiene ese grade", ""]
    for outcome in outcomes:
        lines.append(
            f"- **{outcome.selection.port.name}** (`{outcome.selection.port.id}`) → "
            f"**{outcome.grade.grade}**: {outcome.grade.reason}."
        )

    lines += ["", "### Contraste y candidatas descartadas", ""]
    for outcome in outcomes:
        metrics = outcome.metrics
        rejected = outcome.selection.rejected
        observation = (
            f"validado contra {metrics.observation_source}"
            if metrics.observation_source
            else "**sin observaciones disponibles**: ningún mareógrafo del IOC en la dársena "
            "sirvió serie utilizable"
        )
        lines.append(f"- **{outcome.selection.port.name}** — {observation}")
        if metrics.cross_source is None:
            corroboration = "sin otro análisis independiente en la misma dársena"
        elif metrics.cross_source_worst == metrics.cross_source:
            corroboration = (
                f"corroborado por `{metrics.cross_source}` ({metrics.cross_rmse_m:.3f} m)"
            )
        else:
            corroboration = (
                f"mejor corroboración `{metrics.cross_source}` ({metrics.cross_rmse_m:.3f} m), "
                f"peor `{metrics.cross_source_worst}` ({metrics.cross_rmse_worst_m:.3f} m)"
            )
        if metrics.samples and not metrics.extremes_usable:
            extremes = (
                f"**hora de extremo no medible**: {metrics.observed_extremes} extremos observados "
                f"frente a {metrics.predicted_extremes} de marea, así que el registro no tiene "
                "pleamares identificables y emparejarlos no mediría nada"
            )
        else:
            extremes = (
                f"{metrics.matched_extremes}/{metrics.predicted_extremes} extremos emparejados"
            )
        lines.append(f"  ({metrics.samples} muestras, {extremes}); {corroboration}.")
        if rejected:
            listed = ", ".join(
                f"`{other.station_id}` ({distance:.2f} km, {other.license_type}, "
                f"{other.epoch_start[:4]}–{other.epoch_end[:4]})"
                for distance, other in rejected[:6]
            )
            lines.append(f"  Descartadas: {listed}.")

    dropped = {
        name
        for outcome in outcomes
        for name in outcome.metrics.dropped_constituents
    }
    lines += [
        "",
        "## Truncado al catálogo del motor de producción",
        "",
        "TICON-4 publica hasta 50 constantes por estación; el motor de mareas de `packages/"
        "domain-core` implementa el juego estándar de **37** de NOAA y falla ruidosamente ante "
        "cualquier otra. El dataset se trunca a ese juego **antes de emitirse**, y lo descartado se "
        "conserva en `source.dropped_constituents` de cada JSON con su amplitud y su fase, para que "
        "el error de truncado se pueda auditar sin volver a descargar la fuente.",
        "",
        "`truncación (RMS)` es el coste **medido**: la diferencia cuadrática media entre la "
        "predicción que se emite y la del juego completo sobre la misma ventana de 30 días. La "
        "columna «suma» es el peor caso teórico, si todas las descartadas coincidieran en fase.",
        "",
        f"Constantes descartadas en algún puerto: {', '.join(sorted(dropped)) or 'ninguna'}.",
        "",
        "| Puerto | Constantes emitidas | Descartadas | Truncación (RMS) | Suma de amplitudes |",
        "|---|---:|---:|---:|---:|",
    ]
    for outcome in outcomes:
        metrics = outcome.metrics
        published = len(outcome.selection.chosen.constituents)
        emitted = published - len(metrics.dropped_constituents)
        lines.append(
            f"| {outcome.selection.port.name} | {emitted} de {published} "
            f"| {len(metrics.dropped_constituents)} "
            f"| {metrics.truncation_rms_m * 100:.2f} cm "
            f"| {metrics.dropped_amplitude_m * 100:.2f} cm |"
        )

    if notes:
        lines += ["", "## Notas y limitaciones", ""]
        lines += [f"- {note}" for note in notes]
    return "\n".join(lines) + "\n"
