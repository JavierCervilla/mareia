# Motor de mareas (`@mareia/domain-core/tides`)

Predicción de marea astronómica por **suma armónica con correcciones nodales**, método de
Schureman. TypeScript puro: **cero IO, cero reloj del sistema, cero dependencias de runtime**. El
instante entra siempre como milisegundos UTC desde el epoch Unix, así que el mismo código corre
igual en Deno (API), en Node (build del sitio) y en el navegador.

```
h(t) = Z₀ + Σᵢ fᵢ(t) · Aᵢ · cos( Vᵢ(t) + uᵢ(t) − κᵢ )
```

- `Aᵢ`, `κᵢ` — amplitud (m) y retardo de fase de **Greenwich** (grados, referido a UTC) del schema
  `station/v1`.
- `Vᵢ(t)` — argumento de equilibrio, desarrollado en la base de Doodson (τ, s, h, p, N′, p₁) más el
  múltiplo de 90° del término constante.
- `fᵢ`, `uᵢ` — correcciones nodales de Schureman, **evaluadas en el instante pedido**, no una vez al
  año como en las tablas clásicas.
- `Z₀` — `datum.msl_offset_m`, la altura del nivel medio sobre el cero de la estación.

## API

| Función | Qué hace |
|---|---|
| `predictHeight(station, atUtcMs)` | Altura en metros en un instante |
| `sampleCurve(station, fromUtcMs, toUtcMs, stepMinutes)` | Curva muestreada para el gráfico |
| `findExtremes(station, fromUtcMs, toUtcMs, options?)` | Pleamares y bajamares del rango |
| `prepareStation(station)` + `heightAt` / `heightRateAt` | Camino rápido: resuelve la estación una vez y evalúa altura o derivada muchas veces |
| `isSupportedConstituent(name)` / `SUPPORTED_CONSTITUENTS` | Para que el pipeline de datos filtre antes de generar un JSON que el motor rechazaría |

Un constituyente desconocido lanza `UnsupportedConstituentError`: nunca se ignora en silencio, que
es como se cuelan errores de decímetros en una tabla de mareas.

`findExtremes` localiza los cambios de signo de la derivada muestreando cada 6 minutos y refina
cada uno por bisección hasta el segundo. La derivada es analítica (`heightRateAt`).

## Constituyentes soportados (42)

El juego que publica NOAA CO-OPS para sus estaciones —el conjunto estándar completo, 37— más los
cinco que TICON-4 publica para los puertos del catálogo y que el QC de T-05 señaló como el techo de
exactitud del dataset (marcados **†**):

- **Semidiurnos**: M2, S2, N2, K2, 2N2, MU2, NU2, LAM2, L2, T2, R2, 2SM2, EP2†, MA2†, MB2†, MKS2†
- **Diurnos**: K1, O1, P1, Q1, 2Q1, J1, M1, S1, OO1, RHO
- **Largo periodo**: SA, SSA, MM, MF, MSF
- **Armónicos y compuestos**: M3, M4, M6, M8, S4, S6, MN4, MS4, MK3, 2MK3, 2MS6†

Los alias habituales se normalizan (`lambda2`→`LAM2`, `rho1`→`RHO`, mayúsculas/minúsculas
indistintas). Las correcciones nodales se derivan de los diez fundamentales con fórmula propia en
SP-98 (Mm, Mf, O1, J1, OO1, M1, M2, K1, K2, L2); los compuestos las componen como
`f = Π f_k^|n_k|` y `u = Σ n_k·u_k`. Los constituyentes puramente solares (S2, P1, T2, R2, Sa, Ssa,
S1, S4, S6) no llevan corrección: no dependen del nodo lunar.

## Verificación

`src/tides/__tests__/` — cuatro suites, todas deterministas y sin red:

1. **Golden contra NOAA CO-OPS** (San Francisco 9414290, mixto; Boston 8443970, semidiurno): curva
   de 6 minutos de tres días y pleamares/bajamares oficiales, con las constantes armónicas
   publicadas por la propia NOAA. Tolerancias del contrato: ±15 cm y ±10 min.
2. **Oráculo cruzado `@neaps/tide-predictor`** (devDependency, MIT): implementación independiente
   del mismo método; sobre constantes idénticas el acuerdo exigido es < 1 cm.
3. **Propiedades**: alternancia estricta pleamar/bajamar, periodo de 12 h 25 min 14 s con solo M2,
   derivabilidad (derivada analítica ≡ numérica) e invariancia frente al huso de la máquina.
4. **Contrato**: constituyentes obligatorios presentes, errores de rango y de constituyente
   desconocido.

Procedencia de los fixtures, unidades, datum y husos: `__tests__/fixtures/noaa/README.md`.

## Referencias

- P. Schureman, *Manual of Harmonic Analysis and Prediction of Tides*, USC&GS Special Publication
  98 (1940, rev. 1958). Las fórmulas de f y u citan su número de ecuación.
- A. T. Doodson, *The Harmonic Development of the Tide-Generating Potential* (1921).
- M. G. G. Foreman, *Manual for Tidal Heights Analysis and Prediction*, IOS Pacific Marine Science
  Report 77-10 (1977).
- J. Meeus, *Astronomical Algorithms*, 2ª ed. (1998), para los polinomios de las longitudes medias.
