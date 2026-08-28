/**
 * Aviso de caducidad de la API key de AEMET, para cron de CI.
 *
 * AEMET emite claves con 3 meses de vida y el alta está detrás de un reCAPTCHA: renovarla es un
 * trámite humano de diez minutos que **hay que recordar**. Este script no renueva nada; su único
 * trabajo es que la fecha no llegue por sorpresa: lee la caducidad del propio JWT —sin gastar una
 * petición a AEMET— y sale con error cuando toca actuar, para que el workflow que lo invoca abra
 * el aviso donde el humano lo va a ver.
 *
 * Uso: `deno run --allow-env scripts/check-aemet-key.ts`
 *
 * Salida: 0 = nada que hacer · 1 = hace falta que un humano renueve la clave.
 */

import { inspectAemetKey, needsHumanAction } from "../packages/modules/weather/src/aemet-key.ts";

const state = inspectAemetKey(Deno.env.get("AEMET_API_KEY"), Date.now());

const RENEWAL_STEPS = [
  "1. Entra en https://opendata.aemet.es/centrodedescargas/altaUsuario y pide una clave con tu email.",
  "2. Confirma el enlace del primer correo; la clave llega en un segundo correo.",
  "3. Actualiza el secreto AEMET_API_KEY (repositorio y despliegue) con la clave nueva.",
].join("\n");

console.log(`[aemet-key] ${state.status}: ${state.message}`);

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
