/**
 * Las migas de pan de cada página, derivadas de la jerarquía geográfica.
 *
 * Viven aquí y no en el componente porque las consumen **dos** salidas: el `<nav>` visible y el
 * `BreadcrumbList` del JSON-LD. Si cada uno las construyese por su cuenta, el día que cambie la
 * jerarquía una de las dos se quedaría atrás y Google leería una ruta que la página no enseña.
 */

import { RUTA_ESPECIES, RUTA_MAREAS, rutaProvincia, rutaRegion } from "./rutas.ts";

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

/**
 * Migas del catálogo de especies.
 *
 * **Dos escalones y no tres**, aunque la URL tenga dos tramos: `/pesca/` no es una página del
 * portal (ver `RUTA_ESPECIES`), y una miga que enlazase ahí llevaría al 404. Una ruta de navegación
 * que miente sobre lo que existe es peor que una corta.
 */
export function migasDeEspecies(): readonly Miga[] {
  return [INICIO, { nombre: "Especies que regula el BOE", ruta: undefined }];
}

/**
 * Migas de la ficha de una especie.
 *
 * **Tres escalones**, y el del medio sí enlaza: el catálogo de las 86 existe y es de donde se llega.
 * La ficha es la única página del portal con una miga intermedia que lleva a una página real de
 * `/pesca/`; `/pesca/` a secas sigue sin serlo y sigue sin enlazarse.
 *
 * El nombre de la miga es **el del BOE**, literal, por lo mismo que encabeza la ficha: es el que
 * tiene consecuencia legal, y una ruta de navegación que nombrase la especie con el binomio aceptado
 * hoy le pondría al portal un nombre que la norma no escribe.
 */
export function migasDeFichaDeEspecie(nombreBoe: string): readonly Miga[] {
  return [
    INICIO,
    { nombre: "Especies que regula el BOE", ruta: RUTA_ESPECIES },
    { nombre: nombreBoe, ruta: undefined },
  ];
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
