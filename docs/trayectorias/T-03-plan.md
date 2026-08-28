# T-03 — domain-astro-solunar

**Objetivo**: astronomía y periodos solunares en `packages/domain-core/src/{astronomy,solunar}/` —
cálculo 100% local con `astronomy-engine` (MIT) envuelto tras una interfaz propia.

## Entregables
1. **astronomy/**: wrapper tipado de astronomy-engine tras interfaz propia (`AstronomyGateway`):
   orto/ocaso de sol y luna (con acimut), crepúsculos civil/náutico/astronómico, fase lunar
   (edad, % iluminación, próximas fases), tránsito superior e inferior de la luna, distancia lunar.
   El instante es epoch ms UTC (`number`), como en tides/. astronomy-engine es dependencia de
   RUNTIME de domain-core (única excepción aprobada en el Design Doc: "matemática vendorizada").
2. **solunar/**: puro sobre astronomy/ — periodos mayores (≈2h centrados en tránsito
   superior/inferior) y menores (≈1-1,5h en orto/ocaso lunar), 2+2 por día lunar (24h50m; alguno
   puede caer fuera del día civil); rating de actividad: base por fase (máximo nueva/llena ±2 días,
   mínimo cuartos) + bonus si un periodo solapa orto/ocaso solar. Escala documentada (p.ej. 0-100 +
   etiquetas baja/media/alta/muy alta con umbrales exactos; estado terminal solo por exactitud).
3. **Tests**: ortos/ocasos de sol y luna vs efemérides publicadas (USNO/IMCCE u otra fuente citada,
   fixtures commiteados con procedencia) para Madrid y Las Palmas (±2 min), tránsitos (±3 min),
   fases 2026 (fechas oficiales ±1h); propiedades: 2+2 periodos por día lunar, solapamiento
   correcto, invariancia TZ (todo UTC + tz IANA solo en presentación).
## No-objetivos
UI, coeficiente (T-04), integración con la página de puerto (T-09/T-10).
## DoD extra (doctrina T-161)
Checkbox en ROADMAP.md + entrada en CHANGELOG.md, en commit final separado.
