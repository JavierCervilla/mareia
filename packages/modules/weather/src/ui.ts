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

import type { AppModule, PageSection, PrecachePolicy } from "@mareia/module-contract";

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
 * Prefijos de los dos endpoints del módulo, **relativos a la raíz del sitio**.
 *
 * Son prefijos y no URL completas porque las dos se piden con `?port=<slug>`: casar por igualdad no
 * acertaría nunca. Se escriben aquí, junto al módulo que los sirve, para que el service worker de
 * la PWA no tenga que conocer ninguna ruta de ningún módulo (T-12).
 */
export const WEATHER_ROUTE_PREFIXES: readonly [string, ...string[]] = [
  "/v1/modules/weather/weather",
  "/v1/modules/weather/bulletin",
];

/**
 * Política offline del módulo (contrato `AppModule.offline`, T-06; la consume la PWA en T-12).
 *
 * **`network-first`**: la meteo es el único dato del portal que caduca, así que con red se pide
 * siempre a la red y la copia guardada es exclusivamente la red de emergencia. Al revés
 * —`cache-first`— la sección enseñaría el estado del mar de anteayer teniendo cobertura, que es
 * justo lo que `docs/adr/ADR-01` existe para impedir.
 *
 * **No se declara `maxAgeSeconds`, y es una decisión, no un olvido.** Una edad máxima haría que el
 * worker tirase la copia vieja, y sin red una copia vieja **con su edad en la cara** es más útil
 * que un hueco: quien decide si un estado del mar de hace cinco horas le sirve es quien está en la
 * orilla, no el service worker. La ventana en la que el dato sigue siendo «el de ahora» ya la
 * publica este módulo (`MARINE_TTL_SECONDS` y compañía) y es el sello de la sección quien la
 * aplica, diciéndolo. Descartar en silencio sería la misma mentira de T-11 con otro disfraz.
 *
 * **Tampoco declara `assets`**: la sección no trae ningún fichero propio; su isla es un bundle de
 * Astro con hash, y esos los aporta la página al guardarse (ver `apps/web/src/pwa/precacheo.ts`).
 */
export const WEATHER_PRECACHE_POLICY: PrecachePolicy = {
  strategy: "network-first",
  routes: WEATHER_ROUTE_PREFIXES,
};

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
  offline: WEATHER_PRECACHE_POLICY,
};

/**
 * Las ventanas de frescura del módulo, también para la UI: la sección tiene que saber cuándo el
 * dato que ya pintó ha dejado de ser el de ahora, y ese umbral lo pone el módulo, no la página.
 */
export {
  BULLETIN_TTL_SECONDS,
  FORECAST_TTL_SECONDS,
  MARINE_TTL_SECONDS,
} from "./frescura.ts";

export type {
  BulletinData,
  BulletinPayload,
  PortLocation,
  WeatherPayload,
} from "./payload.ts";
export type {
  AemetKeyState,
  ExpirySource,
  KeyStatus,
  PublicCredentialView,
} from "./aemet-key.ts";

/**
 * La proyección pública del estado de la credencial, también del lado UI. No la usa la sección
 * —que pinta campos, no frases—, sino el gate que vigila los fixtures de boletín de la web: son
 * copias congeladas de lo que este módulo publica, y la única forma de comprobar que siguen siendo
 * esa proyección (y no un JSON editado a mano) es poder calcularla. Es lo que impidió que el
 * `daysLeft: -40` con 39 días transcurridos siguiera commiteado sin que nadie avisara (T-18/A-20).
 */
export { inspectAemetKey, publicCredentialView } from "./aemet-key.ts";

/**
 * El borde que produce el `reason` público —el mismo campo que la sección pinta detrás de «el
 * servidor informa: …»— también del lado UI, y por la misma razón: para que el gate de la pantalla
 * ataque **el texto que llega de verdad** en vez de una copia escrita a mano. Si alguien quitara el
 * filtro del borde, el recorrido de la web se pondría rojo donde duele, que es en lo que lee un
 * humano y no en un JSON (T-18/A-18).
 */
export { reasonFrom } from "./errors.ts";
export type { Cell } from "./cell.ts";
export type { ForecastConditions, MarineConditions } from "./open-meteo.ts";
export type { SourceReport } from "./source.ts";
export type { CoastalZone } from "./zones.ts";
