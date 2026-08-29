/**
 * La identidad de Mareia **cuando deja de ser una pestaña**: el manifiesto de instalación y el
 * icono que queda en la pantalla de inicio.
 *
 * Es el único sitio de la web donde un color se escribe fuera de `packages/ui/src/tokens.css`, y no
 * por descuido: un `.webmanifest` es JSON que lee el sistema operativo, no CSS, así que no puede
 * consumir una custom property ni entiende `oklch()` en todas las plataformas que nos importan.
 * Las dos cifras de abajo son la conversión a sRGB de dos tokens del design brief (§4) y **no son
 * una paleta nueva**: si alguien cambia el token, esto tiene que cambiar con él, y hay un test que
 * lo vigila comparando estas constantes contra `tokens.css`.
 *
 * El icono se dibuja aquí, en SVG, por la misma razón por la que la página no lleva iconografía
 * meteo tipo emoji (design brief §3): es un filete doble y una curva de marea, que es literalmente
 * lo que hace el producto. Sin fuentes —una letra en un SVG depende de que el sistema tenga esa
 * familia—, sin degradados y sin sombras.
 */

/** Papel cálido: la conversión sRGB de `--m-bg` (`oklch(95.8% 0.018 89.4)`) en el tema claro. */
// anti-slop-allow: el manifiesto lo lee el sistema operativo, no el CSS; es la conversión del token --m-bg
export const COLOR_FONDO = "#f6f1e4";

/** Azul marino de marca: la conversión sRGB de `--m-navy` (`oklch(34.6% 0.074 256)`). */
// anti-slop-allow: mismo motivo que COLOR_FONDO; es la conversión del token --m-navy
export const COLOR_MARCA = "#1e3a5f";

/** Lado del lienzo del icono. 512 es lo que piden Android e iOS para la rejilla grande. */
const LADO = 512;

/**
 * El icono, en SVG.
 *
 * `sizes: "any"` en el manifiesto: es vectorial y no tiene una talla. La curva es la misma figura
 * que la de la página —una marea de dos pleamares— y el filete doble es el de la cabecera del
 * almanaque. Nada más: quien lo vea en la pantalla de inicio tiene que reconocer la página.
 */
export function iconoSvg(): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LADO} ${LADO}" width="${LADO}" height="${LADO}" role="img" aria-label="Mareia">`,
    `<rect width="${LADO}" height="${LADO}" fill="${COLOR_FONDO}"/>`,
    `<path d="M64 320 C 128 176, 192 176, 256 320 S 384 464, 448 320" fill="none" stroke="${COLOR_MARCA}" stroke-width="28" stroke-linecap="round"/>`,
    `<rect x="64" y="392" width="384" height="10" fill="${COLOR_MARCA}"/>`,
    `<rect x="64" y="414" width="384" height="4" fill="${COLOR_MARCA}"/>`,
    "</svg>",
  ].join("");
}

/** El manifiesto de instalación, tal y como se publica en `/manifest.webmanifest`. */
export interface ManifiestoWeb {
  readonly name: string;
  readonly short_name: string;
  readonly description: string;
  readonly lang: string;
  readonly start_url: string;
  readonly scope: string;
  readonly display: string;
  readonly orientation: string;
  readonly background_color: string;
  readonly theme_color: string;
  readonly icons: readonly {
    readonly src: string;
    readonly sizes: string;
    readonly type: string;
    readonly purpose: string;
  }[];
}

/** Ruta del icono dentro del sitio. */
export const RUTA_ICONO = "/icono.svg";

/**
 * El manifiesto.
 *
 * `display: "minimal-ui"` **y no `standalone`**, que es la elección por defecto de casi cualquier
 * PWA. Este portal es una *fuente*, no una app: quien lo instala sigue queriendo ver en qué URL
 * está, para compartirla y para recortarla —que es una de las promesas de la jerarquía de URL de
 * T-09— y sigue queriendo el botón de recargar. `minimal-ui` conserva esa barra mínima y sigue
 * siendo un modo instalable; `standalone` la quita a cambio de parecer una app nativa, y parecer
 * una app nativa no es un objetivo de este proyecto.
 *
 * `start_url: "/"` es la portada, que lleva al índice geográfico. No se arranca en un puerto
 * concreto porque el favorito lo elige quien lee y puede haber varios.
 */
export const MANIFIESTO: ManifiestoWeb = {
  name: "Mareia · almanaque de mareas",
  short_name: "Mareia",
  description:
    "Tabla de mareas, coeficiente, sol y luna de los puertos españoles. Cálculo propio con " +
    "fuentes abiertas, sin publicidad y sin seguimiento. No apto para navegación.",
  lang: "es",
  start_url: "/",
  scope: "/",
  display: "minimal-ui",
  orientation: "portrait-primary",
  background_color: COLOR_FONDO,
  theme_color: COLOR_MARCA,
  icons: [{ src: RUTA_ICONO, sizes: "any", type: "image/svg+xml", purpose: "any" }],
};
