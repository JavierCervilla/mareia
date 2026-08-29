/**
 * La app **que se publica en el dominio**, que no es la misma que sirve el proceso.
 *
 * `createServer()` monta todo lo que este servicio sabe hacer, `/health` incluido. Pero el
 * healthcheck no es de nadie de fuera: dice qué versión del servicio corre y es la puerta por la
 * que, el día que se le conecte el `healthcheck()` de los módulos (ver `module.ts`), saldrían al
 * público el estado de las credenciales y los motivos de degradación de cada fuente. El dominio
 * publica **solo `/v1/*`**.
 *
 * El corte se hace **aquí, en el código, y también en el enrutado de Dokploy** — a propósito y no
 * por indecisión. En Dokploy es donde el corte es barato (el dominio declara la ruta `/v1` y
 * Traefik no manda nada más), pero es configuración que vive fuera del repositorio: el día que
 * alguien clone el servicio para otro entorno, o toque el dominio, el healthcheck vuelve a estar
 * en internet y **ningún test lo nota**. Esta capa hace que el proceso no lo publique aunque el
 * proxy le mande todo; `tests/e2e/produccion` comprueba el resultado contra el dominio real.
 *
 * Lo que NO hace: tocar `/v1`. Esta app envuelve a la de `createServer()` sin sustituirla, así
 * que ningún endpoint cambia de forma ni de contrato.
 */

// @ts-types="@types/express"
import express, { type Express, type NextFunction, type Request, type Response } from "express";

/** La ruta que no se publica. Coincide con la que monta `createServer()`. */
export const RUTA_HEALTH = "/health";

/**
 * Envuelve la app del servicio dejando `/health` fuera del alcance de quien llegue por aquí.
 *
 * `next("router")` sale del router **sin llegar a la app montada detrás**, y como no queda nada
 * más en la pila responde el manejador final de Express: exactamente el mismo 404 que devuelve
 * cualquier ruta que no existe. Es deliberado que sea *el mismo* y no un 404 propio: un cuerpo
 * distinto para `/health` confirmaría a quien sondea que esa ruta existe y está tapada, que es
 * justo la mitad del secreto que se intenta no dar.
 */
export function createPublicApp(app: Express): Express {
  const publico = express();
  publico.disable("x-powered-by");

  const rutas = express.Router();
  // `all` y no `get`: un HEAD o un POST a /health tampoco tienen por qué distinguirse.
  rutas.all(RUTA_HEALTH, (_req: Request, _res: Response, next: NextFunction) => next("router"));
  rutas.use(app);
  publico.use(rutas);

  return publico;
}
