# T-04 — domain-coefficient

**Objetivo**: coeficiente de mareas (escala 20–120, tradición SHOM) calculado con predicción propia
de Brest, en `packages/domain-core/src/coefficient/` — TS puro, más dos mejoras del motor que el QC
de T-05 dejó señaladas.

## Entregables

1. **Coeficiente**: `C = semirrango de la marea del día en Brest / U × 100`, con `U = 3,05 m` (unit
   height: semirrango medio de sizigia equinoccial en Brest). Valores por marea (cada pleamar) y
   agregado diario (mañana/tarde como hace tablademareas). Entrada: constituyentes de Brest
   (`data/brest/constituents.json`, ya en main); el dominio recibe los constituyentes por parámetro
   (cero IO). Redondeo documentado; rango [20, 120] con clamp explícito y contado si se produce.
2. **+5 constituyentes al motor TS**: EP2, MA2, MB2, MKS2, 2MS6 (Doodson publicado; ya implementados
   en `data/pipeline/mareia_pipeline/tides/constituents.py` como referencia). Según el QC de T-05,
   suben Vigo/Santander/Brest a grade A por truncado < 1 cm. El test
   `test_engine_catalog_matches_the_typescript_engine` del pipeline parsea el catálogo TS — comprueba
   que sigue verde (el catálogo Python ya los tiene).
3. **Factor nodal de M3**: decidir forma canónica (motor TS usa `f(M2)^1.5`; pipeline usa la forma de
   Schureman `cos⁶(I/2)/0,8758`; difieren ~1%). Adoptar la forma de Schureman en ambos (es la
   publicada) y documentar la referencia; verificar contra los golden tests existentes.

## Tests
- Coeficiente de fechas conocidas 2026 dentro de ±2 de valores publicados (fixtures con procedencia:
  p.ej. tablas públicas de coeficientes de mareas francesas — transcritos con cita, no scrapeados de
  SHOM en masa); vivas/muertas correctas en sizigias/cuadraturas de 2026 (fases ya calculables con
  astronomy/ de T-03).
- Propiedades: C ∈ [20,120]; máximos cerca de sizigia, mínimos cerca de cuadratura; continuidad
  entre días consecutivos (sin saltos > umbral documentado).
- Golden tests del motor intactos tras los 5 constituyentes y el cambio de M3 (tolerancias iguales).

## No-objetivos
UI, endpoints (T-07), regenerar el dataset (los grades suben cuando T-13 re-ejecute el pipeline).

## DoD extra (doctrina T-161)
Checkbox T-04 en ROADMAP.md + entrada CHANGELOG.md en commit final separado. Sin `[skip-traj]`.
