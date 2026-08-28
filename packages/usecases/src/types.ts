/**
 * Entidades de aplicación y **puertos** (interfaces) de los casos de uso.
 *
 * Esta capa solo mira hacia `domain-core`: define QUÉ necesita para trabajar (un repositorio de
 * puertos, uno de estaciones, una efeméride y un reloj) y no sabe de dónde sale. Quien los
 * implementa es `@mareia/adapters`; quien los enchufa, el composition root de la API.
 */

import type { AstronomyGateway, EpochMs, TideDatum, TideStation } from "@mareia/domain-core";

/** Segmento de la jerarquía geográfica: su `slug` es un tramo de la URL pública (T-09). */
export interface GeoSegment {
  readonly slug: string;
  readonly name: string;
}

/**
 * Un puerto del catálogo, tal y como vive en `data/geo/ports.json`.
 *
 * `stationFile` es **infraestructura**: identifica el JSON de constantes armónicas dentro del
 * dataset y por eso no viaja en las respuestas del API (ver `PortSummary`).
 */
export interface Port {
  readonly slug: string;
  readonly name: string;
  readonly province: GeoSegment;
  readonly region: GeoSegment;
  readonly lat: number;
  readonly lon: number;
  /** Zona horaria IANA en la que se interpretan las fechas civiles del puerto. */
  readonly timezone: string;
  readonly stationFile: string;
}

/** Cero hidrográfico de la estación: el `TideDatum` del motor más la referencia que lo nombra. */
export interface StationDatum extends TideDatum {
  /** Referencia vertical declarada en el dataset, p. ej. `"LAT"`. */
  readonly reference: string;
}

/**
 * Calidad medida de la estación en el QC del pipeline (T-05).
 *
 * Los nombres son **los del dataset**, sin traducir: lo que publica el API se puede rastrear campo
 * a campo hasta `data/stations/<id>.json` sin una tabla de equivalencias. Los `null` son
 * significativos — en los puertos micromareales (grade C) no hay pleamares identificables en la
 * observación, así que el error de hora **no se publica** en vez de publicarse un número falso.
 */
export interface StationQuality {
  readonly grade: string;
  readonly rmse_m: number | null;
  readonly hw_time_err_p95_min: number | null;
  readonly grade_reason: string | null;
  readonly validated_against: string | null;
}

/** Atribución de una fuente del dataset. Viaja en las respuestas porque su licencia lo exige. */
export interface SourceAttribution {
  readonly name: string;
  readonly url: string;
  readonly license: string;
  readonly license_url: string | null;
  readonly role: string | null;
}

/**
 * Una estación del dataset: lo que el motor de mareas necesita (`TideStation`) más los metadatos
 * que la hacen auditable. La traducción desde el fichero la hace el adaptador, no el caso de uso.
 */
export interface StationRecord extends TideStation {
  readonly datum: StationDatum;
  readonly lat: number;
  readonly lon: number;
  readonly timezone: string;
  readonly quality: StationQuality;
  readonly attributions: readonly SourceAttribution[];
}

/** Catálogo de puertos. */
export interface PortRepository {
  list(): Promise<readonly Port[]>;
  /** `undefined` si el slug no existe: el caso de uso decide que eso es un 404. */
  findBySlug(slug: string): Promise<Port | undefined>;
}

/** Constantes armónicas y metadatos por estación, direccionados por `Port.stationFile`. */
export interface StationRepository {
  load(stationFile: string): Promise<StationRecord>;
}

/**
 * Todo lo que los casos de uso necesitan del exterior. El reloj entra por aquí (y no como
 * `Date.now()` incrustado) para que la ventana del almanaque —año actual ±1— sea testeable.
 */
export interface UseCaseDeps {
  readonly ports: PortRepository;
  readonly stations: StationRepository;
  readonly astronomy: AstronomyGateway;
  readonly now: () => EpochMs;
}
