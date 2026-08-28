/**
 * El **contrato de respuesta** de los dos endpoints del módulo, separado de quien los sirve.
 *
 * Estaba dentro de `module.ts` hasta T-11, y ahí no podía quedarse: `module.ts` importa Express, y
 * quien más necesita estos tipos ahora es la **UI** del módulo, que se construye con Astro en un
 * proceso Node que no tiene Express instalado. Un `import type` se borra al compilar, pero el
 * *typechecker* sí resuelve la cadena entera de imports, así que la separación es real y no
 * cosmética.
 *
 * La consecuencia buena es de diseño: el contrato de lo que sale por el cable deja de depender del
 * framework HTTP que lo saca. Cualquier consumidor —la web, un cliente, un test— puede tipar la
 * respuesta sin montar un servidor.
 */

import type { Attribution } from "@mareia/module-contract";

import type { AemetKeyState } from "./aemet-key.ts";
import type { Cell } from "./cell.ts";
import type { ForecastConditions, MarineConditions } from "./open-meteo.ts";
import type { SourceReport } from "./source.ts";
import type { CoastalZone } from "./zones.ts";

/** Lo mínimo que el módulo necesita saber de un puerto: dónde está. */
export interface PortLocation {
  readonly slug: string;
  readonly lat: number;
  readonly lon: number;
}

/** Respuesta de `GET .../weather?port=<slug>`. */
export interface WeatherPayload {
  readonly port: PortLocation;
  /**
   * Celda de la malla a la que corresponde el dato: dice a qué punto se le pidió, no solo qué se
   * pidió. **Cuándo** no va aquí sino en cada fuente (`fetchedAt`, `ageSeconds`, `stale` y el
   * `observedAt` del dato): marine y forecast se refrescan por separado y pueden traer instantes
   * distintos, así que un único instante en la raíz solo podría ser verdad para una de las dos.
   */
  readonly cell: Cell;
  /** `partial` = una de las dos fuentes respondió; `unavailable` = ninguna. */
  readonly status: "ok" | "partial" | "unavailable";
  readonly marine: SourceReport<MarineConditions>;
  readonly forecast: SourceReport<ForecastConditions>;
  readonly attributions: readonly Attribution[];
}

/** Datos del boletín, cuando AEMET responde. */
export interface BulletinData {
  readonly issuedAt: string | null;
  readonly document: unknown;
}

/**
 * Respuesta de `GET .../bulletin?port=<slug>`.
 *
 * Aquí el estado va **en la raíz** y no anidado como en `weather`: hay una sola fuente, y quien
 * consume el boletín pregunta antes que nada si lo hay. Sin clave de AEMET esto es
 * `{"status": "unavailable", "reason": "..."}` con HTTP 200: la instancia funciona, lo que falta es
 * una credencial, y eso no es un error del cliente ni una caída del servidor.
 */
export type BulletinPayload = {
  readonly port: { readonly slug: string };
  /** `null` si el puerto no tiene zona marítima asignada en `aemet-zones.json`. */
  readonly zone: CoastalZone | null;
  readonly attributions: readonly Attribution[];
  /**
   * Estado de la credencial de AEMET. Viaja siempre, también cuando el boletín sale bien: quien
   * opera la instancia se entera de que la clave muere **antes** de que empiece a fallar, y quien
   * consume el API puede decir por qué dejó de haber boletín.
   */
  readonly credential: AemetKeyState;
} & (
  | {
      readonly status: "ok";
      readonly fetchedAt: string;
      readonly ageSeconds: number;
      readonly stale: boolean;
      readonly issuedAt: string | null;
      readonly document: unknown;
    }
  | { readonly status: "unavailable"; readonly reason: string }
);
