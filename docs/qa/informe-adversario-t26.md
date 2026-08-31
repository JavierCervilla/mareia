# Informe adversario · T-26 — el portal en un móvil

**Fecha**: 2026-08-31 · **Rama**: `claude/T-26-movil` · **PR** #26
**Quién**: el orquestador. El rol `qa-adversario` no estaba disponible —la cuenta agotó su cupo
semanal y los subagentes caían con `rate_limit`—, así que el pase lo hice yo. Eso **acota su
independencia**, y va dicho: viene de invertir la función objetivo y de atacar el `dist/` construido,
no de que lo mirase otro.

## Promesa

> El portal **se lee en un teléfono**: ninguna página parte palabras por la mitad, ninguna desborda a
> lo ancho, y **una cifra no se separa de su unidad**. Y hay gates que lo vigilan a **320, 360 y
> 390 px**, que es donde la avería aparece.

## Clases atacadas

| Clase | Qué se intentó |
|---|---|
| A3 · el gate que no mira donde debe | Sabotear cada arreglo y ver **quién** enrojece: el gate nuevo, uno viejo, o nadie. |
| A5 · acertar el veredicto y fallar el culpable | Provocar un desbordamiento y comprobar si G2 **nombra al que lo causa** o a sus contenedores. |
| A8 · el dato que se degrada en silencio | Quitar la mitad de un rótulo acortado por esta misma trayectoria. |
| A9 · la afirmación no comprobable | Buscar gates que calculen su expectativa desde el código que vigilan. |
| A6 · input hostil | Formas que el detector de palabra partida no debe confundir: cortes en guion, en raya, y palabras que empiezan por una letra de unidad. |

## Hallazgos

Dos. Los dos reproducidos en rojo antes del arreglo, y **el primero está dentro del gate que escribí
en esta misma trayectoria**.

### A-T26-1 · G2 acertaba el veredicto y **fallaba el culpable**

Poniéndole `min-width: 600px` a `.tabla-especies__literal`, G2 enrojecía —correcto— y listaba:

```
table.tabla-especies · thead.(sin clase) · tr.(sin clase) · th.(sin clase) ·
tbody.(sin clase) · tr.(sin clase) · td.(sin clase) · ul.tabla-especies__caladeros ·
li.(sin clase) · span.tabla-especies__caladero
```

**El elemento que impone el ancho no aparece.** Cuando algo desborda, todos sus ancestros desbordan
con él; en orden de documento la lista se llena de contenedores y el `slice(0, 10)` corta justo antes
del culpable. Quien leyera ese rojo iría a mirar la `<table>`.

Lo grave es de dónde viene: **el comentario de ese mismo gate citaba la lección de A5** —«el culpable
se busca en `body *` y no en un contenedor que ya sospeches»— y el gate la incumplía. Escribir el
principio no protege de violarlo, que es literalmente la lección de T-20.

**Arreglo**: se listan sólo las **hojas** —los elementos que cruzan el borde y **no contienen** a otro
que también lo cruce—. Con el mismo sabotaje, `span.tabla-especies__literal` aparece ahora en la
lista.

### A-T26-2 · el rótulo acortado podía perder la mitad de lo que nombra, en silencio

T-26 acortó la cabecera de la tercera columna de `CALADEROS QUE LA REGULAN · REGISTROS EN OBIS` a
`CALADEROS · OBIS`, porque el largo se pintaba en **10 líneas a 3,7 caracteres**. El acortamiento es
correcto —el detalle sigue entero en cada celda— pero abrió una puerta: quitándole `· OBIS`, el sitio
se construía, las 86 filas seguían publicando sus registros, y **ninguno de los ~300 tests se
enteraba** de que la columna había dejado de decir de dónde salen sus cifras.

En este portal la procedencia no es adorno: una cifra de presencia sin su fuente es exactamente lo
que el proyecto no publica. **Arreglo**: un gate sobre el HTML construido que exige que esa cabecera
nombre el caladero **y** nombre OBIS — comprobado **por el sentido y no contra la constante que lo
escribe**, porque compararlo con `COLUMNA_PRESENCIA` haría que vaciar esa constante moviera el gate
con ella (A-T23-2). Probado en rojo: «la tercera cabecera no nombra a OBIS, que es de donde salen sus
cifras: «Caladeros»».

### A-T26-3 · el gate nuevo encontró lo que yo no verifiqué, y sólo porque CI tiene las tipografías

**Lo encontró G2, en CI, no este pase.** Va aquí porque es lo más instructivo del lote.

A 320 px, `/pesca/especies/` desbordaba el cuerpo de la página: las tres columnas suman 327 px y el
documento salía a **347**. La auditoría lo había avisado —«a 320 px la tabla fuerza 27 px de scroll:
decide y dilo en el PR»— y no se actuó.

Lo grave no es el desbordamiento: es **por qué no se vio antes de empujar**. G2 pasaba en verde en
local y salía rojo en CI, y la diferencia es que **en este contenedor el proxy no deja cargar las
tipografías del sitio**. Se había previsto para G1 —que se salta cuando no cargan— y **no se cayó en
que G2 depende de ellas exactamente igual**: con una fuente de reserva más estrecha, la tabla cabía.
O sea que la ejecución local de G2 estaba midiendo **otra página**.

**Arreglo**: la tabla se desplaza dentro de su propio marco (`overflow-x` en un contenedor con
`tabindex` y nombre accesible) y el cuerpo no se desplaza nunca. Medido con las tipografías del sitio:
347 → **320** a 320 px, y el filtro de caladeros sigue funcionando tras mover los tres selectores
hermanos (`~ .tabla-especies` → `~ .tabla-especies__marco .tabla-especies`), comprobado con la suite
e2e entera: **80 recorridos en verde**.

Y antes de volver a empujar, **G1 se pre-voló contra el espejo con las tipografías reales**: 0
palabras partidas en las 9 combinaciones, así que nace verde en CI en vez de nacer rojo y enseñar a
ignorarlo.

## No reproducidos

1. **El rótulo del binomio en la exención de G1.** La exención está escrita en el gate y no leída del
   CSS, así que volver a poner `overflow-wrap: anywhere` en `th, td` **no se auto-eximiría**. No
   verificable aquí —G1 se salta en este contenedor por las tipografías— y queda apuntado como lo que
   es: razonado, no medido.
2. **Cortes legítimos.** El detector no denuncia `(COI-UNESCO)` ni `Anexo II—` ni una palabra que
   empiece por letra de unidad. Probado en la sensibilidad de G1 y en la del gate de unidades.
3. **La cifra separada de su unidad.** Tras el arreglo, la página de puerto publica **126 magnitudes
   pegadas y 1 suelta**, y esa una es la frase del pipeline sobre Brest — declarada fuera del alcance
   del gate, no descubierta después.
4. **El gate de unidades sobre el `dist/`.** No se instaló ahí, y el porqué está medido: nacería en
   rojo **1.453 veces**, de las cuales **82 son el literal del Real Decreto**, que se publica verbatim
   y no se toca ni para pegarle un espacio.

## Lo que este pase deja en el trinquete

Dos gates nuevos (culpables-hoja en G2; la cabecera nombra su fuente), los dos probados en rojo. Y una
lección que va al digest:

> **Un gate que mide el render depende de las tipografías, y sin ellas mide otra página.** Se previó
> para G1 y se pasó por alto en G2, que verde en local y rojo en CI señalaba un desbordamiento real.
> La regla: si un gate mira cómo se ve algo, su ejecución local sólo vale con las mismas fuentes.

> **Un gate puede citar la lección que incumple.** G2 llevaba escrito en su comentario que el culpable
> se busca en `body *` «y no en un contenedor que ya sospeches», y devolvía diez contenedores sin el
> culpable. La cita no es la comprobación: sólo saboteando se ve cuál de las dos hay.
