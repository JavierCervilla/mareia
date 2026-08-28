# T-16 — widget-spec

**Objetivo**: fijar la especificación v1 de los widgets de pantalla de inicio (iOS WidgetKit /
Android Glance) alimentados por la PWA de Mareia empaquetada con Capacitor, **antes** de que exista
el shell nativo. Trayectoria de spec: no se escribe código de producción.

## Origen

El humano trajo una spec genérica de widgets PWA+Capacitor («en esta app quedan bien») y pidió
añadirla al proyecto. Se adapta al dominio de Mareia en vez de guardarla en genérico: una spec con
`myapp://` y «tareas pendientes» no es accionable aquí.

## Asunciones (Think Before Coding)

1. **El contenido del widget es la tabla del día del puerto favorito** (eventos PM/BM, coeficiente,
   siguiente evento como dato primario) — es lo que la app ya promete y es determinista.
2. **El payload se genera sin red** desde el mismo almanaque que T-12 precachea; el widget nunca
   llama al API.
3. **Esta trayectoria entrega la spec, no la implementación**: el shell Capacitor (`apps/mobile`)
   y las extensiones nativas son trayectorias futuras que nacerán de esta spec.

## Tradeoffs

- **Adaptar la spec a Mareia vs. copiarla verbatim**: se adapta (identificadores `mareia://`,
  ejemplos de mareas, monorepo, validación sin zod) manteniendo intactas la estructura y las reglas
  del contrato. Una spec genérica archivada envejece sin dueño; una adaptada es el punto de partida
  real de la implementación.
- **`expiresAt` a medianoche local del puerto vs. TTL fijo (12 h)**: medianoche local. Los datos de
  marea son del día civil del puerto (mismo criterio que el API, T-07); un TTL fijo mostraría como
  «frescos» eventos de ayer o cortaría un payload aún válido.

## Entregables

1. `docs/espec-widgets-pwa-capacitor.md` — la spec v1 adaptada (contrato WidgetPayload, estados,
   tamaños, refresco, QA), con las decisiones abiertas señaladas (bundle id/App Group, esquema de
   deeplink, zod sí/no).
2. Este plan.
3. ROADMAP (línea en Fase 2) + CHANGELOG en el mismo PR (DoD del framework).

## No-objetivos

Shell Capacitor, extensiones WidgetKit/Glance, `widget-service.ts`, elección de plugin de bridge,
Live Activities. Todo eso son trayectorias futuras (fase 2 del roadmap).
