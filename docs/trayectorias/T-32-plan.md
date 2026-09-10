# T-32 · P6 contra la fuente entera: cerrar A-T21 H-2 y H-4

**Trayectoria**: `cmtustkjv005s92khhtrbrxyu` · hija de E-MAREIA · **Rama**: `claude/T-32-p6-fuente-entera`
**Origen**: la decisión del humano del 10-sep sobre los dos hallazgos que T-21 dejó abiertos.

## El problema, con las cifras de hoy

**P6** es el único gate que compara el artefacto contra **la fuente** en vez de contra sí mismo:
rehace las relaciones puerto–área desde la geometría de RAMPE con el mismo parser y las diffea campo
a campo. Pero sólo puede leer lo que está commiteado, y lo commiteado es un recorte:

| | |
|---|---|
| áreas del recorte capturado | **7** de **86** |
| relaciones que cubre | **14** de **348** |
| relaciones «cae dentro» que cubre | **0** de 10 |
| tamaño de RAMPE 2025 completo | **54,8 MB** |

Los dos ataques abiertos caen justo fuera: la *Reserva marina de Masía Blanca* (`555552489`) de
**H-2** y las cinco áreas cuyo `dentro` vuelca en **H-4** no están en el recorte, así que sus
recorridos siguen pasando y conservan su `test.fail()`.

## La decisión, y lo que la hizo tomable

El humano eligió **que CI baje la fuente**. Lo que lo desbloquea es una comprobación que se hizo
antes de planificar, no después: **RAMPE responde** — `Rampe2025_geojson.zip`, HTTP 200, **12 MB en
4 s**. Así que esto se puede **validar en local** contra las 86 áreas antes de tocar el workflow, en
vez de escribir el YAML a ciegas y descubrirlo en CI.

## Tres asunciones y dos tradeoffs

**Asunciones**
1. **El camino de descarga ya existe y es el bueno**: `rampe.descargar_areas()` es lo que usa la
   ingesta de verdad. P6 con la fuente entera no estrena un segundo lector — reusa ése, que es lo que
   hace que el gate se rompa con la ingesta si el lector se rompe, en vez de compararla con una
   segunda implementación que nadie mantiene.
2. **El recorte no se retira.** Sigue siendo lo que permite correr P6 sin red, que es el modo por
   defecto en local. Lo que cambia es que deja de ser *lo único*.
3. **La fuente puede caerse.** MITECO no promete disponibilidad, y un gate que dependa de que
   responda siempre acabará en rojo por algo que no es del PR.

**Tradeoffs**
1. **CI pasa a depender de una fuente externa.** A cambio, P6 cubre 348 de 348 en vez de 14. Se paga,
   pero **no en silencio**: ver abajo.
2. **12 MB por ejecución de CI.** Frente a commitear 54,8 MB una vez y que envejezcan. Se paga.

## El diseño que importa: el alcance se **declara** y el gate lo **exige**

Aquí está la trampa que este cambio podría introducir, y es la lección que T-22-A acaba de dejar
escrita: *un canario contra un umbral no es un canario*.

Si P6 «usa la fuente si puede y si no el recorte», entonces **una descarga fallida en CI baja la
cobertura de 348 a 14 y el check sigue en verde**. Nadie se entera de que el gate encogió: es
exactamente «verde por medir a casi nadie», con otra ropa.

Así que el alcance no se descubre, **se pide**:

- Sin pedir nada → recorte, como hoy, con su mensaje diciendo «14 de 348».
- Pidiendo la fuente entera → si no se puede bajar o no cubre las 348, **es rojo**. No degrada.

El que llama declara qué cobertura espera y el gate comprueba que la obtuvo. Es `medidos === sujetos`
aplicado al alcance, en vez de `medidos > umbral`.

## Entregables

1. El camino de la **fuente descargada** en P6, reusando `rampe.descargar_areas()`.
2. El **alcance exigido**: cuando se pide la fuente entera y no se alcanza, rojo con el motivo.
3. El mensaje del ✓ dice la cobertura **real de esa ejecución**, no una fija.
4. **CI** baja la fuente y corre P6 exigiendo las 348.
5. **Se retiran los `test.fail()` de H-2 y H-4**, y sus dos recorridos pasan a gate permanente. Si al
   retirarlos no se ponen en rojo primero contra el defecto original, es que no prueban nada.

## Definition of Done

`ruff` · `pytest` · `run.py check` (recorte **y** fuente entera) · `pnpm lint` · `pnpm typecheck` ·
`pnpm test` · **`pnpm test:e2e` entero** · CI en verde. Ledger: A-T21 H-2 y H-4 pasan a **cerrados**
con la cifra nueva. `CHANGELOG` y `ROADMAP` con `assert`.
