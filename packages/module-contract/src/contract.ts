/**
 * Contrato `AppModule`: lo único que un módulo (pesca, meteo, navegación) necesita cumplir para
 * enchufarse a Mareia. El core no conoce a ningún módulo concreto: solo este contrato.
 *
 * Regla de capas que sostiene todo esto (ver `eslint.config.mjs`, zona «capas»): `domain-core` y
 * `usecases` NO pueden importar módulos ni este contrato — el dominio es ciego a los módulos — y
 * este package no puede importar de `apps/*`. Por eso aquí no hay ni un `import`: sin Express, sin
 * Astro, sin dominio. Solo tipos.
 */

/**
 * Identificador estable de un módulo. Alta/baja de módulos = editar los `modules.config.ts`.
 *
 * La unión está **cerrada** para que dar de alta un módulo se vea en el diff de este archivo, y
 * `regulations` (T-19) es la primera vez que se ejerce esa puerta. La normativa de tallas mínimas
 * **no** entra colgada de `fishing` «para no tocar el contrato»: serían dos módulos con una sola
 * identidad, una sola versión y las atribuciones mezcladas —la teoría solunar y el BOE en la misma
 * lista—, y darlos de baja por separado dejaría de ser borrar una línea. Ampliar la unión es
 * exactamente para lo que está cerrada.
 *
 * `protected-areas` (T-21) es la **segunda** vez que se ejerce, y el motivo es el mismo con una
 * vuelta más: las áreas marinas protegidas de RAMPE no son ni pesca ni normativa. No son `fishing`
 * porque aquélla calcula una convención sin respaldo experimental y ésta publica un hecho de una
 * fuente oficial; y no son `regulations` porque el BOE fija qué talla ha de medir una pieza,
 * mientras que RAMPE solo dice qué espacios están protegidos y dónde caen — **no** qué se puede
 * hacer dentro, que vive en la declaración de cada espacio y aquí no se publica. Colgarla de
 * cualquiera de las dos metería en una sola lista de atribuciones una licencia real (la del BOE)
 * junto a un hueco de licencia declarado («condiciones de uso no declaradas en origen»), que es
 * justo lo que hay que poder leer por separado.
 */
export type ModuleId = "fishing" | "weather" | "navigation" | "regulations" | "protected-areas";

/**
 * Referencia mínima a un puerto: lo único que el contrato necesita saber para decidir si un módulo
 * aplica. La entidad `Port` completa (coordenadas, constituyentes armónicos, grade…) vive en
 * `domain-core` (T-02/T-05) y es estructuralmente compatible con esto; no se importa aquí para no
 * acoplar el contrato al dominio.
 */
export interface PortRef {
  /** Slug canónico del puerto en la URL, p. ej. `"a-coruna"`. */
  readonly slug: string;
}

/**
 * Atribución de una fuente de datos o librería. **Obligatoria y no vacía** en todo módulo: la
 * transparencia es un requisito del proyecto, no un extra (README, «Transparencia»), y `/v1/modules`
 * las publica para que sean auditables sin leer el código.
 */
export interface Attribution {
  /** Nombre de la fuente tal y como pide su licencia, p. ej. `"Puertos del Estado"`. */
  readonly name: string;
  /** URL canónica de la fuente o de su página de términos de uso. */
  readonly url: string;
  /** Licencia declarada, p. ej. `"CC-BY-4.0"`. */
  readonly license: string;
}

/** Estado de salud de la parte servidor de un módulo. */
export interface Health {
  /** `degraded` = responde con datos viejos o parciales; `down` = no puede servir. */
  readonly status: "ok" | "degraded" | "down";
  /** Detalle legible para el operador (nunca secretos ni credenciales). */
  readonly detail?: string;
}

/** Modo de render de una sección en la página de puerto. */
export type RenderMode = "static" | "island";

/**
 * Trozo de página que un módulo aporta a la página de puerto. El layout que las coloca llega en
 * T-09; aquí solo se declara el registro tipado.
 */
export interface PageSection {
  /** Identificador único dentro de la página; sirve de ancla (`#solunar`) y de clave de render. */
  readonly id: string;
  /** Orden ascendente dentro de la página. Empates: se conserva el orden del registry. */
  readonly order: number;
  /** `static` = HTML generado en build (SSG); `island` = hidrata en cliente (coste de JS). */
  readonly renderMode: RenderMode;
  /**
   * Ruta lógica del componente, resuelta por el layout de T-09 (p. ej.
   * `"@mareia/module-fishing/sections/SolunarOverlay"`). Es una cadena, no una referencia al
   * componente, para que el contrato no dependa de ningún framework de UI.
   */
  readonly component: string;
}

/** Política de precacheo offline del módulo (la PWA la consume en T-12). */
export interface PrecachePolicy {
  /** Estrategia del service worker para los recursos del módulo. */
  readonly strategy: "cache-first" | "network-first" | "stale-while-revalidate";
  /** Rutas a precachear, relativas a la raíz del sitio. */
  readonly routes?: readonly string[];
  /** Assets estáticos adicionales (iconos, datos embebidos) a precachear. */
  readonly assets?: readonly string[];
  /** Edad máxima aceptable de una respuesta cacheada, en segundos. */
  readonly maxAgeSeconds?: number;
}

/**
 * Dependencias que el core inyecta en la parte servidor de un módulo (relojes, repositorios,
 * caché…). Hoy está **vacío a propósito**: los puertos reales nacen con los endpoints core (T-07) y
 * el módulo meteo (T-08). Se extiende por *declaration merging* desde el package que aporte cada
 * puerto, sin tocar este archivo:
 *
 * ```ts
 * declare module "@mareia/module-contract" {
 *   interface CorePorts {
 *     readonly clock: () => Date;
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- placeholder extensible por declaration merging; ver TSDoc
export interface CorePorts {}

/**
 * Parte servidor de un módulo. `TRouter` mantiene el contrato agnóstico del framework HTTP: aquí es
 * `unknown` y es el adaptador (`apps/api`) quien lo estrecha declarando `AppModule<Router>`. Así
 * este package no depende de Express y el adaptador no necesita casts.
 */
export interface ModuleApi<TRouter = unknown> {
  /** Router montado por el composition root bajo `/v1/modules/<id>`. */
  readonly router: TRouter;
  /** Salud de las dependencias del módulo (APIs externas, caché). La agrega el core. */
  healthcheck(): Promise<Health>;
}

/**
 * Un módulo enchufable. Todo es opcional salvo identidad, versión y atribuciones: un módulo puede
 * ser solo-API (meteo backend), solo-UI (overlay de pesca) o ambos.
 */
export interface AppModule<TRouter = unknown> {
  /** Identidad del módulo; también el segmento de su montaje en `/v1/modules/<id>`. */
  readonly id: ModuleId;
  /** Versión semver del módulo, publicada en `/v1/modules` para poder diagnosticar en producción. */
  readonly version: string;
  /**
   * Fábrica de la parte servidor. Recibe las dependencias del core por inyección (nunca las
   * construye ni las importa) y devuelve router + healthcheck.
   */
  readonly api?: (deps: CorePorts) => ModuleApi<TRouter>;
  /** Secciones que el módulo aporta a la página de puerto. */
  readonly pageSections?: readonly PageSection[];
  /** Política offline del módulo. */
  readonly offline?: PrecachePolicy;
  /**
   * Atribuciones de sus fuentes. El tipo es una tupla no vacía: un módulo **sin** atribuciones no
   * compila, en vez de fallar en un test o, peor, en producción.
   */
  readonly attributions: readonly [Attribution, ...Attribution[]];
  /**
   * Filtro por puerto: permite que un módulo no aplique en todos (p. ej. navegación solo donde hay
   * carta náutica). Si se omite, el módulo aplica en todos los puertos.
   */
  isEnabledForPort?(port: PortRef): boolean;
}
