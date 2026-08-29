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

import { ventanaVigente } from "../estacion-offline.ts";
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
  /** El «entre 2025 y 2027» del texto, para poder corregirlo cuando manda la copia guardada. */
  readonly ventana: HTMLElement | undefined;
  readonly slug: string;
  /** Día que publica esta página: la ventana de reserva mientras no haya nada guardado. */
  readonly fechaDeBuild: string;
}

/** Nombre de cada tipo de extremo, igual que en `componentes/TablaDia.astro`. */
const NOMBRE = { high: "pleamar", low: "bajamar" } as const;

export function anclajeOtroDia(seccion: HTMLElement): AnclajeOtroDia | undefined {
  const formulario = seccion.querySelector("[data-otro-dia-form]");
  const campo = seccion.querySelector("[data-otro-dia-fecha]");
  const resultado = seccion.querySelector("[data-otro-dia-resultado]");
  const slug = seccion.dataset["otroDiaSlug"];
  const fechaDeBuild = seccion.dataset["otroDiaBuild"];
  if (
    !(formulario instanceof HTMLFormElement) ||
    !(campo instanceof HTMLInputElement) ||
    !(resultado instanceof HTMLElement) ||
    !slug ||
    !fechaDeBuild
  ) {
    return undefined;
  }
  const ventana = seccion.querySelector("[data-otro-dia-ventana]");
  return {
    formulario,
    campo,
    resultado,
    ventana: ventana instanceof HTMLElement ? ventana : undefined,
    slug,
    fechaDeBuild,
  };
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
  void ajustarVentana(anclaje);
}

/**
 * Pone los límites del campo y el rótulo en la ventana de **la copia guardada**.
 *
 * El HTML los trae con la ventana del build, que es la correcta mientras no haya nada guardado. En
 * cuanto lo hay mandan las constantes guardadas: se congelaron el día que se guardaron y la página
 * se reconstruye a diario, así que en cuanto cruza un año nuevo la página prometería un año que la
 * calculadora rechaza — con el propio campo dejando elegir la fecha que luego no acepta.
 */
async function ajustarVentana(anclaje: AnclajeOtroDia): Promise<void> {
  const favorito = await leerFavorito(anclaje.slug);
  const { desde, hasta } = ventanaVigente(favorito?.estacion.generadoEn, anclaje.fechaDeBuild);
  anclaje.campo.min = `${desde}-01-01`;
  anclaje.campo.max = `${hasta}-12-31`;
  if (anclaje.ventana !== undefined) {
    anclaje.ventana.textContent = `${desde} y ${hasta}`;
  }
}

/**
 * Las constantes de este puerto, de donde las haya: primero la copia guardada (que es lo que hay sin
 * red) y, si no está, la red.
 *
 * **No se memoriza en una variable de módulo.** La copia guardada se pone al día sola cuando hay
 * cobertura (`cliente/sin-red.ts`), y un `Map` de por vida en la pestaña dejaría el cálculo pegado a
 * las constantes que se leyeron al abrir — o sea, tapando justo el refresco que se acaba de añadir.
 * Leer de IndexedDB cuesta milisegundos y se hace una vez por consulta.
 */
async function estacionDe(slug: string): Promise<EstacionOffline | undefined> {
  const favorito = await leerFavorito(slug);
  return favorito?.estacion ?? (await estacionDeLaRed(slug));
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
  pintarDia(anclaje.resultado, estacion, dia);
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

/** Horas que dura un día normal. Las dos noches del cambio de hora no son días normales. */
const HORAS_DE_UN_DIA = 24;
const MS_POR_HORA = 3_600_000;

/**
 * La coletilla de un día que no dura 24 h, o cadena vacía.
 *
 * No es un detalle de trivia: en la noche del cambio de hora la tabla tiene una hora de menos (o de
 * más) que las demás, y quien la compare con otra fuente tiene derecho a saber por qué.
 */
function avisoDelDiaCorto(dia: { readonly inicioUtcMs: number; readonly finUtcMs: number }): string {
  const horas = (dia.finUtcMs - dia.inicioUtcMs) / MS_POR_HORA;
  return horas === HORAS_DE_UN_DIA
    ? ""
    : ` Ese día dura ${horas} h en la hora local del puerto: es la noche en la que cambia la hora.`;
}

/** La tabla del día pedido, con su procedencia debajo. */
function pintarDia(
  destino: HTMLElement,
  estacion: EstacionOffline,
  dia: {
    readonly fechaIso: string;
    readonly eventos: readonly { timeUtcMs: number; height_m: number; kind: "high" | "low" }[];
    readonly inicioUtcMs: number;
    readonly finUtcMs: number;
  },
): void {
  const { fechaIso, eventos } = dia;
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
    `${estacion.puerto.nombre} (${estacion.puerto.timezone}).${avisoDelDiaCorto(dia)}`;

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
