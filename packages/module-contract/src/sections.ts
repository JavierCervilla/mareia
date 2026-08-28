import type { AppModule, PageSection, PortRef } from "./contract.ts";

/**
 * Secciones de página que aportan los módulos activos para un puerto dado, ordenadas por `order`
 * ascendente. Un módulo participa si no declara `isEnabledForPort` o si éste devuelve `true`.
 *
 * Vive en el contrato (y no en el registry de `apps/web`) porque es la semántica de `pageSections` +
 * `isEnabledForPort`, no una decisión de la app: cualquier superficie que renderice secciones debe
 * seleccionarlas igual. El registry web solo la ata a su `activeModules`.
 *
 * El orden es **estable**: ante `order` empatado se conserva el orden de declaración del registry,
 * de modo que la página no baile entre builds (SSG reproducible).
 */
export function selectPageSections(
  modules: readonly AppModule[],
  port: PortRef,
): readonly PageSection[] {
  return modules
    .filter((module) => module.isEnabledForPort?.(port) ?? true)
    .flatMap((module) => module.pageSections ?? [])
    .map((section, index) => ({ section, index }))
    .sort((a, b) => a.section.order - b.section.order || a.index - b.index)
    .map(({ section }) => section);
}
