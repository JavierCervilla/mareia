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
import time
from pathlib import Path

from mareia_pipeline import catalog
from mareia_pipeline import grade as grading
from mareia_pipeline import report, schema
from mareia_pipeline.ports import PILOT_PORTS, Port
from mareia_pipeline.reconcile import Selection, select, to_station_v1
from mareia_pipeline.sources import geonames, ioc
from mareia_pipeline.sources.tide_database import GaugeRecord, load_gauges
from mareia_pipeline.tides.predict import Harmonic
from mareia_pipeline.validate import Metrics, evaluate

REPO_ROOT = Path(__file__).resolve().parents[2]
REPORTS_DIR = Path(__file__).resolve().parent / "reports"
PORTS_JSON = REPO_ROOT / "data" / "geo" / "ports.json"

#: Ventana de validación: 30 días es lo que el servicio del IOC sirve de una vez y basta para
#: separar las constituyentes principales entre sí (criterio de Rayleigh) en la comparación.
VALIDATION_DAYS = 30

#: Radio en el que se busca un mareógrafo del IOC que observe el mismo puerto.
OBSERVATION_RADIUS_KM = 5.0

#: Radio dentro del cual otro mareógrafo mide, a efectos prácticos, la misma marea.
CROSS_CHECK_RADIUS_KM = 5.0

NOTES = [
    "**Un puerto sólo publica el error que se ha medido en él.** Hasta T-05, cuando no había "
    "mareógrafo del IOC en la dársena se medía la predicción donde estaba el mareógrafo que presta "
    "las constantes y ese RMSE se publicaba como del puerto. Con doce puertos era una nota al pie; "
    "con doscientos es la mentira que esta trayectoria existe para no cometer, porque un número "
    "medido a 25 km no es la precisión de este sitio. Ahora ese puerto publica `rmse_m: null`, "
    "`hw_time_err_p95_min: null` y `estimated: true` con su motivo. El efecto se ve en el reparto: "
    "los puertos medidos son los que tienen mareógrafo propio, y son minoría.",
    "**La predicción del QC de T-05 se cumplió a medias, y el error estaba en el propio informe.** "
    "Aquel informe dijo que el truncado a 37 constituyentes era «lo que impide llegar a grade A a "
    "Vigo, Santander y Brest». Regenerado con los 42 que el motor soporta desde T-04, el coste del "
    "truncado bajó del umbral de A en los tres, como estaba previsto: Vigo 1,30 → 0,69 cm RMS, "
    "Santander 1,06 → 0,50 y Brest 2,23 → 0,47. Pero sólo **Santander y Brest** subieron a A. Vigo "
    "sigue en B porque incumple **otro** umbral, el error de hora de pleamar (26,8 min sobre 20), y "
    "ya lo incumplía en T-05 con 25,4 min: el motivo del grade se paraba en el primer umbral que "
    "fallaba y nunca llegó a nombrarlo. Arreglado en `grade.assign`, que ahora enumera **todos** "
    "los umbrales incumplidos; un informe que sólo nombra un obstáculo invita a predecir que "
    "quitarlo basta.",
    "**Los extremos se detectan por prominencia, no comparando puntos vecinos.** Un extremo sólo "
    "cuenta cuando la señal se aleja de él un 5 % del rango de marea en sentido contrario. Sin ese "
    "filtro, un registro real de 6 segundos en puerto micromareal daba decenas de miles de "
    "«pleamares» donde había cuarenta, y entonces cualquier predicción encontraba siempre una "
    "observada al lado: el error de hora salía magnífico y era mentira. Al corregirlo, varias p95 "
    "empeoraron respecto a la primera medición —Huelva pasó de 17,9 a 22,9 min y con ella de A a "
    "B—, que es lo que había realmente.",
    "**El catálogo ya no se escribe a mano.** Doce puertos se teclean; doscientos, no: teclear "
    "doscientas coordenadas de memoria sería publicar doscientos números que nadie ha medido, que "
    "es exactamente lo que este dataset no hace. Los puertos derivados salen del volcado público de "
    "GeoNames —instalación portuaria real para la coordenada, municipio oficial para el nombre— y "
    "la política de curación, con su registro de descartes, está en `catalog.py` y en la sección "
    "«Qué se descartó y por qué» de este informe. Los doce del piloto siguen escritos a mano y con "
    "sus coordenadas de T-05 intactas.",
    "**El techo del catálogo lo pone la fuente, no el filtro.** GeoNames documenta pocas "
    "instalaciones portuarias en la cornisa cantábrica (Asturias, Cantabria, Lugo y Gipuzkoa salen "
    "con dos o tres puertos cada una, cuando tienen decenas). Publicar el resto exigiría una "
    "segunda fuente de topónimos portuarios, no relajar el filtro: la lista corta es un hueco "
    "conocido, no un criterio más laxo esperando a ser aplicado.",
    "**REDMAR / Puertos del Estado: sigue sin ser viable.** No hay endpoint público de constantes "
    "armónicas: `portus.puertos.es/portussvr/api/*` devuelve 404 en todas las rutas tanteadas y "
    "`bancodatos.puertos.es` sirve una página vacía; los informes con constantes son PDF detrás de "
    "un formulario de sesión. La rama REDMAR de la política de reconciliación está escrita y tiene "
    "la máxima prioridad, así que en cuanto exista una vía automatizable entra sin tocar el código. "
    "Es también la fuente que arreglaría de golpe la mitad de los puertos estimados.",
    "**FES2022 queda fuera**: requiere credenciales AVISO/CNES, que son una acción humana "
    "registrada aparte.",
    "**Licencias: el dataset no es de una sola.** Las constantes son CC-BY 4.0 salvo donde el único "
    "mareógrafo disponible viene por CMEMS, que es **CC-BY-NC 4.0** (restricción del proveedor "
    "GESLA aguas arriba), y va declarada estación por estación en `source.primary.license` y en "
    "`source.attribution[].license`. La identidad de los puertos derivados es **CC-BY 4.0 de "
    "GeoNames**, y su atribución viaja dentro de cada JSON de estación, no en un README. Mareia es "
    "no comercial, así que el uso es conforme, pero el dataset **no puede redistribuirse entero "
    "como CC-BY 4.0 sin más**: quien lo reutilice comercialmente debe excluir las estaciones NC.",
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
    # La observación se busca **en la dársena del puerto y en ningún otro sitio**. Hasta T-13, si no
    # había mareógrafo del IOC cerca se medía donde estaba el que presta las constantes y el puerto
    # publicaba ese RMSE como suyo. Con doce puertos era una nota al pie; con doscientos es la
    # mentira de esta trayectoria: un número medido a 25 km no es la precisión de este puerto. Sin
    # observación propia, las métricas salen `null` y el puerto se marca como estimado.
    observations = ioc.fetch_observations(
        port.lat,
        port.lon,
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


def _catalogue(gauges: list[GaugeRecord], *, refresh: bool) -> tuple[list[Port], list[catalog.Discard], str]:
    """El catálogo completo: los puertos escritos a mano más los derivados de GeoNames."""
    entries, digest = geonames.load_dump(refresh=refresh)
    spanish = [gauge for gauge in gauges if gauge.country == "Spain"]
    derived = catalog.build(entries, spanish, PILOT_PORTS)
    return [*PILOT_PORTS, *derived.ports], derived.discards, digest


def _geonames_attribution(digest: str) -> list[dict[str, str]]:
    """Crédito del volcado del que sale la identidad de un puerto derivado. Lo exige su licencia."""
    return [
        {
            "name": "GeoNames",
            "url": geonames.ATTRIBUTION_URL,
            "license": geonames.LICENSE,
            "license_url": geonames.LICENSE_URL,
            "role": (
                "catálogo de puertos: nombre del municipio y coordenadas de la dársena · huella "
                f"sha256 del volcado {digest[:16]}…"
            ),
        }
    ]


def _ports_json(ports: list[Port]) -> dict[str, object]:
    """El catálogo público ``ports/v1``, ordenado por identificador para que el diff sea legible.

    El orden de publicación (región → provincia → puerto, alfabético en español) lo pone el caso de
    uso `listPorts`, no este fichero: aquí manda que dos ejecuciones produzcan el mismo texto.
    """
    entries = []
    for port in sorted((p for p in ports if p.in_catalogue), key=lambda p: p.id):
        province = catalog.province_of(port)
        entries.append(
            {
                "slug": port.slug,
                "name": port.name,
                "province": {"slug": province.slug, "name": province.name},
                "region": {"slug": province.region_slug, "name": province.region_name},
                "lat": port.lat,
                "lon": port.lon,
                "timezone": port.timezone,
                "stationFile": Path(port.output).name,
            }
        )
    return {"schema": "ports/v1", "ports": entries}


def command_fetch(args: argparse.Namespace) -> int:
    """Calienta la caché: volcado de GeoNames, constantes y series observadas de cada puerto."""
    gauges, digest = load_gauges(refresh=args.refresh)
    print(f"tide-database: {len(gauges)} estaciones de referencia · sha256 {digest[:16]}…")
    ports, discards, geonames_digest = _catalogue(gauges, refresh=args.refresh)
    print(
        f"catálogo: {len(ports)} puertos ({len(ports) - len(PILOT_PORTS)} derivados de GeoNames, "
        f"{len(discards)} candidatos descartados) · sha256 {geonames_digest[:16]}…"
    )
    with_observation = 0
    for port in ports:
        observations = ioc.fetch_observations(
            port.lat, port.lon, days=VALIDATION_DAYS, max_km=OBSERVATION_RADIUS_KM, refresh=args.refresh
        )
        if observations is not None:
            with_observation += 1
            print(
                f"  {port.id}: IOC {observations.code} · {len(observations.times)} muestras · "
                f"{observations.span_days:.1f} días"
            )
    print(f"{with_observation} de {len(ports)} puertos tienen observación propia con la que medir")
    return 0


def command_build(args: argparse.Namespace) -> int:
    """Reconcilia, valida, escribe los JSON de estación, el catálogo público y el informe QC."""
    started = time.monotonic()
    gauges, digest = load_gauges(refresh=args.refresh)
    ports, discards, geonames_digest = _catalogue(gauges, refresh=args.refresh)
    generated_at = dt.datetime.now(dt.timezone.utc)
    outcomes: list[report.PortOutcome] = []
    failures = 0
    published: list[Port] = []

    for port in ports:
        selection, metrics = _evaluate_port(port, gauges, refresh=args.refresh)
        result = grading.assign(
            metrics, selection.chosen.epoch_years, selection.chosen_distance_km
        )
        estimation = grading.estimate(
            gauge_id=selection.chosen.station_id,
            gauge_distance_km=selection.chosen_distance_km,
            observation_source=metrics.observation_source,
        )
        document = to_station_v1(
            selection,
            quality={
                "rmse_m": metrics.rmse_m,
                "hw_time_err_p95_min": metrics.hw_time_err_p95_min,
                "grade": result.grade,
                "validated_against": metrics.observation_source
                or "sin observación propia: la predicción no se ha comprobado en este puerto",
                "grade_reason": result.reason,
                "estimated": estimation.estimated,
                "estimated_reason": estimation.reason,
                "metrics": metrics.as_dict(),
            },
            derived_at=generated_at,
            tarball_sha256=digest,
            extra_attribution=(
                None if port in PILOT_PORTS else _geonames_attribution(geonames_digest)
            ),
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
        published.append(port)
        outcomes.append(report.PortOutcome(selection, metrics, result, estimation))
        print(
            f"{'~' if estimation.estimated else '✓'} {port.id:36} "
            f"{selection.chosen.station_id:30} "
            f"{selection.chosen_distance_km:6.2f} km  grade {result.grade}"
        )

    _prune_stations(published)
    PORTS_JSON.write_text(
        json.dumps(_ports_json(published), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"catálogo público → {PORTS_JSON.relative_to(REPO_ROOT)}")

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS_DIR / f"QC-{generated_at.date().isoformat()}.md"
    report_path.write_text(
        report.render(
            outcomes,
            discards=discards,
            generated_at=generated_at,
            tarball_sha256=digest,
            pinned_commit=args.commit,
            geonames_sha256=geonames_digest,
            elapsed_seconds=time.monotonic() - started,
            notes=NOTES,
        ),
        encoding="utf-8",
    )
    print(f"informe QC → {report_path.relative_to(REPO_ROOT)}")
    print(f"{len(published)} puertos en {time.monotonic() - started:.0f} s")
    return 1 if failures else 0


def _prune_stations(published: list[Port]) -> None:
    """Borra los JSON de estación que ya no corresponden a ningún puerto del catálogo.

    Sin esto, un puerto que deja de cumplir el filtro (se le va el mareógrafo, cambia el volcado)
    dejaría su fichero atrás y el catálogo tendría una estación huérfana: exactamente lo que el test
    de coherencia de T-07 prohíbe, pero descubierto en CI en vez de aquí.
    """
    keep = {(REPO_ROOT / port.output).resolve() for port in published}
    for path in schema.station_files():
        if path.resolve() not in keep:
            path.unlink()
            print(f"– {path.relative_to(REPO_ROOT)} (ya no está en el catálogo)")


def command_check(_: argparse.Namespace) -> int:
    """Valida contra el schema los JSON de estación ya commiteados y su coherencia con el catálogo.

    Es el camino **offline**: no toca la red y es el que corre CI. Con doce estaciones bastaba con
    validar el schema; con doscientas hay un segundo modo de romperlo —que el catálogo y el dataset
    se desincronicen— y esperar a que lo cace el test de TypeScript es esperar de más.
    """
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
    print(f"✓ {len(files) - failures} de {len(files)} estaciones validan contra station/v1")
    failures += _check_catalogue()
    return 1 if failures else 0


def _check_catalogue() -> int:
    """Comprueba que ``ports.json`` y ``data/stations`` se describen el uno al otro, sin huecos."""
    catalogue = json.loads(PORTS_JSON.read_text(encoding="utf-8"))
    referenced = {port["stationFile"] for port in catalogue["ports"]}
    on_disk = {
        path.name for path in schema.station_files() if path.parent.name == "stations"
    }
    problems = 0
    for missing in sorted(referenced - on_disk):
        problems += 1
        print(f"✗ el catálogo apunta a {missing}, que no existe", file=sys.stderr)
    for orphan in sorted(on_disk - referenced):
        problems += 1
        print(f"✗ {orphan} no lo referencia ningún puerto del catálogo", file=sys.stderr)
    slugs = [port["slug"] for port in catalogue["ports"]]
    if len(set(slugs)) != len(slugs):
        problems += 1
        print("✗ hay slugs repetidos en el catálogo", file=sys.stderr)
    if problems == 0:
        print(f"✓ el catálogo describe las {len(referenced)} estaciones publicadas, sin huérfanas")
    return problems


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
