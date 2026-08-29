/**
 * El módulo `fishing`: el primero que aporta **interfaz** a la página de puerto.
 *
 * Cumple el contrato `AppModule` de `@mareia/module-contract`, así que darlo de alta en el portal
 * es añadirlo al array de `apps/web/src/modules.config.ts` y darlo de baja es **borrar esa línea**
 * (con su test: la página sigue construyendo sin él).
 *
 * No tiene parte servidor (`api`): los periodos solunares ya los sirve el core en `/v1/sky/solunar`
 * (T-07) con el mismo caso de uso que consume esta sección. Un router aquí sería un segundo camino
 * al mismo dato, y dos caminos se desincronizan.
 *
 * **No declara `isEnabledForPort`**: la Luna sale en los doce puertos del catálogo y en los que
 * vengan. Un filtro que siempre dice que sí es una condición que nadie prueba.
 */

import type { AppModule, Attribution, PageSection } from "@mareia/module-contract";

import { URL_METODOLOGIA_SOLUNAR } from "./textos.ts";

/** Versión del módulo, publicada en `/v1/modules`. Va a la par con su `package.json`. */
export const FISHING_MODULE_VERSION = "0.1.0";

/**
 * Clave lógica de la sección. El contrato identifica los componentes por **cadena** para no
 * depender de ningún framework de UI; esta constante existe para que el módulo y el mapa de
 * renderizadores de la superficie (`apps/web/src/secciones.ts`) no se escriban la cadena por
 * separado y se desincronicen en el primer renombrado.
 */
export const SECCION_ACTIVIDAD_SOLUNAR = "@mareia/module-fishing/sections/ActividadSolunar";

/** Ancla de la sección en la página (`#actividad-solunar`). */
export const ID_SECCION_ACTIVIDAD = "actividad-solunar";

/**
 * Atribuciones del módulo. La teoría solunar es de dominio público (Knight, 1926) y **no es una
 * fuente de datos**: no se le inventa una URL ni una licencia. Lo que sí hay que citar es de dónde
 * salen los números — el motor de efemérides, y nuestro propio cálculo, que es código público.
 */
export const ATRIBUCIONES_FISHING: readonly [Attribution, ...Attribution[]] = [
  {
    name: "Mareia · cálculo solunar propio",
    url: URL_METODOLOGIA_SOLUNAR,
    license: "AGPL-3.0-or-later",
  },
  {
    name: "Astronomy Engine",
    url: "https://github.com/cosinekitty/astronomy",
    license: "MIT",
  },
];

/**
 * La sección que el módulo aporta a la página de puerto.
 *
 * `order: 20` la coloca **después** del bloque crítico del almanaque (tabla del día, curva, sol y
 * luna) y antes de la tabla mensual: la actividad solunar es información contextual y no compite
 * con la marea, que es a lo que se viene (design-brief §1). Los órdenes por debajo de 10 quedan
 * libres para un módulo que algún día tenga que avisar de algo por encima del dato.
 */
export const SECCION_ACTIVIDAD: PageSection = {
  id: ID_SECCION_ACTIVIDAD,
  order: 20,
  renderMode: "static",
  component: SECCION_ACTIVIDAD_SOLUNAR,
};

/**
 * El módulo, listo para el registry. Sin dependencias que inyectar: no lee nada del entorno.
 *
 * **No declara `offline` (T-12) y eso es exacto, no un olvido**: los periodos solunares se calculan
 * en build y viajan dentro del HTML de la página, así que esta sección se lee sin red porque ya
 * está ahí. No hay ninguna URL suya que precachear; declarar una política vacía sería decir que
 * este módulo tiene algo que guardar, y no lo tiene.
 */
export const fishingModule: AppModule = {
  id: "fishing",
  version: FISHING_MODULE_VERSION,
  attributions: ATRIBUCIONES_FISHING,
  pageSections: [SECCION_ACTIVIDAD],
};
