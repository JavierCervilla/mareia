/**
 * Lo que la página de puerto le cuenta a las secciones que aportan los módulos.
 *
 * Es a propósito **lo mínimo**: qué puerto, qué día y en qué zona se escriben las horas. Todo lo
 * demás —los periodos, la marea, las efemérides— lo pide cada sección a los casos de uso, que es
 * quien manda sobre el dato. Pasarle aquí los datos ya resueltos ataría la página a lo que hoy
 * necesita el módulo de pesca, y el siguiente módulo necesitará otra cosa.
 *
 * Vive en su propio archivo (y no en `secciones.ts`) porque lo comparten dos caminos que no pueden
 * mezclarse: el mapa de renderizadores, que importa componentes `.astro`, y el de ventanas, que es
 * TypeScript puro y corre en los tests de `node`.
 */
export interface ContextoDeSeccion {
  /** Slug del puerto en el catálogo (`a-coruna`). */
  readonly slug: string;
  /** Día civil que publica la página, `YYYY-MM-DD` (el `BUILD_DATE`). */
  readonly fechaIso: string;
  /** Zona IANA del puerto: toda hora que se imprima se proyecta a ella. */
  readonly timezone: string;
}
