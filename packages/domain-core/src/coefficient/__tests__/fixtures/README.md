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
