# Informe adversario — las zonas protegidas en la página de un puerto (T-21)

- **Trayectoria:** T-21 · **PR:** #23 (`claude/T-21-zonas-protegidas`, head `37b5b8d`) ·
  **Fecha:** 2026-08-30
- **Superficie atacada:** el módulo `protected-areas` entero (`module.ts`, `textos.ts`, `vista.ts`,
  `tipos.ts`), su adaptador en la web (`apps/web/src/modulos/areas-protegidas.ts`), la sección
  construida (`AreasProtegidas.astro` + `estilos/areas-protegidas.css`) en las **153 páginas de
  puerto** del `dist/`, el derivado `data/geo/areas-protegidas.json` (348 relaciones · 143/153 · 10
  puertos sin ninguna · 86 áreas en la fuente), los gates P1/P2/P4/P5 y la cobertura del pipeline
  (`mareia_pipeline/areas.py`, `utm.py`, `sources/rampe.py`, `run.py check`), y el camino sin red
  (worker de T-12 con la política `offline` que declara el módulo).
- **Entorno:** local y efímero. `dist/` construido y servido **por HTTP** (nunca `file://`: con
  `file://` faltan las webfonts y las medidas de ancho mienten). Chromium de Playwright, project
  `movil`. Pipeline en su venv, con el ZIP de RAMPE ya en `data/pipeline/.cache/`, así que **todo lo
  que sigue es offline**. **Sin cloud, sin prod**: ni el diff, ni el DOM, ni el código han salido del
  contenedor, y ningún modelo externo ha revisado nada.
- **Reproducciones:** cuatro recorridos nuevos en `tests/e2e/journeys/adversarial/` (5 cuerpos) +
  `utiles-areas.ts`. Los cuatro llevan el **trinquete `test.fail()`** puesto: `pnpm test:e2e` sigue
  en verde con los hallazgos abiertos (**61 passed**) y se pondrá en rojo el día que alguien los
  arregle sin quitarlo.
- **Bundles:** `docs/qa/bundles/t21-adversario/` — cinco, uno por cuerpo, del run **en rojo** tomado
  antes de poner el trinquete.
- **Contexto asimétrico:** se ha leído **la promesa** y el código **para dirigir los ataques** —qué
  campo sale por dónde, qué gate mira qué, qué puerto tiene qué área—. **No** se ha leído
  `docs/trayectorias/T-21-plan.md`, ni la justificación del diff, ni el razonamiento del
  implementador: ése es exactamente el modelo mental que aquí no hay que compartir. Las citas de
  comentarios que aparecen abajo son de **código y workflows**, y están porque son promesas
  operativas comprobables.

## Promesa

> En la página de cualquier puerto español, Mareia dice **todas** las áreas marinas protegidas cuyo
> borde está a menos de 30 km, con su tipo y su distancia; y **en ningún caso**, ni por omisión, dice
> que se pueda pescar.

Son tres compromisos y el pase ataca los tres por separado: **«todas … a menos de 30 km»** (H-2,
H-3, H-4), **«con su tipo y su distancia»** (H-3, H-4) y **«en ningún caso se puede leer que se pueda
pescar»** (H-1). Y como el módulo declara además que la lista **se lee sin cobertura si se guarda el
puerto**, se ataca también esa cuarta afirmación (no reproducida, nº 4).

**El eje que atraviesa los cuatro hallazgos** es el mismo, y conviene leerlo antes que ninguno: el
derivado se **commitea** y **nada en CI lo vuelve a derivar de la fuente**. `run.py areas-protegidas`
necesita red y el job `data-pipeline` no la usa a propósito —lo dice el propio workflow:

> «Regenerar el dataset (`make build`) necesita red y no corre en CI a propósito: el dataset se
> commitea.» (`.github/workflows/ci.yml`, job `data-pipeline`)

Es una decisión razonable. La consecuencia es que **todos** los gates del artefacto son gates de
**coherencia interna** —el resumen contra el contenido, la comparativa contra el resumen, el aviso
contra sí mismo— más **dos números tecleados** en un test de la web (`348` y la lista de los diez
puertos vacíos). Cualquier fichero que respete esos dos números y esa coherencia se publica. Los
cuatro hallazgos son cuatro ficheros así, y el cuarto **ni siquiera hace falta escribirlo a mano**.

## Clases atacadas

| Clase | Qué se intentó, con la entrada concreta | Resultado |
|---|---|---|
| **A1** · consistencia del dato | Desigualdad de Lipschitz sobre las 153×153 parejas de puertos: la distancia a un borde es 1-Lipschitz, así que si A publica X a `d` km y B está a `s` km de A con `d+s ≤ 30`, B **tiene** que publicar X. 11.628 parejas, 348 relaciones. | No reproducido (nº 1) |
| **A2** · sello congelado | Reejecutar la ingesta desde el ZIP cacheado y diffear el artefacto commiteado campo a campo. | No reproducido (nº 2) |
| **A4** · el registro que miente | ¿Dice la página algo que el sistema no hace? Tres claims medidos: la cota nunca pasa del radio; «cae dentro» es un hecho; «esta lista se guarda con él». | **H-3** |
| **A5** · maquetación / límites de ancho | Tinta real (rectángulos de los nodos de texto, no cajas) fuera de la columna de contenido, en **las 153 páginas** y a **320 y 412 px**. | No reproducido (nº 3) |
| **A6** · entrada hostil / codificación | Un aviso y un motivo plantados en el dato, ajustados **al byte** para no mover ningún recuento. | **H-1** |
| **A7** · frontera de autorización | Sitio estático sin sesión ni endpoint propio del módulo: no hay frontera que cruzar. | No aplica (nº 7) |
| **A9** · sin JavaScript / lector de pantalla | Región con `aria-labelledby`, `<caption>`, `scope="col"`/`scope="row"`, cero `<script>`, en **seis** páginas (una por caladero y por caso: con áreas, sin áreas, con `dentro`, canaria, balear, peninsular). | No reproducido (nº 5) |
| **A11** · promesa offline | Worker instalado, puerto guardado, cobertura cortada de verdad, volver a la página. Y el caso contrario: sin guardar. | No reproducido (nº 4) |
| **A12** · el gate permeable | Cuatro derivados distintos, cada uno con **las cinco órdenes de CI** encima: aviso permisivo, motivo permisivo, relación movida de puerto, `dentro` volcado por una reproyección desviada. | **H-1, H-2, H-4** |

## Hallazgos

Cuatro reproducidos. Ordenados por lo que cuestan, no por la clase.

### H-1 · A12/A6 — la regla dura de la trayectoria es texto libre del dataset, y nadie lee lo que dice

- **Recorrido:** `tests/e2e/journeys/adversarial/a12-la-regla-dura-viaja-como-texto-libre.spec.ts`
  (2 cuerpos)
- **Bundles:** `docs/qa/bundles/t21-adversario/ec226a87d13e/FAILURE.md` (el aviso) ·
  `docs/qa/bundles/t21-adversario/b421a226e07e/FAILURE.md` (el motivo)

La sección publica dos frases que **no** salen del módulo sino del dato: `fuente.aviso`, en
`<strong>`, antes de la lista y en las 153 páginas —«la regla dura de esta trayectoria», dice el
componente—, y `puertos[].motivo`, en las 10 páginas que no listan ninguna área. El componente
explica por qué el aviso viaja en el dato y no en el módulo, y el argumento es bueno; lo que no hay
es nadie que lea lo que trae.

Lo que se comprueba sobre esos dos campos, en todo el repositorio:

| dónde | qué mira |
|---|---|
| `areas.py` → `errores_de_cobertura` | que `fuente.aviso` sea **truthy** y que un puerto sin áreas traiga **algún** motivo |
| `modulos/areas-protegidas.ts` → `texto()` | cadena **no vacía** |
| `areas-protegidas-construido.test.ts` | `assert.match(fuente.aviso, /no autoriza a pescar/u)` y **ocho** regex de «suena a permiso» |

O sea: el filtro real de la regla dura son **ocho expresiones regulares y una subcadena**. Este
ataque escribe un aviso que **conserva** la subcadena exigida y le añade un permiso detrás:

```
Solo la declaración oficial de cada espacio define sus límites y su régimen. Que no haya un área
protegida cerca no autoriza a pescar sin licencia; con ella, en el resto no hay veda.
```

«No hay veda» no lo toca ninguna de las ocho regex (no dice «puedes pescar», ni «pesca libre», ni
«zona libre», ni «sin restricciones»), y en la boca de quien va a faenar significa exactamente lo que
la sección promete no decir nunca. Se publica **en negrita, antes de la lista, en las 153 páginas**.
Y en Valencia —uno de los diez puertos que no tienen nada que listar, que son los que más riesgo
tienen de leerse como un permiso por omisión— el motivo plantado se publica igual:

> Ninguna a menos de 30 km de este puerto. *ninguna área marina protegida de RAMPE 2025 tiene su
> borde a menos de 30 km de este puerto, y el puerto tampoco cae dentro de ninguna, **así que por
> este concepto no hay ninguna limitación que consultar antes de salir de este puerto.***

Los dos textos van ajustados **al byte** —el aviso ocupa los mismos 186 bytes que el publicado, el
motivo es más largo que el suyo— por un motivo que es medio hallazgo en sí mismo: en el primer
intento lo único que se puso rojo en toda la escalera fue

```
assert.equal(mayor.bytes, 4925);   // areas-protegidas-construido.test.ts
```

un recuento de bytes de la sección de Guía de Isora, que no lee nada. Ajustadas las longitudes, con
el fichero mutado en su sitio y **las órdenes que corre CI**:

| orden | salida |
|---|---|
| `pnpm --filter web build` | **0** |
| `pnpm test` | **0** |
| `python run.py check` | **0** (imprime «✓ los 153 puertos declaran sus áreas protegidas») |
| `python -m pytest tests -q` | **1851 passed** |
| `ruff check .` | **0** |

### H-2 · A12 — «todas las áreas a menos de 30 km» está sostenido por un total, y el total se conserva moviendo una fila de puerto

- **Recorrido:** `tests/e2e/journeys/adversarial/a12-una-relacion-real-puede-desaparecer-de-su-puerto.spec.ts`
- **Bundle:** `docs/qa/bundles/t21-adversario/867abe4ad2f7/FAILURE.md`

`errores_de_cobertura` recalcula el resumen **desde el contenido** (`resumen_de(puertos)`) y lo
compara con el publicado. Es la decisión correcta contra un resumen tecleado —lo dice su propio
docstring— y a la vez significa que **un fichero al que le falte una relación, con el resumen al día,
es un fichero coherente**. `errores_de_divergencia` compara `comparativa.relacionesPorBorde` con
`resumen.relaciones`: las dos cifras son 348 antes y después. Y del lado de la web,
`areas-protegidas-construido.test.ts` compara el HTML con **el mismo derivado que generó el HTML**
—es autorreferencial— y sólo tiene dos números propios: `assert.equal(comprobadas, 348)` y la lista
de los diez puertos vacíos.

El ataque respeta los dos. Le quita a **el Vendrell** la *Reserva marina de Masía Blanca* —su fila
más cercana, a **0,1 km**, y la única RESERVA MARINA que tiene— y le da a **Carboneras** esa misma
reserva «a menos de 28 km», cuando está a unos 700 km de allí. Las dos páginas mienten en direcciones
opuestas: una calla una reserva que tiene al lado, la otra inventa una que no existe.

Publicado, el Vendrell:

```
Área                                       Figura   Distancia aproximada
Espacio marino del Baix Llobregat-Garraf   ZEPA     a menos de 9 km
Espacio marino del Delta de l'Ebre…        ZEPA     a menos de 13 km
```

Verde: `build` 0 · `pnpm test` 0 · `run.py check` 0 · `pytest` 1851 passed · `ruff` 0.

Esto no necesita mala fe: es el modo de fallo de un artefacto que se edita a mano, se commitea, y del
que ningún gate sabe si salió de la fuente. H-4 enseña la versión que **no** se edita a mano.

### H-3 · A4 — `dentro: true` apaga la única comprobación numérica que ata una distancia al radio

- **Recorrido:** `tests/e2e/journeys/adversarial/a4-el-dentro-apaga-la-unica-cota-del-radio.spec.ts`
- **Bundle:** `docs/qa/bundles/t21-adversario/8c318add0014/FAILURE.md`

`errores_de_cobertura` **sí** mira que ninguna distancia pase del radio declarado. Lo mira así:

```python
if isinstance(distancia, int | float) and distancia > radio and not area.get("dentro"):
```

El `and not area.get("dentro")` está por el caso legítimo que documenta `criterio.dentro`: el puerto
muy metido en un área muy grande, cuyo borde queda más allá del radio. El efecto colateral es que
**`dentro` es el interruptor de la comprobación**: en cuanto vale `true`, la distancia deja de tener
techo y puede ser cualquier número finito y no negativo. Del lado de la web no hay segunda opinión
—`magnitud()` sólo exige un número finito y `distanciaEscrita()` sólo que no sea negativo—.

Poniendo la tercera fila de Alicante a 480 km con `dentro: true`, la página publica:

> ### Áreas marinas protegidas a menos de 30 km
> … Reserva marina de la Isla de Tabarca · RESERVA MARINA · **a menos de 480 km**
> *El punto de este puerto cae dentro de esta área.*

Tres afirmaciones que se contradicen entre sí. Verde: `build` 0 · `pnpm test` 0 · `run.py check` 0 ·
`pytest` 1851 passed · `ruff` 0.

### H-4 · A12 — un error de 255 m en una constante del elipsoide produce un derivado que la escalera entera da por bueno

- **Recorrido:** `tests/e2e/journeys/adversarial/a12-el-derivado-desviado-se-publica-igual.spec.ts`
- **Bundle:** `docs/qa/bundles/t21-adversario/51567cc09830/FAILURE.md`

Este no planta una mentira: **reproduce una equivocación**. Se copió `data/pipeline` a un árbol de
usar y tirar, se cambió el semieje mayor del GRS80 de `6_378_137.0` a `6_378_392.1` —**255,1 m**, un
**0,004 %**, el tamaño de una errata— y se volvió a correr la ingesta contra el ZIP de RAMPE ya
cacheado. Sólo EPSG:25830 usa GRS80; el canario (32628) va por WGS84 y no se toca.

**El gate P1 no se entera, y P1 es el gate que existe para esto.** `utm.errores_de_reproyeccion()`
devuelve **cero fallos**, y sus cinco capas explican por qué cada una:

| capa de P1 | por qué no lo ve |
|---|---|
| arco de meridiano contra cuadratura de Simpson | la cuadratura usa **el mismo** semieje: el error se cancela |
| invariantes de UTM (meridiano central, ecuador, simetría) | son independientes de la escala |
| escala de la serie | ídem |
| el punto publicado por Snyder (USGS PP 1395), tolerancia **1 m** | corre sobre **Clarke 1866**, que este error no toca |
| dos anclas geográficas, tolerancia **25 km** | 255 m está 98 veces por debajo del umbral |

`run.py check` sigue imprimiendo, palabra por palabra, *«✓ P1 · la inversa de Krüger cae donde
debe»*. Y el derivado que sale tiene **las mismas 348 relaciones**, los **mismos 143/153**, los
**mismos 10** puertos sin ninguna y `entranSoloPorElBorde` = 6, que es lo que mira P5. Pero:

- **191 de las 348 relaciones cambian de distancia.**
- **Cinco cambian de `dentro`**, que es la frase más fuerte que la sección sabe decir:

| puerto | área | publicado hoy | con el elipsoide desviado |
|---|---|---|---|
| **Níjar** | Reserva marina del Cabo de Gata-Níjar | *cae dentro* | (se calla) |
| **Elantxobe** | Espacio marino de la Ría de Mundaka-Cabo de Ogoño | *cae dentro* | (se calla) |
| **Ciutadella de Menorca** | Espacio marino del norte y oeste de Menorca | *cae dentro* | (se calla) |
| **Cabo de Palos** | Espacio marino de Tabarca-Cabo de Palos | (nada) | ***cae dentro*** |
| **O Grove** | Corredor migratorio galaico-cantábrico occidental | (nada) | ***cae dentro*** |

Medido en el `dist/`, Níjar:

```
- Reserva marina del Cabo de Gata-Níjar · RESERVA MARINA · a menos de 1 km
-   El punto de este puerto cae dentro de esta área. Lo que eso implica lo dice su declaración oficial…
+ Reserva marina del Cabo de Gata-Níjar · RESERVA MARINA · a menos de 1 km
```

Con ese fichero commiteado y **el código del repositorio intacto** —que es exactamente lo que pasa si
la ingesta se corre una vez en un entorno con una constante mal copiada, porque lo que se commitea es
el artefacto—: `pnpm --filter web build` **0** · `pnpm test` **0** · `python run.py check` **0** ·
`pytest tests -q` **1851 passed** · `ruff check .` **0**.

Dos matices que hay que decir para que la cifra sea honesta:

1. Si además se commitea el `utm.py` desviado, **pytest sí lo caza**: las anclas están fijadas a
   `abs=1e-9` grados en `tests/test_utm_reproyeccion.py`. O sea que lo que ata de verdad el elipsoide
   es un test con sus cifras medidas, **no** el gate que se anuncia como el que ata la reproyección.
   Es una diferencia entre lo que P1 promete y lo que P1 defiende, y sólo se nota mirando qué se
   pone rojo.
2. El derivado desviado tal cual **sí** movía `comparativa.mayorDiferenciaKm` de 42,2 a 42,4, y eso
   lo caza `test_el_artefacto_publicado_reproduce_la_divergencia_medida`. Basta con conservar el
   bloque `comparativa` del bueno —dos líneas de JSON, y el gate P5 no lo compara con nada que salga
   de los puertos salvo el total— para que **también** pytest quede en verde. Es la cifra medida
   arriba.

El recorrido no rehace la ingesta —el ZIP son 12 MB que no se versionan y CI no baja—: aplica los
**cinco vuelcos medidos** sobre el derivado publicado, que es la parte del cambio que se lee en la
página, y comprueba si algo se pone rojo. No se pone.

> Que un `dentro` **inventado** no lo cace nadie ya estaba visto por el verificador. Lo que este
> hallazgo añade es **de dónde sale**: no hace falta que nadie mienta.

## No reproducidos

Lo que se intentó, con qué entrada, y por qué la app aguantó. Esta lista es la mitad del informe: sin
ella una pasada estéril y una alucinada se ven igual.

1. **A1 · las 348 relaciones son consistentes entre sí, y los 10 vacíos también.** La distancia a un
   conjunto es **1-Lipschitz**: si el puerto A está a `s` km del puerto B, la distancia de los dos al
   borde de una misma área no puede diferir en más de `s`. Eso da dos falsaciones que no dependen de
   la geometría ni del código del pipeline: (a) si A publica X a `d` km y `d + s ≤ 30`, **B tiene que
   publicar X**; (b) si los dos la publican, `|d_A − d_B| ≤ s + 0,1` (la décima es el redondeo hacia
   arriba). Ejecutado sobre las **11.628** parejas de puertos y las 348 relaciones: **0 relaciones
   que falten y 0 pares incoherentes**. Los diez puertos vacíos —Alboraya, Arenys de Mar, Donostia,
   Getaria, Mataró, Melilla, Sagunto, Sevilla, Silla, Valencia— **sobreviven** a la cota (a): ninguno
   tiene un vecino que publique un área lo bastante cerca como para que a él le tocara. Lo que esto
   **no** prueba es que la fuente no traiga un área a 29 km de todos ellos a la vez; para eso hace
   falta la geometría, y ahí es donde muerde H-4.
2. **A2 · el artefacto commiteado es el que produce el código.** Reejecutada la ingesta entera desde
   el ZIP de RAMPE cacheado (`run.py areas-protegidas`, offline, 82 s) en un árbol de usar y tirar:
   el JSON resultante es **idéntico** al commiteado, campo a campo, incluidas `comparativa` y
   `censo`. No hay edición a mano en lo que hay hoy. (Que no la haya **hoy** es justo lo que H-2 y
   H-4 dicen que nadie comprueba mañana.)
3. **A5 · no hay desbordamiento visible en ninguna de las 153 páginas, ni a 320 ni a 412 px.**
   Medido sobre el `dist/` servido por HTTP, con las webfonts cargadas (`document.fonts.ready`), y
   **no** con cajas de elementos sino con los rectángulos de los **nodos de texto** —que es lo que de
   verdad se ve— comparados contra el borde derecho de la columna de contenido: **0/153** a 320 px y
   **0/153** a 412 px. Cero scroll horizontal del documento y cero desbordamiento interno de la
   tabla. El único nodo cuya tinta sale de la columna es el `<caption class="solo-lectores">` de la
   tabla, que está en `position:absolute; width:1px; overflow:hidden; clip-path: inset(50%)` y **no
   se pinta**: es el elemento por el que una medición por cajas o por `scrollWidth` da 143 páginas
   «desbordadas» que no lo están. Es, casi seguro, lo que vio la medición previa de 36 páginas a 1-7
   px; con la tinta real no queda ninguna.
4. **A11 · el aviso de lectura sin red es cierto y está condicionado.** Arnés de T-12: worker
   registrado, salida a internet cortada de verdad (`context.route` + `setOffline`). *Guardando* el
   puerto y volviendo sin cobertura, la sección **está entera** —lista, aviso de la fuente y todo—.
   *Sin* guardarlo, la navegación cae con `net::ERR_FAILED`, que es exactamente lo que la frase
   describe («**Si guardas este puerto**, esta lista se guarda con él…»). T-19 publicó aquí una
   afirmación falsa en 153 páginas; ésta no repite el error. Detalle sin consecuencia medible: el
   módulo declara `offline: { strategy: "cache-first" }` **sin `routes`**, así que `politicaDe()`
   nunca casa y la política es inerte; da igual porque la lista viaja horneada en el HTML de la
   página, que es lo que `urlsDeFavorito` guarda.
5. **A9 · la sección se lee sin JavaScript y con lector de pantalla.** Seis páginas, una por caladero
   y por caso (Vigo peninsular con un área, Valencia sin ninguna, Guía de Isora canaria con `dentro`,
   Pollença balear, Níjar dentro de una reserva, Alicante mediterráneo): región `<section>` con
   `aria-labelledby="titulo-areas-protegidas"` resuelto a un título real, `<caption>` presente,
   `scope="col"` en todas las cabeceras de columna y `scope="row"` en todas las de fila, **cero**
   `<script>` y cero manejadores en línea, cero scroll horizontal. En el caso vacío la sección **no
   desaparece**: mantiene su región y su nombre accesible.
6. **A12 · revertir la métrica al vértice sí lo caza el gate.** `comparativa_de` calcula **las dos**
   distancias por su cuenta, así que un `vecindad_de` que volviera a filtrar por el vértice dejaría
   `resumen.relaciones` en 342 con `comparativa.relacionesPorBorde` en 348, y
   `errores_de_divergencia` lo dice con todas las letras. El trinquete de dos lados de
   `DIVERGENCIA_MEDIDA_RELACIONES` funciona para lo que se escribió.
7. **A7 · no aplica.** Sitio estático, sin sesión, sin endpoint propio del módulo y sin dato por
   usuario: no hay frontera de autorización que cruzar. Nada que escalar a `seguridad`.
8. **A6 · el redondeo de la cota no miente.** `distanciaEscrita` publica
   `Math.max(1, Math.ceil(d))` sobre un `d` que el pipeline ya redondeó **hacia arriba** a la décima
   (`_decima_hacia_arriba`), así que «a menos de N km» es verdad por construcción: un área a 29,6 km
   se lee «a menos de 30 km» y una a 0,0 se lee «a menos de 1 km». Revisadas las 348 cotas
   publicadas: ninguna decimal se escapa al HTML y ninguna cota queda por debajo de su distancia.
   `kmDelRadio` usa `Math.floor` sobre un radio que hoy es exactamente `30.0`; con un radio
   fraccionario el título subestimaría el radio, pero eso no es alcanzable sin editar el pipeline.
9. **A1 · los códigos RAMPE no se contradicen entre puertos.** Las 348 relaciones nombran 78 áreas
   distintas y **ningún código aparece con dos nombres o dos figuras** distintos. Tampoco hay
   duplicados dentro de un puerto (`filasDeAreas` levantaría), ni áreas desordenadas (idem).
10. **A10 · la sección no toma de rehén a la página.** Un `tipo` desconocido, un `motivo` ausente en
    un puerto vacío o una distancia negativa **hacen fallar el build**, que es fail-safe: no se
    despliega y producción sigue sirviendo lo anterior. Lo que este pase encontró es lo contrario —lo
    que pasa **sin** fallar—, que es donde estaban los cuatro hallazgos.

## Qué escalar

Nada a `seguridad`: no hay hallazgo de la clase A7, ni secreto tocado, ni salida de datos. Los cuatro
hallazgos son de **integridad del dato publicado** y del **perímetro de los gates**, y el diseño de
la cura es del arquitecto: aquí sólo se dice dónde se manifiesta.

- H-1 · `packages/modules/protected-areas/src/…` (el texto llega intacto desde el dato) ·
  `apps/web/src/componentes/modulos/AreasProtegidas.astro:91` ·
  `data/pipeline/mareia_pipeline/areas.py` → `errores_de_cobertura`
- H-2 · `data/pipeline/mareia_pipeline/areas.py` → `errores_de_cobertura` /
  `errores_de_divergencia` · `apps/web/src/areas-protegidas-construido.test.ts:212`
- H-3 · `data/pipeline/mareia_pipeline/areas.py`, la condición
  `distancia > radio and not area.get("dentro")`
- H-4 · `data/pipeline/mareia_pipeline/utm.py` → `errores_de_reproyeccion` (las cinco capas y la
  tolerancia de 25 km de las anclas) · y, sobre todo, el hueco de arriba: **nada re-deriva el
  artefacto**

## Qué se ha arreglado, y qué queda abierto

Añadido **después** del pase, por el implementador. Lo de arriba es el informe del adversario y no
se ha tocado: esto es la respuesta.

### Arreglado, con el `test.fail()` retirado

| hallazgo | arreglo | dónde | trinquete |
|---|---|---|---|
| **H-1** | La regla dura y el «hasta dónde hemos mirado» son **constantes del módulo** (`NO_AUTORIZA_A_PESCAR`, `hastaDondeSeHaMirado`) y la sección las pinta venga lo que venga en el dato. `fuente.aviso` y `puertos[].motivo` siguen en el derivado —son su registro y sus gates los exigen— y **no llegan al HTML**. El texto publicado no cambia ni una palabra: cambia quién responde de él. | `textos.ts`, `AreasProtegidas.astro` | `a12-la-regla-dura-viaja-como-texto-libre.spec.ts` (2 cuerpos) + un gate del `dist/` que exige la constante **literal** en las 153 páginas |
| **H-3** | `proximidadDeArea` recibe el **radio que el título publica**. Si el puerto cae dentro, **no se publica cota** —la distancia al borde mide entonces lo metido que está el puerto, no lo lejos que está el área—; si está fuera y la cota pasa del radio, **levanta** y rompe el build (fail-safe). | `vista.ts` | `a4-el-dentro-apaga-la-unica-cota-del-radio.spec.ts` + 3 unitarios + un gate que lee la tinta de las 153 páginas y la compara con el número del propio título |

**Probados en rojo, comprobando antes que el sabotaje llega donde el gate mira:**

- quitando el párrafo de la regla dura y reconstruyendo, `grep -c "no autoriza a pescar"` en la
  página de Vigo da **0** y `pnpm --filter web test` cae a **241 pass / 2 fail**;
- volviendo a pintar `fuente.aviso` y `motivo` junto a las constantes, el recorrido de H-1 se pone
  en **2 failed** («la sección publica un permiso plantado en el dato»);
- revirtiendo la rama `dentro` para que vuelva a publicar cota, el recorrido de H-3 se pone rojo con
  «la sección publica una cota fuera del radio: `[30,30,2,9,480,9]`» — el 480 llega al HTML.

### Abierto, con su `test.fail()` puesto: H-2 y H-4

Los dos recorridos —`a12-una-relacion-real-puede-desaparecer-de-su-puerto.spec.ts` y
`a12-el-derivado-desviado-se-publica-igual.spec.ts`— **siguen con `test.fail()`**, y conviene decir
exactamente por qué, porque el gate nuevo **sí** ataca su causa.

El gate **P6** (`areas.errores_de_reconstruccion`, enchufado a `run.py check`) es lo que faltaba: el
único que compara el artefacto contra **la fuente** en vez de contra sí mismo. Rehace las relaciones
desde el recorte de RAMPE ya commiteado —el mismo parser, la misma `vecindad_de`, el mismo
`_area_a_json`— y las diffea campo a campo, nombre, figura, distancia y `dentro`. Precedente: **G4
de T-19**.

Pero el recorte son **7 de las 86 áreas** de RAMPE 2025, y sobre el artefacto de hoy eso son **14 de
las 348 relaciones**, en 14 puertos, y **ninguna** de las 10 que dicen «cae dentro». Commitear las 86
serían 54,8 MB. Así que:

- **lo que P6 caza**: una fila movida, una distancia retocada, un `dentro` volcado o una reproyección
  desviada, **si tocan a una de esas siete áreas**. El elipsoide desviado 255,1 m mueve **8 de las
  14** (medido, y el mismo test afirma que P1 sigue en verde mientras tanto);
- **lo que P6 no caza**: lo mismo hecho sobre cualquiera de las otras **79** áreas.

Y los dos ataques del informe caen justo ahí: la *Reserva marina de Masía Blanca* (`555552489`) de
H-2 y las cinco áreas cuyo `dentro` vuelca en H-4 (`555552486`, `ES0000490`, `ES0000521`,
`ES0000508`, `ES0000554`) **no están en el recorte**, así que sus recorridos siguen pasando y por eso
conservan el trinquete. Reproducirlos dentro del alcance de P6 sí se pone rojo, y así está escrito en
`tests/test_rampe_areas.py` (fila que desaparece, fila regalada a otro puerto, los cuatro campos de
una relación y el elipsoide desviado).

El ✓ de `run.py check` imprime las dos cifras —«las **14** relaciones de las **7** áreas del recorte
… NO cubre las otras **334** de **348**»— porque un gate parcial que no dice dónde acaba se lee como
uno completo, y entonces es peor que no tenerlo. Cerrar H-2 y H-4 del todo pide otra decisión, y no
es de código: o se versiona un recorte mayor de RAMPE, o CI baja la fuente, o el derivado deja de
commitearse. Es del arquitecto.

### Lo que no se ha tocado, a propósito

El apunte nº 2 de la revisión previa —36 de 153 páginas con la tabla fuera de la columna— **quedó
refutado** por este mismo pase (no reproducido nº 3): medido con la tinta real de los nodos de texto
son **0/153** a 320 px y **0/153** a 412 px, y lo que contaba de más era el
`<caption class="solo-lectores">`, que no se pinta. Nada que arreglar ahí.

### Medido al cerrar

`pnpm --filter web build` 0 · `pnpm test` **243 passed** · `pnpm typecheck` 0 · `pnpm lint` 0 ·
`pnpm --filter web check` 0 errores · `pnpm test:e2e` **61 passed** · `ruff check .` 0 ·
`python -m pytest tests -q` **1862 passed** · `python run.py check` 0.
