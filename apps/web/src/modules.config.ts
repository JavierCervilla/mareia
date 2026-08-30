import {
  type AppModule,
  type PageSection,
  type PortRef,
  selectPageSections,
} from "@mareia/module-contract";
import { fishingModule } from "@mareia/module-fishing";
import { protectedAreasModule } from "@mareia/module-protected-areas";
import { regulationsModule } from "@mareia/module-regulations";
import { speciesModule } from "@mareia/module-species";
import { WEATHER_UI_MODULE } from "@mareia/module-weather/ui";

/**
 * Registry de módulos activos en el portal. **Dar de alta o de baja un módulo es editar este array
 * y nada más**: sus `pageSections` aparecen (o desaparecen) de la página de puerto.
 *
 * `fishing` (T-10) aporta la sección de actividad solunar y las bandas del gráfico, y no necesita
 * red: se calcula en build. `WEATHER_UI_MODULE` (T-11) es el módulo meteo **visto desde la UI**
 * —identidad, atribuciones y secciones—, sin su parte servidor, que necesita `fetch`, caché KV y la
 * clave de AEMET, y el build de la web no tiene ninguna de las tres. `regulationsModule` (T-19)
 * aporta las tallas mínimas del caladero del puerto: dato de build leído del BOE, sin parte
 * servidor y sin JavaScript.
 *
 * `protectedAreasModule` (T-21) aporta las áreas marinas protegidas que el puerto tiene a menos de
 * 30 km: también dato de build, sin servidor y sin JavaScript, y **la primera de las cinco
 * secciones de módulo** (`order: 12`), porque es una advertencia y no una consulta.
 *
 * `speciesModule` (T-20) es **la última** (`order: 35`) y la única que no publica una tabla: aporta
 * un enlace al catálogo de especies filtrado por el caladero de este puerto. Va detrás de las
 * tallas porque amplía lo que se acaba de leer, y no las repite —dos superficies del mismo dato se
 * desincronizan—. Es también el único módulo **sin política offline**, y eso es una afirmación: lo
 * que hay al otro lado del enlace no se guarda con el puerto, y la sección lo dice en la página.
 *
 * **Dar de baja cualquiera de los cinco es borrar su línea**: la página sigue construyendo, sin esa
 * sección, y quitando meteo se queda además **sin JavaScript de cliente**. Lo comprueba
 * `modules.config.test.ts`.
 */
export const activeModules: readonly AppModule[] = [
  fishingModule,
  WEATHER_UI_MODULE,
  regulationsModule,
  protectedAreasModule,
  speciesModule,
];

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
