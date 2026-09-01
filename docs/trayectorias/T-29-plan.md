# T-29 · A-20: la procedencia del RMSE deja de ser autodeclarada (lo que se pueda)

**Trayectoria**: `cmtio50jt000smruyft68eqi2` · hija de E-MAREIA · **Rama**: `claude/T-29-procedencia-rmse`
**Origen**: hallazgo **A-20** del pase adversario de T-13, abierto en el ledger desde entonces.

## El hallazgo, tal cual

`test_measured_here.py` es el trinquete del invariante **«un puerto sólo publica el error que se ha
medido en él»**, y su cabecera dice que ataca «por los tres sitios por los que el atajo puede volver».
A-20 encontró **el cuarto**:

> Se reconstruyó el fraude de T-05 en su versión de hoy — Cabo de Palos publicando el RMSE real de
> Cartagena (0,0506 m) bajo el código `carg1`, con `observation_lat/lon` **reescritas** a 0,709 km de
> su dársena y la distancia declarada **recomputada** para que cuadre — y el invariante lo aceptó.

Lo que lo hace un hallazgo y no una queja: **el desmentido ya está en el artefacto publicado y nadie
lo mira.** Cartagena publica ese mismo `carg1` en 37,570 N −0,980 E, a **26,6 km** de donde el fichero
falsificado lo sitúa. El dataset se contradice a sí mismo y ningún gate lee esa contradicción.

## Lo medido hoy (154 ficheros)

| | |
|---|---|
| ficheros de estación | **154** |
| publican `observation_code` | **35** |
| códigos de mareógrafo distintos | **32** |
| códigos citados por **más de un** fichero | **3** |
| discrepancia máxima entre dos ficheros que citan el mismo código | **0,0000 km** |
| diferencia máxima entre la distancia **declarada** y la **recomputada** | **0,0005 km** (35/35) |

## Entregables

1. **Gate · el mismo mareógrafo está en el mismo sitio en todos los ficheros que lo citan.** Nace
   verde. **Cubre 3 de los 32 códigos**, y el mensaje del gate lo dice con esas cifras: un código que
   sólo cita un fichero no tiene quien lo desmienta, y un gate que no dijera su alcance haría creer lo
   contrario. Es la misma honradez que el mensaje de P6 en T-21 («NO cubre las otras 334 de 348»).
2. **Gate · la distancia declarada se recomputa desde las dos coordenadas publicadas.** Nace verde,
   **35 de 35**, tolerancia 1 m. Cierra la versión perezosa del fraude —reescribir las coordenadas y
   dejar la distancia vieja—, que hoy no la caza nadie.

## Lo que estos gates NO cierran, dicho aquí y no descubierto luego

El fraude **exacto** de A-20 —un código citado por **un solo** fichero, con las coordenadas reescritas
**y** la distancia recomputada— **sigue pasando**. Ninguna de las dos comprobaciones puede verlo,
porque las dos son internas al artefacto y ahí no queda ninguna contradicción.

Cerrarlo exige **saber desde fuera dónde está cada mareógrafo**: una captura versionada del registro
de estaciones del IOC contra la que re-derivar, o CI con red. Es **la misma decisión de arquitectura
que T-21 dejó abierta** (H-2/H-4: recorte mayor versionado, CI con red, o dejar de commitear el
derivado), y no se toma de pasada dentro de esta trayectoria.

**Así que A-20 no se cierra: se estrecha.** Y el ledger lo dirá con esas palabras — «de las tres
formas de inyectar un RMSE ajeno, dos quedan cerradas y una queda abierta con su nombre» — porque un
hallazgo marcado como cerrado sin estarlo es peor que uno abierto.

## Definition of Done

`ruff` · `pytest` · `python run.py check` · `pnpm lint` · `pnpm typecheck` · **`pnpm test` en la
raíz** · **`pnpm test:e2e` entero**. Los dos gates **probados en rojo con el fraude de A-20
reconstruido**, no con un caso inventado. Ledger actualizado. `ROADMAP`/`CHANGELOG` con `assert`.
