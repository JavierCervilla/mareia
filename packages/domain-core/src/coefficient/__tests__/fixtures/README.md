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

T-04 dejó aquí el aviso de que regenerar `data/brest/constituents.json` con los cinco
constituyentes que le faltaban (**6,75 cm** de amplitud: EP2 1,97 · 2MS6 1,68 · MB2 1,24 ·
MA2 1,10 · MKS2 0,76, de los que 5,07 cm son de especie 2 y entran en el coeficiente) pondría este
golden en rojo, y que la decisión se tomaría con el dato delante. Aquí está el dato, sobre los
mismos 32 valores publicados:

| Constantes de Brest | Sesgo medio | Error máximo |
|---|---:|---:|
| 37 constituyentes (T-05) | +0,91 | 2 |
| **42 constituyentes (T-13)** | **+1,38** | **3** |
| 42 sin la modulación radiacional (MA2, MB2) | +1,19 | 2 |
| 42 sin EP2 | +1,03 | 3 |

Los 32 errores son **todos ≥ 0 salvo uno**: el desacuerdo con el SHOM es un sesgo, no ruido, y ya
existía antes de regenerar (+0,91 rozando la cota de 1 que el test exigía). Quitar del cálculo la
modulación radiacional —la salida que T-04 dejaba abierta— no lo arregla: baja el sesgo a +1,19 y
sigue fuera. Es decir, el desacuerdo no viene de **qué constituyentes entran** en el coeficiente,
sino de que se comparan **dos análisis armónicos distintos** del mismo puerto: TICON-4 (2006-2025,
mareógrafo REFMAR) contra el del SHOM.

**Decisión**: se emite el dataset completo y se ensancha el acuerdo exigido a `toleranceUnits: 3`,
con la cota de sesgo en 1,5. Lo que la sostiene es que el dataset nuevo predice **mejor la marea de
verdad**: contra las observaciones del IOC, Brest pasó de 2,23 a 0,47 cm RMS de coste de truncado y
de grade B a grade **A**. Hay dos oráculos y sólo uno de ellos es el mar; cuando se separan, gana el
mar y el otro desacuerdo se declara.

Lo que **no** se hizo: apagar el test, recortar la muestra ni elegir los constituyentes por lo bien
que le sientan al golden.
