/**
 * Renderizadores de las secciones de página que declaran los módulos.
 *
 * El contrato `AppModule` (T-06) identifica cada sección por una **cadena** (`component`), no por
 * una referencia al componente: así el contrato no depende de Astro y el mismo módulo puede
 * enchufarse a otra superficie. Alguien tiene que traducir esa cadena a un componente de verdad, y
 * ese alguien es la superficie: este mapa.
 *
 * Dar de alta una sección es añadir aquí una línea. La clave **no se escribe a mano**: la exporta
 * el propio módulo (`SECCION_ACTIVIDAD_SOLUNAR`), para que un renombrado no deje al registry
 * apuntando a una cadena que ya no existe — el fallo saldría en build, pero saldría tarde.
 *
 * Su gemelo es `src/modulos/ventanas.ts`, que traduce la misma clave a lo que la sección sombrea en
 * el gráfico de marea. Están separados porque este archivo importa componentes `.astro` y aquél
 * tiene que poder correr en `node --test`.
 */

import { SECCION_ACTIVIDAD_SOLUNAR } from "@mareia/module-fishing";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";

import ActividadSolunar from "./componentes/modulos/ActividadSolunar.astro";

export const RENDERIZADORES_DE_SECCION: Readonly<Record<string, AstroComponentFactory>> = {
  [SECCION_ACTIVIDAD_SOLUNAR]: ActividadSolunar,
};
