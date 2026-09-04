/**
 * Las cinco reglas derivadas, y **no hay una sexta que se sostenga** (spec §4.3).
 *
 * **La frontera exacta del slop**: cada regla enuncia **el hecho**, nunca **el beneficio**.
 * Se publica «el periodo mayor de 13:40 queda a 35 min de la bajamar»; **no** se publica «buen
 * momento para pescar». Ni cebos, ni aparejos, ni técnicas, ni spots, ni pronóstico de captura, ni
 * ninguna frase con «recomendamos», «lo mejor es» o «ideal para». Lo que hace que esto no dependa de
 * la buena voluntad de quien añada la siguiente regla es que el texto sale de estas funciones y
 * **T3 lo recomputa desde el `dist/`**: una frase escrita a mano no coincide con la salida de una
 * función pura que no la genera.
 */

import type { MagnitudCalculada } from "./tipos.ts";
import type { MuestraDeCurva } from "./regla.ts";
import {
  definirRegla,
  EntradasIlegiblesError,
  type FaseLunar,
  numeroDe,
  type ReglaDefinida,
  textoDe,
} from "./regla.ts";

/** Espacio duro entre cifra y unidad: una magnitud partida entre dos líneas se lee mal (T-26). */
const PEGADO = "\u00a0";

/** Ventana de la regla 1: ±2 h en torno al extremo, que es la que enuncia la spec. */
const VENTANA_COINCIDENCIA_MS = 2 * 60 * 60 * 1000;

/**
 * Umbral de la regla 4, como **fracción del rango del día** y no como altura fija.
 *
 * Una altura fija no significa lo mismo en Cádiz (rango ~3 m) que en Barcelona (~0,2 m): en el
 * Mediterráneo dejaría la franja siempre vacía o siempre entera, que son las dos formas de no decir
 * nada. Referida al rango del propio día, la franja es «el quinto inferior de la marea de hoy».
 */
const FRANJA_BAJA_FRACCION_DEL_RANGO = 0.2;

/** Debajo de esto la franja no se publica: media hora suelta no es una franja. */
const FRANJA_BAJA_MINIMA_MS = 30 * 60 * 1000;

const MINUTO_MS = 60 * 1000;
const HORA_MS = 60 * MINUTO_MS;

/**
 * El identificador de cada regla, una sola vez.
 *
 * Estaba escrito a mano en cada llamada a `leerEntradas` —hasta nueve veces el mismo— y el linter
 * anti-slop lo marcó. No es cosmética: un id escrito dos veces es un id que se puede renombrar en un
 * sitio y no en el otro, y entonces el mensaje de error de T3 acusa a una regla que no es.
 */
const ID_COINCIDENCIA = "coincidencia-solunar-marea";
const ID_EN_LUZ = "periodo-en-luz";
const ID_RANGO = "rango-del-dia";
const ID_FRANJA = "franja-de-nivel-bajo";
const ID_LUNA = "iluminacion-lunar";

// --- 1 · coincidencia-solunar-marea ------------------------------------------------------------

interface EntradasCoincidencia {
  readonly clase: "mayor" | "menor";
  readonly periodoUtcMs: number;
  readonly extremoClase: "pleamar" | "bajamar";
  readonly extremoUtcMs: number;
  readonly separacion_min: number;
  readonly zonaHoraria: string;
}

/**
 * La coincidencia **más ajustada** del día entre un periodo solunar y un extremo de marea, si cae
 * dentro de la ventana. Se publica una y no todas: enumerar seis coincidencias es ruido, y la que
 * informa es la más cerrada.
 */
const coincidenciaSolunarMarea = definirRegla<EntradasCoincidencia>({
  id: ID_COINCIDENCIA,
  evaluar: (dia) => {
    let mejor: EntradasCoincidencia | null = null;
    for (const periodo of dia.solunar.periodos) {
      for (const extremo of dia.extremos) {
        const separacion = Math.abs(periodo.picoUtcMs - extremo.instanteUtcMs);
        if (separacion > VENTANA_COINCIDENCIA_MS) continue;
        if (mejor !== null && separacion >= mejor.separacion_min * MINUTO_MS) continue;
        mejor = {
          clase: periodo.clase,
          periodoUtcMs: periodo.picoUtcMs,
          extremoClase: extremo.clase,
          extremoUtcMs: extremo.instanteUtcMs,
          separacion_min: Math.round(separacion / MINUTO_MS),
          zonaHoraria: dia.zonaHoraria,
        };
      }
    }
    return mejor;
  },
  redactar: (e, formato) =>
    `El periodo ${e.clase} de ${formato.hora(e.periodoUtcMs, e.zonaHoraria)} queda a ` +
    `${formato.numero(e.separacion_min, 0)}${PEGADO}min de la ${e.extremoClase} de ` +
    `${formato.hora(e.extremoUtcMs, e.zonaHoraria)}.`,
  magnitudes: (e) => [{ clave: "separacion_min", valor: e.separacion_min, unidad: "min" }],
  leerEntradas: (crudo) => {
    const clase = textoDe(crudo, "coincidencia-solunar-marea", "clase");
    const extremoClase = textoDe(crudo, "coincidencia-solunar-marea", "extremoClase");
    if (clase !== "mayor" && clase !== "menor") {
      throw new EntradasIlegiblesError(ID_COINCIDENCIA, `clase «${clase}» desconocida`);
    }
    if (extremoClase !== "pleamar" && extremoClase !== "bajamar") {
      throw new EntradasIlegiblesError(
        "coincidencia-solunar-marea",
        `extremoClase «${extremoClase}» desconocida`,
      );
    }
    return {
      clase,
      extremoClase,
      periodoUtcMs: numeroDe(crudo, "coincidencia-solunar-marea", "periodoUtcMs"),
      extremoUtcMs: numeroDe(crudo, "coincidencia-solunar-marea", "extremoUtcMs"),
      separacion_min: numeroDe(crudo, "coincidencia-solunar-marea", "separacion_min"),
      zonaHoraria: textoDe(crudo, "coincidencia-solunar-marea", "zonaHoraria"),
    };
  },
});

// --- 2 · periodo-en-luz ------------------------------------------------------------------------

interface EntradasEnLuz {
  readonly enLuz: number;
  readonly total: number;
}

/**
 * Cuántos periodos caen entre el orto y el ocaso del Sol.
 *
 * **Publica también el cero**: «ninguno de los 4 periodos cae entre el orto y el ocaso» es un hecho
 * del día, no una ausencia de información. Lo que no dispara es el día sin periodos o sin orto y
 * ocaso —latitudes altas—, porque ahí no hay nada que contar.
 */
const periodoEnLuz = definirRegla<EntradasEnLuz>({
  id: ID_EN_LUZ,
  evaluar: (dia) => {
    const { ortoSolarUtcMs, ocasoSolarUtcMs, periodos } = dia.solunar;
    if (periodos.length === 0 || ortoSolarUtcMs === null || ocasoSolarUtcMs === null) return null;
    const enLuz = periodos.filter(
      (p) => p.picoUtcMs >= ortoSolarUtcMs && p.picoUtcMs <= ocasoSolarUtcMs,
    ).length;
    return { enLuz, total: periodos.length };
  },
  redactar: (e, formato) =>
    e.enLuz === 0
      ? `Ninguno de los ${formato.numero(e.total, 0)} periodos solunares del día cae entre el orto ` +
        "y el ocaso del Sol."
      : `${formato.numero(e.enLuz, 0)} de los ${formato.numero(e.total, 0)} periodos solunares del ` +
        "día caen entre el orto y el ocaso del Sol.",
  magnitudes: (e) => [
    { clave: "periodos_en_luz", valor: e.enLuz, unidad: "" },
    { clave: "periodos_del_dia", valor: e.total, unidad: "" },
  ],
  leerEntradas: (crudo) => ({
    enLuz: numeroDe(crudo, "periodo-en-luz", "enLuz"),
    total: numeroDe(crudo, "periodo-en-luz", "total"),
  }),
});

// --- 3 · rango-del-dia -------------------------------------------------------------------------

interface EntradasRango {
  readonly amplitud_m: number;
  readonly bajamar_m: number;
  readonly pleamar_m: number;
  /** `null` cuando el puerto no tiene marea semidiurna y el coeficiente no está definido. */
  readonly coeficiente: number | null;
}

/** Amplitud entre la mayor pleamar y la menor bajamar del día, con el coeficiente si lo hay. */
const rangoDelDia = definirRegla<EntradasRango>({
  id: ID_RANGO,
  evaluar: (dia) => {
    const pleamares = dia.extremos.filter((e) => e.clase === "pleamar");
    const bajamares = dia.extremos.filter((e) => e.clase === "bajamar");
    if (pleamares.length === 0 || bajamares.length === 0) return null;
    const pleamar_m = Math.max(...pleamares.map((e) => e.altura_m));
    const bajamar_m = Math.min(...bajamares.map((e) => e.altura_m));
    return {
      pleamar_m,
      bajamar_m,
      amplitud_m: pleamar_m - bajamar_m,
      coeficiente: dia.coeficiente,
    };
  },
  redactar: (e, formato) => {
    const base =
      `La marea recorre ${formato.numero(e.amplitud_m, 2)}${PEGADO}m entre la bajamar de ` +
      `${formato.numero(e.bajamar_m, 2)}${PEGADO}m y la pleamar de ` +
      `${formato.numero(e.pleamar_m, 2)}${PEGADO}m`;
    return e.coeficiente === null
      ? `${base}.`
      : `${base}; el coeficiente del día es ${formato.numero(e.coeficiente, 0)}.`;
  },
  magnitudes: (e) => {
    const magnitudes: MagnitudCalculada[] = [
      { clave: "amplitud_m", valor: e.amplitud_m, unidad: "m" },
    ];
    if (e.coeficiente !== null) {
      magnitudes.push({ clave: "coeficiente", valor: e.coeficiente, unidad: "" });
    }
    return magnitudes;
  },
  leerEntradas: (crudo) => {
    if (typeof crudo !== "object" || crudo === null) {
      throw new EntradasIlegiblesError(ID_RANGO, "no es un objeto");
    }
    const coeficienteCrudo = (crudo as Record<string, unknown>)["coeficiente"];
    if (coeficienteCrudo !== null && typeof coeficienteCrudo !== "number") {
      throw new EntradasIlegiblesError(
        "rango-del-dia",
        "«coeficiente» debería ser number o null, y es " + typeof coeficienteCrudo,
      );
    }
    return {
      amplitud_m: numeroDe(crudo, "rango-del-dia", "amplitud_m"),
      bajamar_m: numeroDe(crudo, "rango-del-dia", "bajamar_m"),
      pleamar_m: numeroDe(crudo, "rango-del-dia", "pleamar_m"),
      coeficiente: coeficienteCrudo,
    };
  },
});

// --- 4 · franja-de-nivel-bajo ------------------------------------------------------------------

interface EntradasFranja {
  readonly umbral_m: number;
  readonly horas: number;
  readonly desdeUtcMs: number;
  readonly hastaUtcMs: number;
  readonly zonaHoraria: string;
}

/**
 * La franja continua más larga con el nivel por debajo del quinto inferior del rango del día.
 *
 * Es el uso real del sitio según el design-brief §1 (marisqueo y pesca a pie), y sale de la curva
 * **ya calculada**: no se vuelve a predecir nada aquí.
 */
/** Un tramo continuo de la curva por debajo del umbral. */
interface Tramo {
  readonly desdeUtcMs: number;
  readonly hastaUtcMs: number;
}

/**
 * Todos los tramos continuos con `altura <= umbral`.
 *
 * Sale a función propia porque la versión en línea **repetía el cierre del tramo**: una vez al
 * romperse dentro del bucle y otra al terminar la curva, para no perder la franja que llega al final
 * del día. Dos copias de la misma decisión, con su complejidad cognitiva en 24, y el linter tuvo
 * razón. Aquí el cierre está una sola vez y el `flush` final es la misma llamada.
 */
function tramosBajoUmbral(
  curva: readonly MuestraDeCurva[],
  umbral_m: number,
): readonly Tramo[] {
  const tramos: Tramo[] = [];
  let abierto: Tramo | null = null;
  // Una muestra centinela POR ENCIMA del umbral cierra el último tramo dentro del bucle. Sin ella
  // hay que repetir el cierre fuera —que es lo que tenía la primera versión, con su complejidad
  // cognitiva en 24— o perder la franja que llega al final del día.
  const conCentinela: readonly MuestraDeCurva[] = [
    ...curva,
    { instanteUtcMs: Number.NaN, altura_m: umbral_m + 1 },
  ];
  for (const muestra of conCentinela) {
    if (muestra.altura_m <= umbral_m) {
      abierto = {
        desdeUtcMs: abierto === null ? muestra.instanteUtcMs : abierto.desdeUtcMs,
        hastaUtcMs: muestra.instanteUtcMs,
      };
      continue;
    }
    if (abierto !== null) tramos.push(abierto);
    abierto = null;
  }
  return tramos;
}

const franjaDeNivelBajo = definirRegla<EntradasFranja>({
  id: ID_FRANJA,
  evaluar: (dia) => {
    if (dia.curva.length < 2) return null;
    const alturas = dia.curva.map((m) => m.altura_m);
    const minimo = Math.min(...alturas);
    const maximo = Math.max(...alturas);
    if (maximo === minimo) return null;
    const umbral_m = minimo + (maximo - minimo) * FRANJA_BAJA_FRACCION_DEL_RANGO;

    const duracion = (t: Tramo): number => t.hastaUtcMs - t.desdeUtcMs;
    let masLargo: Tramo | null = null;
    for (const tramo of tramosBajoUmbral(dia.curva, umbral_m)) {
      if (masLargo === null || duracion(tramo) > duracion(masLargo)) masLargo = tramo;
    }
    if (masLargo === null || duracion(masLargo) < FRANJA_BAJA_MINIMA_MS) return null;
    return {
      umbral_m,
      horas: duracion(masLargo) / HORA_MS,
      desdeUtcMs: masLargo.desdeUtcMs,
      hastaUtcMs: masLargo.hastaUtcMs,
      zonaHoraria: dia.zonaHoraria,
    };
  },
  redactar: (e, formato) =>
    `El nivel se mantiene por debajo de ${formato.numero(e.umbral_m, 2)}${PEGADO}m durante ` +
    `${formato.numero(e.horas, 1)}${PEGADO}h, de ${formato.hora(e.desdeUtcMs, e.zonaHoraria)} a ` +
    `${formato.hora(e.hastaUtcMs, e.zonaHoraria)}.`,
  magnitudes: (e) => [
    { clave: "umbral_m", valor: e.umbral_m, unidad: "m" },
    { clave: "horas_bajo_umbral", valor: e.horas, unidad: "h" },
  ],
  leerEntradas: (crudo) => ({
    umbral_m: numeroDe(crudo, ID_FRANJA, "umbral_m"),
    horas: numeroDe(crudo, ID_FRANJA, "horas"),
    desdeUtcMs: numeroDe(crudo, ID_FRANJA, "desdeUtcMs"),
    hastaUtcMs: numeroDe(crudo, ID_FRANJA, "hastaUtcMs"),
    zonaHoraria: textoDe(crudo, ID_FRANJA, "zonaHoraria"),
  }),
});

// --- 5 · iluminacion-lunar ---------------------------------------------------------------------

interface EntradasLuna {
  readonly fase: FaseLunar;
  readonly fraccion: number;
  readonly edadDias: number;
}

/**
 * Cómo se dice cada fase. **Sin `default`**: el `never` es el gate — si `domain-core` añade una
 * novena fase, esto deja de compilar en vez de publicar su nombre en inglés.
 */
function nombreDeFase(fase: FaseLunar): string {
  switch (fase) {
    case "new":
      return "nueva";
    case "waxing-crescent":
      return "creciente";
    case "first-quarter":
      return "en cuarto creciente";
    case "waxing-gibbous":
      return "gibosa creciente";
    case "full":
      return "llena";
    case "waning-gibbous":
      return "gibosa menguante";
    case "last-quarter":
      return "en cuarto menguante";
    case "waning-crescent":
      return "menguante";
    default: {
      const nunca: never = fase;
      throw new Error(`Fase lunar no contemplada: ${String(nunca)}`);
    }
  }
}

/** Fase y fracción iluminada, que ya calcula el dominio. */
const iluminacionLunar = definirRegla<EntradasLuna>({
  id: ID_LUNA,
  evaluar: (dia) => ({
    fase: dia.solunar.faseLunar,
    fraccion: dia.solunar.fraccionIluminada,
    edadDias: dia.solunar.edadLunarDias,
  }),
  redactar: (e, formato) =>
    `La Luna está ${nombreDeFase(e.fase)}, con el ${formato.numero(e.fraccion * 100, 0)}${PEGADO}% ` +
    `del disco iluminado y ${formato.numero(e.edadDias, 1)}${PEGADO}días de edad.`,
  magnitudes: (e) => [
    { clave: "fraccion_iluminada", valor: e.fraccion * 100, unidad: "%" },
    { clave: "edad_lunar_dias", valor: e.edadDias, unidad: "" },
  ],
  leerEntradas: (crudo) => {
    const fase = textoDe(crudo, "iluminacion-lunar", "fase");
    const conocidas: readonly string[] = [
      "new",
      "waxing-crescent",
      "first-quarter",
      "waxing-gibbous",
      "full",
      "waning-gibbous",
      "last-quarter",
      "waning-crescent",
    ];
    if (!conocidas.includes(fase)) {
      throw new EntradasIlegiblesError(ID_LUNA, `fase «${fase}» desconocida`);
    }
    return {
      fase: fase as FaseLunar,
      fraccion: numeroDe(crudo, "iluminacion-lunar", "fraccion"),
      edadDias: numeroDe(crudo, "iluminacion-lunar", "edadDias"),
    };
  },
});

/**
 * Las cinco, en el orden en que se publican.
 *
 * El censo **T2** itera sobre `REGLAS_DECLARADAS` y busca aquí: una regla declarada en el tipo y
 * ausente de esta lista —o al revés— pone el censo en rojo antes de que llegue a ninguna página.
 */
export const REGLAS: readonly ReglaDefinida[] = [
  coincidenciaSolunarMarea,
  periodoEnLuz,
  rangoDelDia,
  franjaDeNivelBajo,
  iluminacionLunar,
];

export { FRANJA_BAJA_FRACCION_DEL_RANGO, FRANJA_BAJA_MINIMA_MS, VENTANA_COINCIDENCIA_MS };
