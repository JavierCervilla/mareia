# T-07 — api-core-endpoints

**Objetivo**: los endpoints core del API Deno/Express sobre casos de uso de clean architecture,
sirviendo el dominio ya mergeado (motor de mareas T-02, astro/solunar T-03) y el dataset de T-05.

## Entregables

1. **`data/geo/ports.json`**: los 12 puertos del dataset (+ Brest NO — es referencia, no puerto
   público) con: slug SEO, nombre, provincia/región (jerarquía para T-09), lat/lon, timezone IANA,
   `station` (id del JSON de data/stations). Generado a mano desde los JSON existentes; un test
   verifica la coherencia ports.json ↔ data/stations/*.
2. **usecases** (`packages/usecases`): `listPorts`, `getPort(slug)`, `getTides(slug, from, to)`
   (eventos + curva), `getAlmanac(slug, year)` (12 meses de eventos, pensado para precache PWA),
   `getAstro(slug, date)`, `getSolunar(slug, date)` — puros, con puertos (interfaces)
   `PortRepository`/`StationRepository` definidos aquí.
3. **adapters** (`packages/adapters`): `ports-json` y `stations-json` (lectura de disco con caché en
   memoria; ruta inyectada, no hardcodeada).
4. **API** (`apps/api`): rutas `GET /v1/ports` · `GET /v1/ports/:slug` · `GET /v1/ports/:slug/tides?from&to`
   · `GET /v1/ports/:slug/almanac/:year` · `GET /v1/ports/:slug/astro?date` · `GET /v1/ports/:slug/solunar?date`.
   Validación de entrada ruidosa (400 con mensaje; rangos máximos documentados, p.ej. tides ≤ 40 días,
   almanac solo año actual±1), `Cache-Control` largo (contenido determinista), 404 para slug desconocido.
   Los datos de marea de puertos micromareales (grade C con p95 null) llevan el `quality` en la
   respuesta — la transparencia viaja por el API.
5. **Contract tests** (deno test): status, esquema de respuesta, headers de caché, errores 400/404,
   y un golden fino: los eventos de `tides` para Vigo en una fecha coinciden con el motor llamado
   directamente (mismo JSON de estación).

## No-objetivos
Módulo weather (T-08), coeficiente en el API (se añade cuando T-04 merjee — si T-04 ya está en main
al empezar, inclúyelo como `GET /v1/ports/:slug/coefficient?date`; si no, déjalo fuera y anótalo).

### Pendiente de integración: coeficiente (T-04)
T-04 **no estaba en `main`** al ejecutar esta trayectoria (va en paralelo), así que el endpoint
`GET /v1/ports/:slug/coefficient?date` **queda fuera** de T-07. Cuando T-04 merjee, añadirlo es:

1. un caso de uso `getCoefficient` en `packages/usecases` (con `data/brest/constituents.json` detrás
   de un puerto propio, igual que `StationRepository`),
2. su adaptador en `packages/adapters` y su entrada en `createCoreDeps`,
3. una línea en `registerCoreRoutes` con el mismo `route(...)` y `sendDeterministic(...)` que las
   otras seis.

No hace falta tocar ni el dominio ni el contrato de módulos.

## DoD extra (doctrina T-161)
Checkbox T-07 en ROADMAP.md + entrada CHANGELOG.md en commit final separado. Sin `[skip-traj]`.
