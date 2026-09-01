# T-27 · El catálogo de especies en un móvil: fichas apiladas, y un solo DOM

**Trayectoria**: `cmthy093i00ctbo7y8zyma47h` · hija de E-MAREIA · **Rama**: `claude/T-27-fichas`
**Origen**: H-4 de `docs/qa/ux/auditoria-movil-2026-08-31.md`, lo único de aquella auditoría que T-26
dejó fuera a propósito por ser rediseño y no arreglo.

## El estado de hoy, medido (no heredado del informe)

Con T-26 ya dentro, `/pesca/especies/` en un teléfono:

| | 360 px | 390 px |
|---|---|---|
| alto de la página | **37.373 px** = **46,7 pantallas** | 33.575 px = 42 pantallas |
| alto de fila (media / máxima) | **394** / 955 px | 352 / 864 px |
| anchos de columna | 107 · 116 · 104 px | 114 · 130 · 107 px |

T-26 ya bajó esto de 70,8 pantallas y quitó las 376 palabras partidas, así que **el texto es legible**.
El problema que queda es otro y no lo arregla ninguna regla de ruptura: **se lee en tres canales
paralelos de ~14 caracteres**. Una columna de 14 caracteres no es una columna estrecha: es una lista
vertical de palabras sueltas, y cada especie ocupa media pantalla para decir tres cosas.

## La decisión que define la trayectoria: **CSS, y un solo DOM**

Hay dos maneras de apilar una tabla en un móvil:

1. **Duplicar el marcado** — un `<table>` para escritorio y una `<ul>` de fichas para móvil, una
   oculta según el ancho.
2. **Cambiar la presentación** — el mismo marcado, y bajo cierto ancho los `tr`/`td` se pintan como
   bloques.

**Se hace la 2, y la 1 está prohibida en esta trayectoria.** No es preferencia estética:

- Los gates de este portal **leen el `dist/`**: E1 (el nombre de la norma literal en las 86 filas),
  E3, E5 (las 117 tallas campo a campo), E6 (los taxones re-derivados), F1… Con **dos** marcados, o
  bien miden uno y dejan el otro sin vigilar, o hay que duplicarlos — y **dos superficies del mismo
  dato se desincronizan**. Eso ya pasó en T-20: el plan predijo la desincronización y tres párrafos
  después especificó la segunda superficie que la causó.
- Con **un** DOM, el texto publicado es el mismo a 360 px y a 1280 px, así que **todos los gates
  actuales siguen alcanzando** sin tocarlos, y el gate nuevo sólo tiene que vigilar lo que la
  presentación puede romper: que nada quede escondido.

## Lo que hay que cuidar (y por qué se escribe antes de tocar)

**La accesibilidad se rompe sola con este cambio.** Poner `display: block` en `table`/`tr`/`td` hace
que el navegador **retire los roles implícitos de tabla**: quien navegue con lector de pantalla deja de
tener filas y celdas, y de oír la cabecera de la columna junto al dato. La cura estándar es declarar
los roles explícitos (`role="table"`, `role="row"`, `role="cell"`, `role="rowheader"`), y va **en el
mismo commit** que el `display: block`, no después.

**El rótulo de cada dato tiene que viajar con el dato.** En la tabla, «25 cm» se entiende porque está
bajo la cabecera de su columna. Apilado, esa cabecera ya no está encima: si el bloque no dice de qué
habla, el número queda huérfano. Es la misma familia que la nota legal de T-19 y el hueco mudo de
T-21: **un dato sin su rótulo es un dato que no se puede leer**.

## Entregables

1. **Fichas apiladas por debajo de ~700 px**, sólo con CSS, un DOM. Cada especie es un bloque con el
   nombre de la norma como titular y los tres campos rotulados debajo.
2. **Roles ARIA explícitos** en el mismo commit, y comprobados en el `dist/`.
3. **Gate G6 · nada se esconde al apilar**: para las 86 especies, el texto visible a 360 px es
   **exactamente el mismo** que a 1280 px. Es el gate que impide que «apilar» se convierta en
   «recortar»: un `display: none` de conveniencia para que la ficha quepa sería invisible para todos
   los gates actuales, que leen el HTML y no lo que se pinta.
4. **Medición antes/después** con el mismo instrumento de la auditoría: alto de página, pantallas,
   alto de bloque por especie, y palabras partidas (que tienen que seguir en 0).

## Lo que NO entra

- **No se toca el contenido**: ni un dato menos, ni un rótulo reescrito, ni el orden de las filas.
- **No se duplica marcado** (ver arriba).
- **No se toca el filtro de caladeros** más allá de lo que exija el apilado, y si se toca, sus tests
  mandan.
- **No entra el gate de objetivo táctil**: seguiría naciendo en rojo.

## Definition of Done

`pnpm lint` · `pnpm --filter web build` · `pnpm typecheck` · **`pnpm test` en la raíz** ·
**`pnpm test:e2e`** (la suite entera, no sólo el spec nuevo — la lección de T-26). Medición antes y
después en el PR. Informe adversario. Y el `ROADMAP.md`/`CHANGELOG.md` en el mismo PR.
