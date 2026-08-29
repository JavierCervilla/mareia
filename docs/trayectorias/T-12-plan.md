# T-12 — pwa-offline

**Objetivo**: que el almanaque de un puerto favorito **funcione sin red**. Es la promesa que separa
a Mareia de una web de mareas: quien está en el agua no tiene cobertura, y las mareas de mañana no
dependen de internet — se calculan con las constantes armónicas y el motor, los dos ya en el
navegador si se los precachea.

## Por qué ahora
T-09 dejó el HTML completo sin JS, T-10 las bandas en build y T-11 el único dato que caduca, con su
sello. Los tres estados están decididos: lo que falta es que la página siga en pie sin red y que
**diga con qué se está quedando**.

## Entregables

1. **Service worker + manifest** (`apps/web`): instalable, con icono y nombre; estrategia
   **cache-first para el core** (HTML, CSS, la fuente) y **network-first con caída a caché para la
   meteo**, que es lo único que caduca. La `PrecachePolicy` del contrato `AppModule` (T-06) existe
   precisamente para que cada módulo declare qué quiere precachear: **úsala, no la ignores**.
2. **Favoritos en el cliente** (IndexedDB, cero cuentas y cero servidor — decisión del Design Doc):
   marcar un puerto guarda su página y **su almanaque del año** para poder calcular cualquier día
   sin red. Un favorito es un acto explícito: no se precachea lo que el usuario no pidió.
3. **Cálculo offline de una fecha futura**: con el puerto en favoritos y sin red, pedir el 14 de
   marzo debe dar la tabla del 14 de marzo — calculada en el navegador con el mismo motor de
   `domain-core` que usa el API. Esto es lo que hace que la promesa sea real y no un caché de
   páginas.
4. **Honestidad offline, que es la parte que se descuida**: sin red, la meteo **no está** y hay que
   decirlo con la antigüedad de lo último que se guardó (T-11 ya sabe hacerlo: reutiliza su sello,
   no inventes otro). Y la página debe distinguir **«sin red»** de **«el dato no existe»**: son dos
   ausencias distintas, y confundirlas es el hallazgo A-11 de T-09 otra vez.
5. **Actualización sin trampa**: cuando hay versión nueva, el service worker no puede servir una
   página vieja en silencio. Decide y documenta la política (activación inmediata, aviso al usuario,
   o recarga al navegar) y **di qué pierdes**.
6. **Recorrido Playwright offline** (`context.setOffline(true)`): favorito guardado → cortar la red →
   la página abre, la tabla del día está, una fecha futura se calcula, y la meteo aparece con su
   sello de antigüedad o su ausencia explicada. Con capturas.

## No-objetivos
Notificaciones push, sincronización en segundo plano, instalación nativa (los widgets son T-16, ya
especificado), y el rebuild diario (T-15).

## Riesgos que el implementador debe mirar de frente
- Un service worker mal puesto **sirve una versión vieja para siempre** y es de los bugs más caros
  de diagnosticar. Es la razón de ser del entregable 5.
- Precachear el almanaque de 12 puertos × 1 año puede ser mucho peso: **mide** y decide qué se
  guarda, con la cifra en el CHANGELOG.
- El cero-JS del core es un gate vivo (`adversario-t09.test.ts`): un service worker **no es** un
  script de página, pero compruébalo en vez de suponerlo.

## DoD extra (doctrina T-161)
Checkbox T-12 en ROADMAP.md + entrada CHANGELOG.md. Sin `[skip-traj]`. Toca UI → pase adversario
obligatorio al cierre (NO uses `[skip-adv]`).
