# T-30 · G5: el objetivo táctil, medido antes de prometerlo

**Trayectoria**: `cmtipazpy000ymruypvulgz7i` · hija de E-MAREIA · **Rama**: `claude/T-30-objetivo-tactil`
**Origen**: el último hueco declarado de la auditoría de UX que abrió el humano con una foto de su móvil.

## Por qué este plan empieza midiendo

T-26/T-27/T-28 cerraron la auditoría dejando **G5 fuera a propósito**, y la razón quedó escrita en la
cabecera de `legibilidad-movil.spec.ts`:

> «El de objetivo táctil (≥ 44 × 44 px) se deja fuera a propósito: hoy nacería en rojo **170 de 170**
> en la portada, y un gate que nace en rojo se ignora.»

**Ese número es falso, y lo primero de esta trayectoria fue comprobarlo.** 170 es el total de objetivos
de la portada, no los que fallan. Medido con el sitio construido, a 360 px:

| página | objetivos visibles | en línea (exentos 2.5.8) | sueltos | **< 44 px** | **< 24 px** |
|---|---|---|---|---|---|
| `/` | 170 | 0 | 170 | **17** | 17 |
| `/pesca/especies/` | 179 | 2 | 177 | **173** | 159 |
| `/mareas/andalucia/cadiz/cadiz/` | 26 | 16 | 10 | **7** | 5 |

Y de los 17 de la portada, **3 son `input.solo-lectores` de 1 × 1 px** —campos ocultos para lector de
pantalla, que no son objetivo táctil de nadie—, así que los reales son **14**. La decisión de aplazar
G5 fue correcta; **el número con el que se justificó, no**. Se corrige en el mismo PR.

## Los tres racimos reales (no 170 casos sueltos)

1. **Cromía navegable, en todas las páginas**: la marca del cabecero (`a.marca__nombre`, 92 × **19**),
   las migas (`ol.migas > li > a`, 28 × **14**) y los enlaces-llamada sueltos («Ver todas las
   regiones», 131 × **16**).
2. **Los 12 encabezados de región** de la portada (`h2.etiqueta > a`, 52 × **14**).
3. **Los 171 enlaces de la tabla de especies** (86 nombres a 66 × **19** + 85 fichas WoRMS a
   232 × **14**). Anchos de sobra; **el que falta siempre es el alto**.

## El invariante, y por qué 24 y no 44

**El gate exige 24 × 24 (WCAG 2.5.8, nivel AA), no 44 × 44 (2.5.5, AAA).** No es una rebaja para que
pase: es el único umbral que se puede sostener **en todo el sitio** sin deshacer lo que acaba de
hacerse. Subir los 171 enlaces de la tabla de especies a 44 px de alto son **+60 px por ficha**, ~25 %
más de página — justo lo que T-27 redujo un 42 %. A 24 px son ~+10 px por enlace y la página crece ~5 %.

**Y la cromía navegable sí sube a 44**, porque ahí es barato y es lo que la gente toca de verdad.
Dicho de otra forma: **el gate encierra la obligación (24), el diseño apunta al oficio (44)**, y el
mensaje del gate dice cuál de las dos está midiendo.

## Exenciones, escritas en el gate y no inferidas del CSS

Es la lección de T-27 (A-T23-2): una exención leída del CSS que vigila se auto-concede.

- **Enlaces en línea dentro de un texto corrido** — excepción explícita de 2.5.8. Detección: el
  elemento comparte padre con texto que no es enlace. Hoy son 2 en especies y 16 en la página de puerto.
- **Objetivos ocultos a la vista** (patrón *screen-reader only*: caja ≤ 1 px + posicionado y recortado).
  Hoy, los 3 `input.solo-lectores` de la portada. **El gate los nombra en su mensaje** en vez de
  descontarlos en silencio.

## Los dos canarios (lección de T-28)

Todo gate que mide algo continuo lleva dos, porque un instrumento tiene dos formas de mentir:

- **Cobertura**: los objetivos medidos igualan a los visibles menos los exentos. Si sale **0**, el
  verde no significa nada.
- **Sensibilidad**: un elemento que sabemos pequeño tiene que salir pequeño.

## La trampa que ya nos costó una vez

**Este contenedor no carga las tipografías del sitio** (vienen de Google Fonts). G2 salió verde en
local y rojo en CI por esto mismo. Un alto de 14 px que sale de `line-height × font-size` **cambia con
la tipografía que cargue**. Por eso el arreglo va con **`min-height` y padding explícitos**, no
fiándose de la métrica del texto: así el objetivo mide lo mismo con Newsreader que con Georgia, y el
gate mide lo mismo aquí que en CI.

## Definition of Done

`pnpm lint` · `pnpm typecheck` · `pnpm test` en la raíz · **`pnpm test:e2e` entero** · CI en verde.
**G5 nace verde** y se prueba **en rojo** bajando un objetivo real por debajo del umbral, comprobando
antes con un `grep` de control **que el sabotaje se ha aplicado** (lección de T-28). Cabecera de
`legibilidad-movil.spec.ts` corregida. `CHANGELOG` y `ROADMAP` con `assert` antes y después.
