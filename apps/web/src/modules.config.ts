import {
  type AppModule,
  type PageSection,
  type PortRef,
  selectPageSections,
} from "@mareia/module-contract";
import { fishingModule } from "@mareia/module-fishing";
import { WEATHER_UI_MODULE } from "@mareia/module-weather/ui";

/**
 * Registry de módulos activos en el portal. **Dar de alta o de baja un módulo es editar este array
 * y nada más**: sus `pageSections` aparecen (o desaparecen) de la página de puerto.
 *
 * `fishing` (T-10) aporta la sección de actividad solunar y las bandas del gráfico, y no necesita
 * red: se calcula en build. `WEATHER_UI_MODULE` (T-11) es el módulo meteo **visto desde la UI**
 * —identidad, atribuciones y secciones—, sin su parte servidor, que necesita `fetch`, caché KV y la
 * clave de AEMET, y el build de la web no tiene ninguna de las tres.
 *
 * **Dar de baja cualquiera de los dos es borrar su línea**: la página sigue construyendo, sin esa
 * sección, y quitando meteo se queda además **sin JavaScript de cliente**. Lo comprueba
 * `modules.config.test.ts`.
 */
export const activeModules: readonly AppModule[] = [fishingModule, WEATHER_UI_MODULE];

/**
 * Secciones que la página de un puerto debe renderizar, ordenadas por `order`. Quien las coloca es
 * `componentes/SeccionesDeModulos.astro`; aquí solo se expone la lógica de selección.
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
