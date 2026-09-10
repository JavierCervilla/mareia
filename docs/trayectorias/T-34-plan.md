# T-34 · El error medido en las listas de puertos (cierra A-T14B H-3)

**Trayectoria**: `cmtuxa3vz00a492khaca7pmo1` · hija de E-MAREIA · **Rama**: `claude/T-34-error-en-listas`

## El hallazgo, y la premisa que se cayó al medir

**A-T14B H-3**: la portada da **un solo mando** y lo llama calidad, pero ese mando es la
**procedencia** de las constantes, no el error de la predicción. Quien filtra «solo los medidos»
para quedarse con los buenos se lleva *Puerto del Rosario* —**1,3424 m** de RMSE, el peor del
catálogo— y pierde *San Sebastián de la Gomera*, con **36 mm**.

La decisión del humano fue **enseñar el `grade`**, porque el informe decía que «el `grade` sí ordena
por error». **Al ir a implementarlo, los datos dijeron otra cosa**, y se volvió a preguntar antes de
escribir nada:

| | |
|---|---|
| puertos **sin** RMSE medido | **118** de 153 — y **116 de ellos son grade C** |
| solape A/B entre los medidos | A va de 0,0372 a 0,0587; B de **0,0359** a 0,0643 |
| el mejor B contra el peor A | Es Castell **0,0359** gana a Santander **0,0587** |
| rango de C entre los medidos | de 0,0426 a **1,3424** |

> **Corregido al implementar (10-sep)**: la tabla decía «119 de 154». El catálogo tiene **153**
> puertos y **35** medidos, o sea **118** sin medir. El error venía de un recuento anterior y no
> mueve nada del argumento —116 de 118 siguen siendo C, el 98 %—, pero un número mal contado en el
> documento que justifica una decisión es exactamente lo que no se deja pasar aquí.

O sea: el `grade` dice sobre todo «no hay medida» (116 casos), y donde la hay **no ordena**. Pintarlo
habría puesto una C a 116 puertos cuyo único pecado es no tener mareógrafo cerca, y habría dejado el
22 % abierto igual. **Decisión revisada: se publica el error medido**, que es lo único que ordena.

## Tres asunciones y dos tradeoffs

**Asunciones**
1. **`rmse_m` ya viaja** en `PortSummaryDto.quality`, así que no hay cambio de datos ni de API: la
   portada ya tiene el número y sólo no lo pinta. Esto es render, no tubería.
2. **La palabra `estimada` se queda tal cual.** Contesta otra pregunta —¿son de aquí las
   constantes?— y es cierta puerto a puerto. El error **se suma**, no la sustituye.
3. **Centímetros y no metros.** `0,0359 m` obliga a contar ceros en una lista de 153 filas; `±4 cm`
   se compara de un vistazo, que es lo que se hace en un índice.

**Tradeoffs**
1. **Una cifra más por fila.** Se paga: es exactamente la que faltaba para poder elegir.
2. **Sólo la publican 35 de 153.** La asimetría es honrada —los otros 118 no tienen medida— pero hay
   que evitar que su ausencia se lea como «cero error». Por eso el que no tiene medida **no dice
   nada** en vez de decir «— cm», y la palabra `estimada` sigue explicando por qué.

## Entregables

1. `Entrada` del índice acepta el error, y las **tres** listas lo pasan (portada, región, provincia)
   — H-1 de T-14B ya obligó a que la señal bajara a las tres; ésta baja con ella o nace coja.
2. Redondeo y formato en **una** función, con su test: `0,0359 m → ±4 cm`, `1,3424 m → ±134 cm`.
3. Gate sobre el `dist/`: **todo** puerto con `rmse_m` publica su cifra en las tres listas, y
   **ninguno** sin medida publica una. Contado contra el dataset, no contra un número escrito.

## Definition of Done

`pnpm lint` · `typecheck` · `pnpm test` · **`test:e2e` entero** · CI verde · pase adversario (toca
UI) · `CHANGELOG`/`ROADMAP` · ledger: A-T14B H-3 cerrado **con la corrección de su premisa escrita**.
