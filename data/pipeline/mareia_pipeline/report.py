"""Generación del informe QC en markdown."""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

from mareia_pipeline import grade as grading
from mareia_pipeline.reconcile import Selection
from mareia_pipeline.validate import Metrics


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
        "Fijados **antes** de medir y comparados sobre los valores en crudo: un puerto que se quede "
        "a un pelo del umbral **baja** de grade. Un puerto necesita cumplir *todos* los umbrales de "
        "un nivel para alcanzarlo.",
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
        lines.append(
            f"  ({metrics.samples} muestras, {metrics.matched_extremes}/{metrics.predicted_extremes} "
            f"extremos emparejados); {corroboration}."
        )
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
