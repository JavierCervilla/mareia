/**
 * Efeméride falsa: una implementación de `AstronomyGateway` con los fenómenos puestos a mano.
 *
 * Existe para poder afirmar cosas **exactas** sobre `solunar/` (a qué minuto empieza cada ventana,
 * cuánto suma el bonus solar, qué pasa cuando un día no tiene orto de Luna) sin que el resultado
 * dependa de la mecánica celeste. Que esto sea posible es la prueba de que `solunar/` es puro
 * sobre la interfaz y no sobre el motor.
 *
 * Solo de test.
 */

import type {
  AstronomyGateway,
  CelestialBody,
  HorizonEvent,
  HorizonEventKind,
  HorizontalPosition,
  MoonDistance,
  MoonIllumination,
  MoonQuarterEvent,
  SkySearch,
  SkySearchOptions,
  TransitEvent,
  TransitKind,
} from "../../astronomy/types.ts";

const MS_PER_DAY = 86_400_000;

/** Guion de fenómenos con el que responde la efeméride falsa. Todo en epoch ms UTC. */
export interface FakeSky {
  readonly upperTransits: readonly number[];
  readonly lowerTransits: readonly number[];
  readonly moonrises: readonly number[];
  readonly moonsets: readonly number[];
  readonly sunrises: readonly number[];
  readonly sunsets: readonly number[];
  readonly quarters: readonly MoonQuarterEvent[];
  readonly illuminatedFraction: number;
}

function nextAfter(times: readonly number[], afterUtcMs: number): number | undefined {
  return times.filter((time) => time > afterUtcMs).sort((left, right) => left - right)[0];
}

function timesFor(sky: FakeSky, body: CelestialBody, kind: HorizonEventKind): readonly number[] {
  if (body === "moon") {
    return kind === "rise" ? sky.moonrises : sky.moonsets;
  }
  return kind === "rise" ? sky.sunrises : sky.sunsets;
}

/** Construye la efeméride falsa a partir del guion. */
export function fakeGateway(sky: FakeSky): AstronomyGateway {
  return {
    horizontalPosition(_body, _location, atUtcMs): HorizontalPosition {
      return { timeUtcMs: atUtcMs, altitude_deg: 0, azimuth_deg: 0, refraction: "standard" };
    },

    searchHorizonEvent(
      body: CelestialBody,
      _location,
      fromUtcMs: number,
      kind: HorizonEventKind,
      options?: SkySearchOptions,
    ): SkySearch<HorizonEvent> {
      const searchDays = options?.searchDays ?? 1;
      const limitUtcMs = fromUtcMs + searchDays * MS_PER_DAY;
      const found = nextAfter(timesFor(sky, body, kind), fromUtcMs);
      if (found === undefined || found > limitUtcMs) {
        return {
          outcome: "no-event",
          reason: "always-below",
          searchedFromUtcMs: fromUtcMs,
          searchedDays: searchDays,
        };
      }
      return { outcome: "event", event: { kind, body, timeUtcMs: found, azimuth_deg: 90 } };
    },

    searchTwilight(_location, fromUtcMs: number, kind, phase): SkySearch<never> {
      throw new Error(`solunar/ no debería pedir crepúsculos (${kind}/${phase}) en ${fromUtcMs}`);
    },

    searchTransit(
      body: CelestialBody,
      _location,
      fromUtcMs: number,
      kind: TransitKind,
    ): TransitEvent {
      const times = kind === "upper" ? sky.upperTransits : sky.lowerTransits;
      const found = nextAfter(times, fromUtcMs);
      if (found === undefined) {
        // El guion se agotó: se devuelve un instante lejano, que el llamante descartará por estar
        // fuera de la ventana. Nunca `null`: el contrato dice que el tránsito siempre existe.
        return {
          kind,
          body,
          timeUtcMs: fromUtcMs + 100 * MS_PER_DAY,
          altitude_deg: 0,
          azimuth_deg: 180,
        };
      }
      return { kind, body, timeUtcMs: found, altitude_deg: 45, azimuth_deg: 180 };
    },

    moonIllumination(atUtcMs: number): MoonIllumination {
      return {
        timeUtcMs: atUtcMs,
        phaseAngle_deg: 180,
        ageDays: 14.7,
        illuminatedFraction: sky.illuminatedFraction,
        name: "full",
      };
    },

    moonDistance(atUtcMs: number): MoonDistance {
      return { timeUtcMs: atUtcMs, distance_km: 384_400 };
    },

    nextMoonQuarters(fromUtcMs: number, count: number): readonly MoonQuarterEvent[] {
      return sky.quarters.filter((quarter) => quarter.timeUtcMs > fromUtcMs).slice(0, count);
    },
  };
}
