import {
  type AppModule,
  type PageSection,
  type PortRef,
  selectPageSections,
} from "@mareia/module-contract";
import { WEATHER_UI_MODULE } from "@mareia/module-weather/ui";

/**
 * Registry de módulos activos en el portal. **Dar de alta o de baja un módulo es editar este array
 * y nada más**: sus `pageSections` aparecen (o desaparecen) de la página de puerto.
 *
 * `WEATHER_UI_MODULE` es el módulo meteo **visto desde la UI**: identidad, atribuciones y secciones,
 * sin su parte servidor (que necesita `fetch`, caché KV y la clave de AEMET, y el build de la web no
 * tiene ninguna de las tres). Borrar esa línea deja la página sin sección meteo y **sin JavaScript
 * de cliente**, y sigue construyendo: es lo que comprueba `modules.config.test.ts`.
 */
export const activeModules: readonly AppModule[] = [WEATHER_UI_MODULE];

/**
 * Secciones que la página de un puerto debe renderizar, ordenadas por `order`. El layout que las
 * coloca en sus slots llega en T-09; aquí solo se expone la lógica de selección.
 *
 * `modules` es inyectable para poder testear la selección con módulos dummy sin tocar el registry
 * de producción.
 */
export function sectionsForPort(
  port: PortRef,
  modules: readonly AppModule[] = activeModules,
): readonly PageSection[] {
  return selectPageSections(modules, port);
}
