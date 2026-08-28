/**
 * Tipos de los periodos solunares. Todo instante es epoch ms UTC; la zona horaria solo aparece
 * como etiqueta del día civil que se pidió (ver `civil-day.ts`).
 */

import type { EpochMs } from "../tides/types.ts";
import type { GeoLocation, HorizonEvent, MoonIllumination } from "../astronomy/types.ts";

/**
 * `major` (mayor) es la ventana en torno a un tránsito de la Luna; `minor` (menor), la ventana en
 * torno a su orto o su ocaso. La teoría solunar de John Alden Knight (1926) sostiene que la
 * actividad de los peces se concentra ahí; este módulo no la discute, la calcula.
 */
export type SolunarPeriodKind = "major" | "minor";

/** El fenómeno lunar que ancla el periodo y le da su instante central. */
export type SolunarAnchor = "upper-transit" | "lower-transit" | "moonrise" | "moonset";

/** Ventana de actividad centrada en un fenómeno lunar. */
export interface SolunarPeriod {
  readonly kind: SolunarPeriodKind;
  readonly anchor: SolunarAnchor;
  readonly startUtcMs: EpochMs;
  /** Instante del fenómeno: el centro exacto de la ventana. */
  readonly peakUtcMs: EpochMs;
  readonly endUtcMs: EpochMs;
  /** Si la ventana solapa el orto o el ocaso del Sol ±30 min (lo que da el bonus del rating). */
  readonly overlapsSolarEvent: boolean;
}

/** Etiquetas del rating, con umbrales exactos definidos en `rating.ts`. */
export type SolunarRatingLabel = "baja" | "media" | "alta" | "muy-alta";

/**
 * Rating de actividad del día, desglosado para que sea auditable: quien lo lee puede ver por qué
 * salió lo que salió sin recalcularlo.
 */
export interface SolunarRating {
  /** Entero en [0, 100]. */
  readonly score: number;
  readonly label: SolunarRatingLabel;
  /** Parte del rating que aporta la fase lunar, en [30, 80]. */
  readonly moonScore: number;
  /** Parte que aportan los periodos que caen sobre el orto o el ocaso solar, en [0, 20]. */
  readonly solarBonus: number;
  /** Días (siempre ≥ 0) hasta la luna nueva o llena más próxima al mediodía civil. */
  readonly daysFromSyzygy: number;
  /** Cuántos periodos del día solapan un orto/ocaso solar. */
  readonly solarOverlapCount: number;
}

/** Lo que hay que saber para calcular un día solunar. */
export interface SolunarDayQuery {
  readonly location: GeoLocation;
  /** Día civil en formato `YYYY-MM-DD`. */
  readonly dateIso: string;
  /** Zona horaria IANA en la que se interpreta `dateIso` (p. ej. `Europe/Madrid`). */
  readonly timeZone: string;
}

/**
 * Los periodos solunares que intersecan un día civil, con su rating.
 *
 * El día **lunar** dura 24 h 50 min, así que un día **civil** contiene 1 o 2 periodos mayores y
 * 0, 1 o 2 menores: entre 1 y 4 en total. Que falte alguno no es un fallo, es la aritmética.
 */
export interface SolunarDay {
  readonly dateIso: string;
  readonly timeZone: string;
  readonly dayStartUtcMs: EpochMs;
  readonly dayEndUtcMs: EpochMs;
  /** Ordenados por instante de comienzo. */
  readonly periods: readonly SolunarPeriod[];
  /** Estado de la Luna en el mediodía civil del día. */
  readonly moon: MoonIllumination;
  /** Ortos y ocasos del Sol tenidos en cuenta para el bonus: la evidencia del rating. */
  readonly solarEvents: readonly HorizonEvent[];
  readonly rating: SolunarRating;
}
