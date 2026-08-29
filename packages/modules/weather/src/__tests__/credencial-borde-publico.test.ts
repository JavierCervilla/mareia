/**
 * El borde público del módulo no publica el manual de quien administra la instancia.
 *
 * El aviso de la credencial de AEMET existe para que lo lea quien puede renovarla, y ése no es
 * quien pide un boletín por HTTP: decir en la respuesta pública qué variable de entorno usa la
 * instancia, dónde se pide la clave y qué tiene que hacer el operador es reconocimiento gratis en
 * el canal equivocado.
 *
 * Este recorrido mira **la respuesta entera serializada**, no un campo. Un test que comprobara
 * `credential.message` arreglaría el bug de hoy y dejaría pasar el de mañana, porque el defecto se
 * **mueve** de campo —de `message` a `reason`, de `reason` al `detail` de salud— en vez de
 * desaparecer. Y busca **las señas del canal del operador** (el nombre de la variable, el dominio
 * de alta, el verbo de instrucción) y no una frase literal: el día que el aviso se reescriba, el
 * gate tiene que seguir mordiendo.
 */

import assert from "node:assert/strict";
import test from "node:test";
// @ts-types="@types/express"
import express from "express";

import { inspectAemetKey, type KeyStatus } from "../aemet-key.ts";
import { createMemoryWeatherCache } from "../cache.ts";
import {
  createWeatherModule,
  type PortLocationRepository,
  type WeatherModuleDeps,
} from "../module.ts";
import { FORECAST_FIXTURE, MARINE_FIXTURE, fakeClock, fetchSpy, type FetchSpy } from "./fakes.ts";

const T0 = Date.parse("2026-08-28T13:37:00Z");
const DAY = 86_400_000;
const MARINE_URL = "https://marine.test/v1/marine";
const FORECAST_URL = "https://forecast.test/v1/forecast";
const AEMET_URL = "https://aemet.test/opendata/api";
const AEMET_DATOS = "https://aemet.test/opendata/sh/deadbeef";

/** Puerto con zona marítima asignada: la rama del boletín que llega a pedirlo. */
const VIGO = { slug: "vigo", lat: 42.2406, lon: -8.7207 };
/** Puerto sin zona en `aemet-zones.json`: la otra rama, la que corta antes de salir a la red. */
const SIN_ZONA = { slug: "puerto-sin-zona", lat: 43.39, lon: -8.4 };

const ports: PortLocationRepository = {
  findBySlug: (slug) =>
    Promise.resolve([VIGO, SIN_ZONA].find((port) => port.slug === slug)),
};

/**
 * Señas de que el canal del operador se coló en el público. No son la frase entera a propósito:
 * el nombre de la variable de entorno, el dominio donde se da de alta la clave y los dos verbos de
 * instrucción sobreviven a cualquier reescritura del aviso.
 */
const SENAS_DEL_OPERADOR = [
  "AEMET_API_KEY",
  "opendata.aemet.es",
  "centrodedescargas",
  "Renuévala",
  "actualiza el secreto",
] as const;

/** JWT sintético con la caducidad pedida. Firma de relleno: aquí solo se lee el `exp`. */
function jwt(expiresAtMs: number): string {
  const b64 = (value: unknown): string =>
    btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ exp: expiresAtMs / 1000 })}.firma-de-prueba`;
}

/**
 * Doble de las tres fuentes. `aemetRechaza` reproduce lo que hace AEMET con una clave que ya no
 * vale: un 401. Importa porque así el recorrido pasa también por la rama `unavailable` del
 * boletín, donde el motivo lo redacta el upstream y no nosotros.
 */
function upstream(aemetRechaza: boolean): FetchSpy {
  return fetchSpy((url) => {
    if (url.startsWith(MARINE_URL)) {
      return MARINE_FIXTURE;
    }
    if (url.startsWith(FORECAST_URL)) {
      return FORECAST_FIXTURE;
    }
    if (url.startsWith(`${AEMET_URL}/prediccion`)) {
      return aemetRechaza
        ? new Response(JSON.stringify({ descripcion: "api_key caducada", estado: 401 }), {
            status: 401,
            headers: { "content-type": "application/json" },
          })
        : { descripcion: "exito", estado: 200, datos: AEMET_DATOS };
    }
    if (url === AEMET_DATOS) {
      return [{ elaborado: "2026-08-28T11:00:00Z", prediccion: { texto: "Marejada." } }];
    }
    throw new Error(`URL inesperada: ${url}`);
  });
}

/** Los cinco estados de la credencial, cada uno con la clave que de verdad lo produce. */
const ESCENARIOS: readonly {
  readonly estado: KeyStatus;
  readonly clave: string | undefined;
  readonly aemetRechaza: boolean;
}[] = [
  { estado: "missing", clave: undefined, aemetRechaza: false },
  { estado: "unreadable", clave: "esto-no-es-un-jwt", aemetRechaza: true },
  { estado: "valid", clave: jwt(T0 + 90 * DAY), aemetRechaza: false },
  { estado: "expiring", clave: jwt(T0 + 3 * DAY), aemetRechaza: false },
  { estado: "expired", clave: jwt(T0 - 3 * DAY), aemetRechaza: true },
];

function moduleDeps(spy: FetchSpy, apiKey: string | undefined): WeatherModuleDeps {
  const clock = fakeClock(T0);
  return {
    fetch: spy.fetch,
    cache: createMemoryWeatherCache(clock.now),
    now: clock.now,
    ports,
    ...(apiKey === undefined ? {} : { aemetApiKey: apiKey }),
    urls: { marine: MARINE_URL, forecast: FORECAST_URL, aemet: AEMET_URL },
  };
}

/** Todo lo que este módulo publica hacia fuera, ya serializado como sale por el cable. */
async function cuerposPublicos(
  deps: WeatherModuleDeps,
): Promise<readonly (readonly [string, string])[]> {
  const api = createWeatherModule(deps).api?.({});
  assert.ok(api !== undefined, "el módulo weather debe tener parte de API");
  const app = express();
  app.use("/v1/modules/weather", api.router);
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    assert.ok(address !== null && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}/v1/modules/weather`;
    const cuerpo = async (ruta: string): Promise<string> =>
      JSON.stringify(await (await fetch(`${baseUrl}${ruta}`)).json());
    return [
      ["GET /weather?port=vigo", await cuerpo("/weather?port=vigo")],
      ["GET /bulletin?port=vigo", await cuerpo("/bulletin?port=vigo")],
      // La otra rama de `bulletinHandler`: sin zona marítima ni se pregunta a AEMET, pero el
      // estado de la credencial viaja igual.
      ["GET /bulletin?port=puerto-sin-zona", await cuerpo("/bulletin?port=puerto-sin-zona")],
      // El healthcheck es superficie pública mientras `/health` sea alcanzable sin autenticar;
      // su `detail` concatena problemas, y la credencial es uno de ellos.
      ["healthcheck", JSON.stringify(await api.healthcheck())],
    ];
  } finally {
    server.close();
  }
}

for (const escenario of ESCENARIOS) {
  test(`con la credencial '${escenario.estado}' ninguna respuesta pública lleva el aviso del operador`, async () => {
    // Que el escenario sea de verdad el estado que dice: si no, el gate pasaría sin mirar nada.
    assert.equal(inspectAemetKey(escenario.clave, T0).status, escenario.estado);

    const cuerpos = await cuerposPublicos(moduleDeps(upstream(escenario.aemetRechaza), escenario.clave));
    for (const [endpoint, cuerpo] of cuerpos) {
      for (const sena of SENAS_DEL_OPERADOR) {
        assert.ok(
          !cuerpo.includes(sena),
          `${endpoint} publica la seña «${sena}» con la credencial '${escenario.estado}': ${cuerpo}`,
        );
      }
    }
  });
}

/**
 * El trinquete al revés. Recortar el canal público no puede acabar en vaciar el aviso al operador:
 * eso «arreglaría» el gate de arriba y rompería lo único que hace que una clave no caduque por
 * sorpresa. Aquí se exige lo contrario que allí, sobre la misma prosa.
 */
test("el aviso al operador sigue completo: se recorta el canal, no el mensaje", () => {
  const caducada = inspectAemetKey(jwt(T0 - 3 * DAY), T0);
  assert.equal(caducada.status, "expired");
  for (const sena of [
    "AEMET_API_KEY",
    "opendata.aemet.es/centrodedescargas/altaUsuario",
    "Renuévala",
    "actualiza el secreto",
  ]) {
    assert.ok(
      caducada.message.includes(sena),
      `el aviso al operador perdió «${sena}»: ${caducada.message}`,
    );
  }

  const caducando = inspectAemetKey(jwt(T0 + 3 * DAY), T0);
  assert.equal(caducando.status, "expiring");
  for (const sena of [
    "AEMET_API_KEY",
    "opendata.aemet.es/centrodedescargas/altaUsuario",
    "actualiza el secreto",
  ]) {
    assert.ok(
      caducando.message.includes(sena),
      `el aviso al operador perdió «${sena}»: ${caducando.message}`,
    );
  }

  // Y sin clave, el aviso sigue diciendo qué falta y cómo se llama.
  assert.ok(inspectAemetKey(undefined, T0).message.includes("AEMET_API_KEY"));
});
