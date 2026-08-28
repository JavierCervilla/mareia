# T-11 — module-weather-ui

**Objetivo**: la cara visible del módulo `weather` de T-08 — la isla meteo en la página de puerto,
con los **estados de degradación que el backend ya sabe expresar** hechos visibles. Es el primer
sitio del portal donde el dato puede ser viejo, y la página tiene que decirlo sin que haya que
buscarlo.

## Entregables

1. **`pageSections` del módulo `weather`**: la sección meteo por el contrato `AppModule`, dada de
   alta en `apps/web/src/modules.config.ts`. Como en T-10, la página construye sin el módulo (test).
2. **La isla meteo**: estado del mar (olas total/wind/swell con altura, dirección y periodo, y
   temperatura del agua) y de la atmósfera (viento y rachas, presión, visibilidad, UV). Direcciones
   en rosa de 16 rumbos además de los grados: «NE (045°)» se lee, «045°» se descifra.
3. **Los cuatro estados, todos con su cara** — esto es el corazón de la trayectoria, no un caso
   borde: `ok`, `stale` (dato servido de caché caducada: **con su antigüedad en la cara**, «hace 3 h
   10 min», no un icono), `unavailable` (con el motivo que da el backend, incluida la credencial de
   AEMET ausente o caducada) y **carga sin datos**. Ninguno de los cuatro puede parecerse a otro: un
   dato de hace tres horas presentado como fresco es peor que no publicarlo.
4. **Boletín de AEMET**: el texto oficial de la zona marítima, citado como cita —con su hora de
   emisión y su zona—, no reescrito. Si falta la credencial, el hueco lo explica en vez de
   desaparecer.
5. **Atribuciones visibles**: Open-Meteo (CC-BY 4.0) y AEMET en la propia sección, no solo en el pie
   ni solo en `/v1/modules`. El contrato de T-06 no deja compilar un módulo sin ellas; aquí además
   se ven.
6. **Cómo entra el dato en una página estática**: el core es SSG y la meteo caduca. Decide y
   **documenta el tradeoff en el plan antes de picar**: isla hidratada que pide al API en el cliente
   (rompe el «cero JS» del core, pero el dato es de ahora) frente a inyectarlo en build (mantiene el
   cero JS, pero el dato envejece hasta el rebuild). Sea cual sea, el sello de antigüedad manda.
7. **Recorrido Playwright con el API mockeado**: los cuatro estados forzados uno a uno contra la
   página construida, con captura de cada uno para el informe. Cero red en CI.

## No-objetivos
Mapas y modelos gráficos (fase 2), alertas/avisos costeros más allá del boletín, NDBC/CMEMS,
precache offline de la meteo (T-12).

## DoD extra (doctrina T-161)
Checkbox T-11 en ROADMAP.md + entrada CHANGELOG.md. Sin `[skip-traj]`. Toca UI real → pase
adversario obligatorio al cierre, coordinado con el orquestador (NO uses `[skip-adv]`).
