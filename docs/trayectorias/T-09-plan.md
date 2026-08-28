# T-09 — web-port-page-core

**Objetivo**: la página de puerto SSG en Astro — el corazón SEO del portal — con las secciones core
(tabla de mareas día+mes, gráfico 24h, coeficiente, sol/luna) calculadas en build con el MISMO
dominio que usa el API, más la jerarquía región/provincia y los deberes SEO.

## Prerrequisito (deudas de T-01, PRIMERA subtarea)
Instalar el gate de UI ANTES de escribir la primera vista: skill `frontend-anti-slop` del framework
(`/home/user/AgenticFramework/.claude/skills/frontend-anti-slop/` — lee su SKILL.md: brief-first +
linter determinista; el brief de diseño se escribe y commitea), `eslint-plugin-astro` (lint de
`.astro` cableado en `pnpm lint`), y `astro check` en el job CI de web. También: pin de semgrep en CI
y `--frozen` en los comandos deno del CI (deudas menores del verificador de T-01).

## Entregables

1. **Rutas SSG** (`apps/web/src/pages/`): `/mareas/[region]/[provincia]/[puerto]/` vía
   `getStaticPaths` sobre `data/geo/ports.json` (12 páginas) + índices `/mareas/` (regiones),
   `/mareas/[region]/` y `/mareas/[region]/[provincia]/`. Los datos se calculan EN BUILD llamando a
   los usecases de `packages/usecases` (mismo dominio que el API — cero duplicación).
2. **Secciones core de la página de puerto** (layout de slots preparado para las `pageSections` de
   módulos de T-06, aunque aún no haya módulos con UI):
   - Tabla de pleamares/bajamares del día + tabla mensual (CSS print-friendly).
   - Gráfico de altura 24h en SVG estático (sin JS para el core) con los extremos marcados.
   - Coeficiente del día (valor + etiqueta viva/muerta) y progresión del mes.
   - Sol y luna: ortos/ocasos con acimut, crepúsculos, fase con % iluminación.
   - **Transparencia**: badge del grade de la estación (A/B/C) con enlace a la explicación; en
     puertos micromareales (grade C con p95 null) un aviso destacado: "marea astronómica débil aquí;
     el residuo meteorológico domina" (decisión de producto del QC de T-05).
   - Banner permanente "No apto para navegación" + atribuciones en el footer.
3. **SEO**: `<title>`/meta description por puerto, sitemap.xml, JSON-LD (`Place`), canónicas,
   secciones ancladas (`#tabla-de-mareas`, `#sol-y-luna`, `#coeficiente`), breadcrumbs.
4. **Brief de diseño** (frontend-anti-slop, brief-first): commitear el brief ANTES de la primera
   vista; tipografía/paleta/espaciado con criterio, no defaults; el linter anti-slop de UI en verde.
5. **Tests**: build genera las 12+índices; el HTML de Vigo contiene los 4 extremos del día del build
   (golden contra usecases); Lighthouse SEO ≥ 95 si es ejecutable en CI local (si no, documentar el
   comando y dejarlo informativo); `astro check` verde.

## No-objetivos
Islands dinámicas (marcador "ahora" → T-12 con la PWA), UI de módulos (T-10/T-11), rebuild diario
programado (T-15 con Dokploy).

## DoD extra (doctrina T-161)
Checkbox T-09 en ROADMAP.md + entrada CHANGELOG.md en commit final separado. Sin `[skip-traj]`.
Este PR toca UI de verdad → el pase adversario del check exigirá informe: coordina con el orquestador
al cierre (NO uses [skip-adv]).
