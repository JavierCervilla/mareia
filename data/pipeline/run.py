#!/usr/bin/env python3
"""Orquestador del pipeline de estaciones de Mareia.

    python run.py fetch      # sólo descarga (calienta la caché)
    python run.py build      # descarga + reconcilia + valida + escribe JSON e informe QC
    python run.py check      # valida los JSON ya commiteados contra el schema station/v1

Todas las fuentes son públicas y anónimas: el pipeline no lee ninguna credencial.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

from mareia_pipeline import grade as grading
from mareia_pipeline import report, schema
from mareia_pipeline.ports import PILOT_PORTS, Port
from mareia_pipeline.reconcile import Selection, select, to_station_v1
from mareia_pipeline.sources import ioc
from mareia_pipeline.sources.tide_database import GaugeRecord, load_gauges
from mareia_pipeline.tides.predict import Harmonic
from mareia_pipeline.validate import Metrics, evaluate

REPO_ROOT = Path(__file__).resolve().parents[2]
REPORTS_DIR = Path(__file__).resolve().parent / "reports"

#: Ventana de validación: 30 días es lo que el servicio del IOC sirve de una vez y basta para
#: separar las constituyentes principales entre sí (criterio de Rayleigh) en la comparación.
VALIDATION_DAYS = 30

#: Radio en el que se busca un mareógrafo del IOC que observe el mismo puerto.
OBSERVATION_RADIUS_KM = 5.0

#: Radio dentro del cual otro mareógrafo mide, a efectos prácticos, la misma marea.
CROSS_CHECK_RADIUS_KM = 5.0

NOTES = [
    "**Los extremos se detectan por prominencia, no comparando puntos vecinos.** Un extremo sólo "
    "cuenta cuando la señal se aleja de él un 5 % del rango de marea en sentido contrario. Sin ese "
    "filtro, un registro real de 6 segundos en puerto micromareal daba decenas de miles de "
    "«pleamares» donde había cuarenta, y entonces cualquier predicción encontraba siempre una "
    "observada al lado: el error de hora salía magnífico y era mentira. Al corregirlo, varias p95 "
    "empeoraron respecto a la primera medición —Huelva pasó de 17,9 a 22,9 min y con ella de A a "
    "B—, que es lo que había realmente.",
    "**El truncado a 37 constituyentes es hoy el techo del dataset**, no la calidad de las "
    "constantes ni la de la predicción. Es lo que impide llegar a grade A a Vigo, Santander y "
    "Brest, que contra observaciones reales van tan bien como los que sí lo alcanzan (R² > 0,99 y "
    "error de hora de pleamar p95 por debajo de 16 min). Si el motor de `packages/domain-core` "
    "añadiera los cinco descartados de más peso —`EP2`, `MA2`, `MB2`, `MKS2` y `2MS6`, todos con "
    "número de Doodson publicado y ya implementados en `tides/constituents.py` de este pipeline— el "
    "coste de truncado bajaría del umbral de A en esos tres puertos sin tocar el dataset.",
    "**REDMAR / Puertos del Estado: no viable en el piloto.** No hay endpoint público de constantes "
    "armónicas: `portus.puertos.es/portussvr/api/*` devuelve 404 en todas las rutas tanteadas y "
    "`bancodatos.puertos.es` sirve una página vacía; los informes con constantes son PDF detrás de "
    "un formulario de sesión. La rama REDMAR de la política de reconciliación está escrita y tiene "
    "la máxima prioridad, así que en cuanto exista una vía automatizable entra sin tocar el código.",
    "**FES2022 queda fuera del piloto**: requiere credenciales AVISO/CNES, que son una acción "
    "humana registrada aparte.",
    "**Licencia del dataset.** La mayoría de las estaciones elegidas son CC-BY 4.0, pero en los "
    "puertos donde el único mareógrafo disponible viene por CMEMS la licencia de origen es "
    "**CC-BY-NC 4.0** (restricción del proveedor GESLA aguas arriba). Está declarada estación por "
    "estación en `source.attribution[].license` y en `source.primary.license`. Mareia es no "
    "comercial, así que el uso es conforme, pero el dataset **no puede redistribuirse entero como "
    "CC-BY 4.0 sin más**: quien lo reutilice comercialmente debe excluir esas estaciones.",
    "Las observaciones del IOC son nivel del mar total (marea + residuo meteorológico + cero del "
    "mareógrafo). El RMSE se calcula alineando las medias de ambas series, de modo que mide la "
    "forma de la señal y no el desfase de cero, que se trata aparte en `datum.msl_offset_m`.",
    "El motor de predicción de este pipeline es una implementación propia (Doodson + correcciones "
    "nodales de Schureman) verificada constituyente a constituyente contra la implementación de "
    "referencia `@neaps/tide-predictor`; las discrepancias que quedan están acotadas y "
    "documentadas en `tests/test_reference_engine.py`.",
]


def _harmonics(gauge: GaugeRecord) -> list[Harmonic]:
    return [Harmonic(c["name"], c["amplitude"], c["phase"]) for c in gauge.constituents]


def _window_start(days: int) -> dt.datetime:
    """Comienzo de la ventana de validación: los últimos ``days`` días completos hasta hoy en UTC."""
    today = dt.datetime.now(dt.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return today - dt.timedelta(days=days)


def _alternatives(selection: Selection) -> list[tuple[str, list[Harmonic]]]:
    """Análisis independientes del mismo puerto contra los que contrastar las constantes.

    Se limita al entorno inmediato de la dársena: un mareógrafo a 20 km mide otra marea, y
    compararse con él mediría la geografía, no la calidad de las constantes.
    """
    return [
        (other.station_id, _harmonics(other))
        for distance, other in selection.rejected
        if other.station_id != selection.chosen.station_id
        and distance <= CROSS_CHECK_RADIUS_KM
    ]


def _evaluate_port(
    port: Port, gauges: list[GaugeRecord], *, refresh: bool
) -> tuple[Selection, Metrics]:
    selection = select(port, gauges)
    observations = ioc.fetch_observations(
        port.lat,
        port.lon,
        days=VALIDATION_DAYS,
        max_km=OBSERVATION_RADIUS_KM,
        refresh=refresh,
    )
    if observations is None:
        # Sin mareógrafo del IOC en la dársena, se mide donde está el que presta las constantes.
        # Eso valida **las constantes**, no el emplazamiento, y no infla el grade: la distancia al
        # mareógrafo es un umbral aparte que ya penaliza al puerto que no tiene el suyo.
        observations = ioc.fetch_observations(
            selection.chosen.lat,
            selection.chosen.lon,
            days=VALIDATION_DAYS,
            max_km=OBSERVATION_RADIUS_KM,
            refresh=refresh,
        )
    metrics = evaluate(
        _harmonics(selection.chosen),
        observations,
        window_start=_window_start(VALIDATION_DAYS),
        window_days=float(VALIDATION_DAYS),
        alternatives=_alternatives(selection),
    )
    return selection, metrics


def command_fetch(args: argparse.Namespace) -> int:
    """Calienta la caché: tarball de constantes y series observadas de cada puerto."""
    gauges, digest = load_gauges(refresh=args.refresh)
    print(f"tide-database: {len(gauges)} estaciones de referencia · sha256 {digest[:16]}…")
    for port in PILOT_PORTS:
        observations = ioc.fetch_observations(
            port.lat, port.lon, days=VALIDATION_DAYS, max_km=OBSERVATION_RADIUS_KM, refresh=args.refresh
        )
        if observations is None:
            print(f"  {port.id}: sin observaciones IOC utilizables")
        else:
            print(
                f"  {port.id}: IOC {observations.code} · {len(observations.times)} muestras · "
                f"{observations.span_days:.1f} días"
            )
    return 0


def command_build(args: argparse.Namespace) -> int:
    """Reconcilia, valida, escribe los JSON de estación y el informe QC."""
    gauges, digest = load_gauges(refresh=args.refresh)
    generated_at = dt.datetime.now(dt.timezone.utc)
    outcomes: list[report.PortOutcome] = []
    failures = 0

    for port in PILOT_PORTS:
        selection, metrics = _evaluate_port(port, gauges, refresh=args.refresh)
        result = grading.assign(
            metrics, selection.chosen.epoch_years, selection.chosen_distance_km
        )
        document = to_station_v1(
            selection,
            quality={
                "rmse_m": metrics.rmse_m,
                "hw_time_err_p95_min": metrics.hw_time_err_p95_min,
                "grade": result.grade,
                "validated_against": metrics.observation_source
                or "contraste cruzado entre fuentes (sin observaciones)",
                "grade_reason": result.reason,
                "metrics": metrics.as_dict(),
            },
            derived_at=generated_at,
            tarball_sha256=digest,
        )
        errors = schema.validation_errors(document)
        if errors:
            failures += 1
            print(f"✗ {port.id} no valida contra station/v1:", file=sys.stderr)
            for error in errors:
                print(f"    {error}", file=sys.stderr)
            continue
        target = REPO_ROOT / port.output
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        outcomes.append(report.PortOutcome(selection, metrics, result))
        print(
            f"✓ {port.id:32} {selection.chosen.station_id:28} "
            f"{selection.chosen_distance_km:6.2f} km  grade {result.grade}"
        )

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS_DIR / f"QC-{generated_at.date().isoformat()}.md"
    report_path.write_text(
        report.render(
            outcomes,
            generated_at=generated_at,
            tarball_sha256=digest,
            pinned_commit=args.commit,
            notes=NOTES,
        ),
        encoding="utf-8",
    )
    print(f"informe QC → {report_path.relative_to(REPO_ROOT)}")
    return 1 if failures else 0


def command_check(_: argparse.Namespace) -> int:
    """Valida contra el schema los JSON de estación ya commiteados."""
    files = schema.station_files()
    if not files:
        print("no hay ficheros de estación que validar", file=sys.stderr)
        return 1
    failures = 0
    for path in files:
        errors = schema.validation_errors(json.loads(path.read_text(encoding="utf-8")))
        if errors:
            failures += 1
            print(f"✗ {path.relative_to(REPO_ROOT)}", file=sys.stderr)
            for error in errors:
                print(f"    {error}", file=sys.stderr)
        else:
            print(f"✓ {path.relative_to(REPO_ROOT)}")
    return 1 if failures else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--refresh", action="store_true", help="ignora la caché y vuelve a descargar todo"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("fetch", help="calienta la caché de descargas")
    build = subparsers.add_parser("build", help="genera los JSON de estación y el informe QC")
    build.add_argument(
        "--commit",
        default=None,
        help="commit de tide-database a citar en el informe (por defecto, el fijado en el código)",
    )
    subparsers.add_parser("check", help="valida los JSON commiteados contra station/v1")

    args = parser.parse_args(argv)
    if getattr(args, "commit", None) is None:
        from mareia_pipeline.sources.tide_database import PINNED_COMMIT

        args.commit = PINNED_COMMIT

    handlers = {"fetch": command_fetch, "build": command_build, "check": command_check}
    return handlers[args.command](args)


if __name__ == "__main__":
    raise SystemExit(main())
