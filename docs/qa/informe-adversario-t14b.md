# Informe adversario — la calidad en el punto de decisión (T-14B)

- **Trayectoria:** T-14B · **PR:** #19 (`claude/T-14B-calidad-visible`) · **head:** `2619eee` ·
  **Fecha:** 2026-08-29
- **Superficie atacada:** la portada horneada (`apps/web/dist/index.html`, 47.997 B, 153 entradas),
  el filtro de calidad CSS-puro y sus tres radios, el cuerpo HTTP de `GET /v1/ports` (43.628 B), el
  contrato publicado de ese endpoint (`apps/api/README.md`) y —porque el catálogo se elige en más
  sitios que los dos del ticket— las otras dos listas de puertos del portal: `/mareas/<region>/`
  (12 páginas, 153 entradas) y `/mareas/<region>/<provincia>/` (24 páginas, 153 entradas).
- **Entorno:** local y efímero, sin salida a internet. `dist/` construido con `pnpm --filter web
  build` y servido por `tests/e2e/servidor-estatico.ts`; el API real levantado aparte con
  `deno task start` (Deno 2.x) en `127.0.0.1:8788` y hablado **por HTTP con `curl`**, nunca llamando
  a la función que se cree responsable. Sin cloud, sin prod: ni el diff, ni el DOM, ni el código han
  salido del contenedor, y ningún modelo externo ha revisado nada.
- **Reproducciones:** `tests/e2e/journeys/adversarial/a12-picker-sin-calidad.spec.ts` (2 recorridos)
  y `tests/e2e/journeys/adversarial/a12-null-con-motivo-inventado.spec.ts` (1). Los tres corren en
  el project `movil`, con `javaScriptEnabled: false`, y llevan el trinquete `test.fail()` puesto:
  **CI queda en verde** mientras el hallazgo esté abierto y se pondrá **rojo el día que se arregle**,
  que es cuando hay que quitar el `test.fail()` y quedarse el recorrido como gate permanente.
- **Bundles:** `docs/qa/bundles/t14b-adversario/` — los tres runs **en rojo**, tomados antes de poner
  el trinquete.
- **Contexto asimétrico:** se ha leído **la promesa** (`docs/trayectorias/T-14B-plan.md` como
  enunciado de contrato, `apps/api/README.md`, el `filtro__nota` y la entradilla de la propia
  portada) y el código **para dirigir los ataques** —qué atributo lleva cada `<li>`, qué selector lo
  alcanza, qué campo sale por dónde—. **No** se ha leído la justificación del diff ni el razonamiento
  del implementador sobre por qué eligió cada cosa: ése es exactamente el modelo mental que aquí no
  hay que compartir.

## Promesa

> En los dos sitios donde alguien **elige** un puerto —la portada y `GET /v1/ports`— la calidad de su
> predicción está a la vista y se puede filtrar por ella. La señal se lee **sin JavaScript**. Y un
> `null` significa «no se pudo medir», no «cero».

## Clases atacadas

| Clase | Se atacó | Resultado |
|---|---|---|
| **A2** · estado stale y botón atrás | Filtrar «Solo los medidos» → abrir Vigo → `goBack()`. | Aguanta: vuelve con 33 visibles y `#calidad-medidos` marcado. |
| **A5** · límites 0 / 1 / N | Las dos regiones de un solo puerto en sus dos extremos: Ceuta (1 puerto, 0 medidos) y Melilla (1 puerto, 0 estimados), en los tres estados del filtro. Viewports 412/360/320 px. | Aguanta. |
| **A6** · input hostil | Nombres del catálogo con apóstrofo y diacríticos en el HTML horneado (`l'Ametlla de Mar`, `Vandellòs i l'Hospitalet de l'Infant`, `Canet d'En Berenguer`, `Níjar`). | Aguanta: escapados como `&#39;`, ninguno rompe el `<li>` ni el selector `[data-estimado]`. |
| **A7** · frontera de autorización | **Descartada, con motivo**: la superficie no tiene sesión, usuarios ni mutaciones. `/v1/ports` es un catálogo público de solo lectura y la portada es HTML estático. No hay frontera que cruzar. |
| **A1 / A3 / A4 / A8 / A11** | **Descartadas, con motivo**: no hay formulario que enviar, ni escritura, ni sesión, ni acción destructiva. El «filtro» no muta nada: es un `:checked` que apaga reglas CSS. Atacarlas aquí sería teatro. |
| **A9** · callejón sin salida | Estados del filtro que dejan la página vacía o sin salida; región con el rótulo puesto sobre una lista vacía. | Aguanta: el gate de la región vacía muerde en **las dos** direcciones (`data-medidos="0"` y `data-estimados="0"`). |
| **A10** · feedback ausente | Operación **solo con teclado**: `ArrowRight` sobre el grupo de radios. | Aguanta: la flecha selecciona, el anillo de foco se proyecta sobre la etiqueta (`2px solid`), el filete marca la activa y la lista pasa a 120. |
| **A12** · la promesa vs lo entregado | Tres ataques. | **3 hallazgos** (2 reproducidos + 1 de juicio). |

## Hallazgos

### H-1 · A12 — la señal llega a la portada, no a las otras dos listas de puertos del portal

**Reproducido en rojo.** `tests/e2e/journeys/adversarial/a12-picker-sin-calidad.spec.ts`
Bundles: `docs/qa/bundles/t14b-adversario/A12-picker-region-771b521ac0ac.md` (**153 de 153**) y
`A12-picker-provincia-f3053e774674.md` (**10 de 10** en Pontevedra).

El portal tiene **tres** listas de puertos, no una. T-14B da la señal a la primera. Las otras dos son
las de la ruta que la propia portada llama canónica: su primer enlace es «Ver todas las regiones» →
`/mareas/` → `/mareas/<region>/` (que lista **los puertos** de la región, agrupados por provincia) →
`/mareas/<region>/<provincia>/` (que los lista otra vez, con la zona horaria como meta). En esas dos
los 153 puertos vuelven a presentarse planos: sin «medida», sin «estimada», sin `data-estimado`.
Medido sobre `dist/`: la clase `indice__calidad` aparece en **una sola página del sitio**,
`index.html`.

El resultado práctico es que **el último clic antes de la ficha se sigue dando a ciegas**:

```
Error: en /mareas/galicia/pontevedra/, Vigo (medida) y Baiona (estimada) se presentan iguales
  - "Baiona: «BaionaEurope/Madrid» no dice «estimada»"
  - "Vigo: «VigoEurope/Madrid» no dice «medida»"
  … 10 de 10
```

No es un defecto de lo que se implementó —lo implementado funciona—: es **alcance que se quedó
fuera**, y reproduce una capa más abajo la misma «omisión en el punto de decisión» que la trayectoria
vino a quitar. Por eso el assert afirma **el comportamiento correcto** (la misma señal en cualquier
lista de puertos) y no el síntoma.

Se manifiesta en `apps/web/src/pages/mareas/[region]/index.astro` y
`.../[region]/[provincia]/index.astro`, que construyen sus `entradas` sin `estimada`. **No se propone
el fix**: si la señal debe ir en esas listas, con qué palabra y si arrastran también el filtro es
decisión del arquitecto.

### H-2 · A12 — el `null` viaja bien, pero el contrato lo explica con un motivo falso en 118 de 153 puertos

**Reproducido en rojo.** `tests/e2e/journeys/adversarial/a12-null-con-motivo-inventado.spec.ts`
Bundle: `docs/qa/bundles/t14b-adversario/A12-null-motivo-c5a1aadbb735.md` (**118 de 153**).

La mitad fuerte de la promesa se cumple: el `null` está **presente** en el cuerpo, no ausente. El
ataque va un paso más allá, porque un `null` presente y **explicado con el motivo equivocado** afirma
algo falso con más autoridad que un hueco. `apps/api/README.md`, tabla de `quality` que estrena esta
trayectoria:

> `hw_time_err_p95_min` … `null` = **la observación existe** pero no tiene pleamares identificables
> (marea de centímetros con residuo meteorológico por encima).

Y unas líneas más abajo, en las reglas comunes: «en los puertos micromareales el error de hora no es
medible y viaja como `null`».

Pero la **ficha de esos mismos puertos**, en la fila de esa misma métrica, dice lo contrario:

> Error de hora de la pleamar (p95) — *no hay observación de este puerto con la que medirlo*

Dos superficies publicadas del mismo portal, hechos contrarios sobre el mismo `null`. Medido:

| | Puertos |
|---|---|
| `hw_time_err_p95_min: null` en el cuerpo de `/v1/ports` | **131** |
| …de ellos, con `rmse_m: null` también (= sin observación ninguna, según el mismo README) | **118** |
| …de ellos, micromareales de verdad (hay observación, no hay pleamares medibles) | **13** |
| Fichas de `dist/` que dicen «no hay observación» en **las dos** filas | **118** de 153 |

O sea: el motivo documentado es cierto en **13** casos y falso en **118**. Quien lea el contrato y
filtre por `hw_time_err_p95_min === null` creyendo que recoge puertos micromareales **medidos**,
recoge sobre todo puertos **sin medir** — lo contrario de lo que buscaba, y en un portal cuya regla
es «un puerto no publica una precisión que no tiene». El `null` no se confunde con un cero, que era
la promesa; se confunde con **otro `null`**, que es un fallo del mismo tipo que nadie estaba mirando.

El recorrido incluye un assert previo sobre la frase literal del README: si alguien la reescribe, el
test lo dice en vez de pudrirse en silencio.

**Y esto ya se había arreglado una vez.** El ledger adversario lo tiene en «hallazgos arreglados»,
del pase de T-09 (`9c6cf5a`): *«La nota de calidad habla de "la observación" en una estación con
`samples: 0`» → «Los dos `null` del QC se separan: sin RMSE, "no hay observación de este puerto con
la que medirlo"»*. Es exactamente esta confusión, y por eso la ficha acierta hoy. T-14B le dio al
mismo dato una **segunda superficie** y el contrato de esa superficie se escribió a mano, así que la
lección se quedó donde estaba gateada. El apunte de método, para el siguiente pase: cuando un dato
estrena superficie, lo que hay que volver a gatear no es su **presencia** —eso lo hicieron bien, con
`in` y no con `!== undefined`— sino su **significado**.

### H-3 · A12 — el único mando visible no ordena por error, y en los extremos lo invierte (**juicio, no hecho**)

**Sin repro, y marcado como tal** — es la excepción única que la skill admite para A12. No hay test
en rojo porque el comportamiento actual es **el diseñado y está publicado**: el README dice
expresamente que `estimated` «es una pregunta distinta de `grade` y no se deduce de él». Afirmar en
un assert que deben coincidir sería inventarme una spec contra una decisión declarada. Se reporta
como lo que es: una observación de producto, con números duros para que se pondere.

La portada da al usuario **un solo mando** y lo llama calidad. Ese mando es la **procedencia** de las
constantes, no el error de la predicción. En el catálogo de hoy los dos ordenan al revés en los
extremos (datos de `/v1/ports`, cuerpo real):

| Puerto | La portada dice | El filtro «Solo los medidos» | `grade` | `rmse_m` |
|---|---|---|---|---|
| Puerto del Rosario | **medida** | lo **conserva** | C | **1,3424 m** |
| Tarragona | **medida** | lo **conserva** | C | 0,6442 m |
| San Sebastián de la Gomera | **estimada** | lo **esconde** | **B** | **0,0364 m** |
| Garachico | **estimada** | lo **esconde** | C | 0,1695 m |

Quien filtre «Solo los medidos» para quedarse con los buenos se lleva el puerto con **el peor error
del catálogo** (1,34 m, y su propia ficha lo admite: «¿Está medida aquí esta marea? Sí» seguido de
«Error cuadrático medio 1,342 m») y pierde uno con **36 mm** y grade B: un factor **37×** en la
dirección contraria. El `grade` sí ordena por error, viaja en `/v1/ports`… y **no se enseña en la
portada**, que es justo donde se elige.

No es una mentira —la nota del filtro define «medida» con precisión y es cierta puerto a puerto— y no
se pide aquí que se ordene por calidad (el plan lo descarta con motivo). Lo que se señala es que la
portada resuelve el 78 % del problema (los estimados dejan de disfrazarse de medidos) y deja abierto
el 22 % restante: **entre los 33 «medidos» sigue sin poder distinguirse 4,5 cm de 1,34 m**, y ese es
el segundo día de un usuario real que ya sabe filtrar.

## No reproducidos

Lo que se intentó, con la entrada concreta, y por qué la app aguantó. Esta lista vale tanto como la
de arriba: sin ella, una pasada estéril y una alucinada se ven igual.

1. **La fragilidad del filtro CSS (objetivo dirigido nº 1).** Se buscó que las reglas de hermano
   fallaran: `data-medidos=""` / `"00"` / ausente no casarían con `[data-medidos="0"]`, y un `.grupo`
   anidado se saldría del `~`. **No reproducido**: las 12 regiones publican los dos atributos como
   entero decimal (`data-estimados="25" data-medidos="7"`, …), incluidos los dos ceros reales de
   Ceuta (`0` medidos) y Melilla (`0` estimados), y las secciones son hermanas directas de los tres
   radios. Además el gate de `sitio-construido.test.ts` recomputa los dos atributos de **cada**
   región desde el catálogo, así que una región nueva sin ellos sale en rojo con su slug. No hay
   entrada por la que meter el fallo sin editar código de producción, y eso no es un ataque: es una
   mutación.
2. **Contadores horneados desincronizados (objetivo nº 2).** «Todos 153 · Medidos 33 · Estimados
   120» y los `data-*` por región. **No reproducido**: los tres salen de `filter()` sobre el mismo
   catálogo que se pinta, y el gate los recomputa. Se comprobó además la coherencia con **otra**
   superficie que no participa en el gate: los metas «N puertos» de `/mareas/` cuadran con
   `data-estimados + data-medidos` en las 12 regiones, sin un solo desajuste.
3. **Un `rmse_m: 0` real, indistinguible de un `null` mal leído (objetivo nº 3).** **No
   reproducido**: barrido de los 153 ficheros de `data/stations/` y del cuerpo de `/v1/ports` —
   **cero** puertos con `rmse_m === 0` o `hw_time_err_p95_min === 0`. El mínimo publicado es
   0,0359 m. La confusión null/cero no tiene hoy un caso que la dispare (lo que sí tiene caso es
   H-2: null contra null).
4. **La señal sin JavaScript (objetivo nº 4).** `javaScriptEnabled: false` en los tres recorridos de
   este informe, más impresión (`emulateMedia({ media: "print" })`) y teclado puro. **No
   reproducido**: cero `<script>` en `index.html`; imprimiendo con «Solo los medidos» salen 33
   entradas y la opción activa se distingue por su filete negro sobre papel; con el teclado, las
   flechas seleccionan, el anillo de foco se proyecta sobre la etiqueta y el filtro aplica.
5. **La hoja de estilos caída.** Con `**/*.css` abortado, los tres radios se vuelven visibles, la
   etiqueta los marca… y las 153 entradas siguen a la vista. **Se descarta como hallazgo, a
   propósito**: «una funcionalidad hecha solo con CSS deja de funcionar sin CSS» es una tautología,
   no un defecto, y la parte que sí importa —**la señal**, que es texto horneado— sobrevive intacta.
   Queda anotado como residuo, no como rotura (R-1, abajo).
6. **Botón atrás y estado stale (A2).** Filtrar → abrir la ficha de Vigo → `goBack()`. **No
   reproducido**: vuelve con 33 entradas visibles y `#calidad-medidos` marcado.
7. **Geometría del mando a 412 / 360 / 320 px (A5+A9).** **No reproducido**: las tres etiquetas miden
   44 px de alto en los tres anchos (el mínimo que pide el brief), envuelven sin solaparse y ninguna
   queda fuera de la página.
8. **Escapado del catálogo en el HTML horneado (A6).** **No reproducido**: los cuatro nombres con
   apóstrofo salen como `&#39;` y ninguno rompe el atributo ni el selector.
9. **Las cifras que el CHANGELOG publica de sí mismo.** Se auditaron por si una medición publicada ya
   no se sostenía. **No reproducido — y merece decirse**: `index.html` mide **47.997 B** (declarado
   47.997), **4.770 B** en gzip (declarado 4.770), la hoja compartida **17.384 B** (declarado 17.384)
   y el cuerpo de `/v1/ports` **43.628 B** (declarado 43.628). Cuatro de cuatro, exactas.

### Residuos medidos, con números

- **R-1 · el mando que se marca sin aplicarse.** Si la hoja de estilos no llega, el control de filtro
  se sigue pintando y se sigue marcando, pero no filtra: **153** entradas visibles con «Solo los
  medidos» seleccionado. No es una rotura (ver nº 5) y no se pide arreglarlo; se anota porque es el
  único estado encontrado en el que la interfaz declara una cosa y la página enseña otra.
- **R-2 · la cobertura de la señal, contada.** La señal cubre **153/153** entradas en una página
  (la portada) y **0/306** en las otras dos familias de listas (12 páginas de región + 24 de
  provincia). Es H-1 dicho en números.
- **R-3 · el motivo del `null`, contado.** El contrato acierta en **13/131** de los `null` de
  `hw_time_err_p95_min` y se equivoca en **118/131** (90 %). Es H-2 dicho en números.
- **R-4 · el rango de error que el mando no separa.** Dentro de los 33 «medidos», el RMSE publicado
  va de **0,0359 m** a **1,3424 m** — un factor **37×** que ninguna de las dos superficies enseña en
  el punto de decisión. Es H-3 dicho en números.

## Estado de los trinquetes

| Recorrido | Hallazgo | `test.fail()` | Qué pasa el día del fix |
|---|---|---|---|
| `a12-picker-sin-calidad.spec.ts` (región) | H-1 | puesto | Playwright avisa de que «pasó lo que se esperaba que fallara» → se quita y queda gate. |
| `a12-picker-sin-calidad.spec.ts` (provincia) | H-1 | puesto | ídem |
| `a12-null-con-motivo-inventado.spec.ts` | H-2 | puesto | ídem |

Suite tras añadirlos: **Playwright 48/48** (45 previos + 3 adversarios, los tres como fallo
esperado), `pnpm lint` y `pnpm typecheck` limpios. Los tres recorridos cierran la salida a internet
(`cerrarLaSalidaAInternet`) antes de navegar: sin eso cada `goto` se quedaba 20 s esperando la hoja
de fuentes externa del `<head>` y el ataque moría **de reloj** en vez de morir del assert, que es la
forma más tonta de perder un hallazgo — y con `test.fail()` puesto habría quedado «verde» por el
motivo equivocado.

---

## Cierre del pase — el arreglo (añadido por el `implementador`, no por el adversario)

Este apartado se añade **después** del informe y no lo toca: lo de arriba es el testimonio del pase,
con fecha, y se queda como se escribió. Aquí solo se anota qué pasó con cada hallazgo.

| Hallazgo | Estado | Dónde se ve |
|---|---|---|
| **H-1** · la señal en una lista de tres | **Corregido** | `pages/mareas/[region]/index.astro` y `.../[region]/[provincia]/index.astro` pasan `estimada` al mismo `Indice.astro` de la portada. Cubre las **12** páginas de región y las **24** de provincia: 306 entradas que decían «medida» o «estimada». El **filtro no baja** con la señal, con el porqué medido en `design-brief.md` §7 quater. |
| **H-2** · el `null` con el motivo equivocado | **Corregido** | `apps/api/README.md` publica los tres casos en tabla, cada uno con la frase de la ficha y su cifra recontada del dataset: 118 sin observación, 13 micromareales medidos, 22 medidos con pleamares. |
| **H-3** · el mando no ordena por error | **Abierto, por decisión** | Es juicio de producto y lo decide el humano; no se toca. |
| **R-1** · el filtro sin hoja de estilos | **Anotado, no se arregla** | «Una funcionalidad hecha solo con CSS deja de funcionar sin CSS» es una tautología. |

Los **tres recorridos** pierden su `test.fail()` y se quedan como **gate permanente**. Y como el
apunte de método del informe pedía que lo que se volviera a gatear fuera el **significado** y no la
presencia, el de H-2 no comprueba que el campo esté: lee las cifras de la tabla del contrato y las
**recalcula desde el dataset**, y clasifica las 153 fichas construidas por lo que dicen sus filas
exigiendo el mismo reparto puerto a puerto. El tercer extremo —que la clasificación del cuerpo HTTP
cuadre con `metrics.samples`, un contador del QC que no viaja por el API— lo ata el gate hermano de
`apps/api/src/http/core_test.ts`.

Comprobado que muerden: falsear un puerto (Alicante con error de hora y sin observación) deja
**verdes** los dos gates de presencia de T-14B y pone rojo el del significado; quitarle la señal a
un solo puerto (Vigo) pone rojo el gate del sitio construido y los dos recorridos del picker,
nombrándolo.
