import {
  type AppModule,
  type PageSection,
  type PortRef,
  selectPageSections,
} from "@mareia/module-contract";
import { fishingModule } from "@mareia/module-fishing";

/**
 * Registry de módulos activos en el portal. **Dar de alta o de baja un módulo es editar este array
 * y nada más**: sus `pageSections` aparecen (o desaparecen) de la página de puerto.
 *
 * `fishing` (T-10) es el primer módulo con interfaz: aporta la sección de actividad solunar y las
 * bandas del gráfico. **Darlo de baja es borrar su línea** y la página sigue en pie sin sección y
 * sin bandas, con su test de arquitectura en `modules.config.test.ts`. Meteo llega en T-11.
 */
export const activeModules: readonly AppModule[] = [fishingModule];

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
