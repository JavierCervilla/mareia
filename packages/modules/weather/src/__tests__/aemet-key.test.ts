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
