"""Generación del informe QC en markdown.

Con doce puertos el informe se leía de arriba abajo; con doscientos hay que poder **agregarlo y
navegarlo**, que es lo que cambia en T-13. El orden es: primero lo que resume el conjunto (cuántos
puertos, con qué grades, cuántos medidos y cuántos estimados, cobertura por región), después lo que
se quedó fuera y por qué, y sólo entonces el detalle puerto a puerto, agrupado por región y separado
en dos tablas —**medidos** y **estimados**— porque son dos poblaciones distintas y mezclarlas es
justo lo que hace que un número prestado parezca propio.
"""

from __future__ import annotations

import datetime as dt
import statistics
from collections import Counter, defaultdict
from dataclasses import dataclass

from mareia_pipeline import catalog
from mareia_pipeline import grade as grading
from mareia_pipeline import validate
from mareia_pipeline.engine_contract import ENGINE_CONSTITUENTS
from mareia_pipeline.reconcile import Selection
from mareia_pipeline.validate import Metrics


#: Rango de marea por debajo del cual el residuo meteorológico domina sobre la marea astronómica.
MICRO_TIDAL_RANGE_M = 0.50

#: Cuántos puertos se enseñan en las listas «los peores»: suficiente para ver el patrón, no tanto
#: como para volver a ser la tabla entera.
WORST_LIMIT = 15


@dataclass(frozen=True)
class PortOutcome:
    """Lo que salió para un puerto: qué estación se eligió, qué se midió y qué se le concede."""

    selection: Selection
    metrics: Metrics
    grade: grading.GradeResult
    estimation: grading.Estimation

    @property
    def name(self) -> str:
        return self.selection.port.name

    @property
    def measured(self) -> bool:
        """``True`` si la predicción se comparó contra observaciones **de este puerto**."""
        return self.metrics.observation_source is not None

    @property
    def region(self) -> str:
        port = self.selection.port
        if not port.in_catalogue:
            return "Fuera del catálogo (referencia)"
        return catalog.province_of(port).region_name

    @property
    def province(self) -> str:
        port = self.selection.port
        return catalog.province_of(port).name if port.in_catalogue else "—"


def _fmt(value: float | None, spec: str = ".3f") -> str:
    return "—" if value is None else format(value, spec)


def _anchor(name: str) -> str:
    return catalog.slugify(name)


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
    lines += [
        "",
        "Y dos umbrales que no reparten grade sino que deciden si algo **se publica o no**:",
        "",
        "| Umbral | Unidad | Valor | Qué hace |",
        "|---|---|---|---|",
        f"| Extremos observados por cada uno de marea | × | "
        f"{validate.MAX_OBSERVED_EXTREMES_RATIO:g} | Por encima de esta proporción se considera "
        "que el registro no tiene pleamares identificables y **no se publica** el error de hora "
        "(en vez de publicar uno falso). La comparación es contra los extremos predichos **dentro "
        "de la ventana realmente observada**, que es el campo `predicted_extremes_in_window` de "
        "`quality.metrics`. |",
        f"| Distancia máxima para prestar constantes | km | {catalog.MAX_BORROW_KM:.0f} | El doble "
        "del umbral de grade B. Dentro de esa horquilla el puerto se publica **marcado como "
        "estimado**; por encima **no se publica**, porque describir la marea de otro sitio a esa "
        "distancia ya no es estimar. |",
    ]
    return "\n".join(lines)


def _summary(outcomes: list[PortOutcome], discards: list[catalog.Discard], elapsed: float) -> list[str]:
    grades = Counter(outcome.grade.grade for outcome in outcomes)
    measured = [o for o in outcomes if o.measured]
    estimated = [o for o in outcomes if o.estimation.estimated]
    gauges = {o.selection.chosen.station_id for o in outcomes}
    licenses = Counter(o.selection.chosen.license_type for o in outcomes)
    total = len(outcomes)
    distances = sorted(o.selection.chosen_distance_km for o in outcomes)

    def share(count: int) -> str:
        return f"{count} ({count / total:.0%})" if total else "0"

    return [
        "## Resumen",
        "",
        "| | |",
        "|---|---:|",
        f"| Puertos publicados | **{total}** |",
        f"| Con observación propia (la predicción se ha comparado **aquí**) | {share(len(measured))} |",
        f"| Estimados (constantes prestadas y/o sin observación propia) | {share(len(estimated))} |",
        f"| Grade A | {share(grades['A'])} |",
        f"| Grade B | {share(grades['B'])} |",
        f"| Grade C | {share(grades['C'])} |",
        f"| Mareógrafos distintos de los que salen las constantes | {len(gauges)} |",
        f"| Distancia al mareógrafo: mediana / máxima | "
        f"{statistics.median(distances):.1f} km / {max(distances):.1f} km |",
        "| Licencias de origen | "
        + " · ".join(f"{name} ×{count}" for name, count in sorted(licenses.items()))
        + " |",
        f"| Candidatos descartados (ver «Qué se descartó») | {len(discards)} |",
        f"| Tiempo de pipeline | {elapsed / 60:.1f} min |",
        "",
        "**Un puerto estimado no es un puerto malo: es un puerto del que no tenemos medida.** Sus "
        "horas salen de las constantes armónicas del mareógrafo más cercano, que describen la marea "
        "de ese punto y no la de su dársena, y nadie ha comprobado aquí cuánto se equivocan. El "
        "dataset lo dice en `quality.estimated` y la página lo dice con esas palabras.",
        "",
    ]


def _coverage_table(outcomes: list[PortOutcome]) -> list[str]:
    by_region: dict[str, list[PortOutcome]] = defaultdict(list)
    for outcome in outcomes:
        by_region[outcome.region].append(outcome)
    lines = [
        "### Cobertura y grades por región",
        "",
        "| Región | Puertos | A | B | C | Medidos | Estimados | Dist. mediana al mareógrafo |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for region in sorted(by_region):
        group = by_region[region]
        grades = Counter(o.grade.grade for o in group)
        median = statistics.median(sorted(o.selection.chosen_distance_km for o in group))
        lines.append(
            f"| [{region}](#{_anchor(region)}) | {len(group)} | {grades['A']} | {grades['B']} "
            f"| {grades['C']} | {sum(1 for o in group if o.measured)} "
            f"| {sum(1 for o in group if o.estimation.estimated)} | {median:.1f} km |"
        )
    grades = Counter(o.grade.grade for o in outcomes)
    lines.append(
        f"| **Total** | **{len(outcomes)}** | **{grades['A']}** | **{grades['B']}** "
        f"| **{grades['C']}** | **{sum(1 for o in outcomes if o.measured)}** "
        f"| **{sum(1 for o in outcomes if o.estimation.estimated)}** | |"
    )
    return [*lines, ""]


def _worst_table(outcomes: list[PortOutcome]) -> list[str]:
    measured = [o for o in outcomes if o.metrics.nrmse is not None]
    measured.sort(key=lambda o: -(o.metrics.nrmse or 0.0))
    lines = [
        f"### Los {WORST_LIMIT} peores de los medidos",
        "",
        "Ordenados por RMSE normalizado, que es lo que compara puertos de tres metros de carrera con "
        "puertos de veinte centímetros. Los estimados no salen aquí porque no tienen error medido "
        "que ordenar: eso es justo lo que los hace estimados.",
        "",
        "| Puerto | Provincia | Rango | RMSE | nRMSE | R² | p95 hora | Grade |",
        "|---|---|---:|---:|---:|---:|---:|:-:|",
    ]
    for outcome in measured[:WORST_LIMIT]:
        metrics = outcome.metrics
        lines.append(
            f"| {outcome.name} | {outcome.province} | {metrics.predicted_range_m:.2f} m "
            f"| {_fmt(metrics.rmse_m)} m | {_fmt(metrics.nrmse, '.4f')} | {_fmt(metrics.r2, '.4f')} "
            f"| {_fmt(metrics.hw_time_err_p95_min, '.1f')} min | **{outcome.grade.grade}** |"
        )
    return [*lines, ""]


def _discards_section(discards: list[catalog.Discard]) -> list[str]:
    by_kind = Counter(discard.reason_kind for discard in discards)
    lines = [
        "## Qué se descartó y por qué",
        "",
        "El volcado de GeoNames trae más instalaciones portuarias de las que se publican. "
        f"{len(discards)} candidatos se quedaron fuera, y este es el reparto por motivo:",
        "",
        "| Motivo | Candidatos |",
        "|---|---:|",
    ]
    for kind, count in sorted(by_kind.items(), key=lambda pair: -pair[1]):
        lines.append(f"| {kind} | {count} |")
    lines += [
        "",
        "El descarte que más importa es **«sin mareógrafo»**: son puertos reales de la costa "
        "española que no se publican porque no hay constantes armónicas defendibles que darles. Se "
        "listan uno a uno para que el hueco del portal sea un dato y no un olvido.",
        "",
        "| Candidato | Provincia | Motivo |",
        "|---|---|---|",
    ]
    for discard in sorted(discards, key=lambda d: (d.province, d.name)):
        if discard.reason_kind != "sin mareógrafo":
            continue
        lines.append(f"| {discard.name} | {discard.province} | {discard.reason} |")
    lines += [
        "",
        "<details><summary>El resto de descartes, uno a uno</summary>",
        "",
        "| Candidato | Provincia | Motivo | Detalle |",
        "|---|---|---|---|",
    ]
    for discard in sorted(discards, key=lambda d: (d.reason_kind, d.province, d.name)):
        if discard.reason_kind == "sin mareógrafo":
            continue
        lines.append(
            f"| {discard.name} | {discard.province} | {discard.reason_kind} | {discard.reason} |"
        )
    return [*lines, "", "</details>", ""]


def _measured_table(group: list[PortOutcome]) -> list[str]:
    lines = [
        "| Puerto | Mareógrafo | Dist. | Licencia | Registro | Rango | RMSE | nRMSE | R² | p95 hora "
        "| Cruzado | Trunc. | Grade |",
        "|---|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|:-:|",
    ]
    for outcome in group:
        gauge = outcome.selection.chosen
        metrics = outcome.metrics
        lines.append(
            f"| {outcome.name} | `{gauge.station_id}` "
            f"| {outcome.selection.chosen_distance_km:.2f} km | {gauge.license_type} "
            f"| {gauge.epoch_start[:4]}–{gauge.epoch_end[:4]} | {metrics.predicted_range_m:.2f} m "
            f"| {_fmt(metrics.rmse_m)} m | {_fmt(metrics.nrmse, '.4f')} | {_fmt(metrics.r2, '.4f')} "
            f"| {_fmt(metrics.hw_time_err_p95_min, '.1f')} min | {_fmt(metrics.cross_rmse_m)} m "
            f"| {metrics.truncation_rms_m * 100:.2f} cm | **{outcome.grade.grade}** |"
        )
    return lines


def _estimated_table(group: list[PortOutcome]) -> list[str]:
    lines = [
        "| Puerto | Mareógrafo del que toma las constantes | Dist. | Licencia | Rango predicho "
        "| Trunc. | Grade |",
        "|---|---|---:|---|---:|---:|:-:|",
    ]
    for outcome in group:
        gauge = outcome.selection.chosen
        metrics = outcome.metrics
        lines.append(
            f"| {outcome.name} | `{gauge.station_id}` "
            f"| {outcome.selection.chosen_distance_km:.2f} km | {gauge.license_type} "
            f"| {metrics.predicted_range_m:.2f} m | {metrics.truncation_rms_m * 100:.2f} cm "
            f"| **{outcome.grade.grade}** |"
        )
    return lines


def _regions_section(outcomes: list[PortOutcome]) -> list[str]:
    by_region: dict[str, list[PortOutcome]] = defaultdict(list)
    for outcome in outcomes:
        by_region[outcome.region].append(outcome)
    lines = ["## Resultados por región", ""]
    for region in sorted(by_region):
        group = sorted(by_region[region], key=lambda o: (o.province, o.name))
        measured = [o for o in group if o.measured]
        estimated = [o for o in group if not o.measured]
        lines += [f"### {region}", ""]
        if measured:
            lines += [
                f"**Medidos contra observación propia ({len(measured)})** — el RMSE y el error de "
                "hora son de este puerto, no de otro.",
                "",
                *_measured_table(measured),
                "",
            ]
        if estimated:
            lines += [
                f"**Estimados ({len(estimated)})** — sin observación propia. Las columnas de error "
                "no existen a propósito: no hay número que poner que sea verdad.",
                "",
                *_estimated_table(estimated),
                "",
            ]
    return lines


def _grade_reasons(outcomes: list[PortOutcome]) -> list[str]:
    measured = [o for o in outcomes if o.measured]
    lines = [
        "## Por qué cada puerto medido tiene ese grade",
        "",
        "Sólo los medidos: el motivo de los estimados es siempre el mismo —no hay observación con la "
        "que comprobar la predicción— y está en `quality.estimated_reason` de cada JSON.",
        "",
    ]
    for outcome in sorted(measured, key=lambda o: (o.region, o.province, o.name)):
        lines.append(
            f"- **{outcome.name}** (`{outcome.selection.port.id}`) → "
            f"**{outcome.grade.grade}**: {outcome.grade.reason}."
        )
    return [*lines, ""]


def _contrast_section(outcomes: list[PortOutcome]) -> list[str]:
    lines = ["## Contraste y candidatas descartadas (puertos medidos)", ""]
    for outcome in sorted((o for o in outcomes if o.measured), key=lambda o: (o.region, o.name)):
        metrics = outcome.metrics
        rejected = outcome.selection.rejected
        lines.append(f"- **{outcome.name}** — validado contra {metrics.observation_source}")
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
            in_window = metrics.predicted_extremes_in_window
            ratio = metrics.observed_extremes / max(in_window, 1)
            extremes = (
                f"**hora de extremo no medible**: {metrics.observed_extremes} extremos observados "
                f"frente a {in_window} de marea en la ventana realmente cubierta "
                f"(×{ratio:.1f}, por encima del ×{validate.MAX_OBSERVED_EXTREMES_RATIO:g} "
                "admitido), así que el registro no tiene pleamares identificables y emparejarlos "
                "no mediría nada"
            )
        else:
            extremes = (
                f"{metrics.matched_extremes}/{metrics.predicted_extremes_in_window} extremos "
                "emparejados en la ventana observada"
            )
        lines.append(f"  ({metrics.samples} muestras, {extremes}); {corroboration}.")
        if rejected:
            listed = ", ".join(
                f"`{other.station_id}` ({distance:.2f} km, {other.license_type}, "
                f"{other.epoch_start[:4]}–{other.epoch_end[:4]})"
                for distance, other in rejected[:6]
            )
            lines.append(f"  Descartadas: {listed}.")
    return [*lines, ""]


def _truncation_section(outcomes: list[PortOutcome]) -> list[str]:
    dropped = {name for o in outcomes for name in o.metrics.dropped_constituents}
    costs = sorted(o.metrics.truncation_rms_m for o in outcomes)
    over_a = [o for o in outcomes if o.metrics.truncation_rms_m > grading.MAX_TRUNCATION_RMS_M["A"]]
    lines = [
        "## Truncado al catálogo del motor de producción",
        "",
        "TICON-4 publica hasta 50 constantes por estación; el motor de mareas de "
        f"`packages/domain-core` implementa **{len(ENGINE_CONSTITUENTS)}** —el juego estándar de 37 "
        "de NOAA más los cinco que le añadió T-04— y falla ruidosamente ante cualquier otra. El "
        "dataset se trunca a ese juego **antes de emitirse**, y lo descartado se conserva en "
        "`source.dropped_constituents` de cada JSON con su amplitud y su fase.",
        "",
        "`truncación (RMS)` es el coste **medido**: la diferencia cuadrática media entre la "
        "predicción que se emite y la del juego completo sobre la misma ventana de 30 días.",
        "",
        "| | |",
        "|---|---:|",
        f"| Coste mediano del truncado | {statistics.median(costs) * 100:.2f} cm RMS |",
        f"| Coste máximo | {max(costs) * 100:.2f} cm RMS |",
        f"| Puertos por encima del umbral de grade A "
        f"({grading.MAX_TRUNCATION_RMS_M['A'] * 100:.0f} cm) | {len(over_a)} de {len(outcomes)} |",
        "",
        f"Constantes descartadas en algún puerto: {', '.join(sorted(dropped)) or 'ninguna'}.",
        "",
        f"Los {WORST_LIMIT} puertos a los que más les cuesta el truncado:",
        "",
        "| Puerto | Constantes emitidas | Descartadas | Truncación (RMS) | Suma de amplitudes |",
        "|---|---:|---:|---:|---:|",
    ]
    for outcome in sorted(outcomes, key=lambda o: -o.metrics.truncation_rms_m)[:WORST_LIMIT]:
        metrics = outcome.metrics
        published = len(outcome.selection.chosen.constituents)
        emitted = published - len(metrics.dropped_constituents)
        lines.append(
            f"| {outcome.name} | {emitted} de {published} "
            f"| {len(metrics.dropped_constituents)} "
            f"| {metrics.truncation_rms_m * 100:.2f} cm "
            f"| {metrics.dropped_amplitude_m * 100:.2f} cm |"
        )
    return [*lines, ""]


def render(
    outcomes: list[PortOutcome],
    *,
    discards: list[catalog.Discard],
    generated_at: dt.datetime,
    tarball_sha256: str,
    pinned_commit: str,
    geonames_sha256: str,
    elapsed_seconds: float,
    notes: list[str],
) -> str:
    """Compone el informe QC completo."""
    stamp = generated_at.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    micro_tidal = [o for o in outcomes if o.metrics.predicted_range_m < MICRO_TIDAL_RANGE_M]
    lines = [
        f"# Informe QC del dataset de estaciones — {generated_at.date().isoformat()}",
        "",
        f"Generado por `data/pipeline` el {stamp} en {elapsed_seconds / 60:.1f} min. Reproducible "
        "con `make all` desde `data/pipeline` (ver su `README.md`).",
        "",
        *_summary(outcomes, discards, elapsed_seconds),
        *_coverage_table(outcomes),
        *_worst_table(outcomes),
        "## Procedencia",
        "",
        "- Constantes armónicas: **TICON-4** vía `openwatersio/tide-database`, commit "
        f"`{pinned_commit[:12]}`.",
        f"- Huella sha256 del contenido leído de ese commit: `{tarball_sha256}`.",
        "- Catálogo de puertos (nombre del municipio y coordenadas de dársena): volcado "
        "`ES.zip` de **GeoNames**, "
        "[CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/). GeoNames no publica versiones, "
        "así que aquí no hay commit que fijar: la huella sha256 del volcado usado es "
        f"`{geonames_sha256}`, y el artefacto congelado es `data/geo/ports.json`.",
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
        *_discards_section(discards),
    ]

    if micro_tidal:
        named = ", ".join(f"**{o.name}**" for o in sorted(micro_tidal, key=lambda o: o.name))
        lines += [
            "## Aviso: puertos micromareales",
            "",
            f"{len(micro_tidal)} puertos tienen un rango de marea por debajo de "
            f"{MICRO_TIDAL_RANGE_M:.2f} m. Ahí la marea astronómica existe y se calcula igual de "
            "bien —las constantes son las mismas y el motor no se equivoca más—, pero **el residuo "
            "meteorológico la domina**: un cambio de presión o un par de días de viento mueven el "
            "nivel más que la propia marea, y eso no lo predice ninguna suma armónica. Por eso su "
            "RMSE normalizado se dispara y su grade baja, aunque el error absoluto en metros sea de "
            "los mejores del conjunto.",
            "",
            "Consecuencia de producto: en estos puertos la tabla de mareas es un dato menor y el "
            "valor para el usuario está en el solunar y en la meteorología marina. La página debe "
            "decirlo, no esconderlo detrás de una tabla de pleamares de precisión aparente.",
            "",
            f"Son: {named}.",
            "",
        ]

    lines += [
        *_regions_section(outcomes),
        *_grade_reasons(outcomes),
        *_contrast_section(outcomes),
        *_truncation_section(outcomes),
    ]
    if notes:
        lines += ["## Notas y limitaciones", ""]
        lines += [f"- {note}" for note in notes]
    return "\n".join(lines) + "\n"
