/**
 * Los deberes de SEO del portal: canónica, migas estructuradas y ficha del lugar.
 *
 * La página de puerto es el corazón SEO de Mareia —quien busca «mareas en Vigo» tiene que aterrizar
 * aquí— y a la vez es un dato público que otros pueden consumir. Por eso el JSON-LD no es un adorno
 * para el buscador: describe **el lugar** (`Place`, con sus coordenadas reales del dataset) y **la
 * ruta** (`BreadcrumbList`, la misma que enseña el `<nav>`), sin declarar nada que la página no
 * enseñe. Nada de `AggregateRating` ni de tipos inventados para arañar un *rich snippet*.
 *
 * Todo lo que sale de aquí se serializa con `serializarJsonLd`, que lo deja inerte como HTML.
 */

import type { Miga } from "./migas.ts";
import { urlAbsoluta } from "./rutas.ts";

/** El puerto, con lo que el JSON-LD necesita de él. */
export interface PuertoParaSeo {
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly province: { readonly name: string };
  readonly region: { readonly name: string };
}

/**
 * `BreadcrumbList` con las mismas migas que pinta el `<nav>`.
 *
 * La última miga (la página actual) no lleva `item`: es la posición de destino y Google la toma de
 * la propia URL. Poner un enlace a sí misma sería declarar un ciclo.
 */
export function migasEstructuradas(migas: readonly Miga[], site: URL | undefined): unknown {
  return {
    "@type": "BreadcrumbList",
    itemListElement: migas.map((miga, indice) => ({
      "@type": "ListItem",
      position: indice + 1,
      name: miga.nombre,
      ...(miga.ruta === undefined ? {} : { item: urlAbsoluta(miga.ruta, site) }),
    })),
  };
}

/** Ficha `Place` del puerto: nombre, dónde está y sus coordenadas. */
export function lugarEstructurado(
  puerto: PuertoParaSeo,
  ruta: string,
  site: URL | undefined,
): unknown {
  return {
    "@type": "Place",
    name: puerto.name,
    url: urlAbsoluta(ruta, site),
    address: {
      "@type": "PostalAddress",
      addressLocality: puerto.name,
      addressRegion: puerto.province.name,
      addressCountry: "ES",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: puerto.lat,
      longitude: puerto.lon,
    },
  };
}

/** El grafo JSON-LD de una página: sus nodos bajo un único `@context`. */
export function grafo(nodos: readonly unknown[]): unknown {
  return { "@context": "https://schema.org", "@graph": nodos };
}
