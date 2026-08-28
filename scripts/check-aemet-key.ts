/**
 * Aviso de caducidad de la API key de AEMET, para cron de CI.
 *
 * AEMET emite claves con 3 meses de vida y el alta está detrás de un reCAPTCHA: renovarla es un
 * trámite humano de diez minutos que **hay que recordar**. Este script no renueva nada; su único
 * trabajo es que la fecha no llegue por sorpresa: lee la caducidad del propio JWT —sin gastar una
 * petición a AEMET— y sale con error cuando toca actuar, para que el workflow que lo invoca abra
 * el aviso donde el humano lo va a ver.
 *
 * Uso: `deno run --allow-env=AEMET_API_KEY scripts/check-aemet-key.ts`
 *
 * Salida: 0 = nada que hacer · 1 = hace falta que un humano renueve la clave.
 *
 * Imprime tres líneas maquinales que el workflow lee (y filtra antes de enseñarle nada al humano):
 *
 * - `estado=` el `KeyStatus`, que es lo que decide si un aviso abierto puede darse por cerrado.
 * - `escalon=` el escalón alcanzado, solo informativo.
 * - `aviso_id=` **la identidad del aviso**, que es lo que evita repetirse: lleva la caducidad de
 *   esta clave concreta, así que una clave renovada estrena avisos en vez de heredar el silencio
 *   de los del ciclo anterior.
 */

import { inspectAemetKey, needsHumanAction, noticeId } from "../packages/modules/weather/src/aemet-key.ts";

const now = Date.now();
const state = inspectAemetKey(Deno.env.get("AEMET_API_KEY"), now);

const RENEWAL_STEPS = [
  "1. Entra en https://opendata.aemet.es/centrodedescargas/altaUsuario y pide una clave con tu email.",
  "2. Confirma el enlace del primer correo; la clave llega en un segundo correo.",
  "3. Actualiza el secreto AEMET_API_KEY (repositorio y despliegue) con la clave nueva.",
].join("\n");

console.log(`[aemet-key] ${state.status}: ${state.message}`);
console.log(`estado=${state.status}`);
// `unreadable` no tiene escalón de días: es su propio caso urgente.
console.log(`escalon=${state.thresholdDays ?? (state.status === "unreadable" ? "ilegible" : "")}`);
console.log(`aviso_id=${noticeId(state, now) ?? ""}`);

if (state.status === "missing") {
  // Sin clave la instancia ya degrada de forma explícita y el healthcheck lo dice. No es un fallo
  // del cron: es una instancia que no publica boletines oficiales, y eso es una decisión válida.
  Deno.exit(0);
}

if (needsHumanAction(state)) {
  console.error(`\nHace falta acción humana:\n${RENEWAL_STEPS}`);
  Deno.exit(1);
}

Deno.exit(0);
