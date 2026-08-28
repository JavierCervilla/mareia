/**
 * Las migas de pan de cada página, derivadas de la jerarquía geográfica.
 *
 * Viven aquí y no en el componente porque las consumen **dos** salidas: el `<nav>` visible y el
 * `BreadcrumbList` del JSON-LD. Si cada uno las construyese por su cuenta, el día que cambie la
 * jerarquía una de las dos se quedaría atrás y Google leería una ruta que la página no enseña.
 */

import { RUTA_MAREAS, rutaProvincia, rutaRegion } from "./rutas.ts";

/** Un escalón de la ruta. La página actual va sin `ruta`: no se enlaza a sí misma. */
export interface Miga {
  readonly nombre: string;
  readonly ruta: string | undefined;
}

/** Segmento geográfico tal y como viaja en el DTO del puerto. */
interface Segmento {
  readonly slug: string;
  readonly name: string;
}

const INICIO: Miga = { nombre: "Mareia", ruta: "/" };
const MAREAS: Miga = { nombre: "Mareas", ruta: RUTA_MAREAS };

/** Migas de `/mareas/`. */
export function migasDeMareas(): readonly Miga[] {
  return [INICIO, { ...MAREAS, ruta: undefined }];
}

/** Migas de la página de una región. */
export function migasDeRegion(region: Segmento, actual = true): readonly Miga[] {
  return [
    INICIO,
    MAREAS,
    { nombre: region.name, ruta: actual ? undefined : rutaRegion(region.slug) },
  ];
}

/** Migas de la página de una provincia. */
export function migasDeProvincia(
  region: Segmento,
  provincia: Segmento,
  actual = true,
): readonly Miga[] {
  return [
    ...migasDeRegion(region, false),
    {
      nombre: provincia.name,
      ruta: actual ? undefined : rutaProvincia(region.slug, provincia.slug),
    },
  ];
}

/** Migas de la página de un puerto. */
export function migasDePuerto(
  region: Segmento,
  provincia: Segmento,
  puerto: string,
): readonly Miga[] {
  return [...migasDeProvincia(region, provincia, false), { nombre: puerto, ruta: undefined }];
}
