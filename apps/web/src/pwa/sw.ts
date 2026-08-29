/**
 * El service worker de Mareia. **Un almanaque que se abre sin cobertura**, que es la promesa que
 * separa a este portal de una web de mareas: quien está en el agua no tiene red.
 *
 * ## Lo que hace, y en qué orden de importancia
 *
 * 1. **El HTML se pide siempre a la red primero** (`network-first`). Es la decisión que impide el
 *    bug caro de los service workers —servir una página vieja para siempre— y está razonada en
 *    `docs/adr/ADR-02`. La copia guardada es la red de emergencia de un favorito sin cobertura, no
 *    la vía normal.
 * 2. **Los assets con hash van `cache-first`**, y ahí sí es seguro: `/_astro/AlmanaqueLayout.<hash>
 *    .css` cambia de URL cuando cambia de contenido, así que una copia guardada nunca puede ser una
 *    versión vieja de nada. Solo se sirven de caché los que ya estaban guardados; los que no, van a
 *    la red **y no se guardan**: un favorito es un acto explícito y aquí no se guarda nada que
 *    nadie haya pedido.
 * 3. **Los endpoints de los módulos** siguen la `PrecachePolicy` que cada módulo declara en el
 *    contrato `AppModule` (T-06). El worker no conoce ni una ruta de meteo: le llegan inyectadas
 *    desde el registry (`POLITICAS`). Dar de baja un módulo se lleva su política por delante.
 * 4. **La copia de una respuesta de módulo se guarda sellada** con el reloj del navegador
 *    (`PROTOCOLO.cabeceraGuardado`). Sin ese sello, la sección meteo pintaría una copia de anteayer
 *    con cara de recién traída, que es exactamente la mentira que T-11 existe para no contar.
 *
 * ## Por qué este fichero no importa nada
 *
 * Se sirve como un fichero suelto en `/sw.js`, sin bundler: lo transpila el endpoint
 * `src/pages/sw.js.ts` con el compilador de TypeScript y **falla el build si el resultado contiene
 * un solo `import` de runtime**. A cambio de esa disciplina, el worker es legible entero de una
 * sentada y no puede arrastrar medio `node_modules` al hilo que decide qué se sirve sin red.
 *
 * Lo que necesita del resto del código llega **inyectado como constantes** (`VERSION`, `PROTOCOLO`,
 * `POLITICAS`), declaradas abajo y tipadas contra los módulos de verdad: si alguien renombra un
 * campo del protocolo, esto no compila.
 */

import type { PoliticaResuelta } from "./precacheo.ts";
import type { Protocolo } from "./protocolo.ts";

// =================================================================================================
// Lo que inyecta el endpoint que genera `/sw.js`. No son globales del navegador: son constantes
// que se escriben delante de este código en tiempo de build (ver `src/pages/sw.js.ts`).
// =================================================================================================

/** Identifica el build que escribió este worker. Su único trabajo: que los bytes cambien. */
declare const VERSION: string;
/** Nombres de caché, cabeceras y mensajes compartidos con la página (`pwa/protocolo.ts`). */
declare const PROTOCOLO: Protocolo;
/** Las políticas offline de los módulos activos, tal y como las declara el registry. */
declare const POLITICAS: readonly PoliticaResuelta[];

// =================================================================================================
// Tipos del ámbito de un service worker.
//
// No vienen en la `lib` de TypeScript que usa esta app: `lib.dom` describe una ventana y
// `lib.webworker` es incompatible con ella (redefine `self`, `fetch` y media docena más), así que
// mezclarlas para tipar un fichero rompería el resto de `apps/web`. Se declara **solo lo que este
// worker usa**, que son cinco cosas, y así el fichero sigue tipado de verdad en vez de a base de
// `any`.
// =================================================================================================

/** Evento que puede pedirle al navegador que no lo apague hasta que su promesa termine. */
interface EventoExtensible {
  waitUntil(trabajo: Promise<unknown>): void;
}

/** Una petición que el worker puede contestar él. */
interface EventoDeFetch extends EventoExtensible {
  readonly request: Request;
  respondWith(respuesta: Response | Promise<Response>): void;
}

/** Un mensaje de la página. `ports[0]` es por donde se contesta (`MessageChannel`). */
interface EventoDeMensaje extends EventoExtensible {
  readonly data: unknown;
  readonly ports: readonly MessagePort[];
}

/** Lo que el worker usa del ámbito global. */
interface AmbitoDelWorker {
  readonly clients: { claim(): Promise<void> };
  addEventListener(tipo: "install" | "activate", escucha: (evento: EventoExtensible) => void): void;
  addEventListener(tipo: "fetch", escucha: (evento: EventoDeFetch) => void): void;
  addEventListener(tipo: "message", escucha: (evento: EventoDeMensaje) => void): void;
}

/**
 * El ámbito global, con el tipo que le corresponde.
 *
 * `self` está declarado por `lib.dom` como `Window`, que aquí es falso: esto no corre en una
 * ventana. El cast dice la verdad en vez de arrastrar la mentira por todo el fichero.
 */
const ambito = self as unknown as AmbitoDelWorker;

// =================================================================================================
// Ciclo de vida
// =================================================================================================

/**
 * Instalación. **No se llama a `skipWaiting`**, y esa omisión es la decisión de ADR-02: un worker
 * nuevo no le cambia el motor a una pestaña que alguien está leyendo. Espera, y toma el control en
 * la siguiente navegación, que en un sitio multipágina llega con el primer enlace que se pulse.
 *
 * Tampoco se precachea nada aquí: lo que se guarda lo pide la página cuando alguien marca un
 * favorito. Instalar la PWA no puede significar bajarse el portal entero a espaldas de nadie.
 */
ambito.addEventListener("install", () => {
  console.warn(`[mareia] service worker ${VERSION} instalado; espera a la siguiente navegación`);
});

/**
 * Activación: se toma el control de las pestañas abiertas y se barren las cachés de **esquemas
 * anteriores** (no de builds anteriores: ver `ESQUEMA_CACHE` en `pwa/protocolo.ts`).
 *
 * Se borra solo lo que lleva nuestro prefijo. Una caché ajena en el mismo origen no es asunto de
 * este worker.
 */
ambito.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const vigentes = new Set([PROTOCOLO.cachePaginas, PROTOCOLO.cacheModulos]);
      const nombres = await caches.keys();
      await Promise.all(
        nombres
          .filter((nombre) => nombre.startsWith(`${PROTOCOLO.prefijoCache}-`) && !vigentes.has(nombre))
          .map((nombre) => caches.delete(nombre)),
      );
      await ambito.clients.claim();
    })(),
  );
});

// =================================================================================================
// Enrutado
// =================================================================================================

/** Prefijo de los assets con hash que emite Astro. Cambian de URL cuando cambian de contenido. */
const PREFIJO_ASSETS = "/_astro/";

/** Prefijo de los ficheros de constantes armónicas que la página usa para calcular sin red. */
const PREFIJO_OFFLINE = "/offline/";

/** La política del módulo a la que pertenece un camino, si es de alguno. */
function politicaDe(camino: string): PoliticaResuelta | undefined {
  return POLITICAS.find((politica) => politica.rutas.some((ruta) => camino.startsWith(ruta)));
}

/**
 * Contesta una petición, o no la toca.
 *
 * Devolver `undefined` significa «no es asunto mío»: el navegador la hace como si no hubiera
 * worker. Es lo que pasa con todo lo que no es GET, con otros orígenes y con lo que no encaja en
 * ninguna de las tres reglas — no interceptar es la respuesta segura por defecto.
 */
function respuestaPara(peticion: Request): Promise<Response> | undefined {
  if (peticion.method !== "GET") {
    return undefined;
  }
  const url = new URL(peticion.url);
  const politica = politicaDe(url.pathname);
  if (politica !== undefined) {
    return deLaRedYGuardar(peticion, politica);
  }
  if (url.origin !== location.origin) {
    return undefined;
  }
  if (peticion.mode === "navigate") {
    return laPaginaDeLaRedODeLaCopia(peticion);
  }
  if (url.pathname.startsWith(PREFIJO_ASSETS)) {
    return deLaCopiaODeLaRed(peticion);
  }
  if (url.pathname.startsWith(PREFIJO_OFFLINE)) {
    return deLaCopiaYDeCaminoRefrescar(peticion);
  }
  return undefined;
}

ambito.addEventListener("fetch", (evento) => {
  const respuesta = respuestaPara(evento.request);
  if (respuesta !== undefined) {
    evento.respondWith(respuesta);
  }
});

// =================================================================================================
// Las tres estrategias
// =================================================================================================

/**
 * HTML: red primero; si la red falla, la copia guardada.
 *
 * **No hay temporizador que corte la espera de la red**, y es a propósito: un timeout serviría la
 * página de ayer a quien solo tiene un 3G lento, y una tabla de mareas de ayer con cara de hoy es
 * el fallo que este portal no se puede permitir. Sin cobertura, el `fetch` falla en milisegundos y
 * la copia entra; con cobertura mala, se espera y se lee lo de hoy.
 *
 * La copia solo se **refresca** si ya estaba guardada, o sea, si es la página de un favorito. Al
 * navegar por el resto del sitio no se guarda nada: nadie lo ha pedido.
 */
async function laPaginaDeLaRedODeLaCopia(peticion: Request): Promise<Response> {
  const cache = await caches.open(PROTOCOLO.cachePaginas);
  try {
    // `cache: "no-store"` no es ceremonia: **un `fetch` dentro del worker puede contestarse desde la
    // caché HTTP del navegador**. Con `Last-Modified` y sin `Cache-Control` —que es lo que hoy
    // describe `docs/despliegue.md` para producción— Chromium aplica caché heurística y serviría
    // HTML viejo *teniendo red*, que es exactamente lo que ADR-02 promete que no puede pasar. Sin
    // esto, la garantía del HTML fresco no sería del worker: sería de unas cabeceras que el
    // despliegue no fija. Lo apuntó el pase adversario sin poder reproducirlo (su servidor no manda
    // esas cabeceras) y se cierra aquí, que es donde no depende de nadie.
    const respuesta = await fetch(peticion, { cache: "no-store" });
    if (respuesta.ok && (await cache.match(peticion)) !== undefined) {
      await cache.put(peticion, respuesta.clone());
    }
    return respuesta;
  } catch (fallo: unknown) {
    const guardada = await cache.match(peticion);
    if (guardada !== undefined) {
      return guardada;
    }
    throw fallo;
  }
}

/**
 * Assets con hash: la copia primero, que es instantánea y **no puede estar desfasada**, porque la
 * URL lleva el hash del contenido y cambia con él.
 *
 * Si no hay copia se va a la red y **no se guarda el resultado**: entrar en una página que no es
 * favorita no puede llenar el teléfono de ficheros que nadie pidió.
 */
async function deLaCopiaODeLaRed(peticion: Request): Promise<Response> {
  const cache = await caches.open(PROTOCOLO.cachePaginas);
  const guardada = await cache.match(peticion);
  return guardada ?? fetch(peticion);
}

/**
 * Constantes armónicas (`/offline/estaciones/<slug>.json`): la copia se sirve al instante **y de
 * camino se comprueba si ha cambiado**.
 *
 * No es `cache-first` como los assets, y la diferencia importa: esa URL **no lleva hash**. El
 * pipeline de datos corrige constantes —para eso existe—, así que un `cache-first` puro dejaría al
 * teléfono calculando con las viejas para siempre bajo el rótulo «las mismas que usa el servidor»,
 * que es una frase que entonces sería falsa. Con `stale-while-revalidate` la respuesta sigue siendo
 * instantánea y sin red, y la copia se pone al día sola en cuanto haya cobertura.
 *
 * Solo se refresca lo que YA estaba guardado: si esta URL no es de un favorito, aquí no se guarda
 * nada.
 */
async function deLaCopiaYDeCaminoRefrescar(peticion: Request): Promise<Response> {
  const cache = await caches.open(PROTOCOLO.cachePaginas);
  const guardada = await cache.match(peticion);
  if (guardada === undefined) {
    return fetch(peticion);
  }
  // La revalidación va suelta y sin `await`: la página no espera por ella, y si no hay red, falla
  // en silencio y la copia sigue sirviendo (que es justo para lo que está).
  void fetch(peticion)
    .then(async (fresca) => (fresca.ok ? cache.put(peticion, fresca) : undefined))
    .catch(() => undefined);
  return guardada;
}

/**
 * Endpoints de módulo: red primero, y **lo que llegue se guarda sellado con la hora**.
 *
 * Guardar aquí no es precachear: es conservar la última respuesta que ya se sirvió, que es lo único
 * que permite que sin red la sección diga «guardado hace 3 h 20 min» en vez de callarse. El sello
 * es una cabecera y no un campo del cuerpo porque el cuerpo es el contrato del módulo y no se toca.
 */
async function deLaRedYGuardar(peticion: Request, politica: PoliticaResuelta): Promise<Response> {
  const cache = await caches.open(PROTOCOLO.cacheModulos);
  try {
    const respuesta = await fetch(peticion);
    if (respuesta.ok) {
      await cache.put(peticion, await sellada(respuesta.clone()));
      await podarPorAntiguedad(cache, PROTOCOLO.maxRespuestasDeModulo);
    }
    return respuesta;
  } catch (fallo: unknown) {
    const guardada = await cache.match(peticion);
    if (guardada !== undefined) {
      return guardada;
    }
    console.warn(`[mareia] sin red y sin copia guardada de ${politica.id}: ${peticion.url}`);
    throw fallo;
  }
}

/** La misma respuesta, con la hora a la que se guardó escrita en una cabecera. */
async function sellada(respuesta: Response): Promise<Response> {
  const cabeceras = new Headers(respuesta.headers);
  cabeceras.set(PROTOCOLO.cabeceraGuardado, String(Date.now()));
  return new Response(await respuesta.arrayBuffer(), {
    status: respuesta.status,
    statusText: respuesta.statusText,
    headers: cabeceras,
  });
}

/** Deja como mucho `maximo` entradas, tirando las más antiguas (`keys()` va en orden de entrada). */
async function podarPorAntiguedad(cache: Cache, maximo: number): Promise<void> {
  const claves = await cache.keys();
  await Promise.all(claves.slice(0, Math.max(0, claves.length - maximo)).map((clave) => cache.delete(clave)));
}

// =================================================================================================
// Los dos verbos que la página puede pedir
// =================================================================================================

/** Forma mínima de lo que llega por `postMessage`, antes de creérselo. */
interface MensajeCrudo {
  readonly tipo?: unknown;
  readonly slug?: unknown;
  readonly urls?: unknown;
  readonly favoritos?: unknown;
}

function listaDeCadenas(valor: unknown): readonly string[] {
  return Array.isArray(valor) ? valor.filter((cada): cada is string => typeof cada === "string") : [];
}

/**
 * Las operaciones sobre el registro se hacen **de una en una**.
 *
 * Leer-modificar-escribir sin cerrojo es una carrera: dos guardados solapados leen el mismo censo,
 * el segundo escribe encima del primero y el favorito perdido desaparece del censo — y con él, en la
 * siguiente poda, sus ficheros. El pase adversario la buscó dos veces y no la supo disparar (`addAll`
 * domina el tiempo y separa las dos ventanas), pero **estar en el código es suficiente motivo**: una
 * carrera que hoy no se dispara se dispara el día que `addAll` sea más rápido o la red más lenta.
 *
 * La cola es una promesa encadenada, que es todo lo que hace falta en un worker de un solo hilo.
 */
let cola: Promise<unknown> = Promise.resolve();

function enCola<T>(tarea: () => Promise<T>): Promise<T> {
  const resultado = cola.then(tarea, tarea);
  cola = resultado.catch(() => undefined);
  return resultado;
}

ambito.addEventListener("message", (evento) => {
  const puerto = evento.ports[0];
  if (puerto === undefined) {
    return; // Sin canal de vuelta no hay a quién contestar: la página siempre abre uno.
  }
  evento.waitUntil(
    (async () => {
      puerto.postMessage(await enCola(() => atender(evento.data)));
    })(),
  );
});

/** Ejecuta un verbo y **nunca lanza**: un fallo es una respuesta con su motivo, no una excepción. */
async function atender(datos: unknown): Promise<{ ok: boolean; motivo?: string; urls: number }> {
  const mensaje: MensajeCrudo = typeof datos === "object" && datos !== null ? datos : {};
  try {
    if (mensaje.tipo === PROTOCOLO.mensajeCensar) {
      return await censar(censoDe(mensaje.favoritos));
    }
    const slug = typeof mensaje.slug === "string" ? mensaje.slug : "";
    if (slug === "") {
      return { ok: false, motivo: "El service worker no sabe de qué puerto le hablan.", urls: 0 };
    }
    const urls = listaDeCadenas(mensaje.urls);
    if (mensaje.tipo === PROTOCOLO.mensajeGuardar) {
      return await guardar(slug, urls);
    }
    if (mensaje.tipo === PROTOCOLO.mensajeOlvidar) {
      return await olvidar(slug, urls);
    }
    return { ok: false, motivo: "El service worker no conoce esa petición.", urls: 0 };
  } catch {
    return {
      ok: false,
      motivo: "No se ha podido guardar el puerto en este dispositivo: la descarga no se completó.",
      urls: 0,
    };
  }
}

/** Lee el censo que manda la página, quedándose solo con lo que tiene la forma esperada. */
function censoDe(valor: unknown): Censo {
  if (!Array.isArray(valor)) {
    return {};
  }
  const censo: Censo = {};
  for (const entrada of valor) {
    if (typeof entrada !== "object" || entrada === null) {
      continue;
    }
    const { slug, urls } = entrada as { slug?: unknown; urls?: unknown };
    if (typeof slug === "string" && slug !== "") {
      censo[slug] = listaDeCadenas(urls);
    }
  }
  return censo;
}

// =================================================================================================
// El registro de favoritos
//
// La Cache API es un saco de respuestas sin dueño: sabe que tiene guardado
// `/_astro/hoja.<hash>.css`, no para quién. Sin saberlo, podar es adivinar — y la primera versión
// de esto adivinaba mal: tiraba todo asset que no usara **la página que se estaba guardando**,
// dando por hecho que «lo demás ya no lo referencia ningún HTML guardado». Es falso en cuanto hay
// dos favoritos guardados en dos builds distintos, y con el rebuild diario de T-15 eso es el caso
// normal: guardar el segundo puerto dejaba al primero con su página y **cero assets**.
//
// Con el registro, podar deja de adivinar: se conserva lo que necesita ALGÚN favorito. Pero eso
// solo vale si el registro es **completo**, y ahí estuvo el segundo error (hallazgo adversario
// H-2): cuando el registro no se podía leer, se escribía un censo de un puerto indistinguible de
// uno completo, y la siguiente poda lo trataba como la verdad. La propiedad que hace segura la poda
// no es «¿legible?» sino «¿completo?», así que ahora **viaja con el dato**.
// =================================================================================================

/** Qué URL necesita cada puerto guardado, por slug. */
type Censo = Record<string, readonly string[]>;

/**
 * El registro tal y como se guarda: el censo **y si se puede confiar en que están todos**.
 *
 * `completo: false` significa «esto es lo que he visto pasar, no sé si es todo»: se conserva para no
 * perder lo que se sabe, pero **no autoriza a podar**. Vuelve a `true` cuando la página manda el
 * censo entero desde IndexedDB, que es la única que lo conoce.
 */
interface Registro {
  readonly completo: boolean;
  readonly favoritos: Censo;
}

/** El registro guardado, o **`undefined` si no hay o no se entiende**. */
async function leerRegistro(cache: Cache): Promise<Registro | undefined> {
  const guardado = await cache.match(PROTOCOLO.claveRegistro);
  if (guardado === undefined) {
    return undefined;
  }
  try {
    const leido: unknown = await guardado.json();
    if (typeof leido !== "object" || leido === null || Array.isArray(leido)) {
      return undefined;
    }
    const { completo, favoritos } = leido as { completo?: unknown; favoritos?: unknown };
    if (typeof completo !== "boolean" || typeof favoritos !== "object" || favoritos === null) {
      return undefined;
    }
    const censo: Censo = {};
    for (const [slug, urls] of Object.entries(favoritos as Record<string, unknown>)) {
      censo[slug] = listaDeCadenas(urls);
    }
    return { completo, favoritos: censo };
  } catch {
    return undefined;
  }
}

async function escribirRegistro(cache: Cache, registro: Registro): Promise<void> {
  await cache.put(
    PROTOCOLO.claveRegistro,
    new Response(JSON.stringify(registro), {
      headers: { "content-type": "application/json; charset=utf-8" },
    }),
  );
}

/**
 * Guarda las URL de un favorito. `addAll` es **todo o nada**: si una sola falla no se guarda
 * ninguna, porque media página guardada es peor que ninguna — se abriría sin estilos, o con la
 * tabla y sin las constantes para calcular otro día, y quien la abriese en la playa no tendría
 * forma de saber qué le falta.
 *
 * El orden también es todo o nada: primero se baja, después se anota. Anotar antes dejaría en el
 * registro un favorito que no está guardado.
 *
 * Si el registro anterior no se podía leer, el que se escribe **se declara incompleto**: lo que hay
 * apuntado es lo que ha pasado por delante, no necesariamente todo, y con eso no se poda.
 */
async function guardar(slug: string, urls: readonly string[]): Promise<{ ok: boolean; urls: number }> {
  const cache = await caches.open(PROTOCOLO.cachePaginas);
  await cache.addAll([...urls]);
  const previo = await leerRegistro(cache);
  const registro: Registro = {
    // Completo si venimos de un registro completo, **o** si esto es el primer favorito de una caché
    // virgen: entonces lo que se acaba de guardar sí es todo lo que hay, y decir lo contrario
    // dejaría la poda apagada para siempre en el caso más normal de todos.
    completo: previo?.completo === true || (previo === undefined && (await esLaPrimeraCopia(cache, urls))),
    favoritos: { ...(previo?.favoritos ?? {}), [slug]: urls },
  };
  await escribirRegistro(cache, registro);
  await podarSiSePuede(cache, registro);
  return { ok: true, urls: urls.length };
}

/**
 * Si en la caché no hay ninguna página guardada que no sea de esta petición.
 *
 * Es la comprobación que distingue «no hay registro porque es la primera vez» de «no hay registro
 * porque se ha roto»: en el primer caso el censo que se acaba de escribir sí es completo. Se miran
 * las claves que no son assets ni el propio registro, que son las que identifican a un favorito.
 */
async function esLaPrimeraCopia(cache: Cache, urls: readonly string[]): Promise<boolean> {
  const recienGuardadas = new Set(urls);
  const claves = await cache.keys();
  return claves.every((clave) => {
    const camino = new URL(clave.url).pathname;
    return (
      camino.startsWith(PREFIJO_ASSETS) ||
      camino === PROTOCOLO.claveRegistro ||
      recienGuardadas.has(camino)
    );
  });
}

/** Borra la página y las constantes de un puerto, y con ellas sus assets si no los usa nadie más. */
async function olvidar(slug: string, urls: readonly string[]): Promise<{ ok: boolean; urls: number }> {
  const cache = await caches.open(PROTOCOLO.cachePaginas);
  const borradas = await Promise.all(urls.map((url) => cache.delete(url)));
  const previo = await leerRegistro(cache);
  // Sin registro legible se borra lo de este puerto y se para ahí: ni se poda ni se escribe un
  // registro inventado, que dejaría fuera a los favoritos que sí están guardados.
  if (previo !== undefined) {
    const { [slug]: sobra, ...resto } = previo.favoritos;
    void sobra;
    const registro: Registro = { completo: previo.completo, favoritos: resto };
    await escribirRegistro(cache, registro);
    await podarSiSePuede(cache, registro);
  }
  return { ok: true, urls: borradas.filter(Boolean).length };
}

/**
 * Rehace el censo con todos los favoritos que conoce la página y lo declara **completo**.
 *
 * Es lo que devuelve la poda al servicio después de una avería: mientras el registro esté incompleto
 * la caché crece sin límite, que es un problema menos grave que borrar lo que hace falta, pero un
 * problema. La página solo manda esto cuando tiene al menos un favorito — una IndexedDB desalojada
 * no es un censo vacío, es la ausencia de censo.
 */
async function censar(favoritos: Censo): Promise<{ ok: boolean; urls: number }> {
  const cache = await caches.open(PROTOCOLO.cachePaginas);
  const registro: Registro = { completo: true, favoritos };
  await escribirRegistro(cache, registro);
  await podarSiSePuede(cache, registro);
  return { ok: true, urls: Object.keys(favoritos).length };
}

/** Poda **solo** con un censo del que se sabe que están todos. La guardia vive en un único sitio. */
async function podarSiSePuede(cache: Cache, registro: Registro): Promise<void> {
  if (registro.completo) {
    await podarAssetsHuerfanos(cache, registro.favoritos);
  }
}

/**
 * Tira los assets con hash que **ya no necesita ningún favorito**.
 *
 * Sin poda la caché crecería una hoja de estilos y tres bundles por despliegue —un asset con hash
 * nunca se pisa, cambia de nombre— hasta que el navegador desalojara el origen entero, favoritos
 * incluidos. Con poda, y con un censo completo delante, se conserva exactamente la unión de lo que
 * piden los favoritos que hay: los assets del build de ayer se van cuando se va el último favorito
 * que los usaba, y ni un minuto antes.
 *
 * **Solo se llama desde `podarSiSePuede`.** No lleva guardia propia a propósito: repartir una
 * guardia entre dos sitios es cómo una de las dos mitades se queda sin ella en el siguiente
 * refactor, que es exactamente lo que ya pasó una vez en esta trayectoria.
 */
async function podarAssetsHuerfanos(cache: Cache, favoritos: Censo): Promise<void> {
  const conservar = new Set(Object.values(favoritos).flat());
  const claves = await cache.keys();
  await Promise.all(
    claves
      .filter((clave) => {
        const camino = new URL(clave.url).pathname;
        return camino.startsWith(PREFIJO_ASSETS) && !conservar.has(camino);
      })
      .map((clave) => cache.delete(clave)),
  );
}
