/**
 * `sitemap.xml` generado a mano, sin integración.
 *
 * `@astrojs/sitemap` habría servido, pero aquí hace falta menos y algo distinto: el sitio son 32
 * URL conocidas (portada, índices y puertos) y lo que importa es que cada una lleve el `lastmod`
 * **del día que publica el build** —las páginas de puerto cambian a diario porque su dato cambia a
 * diario— y una frecuencia distinta según sean dato o índice. Con veinte líneas propias eso se lee
 * y se testea; con la integración habría que configurarla igual y además leerla.
 *
 * Endpoint estático: en un build `output: "static"` Astro lo ejecuta una vez y escribe el XML.
 */

import type { APIRoute } from "astro";

import { cargarCatalogo, puertosDeRegion } from "../datos/catalogo.ts";
import { FECHA_DE_BUILD } from "../datos/fecha-build.ts";
import {
  RUTA_ESPECIES,
  RUTA_MAREAS,
  rutaProvincia,
  rutaPuerto,
  rutaRegion,
  urlAbsoluta,
} from "../rutas.ts";

interface Entrada {
  readonly ruta: string;
  /** Con qué frecuencia cambia el CONTENIDO de la página, no cuándo se reconstruye. */
  readonly frecuencia: "daily" | "weekly";
  readonly prioridad: string;
}

/** Escape XML de los cinco caracteres con significado. Los slugs no lo necesitan; el código sí. */
function escaparXml(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function entradasDelSitio(): Promise<readonly Entrada[]> {
  const regiones = await cargarCatalogo();
  const indices: Entrada[] = [
    { ruta: "/", frecuencia: "weekly", prioridad: "0.8" },
    { ruta: RUTA_MAREAS, frecuencia: "weekly", prioridad: "0.6" },
    // El catálogo de especies (T-20). `weekly` como los índices y no `daily` como las páginas de
    // puerto: su contenido sólo cambia cuando cambia la norma o cuando se vuelve a preguntar a
    // WoRMS y a OBIS, no cada vez que se reconstruye el sitio.
    { ruta: RUTA_ESPECIES, frecuencia: "weekly", prioridad: "0.6" },
  ];
  for (const region of regiones) {
    indices.push({ ruta: rutaRegion(region.slug), frecuencia: "weekly", prioridad: "0.5" });
    for (const provincia of region.provincias) {
      indices.push({
        ruta: rutaProvincia(region.slug, provincia.slug),
        frecuencia: "weekly",
        prioridad: "0.5",
      });
    }
  }
  // Las páginas de puerto son el contenido: cambian cada día y son la prioridad del sitio.
  const puertos = regiones
    .flatMap(puertosDeRegion)
    .map((puerto): Entrada => ({ ruta: rutaPuerto(puerto), frecuencia: "daily", prioridad: "1.0" }));
  return [...indices, ...puertos];
}

export const GET: APIRoute = async ({ site }) => {
  const entradas = await entradasDelSitio();
  const urls = entradas
    .map((entrada) =>
      [
        "  <url>",
        `    <loc>${escaparXml(urlAbsoluta(entrada.ruta, site))}</loc>`,
        `    <lastmod>${FECHA_DE_BUILD}</lastmod>`,
        `    <changefreq>${entrada.frecuencia}</changefreq>`,
        `    <priority>${entrada.prioridad}</priority>`,
        "  </url>",
      ].join("\n"),
    )
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
