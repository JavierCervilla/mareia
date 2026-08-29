/**
 * El módulo meteo **montado en la API real**: que enchufarlo al registry baste para que aparezca en
 * el manifiesto y para que sus rutas respondan bajo `/v1/modules/weather`.
 *
 * Lo que se prueba aquí es la **integración** (montaje, manifiesto, atribuciones, degradación sin
 * clave); el comportamiento fino de los adaptadores y de la caché ya está cubierto en
 * `packages/modules/weather`. Las rutas del registry de producción no se llegan a pedir: saldrían a
 * Open-Meteo de verdad. Se pide a un módulo idéntico con las fuentes dobladas.
 */

import { assertEquals, assertNotMatch, assertStringIncludes } from "@std/assert";
import {
  createMemoryWeatherCache,
  createWeatherModule,
  type PortLocationRepository,
} from "@mareia/module-weather";

import { activeModules, type ApiModule } from "../modules.config.ts";
import { createServer } from "./server.ts";

const NOW_MS = Date.parse("2026-08-28T13:37:00Z");
const MARINE_URL = "https://marine.test/v1/marine";
const FORECAST_URL = "https://forecast.test/v1/forecast";

const VIGO = { slug: "vigo", lat: 42.2406, lon: -8.7207 };
const ports: PortLocationRepository = {
  findBySlug: (slug: string) => Promise.resolve(slug === VIGO.slug ? VIGO : undefined),
};

/** Doble de Open-Meteo: la única forma de tener este test en CI sin red. */
function stubFetch(): typeof fetch {
  const json = (body: unknown) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  return ((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith(MARINE_URL)) {
      return json({ current: { time: "2026-08-28T13:00", wave_height: 1.74 } });
    }
    if (url.startsWith(FORECAST_URL)) {
      return json({ current: { time: "2026-08-28T13:00", wind_speed_10m: 13 } });
    }
    return Promise.reject(new Error(`URL inesperada en un test: ${url}`));
  }) as typeof fetch;
}

/** El mismo módulo que va a producción, con las fuentes y el reloj doblados. */
function weatherUnderTest(): ApiModule {
  return createWeatherModule({
    fetch: stubFetch(),
    cache: createMemoryWeatherCache(() => NOW_MS),
    now: () => NOW_MS,
    ports,
    urls: { marine: MARINE_URL, forecast: FORECAST_URL },
  });
}

/** Levanta la API en un puerto efímero, corre la prueba y la cierra siempre. */
async function withServer(
  modules: readonly ApiModule[],
  probe: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createServer(modules).listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("el servidor no expuso un puerto TCP");
    }
    await probe(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
  }
}

Deno.test("/v1/modules publica weather con su versión y sus dos atribuciones", async () => {
  await withServer(activeModules, async (baseUrl) => {
    const payload = await (await fetch(`${baseUrl}/v1/modules`)).json();
    const [weather] = payload.modules;

    assertEquals(payload.modules.length, 1);
    assertEquals(weather.id, "weather");
    assertEquals(typeof weather.version, "string");
    assertEquals(
      weather.attributions.map((attribution: { name: string }) => attribution.name),
      ["Open-Meteo", "AEMET — Agencia Estatal de Meteorología"],
    );
    assertEquals(weather.attributions[0].license, "CC-BY-4.0");
  });
});

Deno.test("montado en el registry, GET /v1/modules/weather/weather responde por puerto", async () => {
  await withServer([weatherUnderTest()], async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/modules/weather/weather?port=vigo`);
    assertEquals(response.status, 200);

    const body = await response.json();
    assertEquals(body.status, "ok");
    assertEquals(body.port.slug, "vigo");
    assertEquals(body.cell, { lat: 42.2, lon: -8.7 });
    assertEquals(body.marine.fetchedAt, "2026-08-28T13:37:00Z");
    assertEquals(body.marine.ageSeconds, 0);
    assertEquals(body.marine.data.waveHeightM, 1.74);
    assertEquals(body.forecast.data.windSpeedKmh, 13);
  });
});

Deno.test("un puerto desconocido en el módulo es 404, no 500", async () => {
  await withServer([weatherUnderTest()], async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/modules/weather/weather?port=narnia`);
    assertEquals(response.status, 404);
    assertStringIncludes((await response.json()).error, "narnia");
  });
});

Deno.test("sin clave de AEMET, /bulletin degrada con 200 y estado explícito", async () => {
  await withServer([weatherUnderTest()], async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/modules/weather/bulletin?port=vigo`);
    assertEquals(response.status, 200);

    const body = await response.json();
    assertEquals(body.status, "unavailable");
    assertStringIncludes(body.reason, "no está configurada");
    assertEquals(body.zone.code, "36");
  });
});

Deno.test("el core puede consultar la salud del módulo sin salir a la red", async () => {
  const api = weatherUnderTest().api?.({});
  const health = await api?.healthcheck();
  assertEquals(health?.status, "degraded");
  // El detalle sale por `/health`, que es superficie pública: lleva la vista pública de la
  // credencial —el hecho— y no el aviso al operador, que nombra el secreto y dónde renovarlo (T-18).
  assertStringIncludes(health?.detail ?? "", "no tiene credencial de AEMET");
  assertNotMatch(health?.detail ?? "", /AEMET_API_KEY/u);
});
