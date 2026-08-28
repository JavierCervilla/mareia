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
 * - **Los dos endpoints se piden por separado y fallan por separado.** Que AEMET no conteste no
 *   puede dejar sin viento a quien mira la página; cada bloque trae su propio estado.
 * - **No se reintenta ni se refresca solo.** Un reintento automático convertiría una caída del API
 *   en una tormenta de peticiones desde todos los móviles abiertos, y un auto-refresco haría
 *   envejecer la página sin que nadie lo pidiera. Si el dato interesa más nuevo, se recarga.
 */

import type { BulletinPayload, WeatherPayload } from "@mareia/module-weather/ui";

import type { BloqueMeteo, CitaOficial, FilaMeteo, Traida, VistaMeteo } from "../vista.ts";
import { vistaMeteo } from "../vista.ts";

/** Atributos que la sección construida en build le deja a la isla. */
interface Anclaje {
  readonly seccion: HTMLElement;
  readonly aviso: HTMLElement;
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
  return { seccion, aviso, bloques, base: seccion.dataset["meteoApi"] ?? "", puerto, zona };
}

/**
 * Pide un endpoint del módulo y **nunca lanza**: un fallo de red es un estado de la sección, no una
 * excepción. El motivo que devuelve habla de *nuestro* servidor, no de Open-Meteo ni de AEMET: si
 * la petición no llegó a salir, atribuirle el fallo a la fuente sería inventar un diagnóstico.
 */
async function traer<T>(url: string, que: string): Promise<Traida<T>> {
  try {
    const respuesta = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    if (!respuesta.ok) {
      return {
        ok: false,
        motivo: `El servidor de Mareia no ha servido ${que} (HTTP ${respuesta.status}).`,
      };
    }
    return { ok: true, cuerpo: (await respuesta.json()) as T };
  } catch {
    return { ok: false, motivo: `No se ha podido pedir ${que} al servidor de Mareia.` };
  }
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

/** Vuelca la vista sobre la sección, sustituyendo lo que hubiera. */
function pintar(anclaje: Anclaje, vista: VistaMeteo): void {
  anclaje.bloques.replaceChildren(...vista.bloques.map(pintarBloque));
  anclaje.bloques.hidden = false;
  anclaje.seccion.setAttribute("aria-busy", "false");
  if (vista.resumen === undefined) {
    anclaje.aviso.hidden = true;
    anclaje.aviso.replaceChildren();
    return;
  }
  anclaje.aviso.hidden = false;
  anclaje.aviso.className = "meteo__sello meteo__sello--sin-dato";
  anclaje.aviso.replaceChildren(texto("strong", "meteo__sello-titular", vista.resumen));
}

/** Mientras se espera al API: se dice que se está pidiendo, no se deja el hueco de antes. */
function anunciarPeticion(anclaje: Anclaje): void {
  anclaje.seccion.setAttribute("aria-busy", "true");
  anclaje.aviso.replaceChildren(
    texto("strong", "meteo__sello-titular", "Pidiendo el estado del mar…"),
  );
}

async function montarSeccion(anclaje: Anclaje): Promise<void> {
  const ruta = (endpoint: string): string =>
    `${anclaje.base}/v1/modules/weather/${endpoint}?port=${encodeURIComponent(anclaje.puerto)}`;

  anunciarPeticion(anclaje);
  const [meteo, boletin] = await Promise.all([
    traer<WeatherPayload>(ruta("weather"), "el estado del mar"),
    traer<BulletinPayload>(ruta("bulletin"), "el boletín de AEMET"),
  ]);
  // `recibidoEnMs` es el instante en que llegaron las respuestas: a partir de aquí la edad del dato
  // se mide como intervalo desde este punto (ver la regla 2 de `vista.ts`).
  const recibidoEnMs = Date.now();
  pintar(anclaje, vistaMeteo({ meteo, boletin, recibidoEnMs }, Date.now(), anclaje.zona));
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
      void montarSeccion(anclaje);
    }
  }
}
