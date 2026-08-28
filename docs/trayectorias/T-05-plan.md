# T-05 — pipeline-stations-pilot

**Objetivo**: pipeline Python offline en `data/pipeline/` que produce el JSON canónico de
constituyentes (`data/stations/<id>.json`, schema `station/v1`) para 10 puertos piloto españoles,
con validación y grade de calidad.

## Puertos piloto
Vigo, A Coruña, Santander, Bilbao, Cádiz, Huelva, Málaga, Palma, Las Palmas, Tenerife.

## Entregables

1. **Fuentes**: descarga/parseo de **TICON-4** (constituyentes por mareógrafo, CC-BY 4.0, SEANOE) y,
   si es viable, constantes armónicas **REDMAR** (informes de Puertos del Estado). FES2022 queda fuera
   del piloto (requiere credenciales AVISO → acción humana registrada aparte).
2. **Reconcile**: prioridad REDMAR > TICON-4; emite el JSON `station/v1` con `source`, `datum` y
   `constituents`, más `data/brest/constituents.json` (para el coeficiente, T-04).
3. **Validate**: contraste de la predicción (suma armónica en Python, p. ej. `utide`/implementación
   propia) contra observaciones u otras referencias accesibles (Portus/IOC si la red lo permite);
   métricas RMSE + error de hora/altura de extremos; **grade A/B/C** por puerto; informe QC en
   markdown commiteado. Regla del framework: grade "terminado" solo por exactitud (umbral), nunca
   por redondeo.
4. **Reproducibilidad**: `README` del pipeline con pasos exactos; requirements pinneados; los JSON
   generados se commitean (dataset CC-BY 4.0 con atribuciones en el propio fichero).

## No-objetivos
Motor TS (T-02), toda España (T-13), FES2022 (bloqueado por credenciales).

## DoD extra (doctrina T-161)
El PR marca su checkbox en `ROADMAP.md` y añade su entrada a `CHANGELOG.md`.
