import {
  type AppModule,
  type PageSection,
  type PortRef,
  selectPageSections,
} from "@mareia/module-contract";

/**
 * Registry de módulos activos en el portal. **Dar de alta o de baja un módulo es editar este array
 * y nada más**: sus `pageSections` aparecen (o desaparecen) de la página de puerto.
 *
 * Vacío a propósito: la web compila y se construye sin ningún módulo (test de arquitectura en
 * `modules.config.test.ts`). Los módulos reales llegan en T-10 (pesca) y T-11 (meteo).
 */
export const activeModules: readonly AppModule[] = [];

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
