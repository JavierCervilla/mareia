/**
 * `/offline/estaciones/<slug>.json` — las constantes armónicas de un puerto, listas para calcular
 * en el navegador.
 *
 * Es el fichero que convierte a la PWA en algo más que un caché de páginas: con esto y el motor de
 * `@mareia/domain-core`, el teléfono predice **cualquier** día sin red, no solo el que se guardó.
 *
 * Va lo mínimo y va todo lo que hace falta para responder por el número: el esquema `station/v1`
 * que come el motor (id, nombre, cero hidrográfico y constituyentes), el puerto con su zona horaria,
 * el grade del QC y las atribuciones de la estación. **Lo que no viaja son los metadatos del
 * pipeline** (rmse, p95, contra qué se validó) que la página ya publica en su bloque de
 * transparencia: en el fichero que se baja al teléfono solo entra lo que se va a usar o lo que hay
 * que citar.
 *
 * Un fichero por puerto y no uno para los doce: un favorito es un acto explícito y se baja **su**
 * puerto, no el catálogo entero.
 */

import type { APIRoute } from "astro";

import { cargarPuertos } from "../../../datos/catalogo.ts";
import { deps } from "../../../datos/deps.ts";
import { FECHA_DE_BUILD } from "../../../datos/fecha-build.ts";
import { ESQUEMA_ESTACION_OFFLINE } from "../../../pwa/estacion-offline.ts";
import type { EstacionOffline } from "../../../pwa/estacion-offline.ts";
import { rutaPuerto } from "../../../rutas.ts";

export async function getStaticPaths() {
  const puertos = await cargarPuertos();
  return puertos.map((puerto) => ({ params: { puerto: puerto.slug } }));
}

export const GET: APIRoute = async ({ params }) => {
  const slug = params["puerto"];
  const puerto = slug === undefined ? undefined : await deps.ports.findBySlug(slug);
  if (puerto === undefined) {
    // No puede pasar: los slugs salen de `getStaticPaths`. Se contesta en vez de reventar con un
    // acceso a `undefined`, que sería un error mucho más difícil de leer en mitad de un build.
    return new Response(`Puerto desconocido: ${String(slug)}`, { status: 404 });
  }
  const registro = await deps.stations.load(puerto.stationFile);
  const payload: EstacionOffline = {
    schema: ESQUEMA_ESTACION_OFFLINE,
    generadoEn: FECHA_DE_BUILD,
    puerto: {
      slug: puerto.slug,
      nombre: puerto.name,
      timezone: puerto.timezone,
      ruta: rutaPuerto(puerto),
    },
    estacion: {
      schema: registro.schema,
      id: registro.id,
      name: registro.name,
      datum: { msl_offset_m: registro.datum.msl_offset_m },
      constituents: registro.constituents,
    },
    grade: registro.quality.grade,
    atribuciones: registro.attributions.map((fuente) => ({
      name: fuente.name,
      url: fuente.url,
      license: fuente.license,
    })),
  };
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
