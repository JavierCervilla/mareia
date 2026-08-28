/**
 * Caducidad de la API key de AEMET, leída **sin llamar a la API**.
 *
 * Contexto (verificado el 2026-08-28 en https://opendata.aemet.es/centrodedescargas/novedades):
 *
 * - **16/07/2026**: «todas las nuevas API Keys que se soliciten tendrán una caducidad de 3 meses
 *   desde su fecha de creación».
 * - **20/07/2026**: «a partir del 15 de octubre de 2026, las API Keys emitidas sin fecha de
 *   expiración dejarán de ser válidas y provocarán errores de autenticación (401)».
 *
 * La clave es un JWT, así que el instante de caducidad viaja en su propio payload (`exp`) y se lee
 * en local: cero peticiones para saber cuánto queda. El alta de una clave nueva está detrás de un
 * reCAPTCHA y de un flujo de dos correos, de modo que **renovarla es un acto humano**; lo que el
 * software puede hacer —y hace aquí— es no dejar que la fecha llegue por sorpresa.
 *
 * Cuando la clave no declara `exp` (las emitidas antes del cambio de política) no se la trata como
 * eterna: se le asigna la fecha límite anunciada por AEMET. Preferimos avisar de una muerte cierta
 * a callar por falta de un campo.
 */

/** Fecha en que AEMET invalida las claves sin `exp`. Anunciada el 20/07/2026. */
export const LEGACY_KEYS_DIE_AT_MS = Date.UTC(2026, 9, 15, 0, 0, 0);

/**
 * Escalones de aviso, del más holgado al más urgente. El primero da tres semanas para un trámite
 * de diez minutos; el último es el último aviso antes de que el boletín empiece a fallar.
 *
 * El escalón **se publica** en el estado (`thresholdDays`) porque quien avisa necesita saber si
 * este cruce es nuevo: avisar a diario desde D-21 no es avisar tres veces, es ruido, y el canal
 * que existe para que algo se note es el primero que se deja de mirar cuando repite.
 */
export const WARNING_THRESHOLDS_DAYS = [21, 7, 1] as const;

/** Escalón alcanzado. `0` = ya caducada, que es su propio escalón (y el único que repite cada día). */
export type WarningThreshold = (typeof WARNING_THRESHOLDS_DAYS)[number] | 0;

const MS_PER_DAY = 86_400_000;

/** Por qué se conoce (o no) la fecha de caducidad. Viaja en la respuesta: el motivo importa. */
export type ExpirySource =
  /** El JWT declara `exp`: es la fecha real de la clave. */
  | "jwt-exp"
  /** El JWT no declara `exp`: se aplica la fecha límite anunciada por AEMET para las antiguas. */
  | "aemet-legacy-deadline";

/** Estado de la credencial. `missing` no es un error: es una instancia sin AEMET configurada. */
export type KeyStatus = "missing" | "unreadable" | "valid" | "expiring" | "expired";

export interface AemetKeyState {
  readonly status: KeyStatus;
  /** Instante de caducidad en epoch ms. Ausente si no hay clave o no se pudo leer. */
  readonly expiresAtMs?: number;
  readonly expiresAt?: string;
  /** Días completos que faltan. Negativo si ya caducó. */
  readonly daysLeft?: number;
  readonly source?: ExpirySource;
  /**
   * Escalón de aviso alcanzado, si alguno. Es el número con el que quien avisa decide si este
   * cruce ya lo contó: mientras el escalón no cambie, no hay noticia nueva que dar.
   */
  readonly thresholdDays?: WarningThreshold;
  /** Frase lista para un humano: la que va al aviso, al log y a la respuesta. */
  readonly message: string;
}

/** Decodifica el payload de un JWT sin verificar la firma: aquí solo se lee una fecha propia. */
function readJwtPayload(token: string): Record<string, unknown> | undefined {
  const segments = token.split(".");
  if (segments.length !== 3) return undefined;
  const payload = segments[1];
  if (payload === undefined) return undefined;
  try {
    const normalised = payload.replaceAll("-", "+").replaceAll("_", "/");
    const decoded = atob(normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "="));
    const parsed: unknown = JSON.parse(decoded);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function daysBetween(fromMs: number, toMs: number): number {
  return Math.floor((toMs - fromMs) / MS_PER_DAY);
}

/**
 * Estado de la clave en un instante dado. `nowMs` entra por parámetro: esta función es pura y el
 * reloj es del llamante, como en el resto del dominio.
 */
export function inspectAemetKey(rawKey: string | undefined, nowMs: number): AemetKeyState {
  const key = rawKey?.trim();
  if (key === undefined || key === "") {
    return {
      status: "missing",
      message:
        "AEMET no está configurada en esta instancia (falta AEMET_API_KEY): el boletín oficial no se publica",
    };
  }

  const payload = readJwtPayload(key);
  if (payload === undefined) {
    return {
      status: "unreadable",
      message:
        "La AEMET_API_KEY no tiene forma de JWT: no se puede saber cuándo caduca. Compruébala en opendata.aemet.es",
    };
  }

  const exp = payload["exp"];
  if (exp !== undefined && (typeof exp !== "number" || !Number.isFinite(exp))) {
    // Un `exp` presente pero con otra forma (una cadena, un null, un NaN) no es una clave sin
    // caducidad: es una clave que no entendemos. Inventarle la fecha de las antiguas sería
    // publicar un dato falso con aire de dato bueno.
    return {
      status: "unreadable",
      message:
        "La AEMET_API_KEY declara un `exp` que no es un número: no se puede saber cuándo caduca. Compruébala en opendata.aemet.es",
    };
  }
  const hasExp = typeof exp === "number" && Number.isFinite(exp);
  const expiresAtMs = hasExp ? exp * 1000 : LEGACY_KEYS_DIE_AT_MS;
  const source: ExpirySource = hasExp ? "jwt-exp" : "aemet-legacy-deadline";
  const daysLeft = daysBetween(nowMs, expiresAtMs);
  const expiresAt = new Date(expiresAtMs).toISOString();
  const origin = hasExp
    ? "según su propio campo `exp`"
    : "porque no declara `exp` y AEMET invalida esas claves el 15-10-2026";

  if (daysLeft < 0) {
    return {
      status: "expired",
      expiresAtMs,
      expiresAt,
      daysLeft,
      source,
      thresholdDays: 0,
      message: `La AEMET_API_KEY caducó hace ${Math.abs(daysLeft)} día(s) (${expiresAt}, ${origin}). Renuévala en opendata.aemet.es/centrodedescargas/altaUsuario y actualiza el secreto.`,
    };
  }

  // El escalón alcanzado es el MÁS URGENTE de los que ya se han cruzado: a 5 días el aviso es el
  // de 7, no el de 21. Ordenados de mayor a menor, el último que cumple es ese.
  const threshold = [...WARNING_THRESHOLDS_DAYS]
    .filter((limit) => daysLeft <= limit)
    .sort((a, b) => a - b)[0];
  if (threshold !== undefined) {
    return {
      status: "expiring",
      expiresAtMs,
      expiresAt,
      daysLeft,
      source,
      thresholdDays: threshold,
      message: `La AEMET_API_KEY caduca en ${daysLeft} día(s) (${expiresAt}, ${origin}). Pide una nueva en opendata.aemet.es/centrodedescargas/altaUsuario y actualiza el secreto antes de esa fecha.`,
    };
  }

  return {
    status: "valid",
    expiresAtMs,
    expiresAt,
    daysLeft,
    source,
    message: `La AEMET_API_KEY es válida ${daysLeft} día(s) más (${expiresAt}, ${origin}).`,
  };
}

/** ¿Merece este estado un aviso al humano? Lo usan el cron y el arranque del servidor. */
export function needsHumanAction(state: AemetKeyState): boolean {
  return state.status === "expiring" || state.status === "expired" || state.status === "unreadable";
}

function utcDay(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/**
 * Identidad del aviso: la unidad de repetición del canal que avisa al humano.
 *
 * Quien avisa (el cron) no debe repetir el mismo aviso, pero **sí** debe volver a hablar cuando lo
 * que hay que contar es distinto. Eso hace del identificador una decisión de diseño, no un detalle:
 *
 * - Lleva **la fecha de caducidad de la clave concreta**, así que una clave nueva estrena avisos
 *   aunque el aviso viejo siga por ahí. Sin eso, el segundo ciclo de renovación caduca en silencio:
 *   el peor fallo posible en un canal cuya única razón de ser es que se note.
 * - Mientras la clave solo *va a* caducar, la unidad es **el escalón**: 21, 7 y 1 son tres avisos,
 *   no veintidós.
 * - Cuando ya caducó —el boletín está roto ahora mismo— la unidad pasa a ser **el día**: aquí sí se
 *   insiste, porque el coste de repetirse es menor que el de que nadie mire.
 * - Una clave ilegible se trata como la caducada (se insiste a diario) y no se ata a ninguna fecha:
 *   justamente no sabemos cuál es.
 *
 * Devuelve `undefined` cuando no hay nada que avisar.
 */
export function noticeId(state: AemetKeyState, nowMs: number): string | undefined {
  if (state.status === "unreadable") return `aemet:ilegible:${utcDay(nowMs)}`;
  if (state.expiresAt === undefined) return undefined;
  if (state.status === "expired") return `aemet:${state.expiresAt}:vencida:${utcDay(nowMs)}`;
  if (state.status === "expiring" && state.thresholdDays !== undefined) {
    return `aemet:${state.expiresAt}:d${state.thresholdDays}`;
  }
  return undefined;
}
