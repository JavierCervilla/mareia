/**
 * PASE ADVERSARIO · T-18 (rol `qa-adversario`, skill `qa-adversarial`).
 *
 * Función objetivo INVERTIDA: esto no confirma que el recorte funciona — el `verificador` y el rol
 * `qa` ya lo hicieron. Aquí se ataca **la promesa** de la trayectoria:
 *
 *   «El borde público del módulo weather no publica el manual de quien administra la instancia
 *    —ni el nombre de la variable de entorno, ni la URL de alta, ni la instrucción de renovar— y
 *    aun así sigue diciendo el hecho: quien consume el API puede seguir sabiendo *por qué* no hay
 *    boletín. El aviso completo se queda intacto en el canal del operador.»
 *
 * Los cuatro hallazgos atacan las dos mitades de esa promesa, no el diff:
 *
 * - **A-17** (clase A12) · el cuerpo público **se desmiente a sí mismo**: publica el boletín y en
 *   la misma respuesta dice que no lo publica. La frase neutra que T-18 introdujo no es neutra,
 *   **afirma un hecho**, y ese hecho es falso en dos estados alcanzables.
 * - **A-18** (clase A6) · la **tercera copia** de la fuga: el `reason` público republica literal el
 *   texto que escribe AEMET. El gate de T-18 vigila las dos copias que escribimos nosotros y no
 *   mira el canal de paso, que desemboca en el mismo cuerpo y en la misma página.
 * - **A-19** (clase A5) · un `exp` que no cabe en un `Date` **rompe el endpoint** (HTTP 500) en vez
 *   de degradar a `unreadable`. Justo lo contrario de lo que la promesa conserva: con un 500 quien
 *   consume el API deja de poder decir por qué no hay boletín.
 * - **A-20** (clase A12) · el `daysLeft` que viaja en el cuerpo público **no cuadra con el
 *   `expiresAt` que viaja a su lado**: cuenta un día entero de más desde el primer milisegundo.
 *
 * Informe: `docs/qa/informe-adversario-t18.md`. Bundle: `docs/qa/bundles/t18-adversario/FAILURE.md`.
 *
 * **ESTADO: los cuatro CERRADOS.** Nacieron envueltos en `hallazgoAbierto()` —el `test.fail()` de
 * Playwright traducido a `node --test`, con una vuelta de tuerca: exigía que el fallo fuera **ése**
 * y no otro, para que un test podrido no se hiciera pasar por un hallazgo vivo—. Al arreglarlos el
 * envoltorio gritó «YA NO FALLA» (los cinco cuerpos a la vez), que es justo el trabajo que tenía
 * que hacer, y se ha retirado: **los cuerpos se quedan tal cual como gate permanente**. Miden
 * exactamente lo mismo que medían cuando reproducían el fallo; lo único que cambia es que ahora
 * tienen que pasar.
 *
 * Los bloques `GATE ·` que no llevan letra de hallazgo no vienen de una rotura: son el **punto
 * ciego** que dejó abierto la verificación —el gate de T-18 nunca ejercita la URL por defecto
 * porque los tests inyectan `urls.aemet`— atacado y **no roto**. Se quedan por la misma razón: un
 * punto ciego comprobado una vez a mano vuelve a ser un punto ciego a la semana siguiente.
 */

import assert from "node:assert/strict";
import test from "node:test";
// @ts-types="@types/express"
import express from "express";

import { inspectAemetKey } from "../aemet-key.ts";
import { AEMET_BASE_URL } from "../aemet.ts";
import { createMemoryWeatherCache } from "../cache.ts";
import { createWeatherModule, type PortLocationRepository, type WeatherModuleDeps } from "../module.ts";
import { fakeClock, fetchSpy, type FetchSpy } from "./fakes.ts";

const T0 = Date.parse("2026-08-28T13:37:00Z");
const DAY = 86_400_000;
const AEMET_URL = "https://aemet.test/opendata/api";
const AEMET_DATOS = "https://aemet.test/opendata/sh/deadbeef";
const VIGO = "/bulletin?port=vigo";

/** Las mismas señas del canal del operador que vigila el gate de T-18. */
const SENAS_DEL_OPERADOR = [
  "AEMET_API_KEY",
  "opendata.aemet.es",
  "centrodedescargas",
  "Renuévala",
  "actualiza el secreto",
] as const;

const ports: PortLocationRepository = {
  findBySlug: (slug) =>
    Promise.resolve(slug === "vigo" ? { slug: "vigo", lat: 42.2406, lon: -8.7207 } : undefined),
};

/** JWT sintético con la caducidad pedida. Firma de relleno: aquí solo se lee el `exp`. */
function jwt(expiresAtMs: number): string {
  return jwtCon({ exp: expiresAtMs / 1000 });
}

/** JWT con el payload que se le pase, para las claves que no entendemos. */
function jwtCon(payload: unknown): string {
  const b64 = (value: unknown): string =>
    btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.firma-de-prueba`;
}

/** El documento que devuelve el doble de AEMET cuando sirve el boletín. */
const DOCUMENTO = [{ elaborado: "2026-08-28T11:00:00Z", prediccion: { texto: "Marejada." } }];

/**
 * Un ataque que se queda vigilando: o la app lo aguantó desde el principio, o lo aguanta desde que
 * se arregló el hallazgo que lo reprodujo. En los dos casos el cuerpo es el mismo y tiene que
 * pasar, que es lo que convierte un pase adversario en un trinquete y no en un informe.
 *
 * Aquí vivía `hallazgoAbierto()`, el envoltorio que dejaba a los cuatro hallazgos en verde mientras
 * estaban abiertos y gritaba al arreglarlos. Cumplió: los cinco cuerpos pasaron a la vez y el
 * envoltorio se retiró. Queda escrito porque el siguiente pase lo volverá a necesitar.
 */
function gatePermanente(nombre: string, cuerpo: () => Promise<void>): void {
  test(nombre, cuerpo);
}

interface Instancia {
  readonly get: (ruta: string) => Promise<{ status: number; texto: string }>;
  readonly cerrar: () => void;
}

/** Monta el módulo detrás de Express y habla con él **por HTTP**: el cuerpo publicado, no la función. */
async function montar(deps: WeatherModuleDeps): Promise<Instancia> {
  const api = createWeatherModule(deps).api?.({});
  assert.ok(api !== undefined, "el módulo weather debe tener parte de API");
  const app = express();
  app.use("/v1/modules/weather", api.router);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/v1/modules/weather`;
  return {
    get: async (ruta) => {
      const respuesta = await fetch(`${base}${ruta}`);
      return { status: respuesta.status, texto: await respuesta.text() };
    },
    cerrar: () => {
      server.closeAllConnections();
      server.close();
    },
  };
}

function deps(overrides: Partial<WeatherModuleDeps> & { fetch: typeof fetch; now: () => number }): WeatherModuleDeps {
  return {
    cache: createMemoryWeatherCache(overrides.now),
    ports,
    urls: { aemet: AEMET_URL },
    ...overrides,
  };
}

/** Doble de AEMET que sirve el boletín sin rechistar. */
function aemetQueSirve(): FetchSpy {
  return fetchSpy((url) => {
    if (url.startsWith(`${AEMET_URL}/prediccion`)) return { estado: 200, datos: AEMET_DATOS };
    if (url === AEMET_DATOS) return DOCUMENTO;
    throw new Error(`URL inesperada: ${url}`);
  });
}

// =================================================================================================
// A-17 · clase A12 (la promesa vs lo entregado) · el cuerpo público se desmiente a sí mismo
// =================================================================================================

/**
 * T-18 cambió el `message` público por una frase «neutra derivada del status». Dos de esas cinco
 * frases **no son neutras: afirman un hecho** —«no publica el boletín oficial»— y ese hecho es
 * falso en cuanto el boletín sale por la misma respuesta:
 *
 * - `expired` · la caducidad se lee **en local** del `exp` del JWT. Que la fecha haya pasado no
 *   impide que AEMET siga sirviendo (desfase de reloj, margen de gracia) ni, sobre todo, que la
 *   caché del propio módulo siga entregando el boletín durante 4×TTL.
 * - `missing` · el operador borra o rota el secreto con la caché caliente: la credencial pasa a
 *   `missing` y el boletín se sigue sirviendo de caché.
 *
 * El resultado es una respuesta que dice `"status":"ok"`, adjunta el `document` entero y a la vez
 * publica «no publica el boletín oficial». Quien consume el API no puede decir *por qué* no hay
 * boletín: le están diciendo que no lo hay mientras se lo entregan.
 *
 * Y es una regresión de esta trayectoria, no algo heredado: el `message` anterior de `expired`
 * («La AEMET_API_KEY caducó hace N día(s)…») decía una fecha, que era verdad. El nuevo dice una
 * consecuencia, que no siempre lo es.
 *
 * Comportamiento correcto: si el cuerpo trae el boletín, la frase pública de la credencial no puede
 * negar que se publique. Puede decir que la credencial caducó —eso es cierto— pero no la
 * consecuencia que la propia respuesta desmiente.
 *
 * **CERRADO** en `aemet-key.ts` (`PUBLIC_MESSAGES`): las frases de `missing` y `expired` se quedan
 * en el estado de la credencial y sueltan la consecuencia. Quién publica y quién no ya lo dicen el
 * `status` y la presencia del `document`.
 *
 * Lo que este gate mide desde ahora: en los dos estados donde la credencial no vale y el boletín
 * sale igual —clave caducada con AEMET respondiendo, y secreto borrado con la caché caliente— el
 * cuerpo publicado trae `status: "ok"` **y** `document` **y** una frase de credencial que no niega
 * que haya boletín. No congela la prosa: cualquier reescritura sin la negación pasa.
 */
const NIEGA_QUE_HAYA_BOLETIN = /no\s+(?:se\s+)?publica[^.]*bolet[íi]n/iu;

async function seDesmiente(escenario: string, instancia: Instancia): Promise<void> {
  const { texto } = await instancia.get(VIGO);
  const cuerpo = JSON.parse(texto) as {
    status: string;
    document?: unknown;
    credential: { status: string; message: string };
  };
  assert.equal(cuerpo.status, "ok", `${escenario}: el escenario tenía que servir el boletín`);
  assert.notEqual(cuerpo.document, undefined, `${escenario}: el escenario tenía que traer documento`);
  assert.ok(
    !NIEGA_QUE_HAYA_BOLETIN.test(cuerpo.credential.message),
    `el cuerpo público publica el boletín y a la vez lo niega (${escenario}, credencial ` +
      `'${cuerpo.credential.status}'): «${cuerpo.credential.message}» viaja en la misma respuesta ` +
      `que el documento de AEMET. Cuerpo: ${texto}`,
  );
}

gatePermanente(
  "A-17 · clave caducada y AEMET sirviendo: la respuesta publica el boletín y a la vez lo niega",
  async () => {
    const clock = fakeClock(T0);
    const instancia = await montar(
      deps({ fetch: aemetQueSirve().fetch, now: clock.now, aemetApiKey: jwt(T0 - 3 * DAY) }),
    );
    try {
      await seDesmiente("clave caducada, AEMET responde", instancia);
    } finally {
      instancia.cerrar();
    }
  },
);

gatePermanente(
  "A-17 · secreto borrado con la caché caliente: la respuesta publica el boletín y a la vez lo niega",
  async () => {
    const clock = fakeClock(T0);
    let clave: string | undefined = jwt(T0 + 90 * DAY);
    // El secreto se lee en cada petición (`deps.aemetApiKey` no se congela al montar el módulo), así
    // que el getter reproduce lo que pasa cuando el operador borra la variable sin redesplegar.
    const instancia = await montar({
      fetch: aemetQueSirve().fetch,
      cache: createMemoryWeatherCache(clock.now),
      now: clock.now,
      ports,
      urls: { aemet: AEMET_URL },
      get aemetApiKey(): string | undefined {
        return clave;
      },
    });
    try {
      await instancia.get(VIGO); // calienta la caché con la clave buena
      clave = undefined; // el operador borra el secreto: la caché sigue caliente
      await seDesmiente("secreto borrado, caché caliente", instancia);
    } finally {
      instancia.cerrar();
    }
  },
);

// =================================================================================================
// A-18 · clase A6 (input hostil) · la tercera copia: el `reason` republica lo que escribe AEMET
// =================================================================================================

/**
 * El implementador encontró **dos** copias de la fuga (`credential.message` y el `reason` que
 * redactamos nosotros en `aemet.ts`) y montó un gate que serializa la respuesta entera buscando las
 * cinco señas. Hay una tercera, y el gate no puede verla porque no la escribimos nosotros: el
 * `descripcion` que devuelve AEMET en un sobre con `estado != 200` viaja **literal** al `reason`
 * público (`aemet.ts:139`), sin más filtro que un recorte a 200 caracteres.
 *
 * El gate de T-18 sí ejercita un 401 —`{"descripcion":"api_key caducada","estado":401}`— pero con
 * un texto elegido para no morder, así que mide la rama sin medir el canal. Cualquier `descripcion`
 * que hable de renovar la clave publica por el borde las mismas señas que la trayectoria declaró
 * prohibidas, y además llega **a la página**: `vista.ts` compone «(el servidor informa: …)» con ese
 * `reason` tal cual (ver el gemelo de este ataque en `apps/web/src/modulos/meteo/adversario-t18.test.ts`).
 *
 * Honestidad sobre el ataque: el texto exacto que devuelve AEMET en un 401 **no está verificado en
 * este repositorio** —no hay clave con la que comprobarlo, la misma razón por la que las zonas
 * siguen con `verified: false`—. Lo que este recorrido demuestra no es qué dice AEMET, sino que
 * **nada mira lo que dice** antes de republicarlo en el borde público. Un canal de paso sin filtro
 * es una copia de la fuga esperando a que el upstream escriba la frase.
 *
 * Comportamiento correcto: el `reason` que sale por HTTP no lleva las señas del canal del operador,
 * las haya escrito quien las haya escrito.
 *
 * **CERRADO** en `errors.ts` (`reasonFrom`), que es **el borde**: la única puerta por la que se
 * llena el `reason` público. Ahí se recortan las señas antes de publicar, así que la propiedad deja
 * de depender de que cada quien redacte con cuidado y pasa a cubrir todos los caminos hacia el
 * `reason`, incluidos los que todavía no existen. Es lista negra y se dice en el propio comentario
 * de la función.
 *
 * Lo que este gate mide desde ahora: con un `descripcion` de AEMET que **sí** lleva las señas —el
 * de T-18 estaba elegido para no morder— ninguna de las cinco sale por el cuerpo HTTP.
 */
gatePermanente(
  "A-18 · el `reason` público republica el manual de renovación que escribe el upstream",
  async () => {
    const clock = fakeClock(T0);
    // Un 401 de AEMET redactado como se redacta un error de credencial: diciendo dónde se arregla.
    const upstream = fetchSpy((url) => {
      if (url.startsWith(`${AEMET_URL}/prediccion`)) {
        return {
          estado: 401,
          descripcion:
            "API key expirada. Solicite una nueva en https://opendata.aemet.es/centrodedescargas/altaUsuario",
        };
      }
      throw new Error(`URL inesperada: ${url}`);
    });
    const instancia = await montar(
      deps({ fetch: upstream.fetch, now: clock.now, aemetApiKey: jwt(T0 + 90 * DAY) }),
    );
    try {
      const { texto } = await instancia.get(VIGO);
      for (const sena of SENAS_DEL_OPERADOR) {
        assert.ok(
          !texto.includes(sena),
          `el borde público republica la seña «${sena}» del canal del operador porque la escribió ` +
            `AEMET y nadie la mira: ${texto}`,
        );
      }
    } finally {
      instancia.cerrar();
    }
  },
);

// =================================================================================================
// A-19 · clase A5 (límites) · una clave que no entendemos rompe el endpoint en vez de degradarlo
// =================================================================================================

/**
 * `inspectAemetKey` tiene una rama explícita para «una clave que no entendemos» (`unreadable`) y su
 * comentario lo razona: un `exp` con otra forma no es una clave eterna, es una clave ilegible. Pero
 * solo comprueba **la forma** (`typeof number` + `Number.isFinite`), no **el rango**: un `exp`
 * finito que multiplicado por 1000 se sale del rango de `Date` hace que `new Date(…).toISOString()`
 * lance `RangeError` desde dentro de la función pura.
 *
 * El estallido no se queda ahí: `bulletinHandler` llama a `inspectAemetKey` en las dos ramas, así
 * que `GET /bulletin` devuelve **HTTP 500 «Error interno sirviendo la petición»** — y el
 * `healthcheck()` del módulo lanza síncronamente, de modo que el día que `/health` lo conecte
 * (deuda de T-15) se lleva la salud por delante.
 *
 * Contra la promesa, y directamente: T-18 se comprometió a que quien consume el API pudiera seguir
 * sabiendo *por qué* no hay boletín. Con un 500 no hay `credential`, no hay `reason` y no hay
 * hecho: hay un callejón sin salida (clase A9) del que además nadie se entera, porque la avería la
 * causa un valor del entorno y no una petición.
 *
 * Comportamiento correcto: el módulo degrada, no rompe. Una clave con un `exp` que no cabe en una
 * fecha es exactamente `unreadable`.
 *
 * **CERRADO** en `aemet-key.ts`: antes de construir la fecha se comprueba que el instante cabe en
 * el rango de `Date`, y si no cabe la clave sale `unreadable`, que es el estado del dominio para
 * «una clave que no entendemos».
 *
 * Lo que este gate mide desde ahora: los tres `exp` que reventaban —el de microsegundos, el
 * negativo desmesurado y **el borde exacto medido durante el pase** (`8 640 000 000 000` pasa,
 * `+1` reventaba)— devuelven HTTP 200 con `credential.status: "unreadable"`. Se afirma sobre el
 * cuerpo publicado: lo que se prometió conservar es que quien consume el API pueda seguir diciendo
 * *por qué* no hay boletín, y eso solo se ve en el cuerpo.
 */
/**
 * Los `exp` finitos, numéricos y fuera del rango de `Date`. El tercero es el **borde exacto**
 * medido durante el pase: en milisegundos el límite de `Date` es 8 640 000 000 000 000, así que en
 * segundos `8 640 000 000 000` es el último que cabe y `+1` es el primero que reventaba. Un gate
 * que solo probara el caso cómodo dejaría el borde sin vigilar, que es de lo que va toda esta épica.
 */
const EXP_QUE_NO_ES_FECHA: readonly { readonly nombre: string; readonly exp: number }[] = [
  { nombre: "exp en microsegundos (la confusión de unidad plausible)", exp: 1e14 },
  { nombre: "exp negativo desmesurado", exp: -1e14 },
  { nombre: "el primer exp que ya no cabe en un Date", exp: 8_640_000_000_001 },
];

gatePermanente(
  "A-19 · un `exp` que no cabe en un `Date` degrada a 'unreadable' en vez de romper el endpoint",
  async () => {
    for (const { nombre, exp } of EXP_QUE_NO_ES_FECHA) {
      const clock = fakeClock(T0);
      const instancia = await montar(
        deps({ fetch: aemetQueSirve().fetch, now: clock.now, aemetApiKey: jwtCon({ exp }) }),
      );
      try {
        const { status, texto } = await instancia.get(VIGO);
        assert.equal(
          status,
          200,
          `${nombre}: una clave con un \`exp\` fuera del rango de \`Date\` rompe el borde público ` +
            `en vez de degradar: HTTP ${status} · ${texto}`,
        );
        const cuerpo = JSON.parse(texto) as { credential?: { status?: string } };
        assert.equal(
          cuerpo.credential?.status,
          "unreadable",
          `${nombre}: una clave que no se entiende tiene que salir como 'unreadable', no como ${texto}`,
        );
      } finally {
        instancia.cerrar();
      }
    }

    // Y el último `exp` que SÍ es una fecha se sigue leyendo como tal: la guarda recorta lo que no
    // cabe, no lo que está cerca del borde. Sin esto, «arreglar» A-19 podría ser declarar ilegible
    // media recta real y nadie se enteraría.
    const enElBorde = inspectAemetKey(jwtCon({ exp: 8_640_000_000_000 }), T0);
    assert.equal(enElBorde.status, "valid");
    assert.equal(enElBorde.expiresAt, "+275760-09-13T00:00:00.000Z");
  },
);

// =================================================================================================
// A-20 · clase A12 (coherencia entre lo publicado) · el `daysLeft` no cuadra con el `expiresAt`
// =================================================================================================

/**
 * `daysLeft` y `expiresAt` viajan **juntos en el mismo cuerpo público**, y no dicen lo mismo.
 * `daysBetween` hace `Math.floor((exp - now) / DÍA)`, que para una diferencia negativa redondea
 * **hacia abajo**: un milisegundo después de caducar, `daysLeft` ya vale `-1`. El aviso al operador
 * interpola ese mismo número («caducó hace 1 día(s)») y el fixture de la web que T-18 re-proyectó
 * lo lleva congelado: `expiresAt: 2026-07-20`, `daysLeft: -40`, cuando habían pasado 39 días.
 *
 * No es un decimal perdido: es un día entero de más, siempre, desde el primer milisegundo, en los
 * dos canales a la vez. Y es el único número con el que un consumidor puede decidir si el hueco de
 * boletín es de esta mañana o de la semana pasada.
 *
 * Comportamiento correcto: `|daysLeft|` días completos tienen que haber pasado de verdad desde
 * `expiresAt`. Se afirma sobre el cuerpo HTTP publicado, no sobre la función.
 *
 * **CERRADO** en `aemet-key.ts` (`daysBetween`), que es de donde beben los dos canales: redondea
 * hacia cero en vez de hacia abajo. Y de paso el **estado** dejó de decidirse con ese número: una
 * clave muerta hace un minuto vale `daysLeft: 0`, y `0 < 0` la habría dado por viva, así que
 * `expired` se pregunta comparando instantes. Los fixtures de la web se re-proyectaron con la
 * función arreglada (`-40` → `-39`), no a mano, y hay un gate que lo vigila en el gemelo de la web.
 *
 * Lo que este gate mide desde ahora: un milisegundo después de caducar, el cuerpo publicado cumple
 * `|daysLeft| × DÍA <= (now − expiresAt)`. Sin prosa: los días que se publican han pasado de verdad.
 */
gatePermanente(
  "A-20 · el `daysLeft` público cuenta un día entero de más desde el primer milisegundo",
  async () => {
    const clock = fakeClock(T0);
    const instancia = await montar(
      deps({ fetch: aemetQueSirve().fetch, now: clock.now, aemetApiKey: jwt(T0 - 1) }),
    );
    try {
      const { texto } = await instancia.get(VIGO);
      const { credential } = JSON.parse(texto) as {
        credential: { status: string; expiresAt: string; daysLeft: number };
      };
      assert.equal(credential.status, "expired", "el escenario tenía que dar una clave caducada");
      const transcurridoMs = T0 - Date.parse(credential.expiresAt);
      assert.ok(
        Math.abs(credential.daysLeft) * DAY <= transcurridoMs,
        `el cuerpo público publica días que todavía no han pasado: dice daysLeft ` +
          `${credential.daysLeft} junto a un expiresAt de hace ${transcurridoMs} ms ` +
          `(${(transcurridoMs / DAY).toFixed(6)} días). Cuerpo: ${texto}`,
      );
    } finally {
      instancia.cerrar();
    }
  },
);

// =================================================================================================
// GATE · el punto ciego de la verificación: el camino real, sin inyectar `urls.aemet`
// =================================================================================================

/**
 * ATACADO Y NO ROTO — esto no es un hallazgo, es el punto ciego que dejó la verificación cerrado
 * con un gate.
 *
 * El recorrido de T-18 nunca ejercita la URL por defecto: todos sus escenarios inyectan
 * `urls.aemet`, así que la constante `AEMET_BASE_URL` —que **contiene la seña `opendata.aemet.es`**—
 * no pasa por ninguna respuesta durante el gate. Si un fallo de red publicara la URL pedida en el
 * `reason`, el borde público publicaría la seña y el gate no se enteraría.
 *
 * Medido contra el runtime de producción (Deno 2.9.6, `apps/api` con `globalThis.fetch`), las
 * cuatro formas en que ese camino falla de verdad:
 *
 *   1. red/DNS/TLS → `TypeError: fetch failed`, con la URL **en la `cause`**, no en el `message`.
 *   2. timeout (`AbortSignal.timeout`) → `TimeoutError: The operation was aborted due to timeout`.
 *   3. la **segunda** llamada (la de `datos`), que no pasa por `fetchJson` y llega cruda a
 *      `reasonFrom`.
 *   4. un sobre que apunta a otro origen, que es el único sitio donde manejamos una URL ajena.
 *
 * `http-json.ts:40` compone el motivo con `cause.message`, no con `String(cause)`, así que la URL
 * se queda dentro de la `cause` y no sale. Este gate lo fija: si alguien cambia esa línea por
 * `String(cause)` —o el runtime cambia de forma de error— esto se pone rojo en vez de esperar al
 * siguiente pase adversario.
 */
const URL_PEDIDA = `${AEMET_BASE_URL}/prediccion/maritima/costera/costa/36`;

function errorDeRedComoDeno(): Error {
  return new TypeError("fetch failed", {
    cause: new Error(
      `error sending request for url (${URL_PEDIDA}): client error (Connect): ` +
        `dns error: failed to lookup address information: Name or service not known`,
    ),
  });
}

function errorDeTimeoutComoDeno(): Error {
  const error = new Error("The operation was aborted due to timeout");
  error.name = "TimeoutError";
  return error;
}

gatePermanente(
  "GATE · el camino real (sin `urls.aemet`) no publica la URL de AEMET cuando la red falla",
  async () => {
    const escenarios: readonly { readonly nombre: string; readonly ruta: (url: string) => unknown }[] = [
      { nombre: "red caída", ruta: () => { throw errorDeRedComoDeno(); } },
      { nombre: "timeout", ruta: () => { throw errorDeTimeoutComoDeno(); } },
      {
        nombre: "la segunda llamada (datos) revienta",
        ruta: (url) => {
          if (url.startsWith(`${AEMET_BASE_URL}/prediccion`)) {
            return { estado: 200, datos: `${AEMET_BASE_URL}/sh/deadbeef` };
          }
          throw errorDeRedComoDeno();
        },
      },
      {
        nombre: "el sobre apunta a otro origen",
        ruta: (url) => {
          if (url.startsWith(`${AEMET_BASE_URL}/prediccion`)) {
            return { estado: 200, datos: "https://otro-sitio.example/sh/deadbeef" };
          }
          throw errorDeRedComoDeno();
        },
      },
    ];

    for (const escenario of escenarios) {
      const clock = fakeClock(T0);
      const instancia = await montar({
        fetch: fetchSpy(escenario.ruta).fetch,
        cache: createMemoryWeatherCache(clock.now),
        now: clock.now,
        ports,
        aemetApiKey: jwt(T0 + 90 * DAY),
        // Sin `urls`: se usa AEMET_BASE_URL, que es lo que el gate de T-18 nunca ejercita.
      });
      try {
        const { status, texto } = await instancia.get(VIGO);
        assert.equal(status, 200, `${escenario.nombre}: el módulo tiene que degradar, no romper`);
        for (const sena of SENAS_DEL_OPERADOR) {
          assert.ok(
            !texto.includes(sena),
            `${escenario.nombre}: el camino por defecto publica la seña «${sena}»: ${texto}`,
          );
        }
      } finally {
        instancia.cerrar();
      }
    }
  },
);

/**
 * Y el trinquete al revés del punto ciego: que el escenario de arriba sea de verdad el camino por
 * defecto. Si alguien le pone un `urls.aemet` al gate «para que no salga a la red», el gate deja de
 * medir lo que dice medir y nadie se entera — que es exactamente lo que le pasó al de T-18.
 */
gatePermanente("GATE · el camino por defecto pide de verdad a la URL de AEMET", async () => {
  const clock = fakeClock(T0);
  const spy = fetchSpy(() => {
    throw errorDeRedComoDeno();
  });
  const instancia = await montar({
    fetch: spy.fetch,
    cache: createMemoryWeatherCache(clock.now),
    now: clock.now,
    ports,
    aemetApiKey: jwt(T0 + 90 * DAY),
  });
  try {
    await instancia.get(VIGO);
  } finally {
    instancia.cerrar();
  }
  assert.deepEqual(spy.calls, [URL_PEDIDA], "el escenario del punto ciego no usó la URL por defecto");
  assert.ok(
    URL_PEDIDA.includes("opendata.aemet.es"),
    "la URL por defecto ya no lleva la seña: re-apunta este gate en vez de borrarlo",
  );
});

/**
 * El estado de la credencial se calcula con el reloj **inyectado**, y esa es la única razón por la
 * que A-20 se puede afirmar sobre el cuerpo HTTP. Si alguien vuelve a `Date.now()` dentro del
 * módulo, los recorridos de arriba dejarían de medir lo que creen medir.
 */
gatePermanente("GATE · la credencial publicada usa el reloj inyectado, no el del proceso", async () => {
  const clock = fakeClock(T0);
  const instancia = await montar(
    deps({ fetch: aemetQueSirve().fetch, now: clock.now, aemetApiKey: jwt(T0 + 10 * DAY) }),
  );
  try {
    const { texto } = await instancia.get(VIGO);
    const { credential } = JSON.parse(texto) as { credential: { daysLeft: number } };
    assert.equal(credential.daysLeft, 10, `el cuerpo no usó el reloj inyectado: ${texto}`);
    assert.equal(inspectAemetKey(jwt(T0 + 10 * DAY), T0).daysLeft, 10);
  } finally {
    instancia.cerrar();
  }
});
