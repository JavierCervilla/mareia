/**
 * Renderizadores de las secciones de página que declaran los módulos.
 *
 * El contrato `AppModule` (T-06) identifica cada sección por una **cadena** (`component`), no por
 * una referencia al componente: así el contrato no depende de Astro y el mismo módulo puede
 * enchufarse a otra superficie. Alguien tiene que traducir esa cadena a un componente de verdad, y
 * ese alguien es la superficie: este mapa.
 *
 * Dar de alta una sección es añadir aquí una línea. Las claves **no se escriben a mano**: las
 * exporta el propio módulo (`SECCION_ACTIVIDAD_SOLUNAR`, `METEO_SECTION_COMPONENT`), para que un
 * renombrado no deje al registry apuntando a una cadena que ya no existe — el fallo saldría en
 * build con «sección sin renderizador» (ver `SeccionesDeModulos.astro`), pero saldría tarde.
 *
 * El gemelo de este archivo es `src/modulos/ventanas.ts`, que traduce la misma clave a lo que la
 * sección sombrea en el gráfico de marea. Están separados porque este importa componentes `.astro`
 * y aquél tiene que poder correr en `node --test`.
 */

import { SECCION_ACTIVIDAD_SOLUNAR } from "@mareia/module-fishing";
import { METEO_SECTION_COMPONENT } from "@mareia/module-weather/ui";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";

import Meteo from "./componentes/Meteo.astro";
import ActividadSolunar from "./componentes/modulos/ActividadSolunar.astro";

export const RENDERIZADORES_DE_SECCION: Readonly<Record<string, AstroComponentFactory>> = {
  [SECCION_ACTIVIDAD_SOLUNAR]: ActividadSolunar,
  [METEO_SECTION_COMPONENT]: Meteo,
};
