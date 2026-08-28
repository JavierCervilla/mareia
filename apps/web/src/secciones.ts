/**
 * Renderizadores de las secciones de página que declaran los módulos.
 *
 * El contrato `AppModule` (T-06) identifica cada sección por una **cadena** (`component`), no por
 * una referencia al componente: así el contrato no depende de Astro y el mismo módulo puede
 * enchufarse a otra superficie. Alguien tiene que traducir esa cadena a un componente de verdad, y
 * ese alguien es la superficie: este mapa.
 *
 * Está **vacío a propósito**: hoy ningún módulo aporta UI (pesca es T-10, meteo T-11). Dar de alta
 * una sección será añadir aquí una línea `"@mareia/module-fishing/sections/Solunar": Solunar`.
 */

import type { AstroComponentFactory } from "astro/runtime/server/index.js";

export const RENDERIZADORES_DE_SECCION: Readonly<Record<string, AstroComponentFactory>> = {};
