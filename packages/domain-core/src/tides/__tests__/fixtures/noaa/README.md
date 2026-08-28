# Oráculo externo — NOAA CO-OPS

Ficheros **verbatim** tal y como los devolvió la API pública de NOAA CO-OPS el **2026-08-28**. No
se ha tocado ni una cifra: toda la adaptación (pies → metros, parseo de fechas, elección del
datum) vive en `../../fixtures.ts`, a la vista y auditable. Los tests **no salen a la red**: la
predicción tiene que ser determinista y reproducible en CI.

## Estaciones

| Estación | Nombre | Régimen | Por qué está |
|---|---|---|---|
| `9414290` | San Francisco, CA | Mixto (dominante semidiurno con fuerte desigualdad diurna) | Caso duro: K1 + O1 comparables a M2, las dos pleamares del día son muy distintas |
| `8443970` | Boston, MA | Semidiurno, carrera ~3 m | Caso limpio de M2 dominante y amplitud grande, donde un error relativo pequeño se ve en centímetros |

## Procedencia exacta

Constantes armónicas (37 constituyentes por estación):

```
https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/<ID>/harcon.json
```

Predicciones oficiales del 15 al 17 de marzo de 2026 (pleamares/bajamares y serie de 6 minutos):

```
https://api.tidesandcurrents.noaa.gov/api/prod/datagetter
  ?application=mareia-golden
  &station=<ID>
  &product=predictions
  &datum=MSL
  &time_zone=gmt
  &units=metric
  &format=json
  &begin_date=20260315&end_date=20260317
  [&interval=hilo]      # solo en el fichero predictions-hilo-*
```

## Unidades, datum y husos — las trampas

- **`harcon.json` viene en PIES** (`"units": "feet"`). El test convierte con el pie internacional
  exacto, 1 ft = 0,3048 m. La conversión es solo de la amplitud: la fase es adimensional.
- **Se usa `phase_GMT`, no `phase_local`.** `phase_GMT` es el retardo de fase de Greenwich κ, que
  es exactamente lo que consume `h(t) = Σ f·A·cos(V + u − κ)` con V evaluado en UTC. `phase_local`
  está referida al meridiano del huso de la estación y daría un desfase de horas.
- **Las predicciones se piden con `datum=MSL`**, el mismo nivel al que están referidas las
  constantes armónicas de `harcon.json`. Así el offset de datum del schema `station/v1` es 0 y la
  comparación es directa, sin sumar ni restar referencias verticales. Pedirlas en MLLW (el
  predeterminado de la API para estas estaciones) obligaría a sumar el datum publicado en
  `datums.json`, un grado de libertad extra que no aporta nada al test del motor.
- **Las predicciones se piden con `time_zone=gmt`**, así que el campo `t` (`"YYYY-MM-DD HH:mm"`,
  sin sufijo de zona) es UTC. El helper lo parsea añadiendo la `Z` explícitamente: dejar que
  `Date` lo interprete usaría el huso de la máquina y CI fallaría según dónde corriese.
- Los instantes de `interval=hilo` **están redondeados al minuto** por NOAA, lo que ya consume
  parte del presupuesto de la tolerancia de ±10 min.

## Alcance como oráculo

NOAA predice con el mismo método que este motor (Schureman, correcciones nodales evaluadas en el
instante), de modo que el acuerdo esperado es de pocos centímetros. Lo que el test verifica no es
la física del océano sino que **nuestra implementación de la suma armónica coincide con una
implementación oficial e independiente** partiendo de las mismas constantes.
