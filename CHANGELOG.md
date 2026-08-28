# Changelog — Mareia

Formato *Keep a Changelog* relajado; lo más reciente arriba.

## 2026-08-28 — T-04 · coeficiente de mareas y dos mejoras del motor

- **Coeficiente de marea** (escala francesa 20-120) en `@mareia/domain-core/coefficient`: un valor
  por pleamar y el reparto mañana/tarde del día civil, calculados con predicción propia de Brest y
  la unidad de altura `U = 3,05 m`. Los constituyentes entran por parámetro; el dominio sigue sin
  tocar disco. Contrastado contra **32 coeficientes publicados de 2026**: error máximo de **2
  unidades** y sesgo de +0,9.
- Se calcula sobre la **onda semidiurna** de Brest, no sobre la predicción completa: los valores
  publicados de un mismo día son casi iguales entre sí y la marea real tiene desigualdad diurna.
  Con la marea completa el error subiría a 5 unidades. Va documentado y con su test.
- **Cinco constituyentes nuevos en el motor** —EP2, MA2, MB2, MKS2 y 2MS6—, los que el QC de T-05
  señaló como techo del dataset (2,2 cm RMS de truncado en Brest, y el grado A fuera de alcance para
  Vigo y Santander). El catálogo del motor y el del pipeline vuelven a ser el mismo contrato en dos
  idiomas. **El dataset se regenera en T-13**: hasta entonces sigue truncado a los 37 anteriores.
- **`f(M3)` pasa a la forma publicada de Schureman** (SP-98) en vez de derivarse como `f(M2)^1,5`.
  Medido: las dos formas son la misma expresión (4·10⁻¹⁶ de diferencia), y lo único que separa a
  este motor del pipeline es el redondeo del 0,8758 impreso — 0,022 %, no el 1 % que se sospechaba.
- Los golden tests contra NOAA CO-OPS no se mueven un dígito con ninguno de los dos cambios.

## 2026-08-28 — T-05 · Cabo de Palos y La Manga, y arreglo de la detección de extremos

- **Dos puertos nuevos** en el piloto: **Cabo de Palos** y **La Manga** (lado mediterráneo, no la
  laguna del Mar Menor, que no tiene marea astronómica utilizable). Ambos dependen del mareógrafo de
  Cartagena, a 25 y 27 km, y están en zona micromareal (rango 0,23 m): salen **grade C**, con el
  aviso correspondiente en el informe QC.
- **La distancia al mareógrafo pasa a ser un umbral del grade** (A ≤ 5 km, B ≤ 30 km): un puerto que
  toma prestadas las constantes de otro sitio ya no puede heredar el grade de quien se las presta.
- **Corregida la detección de extremos**, que comparaba puntos vecinos y tomaba por pleamar
  cualquier rizo del registro: en un mareógrafo que muestrea cada 6 s daba decenas de miles de
  extremos donde había cuarenta, y con ellos el error de hora salía excelente y falso. Ahora se
  exige prominencia y se fuerza la alternancia pleamar/bajamar. Consecuencia: varias p95 empeoran
  respecto a la medición anterior porque aquélla estaba inflada, y **Huelva baja de A a B**
  (17,9 → 22,9 min). El reparto final es 4 A, 5 B, 4 C.
- Donde la observación no tiene pleamares identificables, el error de hora **ya no se publica** en
  lugar de publicarse un número sin significado.
- El agregador se cita por su nombre real, `openwatersio/tide-database`, en las atribuciones.

## 2026-08-28 — T-05 · dataset de los 10 puertos piloto

- **Dataset `station/v1`** en `data/stations/` para Vigo, A Coruña, Santander, Bilbao, Cádiz,
  Huelva, Málaga, Palma, Las Palmas y Santa Cruz de Tenerife, más `data/brest/constituents.json`
  como referencia del coeficiente de mareas. Con su JSON Schema y sus atribuciones dentro de cada
  fichero. Grades: 5 A, 4 B, 2 C.
- **Pipeline Python** en `data/pipeline/` (`make all`): descarga con caché, política de
  reconciliación de mareógrafo, validación contra 30 días de observaciones del IOC e informe QC
  commiteado. Requirements pinneados; fuente de constantes fijada a un commit.
- **Motor de predicción armónica de referencia** en Python (Doodson + Schureman), verificado contra
  la tabla publicada de velocidades y contra `@neaps/tide-predictor`.
- El dataset se **trunca a los 37 constituyentes** que soporta el motor de `domain-core`; lo
  descartado queda registrado en cada JSON y su coste medido influye en el grade.
- **Aviso de licencia**: el dataset no es CC-BY 4.0 uniforme. Dos puertos (Bilbao y Huelva) sólo
  tienen mareógrafo disponible bajo **CC-BY-NC 4.0**; está declarado estación por estación.
- CI: nuevo job `data-pipeline` con el camino offline (tests + validación contra el schema).

## 2026-08-28 — astronomía y periodos solunares (T-03)

- `astronomy/` en `@mareia/domain-core`: ortos y ocasos de Sol y Luna con acimut, crepúsculos civil,
  náutico y astronómico, fase lunar (edad real desde la nueva anterior, iluminación y próximos
  cuartos), tránsito superior e inferior y distancia lunar. Los casos polares no devuelven `null`:
  `SkySearch` es una unión discriminada que distingue el sol de medianoche de la noche polar.
- **Primera y única dependencia de runtime del dominio**: `astronomy-engine` (MIT, pinneada, sin
  dependencias transitivas), importada por un solo fichero y escondida tras la interfaz
  `AstronomyGateway`. Es la excepción del Design Doc bajo «matemática vendorizada»: una efeméride
  reimplementada a mano no falla ruidosamente, devuelve una hora plausible y falsa.
- Golden tests contra efemérides publicadas del **USNO** (8 fechas de 2026 × Madrid y Las Palmas,
  descargadas con su script y commiteadas con las URLs exactas): error máximo 0,49 min en ortos,
  ocasos, tránsitos y crepúsculo civil —frente a tolerancias de ±2 y ±3 min— y 1,33 min en los 50
  cuartos lunares del año, frente a ±1 h. El USNO tabula al minuto: ≤0,5 min es acuerdo exacto.
- `solunar/`: periodos mayores (2 h centradas en cada tránsito lunar) y menores (1 h 30 min en el
  orto y el ocaso de la Luna) del día civil de una zona IANA, con rating de actividad 0-100 y
  etiqueta. El cálculo es en UTC de punta a punta; la zona solo decide qué periodos caen en el día,
  y eso está verificado comparando Madrid, UTC y Auckland.
- El rating se documenta como la convención que es, con su desglose auditable: 100 y 0 solo se
  alcanzan por exactitud de la fórmula (nunca por redondeo) y los umbrales de etiqueta son los
  cuartos iguales del rango alcanzable, no números inventados.

## 2026-08-28 — motor de predicción de mareas propio (T-02)

- Motor de predicción de mareas propio en `@mareia/domain-core`: suma armónica con correcciones
  nodales por el método de Schureman (SP-98), 37 constituyentes, buscador de pleamares y bajamares y
  curva muestreada. TypeScript puro —sin IO, sin reloj del sistema, sin dependencias de runtime—
  para correr igual en la API (Deno), en el build del sitio (Node) y en el navegador.
- Golden tests contra las predicciones **oficiales** de NOAA CO-OPS en dos regímenes de marea
  (San Francisco, mixto; Boston, semidiurno): error máximo 2,9 cm en la curva y 2,9 min / 1,7 cm en
  los extremos, frente a un contrato de ±15 cm y ±10 min. Oráculo cruzado adicional contra el motor
  independiente `@neaps/tide-predictor`, con acuerdo por debajo de 0,4 mm.
- Los packages ya se testean en CI con el runner nativo de Node 22 (`pnpm test`), sin framework de
  test ni dependencias añadidas.

## 2026-08-28 — contrato de módulos enchufables (T-06)

- `@mareia/module-contract`: el contrato `AppModule` (con `PageSection`, `Attribution`, `CorePorts`,
  `PrecachePolicy`, `Health`) que hace enchufables pesca, meteo y navegación. Sin dependencias: el
  router es un parámetro de tipo que estrecha cada adaptador, y las atribuciones son una tupla no
  vacía, así que un módulo sin fuentes declaradas no compila.
- Registries: `apps/api/src/modules.config.ts` y `apps/web/src/modules.config.ts`. Dar de alta o de
  baja un módulo es editar ese array y nada más.
- API: nuevo `GET /v1/modules`, que lista los módulos activos con su versión y sus atribuciones; cada
  módulo se monta bajo `/v1/modules/<id>`. `/health` no cambia.
- Test de capas en CI: el dominio (`domain-core`, `usecases`) no puede importar módulos ni el
  contrato, y el contrato no puede importar de `apps/*`.

## 2026-08-28 — nace el proyecto

- Monorepo inicial: web Astro (SSG), API Deno + Express con `/health`, y el esqueleto de packages de
  la clean architecture (dominio, casos de uso, contrato de módulos, adapters, módulos pesca/meteo).
- Gates de calidad y seguridad del enjambre instalados en CI: linter anti-slop, escáner de secretos,
  SAST, auditoría de dependencias y checks de presencia de QA.
- Licencia AGPL-3.0, README con principios (OpenSource, no comercial, transparencia) y atribuciones
  de las fuentes de datos.
