/**
 * Caducidad de la clave de AEMET: se lee del JWT, sin red, y nunca se calla una muerte cierta.
 *
 * Las claves de prueba se construyen aquí firmando con una firma falsa a propósito: este código
 * **no verifica firmas**, solo lee una fecha del payload, y montar el token a mano deja explícito
 * qué está mirando (y evita meter una credencial real en el repositorio).
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectAemetKey,
  LEGACY_KEYS_DIE_AT_MS,
  needsHumanAction,
  noticeId,
} from "../aemet-key.ts";

/** Un JWT sintético: cabecera y firma de relleno, el payload es lo único que se lee. */
function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (value: unknown): string =>
    btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.firma-de-prueba`;
}

const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);
const day = 86_400_000;

test("sin clave configurada, la instancia lo dice sin tratarlo como avería", () => {
  const state = inspectAemetKey(undefined, NOW);
  assert.equal(state.status, "missing");
  assert.match(state.message, /AEMET_API_KEY/);
  assert.equal(needsHumanAction(state), false);
});

test("una clave que no es un JWT se declara ilegible, no válida", () => {
  const state = inspectAemetKey("esto-no-es-un-jwt", NOW);
  assert.equal(state.status, "unreadable");
  assert.equal(needsHumanAction(state), true);
});

test("con `exp` lejano la clave es válida y dice cuántos días le quedan", () => {
  const state = inspectAemetKey(fakeJwt({ exp: (NOW + 60 * day) / 1000 }), NOW);
  assert.equal(state.status, "valid");
  assert.equal(state.daysLeft, 60);
  assert.equal(state.source, "jwt-exp");
  assert.equal(needsHumanAction(state), false);
});

test("el escalón alcanzado es el más urgente cruzado, no el primero de la lista", () => {
  // Este es el test que faltaba cuando el escalonado era una lista decorativa: a 5 días el aviso
  // que toca es el de 7, no el de 21, y a 21 justos es el de 21.
  assert.equal(inspectAemetKey(fakeJwt({ exp: (NOW + 21 * day) / 1000 }), NOW).thresholdDays, 21);
  assert.equal(inspectAemetKey(fakeJwt({ exp: (NOW + 8 * day) / 1000 }), NOW).thresholdDays, 21);
  assert.equal(inspectAemetKey(fakeJwt({ exp: (NOW + 7 * day) / 1000 }), NOW).thresholdDays, 7);
  assert.equal(inspectAemetKey(fakeJwt({ exp: (NOW + 5 * day) / 1000 }), NOW).thresholdDays, 7);
  assert.equal(inspectAemetKey(fakeJwt({ exp: (NOW + 1 * day) / 1000 }), NOW).thresholdDays, 1);
  // Caducada es su propio escalón: el único que sí insiste cada día.
  assert.equal(inspectAemetKey(fakeJwt({ exp: (NOW - 2 * day) / 1000 }), NOW).thresholdDays, 0);
  // Sin cruzar ningún escalón no hay escalón que contar.
  assert.equal(inspectAemetKey(fakeJwt({ exp: (NOW + 30 * day) / 1000 }), NOW).thresholdDays, undefined);
});

test("un `exp` que no es un número deja la clave ilegible, no la trata como antigua", () => {
  const state = inspectAemetKey(fakeJwt({ exp: "1790000000" }), NOW);
  assert.equal(state.status, "unreadable", "una fecha inventada con aire de buena es peor que no saber");
  assert.equal(state.expiresAtMs, undefined);
});

test("a 21 días o menos empieza a pedir acción humana", () => {
  const veintiuno = inspectAemetKey(fakeJwt({ exp: (NOW + 21 * day) / 1000 }), NOW);
  assert.equal(veintiuno.status, "expiring");
  assert.equal(needsHumanAction(veintiuno), true);
  assert.match(veintiuno.message, /opendata\.aemet\.es/);

  const veintidos = inspectAemetKey(fakeJwt({ exp: (NOW + 22 * day) / 1000 }), NOW);
  assert.equal(veintidos.status, "valid", "a 22 días todavía no se molesta a nadie");
});

test("una clave caducada lo dice con los días que lleva muerta", () => {
  const state = inspectAemetKey(fakeJwt({ exp: (NOW - 3 * day) / 1000 }), NOW);
  assert.equal(state.status, "expired");
  assert.equal(state.daysLeft, -3);
  assert.match(state.message, /caducó hace 3 día/);
});

test("una clave SIN `exp` no se toma por eterna: hereda la fecha límite de AEMET", () => {
  const state = inspectAemetKey(fakeJwt({ sub: "alguien@ejemplo.es", iat: 1_700_000_000 }), NOW);
  assert.equal(state.source, "aemet-legacy-deadline");
  assert.equal(state.expiresAtMs, LEGACY_KEYS_DIE_AT_MS);
  assert.match(state.message, /15-10-2026/);
});

test("la fecha límite de las claves antiguas es el 15 de octubre de 2026", () => {
  assert.equal(new Date(LEGACY_KEYS_DIE_AT_MS).toISOString(), "2026-10-15T00:00:00.000Z");
});

test("el estado se calcula con el reloj que se le pasa, no con el del sistema", () => {
  const key = fakeJwt({ exp: (NOW + 30 * day) / 1000 });
  assert.equal(inspectAemetKey(key, NOW).status, "valid");
  assert.equal(inspectAemetKey(key, NOW + 25 * day).status, "expiring");
  assert.equal(inspectAemetKey(key, NOW + 31 * day).status, "expired");
});

/**
 * El canal de aviso, simulado entero: un cron que corre cada día y solo habla cuando el
 * identificador del aviso es nuevo. Es exactamente la regla que aplica el workflow, y aquí se
 * puede recorrer una vida de clave completa —o dos seguidas— en milisegundos.
 */
function avisosEmitidos(
  claves: readonly { readonly key: string; readonly desdeMs: number; readonly hastaMs: number }[],
  yaContados: Set<string>,
): string[] {
  const emitidos: string[] = [];
  for (const { key, desdeMs, hastaMs } of claves) {
    for (let nowMs = desdeMs; nowMs <= hastaMs; nowMs += day) {
      const id = noticeId(inspectAemetKey(key, nowMs), nowMs);
      if (id === undefined || yaContados.has(id)) continue;
      yaContados.add(id);
      emitidos.push(id);
    }
  }
  return emitidos;
}

test("una clave que solo va a caducar avisa tres veces en su vida, no una por día", () => {
  const expiraMs = Date.UTC(2026, 10, 1);
  const clave = fakeJwt({ exp: expiraMs / 1000 });
  const emitidos = avisosEmitidos(
    [{ key: clave, desdeMs: expiraMs - 40 * day, hastaMs: expiraMs - day }],
    new Set(),
  );

  // 21, 7 y 1: los tres escalones, y ni un aviso más en las cuarenta mañanas que corre el cron.
  assert.deepEqual(emitidos, [
    "aemet:2026-11-01T00:00:00.000Z:d21",
    "aemet:2026-11-01T00:00:00.000Z:d7",
    "aemet:2026-11-01T00:00:00.000Z:d1",
  ]);
});

test("caducada, el aviso SÍ insiste: uno por día mientras el boletín siga roto", () => {
  const expiraMs = Date.UTC(2026, 10, 1);
  const clave = fakeJwt({ exp: expiraMs / 1000 });
  const emitidos = avisosEmitidos(
    [{ key: clave, desdeMs: expiraMs + day, hastaMs: expiraMs + 3 * day }],
    new Set(),
  );

  assert.deepEqual(emitidos, [
    "aemet:2026-11-01T00:00:00.000Z:vencida:2026-11-02",
    "aemet:2026-11-01T00:00:00.000Z:vencida:2026-11-03",
    "aemet:2026-11-01T00:00:00.000Z:vencida:2026-11-04",
  ]);
});

test("la clave renovada estrena avisos aunque los del ciclo anterior sigan a la vista", () => {
  // El fallo que esto impide: si el identificador solo llevara el escalón, las marcas del ciclo
  // anterior taparían los tres escalones del siguiente y la clave nueva caducaría en silencio.
  const primera = Date.UTC(2026, 10, 1);
  const segunda = Date.UTC(2027, 1, 1);
  const yaContados = new Set<string>();

  const ciclo1 = avisosEmitidos(
    [{ key: fakeJwt({ exp: primera / 1000 }), desdeMs: primera - 30 * day, hastaMs: primera - day }],
    yaContados,
  );
  const ciclo2 = avisosEmitidos(
    [{ key: fakeJwt({ exp: segunda / 1000 }), desdeMs: segunda - 30 * day, hastaMs: segunda - day }],
    yaContados,
  );

  assert.equal(ciclo1.length, 3);
  assert.equal(ciclo2.length, 3);
  assert.ok(ciclo2.every((id) => id.includes("2027-02-01")));
});

test("una clave ilegible insiste a diario y no se ata a ninguna fecha de caducidad", () => {
  const primero = noticeId(inspectAemetKey("esto-no-es-un-jwt", NOW), NOW);
  const mismoDia = noticeId(inspectAemetKey("esto-no-es-un-jwt", NOW + 3600_000), NOW + 3600_000);
  const siguiente = noticeId(inspectAemetKey("esto-no-es-un-jwt", NOW + day), NOW + day);

  assert.equal(primero, "aemet:ilegible:2026-08-28");
  assert.equal(mismoDia, primero);
  assert.equal(siguiente, "aemet:ilegible:2026-08-29");
});

test("lo que no pide acción humana no genera aviso: ni sin clave ni con clave sana", () => {
  assert.equal(noticeId(inspectAemetKey(undefined, NOW), NOW), undefined);
  assert.equal(noticeId(inspectAemetKey(fakeJwt({ exp: (NOW + 90 * day) / 1000 }), NOW), NOW), undefined);
});
