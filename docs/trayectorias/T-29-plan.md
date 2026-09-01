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

## Entregables — corregido al medir

El plan salió con **dos** gates y con la afirmación de que el fraude exacto de A-20 seguiría pasando.
**Las dos cosas eran falsas**, y las corrigió el propio trabajo:

1. **El segundo gate ya existía.** «La distancia declarada se recomputa» es
   `test_the_observation_distance_is_recomputed_not_believed`, escrito en T-13, con un docstring que
   dice lo mismo que iba a decir el mío. Se escribió por duplicado y **se retiró al descubrirlo**: dos
   superficies del mismo invariante se desincronizan, que es la lección de T-20.
2. **El fraude exacto de A-20 sí queda cerrado.** Se reconstruyó entero —Cabo de Palos publicando el
   RMSE real de Cartagena (0,0506 m) bajo `carg1`, coordenadas a **0,712 km** de su dársena, distancia
   **recomputada**, y `estimated`/`grade`/motivos intactos para que los demás invariantes lo
   re-derivasen bien— y así construido **pasa los 624 controles anteriores**. Sólo lo ve el gate nuevo,
   que nombra los dos ficheros y los **26,2 km**.

   **Y se entiende por qué**: inyectar el error de otro puerto obliga a **citar su mareógrafo**, y ese
   puerto también lo publica. **El fraude se crea a sí mismo el segundo citador**, así que la
   estrechez que se temía —«sólo cubre 3 de 32 códigos»— no le aplica: el código deja de tener un solo
   citador en el momento en que alguien lo copia.

**Así que el entregable es uno**: el mismo mareógrafo tiene que estar en el mismo sitio en todos los
ficheros que lo citan. Nace verde (0,0000 km de discrepancia entre los 3 códigos compartidos hoy) y
lleva su alcance en el mensaje del fallo.

## Lo que sigue abierto, con su nombre

Un RMSE atribuido a un mareógrafo que **ningún otro fichero cita**. Ahí no queda contradicción interna
que leer, y hace falta un registro **externo** de dónde está cada estación: una captura versionada del
IOC contra la que re-derivar, o CI con red. Es la misma decisión de arquitectura que **T-21** dejó
abierta (H-2/H-4) y no se toma de pasada.

**A-20 se estrecha mucho, no se borra**, y el ledger lo dirá así.

## Definition of Done

`ruff` · `pytest` · `python run.py check` · `pnpm lint` · `pnpm typecheck` · **`pnpm test` en la
raíz** · **`pnpm test:e2e` entero**. Los dos gates **probados en rojo con el fraude de A-20
reconstruido**, no con un caso inventado. Ledger actualizado. `ROADMAP`/`CHANGELOG` con `assert`.
