/**
 * El módulo entero por HTTP: qué contesta cada endpoint y qué pasa cuando el mundo falla.
 *
 * Se monta un Express con el router del módulo —lo mismo que hace el composition root de la API— y
 * se le pregunta por el socket. La única red es el loopback: las fuentes son dobles.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
// @ts-types="@types/express"
import express from "express";

import { createMemoryWeatherCache } from "../cache.ts";
import {
  WEATHER_MODULE_VERSION,
  createWeatherModule,
  type BulletinPayload,
  type PortLocationRepository,
  type WeatherModuleDeps,
  type WeatherPayload,
} from "../module.ts";
import type { SourceReport } from "../source.ts";
import { FORECAST_FIXTURE, MARINE_FIXTURE, fakeClock, fetchSpy, type FetchSpy } from "./fakes.ts";

const T0 = Date.parse("2026-08-28T13:37:00Z");
const MARINE_URL = "https://marine.test/v1/marine";
const FORECAST_URL = "https://forecast.test/v1/forecast";
const AEMET_URL = "https://aemet.test/opendata/api";
const AEMET_DATOS = "https://aemet.test/opendata/sh/deadbeef";

const VIGO = { slug: "vigo", lat: 42.2406, lon: -8.7207 };

const ports: PortLocationRepository = {
  findBySlug: (slug) => Promise.resolve(slug === VIGO.slug ? VIGO : undefined),
};

const BULLETIN_DOCUMENT = [
  { elaborado: "2026-08-28T11:00:00Z", prediccion: { texto: "Marejada del noroeste." } },
];

/** Doble de las tres fuentes. `fallan` decide cuáles se caen. */
function upstream(fallan: readonly string[] = []): FetchSpy {
  return fetchSpy((url) => {
    for (const caida of fallan) {
      if (url.startsWith(caida)) {
        throw new Error("ECONNREFUSED");
      }
    }
    if (url.startsWith(MARINE_URL)) {
      return MARINE_FIXTURE;
    }
    if (url.startsWith(FORECAST_URL)) {
      return FORECAST_FIXTURE;
    }
    if (url.startsWith(`${AEMET_URL}/prediccion`)) {
      return { descripcion: "exito", estado: 200, datos: AEMET_DATOS };
    }
    if (url === AEMET_DATOS) {
      return BULLETIN_DOCUMENT;
    }
    throw new Error(`URL inesperada: ${url}`);
  });
}

function moduleDeps(
  spy: FetchSpy,
  clock: { now: () => number },
  apiKey?: string,
): WeatherModuleDeps {
  return {
    fetch: spy.fetch,
    cache: createMemoryWeatherCache(clock.now),
    now: clock.now,
    ports,
    ...(apiKey === undefined ? {} : { aemetApiKey: apiKey }),
    urls: { marine: MARINE_URL, forecast: FORECAST_URL, aemet: AEMET_URL },
  };
}

/**
 * Cuerpos tipados con **los tipos que publica el módulo**: además de quitarle el `unknown` a
 * `response.json()`, obliga a que lo que sale por el cable siga siendo describible por su contrato.
 */
async function weatherBody(response: Response): Promise<WeatherPayload> {
  return (await response.json()) as WeatherPayload;
}

async function bulletinBody(response: Response): Promise<BulletinPayload> {
  return (await response.json()) as BulletinPayload;
}

async function errorBody(response: Response): Promise<{ readonly error: string }> {
  return (await response.json()) as { readonly error: string };
}

/** Estrecha un informe de fuente a su rama servida (y falla el test si no lo es). */
function assertServed<T>(
  report: SourceReport<T>,
): asserts report is Extract<SourceReport<T>, { status: "ok" }> {
  assert.equal(report.status, "ok");
}

/** Estrecha un boletín a su rama servida. */
function assertBulletinServed(
  body: BulletinPayload,
): asserts body is Extract<BulletinPayload, { status: "ok" }> {
  assert.equal(body.status, "ok");
}

/** Levanta el router del módulo donde lo montaría el core y corre la prueba. */
async function withModule(
  deps: WeatherModuleDeps,
  probe: (baseUrl: string, healthcheck: () => Promise<unknown>) => Promise<void>,
): Promise<void> {
  const api = createWeatherModule(deps).api?.({});
  assert.ok(api !== undefined, "el módulo weather debe tener parte de API");
  const app = express();
  app.use("/v1/modules/weather", api.router);
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    assert.ok(address !== null && typeof address !== "string");
    await probe(`http://127.0.0.1:${address.port}/v1/modules/weather`, api.healthcheck);
  } finally {
    server.close();
  }
}

test("el manifiesto del módulo lleva id, versión y las dos atribuciones", () => {
  const module = createWeatherModule(moduleDeps(upstream(), fakeClock(T0)));
  assert.equal(module.id, "weather");
  assert.equal(module.version, WEATHER_MODULE_VERSION);
  assert.deepEqual(
    module.attributions.map((attribution) => attribution.name),
    ["Open-Meteo", "AEMET — Agencia Estatal de Meteorología"],
  );
  for (const attribution of module.attributions) {
    assert.match(attribution.url, /^https:\/\//u);
    assert.notEqual(attribution.license, "");
  }
});

test("la versión publicada es la del package.json", () => {
  const manifest: unknown = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8"),
  );
  assert.equal((manifest as { version: string }).version, WEATHER_MODULE_VERSION);
});

test("GET /weather agrega mar y atmósfera con procedencia y edad", async () => {
  const spy = upstream();
  const clock = fakeClock(T0);
  await withModule(moduleDeps(spy, clock), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/weather?port=vigo`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "public, max-age=300");

    const body = await weatherBody(response);
    assert.deepEqual(body.port, VIGO);
    assert.deepEqual(body.cell, { lat: 42.2, lon: -8.7, hourUtc: "2026-08-28T13:00:00Z" });
    assert.equal(body.status, "ok");
    assertServed(body.marine);
    assertServed(body.forecast);
    assert.equal(body.marine.fetchedAt, "2026-08-28T13:37:00Z");
    assert.equal(body.marine.ageSeconds, 0);
    assert.equal(body.marine.stale, false);
    assert.equal(body.marine.data.waveHeightM, 1.74);
    assert.equal(body.forecast.data.windGustsKmh, 29.9);
    assert.deepEqual(
      body.attributions.map((attribution) => attribution.name),
      ["Open-Meteo", "AEMET — Agencia Estatal de Meteorología"],
    );
    assert.equal(spy.calls.length, 2);
  });
});

test("ORO por HTTP: dos peticiones seguidas del mismo puerto salen a la red una vez", async () => {
  const spy = upstream();
  const clock = fakeClock(T0);
  await withModule(moduleDeps(spy, clock), async (baseUrl) => {
    await fetch(`${baseUrl}/weather?port=vigo`);
    clock.advance(120_000);
    const second = await weatherBody(await fetch(`${baseUrl}/weather?port=vigo`));

    assert.equal(spy.calls.length, 2, "la segunda petición volvió a salir a la red");
    assertServed(second.marine);
    assert.equal(second.marine.ageSeconds, 120);
    assert.equal(second.marine.stale, false);
  });
});

test("sin el parámetro 'port' es un 400, no un 500", async () => {
  await withModule(moduleDeps(upstream(), fakeClock(T0)), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/weather`);
    assert.equal(response.status, 400);
    assert.match((await errorBody(response)).error, /port/u);
  });
});

test("un puerto que no existe es un 404 con su slug", async () => {
  await withModule(moduleDeps(upstream(), fakeClock(T0)), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/weather?port=narnia`);
    assert.equal(response.status, 404);
    assert.match((await errorBody(response)).error, /narnia/u);
  });
});

test("si se cae una fuente, la respuesta es parcial y no se deja cachear fuera", async () => {
  const spy = upstream([MARINE_URL]);
  await withModule(moduleDeps(spy, fakeClock(T0)), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/weather?port=vigo`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");

    const body = await weatherBody(response);
    assert.equal(body.status, "partial");
    assert.equal(body.marine.status, "unavailable");
    assert.match(body.marine.status === "unavailable" ? body.marine.reason : "", /ECONNREFUSED/u);
    assert.equal(body.forecast.status, "ok");
  });
});

test("si se caen las dos fuentes sigue habiendo 200 con el motivo de cada una", async () => {
  const spy = upstream([MARINE_URL, FORECAST_URL]);
  await withModule(moduleDeps(spy, fakeClock(T0)), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/weather?port=vigo`);
    assert.equal(response.status, 200);

    const body = await weatherBody(response);
    assert.equal(body.status, "unavailable");
    assert.equal(body.marine.status, "unavailable");
    assert.equal(body.forecast.status, "unavailable");
  });
});

test("GET /bulletin sin AEMET_API_KEY degrada con estado explícito, no con un 500", async () => {
  const spy = upstream();
  await withModule(moduleDeps(spy, fakeClock(T0)), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/bulletin?port=vigo`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");

    const body = await bulletinBody(response);
    assert.equal(body.status, "unavailable");
    assert.match(body.status === "unavailable" ? body.reason : "", /AEMET_API_KEY/u);
    assert.deepEqual(body.zone, { code: "36", name: "Costa de Pontevedra", verified: false });
    assert.equal(spy.calls.length, 0, "se llamó a AEMET sin clave");
  });
});

test("GET /bulletin con clave sirve el documento con su zona y su procedencia", async () => {
  const spy = upstream();
  const clock = fakeClock(T0);
  await withModule(moduleDeps(spy, clock, "clave-de-mentira"), async (baseUrl) => {
    const body = await bulletinBody(await fetch(`${baseUrl}/bulletin?port=vigo`));

    assertBulletinServed(body);
    assert.equal(body.fetchedAt, "2026-08-28T13:37:00Z");
    assert.equal(body.ageSeconds, 0);
    assert.equal(body.stale, false);
    assert.equal(body.issuedAt, "2026-08-28T11:00:00Z");
    assert.deepEqual(body.document, BULLETIN_DOCUMENT);
    assert.deepEqual(
      body.attributions.map((attribution) => attribution.name),
      ["AEMET — Agencia Estatal de Meteorología"],
    );
    assert.equal(spy.calls.length, 2, "el patrón de AEMET son dos llamadas");
  });
});

test("el boletín se cachea por zona: dos puertos de la misma zona, una llamada", async () => {
  const spy = upstream();
  const clock = fakeClock(T0);
  await withModule(moduleDeps(spy, clock, "clave-de-mentira"), async (baseUrl) => {
    await fetch(`${baseUrl}/bulletin?port=vigo`);
    clock.advance(60_000);
    const second = await bulletinBody(await fetch(`${baseUrl}/bulletin?port=vigo`));

    assert.equal(spy.calls.length, 2, "la segunda petición volvió a AEMET");
    assertBulletinServed(second);
    assert.equal(second.ageSeconds, 60);
  });
});

test("el healthcheck no sale a la red y cuenta lo último que pasó", async () => {
  const spy = upstream();
  const clock = fakeClock(T0);
  await withModule(moduleDeps(spy, clock, "clave-de-mentira"), async (baseUrl, healthcheck) => {
    assert.deepEqual(await healthcheck(), { status: "ok", detail: "sin peticiones todavía" });

    await fetch(`${baseUrl}/weather?port=vigo`);
    assert.deepEqual(await healthcheck(), { status: "ok" });
    assert.equal(spy.calls.length, 2, "el healthcheck salió a la red");
  });
});

test("sin clave de AEMET la salud es 'degraded' aunque el resto funcione", async () => {
  await withModule(moduleDeps(upstream(), fakeClock(T0)), async (baseUrl, healthcheck) => {
    await fetch(`${baseUrl}/weather?port=vigo`);
    const health = await healthcheck();
    assert.equal((health as { status: string }).status, "degraded");
    assert.match((health as { detail: string }).detail, /AEMET_API_KEY/u);
  });
});

test("con todas las fuentes caídas la salud es 'down'", async () => {
  const spy = upstream([MARINE_URL, FORECAST_URL]);
  await withModule(moduleDeps(spy, fakeClock(T0), "clave-de-mentira"), async (baseUrl, healthcheck) => {
    await fetch(`${baseUrl}/weather?port=vigo`);
    const health = await healthcheck();
    assert.equal((health as { status: string }).status, "down");
  });
});
