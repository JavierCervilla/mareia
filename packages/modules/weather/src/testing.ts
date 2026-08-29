/**
 * Lo que el módulo expone **para que los recorridos de fuera puedan atacar el borde de verdad**, y
 * no para que ninguna superficie lo pinte.
 *
 * Vive en su propio subpath (`@mareia/module-weather/testing`) porque la intención tiene que estar
 * en la estructura y no sólo en la prosa: estas tres funciones estaban en `ui.ts` con un comentario
 * que decía «no la usa la sección», y un comentario no impide que mañana alguien la use. No pueden
 * salir de `index.ts` —ése arrastra `module.ts` y con él Express, que es justo lo que la web no
 * puede cargar— así que el subpath es lo que separa las dos intenciones sin romper esa regla.
 *
 * Quién las usa hoy y para qué:
 *
 * - `inspectAemetKey` + `publicCredentialView` · el gate de los fixtures de boletín de la web. Son
 *   copias congeladas de lo que publica este módulo, y la única forma de comprobar que siguen
 *   siendo esa proyección —y no un JSON editado a mano— es poder calcularla. Es lo que impidió que
 *   el `daysLeft: -40` con 39 días transcurridos siguiera commiteado (T-18/A-20).
 * - `reasonFrom` · el borde que produce el `reason` público, el mismo campo que la sección pinta
 *   detrás de «el servidor informa: …». El gate de la pantalla compone su `reason` **llamando al
 *   borde real** en vez de copiar a mano el resultado ya recortado: si alguien quitara el filtro,
 *   el recorrido se pone rojo donde duele, que es en lo que lee un humano (T-18/A-18).
 */

export { inspectAemetKey, publicCredentialView } from "./aemet-key.ts";
export { reasonFrom } from "./errors.ts";
