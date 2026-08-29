/**
 * **El JavaScript de cliente que el core del portal se permite, declarado.**
 *
 * Hasta T-11 la promesa era «cero scripts en el HTML construido», y era la formulación correcta
 * mientras la única fuente de la página era la astronomía. T-11 la re-apuntó al aparecer el primer
 * dato que caduca: lo que se vigila desde entonces es que **todo script servido esté declarado**
 * como isla de módulo en el registry (`modules.config.ts`).
 *
 * T-12 abre la segunda —y última prevista— puerta: la PWA. Guardar un puerto, registrar el service
 * worker y calcular un día sin red **no son de ningún módulo**: son del core, y no hay forma de
 * hacerlos sin JavaScript. Así que en vez de relajar el gate, se le da la otra mitad de la lista:
 * el registro de abajo. La regla sigue siendo exactamente igual de estrecha —lo que se sirve tiene
 * que estar declarado aquí o ser una isla del registry, con `src` a un bundle de `/_astro/`, sin
 * inline, sin manejadores en atributos y sin hidratación de framework— y sigue siendo el pase
 * adversario de T-09 quien la comprueba, página a página, sobre el `dist/`.
 *
 * Lo que NO cambia: la portada y los índices geográficos siguen en cero scripts. El JavaScript vive
 * donde vive su promesa, y la promesa de la PWA es la página de un puerto.
 */

/** Un script de core: qué es, por qué existe y en qué páginas se sirve. */
export interface ScriptDeCore {
  /** Identificador legible; aparece en el mensaje del gate cuando algo no cuadra. */
  readonly id: string;
  /** Por qué no puede ser HTML estático. Si esto no se puede escribir, el script sobra. */
  readonly porQue: string;
  /** Familia de páginas que lo llevan. Hoy solo hay una. */
  readonly paginas: "puerto";
}

/**
 * Los scripts de core del sitio.
 *
 * Uno, y con un solo `<script>` en la página de puerto: todo lo de la PWA entra por
 * `pwa/cliente/montar.ts`. Repartirlo en tres etiquetas —registro del worker, favoritos,
 * calculadora— habría servido tres bundles con el mismo runtime dentro.
 */
export const SCRIPTS_DE_CORE: readonly ScriptDeCore[] = [
  {
    id: "pwa",
    porQue:
      "La PWA (T-12): registra el service worker, guarda el puerto como favorito y calcula un día " +
      "cualquiera en el navegador con las constantes armónicas. Ninguna de las tres se puede " +
      "hornear en build, porque las tres dependen de lo que este dispositivo tenga guardado.",
    paginas: "puerto",
  },
];

/** Cuántos scripts de core se sirven en una página, según sea de puerto o no. */
export function scriptsDeCoreEn(esPaginaDePuerto: boolean): number {
  return SCRIPTS_DE_CORE.filter((script) => esPaginaDePuerto || script.paginas !== "puerto").length;
}
