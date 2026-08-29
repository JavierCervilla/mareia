/**
 * Contract tests de las rutas del core: status, esquema, cabeceras de caché y errores, contra el
 * **dataset real** de `data/`. Se sirve lo que se sirve en producción; lo único que se falsea es el
 * reloj, para que la ventana del almanaque (año en curso ±1) no dependa de cuándo corra CI.
 *
 * El último test es el que de verdad ata la cadena: compara los extremos que publica el API con los
 * que da el motor llamado a mano sobre el mismo JSON de estación. Si alguien cambia la ruta que
 * lleva del fichero al endpoint —el adaptador, el rango del día civil, el redondeo— sale en rojo.
 */

import { assert, assertAlmostEquals, assertEquals, assertMatch } from "@std/assert";
import { civilDayBounds, findExtremes } from "@mareia/domain-core";
import type { TideStation } from "@mareia/domain-core";
import type { UseCaseDeps } from "@mareia/usecases";

import { createCoreDeps, DATA_DIR } from "../core-deps.ts";
import { createServer } from "./server.ts";

/** Día de referencia de los tests, en la zona de los puertos peninsulares. */
const DAY = "2026-08-28";
const CACHE_CONTROL = "public, max-age=86400";
const CACHE_HEADER = "cache-control";

/** Reloj congelado: el almanaque cubre 2025-2027 pase el tiempo que pase. */
const FIXED_NOW_MS = Date.UTC(2026, 7, 28, 12);

function testDeps(): UseCaseDeps {
  return { ...createCoreDeps(), now: () => FIXED_NOW_MS };
}

/** Levanta la API con el dataset real en un puerto efímero y la cierra siempre. */
async function withApi(probe: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = createServer([], {}, testDeps()).listen(0);
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

interface JsonResponse {
  readonly status: number;
  readonly cacheControl: string | null;
  readonly body: Record<string, unknown>;
}

async function get(baseUrl: string, path: string): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`);
  return {
    status: response.status,
    cacheControl: response.headers.get(CACHE_HEADER),
    body: await response.json(),
  };
}

interface TideEvent {
  readonly timeUtcMs: number;
  readonly timeUtc: string;
  readonly kind: string;
  readonly height_m: number;
}

interface Quality {
  readonly grade: string;
  readonly hw_time_err_p95_min: number | null;
  readonly rmse_m: number | null;
}

Deno.test("GET /v1/ports sirve el catálogo cacheable, sin filtrar dónde vive el dataset", async () => {
  await withApi(async (baseUrl) => {
    const { status, cacheControl, body } = await get(baseUrl, "/v1/ports");
    assertEquals(status, 200);
    assertEquals(cacheControl, CACHE_CONTROL);

    const ports = body["ports"] as readonly Record<string, unknown>[];
    assertEquals(
      ports.length >= 120,
      true,
      `el catálogo se ha encogido a ${ports.length} puertos`,
    );
    // El orden es parte del contrato: región, provincia y puerto, alfabético en español. Quien
    // pinte el catálogo (la web, un cliente) no tiene que volver a ordenarlo ni ponerse de acuerdo.
    // Con doce puertos la lista se congelaba entera; con ciento y pico se comprueba el orden, que
    // es lo que era el contrato, y no la lista, que era su instantánea.
    const collator = new Intl.Collator("es");
    const key = (port: Record<string, unknown>): readonly string[] => [
      (port["region"] as Record<string, string>)["slug"] ?? "",
      (port["province"] as Record<string, string>)["slug"] ?? "",
      port["name"] as string,
    ];
    for (let index = 1; index < ports.length; index++) {
      const previous = key(ports[index - 1] as Record<string, unknown>);
      const current = key(ports[index] as Record<string, unknown>);
      const order = previous.reduce(
        (decided: number, value, position) =>
          decided !== 0 ? decided : collator.compare(value, current[position] ?? ""),
        0,
      );
      assertEquals(
        order <= 0,
        true,
        `el catálogo no viene ordenado: ${previous.join("/")} antes que ${current.join("/")}`,
      );
    }
    assertEquals(ports[0]?.["region"] !== undefined, true);
    const vigo = ports.find((port) => port["slug"] === "vigo");
    assertEquals(vigo?.["name"], "Vigo");
    assertEquals(vigo?.["timezone"], "Europe/Madrid");
    assertEquals(vigo?.["stationFile"], undefined, "stationFile es infraestructura, no contrato");
    assertEquals((vigo?.["region"] as Record<string, unknown>)["slug"], "galicia");
  });
});

Deno.test("la ficha de un puerto micromareal publica su grade C con el p95 en null", async () => {
  await withApi(async (baseUrl) => {
    const { status, cacheControl, body } = await get(baseUrl, "/v1/ports/cabo-de-palos");
    assertEquals(status, 200);
    assertEquals(cacheControl, CACHE_CONTROL);

    const station = body["station"] as Record<string, unknown>;
    const quality = station["quality"] as Quality;
    assertEquals(quality.grade, "C");
    assertEquals(quality.hw_time_err_p95_min, null, "el error de hora no medible viaja como null");
    assertMatch(String(station["id"]), /^es-mu-cabo-de-palos$/);
    assert((station["attributions"] as readonly unknown[]).length > 0, "sin atribuciones no se sirve");
  });
});

Deno.test("un slug desconocido es 404 con mensaje y sin cabecera de caché", async () => {
  await withApi(async (baseUrl) => {
    const { status, cacheControl, body } = await get(baseUrl, "/v1/ports/atlantis");
    assertEquals(status, 404);
    assertEquals(cacheControl, null, "un error no se cachea un día");
    assertMatch(String(body["error"]), /atlantis/);
  });
});

Deno.test("GET tides devuelve extremos y curva dentro del día civil del puerto", async () => {
  await withApi(async (baseUrl) => {
    const { status, cacheControl, body } = await get(
      baseUrl,
      `/v1/ports/vigo/tides?from=${DAY}&to=${DAY}`,
    );
    assertEquals(status, 200);
    assertEquals(cacheControl, CACHE_CONTROL);

    const range = body["range"] as Record<string, number | string>;
    assertEquals(range["startUtc"], "2026-08-27T22:00:00.000Z");
    assertEquals(range["endUtc"], "2026-08-28T22:00:00.000Z");

    const events = body["events"] as readonly TideEvent[];
    assertEquals(events.length, 4);
    for (const event of events) {
      assertMatch(event.kind, /^(high|low)$/);
      assertEquals(event.timeUtc, new Date(event.timeUtcMs).toISOString());
      assert(event.timeUtcMs >= Number(range["startUtcMs"]));
      assert(event.timeUtcMs <= Number(range["endUtcMs"]));
    }

    const curve = body["curve"] as { stepMinutes: number; samples: readonly TideEvent[] };
    assertEquals(curve.stepMinutes, 10);
    assertEquals(curve.samples.length, 145, "24 h a 10 min, con los dos bordes incluidos");
    assertEquals(curve.samples[0]?.timeUtcMs, Number(range["startUtcMs"]));

    // La procedencia viaja con el dato: quien publique la marea puede citar su fuente.
    const station = body["station"] as Record<string, unknown>;
    assertEquals((station["quality"] as Quality).grade, "B");
    // 39 constituyentes: los 34 de T-05 más los cinco que T-04 añadió al motor y T-13 regeneró en
    // el dataset. Es el número que TICON-4 publica para Vigo dentro del catálogo del motor, no un
    // tope: si baja, alguien ha vuelto a truncar de más.
    assertEquals(station["constituents"], 39);
  });
});

Deno.test("la validación es ruidosa: cada límite publicado responde 400 diciendo cuál era", async () => {
  const cases: readonly (readonly [string, RegExp])[] = [
    [`/v1/ports/vigo/tides?to=${DAY}`, /'from'/],
    [`/v1/ports/vigo/tides?from=${DAY}&to=2026-12-01`, /40/],
    ["/v1/ports/vigo/tides?from=2026-02-30&to=2026-02-30", /calendario/],
    [`/v1/ports/vigo/tides?from=${DAY}&to=${DAY}&step=0`, /'step'/],
    [`/v1/ports/vigo/tides?from=${DAY}&to=${DAY}&from=2026-08-29`, /repetido/],
    ["/v1/ports/vigo/almanac/2032", /2025 a 2027/],
    // `Number("0x7ea") === 2026`: sin validar el crudo, esta URL serviría el almanaque de 2026 y
    // cada caché intermedia guardaría una copia más de la misma respuesta.
    ["/v1/ports/vigo/almanac/0x7ea", /cuatro cifras/],
    ["/v1/ports/vigo/almanac/%2B2026", /cuatro cifras/],
    ["/v1/ports/vigo/astro", /'date'/],
    ["/v1/ports/vigo/solunar?date=ayer", /YYYY-MM-DD/],
  ];

  await withApi(async (baseUrl) => {
    for (const [path, expected] of cases) {
      const { status, cacheControl, body } = await get(baseUrl, path);
      assertEquals(status, 400, `debería ser 400: ${path}`);
      assertEquals(cacheControl, null, `un 400 no se cachea: ${path}`);
      assertMatch(String(body["error"]), expected);
    }
  });
});

Deno.test("el almanaque sirve el año entero por días civiles, sin curva", async () => {
  await withApi(async (baseUrl) => {
    const { status, cacheControl, body } = await get(baseUrl, "/v1/ports/vigo/almanac/2026");
    assertEquals(status, 200);
    assertEquals(cacheControl, CACHE_CONTROL);
    assertEquals(body["year"], 2026);
    assertEquals(body["curve"], undefined);

    const days = body["days"] as readonly { dateIso: string; events: readonly TideEvent[] }[];
    assertEquals(days.length, 365);
    assertEquals(days[0]?.dateIso, "2026-01-01");
    assertEquals(days[364]?.dateIso, "2026-12-31");
    assert(days.every((day) => day.events.length >= 2), "ningún día se queda sin extremos");
  });
});

Deno.test("GET astro devuelve las efemérides del día, con el caso polar explícito", async () => {
  await withApi(async (baseUrl) => {
    const { status, cacheControl, body } = await get(
      baseUrl,
      `/v1/ports/santa-cruz-de-tenerife/astro?date=${DAY}`,
    );
    assertEquals(status, 200);
    assertEquals(cacheControl, CACHE_CONTROL);
    assertEquals(body["timezone"], "Atlantic/Canary");

    const sun = body["sun"] as Record<string, Record<string, unknown>>;
    assertEquals(sun["rise"]?.["outcome"], "event", "en Canarias siempre sale el Sol");
    assertEquals(sun["set"]?.["outcome"], "event");
    assertEquals((sun["transit"] as unknown as Record<string, unknown>)["kind"], "upper");

    const twilight = sun["twilight"] as Record<string, unknown>;
    const nautical = twilight["nautical"] as Record<string, Record<string, unknown>>;
    assertEquals(nautical["dawn"]?.["outcome"], "event");
    assertEquals((twilight["altitudes_deg"] as Record<string, number>)["astronomical"], -18);

    const moon = body["moon"] as Record<string, Record<string, unknown>>;
    assertEquals(moon["upperTransit"]?.["body"], "moon");
    assert(Number(moon["distance"]?.["distance_km"]) > 300_000);
  });
});

Deno.test("GET solunar devuelve entre 1 y 4 periodos con su rating desglosado", async () => {
  await withApi(async (baseUrl) => {
    const { status, cacheControl, body } = await get(
      baseUrl,
      `/v1/ports/la-manga-del-mar-menor/solunar?date=${DAY}`,
    );
    assertEquals(status, 200);
    assertEquals(cacheControl, CACHE_CONTROL);

    const periods = body["periods"] as readonly Record<string, number | string | boolean>[];
    assert(periods.length >= 1 && periods.length <= 4, `periodos fuera de rango: ${periods.length}`);
    for (const period of periods) {
      assertMatch(String(period["kind"]), /^(major|minor)$/);
      assert(Number(period["startUtcMs"]) <= Number(period["peakUtcMs"]));
      assert(Number(period["peakUtcMs"]) <= Number(period["endUtcMs"]));
    }

    const rating = body["rating"] as Record<string, number | string>;
    assertMatch(String(rating["label"]), /^(baja|media|alta|muy-alta)$/);
    assert(Number(rating["score"]) >= 0 && Number(rating["score"]) <= 100);
  });
});

Deno.test("golden: los extremos de Vigo que publica el API son los del motor sobre el mismo JSON", async () => {
  const station = JSON.parse(
    await Deno.readTextFile(`${DATA_DIR}/stations/es-po-vigo.json`),
  ) as TideStation;
  const day = civilDayBounds(DAY, "Europe/Madrid");
  const expected = findExtremes(station, day.startUtcMs, day.endUtcMs);

  await withApi(async (baseUrl) => {
    const { body } = await get(baseUrl, `/v1/ports/vigo/tides?from=${DAY}&to=${DAY}`);
    const events = body["events"] as readonly TideEvent[];

    assertEquals(events.length, expected.length);
    for (const [index, event] of events.entries()) {
      const reference = expected[index];
      assert(reference !== undefined);
      assertEquals(event.kind, reference.kind);
      // El API redondea al segundo y al milímetro: el resto del camino no puede mover nada más.
      assertAlmostEquals(event.timeUtcMs, reference.timeUtcMs, 1_000);
      assertAlmostEquals(event.height_m, reference.height_m, 0.001);
    }
  });
});
