/**
 * La isla meteo: el **único** JavaScript de cliente de una página de puerto.
 *
 * Por qué existe está escrito en `docs/adr/ADR-01`: el HTML se construye una vez al día y el estado
 * del mar caduca en media hora, así que la meteo no viaja dentro de la página —viajaría vieja y sin
 * poder decir cuánto—, la pide el navegador al abrirla. Lo que sale de `dist/` es el estado «todavía
 * no ha llegado», y este fichero lo sustituye por el dato **con su sello de antigüedad**.
 *
 * Tres decisiones que no son de estilo:
 *
 * - **Todo el texto se escribe con `textContent`, nunca con `innerHTML`.** El boletín de AEMET es
 *   texto de un tercero que ni siquiera tiene esquema verificado: si algún día trae `<script>`, aquí
 *   se lee como lo que es, caracteres. Es el mismo cuidado que el core resuelve con el escapado de
 *   Astro (`escapar-marcado.ts`), aplicado al único sitio de la web donde el marcado se genera en el
 *   navegador.
 * - **Los dos endpoints se piden por separado, fallan por separado y se PINTAN por separado.** Que
 *   AEMET no conteste no puede dejar sin viento a quien mira la página; cada bloque trae su propio
 *   estado y aparece en cuanto llega el suyo, sin esperar al otro (lo tercero lo aprendimos por las
 *   malas: hasta T-11 se pedían por separado pero se pintaban juntos, y el mar ya descargado se
 *   quedaba de rehén del boletín hasta 8 s).
 * - **No se reintenta ni se refresca solo.** Un reintento automático convertiría una caída del API
 *   en una tormenta de peticiones desde todos los móviles abiertos, y un auto-refresco haría
 *   envejecer la página sin que nadie lo pidiera. Si el dato interesa más nuevo, se recarga.
 */

import type { BulletinPayload, WeatherPayload } from "@mareia/module-weather/ui";

import { esRespuestaDeBoletin, esRespuestaDeMeteo } from "../contrato.ts";
import type {
  BloqueMeteo,
  CitaOficial,
  EstadoDeFuente,
  FilaMeteo,
  Traida,
  VistaMeteo,
} from "../vista.ts";
import { PIDIENDO, anuncioDeLaSeccion, vistaMeteo } from "../vista.ts";

/** Atributos que la sección construida en build le deja a la isla. */
interface Anclaje {
  readonly seccion: HTMLElement;
  readonly aviso: HTMLElement;
  /** La región viva donde se anuncia el cambio de estado (`role="status"`). */
  readonly anuncio: HTMLElement | undefined;
  readonly bloques: HTMLElement;
  readonly base: string;
  readonly puerto: string;
  readonly zona: string;
}

/** Cuánto se espera a cada endpoint antes de darlo por perdido y decirlo. */
const ESPERA_MS = 8_000;

function elementoPorDato(raiz: HTMLElement, dato: string): HTMLElement | undefined {
  const encontrado = raiz.querySelector(`[${dato}]`);
  return encontrado instanceof HTMLElement ? encontrado : undefined;
}

/** Lee el anclaje de una sección meteo, o `undefined` si le falta algo y no hay nada que montar. */
function anclajeDe(seccion: HTMLElement): Anclaje | undefined {
  const aviso = elementoPorDato(seccion, "data-meteo-aviso");
  const bloques = elementoPorDato(seccion, "data-meteo-bloques");
  const puerto = seccion.dataset["meteoPuerto"];
  const zona = seccion.dataset["meteoZona"];
  if (aviso === undefined || bloques === undefined || !puerto || !zona) {
    return undefined;
  }
  return {
    seccion,
    aviso,
    // La región viva es opcional a propósito: si un día falta en el HTML, la sección se sigue
    // montando (muda para el lector, que es peor, pero no rota para todos, que sería peor aún).
    anuncio: elementoPorDato(seccion, "data-meteo-anuncio"),
    bloques,
    base: seccion.dataset["meteoApi"] ?? "",
    puerto,
    zona,
  };
}

/**
 * «de» + un rótulo que empieza por «el» es «del», no «de el». Los rótulos llevan el artículo porque
 * las otras dos frases lo necesitan («no se ha podido pedir **el** boletín»), así que la
 * contracción se resuelve aquí en vez de partir el rótulo y dejar que cada frase lo recomponga.
 */
function de(que: string): string {
  return que.startsWith("el ") ? `del ${que.slice(3)}` : `de ${que}`;
}


/**
 * Pide un endpoint del módulo y **nunca lanza**: un fallo de red es un estado de la sección, no una
 * excepción. El motivo que devuelve habla de *nuestro* servidor, no de Open-Meteo ni de AEMET: si
 * la petición no llegó a salir, atribuirle el fallo a la fuente sería inventar un diagnóstico.
 *
 * Hay **cuatro** formas de volver sin dato y cada una lo dice con sus palabras, porque son cuatro
 * averías distintas y quien lee la página no puede confundirlas (es la lección del hallazgo A-11
 * del pase de T-09, y el hallazgo H-6 del de T-11: el 200 ilegible y el API caído publicaban una
 * frase idéntica carácter por carácter, aunque en un caso el servidor contestó y en el otro el
 * navegador ni siquiera pudo preguntar):
 *
 *   1. la petición no sale (red caída, timeout) → «no se ha podido pedir»;
 *   2. el servidor contesta un estado que no es 2xx → «no ha servido … (HTTP nnn)»;
 *   3. contesta 2xx con un cuerpo que no es JSON → «su respuesta no se puede leer»;
 *   4. contesta 2xx con JSON que no tiene la forma del contrato → «no la sabe leer esta página».
 *
 * El `valido` de la 4 es lo que impide el hallazgo H-2: sin él, un 200 con el cuerpo cambiado
 * entraba en la vista y la reventaba a media sección.
 */
async function traer<T>(
  url: string,
  que: string,
  valido: (cuerpo: unknown) => cuerpo is T,
): Promise<Traida<T>> {
  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(ESPERA_MS),
    });
  } catch {
    return { ok: false, motivo: `No se ha podido pedir ${que} al servidor de Mareia.` };
  }
  if (!respuesta.ok) {
    return {
      ok: false,
      motivo: `El servidor de Mareia no ha servido ${que} (HTTP ${respuesta.status}).`,
    };
  }
  // El `json()` va en su propio `try`: si comparte el del `fetch`, un cuerpo ilegible se cuenta
  // como una petición que no salió, que es exactamente lo que confundía las dos ausencias.
  let cuerpo: unknown;
  try {
    cuerpo = await respuesta.json();
  } catch {
    return {
      ok: false,
      motivo: `El servidor de Mareia contestó a la petición ${de(que)}, pero su respuesta no se puede leer: no es JSON.`,
    };
  }
  if (!valido(cuerpo)) {
    return {
      ok: false,
      motivo: `El servidor de Mareia contestó a la petición ${de(que)}, pero su respuesta no tiene la forma que esta página sabe leer.`,
    };
  }
  return { ok: true, cuerpo };
}

function texto(etiqueta: string, clase: string, contenido: string): HTMLElement {
  const nodo = document.createElement(etiqueta);
  nodo.className = clase;
  nodo.textContent = contenido;
  return nodo;
}

/** El sello de antigüedad del bloque: lo primero que se lee y lo que no se puede omitir. */
function pintarSello(bloque: BloqueMeteo): HTMLElement {
  const sello = document.createElement("p");
  sello.className = `meteo__sello meteo__sello--${bloque.sello.clase}`;
  sello.append(texto("strong", "meteo__sello-titular", bloque.sello.titular));
  if (bloque.sello.detalle !== undefined) {
    sello.append(texto("span", "meteo__sello-detalle", bloque.sello.detalle));
  }
  return sello;
}

/** Una fila: o el valor con su acompañante, o la razón exacta de que no lo haya. */
function pintarFila(fila: FilaMeteo): HTMLElement {
  const nodo = document.createElement("p");
  nodo.className = "datos__fila";
  nodo.append(texto("span", "", fila.titulo));
  const valor = document.createElement("span");
  valor.className = "datos__valor";
  if (fila.valor === undefined) {
    valor.append(texto("em", "meteo__ausencia", fila.ausencia ?? ""));
  } else {
    valor.append(document.createTextNode(fila.valor));
    if (fila.detalle !== undefined) {
      valor.append(texto("span", "datos__nota", ` ${fila.detalle}`));
    }
  }
  nodo.append(valor);
  return nodo;
}

/** El boletín, citado: `<blockquote>` con su rótulo por párrafo y su autoría al pie. */
function pintarCita(cita: CitaOficial): HTMLElement {
  const bloque = document.createElement("blockquote");
  bloque.className = "meteo__cita";
  for (const parrafo of cita.parrafos) {
    const linea = document.createElement("p");
    linea.append(texto("span", "meteo__cita-rotulo", parrafo.rotulo));
    linea.append(document.createTextNode(parrafo.texto));
    bloque.append(linea);
  }
  bloque.append(texto("footer", "meteo__cita-pie", cita.pie));
  return bloque;
}

function pintarBloque(bloque: BloqueMeteo): HTMLElement {
  const nodo = document.createElement("article");
  nodo.className = "meteo__bloque";
  nodo.id = bloque.id;
  const titulo = texto("h3", "etiqueta", bloque.titulo);
  titulo.id = `titulo-${bloque.id}`;
  nodo.setAttribute("aria-labelledby", titulo.id);
  nodo.append(titulo, pintarSello(bloque));

  if (bloque.filas.length > 0) {
    const datos = document.createElement("div");
    datos.className = "datos";
    for (const fila of bloque.filas) {
      datos.append(pintarFila(fila));
    }
    nodo.append(datos);
  }
  if (bloque.cita !== undefined && bloque.cita.parrafos.length > 0) {
    nodo.append(pintarCita(bloque.cita));
  }
  if (bloque.nota !== undefined) {
    nodo.append(texto("p", "meteo__nota", bloque.nota));
  }
  return nodo;
}

/**
 * Anuncia el estado de la sección a quien navega con lector de pantalla, y **solo cuando cambia**:
 * escribir la misma frase otra vez en una región viva la vuelve a leer en voz alta, y el latido del
 * sello pasa por aquí cada medio minuto.
 */
function anunciar(anclaje: Anclaje, vista: VistaMeteo): void {
  const frase = anuncioDeLaSeccion(vista);
  if (anclaje.anuncio !== undefined && anclaje.anuncio.textContent !== frase) {
    anclaje.anuncio.textContent = frase;
  }
}

/** Vuelca la vista sobre la sección, sustituyendo lo que hubiera. */
function pintar(anclaje: Anclaje, vista: VistaMeteo): void {
  anclaje.bloques.replaceChildren(...vista.bloques.map(pintarBloque));
  anclaje.bloques.hidden = false;
  anunciar(anclaje, vista);
  if (vista.resumen === undefined) {
    anclaje.aviso.hidden = true;
    anclaje.aviso.replaceChildren();
    return;
  }
  anclaje.aviso.hidden = false;
  anclaje.aviso.className = "meteo__sello meteo__sello--sin-dato";
  anclaje.aviso.replaceChildren(texto("strong", "meteo__sello-titular", vista.resumen));
}

/**
 * Vuelve a sellar los bloques ya pintados, sin tocar nada más.
 *
 * Es el latido de la edad (H-1): cada bloque cambia SU sello sólo cuando el texto o el tono han
 * cambiado de verdad. No se repinta la sección entera —eso tiraría cada minuto la cita del boletín
 * y la selección de quien esté leyéndola— y no se toca el DOM cuando no hay nada que decir, que en
 * una página abierta durante horas es la inmensa mayoría de las veces.
 */
function resellar(anclaje: Anclaje, vista: VistaMeteo): void {
  for (const bloque of vista.bloques) {
    const viejo = anclaje.bloques.querySelector(`#${bloque.id} > .meteo__sello`);
    if (viejo === null) {
      continue;
    }
    const nuevo = pintarSello(bloque);
    if (viejo.className !== nuevo.className || viejo.textContent !== nuevo.textContent) {
      viejo.replaceWith(nuevo);
    }
  }
  // Un dato que cruza su ventana de frescura con la página abierta es una noticia, y quien no ve
  // la pantalla también tiene derecho a enterarse.
  anunciar(anclaje, vista);
}

/**
 * Cada cuánto se vuelve a mirar la edad del dato con la página abierta.
 *
 * Medio minuto: la edad se escribe al minuto («12 minutos», «3 h 10 min»), así que con este paso el
 * rótulo nunca va más de 30 s por detrás de la verdad, y es un temporizador que no despierta la
 * CPU cada segundo en un móvil que va a estar horas en el bolsillo. Lo caro no es el latido, es
 * repintar: por eso `resellar` sólo toca el DOM cuando el sello cambia.
 */
const LATIDO_MS = 30_000;

/**
 * Mantiene viva la edad mientras la página lo esté. Tres disparadores, y ninguno sobra:
 *
 * - **el temporizador**, para la pestaña abierta y a la vista;
 * - **`visibilitychange`**, porque el navegador estrangula (y a veces congela) los temporizadores
 *   de una pestaña en segundo plano: al volver, el rótulo puede llevar horas sin actualizarse y hay
 *   que ponerlo al día ANTES de que lo lea nadie, no en el siguiente latido;
 * - **`pageshow` con `persisted`**, porque en el bfcache la página se congela entera —temporizadores
 *   incluidos— y vuelve intacta al pulsar «atrás»: sin esto, volver a la pestaña de la playa
 *   enseñaría el sello exacto que se pintó ayer.
 *
 * Lo que **no** se hace es volver a pedir el dato solo. Un auto-refresco convertiría una caída del
 * API en una tormenta de peticiones desde todos los móviles abiertos, y ADR-01 ya decidió que no.
 * Envejecer el sello es honesto y gratis; refrescar el dato lo pide quien lee, recargando.
 */
function mantenerVivoElSello(refrescar: () => void): void {
  setInterval(refrescar, LATIDO_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refrescar();
    }
  });
  window.addEventListener("pageshow", () => {
    refrescar();
  });
}

/**
 * Lo que la sección sabe de sus dos endpoints en un instante dado. Es mutable a propósito: cada
 * respuesta que llega anota lo suyo y repinta, sin esperar a la otra.
 */
interface EstadoDeLaSeccion {
  meteo: EstadoDeFuente<WeatherPayload>;
  boletin: EstadoDeFuente<BulletinPayload>;
  /** Instante en que llegó la PRIMERA respuesta; `undefined` mientras no ha llegado ninguna. */
  recibidoEnMs: number | undefined;
}

/**
 * Monta la sección **pintando cada endpoint en cuanto llega**, no cuando llegan los dos.
 *
 * Antes había un `Promise.all` de los dos y no se tocaba el DOM hasta que resolvían ambos, lo que
 * dejaba el estado del mar —ya descargado en el navegador— de rehén del boletín de AEMET, que es el
 * endpoint lento del par (fuente ajena, caché de horas): hasta 8 s mirando un hueco con el dato ya
 * en la máquina (hallazgo H-3). La cabecera de este fichero decía que los dos endpoints «fallan por
 * separado»; ahora también **se pintan** por separado.
 *
 * El primer pintado es el esqueleto: los tres bloques diciendo qué se está pidiendo. Así la sección
 * nunca está en un estado que no sea uno de los suyos, ni siquiera durante la espera.
 */
async function montarSeccion(anclaje: Anclaje): Promise<void> {
  const ruta = (endpoint: string): string =>
    `${anclaje.base}/v1/modules/weather/${endpoint}?port=${encodeURIComponent(anclaje.puerto)}`;

  const estado: EstadoDeLaSeccion = {
    meteo: PIDIENDO,
    boletin: PIDIENDO,
    recibidoEnMs: undefined,
  };
  const repintar = (): void => {
    pintar(anclaje, vistaDelEstado(estado, anclaje.zona));
  };

  anclaje.seccion.setAttribute("aria-busy", "true");
  repintar();
  mantenerVivoElSello(() => {
    resellar(anclaje, vistaDelEstado(estado, anclaje.zona));
  });
  await Promise.all([
    traer(ruta("weather"), "el estado del mar", esRespuestaDeMeteo).then((traida) => {
      estado.meteo = traida;
      // La edad se mide desde que llegó la primera respuesta (ver `RespuestaMeteo.recibidoEnMs`).
      estado.recibidoEnMs ??= Date.now();
      repintar();
    }),
    traer(ruta("bulletin"), "el boletín de AEMET", esRespuestaDeBoletin).then((traida) => {
      estado.boletin = traida;
      estado.recibidoEnMs ??= Date.now();
      repintar();
    }),
  ]);
  anclaje.seccion.setAttribute("aria-busy", "false");
}

/** La vista de este instante: la edad se recalcula en cada pintado, nunca se guarda hecha. */
function vistaDelEstado(estado: EstadoDeLaSeccion, zona: string): VistaMeteo {
  const ahoraMs = Date.now();
  return vistaMeteo(
    {
      meteo: estado.meteo,
      boletin: estado.boletin,
      recibidoEnMs: estado.recibidoEnMs ?? ahoraMs,
    },
    ahoraMs,
    zona,
  );
}

/**
 * La red de seguridad: si montar la sección lanza pese a todo, se dice.
 *
 * `montarSeccion` es una promesa que nadie espera, así que una excepción suya no la ve nadie y la
 * sección se quedaba anunciándose ocupada para siempre (hallazgo H-2). Que el error sea imprevisto
 * no lo convierte en un quinto estado: se cierra el `aria-busy` y se publica la única ausencia
 * honesta que cabe aquí —«la página no ha podido pintarlo»—, sin volcar el error en la pantalla
 * (va a la consola, que es donde lo lee quien puede arreglarlo).
 */
function avisarDelFalloAlPintar(anclaje: Anclaje, fallo: unknown): void {
  console.error("[meteo] la isla no ha podido pintar la sección", fallo);
  anclaje.seccion.setAttribute("aria-busy", "false");
  anclaje.bloques.replaceChildren();
  anclaje.bloques.hidden = true;
  anclaje.aviso.hidden = false;
  anclaje.aviso.className = "meteo__sello meteo__sello--sin-dato";
  anclaje.aviso.replaceChildren(
    texto("strong", "meteo__sello-titular", "No se ha podido enseñar el estado del mar"),
    texto(
      "span",
      "meteo__sello-detalle",
      "Esta página no ha conseguido pintar la sección en este navegador. El resto de la página " +
        "—mareas, curva, sol y luna— no depende de ella y está completo.",
    ),
  );
}

/**
 * Monta todas las secciones meteo del documento. Idempotente y silenciosa si no hay ninguna: la
 * página de puerto puede construirse sin el módulo (basta borrar su línea del registry) y entonces
 * este script ni siquiera se incluye en el bundle.
 */
export function montarIslaMeteo(): void {
  for (const nodo of document.querySelectorAll("[data-meteo-puerto]")) {
    if (!(nodo instanceof HTMLElement)) {
      continue;
    }
    const anclaje = anclajeDe(nodo);
    if (anclaje !== undefined) {
      void montarSeccion(anclaje).catch((fallo: unknown) => {
        avisarDelFalloAlPintar(anclaje, fallo);
      });
    }
  }
}
