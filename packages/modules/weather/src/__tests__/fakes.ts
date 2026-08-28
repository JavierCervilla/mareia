/**
 * Dobles de prueba del módulo. La regla que sostienen: **en CI no hay red**.
 *
 * Todo lo que el módulo sabe del mundo entra por inyección (`fetch`, caché, reloj, catálogo de
 * puertos), así que aquí se construyen las cuatro piezas y los tests describen escenarios en vez de
 * pelearse con un servidor de mentira.
 */

/** Un `fetch` de mentira que además cuenta a quién se llamó: la afirmación de los tests de caché. */
export interface FetchSpy {
  readonly fetch: typeof fetch;
  /** URLs pedidas, en orden. Su longitud es «cuántas veces se salió a la red». */
  readonly calls: string[];
}

/** Respuesta de mentira para una URL: un JSON, o un fallo si la ruta devuelve un `Error`. */
export type FetchRoute = (url: string) => unknown;

/** `fetch` que resuelve cada URL con `route`. Si `route` lanza, se propaga como fallo de red. */
export function fetchSpy(route: FetchRoute): FetchSpy {
  const calls: string[] = [];
  const fake = (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    const body = route(url);
    if (body instanceof Response) {
      return Promise.resolve(body);
    }
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  };
  return { fetch: fake as typeof fetch, calls };
}

/** `fetch` que siempre falla, para los escenarios de degradación. */
export function failingFetch(message = "ECONNREFUSED"): FetchSpy {
  return fetchSpy(() => {
    throw new Error(message);
  });
}

/** Reloj manejable: los tests hacen envejecer la caché sin esperar una hora. */
export function fakeClock(startMs: number): { now: () => number; advance: (ms: number) => void } {
  let current = startMs;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

/** Respuesta real de la Marine API (capturada el 2026-08-28 para la celda 42,2/-8,7), recortada. */
export const MARINE_FIXTURE = {
  latitude: 42.291664,
  longitude: -8.7916565,
  timezone: "GMT",
  current_units: { time: "iso8601", wave_height: "m" },
  current: {
    time: "2026-08-28T13:00",
    interval: 900,
    wave_height: 1.74,
    wave_direction: 286,
    wave_period: 9.6,
    wind_wave_height: 0.08,
    wind_wave_direction: 237,
    wind_wave_period: 1.7,
    swell_wave_height: 1.74,
    swell_wave_direction: 286,
    swell_wave_period: 8.1,
    sea_surface_temperature: 17.9,
  },
};

/** Respuesta real de la Forecast API (misma captura), recortada. */
export const FORECAST_FIXTURE = {
  latitude: 42.25,
  longitude: -8.75,
  timezone: "GMT",
  current_units: { time: "iso8601", wind_speed_10m: "km/h" },
  current: {
    time: "2026-08-28T13:00",
    interval: 900,
    wind_speed_10m: 13,
    wind_direction_10m: 242,
    wind_gusts_10m: 29.9,
    pressure_msl: 1021.2,
    visibility: 28000,
    uv_index: 5.2,
  },
};
