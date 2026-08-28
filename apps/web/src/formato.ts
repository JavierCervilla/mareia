/**
 * Cómo se escriben los números y las horas en la página, en castellano y una sola vez.
 *
 * Dos reglas que no son cosméticas:
 *
 * 1. **La coma decimal es la coma** («4,82 m», no «4.82 m»). Un punto decimal en una tabla de
 *    mareas española se lee como separador de millar y cambia el dato.
 * 2. **Toda hora se proyecta a la zona del puerto** (`Europe/Madrid`, `Atlantic/Canary`). El
 *    dominio trabaja en UTC y los DTO viajan en UTC; la conversión a hora local ocurre aquí, en el
 *    borde, y con la zona que trae el propio puerto — no con la del servidor que construye el
 *    sitio, que en CI es UTC y en un portátil cualquier cosa.
 */

const LOCALE = "es-ES";

/** Formateadores de hora por zona: crear un `Intl.DateTimeFormat` por celda de tabla es caro. */
const horas = new Map<string, Intl.DateTimeFormat>();

function formateadorDeHora(timeZone: string): Intl.DateTimeFormat {
  const cacheada = horas.get(timeZone);
  if (cacheada !== undefined) {
    return cacheada;
  }
  const formateador = new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  horas.set(timeZone, formateador);
  return formateador;
}

/** `HH:MM` en la zona del puerto. */
export function hora(timeUtcMs: number, timeZone: string): string {
  return formateadorDeHora(timeZone).format(new Date(timeUtcMs));
}

/** Un número con coma decimal y los decimales pedidos. */
export function numero(valor: number, decimales = 2): string {
  return valor.toFixed(decimales).replace(".", ",");
}

/** Una altura de marea, con su unidad. */
export function metros(valor: number, decimales = 2): string {
  return `${numero(valor, decimales)} m`;
}

/**
 * Una altura pequeña en centímetros enteros: «24 cm».
 *
 * Los centímetros son la unidad en la que se lee una marea micromareal — «0,24 m» obliga a contar
 * decimales para entender que ahí no sube nada.
 */
export function centimetros(valorEnMetros: number): string {
  return `${Math.round(valorEnMetros * 100)} cm`;
}

/** Un ángulo en grados, redondeado al grado. */
export function grados(valor: number): string {
  return `${Math.round(valor)}°`;
}

/** Un porcentaje a partir de una fracción 0–1. */
export function porcentaje(fraccion: number, decimales = 0): string {
  return `${numero(fraccion * 100, decimales)} %`;
}

/** Coordenadas del puerto como se escriben en una carta: «43,362° N · 8,406° O». */
export function coordenadas(lat: number, lon: number): string {
  const latitud = `${numero(Math.abs(lat), 3)}° ${lat >= 0 ? "N" : "S"}`;
  const longitud = `${numero(Math.abs(lon), 3)}° ${lon >= 0 ? "E" : "O"}`;
  return `${latitud} · ${longitud}`;
}

const kilometrosFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

/** Una distancia en kilómetros con separador de millar español: «384.400 km». */
export function kilometros(valor: number): string {
  return `${kilometrosFmt.format(valor)} km`;
}

const ROSA = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
const SECTOR_DEG = 360 / 16;

/** Rumbo de la rosa de 16 vientos (en castellano: O de Oeste, no W) para un acimut en grados. */
export function rumbo(azimuth_deg: number): string {
  const indice = Math.round((((azimuth_deg % 360) + 360) % 360) / SECTOR_DEG) % ROSA.length;
  return ROSA[indice] ?? "N";
}

/** El acimut como lo lee un humano: «71° (ENE)». */
export function acimut(azimuth_deg: number): string {
  return `${grados(azimuth_deg)} (${rumbo(azimuth_deg)})`;
}

/**
 * El mediodía UTC de una fecha civil. Se formatea SIEMPRE a mediodía y en UTC: cualquier otra hora
 * puede caer en el día anterior o el siguiente al proyectarla a una zona, y entonces la fecha
 * escrita no sería la fecha pedida.
 */
function mediodiaDe(fechaIso: string): Date {
  return new Date(`${fechaIso}T12:00:00Z`);
}

const fechaLargaFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const fechaCortaFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
});

const mesFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", month: "long", year: "numeric" });

/** «viernes, 28 de agosto de 2026». */
export function fechaLarga(fechaIso: string): string {
  return fechaLargaFmt.format(mediodiaDe(fechaIso));
}

/** «vie 28», para la columna de día de la tabla mensual. */
export function fechaCorta(fechaIso: string): string {
  return fechaCortaFmt.format(mediodiaDe(fechaIso));
}

/** «agosto de 2026». */
export function mesYAno(fechaIso: string): string {
  return mesFmt.format(mediodiaDe(fechaIso));
}

/** Si la fecha cae en sábado o domingo (la tabla mensual los destaca). */
export function esFinDeSemana(fechaIso: string): boolean {
  const dia = mediodiaDe(fechaIso).getUTCDay();
  return dia === 0 || dia === 6;
}
