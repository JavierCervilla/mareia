/**
 * Shim de los imports `?raw` de Vite **para el `tsc` del monorepo**, y solo para él.
 *
 * Vite (y por tanto Astro) admite `import fuente from "./fichero.ts?raw"` para traer un fichero como
 * cadena en tiempo de build. Lo usa `apps/web/src/pages/sw.js.ts` para leer el fuente del service
 * worker. Dentro de `apps/web` ese tipo ya lo declara `astro/client`, pero el `tsc --noEmit` del
 * workspace no carga esos tipos y se caería con un TS2307 sobre un import que es correcto.
 *
 * Vive en la raíz por el mismo motivo que `types/astro.d.ts`: el `tsconfig.json` de la app no mira
 * aquí, así que dentro de `apps/web` sigue mandando la declaración de Vite y no la tapa ésta.
 */
declare module "*?raw" {
  const contenido: string;
  export default contenido;
}
