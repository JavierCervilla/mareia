/**
 * Renderizadores de las secciones de página que declaran los módulos.
 *
 * El contrato `AppModule` (T-06) identifica cada sección por una **cadena** (`component`), no por
 * una referencia al componente: así el contrato no depende de Astro y el mismo módulo puede
 * enchufarse a otra superficie. Alguien tiene que traducir esa cadena a un componente de verdad, y
 * ese alguien es la superficie: este mapa.
 *
 * La clave **no se escribe a mano**: se importa del propio módulo (`METEO_SECTION_COMPONENT`), que
 * es quien la declara en sus `pageSections`. Un literal repetido aquí sería una cadena que se puede
 * desincronizar en silencio, y desincronizarla rompe el build con «sección sin renderizador» (ver
 * `SeccionesDeModulos.astro`) en vez de publicar la página con un trozo de menos.
 */

import { METEO_SECTION_COMPONENT } from "@mareia/module-weather/ui";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";

import Meteo from "./componentes/Meteo.astro";

/**
 * Lo que una sección de módulo necesita saber del puerto en el que se pinta.
 *
 * Es a propósito **más estrecho que `PortDto`**: una sección de módulo no tiene por qué ver las
 * constantes armónicas ni el grade de la estación. Con el slug le pide su dato al API, con la zona
 * horaria escribe las horas donde se leen, y con el nombre habla del sitio.
 */
export interface ContextoDeSeccion {
  readonly slug: string;
  readonly nombre: string;
  readonly zonaHoraria: string;
}

export const RENDERIZADORES_DE_SECCION: Readonly<Record<string, AstroComponentFactory>> = {
  [METEO_SECTION_COMPONENT]: Meteo,
};
