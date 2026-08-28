/**
 * Cómo se lee en castellano lo que responde el módulo `weather` (T-08). **Toda** la sección meteo
 * pasa por aquí, y aquí no se toca el DOM ni la red: entra el JSON del API, sale un modelo de
 * vista. Eso es lo que permite tener un test por cada estado sin navegador.
 *
 * Las tres reglas que sostienen este fichero, en orden de importancia:
 *
 * 1. **La antigüedad manda.** El backend ya distingue tres escalones (fresco / servido de caché
 *    caducada / no disponible) y los publica en `fetchedAt`, `ageSeconds` y `stale`. Esta capa no
 *    los re-deriva ni se inventa umbrales: los traduce a una frase con la edad **en la cara**
 *    («hace 3 h 10 min»), porque un dato de hace tres horas presentado como fresco es peor que no
 *    publicarlo.
 * 2. **La edad se mide como intervalo, no como instante.** `ageSeconds` es la edad en el momento
 *    en que el servidor contestó; a eso se le suma lo transcurrido desde que la respuesta llegó al
 *    navegador. Nunca se resta `Date.parse(fetchedAt)` del reloj del cliente: un reloj de móvil
 *    desajustado dos horas convertiría un dato fresco en uno rancio (o al revés), y el reloj torcido
 *    sí mide bien un intervalo corto aunque no sepa qué hora es.
 * 3. **Un ausente dice cuál es.** En esta sección hay tres formas distintas de no tener un número y
 *    ninguna puede confundirse con otra: (a) la fuente no respondió y no había nada guardado
 *    —motivo del backend—, (b) la fuente respondió pero el modelo no publica ese valor en esta
 *    celda —hueco del modelo—, (c) el navegador ni siquiera pudo preguntar. Es la lección del
 *    hallazgo A-11 del pase adversario de T-09 (un `null` que significaba «micromareal» y «sin
 *    observación» a la vez, y le colgó a Cádiz un cartel falso).
 */

import type {
  BulletinPayload,
  ForecastConditions,
  KeyStatus,
  MarineConditions,
  SourceReport,
  WeatherPayload,
} from "@mareia/module-weather/ui";

import { acimut, hora, metros, numero } from "../../formato.ts";

/** Lo que se pudo traer de un endpoint, o por qué no se pudo. */
export type Traida<T> =
  | { readonly ok: true; readonly cuerpo: T }
  | { readonly ok: false; readonly motivo: string };

/** Las dos respuestas del módulo y el instante en que llegaron al navegador. */
export interface RespuestaMeteo {
  readonly meteo: Traida<WeatherPayload>;
  readonly boletin: Traida<BulletinPayload>;
  /** Reloj del navegador al recibir las respuestas. Solo se usa para medir intervalos. */
  readonly recibidoEnMs: number;
}

/** Un dato de la sección: **o** tiene valor **o** dice por qué no lo tiene. Nunca las dos. */
export interface FilaMeteo {
  readonly titulo: string;
  readonly valor: string | undefined;
  /** Acompañante del dato (dirección, rachas, periodo), si lo hay. */
  readonly detalle: string | undefined;
  /** Por qué no hay valor, cuando no lo hay. */
  readonly ausencia: string | undefined;
}

/** Los tres tonos del sello. El CSS los distingue; el texto ya se distingue solo. */
export type ClaseDeSello = "fresco" | "caducado" | "sin-dato";

/**
 * El sello de antigüedad de un bloque. Es obligatorio: **ningún bloque se pinta sin decir de cuándo
 * es lo que enseña**, que es la razón de ser de esta trayectoria.
 */
export interface SelloDeAntiguedad {
  readonly clase: ClaseDeSello;
  /** La frase corta que se lee primero. En un dato caducado, lleva la edad. */
  readonly titular: string;
  /** El porqué, la hora absoluta o el motivo del backend. */
  readonly detalle: string | undefined;
}

/** Un párrafo del boletín oficial, citado con su rótulo y **sin reescribir**. */
export interface ParrafoOficial {
  readonly rotulo: string;
  readonly texto: string;
}

/** El boletín de AEMET como cita: quién lo emite, cuándo, para qué zona y qué dice. */
export interface CitaOficial {
  readonly parrafos: readonly ParrafoOficial[];
  /** Pie de la cita: autoría, zona y hora de emisión. */
  readonly pie: string;
}

/** Un bloque de la sección: mar, atmósfera o boletín. */
export interface BloqueMeteo {
  readonly id: string;
  readonly titulo: string;
  readonly sello: SelloDeAntiguedad;
  readonly filas: readonly FilaMeteo[];
  readonly cita: CitaOficial | undefined;
  /** Advertencia sobre el propio dato (zona sin verificar, esquema sin comprobar). */
  readonly nota: string | undefined;
}

/** La sección entera, lista para pintar. */
export interface VistaMeteo {
  readonly bloques: readonly BloqueMeteo[];
  /** Frase global. Solo aparece cuando **ningún** bloque tiene dato: si hay uno, habla él. */
  readonly resumen: string | undefined;
}

const SEGUNDOS_POR_MINUTO = 60;
const SEGUNDOS_POR_HORA = 3_600;
const SEGUNDOS_POR_DIA = 86_400;

/** «1 minuto» / «7 minutos», sin que el singular delate una plantilla. */
function plural(cantidad: number, singular: string, pluralizado: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : pluralizado}`;
}

/**
 * Una antigüedad como se dice en voz alta: «3 h 10 min», «12 min», «2 días 4 h».
 *
 * Se escribe **completa hasta el minuto** dentro del día porque es la escala en la que se decide
 * si el dato sirve: «hace unas horas» vale para un titular y no para saber si el viento que
 * enseña la página es el que hay en la playa.
 */
export function antiguedad(segundos: number): string {
  const enteros = Math.max(0, Math.floor(segundos));
  if (enteros < SEGUNDOS_POR_MINUTO) {
    return "menos de un minuto";
  }
  if (enteros < SEGUNDOS_POR_HORA) {
    return plural(Math.floor(enteros / SEGUNDOS_POR_MINUTO), "minuto", "minutos");
  }
  if (enteros < SEGUNDOS_POR_DIA) {
    const horas = Math.floor(enteros / SEGUNDOS_POR_HORA);
    const minutos = Math.floor((enteros % SEGUNDOS_POR_HORA) / SEGUNDOS_POR_MINUTO);
    return minutos === 0 ? `${horas} h` : `${horas} h ${minutos} min`;
  }
  const dias = Math.floor(enteros / SEGUNDOS_POR_DIA);
  const horas = Math.floor((enteros % SEGUNDOS_POR_DIA) / SEGUNDOS_POR_HORA);
  const cabeza = plural(dias, "día", "días");
  return horas === 0 ? cabeza : `${cabeza} ${horas} h`;
}

/**
 * Edad real del dato en el instante en que se pinta: lo que dijo el servidor **más** lo que ha
 * pasado desde que su respuesta llegó. Ver la regla 2 de la cabecera.
 */
function edadSegundos(ageSeconds: number, recibidoEnMs: number, ahoraMs: number): number {
  return ageSeconds + Math.max(0, ahoraMs - recibidoEnMs) / 1_000;
}

/**
 * Lo que hace falta para sellar una fuente que respondió. Es un tipo propio y no
 * `Extract<SourceReport<…>>` porque el boletín sella igual pero **no anida** su dato: el estado va
 * en la raíz de su respuesta (ver `BulletinPayload`). Lo común de las tres fuentes son estos tres
 * campos, y son los que pide esta función.
 */
interface FuenteServida {
  readonly fetchedAt: string;
  readonly ageSeconds: number;
  readonly stale: boolean;
}

/** El sello de una fuente que sí respondió (fresca o servida de caché caducada). */
function selloDeFuente(
  report: FuenteServida,
  fuente: string,
  contexto: { readonly recibidoEnMs: number; readonly ahoraMs: number; readonly zona: string },
): SelloDeAntiguedad {
  const edad = edadSegundos(report.ageSeconds, contexto.recibidoEnMs, contexto.ahoraMs);
  const consultadoALas = hora(Date.parse(report.fetchedAt), contexto.zona);
  if (!report.stale) {
    return {
      clase: "fresco",
      titular: `Consultado hace ${antiguedad(edad)}`,
      detalle: `${fuente} respondió a las ${consultadoALas}.`,
    };
  }
  return {
    clase: "caducado",
    titular: `Dato de hace ${antiguedad(edad)}`,
    detalle:
      `No es de ahora: ${fuente} no responde en este momento y se está sirviendo lo último que ` +
      `se pudo guardar, de las ${consultadoALas}.`,
  };
}

/** El sello de una fuente que no dio nada. El motivo es **el del backend**, tal cual. */
function selloSinDato(motivo: string): SelloDeAntiguedad {
  return { clase: "sin-dato", titular: "No se ha podido traer", detalle: motivo };
}

/** Una fila con valor. */
function fila(titulo: string, valor: string, detalle?: string): FilaMeteo {
  return { titulo, valor, detalle, ausencia: undefined };
}

/** Una fila sin valor, que dice **cuál** de los ausentes es. */
function filaAusente(titulo: string, ausencia: string): FilaMeteo {
  return { titulo, valor: undefined, detalle: undefined, ausencia };
}

/** Hueco del modelo: la fuente respondió, pero no publica ese valor en esta celda. */
function huecoDelModelo(que: string): string {
  return `el modelo no publica ${que} en esta celda`;
}

/** Grados centígrados con coma decimal. */
function celsius(valor: number): string {
  return `${numero(valor, 1)} °C`;
}

/** Una velocidad de viento en kilómetros por hora. */
function kmh(valor: number): string {
  return `${numero(valor, 1)} km/h`;
}

/**
 * Una visibilidad. Open-Meteo la da en metros y llega a decenas de miles: «33,6 km» se lee y
 * «33600 m» hay que contarlo con el dedo. Por debajo del kilómetro —que es justo cuando la
 * visibilidad importa— se mantiene en metros, que es la unidad en la que se avisa de niebla.
 */
function visibilidad(metrosDeVisibilidad: number): string {
  return metrosDeVisibilidad >= 1_000
    ? `${numero(metrosDeVisibilidad / 1_000, 1)} km`
    : `${Math.round(metrosDeVisibilidad)} m`;
}

/**
 * El acompañante de una ola: de dónde viene y con qué periodo.
 *
 * Las direcciones de Open-Meteo son **de procedencia** (convenio meteorológico), y por eso se
 * escriben con «de»: «de 287° (ONO)» es de donde viene la mar, no hacia dónde va. Si el modelo no
 * publica alguna de las dos piezas se dice, en vez de acortar la frase y dejar creer que ese dato
 * no existe para nadie.
 */
function detalleDeOla(direccionDeg: number | null, periodoS: number | null): string {
  const direccion =
    direccionDeg === null ? "sin dirección en el modelo" : `de ${acimut(direccionDeg)}`;
  const periodo =
    periodoS === null ? "sin periodo en el modelo" : `periodo ${numero(periodoS, 1)} s`;
  return `${direccion} · ${periodo}`;
}

/** Una de las tres olas (total, mar de viento, mar de fondo). */
function filaDeOla(
  titulo: string,
  alturaM: number | null,
  direccionDeg: number | null,
  periodoS: number | null,
): FilaMeteo {
  if (alturaM === null) {
    return filaAusente(titulo, huecoDelModelo("la altura de esta ola"));
  }
  return fila(titulo, metros(alturaM, 2), detalleDeOla(direccionDeg, periodoS));
}

/** Instante al que se refiere el modelo. **No** es cuándo lo pedimos: eso lo dice el sello. */
function filaDelModelo(observedAt: string, zona: string): FilaMeteo {
  return fila("Momento al que se refiere", hora(Date.parse(observedAt), zona));
}

function filasDelMar(datos: MarineConditions, zona: string): readonly FilaMeteo[] {
  return [
    filaDeOla("Ola", datos.waveHeightM, datos.waveDirectionDeg, datos.wavePeriodS),
    filaDeOla(
      "Mar de viento",
      datos.windWaveHeightM,
      datos.windWaveDirectionDeg,
      datos.windWavePeriodS,
    ),
    filaDeOla(
      "Mar de fondo",
      datos.swellWaveHeightM,
      datos.swellWaveDirectionDeg,
      datos.swellWavePeriodS,
    ),
    datos.seaSurfaceTemperatureC === null
      ? filaAusente("Temperatura del agua", huecoDelModelo("la temperatura del agua"))
      : fila("Temperatura del agua", celsius(datos.seaSurfaceTemperatureC)),
    filaDelModelo(datos.observedAt, zona),
  ];
}

/** El acompañante del viento: de dónde viene y con qué rachas. */
function detalleDelViento(direccionDeg: number | null, rachasKmh: number | null): string {
  const direccion =
    direccionDeg === null ? "sin dirección en el modelo" : `de ${acimut(direccionDeg)}`;
  const rachas = rachasKmh === null ? "sin rachas en el modelo" : `rachas ${kmh(rachasKmh)}`;
  return `${direccion} · ${rachas}`;
}

function filasDeLaAtmosfera(datos: ForecastConditions, zona: string): readonly FilaMeteo[] {
  return [
    datos.windSpeedKmh === null
      ? filaAusente("Viento", huecoDelModelo("la velocidad del viento"))
      : fila(
          "Viento",
          kmh(datos.windSpeedKmh),
          detalleDelViento(datos.windDirectionDeg, datos.windGustsKmh),
        ),
    datos.pressureMslHpa === null
      ? filaAusente("Presión", huecoDelModelo("la presión al nivel del mar"))
      : fila("Presión", `${numero(datos.pressureMslHpa, 1)} hPa`),
    datos.visibilityM === null
      ? filaAusente("Visibilidad", huecoDelModelo("la visibilidad"))
      : fila("Visibilidad", visibilidad(datos.visibilityM)),
    datos.uvIndex === null
      ? filaAusente("Índice UV", huecoDelModelo("el índice UV"))
      : fila("Índice UV", numero(datos.uvIndex, 1)),
    filaDelModelo(datos.observedAt, zona),
  ];
}

interface Contexto {
  readonly recibidoEnMs: number;
  readonly ahoraMs: number;
  readonly zona: string;
}

/** Un bloque de Open-Meteo (mar o atmósfera) con su sello y sus filas, o su motivo. */
function bloqueDeFuente<T>(
  id: string,
  titulo: string,
  fuente: string,
  report: SourceReport<T>,
  filas: (datos: T, zona: string) => readonly FilaMeteo[],
  contexto: Contexto,
): BloqueMeteo {
  if (report.status === "unavailable") {
    return {
      id,
      titulo,
      sello: selloSinDato(report.reason),
      filas: [],
      cita: undefined,
      nota: undefined,
    };
  }
  return {
    id,
    titulo,
    sello: selloDeFuente(report, fuente, contexto),
    filas: filas(report.data, contexto.zona),
    cita: undefined,
    nota: undefined,
  };
}

/** Los dos bloques de Open-Meteo cuando el endpoint no llegó a contestar. */
function bloquesSinMeteo(motivo: string): readonly BloqueMeteo[] {
  return [
    {
      id: "meteo-mar",
      titulo: "Estado del mar",
      sello: selloSinDato(motivo),
      filas: [],
      cita: undefined,
      nota: undefined,
    },
    {
      id: "meteo-atmosfera",
      titulo: "Atmósfera",
      sello: selloSinDato(motivo),
      filas: [],
      cita: undefined,
      nota: undefined,
    },
  ];
}

/**
 * Por qué no hay boletín, dicho para quien lee la página y no para quien opera el servidor.
 *
 * Cuando la causa es la credencial de AEMET, el `reason` del backend por sí solo es un jeroglífico
 * («HTTP 401»): la explicación de verdad está en `credential`, que el módulo publica precisamente
 * para eso. Se compone la frase con los campos estructurados —no se copia el `message`, que va
 * dirigido a quien administra la instancia y trae instrucciones de renovación— y se conserva el
 * `reason` técnico detrás, para no esconder lo que dijo el servidor.
 */
function motivoDelBoletin(payload: Extract<BulletinPayload, { status: "unavailable" }>): string {
  const { credential, reason } = payload;
  const porLaCredencial = credencialQueImpide(credential.status, credential.expiresAt);
  return porLaCredencial === undefined
    ? reason
    : `${porLaCredencial} (el servidor informa: ${reason})`;
}

/** La frase de la credencial, o `undefined` si la credencial no es lo que estorba. */
function credencialQueImpide(estado: KeyStatus, caducaEn: string | undefined): string | undefined {
  if (estado === "missing") {
    return "Esta instancia de Mareia no tiene credencial de AEMET, así que no publica el boletín oficial.";
  }
  if (estado === "expired") {
    const cuando = caducaEn === undefined ? "" : ` el ${caducaEn.slice(0, 10)}`;
    return `La credencial de AEMET de esta instancia caducó${cuando}: hasta que se renueve no hay boletín oficial.`;
  }
  if (estado === "unreadable") {
    return "La credencial de AEMET de esta instancia no se puede leer, así que no se sabe si sigue vigente.";
  }
  return undefined;
}

/** Textos de un campo del documento de AEMET, que puede venir suelto, en objeto o en lista. */
function textosDe(valor: unknown): readonly string[] {
  if (typeof valor === "string") {
    return valor.trim() === "" ? [] : [valor.trim()];
  }
  if (Array.isArray(valor)) {
    return valor.flatMap((elemento) => textosDe(elemento));
  }
  if (typeof valor === "object" && valor !== null) {
    const registro = valor as Record<string, unknown>;
    return [...textosDe(registro["texto"]), ...textosDe(registro["zona"])];
  }
  return [];
}

/** Los campos del boletín costero que se citan, en el orden en que se leen. */
const CAMPOS_DEL_BOLETIN = [
  { clave: "aviso", rotulo: "Avisos" },
  { clave: "situacion", rotulo: "Situación" },
  { clave: "prediccion", rotulo: "Predicción" },
] as const;

/**
 * El texto oficial del boletín, **citado y no reescrito**.
 *
 * El esquema del boletín costero de AEMET sigue sin verificar (hace falta una API key y este
 * repositorio no tiene ninguna; ver el TODO de `aemet.ts`), así que la extracción es deliberadamente
 * tolerante con la forma y **honesta con el fracaso**: si el documento no trae ninguno de los campos
 * conocidos se devuelve vacío y el bloque lo dice, en vez de enseñar un trozo adivinado o, peor, un
 * hueco mudo.
 */
export function parrafosDelBoletin(documento: unknown): readonly ParrafoOficial[] {
  const primero = Array.isArray(documento) ? documento[0] : documento;
  if (typeof primero !== "object" || primero === null) {
    return [];
  }
  const registro = primero as Record<string, unknown>;
  return CAMPOS_DEL_BOLETIN.flatMap(({ clave, rotulo }) =>
    textosDe(registro[clave]).map((texto) => ({ rotulo, texto })),
  );
}

/** El pie de la cita: quién la firma, de qué zona habla y cuándo la emitió. */
function pieDeLaCita(zona: string, issuedAt: string | null, zonaHoraria: string): string {
  const emision =
    issuedAt === null
      ? "AEMET no declara la hora de elaboración en este documento"
      : `emitido a las ${hora(Date.parse(issuedAt), zonaHoraria)}`;
  return `AEMET · ${zona} · ${emision}`;
}

/** Advertencia sobre el propio boletín: de qué no estamos seguros al publicarlo. */
function notaDelBoletin(zonaVerificada: boolean, hayTexto: boolean): string | undefined {
  const avisos: string[] = [];
  if (!zonaVerificada) {
    avisos.push(
      "el código de zona de AEMET todavía no se ha comprobado contra su catálogo (hace falta una " +
        "credencial), así que puede no ser la zona que le corresponde a este puerto",
    );
  }
  if (!hayTexto) {
    avisos.push(
      "AEMET respondió, pero el documento no trae ninguno de los campos de texto conocidos: no se " +
        "reescribe ni se adivina lo que dice",
    );
  }
  return avisos.length === 0 ? undefined : `${avisos.join("; ")}.`;
}

const TITULO_BOLETIN = "Boletín marítimo de AEMET";

/** El bloque del boletín: cita oficial, o el motivo de que no la haya. */
function bloqueDelBoletin(traida: Traida<BulletinPayload>, contexto: Contexto): BloqueMeteo {
  const base = { id: "meteo-boletin", titulo: TITULO_BOLETIN, filas: [] as readonly FilaMeteo[] };
  if (!traida.ok) {
    return { ...base, sello: selloSinDato(traida.motivo), cita: undefined, nota: undefined };
  }
  const payload = traida.cuerpo;
  if (payload.status === "unavailable") {
    return {
      ...base,
      sello: selloSinDato(motivoDelBoletin(payload)),
      cita: undefined,
      nota: undefined,
    };
  }
  const parrafos = parrafosDelBoletin(payload.document);
  const zona = payload.zone;
  return {
    ...base,
    sello: selloDeFuente(payload, "AEMET", contexto),
    cita: {
      parrafos,
      pie: pieDeLaCita(zona?.name ?? "zona sin asignar", payload.issuedAt, contexto.zona),
    },
    nota: notaDelBoletin(zona?.verified ?? false, parrafos.length > 0),
  };
}

/**
 * La sección meteo lista para pintar.
 *
 * @param respuesta Lo que contestaron los dos endpoints y cuándo llegó al navegador.
 * @param ahoraMs Reloj del navegador al pintar. Solo se usa para medir intervalos (regla 2).
 * @param zonaHoraria Zona del puerto: las horas se escriben en la hora del sitio del que hablan.
 */
export function vistaMeteo(
  respuesta: RespuestaMeteo,
  ahoraMs: number,
  zonaHoraria: string,
): VistaMeteo {
  const contexto: Contexto = {
    recibidoEnMs: respuesta.recibidoEnMs,
    ahoraMs,
    zona: zonaHoraria,
  };
  const { meteo } = respuesta;
  const bloques = [
    ...(meteo.ok
      ? [
          bloqueDeFuente(
            "meteo-mar",
            "Estado del mar",
            "Open-Meteo",
            meteo.cuerpo.marine,
            filasDelMar,
            contexto,
          ),
          bloqueDeFuente(
            "meteo-atmosfera",
            "Atmósfera",
            "Open-Meteo",
            meteo.cuerpo.forecast,
            filasDeLaAtmosfera,
            contexto,
          ),
        ]
      : bloquesSinMeteo(meteo.motivo)),
    bloqueDelBoletin(respuesta.boletin, contexto),
  ];

  const sinNadaQueEnsenar = bloques.every((bloque) => bloque.sello.clase === "sin-dato");
  return {
    bloques,
    resumen: sinNadaQueEnsenar
      ? "Ahora mismo no hay estado del mar que enseñar. Debajo, de cada fuente, el motivo."
      : undefined,
  };
}
