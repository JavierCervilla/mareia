/**
 * Qué sombrea el gráfico de marea: el registro de las secciones de módulo que aportan **ventanas**.
 *
 * Es el hermano de `src/secciones.ts` —aquél traduce la cadena `component` a un componente de
 * Astro, éste la traduce a un trozo de gráfico— y vive aparte por una razón práctica: aquí no se
 * importa ni un `.astro`, así que este camino se puede probar con `node --test` sin construir el
 * sitio. Los dos comparten el mismo contrato: la clave es la cadena que declara el módulo, y un
 * módulo dado de baja del registry desaparece de los dos mapas sin tocarlos.
 *
 * Aportar ventanas es **opcional**: una sección que solo quiera su bloque de texto no aparece aquí
 * y el gráfico sigue siendo el de siempre.
 */

import type { PageSection } from "@mareia/module-contract";
import { SECCION_ACTIVIDAD_SOLUNAR } from "@mareia/module-fishing";

import type { VentanaDestacada } from "../grafico-marea.ts";
import { ventanasSolunares } from "./actividad-solunar.ts";
import type { ContextoDeSeccion } from "./contexto.ts";

/** Quien sabe qué tramos del día destaca una sección para un puerto y un día. */
export type ProveedorDeVentanas = (
  contexto: ContextoDeSeccion,
) => Promise<readonly VentanaDestacada[]>;

export const VENTANAS_DE_SECCION: Readonly<Record<string, ProveedorDeVentanas>> = {
  [SECCION_ACTIVIDAD_SOLUNAR]: ventanasSolunares,
};

/**
 * Las ventanas de todas las secciones que la página va a renderizar, en el orden de las secciones.
 *
 * Se piden **en paralelo** porque cada proveedor llama a su caso de uso y no dependen entre sí; y
 * se piden **antes** de trazar la curva, que es cuando hay que saber dónde va cada banda.
 */
export async function ventanasDeSecciones(
  secciones: readonly PageSection[],
  contexto: ContextoDeSeccion,
): Promise<readonly VentanaDestacada[]> {
  const porSeccion = await Promise.all(
    secciones.map((seccion) => VENTANAS_DE_SECCION[seccion.component]?.(contexto) ?? []),
  );
  return porSeccion.flat();
}
