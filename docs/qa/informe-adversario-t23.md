# Informe adversario · T-23 — la ficha de cada especie

**Fecha**: 2026-08-31 · **Rama**: `claude/T-23-ficha-especie` · **PR** #25
**Quién**: el orquestador. El rol `qa-adversario` no estaba disponible —la cuenta agotó su cupo
semanal y los subagentes caían con `rate_limit`—, así que el pase lo hice yo, y eso **debilita su
premisa**: la diversidad de este pase viene de invertir la función objetivo y de atacar el artefacto
construido, no de que lo mire otro. Queda dicho aquí porque un informe que oculta de dónde viene su
independencia vale menos que uno que la acota.

## Promesa

Lo que T-23 promete, y por tanto lo único contra lo que tiene sentido atacar:

> Las **86** especies del RD 560/1995 tienen ficha propia con una **retícula fija** de campos, donde
> **ningún hueco es mudo** —cada ausencia publica su motivo— y donde la foto **sabe de quién es**:
> autor y licencia visibles **en la misma figura** que la imagen, nunca en un pie global, y la
> identificación del taxón atribuida a quien la hizo.

No se ataca el razonamiento del diff: se ataca esa frase, sobre el `dist/` construido.

## Clases atacadas

De la taxonomía de 12, las seis que tienen superficie aquí:

| Clase | Qué se intentó |
|---|---|
| A2 · frontera entre capas | Que el dataset diga una cosa y la página publique otra: el rótulo del préstamo, el crédito sin autor y el motivo del hueco, saboteados **en la plantilla** y no en el módulo. |
| A3 · el gate que no mira donde debe | Sabotear cada afirmación nueva y comprobar **quién** enrojece: el test del módulo, el gate del `dist/`, o nadie. |
| A6 · input hostil | Autor en blanco, cadena vacía, `atribucionRequerida` como cadena `"false"`. |
| A8 · el dato que se degrada en silencio | Que una candidata publicable desplace a otra mejor sin que nada lo diga. |
| A9 · la afirmación no comprobable | Un gate que calcula su expectativa desde el código que vigila. |
| A11 · el hueco mudo | Que la única especie sin foto publique su motivo **en la página**, no sólo en el JSON. |

## Hallazgos

Dos, los dos reproducidos en rojo antes del arreglo y los dos con su recorrido convertido en gate
permanente. Ninguno venía del diff: los dos son daños colaterales de la **enmienda** que yo mismo
metí el 31 de agosto para no perder fotos.

### A-T23-1 · la excepción del dominio público **quitaba un crédito**

`pagellus-spp` publicaba **«Sin autor acreditado»** teniendo, en el mismo ítem de Wikidata, una foto
**firmada**. Su ítem ofrece dos imágenes: `File:Pagellus bogaraveo - Baron Cuvier.jpg` (dominio
público, **sin `Artist`**) y `File:Pagellus erythrinus 27-09-05.jpg` (con autor). Antes de la
enmienda la primera se caía por no acreditar a nadie y se publicaba la segunda; al abrir la excepción
de `AttributionRequired = false`, la primera pasó a ser publicable y **ganó por orden de la fuente**.

La excepción existía para **no perder fotos** y estaba perdiendo **créditos**, que es lo único que la
ficha promete de su foto. Reproducido en
`data/pipeline/tests/test_fotos_ingesta.py::test_entre_dos_publicables_se_prefiere_la_que_acredita_a_su_autor`.

**Arreglo**: entre candidatas igualmente publicables y del mismo rango, se prefiere la que **acredita
a su autor**. No es criterio estético: es un campo de la fuente, `Artist`, presente o ausente. Y la
preferencia **sólo elige entre publicables**: convertir «prefiere» en «exige» volvería a cerrar los
huecos que la excepción abrió, así que ese caso tiene su propio recorrido
(`test_si_ninguna_acredita_autor_se_publica_la_primera_publicable`). Efecto medido: las fotos sin
autor bajan de **4 a 3**, y las tres restantes no tienen alternativa firmada.

### A-T23-2 · **F2 comprobaba la página contra la función que escribe la página**

Para las fotos sin autor, el gate F2 del `dist/` exigía que la figura contuviera
`creditoSinAutor(licencia)` —**llamando a la misma función que la plantilla usa para escribirla**—.
Vaciando esa función, la página se quedó en «Foto · Public domain», sin una palabra sobre autoría, y
**F2 siguió verde**: su expectativa se vació con ella. Un gate así sólo puede demostrar que el código
es igual a sí mismo.

Es el defecto de **E4 en T-20** («comparándose contra el propio valor que vigilaba») reapareciendo en
otro sitio, y el mismo motivo por el que **E6** recomputa la consulta en vez de leerla.

**Arreglo**: F2 exige **literales escritos en el propio gate** («Sin autor acreditado», «no registra
quién hizo esta foto»). La duplicación de la frase es el precio de la independencia. Probado en rojo
con el mismo sabotaje: ahora enrojece nombrando las tres especies y la frase que falta.

## No reproducidos

Cuatro ataques que **no** dieron hallazgo. Van aquí porque son lo único que distingue una pasada
estéril de una alucinada:

1. **El rótulo del préstamo, saboteado en la plantilla.** Quitando la línea que dice «la foto es de
   *Lophius piscatorius*», F2 enrojece **por el motivo exacto** —«publica una foto de otra especie
   sin decir de cuál»— y nombra las dos filas. Cubierto de verdad, y en la página.
2. **El motivo del hueco.** La única especie sin foto publica su motivo entero en el `dist/`
   («ningún ítem de Wikidata declara "Penaeus (Melicertus) kerathurus"…»), no sólo en el JSON.
3. **`atribucionRequerida` como cadena `"false"`.** El lector la rechaza: `"false"` es un valor
   verdadero en JavaScript y admitirlo convertiría la condición en su contraria justo donde decide
   si una foto se publica con crédito o sin él.
4. **Las dos claves de la misma especie** (`Thunnus thynnus` y `Thunnus Thynnus`, dos filas del BOE)
   publican la misma foto, que es lo correcto: son el mismo animal escrito dos veces por la norma.

## Lo que este pase deja en el trinquete

Cuatro recorridos nuevos, todos verdes tras el arreglo y **todos probados en rojo saboteando el
camino que cada uno dice vigilar**. Y una lección que va al digest, hermana de la de T-20:

> **Un gate que calcula su expectativa llamando al código que vigila no vigila nada.** La forma es
> reconocible: el test importa del módulo la misma función que produce lo que compara. Se ve
> saboteando la función — si el gate sigue verde, la expectativa se movió con el sujeto.

Y una segunda, del método de este mismo pase: **dos de los recorridos que escribí no mordieron a la
primera porque pasaban por el otro camino** —el de la marca de duplicado se ponía verde gracias a la
concordancia—. Un recorrido que pasa por un camino que no es el que dice probar no prueba nada, y eso
sólo se ve saboteando.
