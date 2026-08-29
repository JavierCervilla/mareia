/**
 * Composition root del proceso: qué escucha, en qué interfaz y en qué puerto.
 *
 * Levanta **dos** servidores sobre la misma app:
 *
 * - el **público** (`PORT`), que es el que Traefik enruta al dominio, servido a través de
 *   `createPublicApp()` — es decir, sin `/health` (ver `http/public-app.ts`);
 * - el **interno** (`HEALTH_PORT`), con la app entera, para que el healthcheck del contenedor y
 *   Dokploy pregunten por la salud desde dentro de la red del despliegue.
 *
 * Son dos puertos y no dos rutas porque lo que separa a los dos públicos es **quién puede llegar**,
 * y eso en Docker se dice con un puerto: el dominio declara el 8787 y del 8788 no sabe nadie fuera
 * de la red interna.
 */

// @ts-types="@types/express"
import type { Express } from "express";

import { createPublicApp } from "./http/public-app.ts";
import { createServer } from "./http/server.ts";

const DEFAULT_PORT = 8787;
const DEFAULT_HEALTH_PORT = 8788;

/**
 * Interfaz en la que se bindea. `0.0.0.0` explícito y no el defecto de Node **a propósito**: la
 * avería silenciosa de este despliegue es un proceso que bindea a la interfaz equivocada, arranca
 * sin quejarse, deja el contenedor `running` y hace que Traefik devuelva 502. Que la interfaz sea
 * un dato del arranque —y no una omisión— es lo que permite fijarla si el entorno cambia.
 */
const DEFAULT_HOST = "0.0.0.0";

function puertoDeEntorno(nombre: string, porDefecto: number): number {
  const bruto = Deno.env.get(nombre);
  if (bruto === undefined || bruto === "") {
    return porDefecto;
  }
  const puerto = Number(bruto);
  if (!Number.isInteger(puerto) || puerto < 0 || puerto > 65535) {
    throw new Error(`${nombre} inválido: ${bruto}`);
  }
  return puerto;
}

const port = puertoDeEntorno("PORT", DEFAULT_PORT);
const healthPort = puertoDeEntorno("HEALTH_PORT", DEFAULT_HEALTH_PORT);
const host = Deno.env.get("HOST") || DEFAULT_HOST;

// Con los dos puertos iguales, el segundo `listen` fallaría con EADDRINUSE **después** de que el
// primero ya sirviera: el proceso quedaría medio en pie y el motivo, enterrado en un stack trace.
if (port === healthPort && port !== 0) {
  throw new Error(
    `PORT y HEALTH_PORT no pueden ser el mismo puerto (${port}): el healthcheck ` +
      `vive aparte justamente para que el dominio no lo publique`,
  );
}

const app = createServer();

/**
 * Anuncia dónde escucha de verdad **leyéndolo del socket** (`address()`), no repitiendo la
 * constante de arriba. Un banner escrito a mano puede decir `0.0.0.0` mientras el proceso bindea a
 * otro sitio, y entonces deja de ser una prueba y pasa a ser una opinión. Misma disciplina que el
 * arranque de la web (`apps/web/docker-entrypoint.sh`).
 */
function anunciar(server: ReturnType<Express["listen"]>, etiqueta: string): () => void {
  return () => {
    const address = server.address();
    const donde = address === null || typeof address === "string"
      ? String(address)
      : `${address.address}:${address.port}`;
    // eslint-disable-next-line no-console -- banner de arranque: única salida a stdout del proceso
    console.info(`[mareia-api] ${etiqueta}: ${donde}`);
  };
}

const publico = createPublicApp(app).listen(port, host);
publico.once("listening", anunciar(publico, "público (sin /health)"));

const interno = app.listen(healthPort, host);
interno.once("listening", anunciar(interno, "interno (/health)"));
