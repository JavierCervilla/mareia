/**
 * «Mareas de otro día»: **la promesa de T-12 puesta en pantalla**.
 *
 * Con el puerto guardado y sin cobertura, escribir una fecha aquí devuelve su tabla — calculada en
 * este navegador, con las constantes armónicas del puerto y el mismo motor de `@mareia/domain-core`
 * que usa el API. No es un caché de páginas: la página guardada es la del día que se guardó, y esto
 * es cualquier día.
 *
 * Las constantes se buscan **primero en IndexedDB** (que es lo que hay sin red) y solo si no están
 * se piden a la red. Cuando no hay ni una cosa ni la otra se dice cuál de las dos falta, que son dos
 * situaciones distintas: «no lo has guardado» se arregla guardándolo, «no hay red» esperando.
 *
 * Todo el texto se escribe con `textContent`. El marcado de la tabla es el mismo `.tabla-mareas` de
 * la tabla del día: la tabla de otro día no es otra cosa, es la misma tabla con otra fecha.
 *
 * **El motor se carga con `import()` dinámico**, y eso es una decisión medida: la tabla de
 * constituyentes y las correcciones nodales son ~70 kB, la mayor parte de todo el JavaScript del
 * sitio, y solo hacen falta cuando alguien pide un día. Sin el corte, esos 70 kB los bajaba todo el
 * que abriera un puerto. Lo que cuesta el corte está resuelto en `motorCargado`: al guardar un
 * favorito, la sección de arriba **precarga** el motor (`cliente/motor.ts`) para que la copia
 * offline lo incluya —si no, el trozo faltaría justo cuando no hay red para pedirlo.
 */

import type { EstacionOffline } from "../estacion-offline.ts";
import { fechaLarga, hora, metros } from "../../formato.ts";
import { leerFavorito } from "./almacen.ts";
import { estacionDeLaRed } from "./estacion.ts";
import { motorCargado } from "./motor.ts";

/** Lo que la sección construida en build le deja a este código. */
export interface AnclajeOtroDia {
  readonly formulario: HTMLFormElement;
  readonly campo: HTMLInputElement;
  readonly resultado: HTMLElement;
  readonly slug: string;
}

/** Nombre de cada tipo de extremo, igual que en `componentes/TablaDia.astro`. */
const NOMBRE = { high: "pleamar", low: "bajamar" } as const;

export function anclajeOtroDia(seccion: HTMLElement): AnclajeOtroDia | undefined {
  const formulario = seccion.querySelector("[data-otro-dia-form]");
  const campo = seccion.querySelector("[data-otro-dia-fecha]");
  const resultado = seccion.querySelector("[data-otro-dia-resultado]");
  const slug = seccion.dataset["otroDiaSlug"];
  if (
    !(formulario instanceof HTMLFormElement) ||
    !(campo instanceof HTMLInputElement) ||
    !(resultado instanceof HTMLElement) ||
    !slug
  ) {
    return undefined;
  }
  return { formulario, campo, resultado, slug };
}

/**
 * Monta la sección. El formulario viaja `hidden` en el HTML y se enseña aquí: sin JavaScript no
 * calcularía nada, y un formulario que no hace nada al pulsarlo es peor que no tenerlo.
 */
export function montarOtroDia(anclaje: AnclajeOtroDia): void {
  anclaje.formulario.hidden = false;
  anclaje.formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    void calcular(anclaje);
  });
}

/** Las constantes de este puerto, de donde las haya. Se recuerdan para no releer en cada consulta. */
const enMemoria = new Map<string, EstacionOffline>();

async function estacionDe(slug: string): Promise<EstacionOffline | undefined> {
  const recordada = enMemoria.get(slug);
  if (recordada !== undefined) {
    return recordada;
  }
  const favorito = await leerFavorito(slug);
  const estacion = favorito?.estacion ?? (await estacionDeLaRed(slug));
  if (estacion !== undefined) {
    enMemoria.set(slug, estacion);
  }
  return estacion;
}

async function calcular(anclaje: AnclajeOtroDia): Promise<void> {
  const fechaIso = anclaje.campo.value;
  if (fechaIso === "") {
    pintarAusencia(anclaje.resultado, "Elige un día para calcular sus mareas.");
    return;
  }
  const estacion = await estacionDe(anclaje.slug);
  if (estacion === undefined) {
    pintarAusencia(anclaje.resultado, sinConstantes());
    return;
  }
  const { diaOffline } = await motorCargado();
  const dia = diaOffline(estacion, fechaIso);
  if (!dia.ok) {
    pintarAusencia(anclaje.resultado, dia.motivo);
    return;
  }
  pintarDia(anclaje.resultado, estacion, dia.fechaIso, dia.eventos);
}

/**
 * Por qué no hay constantes con las que calcular. **Dos ausencias, no una**: sin red y sin guardar
 * es un problema; sin guardar pero con red es un fallo de descarga, y decirlo igual sería mentir
 * sobre qué tiene que hacer quien lee para arreglarlo.
 */
function sinConstantes(): string {
  return navigator.onLine === false
    ? "Sin conexión y sin este puerto guardado, no hay constantes con las que calcular. Guárdalo " +
        "arriba cuando vuelvas a tener cobertura y esto funcionará sin red."
    : "No se han podido traer las constantes de este puerto. Vuelve a intentarlo dentro de un rato.";
}

function pintarAusencia(destino: HTMLElement, motivo: string): void {
  const parrafo = document.createElement("p");
  parrafo.className = "otro-dia__ausencia";
  parrafo.textContent = motivo;
  destino.replaceChildren(parrafo);
}

/** La tabla del día pedido, con su procedencia debajo. */
function pintarDia(
  destino: HTMLElement,
  estacion: EstacionOffline,
  fechaIso: string,
  eventos: readonly { timeUtcMs: number; height_m: number; kind: "high" | "low" }[],
): void {
  const titulo = document.createElement("h3");
  titulo.className = "etiqueta";
  titulo.textContent = `Mareas del ${fechaLarga(fechaIso)}`;

  const tabla = document.createElement("table");
  tabla.className = "tabla-mareas";
  const cuerpo = document.createElement("tbody");
  if (eventos.length === 0) {
    cuerpo.append(filaVacia());
  }
  for (const evento of eventos) {
    cuerpo.append(fila(evento, estacion.puerto.timezone));
  }
  const leyenda = document.createElement("caption");
  leyenda.className = "solo-lectores";
  leyenda.textContent = `Mareas del ${fechaLarga(fechaIso)} en ${estacion.puerto.nombre}`;
  tabla.append(leyenda, cuerpo);

  const procedencia = document.createElement("p");
  procedencia.className = "otro-dia__procedencia";
  procedencia.textContent =
    `Calculado en este navegador con las constantes armónicas de ${estacion.estacion.name} ` +
    `(grade ${estacion.grade}), las mismas que usa el servidor. Horas en la hora local de ` +
    `${estacion.puerto.nombre} (${estacion.puerto.timezone}).`;

  destino.replaceChildren(titulo, tabla, procedencia);
}

function fila(
  evento: { timeUtcMs: number; height_m: number; kind: "high" | "low" },
  timezone: string,
): HTMLElement {
  const nombre = NOMBRE[evento.kind];
  const tr = document.createElement("tr");
  tr.dataset["tipo"] = nombre;
  const th = document.createElement("th");
  th.scope = "row";
  th.textContent = nombre;
  const horaCelda = document.createElement("td");
  horaCelda.className = "tabla-mareas__hora";
  horaCelda.textContent = hora(evento.timeUtcMs, timezone);
  const alturaCelda = document.createElement("td");
  alturaCelda.className = "tabla-mareas__altura";
  alturaCelda.textContent = metros(evento.height_m);
  tr.append(th, horaCelda, alturaCelda);
  return tr;
}

/** El mismo texto que la tabla del día cuando un día civil se queda sin extremos. */
function filaVacia(): HTMLElement {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.className = "tabla-mareas__vacia";
  td.colSpan = 3;
  td.textContent = "Ese día no hay ningún extremo de marea dentro del día civil de este puerto.";
  tr.append(td);
  return tr;
}
