# T-10 — module-fishing-ui

**Objetivo**: el módulo `fishing` con **UI de verdad** — el primer módulo que aporta `pageSections` a
la página de puerto por el contrato `AppModule` de T-06. Los periodos solunares dejan de ser un
endpoint y pasan a leerse encima de la curva de marea.

## Entregables

1. **Módulo `fishing`** (`packages/modules/fishing/`) por el contrato `AppModule`: `id: 'fishing'`,
   `pageSections` con la sección de actividad, atribuciones obligatorias (la teoría solunar es de
   dominio público, pero el cálculo es nuestro: cítalo como tal, sin inventar una fuente). Alta en
   `apps/web/src/modules.config.ts` — dar de baja el módulo debe ser borrar una línea, y la página
   tiene que seguir construyendo sin él (test).
2. **Overlay solunar sobre el gráfico de 24 h** (SVG estático, cero JS de cliente como el resto del
   core): las bandas de los periodos mayores (2 h en cada tránsito lunar) y menores (1 h 30 en orto
   y ocaso) pintadas **bajo** la curva, no encima, para que la marea siga siendo lo legible. Las
   bandas que se salen del día civil se recortan, no se dibujan fuera del lienzo.
3. **Sección de actividad del día**: el rating 0-100 con su etiqueta, la tabla de los cuatro
   periodos con sus horas locales, y —esto es lo importante— **el desglose de por qué**: qué suma
   cada factor. El rating es una convención, y la página tiene que decirlo con esas palabras en vez
   de presentarlo como una medida.
4. **Honestidad del solunar** (requisito de producto, no adorno): la teoría solunar **no tiene
   respaldo experimental sólido**. La sección lo declara con un enlace a la metodología. No se
   promete pesca; se publica un cálculo reproducible. Un test comprueba que ese aviso existe en las
   12 páginas: si alguien lo borra, el CI se entera.
5. **Recorrido Playwright** sobre el `dist/` construido: las bandas existen en el SVG, sus horas
   coinciden con las que publica el usecase `getSolunar` para ese puerto y día (golden contra el
   dominio, no contra el HTML), y la página sigue construyendo con el módulo dado de baja.

## No-objetivos
Especies/vedas (fase 2), rating por especie, islas dinámicas (T-12), meteo (T-11).

## DoD extra (doctrina T-161)
Checkbox T-10 en ROADMAP.md + entrada CHANGELOG.md. Sin `[skip-traj]`. Toca UI real → pase
adversario obligatorio al cierre, coordinado con el orquestador (NO uses `[skip-adv]`).
