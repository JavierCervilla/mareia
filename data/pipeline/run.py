#!/usr/bin/env python3
"""Orquestador del pipeline de estaciones de Mareia.

    python run.py fetch      # sólo descarga (calienta la caché)
    python run.py build      # descarga + reconcilia + valida + escribe JSON e informe QC
    python run.py check      # valida los JSON ya commiteados contra el schema station/v1
    python run.py normativa  # ingesta del RD 560/1995 del BOE → data/normativa/tallas-minimas.json
    python run.py verificar-normativa   # gate G2: ¿sigue en vigor lo que publicamos?
    python run.py areas-protegidas      # ingesta de RAMPE 2025 → data/geo/areas-protegidas.json
    python run.py especies              # WoRMS + OBIS → data/especies/catalogo.json
    python run.py fotos                 # Wikidata P18 + Commons → data/especies/fotos.json

Todas las fuentes son públicas y anónimas: el pipeline no lee ninguna credencial.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
import time
import urllib.error
from collections import Counter
from pathlib import Path

from mareia_pipeline import areas, catalog, especies, fotos, normativa, report, schema, utm
from mareia_pipeline import grade as grading
from mareia_pipeline.ports import PILOT_PORTS, Port
from mareia_pipeline.reconcile import Selection, select, to_station_v1
from mareia_pipeline.sources import boe, cache, commons, geonames, ioc, obis, rampe, worms
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

    El ``caladero`` sale de ``normativa.caladero_de_puerto`` y no de una columna escrita a mano
    porque este fichero se **regenera** entero en cada `build`: un campo tecleado aquí duraría
    hasta la siguiente ejecución. Si un puerto nuevo cae en una provincia sin caladero asignado,
    esto levanta y el catálogo no se publica — antes que publicarle a un puerto la tabla de tallas
    de otro mar.
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
                "caladero": normativa.caladero_de_puerto(port.slug, province.slug),
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
    failures += _check_normativa()
    failures += _check_areas_protegidas()
    failures += _check_especies()
    failures += _check_fotos()
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


def _check_normativa() -> int:
    """Gate G1 (procedencia) sobre el dataset de normativa y el caladero de cada puerto.

    Offline y en el mismo `check` que ya corre CI: una cifra legal sin origen declarado no llega a
    publicarse, y un puerto sin caladero tampoco. Si el dataset todavía no existe no se inventa un
    verde: se dice que falta y se cuenta como fallo, porque el módulo `regulations` lo necesita.
    """
    problems = 0
    if not normativa.DATASET.exists():
        print(
            f"✗ falta {normativa.DATASET.relative_to(REPO_ROOT)}: genéralo con "
            "`python run.py normativa`",
            file=sys.stderr,
        )
        problems += 1
    else:
        dataset = normativa.cargar()
        errores = normativa.errores_de_procedencia(dataset)
        for error in errores:
            print(f"✗ procedencia: {error}", file=sys.stderr)
        problems += len(errores)
        if not errores:
            especies = sum(len(c["especies"]) for c in dataset["caladeros"])
            print(
                f"✓ G1 · las {especies} tallas de los {len(dataset['caladeros'])} caladeros "
                "declaran bloque, fecha de vigencia y ELI"
            )
        derogadas = normativa.errores_de_trinquete(dataset)
        for error in derogadas:
            print(f"✗ trinquete: {error}", file=sys.stderr)
        problems += len(derogadas)
        if not derogadas:
            print(
                f"✓ G3 · las {len(normativa.TRINQUETE_CANARIO)} especies canarias que movió el RD "
                "936/2025 publican su talla vigente y no la de 1995"
            )
        # G4 · las cifras publicadas son las que dice la fuente. G3 fija seis especies elegidas
        # a mano; esto regenera el dataset entero desde las respuestas capturadas del BOE y lo
        # diffea, así que cubre las 118 tallas de los tres anexos sin salir a la red.
        regeneradas = normativa.errores_de_reconstruccion(dataset)
        for error in regeneradas:
            print(f"✗ reconstrucción: {error}", file=sys.stderr)
        problems += len(regeneradas)
        if not regeneradas:
            especies = sum(len(c["especies"]) for c in dataset["caladeros"])
            print(
                f"✓ G4 · las {especies} tallas publicadas son, campo a campo, las que salen de la "
                "fuente capturada del BOE"
            )
        fuera_de_rango = normativa.errores_de_rango(dataset)
        for error in fuera_de_rango:
            print(f"✗ rango: {error}", file=sys.stderr)
        problems += len(fuera_de_rango)
        if not fuera_de_rango:
            print("✓ G5 · ninguna talla publicada es cero ni negativa")
    catalogo = json.loads(PORTS_JSON.read_text(encoding="utf-8"))
    errores = normativa.errores_de_caladeros_de_puertos(catalogo)
    for error in errores:
        print(f"✗ caladero: {error}", file=sys.stderr)
    problems += len(errores)
    if not errores:
        print(f"✓ los {len(catalogo['ports'])} puertos del catálogo declaran su caladero")
    return problems


def command_normativa(args: argparse.Namespace) -> int:
    """Ingesta del RD 560/1995: BOE → `data/normativa/tallas-minimas.json`.

    Necesita red y no corre en CI, igual que `build`: el dataset se commitea. El gate G1 se pasa
    **antes** de escribir, así que un documento sin procedencia no llega ni al disco.
    """
    hoy = dt.datetime.now(dt.timezone.utc).date()
    metadatos, anexos = boe.descargar_anexos(hoy=hoy, refresh=args.refresh)
    print(f"{metadatos.identificador} · {metadatos.titulo}")
    print(f"  vigente: derogación={metadatos.estatus_derogacion} agotada={metadatos.vigencia_agotada}")
    # `verificado_en` lo pone `sellar_verificacion`, que es el único sitio desde el que se escribe:
    # esta ejecución acaba de comprobar contra el BOE lo mismo que comprueba el gate diario.
    dataset = normativa.sellar_verificacion(
        normativa.construir_dataset(metadatos, anexos, verificado_en=hoy), hoy
    )
    errores = normativa.errores_de_procedencia(dataset)
    if errores:
        for error in errores:
            print(f"✗ procedencia: {error}", file=sys.stderr)
        return 1
    for caladero, anexo in zip(dataset["caladeros"], anexos, strict=True):
        reparto = Counter(especie["talla"]["tipo"] for especie in caladero["especies"])
        ligadas = sum(1 for especie in caladero["especies"] if especie["notas"])
        print(
            f"  {caladero['anexo']:9} {caladero['id']:34} en vigor desde "
            f"{caladero['fechaVigencia']} por {caladero['normaModificadora']} · "
            f"{len(anexo.especies)} especies · {len(anexo.notas)} notas ({ligadas} ligadas)"
        )
        for tipo, cuantas in sorted(reparto.items()):
            print(f"      {tipo:18} {cuantas}")
    normativa.volcar(dataset)
    print(f"normativa → {normativa.DATASET.relative_to(REPO_ROOT)}")
    return 0


def _check_areas_protegidas() -> int:
    """Gates P1, P2 y P4 del derivado de áreas marinas protegidas. Offline y determinista.

    Los tres miran cosas distintas y ninguno cubre a los otros:

    * **P1 · la reproyección está atada.** Vive en `utm` y no necesita ningún dato publicado: es
      aritmética contra una cuadratura, tres invariantes exactas y dos anclas geográficas. Corre
      aunque el dataset no exista todavía, porque si la inversa se ha ido lo que hay que saber es
      eso y no que falta un fichero.
    * **P4 · el CRS se lee, no se supone.** La lectura real pasa en la ingesta, con red; aquí se
      comprueba que el camino de aborto sigue vivo y que todo lo publicado salió de un EPSG del mapa
      cerrado. Un gate cuyo rojo se ha muerto da verde igual que uno que funciona.
    * **P2 · la geometría no cruza.** Se mide sobre el **artefacto**: ni una clave de geometría, ni
      una lista de números, ni un puerto que pase del tope de bytes.
    * **P5 · las dos métricas siguen diciendo lo mismo.** Compara lo que publicaría la distancia al
      borde con lo que publicaría la distancia al vértice. La comparación se **calcula con la
      fuente** en la ingesta y viaja publicada en el artefacto, porque aquí no hay red: sin ese
      bloque, comprobar la divergencia costaría volver a bajarse los 54,8 MB de RAMPE.
    * **P6 · lo publicado se vuelve a derivar de la geometría capturada.** Es el único que compara
      el artefacto contra **la fuente** y no contra sí mismo, y cubre las 7 áreas del fixture de
      RAMPE. Lo que no cubre lo dice su propia línea de ✓ y su docstring, porque un gate parcial que
      no dice dónde acaba se lee como uno completo.
    """
    problems = 0
    desvios = utm.errores_de_reproyeccion()
    for desvio in desvios:
        print(f"✗ P1 · reproyección: {desvio}", file=sys.stderr)
    problems += len(desvios)
    if not desvios:
        print(
            f"✓ P1 · la inversa de Krüger cae donde debe: arco de meridiano, invariantes de UTM, "
            f"escala de la serie, el punto UTM que publica un tercero a "
            f"{utm.PUNTO_PUBLICADO.desvio_medido_m} m de donde lo publica —única capa que ata "
            f"k0={utm.K0}; la cita, en `utm.PUNTO_PUBLICADO.fuente`— y {len(utm.ANCLAS)} anclas "
            f"geográficas a menos de {utm.TOLERANCIA_ANCLA_KM:.0f} km de su puerto"
        )
    muertos = rampe.errores_de_gate_de_crs()
    for muerto in muertos:
        print(f"✗ P4 · CRS: {muerto}", file=sys.stderr)
    problems += len(muertos)
    if not muertos:
        print(
            f"✓ P4 · el CRS se lee de la fuente: {len(utm.PROYECCIONES)} EPSG conocidos y "
            f"{len(rampe._CRS_QUE_DEBEN_ABORTAR)} plausibles que abortan, sin zona por defecto"
        )
    if not areas.DATASET.exists():
        print(
            f"✗ falta {areas.DATASET.relative_to(REPO_ROOT)}: genéralo con "
            "`python run.py areas-protegidas`",
            file=sys.stderr,
        )
        return problems + 1
    dataset = areas.cargar()
    epsg_publicados = set(dataset.get("fuente", {}).get("censo", {}).get("porEpsg", {}))
    desconocidos = sorted(epsg_publicados - {str(codigo) for codigo in utm.PROYECCIONES})
    for codigo in desconocidos:
        problems += 1
        print(
            f"✗ P4 · el dataset publica áreas reproyectadas desde EPSG:{codigo}, que no está en el "
            "mapa cerrado de proyecciones",
            file=sys.stderr,
        )
    geometria = areas.errores_de_geometria(dataset)
    for error in geometria:
        print(f"✗ P2 · geometría: {error}", file=sys.stderr)
    problems += len(geometria)
    if not geometria:
        censo = dataset["fuente"]["censo"]
        print(
            f"✓ P2 · las {censo['areas']} áreas publican nombre, tipo y distancia y ni uno de sus "
            f"{censo['verticesEnOrigen']} vértices"
        )
    divergencia = areas.errores_de_divergencia(dataset)
    for error in divergencia:
        print(f"✗ P5 · métrica: {error}", file=sys.stderr)
    problems += len(divergencia)
    if not divergencia:
        comparativa = dataset["comparativa"]
        print(
            f"✓ P5 · la distancia se mide al borde y no al vértice: son "
            f"{comparativa['entranSoloPorElBorde']} relaciones de diferencia sobre "
            f"{comparativa['relacionesPorBorde']} —exactamente las "
            f"{areas.DIVERGENCIA_MEDIDA_RELACIONES} medidas, ni una más ni una menos—, la mayor de "
            f"{comparativa['mayorDiferenciaKm']} km en {comparativa['mayorDiferenciaEn']}; la "
            f"arista más larga de la fuente mide {comparativa['aristaMaxM']} m"
        )
    catalogo = json.loads(PORTS_JSON.read_text(encoding="utf-8"))
    reconstruccion = areas.errores_de_reconstruccion(dataset, catalogo)
    for error in reconstruccion:
        print(f"✗ P6 · reconstrucción: {error}", file=sys.stderr)
    problems += len(reconstruccion)
    if not reconstruccion:
        alcance = areas.alcance_de_la_reconstruccion(dataset)
        sin_cubrir = alcance["relacionesPublicadas"] - alcance["relacionesCubiertas"]
        print(
            f"✓ P6 · las {alcance['relacionesCubiertas']} relaciones de las "
            f"{alcance['areasCubiertas']} áreas del recorte capturado se vuelven a derivar de su "
            f"geometría y coinciden campo a campo (nombre, figura, distancia y «dentro»). NO cubre "
            f"las otras {sin_cubrir} de {alcance['relacionesPublicadas']}: el fixture son "
            f"{alcance['areasCubiertas']} de las {alcance['areasEnLaFuente']} áreas de la fuente, "
            f"porque RAMPE 2025 son 54,8 MB que no se commitean"
        )
    cobertura = areas.errores_de_cobertura(dataset, catalogo)
    for error in cobertura:
        print(f"✗ áreas protegidas: {error}", file=sys.stderr)
    problems += len(cobertura)
    if not cobertura:
        resumen = dataset["resumen"]
        print(
            f"✓ los {resumen['puertos']} puertos declaran sus áreas protegidas: "
            f"{resumen['conArea']} con alguna ({resumen['relaciones']} relaciones) y "
            f"{resumen['sinArea']} que dicen que no hay ninguna a "
            f"{dataset['criterio']['radioKm']:.0f} km"
        )
    return problems


def command_areas_protegidas(args: argparse.Namespace) -> int:
    """Ingesta de RAMPE 2025: MITECO → `data/geo/areas-protegidas.json`.

    Necesita red y no corre en CI, igual que `build` y `normativa`: el dataset se commitea. Los
    gates P2, P5 y de cobertura se pasan **antes** de escribir, así que un documento con geometría
    dentro, con un puerto de menos o con las dos métricas separándose más de lo declarado no llega
    ni al disco.
    """
    cuerpo = rampe.descargar(refresh=args.refresh)
    huella = cache.sha256(cuerpo)
    lote = rampe.leer_zip(cuerpo)
    print(f"RAMPE 2025 · {len(cuerpo)} bytes · sha256 {huella[:16]}…")
    for fichero, que in rampe.FICHEROS.items():
        del_fichero = [area for area in lote if area.fichero == fichero]
        epsg = {area.epsg for area in del_fichero}
        print(
            f"  {fichero:18} {len(del_fichero):3} áreas · {que} · CRS declarado "
            f"{', '.join(f'EPSG:{codigo}' for codigo in sorted(epsg))}"
        )
    for tipo, cuantas in sorted(Counter(area.tipo for area in lote).items()):
        print(f"      {tipo:15} {cuantas}")
    catalogo = json.loads(PORTS_JSON.read_text(encoding="utf-8"))
    dataset = areas.construir_dataset(
        catalogo,
        lote,
        descargado_en=dt.datetime.now(dt.timezone.utc).date(),
        sha256=huella,
    )
    errores = [
        *(f"geometría: {error}" for error in areas.errores_de_geometria(dataset)),
        *(f"cobertura: {error}" for error in areas.errores_de_cobertura(dataset, catalogo)),
        *(f"métrica: {error}" for error in areas.errores_de_divergencia(dataset)),
    ]
    if errores:
        for error in errores:
            print(f"✗ {error}", file=sys.stderr)
        return 1
    areas.volcar(dataset)
    resumen = dataset["resumen"]
    print(
        f"  {resumen['conArea']} de {resumen['puertos']} puertos tienen alguna área a "
        f"{dataset['criterio']['radioKm']:.0f} km ({resumen['relaciones']} relaciones); "
        f"{resumen['sinArea']} publican que no hay ninguna"
    )
    comparativa = dataset["comparativa"]
    print(
        f"  medir al borde y no al vértice añade {comparativa['entranSoloPorElBorde']} relaciones "
        f"({comparativa['relacionesPorVertice']} → {comparativa['relacionesPorBorde']}); la mayor "
        f"diferencia son {comparativa['mayorDiferenciaKm']} km en "
        f"{comparativa['mayorDiferenciaEn']}, y la arista más larga de la fuente mide "
        f"{comparativa['aristaMaxM']} m"
    )
    print(f"áreas protegidas → {areas.DATASET.relative_to(REPO_ROOT)}")
    return 0


def command_verificar_normativa(_: argparse.Namespace) -> int:
    """Gate G2: ¿lo que publicamos sigue siendo lo que dice el BOE hoy?

    Tres desenlaces y tres códigos de salida, porque son tres cosas distintas:

    * **0** — sigue en vigor y nada ha cambiado. Se reescribe `verificadoEn` y sólo aquí.
    * **1** — la norma está derogada o el texto consolidado ha cambiado. Rojo: el portal está
      publicando cifras que ya no son las de la norma.
    * **2** — no se ha podido preguntar (la red, el BOE caído). Ámbar: `verificadoEn` **no se
      toca**, la página degrada sola al envejecer el sello y el despliegue no se rompe por una
      caída ajena. Confundir este caso con el anterior es o romper el deploy cada vez que el BOE
      tenga un mal día, o dejar pasar una derogación en silencio.
    """
    dataset = normativa.cargar()
    try:
        metadatos = boe.descargar_metadatos(refresh=True)
        indice = boe.descargar_indice(refresh=True)
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        print(f"⚠ no se ha podido consultar el BOE: {error}", file=sys.stderr)
        print(
            "  verificadoEn NO se toca: sigue en "
            f"{dataset['fuente']['verificadoEn']} y la página degradará sola al envejecer.",
            file=sys.stderr,
        )
        return 2
    resultado = normativa.comparar_vigencia(dataset, metadatos, indice)
    if resultado.estado == normativa.CAMBIO:
        print(f"✗ {resultado.motivo}", file=sys.stderr)
        for diferencia in resultado.diferencias:
            print(f"    {diferencia}", file=sys.stderr)
        return 1
    hoy = dt.datetime.now(dt.timezone.utc).date()
    normativa.volcar(normativa.sellar_verificacion(dataset, hoy))
    print(f"✓ {resultado.motivo}")
    print(f"  verificadoEn ← {hoy.isoformat()} en {normativa.DATASET.relative_to(REPO_ROOT)}")
    return 0


def _check_especies() -> int:
    """Gates E2 y E3 del catálogo de especies, más su cobertura. Offline y determinista.

    * **E2 · el mapeo tiene dueño.** Se mide **recomputando**: se compara con qué nombre se
      preguntó a WoRMS contra el nombre del BOE normalizado. Si difieren, la correspondencia la
      decidimos nosotros y tiene que ir firmada con su motivo; si coinciden, la fila no puede
      apuntarse una decisión que no ha tomado. Un gate que sólo exigiera que exista el campo
      `origen` se satisface escribiendo «worms» en todas partes.
    * **E3 · el género no se convierte en especie.** Las filas `spp` publican rango género y su
      ficha entera —todas sus cadenas, no una lista de campos elegida a mano— no nombra ninguna
      especie concreta de ese género.
    * **Los recortes de OBIS cubren su caladero y ninguno más.** Se comprueba contra `ports.json`,
      no contra una declaración del dataset: es lo que hace que la presencia sea de ese caladero.
    * **La clave no colapsa dos filas de la norma.** Se recomputa del literal de cada nombre y se
      comprueba que no haya dos iguales: el BOE escribe «Thunnus thynnus» y «Thunnus Thynnus», que
      cualquier slug en minúsculas convierte en una sola fila que nadie puede distinguir.
    * **Cobertura**: las especies del BOE están todas y las 118 filas de la norma están contadas
      (117 con nombre científico y la de «Cigalas (colas)», que no lo trae y se publica aparte).
    * **E5 · la talla publicada es la de la norma.** Se **rehace** desde `tallas-minimas.json` y se
      diffea campo a campo, `medida` incluida. La talla legal se publica en dos superficies —la
      ficha y la página del puerto— y hasta aquí sólo una tenía quien la contrastara: el catálogo
      copiaba la cifra en la ingesta y podía contradecir al puerto con todo en verde.
    * **E6 · el taxón es el que contestó WoRMS.** Se **rehace** desde las respuestas capturadas,
      recomputando con qué nombre se pregunta. E2 audita de quién es la decisión de preguntar; esto
      audita la respuesta: `aphiaId`, `estado`, `aceptado`, `rango` y `cita`, que no los miraba nada.
    """
    problems = 0
    catalogo = json.loads(PORTS_JSON.read_text(encoding="utf-8"))
    recortes = obis.errores_de_recortes(catalogo)
    for error in recortes:
        print(f"✗ recorte de OBIS: {error}", file=sys.stderr)
    problems += len(recortes)
    if not recortes:
        cajas = sum(len(recorte.cajas) for recorte in obis.RECORTES.values())
        print(
            f"✓ los {cajas} rectángulos de los {len(obis.RECORTES)} recortes de OBIS contienen los "
            f"{len(catalogo['ports'])} puertos de su caladero y ninguno de otro"
        )
    if not especies.DATASET.exists():
        print(
            f"✗ falta {especies.DATASET.relative_to(REPO_ROOT)}: genéralo con "
            "`python run.py especies`",
            file=sys.stderr,
        )
        return problems + 1
    dataset = especies.cargar()
    tallas = normativa.cargar()
    cobertura = especies.errores_de_cobertura(dataset, tallas)
    for error in cobertura:
        print(f"✗ cobertura: {error}", file=sys.stderr)
    problems += len(cobertura)
    if not cobertura:
        resumen = dataset["resumen"]
        print(
            f"✓ el catálogo publica las {resumen['especies']} especies que nombra el RD 560/1995 y "
            f"da cuenta de sus {resumen['filasDelBoe']} filas"
        )
    mapeos = especies.errores_de_mapeo(dataset)
    for error in mapeos:
        print(f"✗ E2 · mapeo: {error}", file=sys.stderr)
    problems += len(mapeos)
    if not mapeos:
        resumen = dataset["resumen"]
        print(
            f"✓ E2 · las {resumen['correspondenciasDeMareia']} correspondencias que no salen de "
            f"WoRMS van firmadas como nuestras y con motivo; las otras "
            f"{resumen['especies'] - resumen['correspondenciasDeMareia']} se preguntaron con el "
            "nombre que escribe la norma"
        )
    generos = especies.errores_de_genero(dataset)
    for error in generos:
        print(f"✗ E3 · género: {error}", file=sys.stderr)
    problems += len(generos)
    if not generos:
        filas = especies.filas_de_genero(dataset)
        distintos = {especies.es_genero(fila["nombreBoe"]) for fila in filas}
        print(
            f"✓ E3 · las {len(filas)} filas «spp» ({len(distintos)} géneros) publican rango género "
            "y ninguna nombra una especie concreta"
        )
    claves = especies.errores_de_clave(dataset)
    for error in claves:
        print(f"✗ clave: {error}", file=sys.stderr)
    problems += len(claves)
    if not claves:
        print(
            f"✓ las {len(dataset['especies'])} claves salen del literal de la norma y ninguna se "
            "repite: «Thunnus thynnus» y «Thunnus Thynnus» son dos filas y dos claves"
        )
    presencia = especies.errores_de_presencia(dataset)
    for error in presencia:
        print(f"✗ presencia: {error}", file=sys.stderr)
    problems += len(presencia)
    if not presencia:
        conteo = sum(
            1
            for e in dataset["especies"]
            for c in e["caladeros"]
            if c.get("presencia") is not None
        )
        print(
            f"✓ las {conteo} cifras de presencia publican su recorte y su frase de sesgo en el "
            "mismo objeto que el número"
        )
    tallas_publicadas = especies.errores_de_tallas(dataset, tallas)
    for error in tallas_publicadas:
        print(f"✗ E5 · talla: {error}", file=sys.stderr)
    problems += len(tallas_publicadas)
    if not tallas_publicadas:
        cifras = sum(len(c["tallas"]) for e in dataset["especies"] for c in e["caladeros"])
        print(
            f"✓ E5 · las {cifras} tallas que publica el catálogo son, campo a campo, las que dice "
            f"{normativa.DATASET.relative_to(REPO_ROOT)}"
        )
    procedencia = especies.errores_de_procedencia(dataset)
    for error in procedencia:
        print(f"✗ E6 · procedencia: {error}", file=sys.stderr)
    problems += len(procedencia)
    if not procedencia:
        resumen = dataset["resumen"]
        print(
            f"✓ E6 · los {resumen['resueltas']} taxones publicados se rehacen desde las respuestas "
            "capturadas de WoRMS y coinciden campo a campo"
        )
    return problems


def command_especies(args: argparse.Namespace) -> int:
    """Ingesta de WoRMS + OBIS: `data/normativa/tallas-minimas.json` → `data/especies/catalogo.json`.

    Necesita red y no corre en CI, igual que `build`, `normativa` y `areas-protegidas`: el dataset
    se commitea. Las consultas van **en serie** —OBIS lo pide expresamente— y con caché en disco.
    Los gates E2, E3 y E5 se pasan **antes** de escribir, así que un mapeo sin dueño, un género
    convertido en especie o una talla que no es la de la norma no llegan ni al disco.

    Escribe **dos** artefactos y en la misma tanda: el catálogo y la captura de las respuestas de
    WoRMS (`especies.volcar_captura`). Son la pareja que compara E6, así que regenerar uno sin el
    otro es lo único que no se puede hacer — y por eso no hay forma de hacerlo desde aquí. E6 corre
    al final contra lo ya escrito: es la comprobación de que la captura que queda en disco
    reconstruye, byte a byte y con el parser de hoy, el taxón que se acaba de publicar.
    """
    hoy = dt.datetime.now(dt.timezone.utc).date()
    tallas = normativa.cargar()
    nombres = especies.nombres_del_boe(tallas)
    print(f"{len(nombres)} nombres científicos en {normativa.DATASET.relative_to(REPO_ROOT)}")

    resoluciones: dict[str, worms.Resolucion] = {}
    #: El cuerpo crudo de cada consulta, que es lo que se captura: el gate E6 rehace el taxón
    #: pasando estos mismos bytes por el parser de hoy. Se guarda por consulta y no por nombre
    #: porque dos grafías del BOE («Thunnus thynnus» y «Thunnus Thynnus») preguntan lo mismo.
    cuerpos: dict[str, bytes] = {}
    for nombre in nombres:
        correspondencia = especies.correspondencia_de(nombre)
        if correspondencia.consulta is None:
            resoluciones[nombre] = especies.sin_consultar(correspondencia)
            continue
        consulta = correspondencia.consulta
        if consulta not in cuerpos:
            cuerpos[consulta] = worms.descargar(consulta, refresh=args.refresh)
        resoluciones[nombre] = worms.leer_respuesta(cuerpos[consulta], consultado=consulta)
    reparto = Counter(resolucion.desenlace for resolucion in resoluciones.values())
    for desenlace, cuantos in sorted(reparto.items()):
        print(f"  WoRMS {desenlace:15} {cuantos}")
    for nombre, resolucion in resoluciones.items():
        registro = resolucion.registro
        if registro and not registro.aceptado:
            print(
                f"      {nombre:32} {registro.estado:20} → {registro.nombre_aceptado} "
                f"({registro.aphia_id_aceptado})"
            )

    presencias: dict[tuple[str, str], obis.Presencia] = {}
    for caladero in tallas["caladeros"]:
        recorte = obis.RECORTES[caladero["id"]]
        del_caladero = {
            e["nombreCientifico"] for e in caladero["especies"] if "nombreCientifico" in e
        }
        for nombre in sorted(del_caladero):
            registro = resoluciones[nombre].registro
            if registro is None:
                continue
            clave = (especies.nombre_para_obis(registro), caladero["id"])
            if clave not in presencias:
                presencias[clave] = obis.consultar(clave[0], recorte, refresh=args.refresh)
        del_recorte = [p for (_, cal), p in presencias.items() if cal == caladero["id"]]
        con_registros = sum(1 for p in del_recorte if p.registros > 0)
        print(
            f"  OBIS  {caladero['id']:36} {len(del_recorte)} taxones consultados, "
            f"{con_registros} con algún registro"
        )

    dataset = especies.construir_dataset(tallas, resoluciones, presencias, consultado_en=hoy)
    errores = [
        *(f"cobertura: {error}" for error in especies.errores_de_cobertura(dataset, tallas)),
        *(f"E2 · mapeo: {error}" for error in especies.errores_de_mapeo(dataset)),
        *(f"E3 · género: {error}" for error in especies.errores_de_genero(dataset)),
        *(f"clave: {error}" for error in especies.errores_de_clave(dataset)),
        *(f"presencia: {error}" for error in especies.errores_de_presencia(dataset)),
        *(f"E5 · talla: {error}" for error in especies.errores_de_tallas(dataset, tallas)),
    ]
    if errores:
        for error in errores:
            print(f"✗ {error}", file=sys.stderr)
        return 1
    especies.volcar(dataset)
    # La captura se escribe **con** el dataset y en la misma tanda: es contra ella contra la que
    # E6 rehace el taxón, y una captura de otro día daría verde describiendo un WoRMS que no es el
    # que se publicó. Va después de `volcar` para que un dataset que no llega al disco tampoco
    # deje una captura suya rondando.
    capturados = especies.volcar_captura(cuerpos)
    print(
        f"  captura de WoRMS → {len(capturados)} respuestas en "
        f"{especies.FUENTE_WORMS_CAPTURADA.relative_to(REPO_ROOT)}"
    )
    procedencia = especies.errores_de_procedencia(dataset)
    if procedencia:
        for error in procedencia:
            print(f"✗ E6 · procedencia: {error}", file=sys.stderr)
        return 1
    resumen = dataset["resumen"]
    print(
        f"  {resumen['resueltas']} resuelven en WoRMS ({resumen['aceptadas']} con el nombre "
        f"aceptado y {resumen['conNombreAceptadoDistinto']} con uno distinto del que usa la norma) "
        f"y {resumen['sinResolver']} no"
    )
    print(f"especies → {especies.DATASET.relative_to(REPO_ROOT)}")
    return 0


def _check_fotos() -> int:
    """Gate F2 del dataset de fotos, más su cobertura. Offline y determinista.

    * **F2 · ninguna foto sin autor y sin licencia.** Toda entrada de `fotos` publica `url`,
      `descripcion`, `autor`, `licencia`, `licenciaUrl` y el `identificadaPor` que dice de qué ítem
      de Wikidata y de qué propiedad sale. Publicar una imagen de Commons sin acreditar a su autor
      y sin decir bajo qué licencia se reutiliza es incumplir la licencia con la que se obtuvo, y
      **no se puede tapar con un pie global**: no hay una licencia común (seis distintas en doce
      ficheros medidos).
    * **Ningún hueco mudo.** Cada una de las claves del catálogo está exactamente en un sitio: en
      `fotos` con su foto o en `sinFoto` **con su motivo**. Una especie que faltara del fichero
      dejaría su ficha sin foto y sin explicación, que es lo que costaron los diez puertos sin área
      de T-21.

    Corre en cada ejecución de CI porque la promesa de la ingesta —que descarta la foto incompleta—
    es del código de hoy, y esto es una condición del artefacto que se publica.
    """
    if not fotos.DATASET.exists():
        print(
            f"✗ falta {fotos.DATASET.relative_to(REPO_ROOT)}: genéralo con `python run.py fotos`",
            file=sys.stderr,
        )
        return 1
    dataset = fotos.cargar()
    catalogo = especies.cargar()
    problems = 0

    cobertura = fotos.errores_de_cobertura(dataset, catalogo)
    for error in cobertura:
        print(f"✗ fotos · cobertura: {error}", file=sys.stderr)
    problems += len(cobertura)
    if not cobertura:
        print(
            f"✓ las {len(catalogo['especies'])} especies del catálogo están en el dataset de "
            f"fotos: {len(dataset['fotos'])} con foto y {len(dataset['sinFoto'])} con el motivo "
            "de no tenerla"
        )

    incompletas = fotos.errores_de_fotos(dataset)
    for error in incompletas:
        print(f"✗ F2 · foto: {error}", file=sys.stderr)
    problems += len(incompletas)
    if not incompletas:
        reparto = fotos.reparto_de_licencias(dataset)
        print(
            f"✓ F2 · las {len(dataset['fotos'])} fotos publican autor y licencia "
            f"({len(reparto)} licencias distintas) y el ítem de Wikidata que las identifica"
        )
    return problems


def command_fotos(args: argparse.Namespace) -> int:
    """Ingesta de Wikidata + Commons: `data/especies/catalogo.json` → `data/especies/fotos.json`.

    Necesita red y no corre en CI, igual que `especies`: el dataset se commitea. Las consultas van
    **en serie** y con caché, y cada una que sale de verdad a la red se identifica con nuestro
    `User-Agent` y obedece el `Retry-After` — Wikimedia limita **por IP** y esto corre desde un
    datacenter compartido.

    Se pregunta **una vez por nombre científico** y no una por especie: el catálogo tiene 86 filas y
    dos grafías del BOE («Thunnus thynnus» y «Thunnus Thynnus») resuelven al mismo taxón, así que
    preguntar por fila sería pedirle a la fuente lo mismo dos veces.

    Los gates se pasan **antes** de escribir: una foto sin autor o sin licencia y una especie sin
    motivo no llegan ni al disco.
    """
    hoy = dt.datetime.now(dt.timezone.utc).date()
    catalogo = especies.cargar()
    nombres = sorted(
        {
            nombre
            for especie in catalogo["especies"]
            if (nombre := fotos.nombre_a_consultar(especie)) is not None
        }
    )
    print(
        f"{len(catalogo['especies'])} especies en {especies.DATASET.relative_to(REPO_ROOT)}, "
        f"{len(nombres)} taxones distintos que preguntar"
    )

    resultados: dict[str, commons.Resultado] = {}
    for nombre in nombres:
        resultados[nombre] = commons.resolver(nombre, refresh=args.refresh)
    reparto = Counter(resultado.desenlace for resultado in resultados.values())
    for desenlace, cuantos in sorted(reparto.items()):
        print(f"  Wikidata/Commons {desenlace:15} {cuantos} taxones")

    dataset = fotos.construir_dataset(catalogo, resultados, consultado_en=hoy)
    errores = [
        *(f"cobertura: {error}" for error in fotos.errores_de_cobertura(dataset, catalogo)),
        *(f"F2 · foto: {error}" for error in fotos.errores_de_fotos(dataset)),
    ]
    if errores:
        for error in errores:
            print(f"✗ {error}", file=sys.stderr)
        return 1
    fotos.volcar(dataset)

    # El censo **por especie**, que no es el mismo que el de taxones de arriba: 86 filas del BOE se
    # preguntan con menos nombres, y la que no resuelve en WoRMS ni se pregunta. Es la cifra que se
    # publica en el README, así que se cuenta sobre lo escrito y no sobre lo consultado.
    por_desenlace = Counter(
        resultados[nombre].desenlace
        if (nombre := fotos.nombre_a_consultar(especie)) is not None
        else "sin_taxon"
        for especie in catalogo["especies"]
    )
    for desenlace, cuantas in sorted(por_desenlace.items()):
        print(f"  especies {desenlace:15} {cuantas}")
    for licencia, cuantas in fotos.reparto_de_licencias(dataset).items():
        print(f"  licencia {licencia:30} {cuantas}")
    print(
        f"  {len(dataset['fotos'])} de las {len(catalogo['especies'])} especies publican foto; "
        f"las otras {len(dataset['sinFoto'])} publican el motivo de no tenerla"
    )
    print(f"fotos → {fotos.DATASET.relative_to(REPO_ROOT)}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
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
    subparsers.add_parser("normativa", help="ingesta del RD 560/1995 del BOE (tallas mínimas)")
    subparsers.add_parser(
        "verificar-normativa", help="gate G2: comprueba que el RD 560/1995 sigue en vigor"
    )
    subparsers.add_parser(
        "areas-protegidas", help="ingesta de RAMPE 2025 (áreas marinas protegidas por puerto)"
    )
    subparsers.add_parser(
        "especies", help="ingesta de WoRMS + OBIS (catálogo de las especies que regula el BOE)"
    )
    subparsers.add_parser(
        "fotos", help="ingesta de Wikidata P18 + Commons (la foto de cada especie, con su licencia)"
    )

    args = parser.parse_args(argv)
    if getattr(args, "commit", None) is None:
        from mareia_pipeline.sources.tide_database import PINNED_COMMIT

        args.commit = PINNED_COMMIT

    handlers = {
        "fetch": command_fetch,
        "build": command_build,
        "check": command_check,
        "normativa": command_normativa,
        "verificar-normativa": command_verificar_normativa,
        "areas-protegidas": command_areas_protegidas,
        "especies": command_especies,
        "fotos": command_fotos,
    }
    return handlers[args.command](args)


if __name__ == "__main__":
    raise SystemExit(main())
