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

## Aviso para T-13 (regeneración del dataset)

El fichero de Brest de hoy está truncado al catálogo **anterior** a T-04, así que le faltan los
cinco constituyentes que esta trayectoria añadió al motor: **6,75 cm** de amplitud en total
(EP2 1,97 · 2MS6 1,68 · MB2 1,24 · MA2 1,10 · MKS2 0,76 cm), de los cuales **5,07 cm son de especie
2** y entran por tanto en el cálculo del coeficiente.

Simulado sobre estos mismos 32 valores —añadiendo a Brest los cuatro semidiurnos descartados—, los
coeficientes se mueven **hasta 2 unidades** y **tres se irían a 3 unidades de error** (12-mar #1,
20-mar #1 y #2): fuera de la tolerancia de ±2. Cuando T-13 regenere el dataset, este golden puede
ponerse en rojo, y será un rojo **honesto**: toca volver a medir el sesgo con las constantes nuevas
y decidir entonces —con el dato delante— si lo que cambia es la tolerancia o el conjunto que entra
en el coeficiente (MA2 y MB2 son modulación radiacional de M2, no marea astronómica pura). Lo que
no vale es apagar el test.
