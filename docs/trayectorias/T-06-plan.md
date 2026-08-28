# T-06 — module-contract-registry

**Objetivo**: el contrato `AppModule` que hace enchufables los módulos (pesca/meteo/navegación) en
API y frontend, con sus registries y el test de arquitectura que lo garantiza.

## Entregables

1. **`packages/module-contract`**: tipos `AppModule` (id, version, `api?(deps)` → router factory,
   `pageSections?` con `{id, order, renderMode: 'static'|'island'}`, `offline?`, `attributions`
   obligatorias, `isEnabledForPort?`), `PageSection`, `Attribution`, `CorePorts` (interfaces de
   dependencias que el core inyecta).
2. **Registry API** (`apps/api/src/modules.config.ts`): array de módulos activos; el composition root
   monta cada `api()` bajo `/v1/ports/:slug/<id>/…` y agrega healthchecks.
3. **Registry web** (`apps/web/src/modules.config.ts`): array de módulos activos cuyas `pageSections`
   se insertarán ordenadas en la página de puerto (el layout de slots llega en T-09; aquí solo el
   registro tipado y un helper `sectionsForPort()`).
4. **Módulo dummy** (en tests, no en producción) que demuestra alta/baja editando solo los
   `modules.config.ts`.
5. **Test de arquitectura**: el core (domain-core, usecases, apps sin módulos) compila y pasa tests
   con el array de módulos vacío; regla ESLint `import/no-restricted-paths` que prohíbe que
   domain-core/usecases importen desde `packages/modules/*`.

## No-objetivos
Implementar los módulos reales fishing/weather (T-08/T-10/T-11), la página de puerto (T-09).

## DoD extra (doctrina T-161)
El PR marca su checkbox en `ROADMAP.md` y añade su entrada a `CHANGELOG.md`.

## Nota de reconciliación (orquestador, post-implementación)
Los módulos API se montan bajo `/v1/modules/<id>` (decisión de ejecución; `GET /v1/modules` lista
activos con versión y atribuciones). El plan original decía `/v1/ports/:slug/<id>/…`: cuando T-07/T-08
necesiten scoping por puerto, se decidirá allí si el módulo recibe el puerto por parámetro de ruta
dentro de su router o si se re-monta con prefijo por puerto (una línea en `server.ts`).
