# Roadmap — Mareia

> Terminado = ~200–300 puertos españoles con página completa (mareas + coeficiente + sol/luna +
> solunar + meteo) desplegada en producción, transparente (metodología, QC y dataset abiertos) y con
> los gates del enjambre en verde. No apto para navegación, no comercial, AGPL-3.0.

## Hito 1 — Cimientos (scaffold + dominio)

- [x] T-01 · Monorepo (Astro web + API Deno/Express + packages) con los 4 gates en CI
- [x] T-02 · Motor de mareas TS (suma armónica + correcciones nodales) con golden tests
- [x] T-03 · Astronomía + solunar (Astronomy Engine, periodos 2+2 y rating)
- [x] T-04 · Coeficiente de mareas (Brest, U = 3,05 m)
- [x] T-06 · Contrato de módulo `AppModule` + registries + test de capas

## Hito 2 — Datos y API

- [x] T-05 · Pipeline Python → JSON canónico (`station/v1`) para 12 puertos piloto con QC vs IOC
      (Portus no publica constantes por vía automatizable; ver el informe QC)
- [x] T-07 · Endpoints core (`tides`, `astro`, `solunar`, `almanac`, `ports`) con contract tests
      (el de coeficiente se añade cuando merjee T-04)
- [x] T-08 · Módulo weather backend (Open-Meteo + AEMET + caché Deno KV)
      (los códigos de zona costera de AEMET quedan sin verificar hasta que haya `AEMET_API_KEY`;
      la caducidad de esa clave se vigila sola y avisa a 21, 7 y 1 días)

## Hito 3 — Portal (10 puertos piloto)

- [x] T-09 · Página de puerto SSG (tabla + gráfico + coeficiente + sol/luna) + índices geográficos,
      con canónicas, sitemap y JSON-LD (la medida Lighthouse SEO ≥ 95 queda pendiente de T-15: no
      hay navegador en CI; el comando está documentado en `apps/web/design-brief.md` §8)
- [x] T-10 · Módulo pesca UI (overlay solunar + rating), primer módulo que aporta interfaz por el
      contrato `AppModule` (el rating se publica como convención declarada, con su desglose y el
      aviso de que la teoría solunar no tiene respaldo experimental sólido)
- [ ] T-11 · Módulo weather UI (isla meteo con estados ok/error/stale)
- [ ] T-12 · PWA offline (almanaque de favoritos sin red)

## Hito 4 — España completa y transparencia

- [ ] T-13 · ~200–300 puertos con grade ≥ B o flag «estimado»
- [ ] T-14 · Metodología pública + QC navegable + dataset CC-BY + API pública documentada
- [ ] T-15 · Deploy en producción (Dokploy) + e2e + pase adversario
      (queda del peldaño 1 del gate de seguridad `actionlint` sobre `.github/workflows/` —es el
      único que lee los `run:` embebidos—; el `shellcheck -S error` sobre los `.sh` del repo **ya
      corre desde T-17**, con `hadolint` al lado. Y el healthcheck del API, que queda fuera del
      enrutado público porque solo se publica `/v1/*`)
      · **La web ya está hecha, en T-17**: `apps/web/Dockerfile` construido y probado con `curl`
      (rutas de directorio, 301 a la barra final, 404 con el cuerpo de `404.html`, y ninguna URL del
      dominio contestando con una página ajena al portal), sirviendo en `0.0.0.0:3000` sin root, sin
      toolchain en la imagen y con las bases fijadas por digest — ver `docs/despliegue.md`, que
      incluye por qué **no** se escucha además en el 80. Aquí siguen el API con su volumen KV, el
      rebuild diario que hornea el día, el healthcheck del contenedor, el e2e contra producción y el
      pase adversario de despliegue.

## Fase 2 (rumbo, sin comprometer)

- [ ] App móvil (shell Capacitor) con widgets de pantalla de inicio (iOS WidgetKit / Android
      Glance) — spec v1 cerrada en `docs/espec-widgets-pwa-capacitor.md` (T-16)
- [ ] Módulo navegación (carta OSM seamark, batimetría GEBCO/EMODnet, AIS)
- [ ] Módulo pesca ampliado (especies GBIF/OBIS, vedas/tallas por CCAA curadas)
- [ ] Cobertura internacional (NOAA EEUU, FES2022 global)
