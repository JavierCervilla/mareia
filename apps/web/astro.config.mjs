// @ts-check
import { defineConfig } from "astro/config";

/**
 * Origen del sitio. Manda `SITE_URL`; si no está, se asume el servidor local, que es donde de
 * verdad vive el HTML mientras nadie lo despliegue.
 *
 * Se avisa al caer en el valor por defecto porque de este origen cuelgan las canónicas y el
 * `sitemap.xml`: publicar con el dominio equivocado le diría a un buscador que la página vive en
 * otro sitio. El dominio de producción lo fija el despliegue (T-15).
 */
const ORIGEN_LOCAL = "http://localhost:4321";
const site = process.env.SITE_URL ?? ORIGEN_LOCAL;
if (site === ORIGEN_LOCAL) {
  console.warn(`[mareia] SITE_URL no está definida: canónicas y sitemap apuntarán a ${site}`);
}

// SSG: cada puerto se genera como página estática (ver README, apps/web).
export default defineConfig({
  output: "static",
  site,
  // Las URL del portal terminan en barra (`/mareas/galicia/pontevedra/vigo/`) y el `dist/` son
  // directorios con su `index.html`: exigirlo evita que la misma página exista en dos URL.
  trailingSlash: "always",
});
