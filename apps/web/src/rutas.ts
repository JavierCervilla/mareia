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

/**
 * El catálogo de especies (T-20). **La ruta la decidió el humano**, y por eso está aquí escrita una
 * sola vez: la usan la página, el sitemap y las 153 secciones de puerto que enlazan a ella.
 *
 * `/pesca/` **no es una página**: hoy sólo hay un contenido colgando de ese tramo. Es la única URL
 * del portal cuyo padre no se puede recortar en la barra de direcciones, y se deja dicho aquí en vez
 * de disimularse con un índice inventado de una sola entrada. Las migas del catálogo tampoco lo
 * enlazan, que sería enlazar a un 404. El día que cuelgue algo más de `/pesca/`, ese índice tendrá
 * contenido y entrará con él.
 */
export const RUTA_ESPECIES = "/pesca/especies/";

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
