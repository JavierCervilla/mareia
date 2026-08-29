/**
 * **La promesa de T-12**: calcular las mareas de cualquier día, en el navegador y sin red.
 *
 * Esto es lo que separa una PWA de verdad de un caché de páginas. Un caché guarda el día que se
 * guardó; con las constantes armónicas del puerto y el motor de `@mareia/domain-core` —TypeScript
 * puro, sin IO ni dependencias de runtime, el mismo que usa el API— el teléfono calcula el 14 de
 * marzo en la playa, sin cobertura, con la misma aritmética con la que lo calcularía el servidor.
 *
 * Por eso un favorito guarda **constantes** (unos pocos kB por puerto) y no un almanaque
 * precalculado del año: pesa un orden de magnitud menos y no caduca en Nochevieja.
 *
 * Este módulo no toca el DOM ni la red: entra un payload y una fecha, sale o la tabla del día o el
 * motivo exacto de que no la haya. Por eso se testea en Node, sin navegador.
 *
 * **Se carga con `import()` dinámico** desde la página (ver `pwa/cliente/otro-dia.ts`): importarlo
 * de forma estática metería el motor —lo más pesado de todo el JavaScript del sitio— en el bundle
 * que baja cualquiera que abra un puerto, aunque no vaya a pedir ningún otro día.
 */

import { civilDayBounds, findExtremes } from "@mareia/domain-core";
// El MISMO redondeo que aplica el API, importado y no reescrito: si el navegador publicara
// `0.9213888871867331` donde el servidor publica `0.921`, las dos superficies estarían dando
// respuestas distintas a la misma pregunta. `@mareia/usecases/dto` no trae runtime, solo tipos.
import { toHeight, toInstant } from "@mareia/usecases/dto";

import { ventanaDeAnos } from "./estacion-offline.ts";
import type { EstacionOffline } from "./estacion-offline.ts";

/** Un extremo del día, tal y como lo devuelve el motor. */
export interface EventoOffline {
  readonly timeUtcMs: number;
  readonly height_m: number;
  readonly kind: "high" | "low";
}

/**
 * O el día calculado, o el motivo exacto de que no se pueda. Nunca las dos, nunca ninguna.
 *
 * La respuesta lleva **el intervalo que cubre**, igual que la del API lleva su `range`, y por el
 * mismo motivo: un día civil no siempre dura 24 h. Las dos noches del año en que cambia la hora
 * duran 23 y 25, y la página lo dice cuando toca en vez de dejar que quien lea la tabla lo deduzca.
 */
export type DiaOffline =
  | {
      readonly ok: true;
      readonly fechaIso: string;
      readonly eventos: readonly EventoOffline[];
      /** Principio del día civil del puerto, en ms UTC. */
      readonly inicioUtcMs: number;
      /** Final del día civil (excluido), en ms UTC. */
      readonly finUtcMs: number;
    }
  | { readonly ok: false; readonly motivo: string };

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * Las pleamares y bajamares de un día civil del puerto, calculadas aquí mismo.
 *
 * El día es el **civil del puerto** (de medianoche a medianoche en su zona), no una ventana UTC:
 * es lo que hace el API y lo que espera quien mira la tabla. `civilDayBounds` resuelve el cambio de
 * hora sin inventarse nada, que es donde estas cosas se rompen dos noches al año.
 */
export function diaOffline(estacion: EstacionOffline, fechaIso: string): DiaOffline {
  if (!FORMATO_FECHA.test(fechaIso)) {
    return { ok: false, motivo: "Escribe la fecha como día, mes y año." };
  }
  const { desde, hasta } = ventanaDeAnos(estacion.generadoEn);
  const ano = Number(fechaIso.slice(0, 4));
  if (ano < desde || ano > hasta) {
    return {
      ok: false,
      motivo:
        `Esta copia calcula de ${desde} a ${hasta}. Más allá, la predicción armónica pierde ` +
        `garantía y el servidor tampoco la sirve: prefiere no darte una hora a darte una que no ` +
        `puede sostener.`,
    };
  }
  try {
    const { startUtcMs, endUtcMs } = civilDayBounds(fechaIso, estacion.puerto.timezone);
    return {
      ok: true,
      fechaIso,
      inicioUtcMs: startUtcMs,
      finUtcMs: endUtcMs,
      eventos: findExtremes(estacion.estacion, startUtcMs, endUtcMs).map((extremo) => ({
        timeUtcMs: toInstant(extremo.timeUtcMs).timeUtcMs,
        height_m: toHeight(extremo.height_m),
        kind: extremo.kind,
      })),
    };
  } catch {
    // El motor rechaza fechas que no existen (30 de febrero) y zonas que no conoce. Que la fecha
    // sea imposible no es una avería de la página: se dice y se sigue.
    return { ok: false, motivo: `No existe el día ${fechaIso} en el calendario de este puerto.` };
  }
}
