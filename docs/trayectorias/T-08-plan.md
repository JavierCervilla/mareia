# T-08 — module-weather-backend

**Objetivo**: el módulo `weather` (backend) por el contrato `AppModule` de T-06 — adapters de
Open-Meteo y AEMET con caché Deno KV, endpoints del módulo, y las atribuciones viajando por el
manifiesto. Primer módulo real del registry.

## Entregables

1. **Adapter Open-Meteo** (`packages/modules/weather/`): cliente de la Marine API (olas
   total/wind/swell con altura/dirección/periodo, SST) + Forecast API (viento/rachas, presión,
   visibilidad, UV) — sin API key (tier no comercial). Clave de caché por **celda 0,1° + hora UTC**
   (colapsa puertos vecinos); TTL 1h marine / 30min forecast. Atribución CC-BY 4.0 en el manifiesto.
2. **Adapter AEMET** (boletines marítimos costera): patrón 2 llamadas (URL temporal), API key desde
   `AEMET_API_KEY` (env — NUNCA hardcodeada; sin key el adapter degrada con estado explícito
   `unavailable`, no rompe). TTL 6h por zona marítima. Mapeo puerto→zona costera en un JSON de
   configuración del módulo.
3. **Caché**: puerto `WeatherCache` (interfaz) + adapter **Deno KV** (`--unstable-kv` si hace falta)
   con TTL; en tests, caché en memoria. Test clave: 2ª llamada misma celda+hora NO sale a red.
4. **Módulo `AppModule`**: `id: 'weather'`, `api(deps)` → router con `GET .../weather?port=<slug>`
   (agregado marine+forecast con `fetchedAt` y edad) y `GET .../bulletin?port=<slug>`; healthcheck
   real (ping barato o estado de la última llamada); `attributions` obligatorias (Open-Meteo, AEMET);
   alta en `apps/api/src/modules.config.ts` (queda montado en `/v1/modules/weather/...`).
5. **Tests**: HTTP mockeado (inyección del fetch — cero red en CI), caché (2ª llamada no fetch),
   degradación AEMET sin key, contrato de respuesta con `fetchedAt`/`stale`. Un smoke opcional
   manual contra la red real documentado pero NO en CI.
6. **Nits heredados de T-07** (TODO en dashboard): validar `year` con `/^\d{4}$/`, `listPorts`
   ordena (con test), `--allow-read` acotado. Van aquí por ser el siguiente PR que toca el API.

## No-objetivos
UI del módulo (T-11), NDBC/CMEMS (fase 2), scoping por puerto del montaje de módulos (la decisión de
T-06 sigue: `?port=<slug>` como query param).

## DoD extra (doctrina T-161)
Checkbox T-08 en ROADMAP.md + entrada CHANGELOG.md en commit final separado. Sin `[skip-traj]`.
