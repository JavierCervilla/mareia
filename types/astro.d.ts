/**
 * Shim de `*.astro` **para el `tsc` del monorepo**, y solo para él.
 *
 * `pnpm typecheck` corre un `tsc --noEmit` sobre todo el workspace y TypeScript no sabe compilar un
 * componente de Astro: desde T-10 hay un `.ts` que importa uno (`apps/web/src/secciones.ts`, el mapa
 * que traduce la sección declarada por un módulo a su componente), y sin esta declaración el
 * typecheck del repo se cae con un TS2307 en un archivo que en realidad es correcto.
 *
 * Vive en la raíz y **no** dentro de `apps/web` a propósito: el `tsconfig.json` de la app se incluye
 * a sí misma entera, así que no lo ve. Ahí sigue mandando `astro check`, que compila los `.astro` de
 * verdad y comprueba las props de cada componente contra su `interface Props`. Si esta declaración
 * estuviera dentro de la app, taparía esos tipos y las props de todas las páginas pasarían a ser
 * `any` sin que nadie se enterara.
 */
declare module "*.astro" {
  const componente: import("astro/runtime/server/index.js").AstroComponentFactory;
  export default componente;
}
