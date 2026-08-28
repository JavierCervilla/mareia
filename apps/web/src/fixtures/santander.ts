/**
 * FIXTURE — datos de muestra del puerto de Santander para el 28 de agosto de 2026.
 *
 * ⚠️ Provisional a propósito. Son los mismos valores del canvas de diseño, escritos a mano para
 * poder construir y revisar la página de puerto (T-09) sin depender todavía del pipeline de datos:
 *
 *   · T-05 traerá los extremos y la curva reales desde el motor armónico (`@mareia/domain-core`)
 *     con las constituyentes REDMAR de la estación.
 *   · T-07 traerá sol, luna, solunar y meteorología desde sus adaptadores.
 *
 * Cuando ambas lleguen, este fichero DESAPARECE: la página debe pasar a recibir los mismos campos
 * desde el caso de uso correspondiente, no a leer de aquí. Nada fuera de la página de puerto debe
 * importarlo.
 */

export type TipoMarea = "pleamar" | "bajamar";

export interface ExtremoMarea {
  readonly tipo: TipoMarea;
  /** Hora local `HH:MM` (24 h). */
  readonly hora: string;
  /** Altura sobre el cero del puerto, en metros. */
  readonly alturaM: number;
}

export interface PeriodoSolunar {
  readonly tipo: "mayor" | "menor";
  readonly inicio: string;
  readonly fin: string;
  /** Actividad estimada, de 0 a `RATING_MAXIMO`. */
  readonly rating: number;
}

export interface DatosPuerto {
  readonly slug: string;
  readonly nombre: string;
  readonly region: string;
  /** Coordenadas ya formateadas en castellano (coma decimal, N/O). */
  readonly coordenadas: string;
  /** Fecha del almanaque en ISO, para el atributo `datetime`. */
  readonly fechaISO: string;
  /** La misma fecha escrita en largo, tal cual se imprime. */
  readonly fechaTexto: string;
  readonly mareas: readonly ExtremoMarea[];
  readonly coeficiente: { readonly valor: number; readonly calificacion: string };
  readonly sol: { readonly amanecer: string; readonly ocaso: string };
  readonly luna: { readonly fase: string; readonly iluminacionPct: number };
  readonly solunar: readonly PeriodoSolunar[];
  readonly meteo: {
    readonly vientoDireccion: string;
    readonly vientoNudos: number;
    readonly olasM: number;
    readonly aguaC: number;
    readonly aireC: number;
    readonly fuente: string;
  };
  readonly procedencia: {
    /**
     * De dónde salen las cifras, tal cual se imprime en el pie. Es un texto y no un par
     * constituyentes/calidad a propósito: mientras el dato sea este fixture el pie tiene que poder
     * decirlo, y cuando T-05 traiga el motor armónico pasará a «Constituyentes REDMAR · calidad A»
     * sin tocar la página.
     */
    readonly fuente: string;
    readonly metodo: string;
    readonly licencia: string;
  };
}

/** Escala de los puntos de actividad solunar. */
export const RATING_MAXIMO = 4;

export const SANTANDER: DatosPuerto = {
  slug: "santander",
  nombre: "Santander",
  region: "Cantabria",
  coordenadas: "43,46° N · 3,79° O",
  fechaISO: "2026-08-28",
  fechaTexto: "Viernes, 28 de agosto de 2026",
  mareas: [
    { tipo: "pleamar", hora: "04:12", alturaM: 4.82 },
    { tipo: "bajamar", hora: "10:26", alturaM: 0.93 },
    { tipo: "pleamar", hora: "16:38", alturaM: 4.95 },
    { tipo: "bajamar", hora: "22:51", alturaM: 0.81 },
  ],
  coeficiente: { valor: 87, calificacion: "Mareas vivas" },
  sol: { amanecer: "07:37", ocaso: "20:52" },
  luna: { fase: "Gibosa menguante", iluminacionPct: 99 },
  solunar: [
    { tipo: "mayor", inicio: "05:58", fin: "07:58", rating: 3 },
    { tipo: "menor", inicio: "12:10", fin: "13:10", rating: 2 },
    { tipo: "mayor", inicio: "18:24", fin: "20:24", rating: 4 },
  ],
  meteo: {
    vientoDireccion: "NO",
    vientoNudos: 12,
    olasM: 0.8,
    aguaC: 19,
    aireC: 21,
    fuente: "Open-Meteo",
  },
  procedencia: {
    fuente: "Datos de muestra (fixture) — pendiente REDMAR",
    metodo: "Foreman (1977)",
    licencia: "CC-BY 4.0",
  },
};
