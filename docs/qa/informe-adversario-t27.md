# Informe adversario · T-27 — el catálogo apilado en fichas

**Fecha**: 2026-09-01 · **Rama**: `claude/T-27-fichas` · **PR** #27
**Quién**: el orquestador. `qa-adversario` sigue sin estar disponible (cupo semanal de la cuenta,
`rate_limit`). La independencia de este pase viene de invertir la función objetivo y de atacar el
`dist/` construido, no de que lo mirase otro. Dicho, como en T-23 y T-26.

## Promesa

> Por debajo de 700 px cada especie del catálogo **se lee como una ficha** y no como tres columnas de
> 14 caracteres. Se consigue **cambiando la presentación y no el marcado**: un solo DOM, así que el
> texto publicado es el mismo a 360 px y a 1280, **ningún dato se esconde al apilar**, y la tabla
> **sigue siendo una tabla** para quien la recorre con un lector de pantalla.

## Clases atacadas

| Clase | Qué se intentó |
|---|---|
| A3 · el gate que no mira donde debe | Quitar los roles ARIA enteros y ver quién enrojece. |
| A8 · el dato que se degrada en silencio | Esconder la nota de la talla con un `display: none` «para que quepa». |
| A2 · frontera entre capas | Con el filtro de un caladero puesto, comprobar que apilado se ve **lo mismo** que en escritorio. |
| A9 · la afirmación no comprobable | Buscar en el nuevo gate expectativas escritas a mano que se puedan «arreglar» subiendo un número. |

## Hallazgos

### A-T27-1 · los roles que sostienen la tabla apilada no los vigilaba nadie

`display: block` sobre `table`/`tr`/`th`/`td` hace que el navegador **retire los roles implícitos**:
sin `role="table"`/`rowgroup`/`row`/`rowheader`/`cell` explícitos, quien navega con lector de pantalla
se queda **sin filas y sin celdas**, y deja de oír la cabecera junto al dato. Por eso el plan los
exigía en el mismo commit que el `display: block`.

Están puestos y aterrizan bien en el `dist/` —1 `table`, 2 `rowgroup`, **87** `row`, 3
`columnheader`, **86** `rowheader`, **172** `cell`—, pero **quitándolos todos con un `sed` el sitio se
construía, las 86 fichas seguían publicando su texto entero y ninguno de los ~300 tests se enteraba**.

Es la peor forma de regresión: **una avería de accesibilidad no tiene síntoma visible**. Nadie la ve
al mirar la página; si no hay un gate, no hay nadie.

**Arreglo**: un gate sobre el `dist/` con las seis cuentas, **derivadas del catálogo** y no escritas a
mano — con un número mágico, añadir una especie pondría el gate en rojo sin que nada esté mal, y quien
lo viera aprendería a subir el número, que es como muere un gate. Probado en rojo con el mismo
sabotaje.

## No reproducidos

1. **El `display: none` «para que quepa».** Escondiendo la nota de la talla por debajo de 700 px, **G6
   enrojece** nombrando las especies que publican menos texto apiladas que en escritorio. Era el
   riesgo por el que G6 existe y está cubierto.
2. **El filtro de caladeros apilado.** Con `#cal-canario`, a 360 px se ven **31 fichas** y a 1280
   **31 filas**, y son exactamente las 31 que declaran ese caladero. Mover los selectores hermanos en
   T-26 y apilar en T-27 no lo han descolocado.
3. **Los gates de T-20 sobre el `dist/`.** E1, E3, E5, E6 y E7 siguen alcanzando el mismo texto,
   porque **hay un solo marcado**. Es la consecuencia buscada de la decisión de diseño, y se
   comprobó: E1 sigue poniéndose rojo si una fila pierde de verdad su nombre legal.
4. **Las palabras partidas.** 0 en las 9 combinaciones (3 páginas × 320/360/390 px) medidas contra un
   espejo con las tipografías del sitio, antes de empujar.

## Lo que este pase deja dicho, además del gate

Durante la implementación, **tres gates se pusieron rojos denunciando el marcado y no el dato**: E1,
E7 y dos recorridos adversarios dijeron «la fila no se publica» **con las 86 filas enteras**, porque
su `filaDe` exigía que `data-especie` fuese el **primer** atributo y `role="row"` se puso delante. No
es un hallazgo de este pase —lo destapó la suite al primer build— pero es la misma familia y va al
digest:

> **Un gate atado a la FORMA del marcado denuncia el marcado, no el dato.** Un patrón que exige un
> orden de atributos se rompe con cualquier atributo nuevo, y su rojo dice «el dato falta» cuando el
> dato está entero. Se reconoce porque el rojo aparece **en todas las filas a la vez**: un defecto de
> datos casi nunca es unánime.

Y una limitación de G6, dicha en vez de descubierta luego: compara `innerText`, así que ve un
`display: none` o un `visibility: hidden` — pero **no** vería un texto de 1 px o del color del fondo.
Para eso está G4 (contraste), que sigue sin instalarse.
