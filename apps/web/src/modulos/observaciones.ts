/**
 * La costura entre el módulo `fishing` y esta web para las **observaciones del día**.
 *
 * El módulo no sabe de Astro, ni del dataset, ni de `Intl`; esta web no sabe qué es una regla. Aquí
 * se junta lo uno con lo otro: se piden los periodos al mismo caso de uso que ya usa la sección
 * solunar (`cargarActividad`, con su caché por puerto y día) y las mareas al mismo cargador que usa
 * la página de puerto, y se le presta al módulo el `formato.ts` del sitio.
 *
 * **No se recalcula nada aquí.** Si esto volviera a predecir la marea o a buscar efemérides, habría
 * dos caminos al mismo número y se desincronizarían — que es la razón por la que `cargarActividad`
 * existe y cachea en vez de dejar que cada sección llame a `getSolunar`.
 */

import type {
  ContextoDelDia,
  ExtremoDelDia,
  FaseLunar,
  FormatoDeObservaciones,
  MuestraDeCurva,
  Observacion,
} from "@mareia/module-fishing";
import { observacionesDelDia } from "@mareia/module-fishing";

import { cargarDatosDePuerto } from "../datos/pagina-puerto.ts";
import { FECHA_DE_BUILD } from "../datos/fecha-build.ts";
import { hora, numero } from "../formato.ts";
import { cargarActividad } from "./actividad-solunar.ts";
import type { ContextoDeSeccion } from "./contexto.ts";

/** El formato del sitio, atado a la zona del puerto, prestado al módulo. */
export function formatoDeObservaciones(): FormatoDeObservaciones {
  return { numero, hora };
}

/**
 * Las ocho fases que publica el dominio.
 *
 * El DTO trae `name: string` porque cruza el API, así que aquí hay que **volver a estrechar**. Un
 * nombre que no esté en la lista **levanta** en vez de colarse: si el dominio añadiera una novena
 * fase, esto para el build en la costura, que es donde se ve, en lugar de publicar una cadena en
 * inglés en 153 páginas.
 */
const FASES: readonly FaseLunar[] = [
  "new",
  "waxing-crescent",
  "first-quarter",
  "waxing-gibbous",
  "full",
  "waning-gibbous",
  "last-quarter",
  "waning-crescent",
];

function faseLunarDe(nombre: string): FaseLunar {
  const fase = FASES.find((candidata) => candidata === nombre);
  if (fase === undefined) {
    throw new Error(
      `Fase lunar «${nombre}» desconocida en la costura de observaciones: el dominio publica una ` +
        "fase que este módulo no sabe escribir",
    );
  }
  return fase;
}

/**
 * El primer orto y el primer ocaso solares del día, o `null` si no los hay.
 *
 * `solarEvents` puede venir vacío —latitudes altas— y ahí la regla `periodo-en-luz` no dispara. Se
 * devuelve `null` en vez de inventarse medianoche: un día sin orto no es un día cuyo orto sea 00:00.
 */
function eventoSolar(
  eventos: readonly { kind: string; timeUtcMs: number }[],
  clase: "rise" | "set",
): number | null {
  return eventos.find((evento) => evento.kind === clase)?.timeUtcMs ?? null;
}

/** El día ya calculado, en la forma que consumen las reglas. */
export async function contextoDelDia(contexto: ContextoDeSeccion): Promise<ContextoDelDia> {
  const [actividad, puerto] = await Promise.all([
    cargarActividad(contexto),
    cargarDatosDePuerto(contexto.slug, FECHA_DE_BUILD),
  ]);

  const extremos: readonly ExtremoDelDia[] = puerto.dia.eventos.map((evento) => ({
    clase: evento.kind === "high" ? "pleamar" : "bajamar",
    instanteUtcMs: evento.timeUtcMs,
    altura_m: evento.height_m,
  }));

  const curva: readonly MuestraDeCurva[] = puerto.dia.muestras.map((muestra) => ({
    instanteUtcMs: muestra.timeUtcMs,
    altura_m: muestra.height_m,
  }));

  // El coeficiente del día es el de la pleamar de la mañana, y si no la hay, el de la tarde. Un
  // puerto sin pleamares no tiene coeficiente: se publica la ausencia, no un cero.
  const coeficienteDelDia =
    puerto.coeficiente.morning?.value ?? puerto.coeficiente.afternoon?.value ?? null;

  return {
    zonaHoraria: contexto.timezone,
    coeficiente: coeficienteDelDia,
    extremos,
    curva,
    solunar: {
      periodos: actividad.periods.map((periodo) => ({
        clase: periodo.kind === "major" ? "mayor" : "menor",
        picoUtcMs: periodo.peakUtcMs,
      })),
      fraccionIluminada: actividad.moon.illuminatedFraction,
      edadLunarDias: actividad.moon.ageDays,
      faseLunar: faseLunarDe(actividad.moon.name),
      ortoSolarUtcMs: eventoSolar(actividad.solarEvents, "rise"),
      ocasoSolarUtcMs: eventoSolar(actividad.solarEvents, "set"),
    },
  };
}

/** Las observaciones del día del puerto de esta página. */
export async function cargarObservaciones(
  contexto: ContextoDeSeccion,
): Promise<readonly Observacion[]> {
  return observacionesDelDia(await contextoDelDia(contexto), formatoDeObservaciones());
}
