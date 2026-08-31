# T-26 · El portal en un móvil

**Épica**: E-MAREIA · **Rama**: `claude/T-26-movil` · **Origen**: auditoría de UX/UI en móvil sobre
producción, `docs/qa/ux/auditoria-movil-2026-08-31.md` (27 mediciones, 9 páginas × 3 viewports).

## Por qué existe

Un humano abrió `/pesca/especies/` en su teléfono y la página **parte las palabras por la mitad**:
`Cantábri/co`, `Mediterr/áneo`, `abundanci/a`, y la cabecera de la tercera columna se pinta **letra
por línea**. En esa misma celda de 8,9 caracteres de ancho está **«30 cm»**: la talla legal, que es
el dato por el que la página existe.

**La hipótesis de partida era falsa y conviene dejarlo escrito.** Se contó cuántas hojas de estilo
tenían `@media` (5 de 10 no tenían ninguna) y se dio por hecho que ahí estaba el problema. No lo
estaba: el sitio es *mobile-first*, sus tokens sólo usan `@media` para **subir** tamaños en
escritorio, y las otras cuatro hojas sin `@media` (`tallas-minimas`, `areas-protegidas`,
`actividad-solunar`, `indices`) rinden bien a 360 px. **Contar una construcción del código no mide el
resultado.** La causa real apareció midiendo el render.

## Lo que de verdad pasa

`especies.css:269` — `.tabla-especies th, .tabla-especies td { overflow-wrap: anywhere }`

La regla se puso a propósito, y su comentario explica bien por qué: *«sólo aquélla reduce el tamaño
mínimo de contenido, que es lo que empuja al contenedor»*. Es correcto — y es exactamente el
problema. Al anular el `min-content` de las **258 celdas** de la tabla, el algoritmo `auto` queda
libre para dejar la columna 3 en **8,9 `ch`**, y `anywhere` se encarga de que ahí quepa cualquier
cosa, letra a letra. La cura pensada para dos binomios científicos largos se aplicó a la tabla entera:
**365 de las 376 roturas son daño colateral**; sólo 11 caen en el elemento que la regla venía a curar.

Y no es un caso límite de móviles pequeños: la página **no se arregla hasta los 768 px**.

| ancho | 320 | 360 | 390 | 480 | 600 | 768 |
|---|---|---|---|---|---|---|
| palabras partidas | 866 | 484 | 219 | 88 | 36 | **0** |
| ancho col. 3 | 8,0 `ch` | 8,9 | 9,5 | 11,5 | 14,1 | 17,7 |

## Alcance

**Entra**: H-1/H-2 (la regla, restringida al binomio), H-3 (la cabecera de 43 caracteres en 8,9 `ch`),
H-5 (la altura de marea separada de su `m`), H-6 (el área pulsable a la mitad del ritmo vertical),
H-8 (el rótulo de 11 px que sólo es pequeño en móvil), y **los gates G1, G2 y G4**.

**No entra**: H-4 — convertir la tabla de especies en fichas apiladas por debajo de ~700 px. Es un
cambio de diseño (86 filas × 70,8 pantallas de scroll) y va en su propia trayectoria. H-7
(above-the-fold) es editorial y no tiene umbral defendible.

## Lo que este PR deja de trinquete

Los gates del portal miran el `dist/` carácter a carácter —que la nota legal viaje pegada a su cifra,
que ninguna cifra lleve decimal inglés, que ningún hueco quede mudo— y **todos comprueban lo que la
página dice. Ninguno ha comprobado nunca si se puede leer.** G1 (palabra partida a media palabra),
G2 (sin desbordamiento horizontal) y G4 (contraste AA) **nacen los tres en verde**, y G1 habría
cazado esto.

Aviso de método heredado de la auditoría, que vale para G4: el sitio usa `oklch()`, y una regex de
`rgb()` devuelve **cero hallazgos falsamente**, que es peor que no medir. El color se resuelve con el
motor del navegador.
