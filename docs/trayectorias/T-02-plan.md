# T-02 — domain-tides-engine

**Objetivo**: motor de predicción de mareas propio en `packages/domain-core/src/tides/` — TypeScript
puro, cero IO, cero dependencias de runtime.

## Entregables

1. **Suma armónica con correcciones nodales** (método Foreman 1977 / Schureman): dado un juego de
   constituyentes `{name, amplitude_m, phase_deg}` (schema `station/v1`) y un instante UTC, devuelve la
   altura. Incluye argumentos astronómicos (s, h, p, N, p') y factores nodales (f, u) por constituyente.
2. **Buscador de extremos**: pleamares/bajamares de un rango de fechas (hora + altura), y curva
   muestreada (paso configurable) para el gráfico.
3. **Golden tests**: contra el motor `neaps` (devDependency, oráculo — nunca dependencia de producción)
   sobre el mismo JSON de constituyentes, y contra valores publicados de una estación NOAA (armónicos
   públicos + predicciones oficiales de días concretos). Tolerancias: eventos ±10 min / ±15 cm.
4. **Tests de propiedades**: alternancia pleamar/bajamar, periodicidad ~12h25m en régimen semidiurno,
   continuidad de la curva, invariancia frente a timezone de presentación (el dominio trabaja en UTC).

## No-objetivos
Coeficiente (T-04), datums/conversiones de referencia más allá del offset del JSON, pipeline de datos
(T-05), API HTTP (T-07).

## DoD extra (doctrina T-161)
El PR marca su checkbox en `ROADMAP.md` y añade su entrada a `CHANGELOG.md`.
