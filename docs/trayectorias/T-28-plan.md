# T-28 · La letra pequeña y el contraste

**Trayectoria**: `cmtima7o90007mruys8k7e3et` · hija de E-MAREIA · **Rama**: `claude/T-28-letra-contraste`
**Origen**: H-8 y el gate G4 de `docs/qa/ux/auditoria-movil-2026-08-31.md`, lo último que quedaba de
aquella auditoría. Con esto se cierra entera.

## Lo medido (no lo supuesto)

Contra el `dist/` de `915317d`, con las tipografías del sitio, en tres páginas × dos anchos:

| | 360 px | 1280 px |
|---|---|---|
| portada | **11 px: 12** · 12 px: 312 · 15 px: 157 | 12 px: 12 · 13 px: 312 · 16 px: 157 |
| catálogo de especies | **11 px: 5** · 12 px: 571 · 15 px: 274 | 12 px: 5 · 13 px: 571 · 16 px: 360 |
| página de puerto | **11 px: 33** · 12 px: 254 · 15 px: 205 | 12 px: 33 · 13 px: 166 · 16 px: 205 |

Contraste: **487/487, 943/943 y 512/512 elementos medidos**, mínimo **5,42:1**, **0 por debajo de AA**.

### H-8, corregido por la medición

La hipótesis era «el token del rótulo es más pequeño justo donde peor se lee». Es cierta **y se queda
corta**: en móvil **todo** el escalón tipográfico baja un peldaño (12→13, 15→16, 46→64). Pero bajo el
umbral de la auditoría —12 px— los únicos que **incumplen** son los **50 elementos a 11 px**, y son
exactamente `--m-text-eyebrow`. El resto está **en** el umbral, no por debajo.

**Así que se sube ese token y nada más.** Bajar de 12 px es un defecto; que el escalón entero sea un
punto menor en móvil es una decisión del brief, y reescribir un sistema tipográfico entero apoyándose
en un umbral que no incumple sería cambiar el diseño de alguien por gusto propio.

## Entregables

1. **`--m-text-eyebrow` a 12 px de base.** El salto a 12 px en escritorio se queda sin efecto y se
   retira: un token que declara un valor que ya tiene es ruido que hace dudar de si hace algo.
   **Radio de acción medido antes y después**, y las palabras partidas tienen que seguir en **0**:
   subir un rótulo con `letter-spacing` ensancha su caja, y la cabecera más ajustada del sitio vive en
   una tabla.
2. **G4 · contraste AA**, naciendo en verde (5,42 contra el umbral 4,5), **con dos canarios**.

## Los dos canarios de G4, y por qué son dos

Este gate tiene **dos** maneras de mentir, y **las dos se reprodujeron a mano** antes de escribirlo:

- **No ver nada.** El primer intento parseó `rgb(...)` del `color` computado. Este Chromium lo
  serializa como `oklch(...)`, así que el patrón no casó **ni una vez**: `0 muestras de 487`, y el
  informe habría dicho «ningún problema de contraste». Le pasó igual a la auditoría, con el mismo
  número.
- **Verlo todo.** El segundo intento resolvió el color con el motor del navegador (canvas) pero **sin
  limpiar el lienzo**: un fondo transparente devolvía el **último color pintado** —el del texto— y los
  951 elementos daban ratio **1,00**. Un gate que denuncia todo es tan inútil como uno que no denuncia
  nada, y además entrena a ignorarlo.

De ahí que el gate lleve **los dos**:

1. **Canario de sensibilidad**: un par de colores que sabemos que falla (dos `oklch()` casi iguales,
   1,18:1) **tiene que salir** por debajo del umbral. Si no sale, el gate no está midiendo.
2. **Canario de cobertura**: el número de muestras **tiene que ser igual** al de elementos con texto.
   Si son cero —o si son menos—, el color no se está resolviendo y el verde no significa nada.

Un umbral sin estas dos comprobaciones es exactamente el gate que ya mintió dos veces aquí.

## Lo que NO entra

- **No se toca el escalón tipográfico** más allá del rótulo (ver arriba).
- **No entra G5** (objetivo táctil): tras T-26 quedan 14 objetivos bajo 44 px en la portada, así que
  nacería en rojo, y un gate que nace en rojo se ignora.
- No se toca la paleta.

## Definition of Done

`pnpm lint` · `pnpm --filter web build` · `pnpm typecheck` · **`pnpm test` en la raíz** ·
**`pnpm test:e2e` entero**. Medición antes/después de tamaños, contraste y palabras partidas contra el
espejo con las tipografías del sitio. Informe adversario. `ROADMAP.md` y `CHANGELOG.md` en el mismo PR,
**comprobados con `assert`, no anunciados**.
