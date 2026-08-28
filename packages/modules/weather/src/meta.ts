/**
 * Identidad publicable del módulo: su versión y sus atribuciones.
 *
 * Vive aparte de `module.ts` porque desde T-11 hay **dos** consumidores y solo uno de ellos tiene
 * servidor: la API monta el router de Express, y el build de la web (Node + Astro) necesita la
 * misma identidad —versión y atribuciones, que la sección pinta a la vista— sin arrastrar Express
 * ni el `Router`. Este fichero no importa nada que no sea una constante o un tipo.
 */

import type { Attribution } from "@mareia/module-contract";

import { AEMET_ATTRIBUTION } from "./aemet.ts";
import { OPEN_METEO_ATTRIBUTION } from "./open-meteo.ts";

/** Versión del módulo, publicada en `/v1/modules`. Debe ir a la par con su `package.json`. */
export const WEATHER_MODULE_VERSION = "0.1.0";

/**
 * Las dos fuentes del módulo. El tipo es una tupla no vacía porque lo exige `AppModule`: un módulo
 * sin atribuciones no compila.
 */
export const WEATHER_ATTRIBUTIONS: readonly [Attribution, ...Attribution[]] = [
  OPEN_METEO_ATTRIBUTION,
  AEMET_ATTRIBUTION,
];
