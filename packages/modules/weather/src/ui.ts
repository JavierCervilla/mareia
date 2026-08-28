/**
 * La cara del módulo `weather` en la página de puerto: qué secciones aporta y con qué identidad.
 *
 * Es el **punto de entrada del lado UI** (`@mareia/module-weather/ui`) y su regla es no arrastrar
 * servidor: aquí no se importa `module.ts` —ni por tanto Express— porque quien consume este
 * fichero es el build de la web, que corre en Node con Astro. La API sigue montando el módulo
 * entero por `createWeatherModule`, y las dos vistas comparten la misma versión y las mismas
 * atribuciones (`meta.ts`), que es lo que impide que la sección diga una cosa y `/v1/modules` otra.
 *
 * El componente se identifica por **una cadena**, no por una referencia: es lo que exige el
 * contrato `AppModule` (T-06) para no depender de ningún framework de UI. Quien la resuelve es la
 * superficie que renderiza —`apps/web/src/secciones.ts`—, así que el `.astro` de la sección vive
 * allí y este package sigue siendo TypeScript puro, sin toolchain de Astro. El precio, consciente:
 * dar de alta un módulo con interfaz toca dos sitios (el registry y el mapa de renderizadores) en
 * vez de uno.
 */

import type { AppModule, PageSection } from "@mareia/module-contract";

import { WEATHER_ATTRIBUTIONS, WEATHER_MODULE_VERSION } from "./meta.ts";

/**
 * Ruta lógica del componente de la sección meteo. Es la clave del mapa de renderizadores de la
 * superficie; se exporta para que ese mapa no la escriba a mano y no puedan desincronizarse.
 */
export const METEO_SECTION_COMPONENT = "@mareia/module-weather/sections/Meteo";

/**
 * Secciones que el módulo aporta a la página de puerto.
 *
 * `order: 20` la coloca donde le toca por la jerarquía del design brief: es información
 * **contextual** (se lee para saber con qué se va a encontrar quien llegue, no para decidir a qué
 * hora ir), así que va después de la marea y de las efemérides y antes de la tabla mensual.
 *
 * `renderMode: "island"` no es un detalle de implementación: declara que esta sección **cuesta
 * JavaScript de cliente**, y la razón está en `docs/adr/ADR-01`. Un dato que caduca en media hora
 * dentro de un HTML que se reconstruye una vez al día no puede sellar su propia antigüedad.
 */
export const WEATHER_PAGE_SECTIONS: readonly [PageSection, ...PageSection[]] = [
  { id: "meteo", order: 20, renderMode: "island", component: METEO_SECTION_COMPONENT },
];

/**
 * El módulo visto por una superficie de UI: identidad, atribuciones y secciones, **sin `api`**.
 *
 * Que no traiga `api` es exacto y no una amputación: el contrato declara `api` opcional
 * precisamente para que un módulo pueda ser solo-API, solo-UI o ambos según quién lo mire. La web
 * no puede construir la parte servidor —no tiene ni `fetch` inyectado, ni caché KV, ni la clave de
 * AEMET— y tampoco la necesita: el HTML no lleva meteo dentro (ADR-01), la pide el navegador.
 */
export const WEATHER_UI_MODULE: AppModule = {
  id: "weather",
  version: WEATHER_MODULE_VERSION,
  attributions: WEATHER_ATTRIBUTIONS,
  pageSections: WEATHER_PAGE_SECTIONS,
};

export type {
  BulletinData,
  BulletinPayload,
  PortLocation,
  WeatherPayload,
} from "./payload.ts";
export type { AemetKeyState, ExpirySource, KeyStatus } from "./aemet-key.ts";
export type { Cell } from "./cell.ts";
export type { ForecastConditions, MarineConditions } from "./open-meteo.ts";
export type { SourceReport } from "./source.ts";
export type { CoastalZone } from "./zones.ts";
