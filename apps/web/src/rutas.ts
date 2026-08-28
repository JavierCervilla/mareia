/**
 * Las URL del portal, en un solo sitio.
 *
 * La jerarquía es `/mareas/<región>/<provincia>/<puerto>/`: cada tramo es una página real que
 * existe y se puede recortar de la barra de direcciones (subir un nivel siempre lleva a algo). Los
 * slugs vienen del dataset (`data/geo/ports.json`), no se generan aquí: la URL es dato, no derivada
 * de un nombre que alguien pueda tildar distinto mañana.
 *
 * Todas las rutas terminan en barra porque son directorios en el `dist/` (`.../index.html`), y así
 * la canónica coincide byte a byte con lo que sirve el servidor estático.
 */

/** Referencia mínima a un puerto para construir su URL: lo que tienen `PortDto` y `Port`. */
export interface PuertoUbicado {
  readonly slug: string;
  readonly province: { readonly slug: string };
  readonly region: { readonly slug: string };
}

/** Raíz de la sección de mareas: el índice de regiones. */
export const RUTA_MAREAS = "/mareas/";

export function rutaRegion(regionSlug: string): string {
  return `${RUTA_MAREAS}${regionSlug}/`;
}

export function rutaProvincia(regionSlug: string, provinciaSlug: string): string {
  return `${rutaRegion(regionSlug)}${provinciaSlug}/`;
}

export function rutaPuerto(puerto: PuertoUbicado): string {
  return `${rutaProvincia(puerto.region.slug, puerto.province.slug)}${puerto.slug}/`;
}

/**
 * URL absoluta de una ruta del sitio.
 *
 * `site` es `Astro.site`, que es `undefined` si nadie configuró el dominio. En ese caso se devuelve
 * la ruta relativa: una canónica a medias (`/mareas/...`) es válida y honesta, mientras que una
 * canónica inventada sobre un dominio de ejemplo le diría a Google que la página vive en otro sitio.
 */
export function urlAbsoluta(ruta: string, site: URL | undefined): string {
  return site === undefined ? ruta : new URL(ruta, site).href;
}
