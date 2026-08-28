# Roadmap — Mareia

> Terminado = ~200–300 puertos españoles con página completa (mareas + coeficiente + sol/luna +
> solunar + meteo) desplegada en producción, transparente (metodología, QC y dataset abiertos) y con
> los gates del enjambre en verde. No apto para navegación, no comercial, AGPL-3.0.

## Hito 1 — Cimientos (scaffold + dominio)

- [x] T-01 · Monorepo (Astro web + API Deno/Express + packages) con los 4 gates en CI
- [x] T-02 · Motor de mareas TS (suma armónica + correcciones nodales) con golden tests
- [x] T-03 · Astronomía + solunar (Astronomy Engine, periodos 2+2 y rating)
- [ ] T-04 · Coeficiente de mareas (Brest, U = 3,05 m)
- [x] T-06 · Contrato de módulo `AppModule` + registries + test de capas

## Hito 2 — Datos y API

- [ ] T-05 · Pipeline Python → JSON canónico (`station/v1`) para 10 puertos piloto con QC vs Portus
- [ ] T-07 · Endpoints core (`tides`, `astro`, `solunar`, `almanac`, `ports`) con contract tests
- [ ] T-08 · Módulo weather backend (Open-Meteo + AEMET + caché Deno KV)

## Hito 3 — Portal (10 puertos piloto)

- [ ] T-09 · Página de puerto SSG (tabla + gráfico + coeficiente + sol/luna), SEO ≥ 95
- [ ] T-10 · Módulo pesca UI (overlay solunar + rating)
- [ ] T-11 · Módulo weather UI (isla meteo con estados ok/error/stale)
- [ ] T-12 · PWA offline (almanaque de favoritos sin red)

## Hito 4 — España completa y transparencia

- [ ] T-13 · ~200–300 puertos con grade ≥ B o flag «estimado»
- [ ] T-14 · Metodología pública + QC navegable + dataset CC-BY + API pública documentada
- [ ] T-15 · Deploy en producción (Dokploy) + e2e + pase adversario

## Fase 2 (rumbo, sin comprometer)

- [ ] Módulo navegación (carta OSM seamark, batimetría GEBCO/EMODnet, AIS)
- [ ] Módulo pesca ampliado (especies GBIF/OBIS, vedas/tallas por CCAA curadas)
- [ ] Cobertura internacional (NOAA EEUU, FES2022 global)
