/**
 * Dobles de los puertos de `UseCaseDeps`. Están en memoria y con constantes armónicas mínimas: lo
 * que estos tests comprueban es la capa de aplicación (validación, límites, forma de la respuesta),
 * no la exactitud del motor — de eso se ocupan los golden tests de `@mareia/domain-core`.
 */

import { astronomyEngineGateway } from "@mareia/domain-core";

import type { Port, StationRecord, UseCaseDeps } from "../types.ts";

export const VIGO: Port = {
  slug: "vigo",
  name: "Vigo",
  province: { slug: "pontevedra", name: "Pontevedra" },
  region: { slug: "galicia", name: "Galicia" },
  lat: 42.2406,
  lon: -8.7207,
  timezone: "Europe/Madrid",
  stationFile: "es-po-vigo.json",
};

/** Un puerto en otra zona horaria, para que la proyección al día civil no se pruebe en una sola. */
export const LAS_PALMAS: Port = {
  slug: "las-palmas-de-gran-canaria",
  name: "Las Palmas de Gran Canaria",
  province: { slug: "las-palmas", name: "Las Palmas" },
  region: { slug: "canarias", name: "Canarias" },
  lat: 28.142,
  lon: -15.413,
  timezone: "Atlantic/Canary",
  stationFile: "es-gc-las-palmas.json",
};

/** Estación de juguete: semidiurna, con la calidad de un grade C (el error de hora, `null`). */
export function fakeStation(port: Port): StationRecord {
  return {
    schema: "station/v1",
    id: port.stationFile.replace(".json", ""),
    name: port.name,
    lat: port.lat,
    lon: port.lon,
    timezone: port.timezone,
    datum: { reference: "LAT", msl_offset_m: 2 },
    constituents: [
      { name: "M2", amplitude_m: 1.2, phase_deg: 60 },
      { name: "S2", amplitude_m: 0.4, phase_deg: 90 },
    ],
    quality: {
      grade: "C",
      rmse_m: 0.0429,
      hw_time_err_p95_min: null,
      grade_reason: "no alcanza B: RMSE normalizado 0.188 > 0.15",
      validated_against: "IOC de mentira",
    },
    attributions: [
      {
        name: "Fuente de prueba",
        url: "https://example.invalid",
        license: "cc-by-4.0",
        license_url: null,
        role: "constantes armónicas",
      },
    ],
  };
}

/** Instante fijo del reloj: 15 de marzo de 2026, 12:00 UTC. */
export const NOW_MS = Date.UTC(2026, 2, 15, 12);

export function fakeDeps(ports: readonly Port[] = [VIGO, LAS_PALMAS]): UseCaseDeps {
  return {
    ports: {
      list: () => Promise.resolve(ports),
      findBySlug: (slug) => Promise.resolve(ports.find((port) => port.slug === slug)),
    },
    stations: {
      load: (stationFile) => {
        const port = ports.find((candidate) => candidate.stationFile === stationFile);
        return port === undefined
          ? Promise.reject(new Error(`estación no encontrada: ${stationFile}`))
          : Promise.resolve(fakeStation(port));
      },
    },
    astronomy: astronomyEngineGateway,
    now: () => NOW_MS,
  };
}
