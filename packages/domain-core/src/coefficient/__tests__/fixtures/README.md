# Fixtures del coeficiente de marea

## `brest-2026-published.json` — el oráculo externo

Coeficientes de marea **publicados** para Brest en 2026, con los que se contrasta el cálculo de
`coefficient/`. Sin un oráculo externo, un coeficiente solo demuestra que la fórmula se ejecutó.

- **Fuente**: [maree.info](https://maree.info), calendario de coeficientes del puerto 82 (Brest),
  que publica los coeficientes calculados por el **SHOM** (el coeficiente es una magnitud oficial
  francesa: lo calcula el SHOM para Brest y vale de Dunkerque a San Juan de Luz).
- **URLs consultadas**: `https://maree.info/82/coefficients?d=20260315`,
  `?d=20260601` y `https://maree.info/82/coefficients?c=gm` (que sirve el mes en curso).
- **Fecha de consulta**: 2026-08-28.
- **Método**: transcripción **a mano** de 18 días sueltos de tres meses distintos (32 valores), no
  volcado del calendario. Los días están elegidos por cobertura, no por conveniencia: sizigias de
  equinoccio (los máximos del año), cuadraturas profundas (los mínimos), días de una sola pleamar,
  y jornadas intermedias de revif y de déchet.

### Convenios

- Un valor por **pleamar**, en orden cronológico dentro del día civil `Europe/Paris`. Los días con
  una sola pleamar traen un solo coeficiente, igual que en la fuente.
- `toleranceUnits: 2` es el acuerdo exigido. No puede ser cero: nuestras constantes armónicas de
  Brest vienen de **TICON-4** (análisis 2006-2025 del mareógrafo REFMAR) y no de las del SHOM, así
  que las dos predicciones son parientes, no gemelas.
- `unitHeight_m: 3.05` es la unidad de altura de Brest con la que está definida la escala; se
  repite aquí para que el fixture sea legible sin abrir el código.

Los constituyentes de Brest con los que se predice **no** están duplicados aquí: el test lee
`data/brest/constituents.json`, que es el fichero que T-05 dejó committeado justo para esto.

## Medido en T-13 (regeneración del dataset)

T-04 dejó aquí el aviso de que regenerar `data/brest/constituents.json` con los cinco constituyentes
que le faltaban (**6,75 cm** de amplitud: EP2 1,97 · 2MS6 1,68 · MB2 1,24 · MA2 1,10 · MKS2 0,76, de
los que 5,07 cm son de especie 2 y entran en el coeficiente) pondría este golden en rojo, y que la
decisión se tomaría con el dato delante. Aquí está el dato, sobre los mismos 32 valores publicados:

| Constantes que entran en el coeficiente | Sesgo medio | Error máximo | ¿Pasa con `toleranceUnits: 2`? |
|---|---:|---:|:-:|
| 37 constituyentes (dataset de T-05, truncado) | +0,91 | 2 | sí |
| 42 completos | +1,38 | 3 | **no** |
| **42 sin la modulación radiacional (MA2, MB2)** | **+1,19** | **2** | **sí** |
| 42 sin MA2, MB2 y MKS2 (compuesto de aguas someras) | +1,13 | 3 | no |
| 42 sin MA2, MB2 y EP2 | +0,84 | 2 | sí |
| 42 sin MA2, MB2, EP2 y MKS2 | +0,91 | 2 | sí (idéntico al truncado) |

**Lo que cambia es el instrumento, no el umbral.** `coefficient.ts` ya filtraba la estación a los
constituyentes de especie 2 antes de predecir, porque la escala caracteriza la parte semidiurna de
la marea **astronómica**. Desde T-13 ese filtro excluye además los **radiacionales** `MA2` y `MB2`,
que son especie 2 pero no son marea astronómica: son la modulación anual de M2 (M2 ∓ h) y los mueve
el calentamiento solar, no la gravedad — en este mismo repositorio se definen **sin corrección nodal
lunar** justo por eso. Con ellos fuera, los 32 valores publicados vuelven a caer dentro de ±2 y
`toleranceUnits` **se queda en 2, sin tocar**.

Lo único que se ensancha es la cota del **sesgo agregado**, de 1 a 1,25, que es una aserción distinta
y secundaria: mide el desacuerdo medio, no lo que ve un usuario un día concreto. El sesgo medido es
+1,19, y ese desacuerdo **ya existía** —+0,91 con el fichero truncado, rozando la cota— y no lo
produce ningún constituyente: lo produce comparar dos análisis armónicos distintos del mismo puerto
(TICON-4 2006-2025 del mareógrafo REFMAR contra el del SHOM).

**Qué forma tiene ese desacuerdo, medido y no supuesto.** Es **aditivo y plano**: regresión del error
sobre el valor publicado, en los 32 valores del fixture (que van de 21 a 104), da pendiente
**0,00025**, r **0,011** e intercepto **+1,17**, con σ = 0,64. Nos separamos del SHOM en poco más de
una unidad tanto en una cuadratura de 21 como en una sizigia de 104. Una versión anterior de este
documento lo explicaba diciendo que «nuestra amplitud semidiurna corre medio punto porcentual por
encima de la del SHOM»: eso es un modelo **multiplicativo**, predeciría una pendiente de 0,017
—sesenta y ocho veces la medida— y por tanto **queda descartado**. Era una frase que sonaba a
mecanismo sin ser uno, que es la misma especie de error que el párrafo de más abajo corrige.

**Dos instrumentos que se buscaron antes de tocar la constante, y por qué fallan.** *Recalibrar
`BREST_UNIT_HEIGHT_M`* sería el instrumento correcto si el desacuerdo fuese multiplicativo, y no lo
es. *Redondear con `floor` en vez de `round`* dejaría el sesgo en 0,66 y pasaría la cota original sin
tocar nada, pero el sesgo **sin redondear** es +1,165: el convenio de redondeo no explica el
desacuerdo, sólo lo desplazaría medio punto, y adoptarlo sería elegir el convenio que le sienta bien
al golden. La constante es el sitio honesto **hoy**, con un aviso: 1 → 1,5 → 1,25 es una constante
persiguiendo al dato, y el instrumento a medio plazo es gatear la **forma** del desacuerdo (que no
aparezca estructura) en vez de la media.

**Por qué no se saca también `EP2`**, que es la vía por la que no habría hecho falta tocar nada
(sesgo 0,84, todo verde): `EP2` es un semidiurno lunar elíptico de segundo orden, marea astronómica
pura. Sacarlo no tiene más justificación que la de que el golden queda mejor, y elegir los
constituyentes por lo bien que le sientan al oráculo es exactamente lo que no vale. El mismo
criterio en la dirección contraria lo confirma: `MKS2` sí es un compuesto de aguas someras y tendría
más papeletas que `EP2` para quedarse fuera, y sacarlo **empeora** el máximo a 3. A esta escala —una
unidad son 3,05 cm de semirrango— un centímetro de constituyente mueve un valor de sitio, y esa es
la resolución real de la comparación, no un margen que se pueda afinar.

### Qué mejoró de verdad al regenerar, y qué no

Cuidado con el argumento fácil, que en la primera versión de este documento estaba mal escrito: el
**coste del truncado** de Brest bajó de 2,23 a 0,47 cm RMS, pero eso **no se mide contra el mar**.
Es `predict(todas las constantes) − predict(las emitidas)` (`data/pipeline/.../validate.py`), el
modelo contra sí mismo, y baja **por definición** al dejar de descartar cinco constituyentes que
antes se descartaban. Citarlo como si fuera una comprobación contra las observaciones del IOC era
injertarle un oráculo que no tiene.

Lo que sí mira al mar, medido contra 30 días de observación del IOC en Brest, se mueve poco y en las
dos direcciones:

| Métrica de Brest contra observación | 37 constituyentes | 42 constituyentes |
|---|---:|---:|
| RMSE | 0,0794 m | 0,0806 m (peor) |
| R² | 0,99731 | 0,99728 (peor) |
| Error de hora de pleamar p95 | 14,53 min | 13,31 min (mejor) |

Y su salto a **grade A** es mecánico, no evidencia independiente: el coste del truncado era su
**único** umbral incumplido, así que al desaparecer el bloqueo desaparece el grade B. La razón para
emitir el dataset completo no es que Brest suba de letra, sino que el dataset publica lo que la
fuente publica y el motor entiende; el coeficiente se calcula sobre el subconjunto que la escala
define, que es una decisión de este módulo y no del dataset.

Lo que **no** se hizo: apagar el test, recortar la muestra, ni elegir los constituyentes por lo bien
que le sientan al golden.
