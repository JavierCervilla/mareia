/**
 * La sección «sin cobertura» de la página de puerto, en el navegador.
 *
 * Aquí solo hay DOM y orquestación: **las frases las decide `pwa/vista-sin-red.ts`** y el
 * almacenamiento lo llevan `almacen.ts` (IndexedDB) y `worker.ts` (Cache API). Este fichero pega las
 * tres cosas y no toma ninguna decisión de producto por su cuenta, que es lo que permite testear los
 * cinco estados sin navegador.
 *
 * Como en la isla de T-11, **todo el texto se escribe con `textContent`**: nada de `innerHTML`.
 */

import { ventanaVigente } from "../estacion-offline.ts";
import type { EstacionOffline } from "../estacion-offline.ts";
import { urlsDeFavorito, urlsDeOlvido } from "../precacheo.ts";
import { EVENTO_COPIA_CAMBIADA, MENSAJE_GUARDAR, MENSAJE_OLVIDAR } from "../protocolo.ts";
import { vistaSinRed } from "../vista-sin-red.ts";
import type { VistaSinRed } from "../vista-sin-red.ts";
import { guardarFavorito, leerFavorito, olvidarFavorito } from "./almacen.ts";
import type { Favorito } from "./almacen.ts";
import { bajarEstacion } from "./estacion.ts";
import { motorCargado } from "./motor.ts";
import { haySoporteDeWorker, pedirAlWorker } from "./worker.ts";

/** Lo que la sección construida en build le deja a este código. */
export interface AnclajeSinRed {
  readonly seccion: HTMLElement;
  readonly sello: HTMLElement;
  /**
   * Región viva donde se anuncia el cambio de estado. Opcional a propósito, igual que en la isla
   * meteo: si un día falta en el HTML la sección se sigue montando —muda para el lector, que es
   * malo, pero no rota para todos, que sería peor.
   */
  readonly anuncio: HTMLElement | undefined;
  readonly boton: HTMLButtonElement;
  readonly nota: HTMLElement;
  readonly slug: string;
  readonly nombre: string;
  readonly ruta: string;
  readonly fechaDeBuild: string;
  /** Assets propios de los módulos activos, resueltos en build desde su `PrecachePolicy`. */
  readonly assetsDeModulos: readonly string[];
}

function elementoPorDato(raiz: HTMLElement, dato: string): HTMLElement | undefined {
  const encontrado = raiz.querySelector(`[${dato}]`);
  return encontrado instanceof HTMLElement ? encontrado : undefined;
}

/** Lee el anclaje, o `undefined` si le falta algo y no hay nada que montar. */
export function anclajeSinRed(seccion: HTMLElement): AnclajeSinRed | undefined {
  const sello = elementoPorDato(seccion, "data-sin-red-sello");
  const boton = seccion.querySelector("[data-sin-red-accion]");
  const nota = elementoPorDato(seccion, "data-sin-red-nota");
  const { sinRedSlug, sinRedNombre, sinRedRuta, sinRedFecha, sinRedAssetsModulos } = seccion.dataset;
  if (
    sello === undefined ||
    nota === undefined ||
    !(boton instanceof HTMLButtonElement) ||
    !sinRedSlug ||
    !sinRedNombre ||
    !sinRedRuta ||
    !sinRedFecha
  ) {
    return undefined;
  }
  return {
    seccion,
    sello,
    anuncio: elementoPorDato(seccion, "data-sin-red-anuncio"),
    boton,
    nota,
    slug: sinRedSlug,
    nombre: sinRedNombre,
    ruta: sinRedRuta,
    fechaDeBuild: sinRedFecha,
    assetsDeModulos: listaDeCadenas(sinRedAssetsModulos),
  };
}

/** Un atributo con una lista JSON de cadenas, o vacío si no lo es. No se cree lo que no entiende. */
function listaDeCadenas(crudo: string | undefined): readonly string[] {
  if (crudo === undefined) {
    return [];
  }
  try {
    const leido: unknown = JSON.parse(crudo);
    return Array.isArray(leido) ? leido.filter((cada): cada is string => typeof cada === "string") : [];
  } catch {
    return [];
  }
}

/** Prefijo de los ficheros con hash que emite Astro. Es lo único de la página que se guarda. */
const PREFIJO_ASSETS = "/_astro/";

/**
 * Los ficheros con hash que ESTA página necesita para pintarse.
 *
 * Se leen del documento y **también** de lo que el navegador ya ha descargado, y las dos fuentes
 * hacen falta. El `<link>` y el `<script src>` del HTML dan el CSS y los dos bundles de entrada; el
 * registro de recursos da además los **trozos cargados con `import()` dinámico** —el motor de
 * mareas—, que no aparecen en ninguna etiqueta del documento. Sin la segunda mitad, guardar un
 * favorito guardaría una página que al pedir otro día sin red se quedaría esperando un fichero que
 * nunca bajó.
 *
 * La página sabe de qué build es y qué ficheros usa; nadie más lo sabe, y por eso esta lista la
 * compone el cliente y no el build (ver `pwa/precacheo.ts`).
 *
 * **Solo mismo origen.** La hoja de tipografías es de Google y no se guarda: el respaldo Georgia del
 * design brief existe justo para eso.
 */
export function assetsDeLaPagina(documento: Document): readonly string[] {
  const delDocumento = [
    ...[...documento.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')].map(
      (enlace) => enlace.getAttribute("href") ?? "",
    ),
    ...[...documento.querySelectorAll<HTMLScriptElement>("script[src]")].map(
      (guion) => guion.getAttribute("src") ?? "",
    ),
  ];
  return [...new Set([...delDocumento, ...descargados()].filter(esAsset))];
}

/** Los recursos que el navegador ya ha traído de este origen, en camino absoluto. */
function descargados(): readonly string[] {
  return performance
    .getEntriesByType("resource")
    .map((recurso) => (URL.canParse(recurso.name) ? new URL(recurso.name) : undefined))
    .filter((url): url is URL => url !== undefined && url.origin === location.origin)
    .map((url) => url.pathname);
}

function esAsset(url: string): boolean {
  return url.startsWith(PREFIJO_ASSETS);
}

/** Monta la sección: pinta el estado actual y deja el botón y los avisos de red escuchando. */
export function montarSinRed(anclaje: AnclajeSinRed): void {
  const repintar = (): void => {
    void (async () => {
      await pintarEstado(anclaje);
      const favorito = await leerFavorito(anclaje.slug);
      if (favorito !== undefined) {
        await refrescarCopia(anclaje, favorito);
      }
    })();
  };
  anclaje.boton.addEventListener("click", () => {
    void alPulsar(anclaje);
  });
  // La red se va y vuelve sin recargar la página: el estado tiene que seguirla.
  window.addEventListener("online", repintar);
  window.addEventListener("offline", repintar);
  repintar();
}

/** Lee el estado real (¿guardado?, ¿hay red?) y lo pinta. */
async function pintarEstado(anclaje: AnclajeSinRed, nota?: string): Promise<void> {
  const favorito = await leerFavorito(anclaje.slug);
  pintar(anclaje, vistaDe(anclaje, favorito), nota);
}

/**
 * Con red y con el puerto guardado, comprueba si las constantes han cambiado y actualiza la copia.
 *
 * Hace falta porque el dataset **no es inmutable**: el pipeline corrige constantes —para eso
 * existe— y esa URL no lleva hash, así que sin esto un teléfono podría calcular durante meses con
 * las de antes bajo el rótulo «las mismas que usa el servidor». Va en segundo plano y en silencio:
 * si no hay red, o si lo que llega es igual, no pasa nada y no se toca la pantalla.
 */
async function refrescarCopia(anclaje: AnclajeSinRed, favorito: Favorito): Promise<void> {
  if (navigator.onLine === false) {
    return;
  }
  const fresca = await bajarEstacion(anclaje.slug);
  if (fresca === undefined || mismasConstantes(fresca.payload, favorito.estacion)) {
    return;
  }
  const guardado = await guardarFavorito({
    slug: anclaje.slug,
    // La copia es nueva, así que su edad vuelve a cero: decir «guardado hace tres semanas» sobre
    // unas constantes que se acaban de bajar sería el mismo defecto que el sello existe para evitar.
    guardadoEnMs: Date.now(),
    bytes: fresca.bytes,
    estacion: fresca.payload,
  });
  if (guardado) {
    await pintarEstado(anclaje);
    avisarDelCambio(anclaje.slug);
  }
}

/**
 * Avisa al resto de la página de que la copia guardada de este puerto ha cambiado.
 *
 * Lo escucha la calculadora, que deriva del payload guardado su ventana de años: sin este aviso, una
 * revalidación que trajera constantes de otro año dejaba el rótulo y los límites del campo hablando
 * de la copia anterior mientras el sello ya se había repintado. Falla al lado seguro —los límites
 * viejos son más estrechos o iguales— pero es la misma clase de deriva que R-2, y esa ya la hemos
 * pagado una vez.
 */
function avisarDelCambio(slug: string): void {
  document.dispatchEvent(new CustomEvent(EVENTO_COPIA_CAMBIADA, { detail: { slug } }));
}

/** Si dos payloads dicen lo mismo. Se compara el dato, no el `generadoEn`, que cambia cada día. */
function mismasConstantes(uno: EstacionOffline, otro: EstacionOffline): boolean {
  return JSON.stringify(uno.estacion) === JSON.stringify(otro.estacion);
}

function vistaDe(anclaje: AnclajeSinRed, favorito: Favorito | undefined): VistaSinRed {
  return vistaSinRed({
    copia:
      favorito === undefined
        ? undefined
        : { guardadoEnMs: favorito.guardadoEnMs, bytes: favorito.bytes },
    conexion: navigator.onLine !== false,
    sePuedeGuardar: haySoporteDeWorker() && "indexedDB" in globalThis,
    ahoraMs: Date.now(),
    nombre: anclaje.nombre,
    fechaDeBuild: anclaje.fechaDeBuild,
    // La ventana la manda **la copia guardada** cuando la hay, y la regla vive en un solo sitio
    // (`ventanaVigente`) porque derivarla por separado aquí y en la calculadora es cómo se acabaron
    // publicando dos frases que se contradecían en la misma pantalla.
    ventana: ventanaVigente(favorito?.estacion.generadoEn, anclaje.fechaDeBuild),
  });
}

/**
 * Lo último que se anunció, por sección.
 *
 * Existe por la lección H-7 de T-11: escribir la misma frase otra vez en una región viva la vuelve
 * a leer en voz alta, y esta sección se repinta cada vez que la red va y viene. Se anuncia el
 * cambio, no el estado; y **no se anuncia el primer pintado**, que sería cantarle a quien abre la
 * página algo que ya está escrito delante.
 */
const anunciado = new WeakMap<HTMLElement, string>();

/** Anuncia el estado a quien no ve la pantalla, y solo cuando cambia. */
function anunciar(anclaje: AnclajeSinRed, titular: string): void {
  const previo = anunciado.get(anclaje.seccion);
  anunciado.set(anclaje.seccion, titular);
  if (anclaje.anuncio !== undefined && previo !== undefined && previo !== titular) {
    anclaje.anuncio.textContent = titular;
  }
}

/** Vuelca la vista sobre la sección. */
function pintar(anclaje: AnclajeSinRed, vista: VistaSinRed, nota: string | undefined): void {
  anclaje.sello.className = `sin-red__sello sin-red__sello--${vista.sello.clase}`;
  anclaje.sello.replaceChildren(texto("strong", "sin-red__titular", vista.sello.titular));
  if (vista.sello.detalle !== undefined) {
    anclaje.sello.append(texto("span", "sin-red__detalle", vista.sello.detalle));
  }
  anclaje.boton.hidden = vista.accion === undefined;
  anclaje.boton.disabled = false;
  if (vista.accion !== undefined) {
    anclaje.boton.textContent = vista.accion.etiqueta;
    anclaje.boton.dataset["sinRedVerbo"] = vista.accion.verbo;
  }
  anclaje.nota.hidden = nota === undefined;
  anclaje.nota.textContent = nota ?? "";
  anunciar(anclaje, vista.sello.titular);
}

function texto(etiqueta: string, clase: string, contenido: string): HTMLElement {
  const nodo = document.createElement(etiqueta);
  nodo.className = clase;
  nodo.textContent = contenido;
  return nodo;
}

/** El clic: guardar o olvidar, según lo que el último pintado dejara declarado en el botón. */
async function alPulsar(anclaje: AnclajeSinRed): Promise<void> {
  const verbo = anclaje.boton.dataset["sinRedVerbo"];
  anclaje.boton.disabled = true;
  anclaje.boton.textContent = verbo === "olvidar" ? "Borrando…" : "Guardando…";
  const nota = verbo === "olvidar" ? await olvidar(anclaje) : await guardar(anclaje);
  await pintarEstado(anclaje, nota);
  avisarDelCambio(anclaje.slug);
}

/**
 * Guarda el puerto: las constantes a IndexedDB y los bytes de la página al service worker.
 *
 * El orden importa. Primero se **bajan y validan** las constantes, porque son lo que hace posible
 * calcular otro día y porque si el JSON no es lo que dice ser vale más no guardar nada. Después se
 * le pide al worker que guarde la página. Si esto último falla, el favorito se queda igualmente
 * —el cálculo funciona— y se dice exactamente qué es lo que no va a funcionar.
 */
async function guardar(anclaje: AnclajeSinRed): Promise<string | undefined> {
  // Antes de nada, el motor: es un trozo que se carga con `import()` dinámico y solo se puede
  // guardar lo que ya está descargado. Guardar el puerto sin él dejaría la página abriéndose sin
  // red pero incapaz de calcular otro día, que es la mitad de lo que se acaba de prometer.
  await motorCargado();
  const estacion = await bajarEstacion(anclaje.slug);
  if (estacion === undefined) {
    return (
      "No se han podido bajar las constantes de este puerto, así que no se ha guardado nada. " +
      "Inténtalo con mejor cobertura."
    );
  }
  const guardado = await guardarFavorito({
    slug: anclaje.slug,
    guardadoEnMs: Date.now(),
    bytes: estacion.bytes,
    estacion: estacion.payload,
  });
  if (!guardado) {
    return "Este navegador no ha dejado guardar el puerto en su almacenamiento local.";
  }
  const respuesta = await pedirAlWorker({
    tipo: MENSAJE_GUARDAR,
    slug: anclaje.slug,
    urls: urlsDeFavorito(
      { slug: anclaje.slug, ruta: anclaje.ruta },
      assetsDeLaPagina(document),
      anclaje.assetsDeModulos,
    ),
  });
  return respuesta.ok
    ? undefined
    : `Las constantes ya están guardadas y podrás calcular días sin red, pero la página en sí no: ${
        respuesta.motivo ?? "el guardado sin red no ha podido completarse."
      }`;
}

/** Olvida el puerto: se borra de las dos partes, y se dice si alguna se resistió. */
async function olvidar(anclaje: AnclajeSinRed): Promise<string | undefined> {
  const borrado = await olvidarFavorito(anclaje.slug);
  const respuesta = await pedirAlWorker({
    tipo: MENSAJE_OLVIDAR,
    slug: anclaje.slug,
    urls: urlsDeOlvido({ slug: anclaje.slug, ruta: anclaje.ruta }),
  });
  if (borrado && respuesta.ok) {
    return undefined;
  }
  return "Se ha borrado lo que se ha podido; puede quedar algo en el almacenamiento del navegador.";
}
