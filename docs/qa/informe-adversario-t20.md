# Informe adversario — el catálogo de especies (T-20)

- **Trayectoria:** T-20 · **PR:** #24 (`claude/T-20-catalogo-especies`, head `470cd87`) ·
  **Fecha:** 2026-08-30
- **Superficie atacada:** el módulo `species` entero (`tipos.ts`, `textos.ts`, `vista.ts`,
  `module.ts`, `index.ts`), su adaptador en la web (`apps/web/src/modulos/especies/catalogo.ts`), la
  página construida `/pesca/especies/` (`pages/pesca/especies/index.astro` +
  `estilos/especies.css`), la sección del catálogo en las **153 páginas de puerto**
  (`CatalogoDeEspecies.astro`), el derivado `data/especies/catalogo.json` (86 nombres · 115 pares
  especie–caladero · 117 tallas · 106 cifras de presencia publicadas, 9 ceros y 1 consulta no hecha),
  la **captura de WoRMS** commiteada (`data/pipeline/tests/fixtures/worms/`, 82 respuestas), y toda
  la escalera de gates: E1/E4 sobre el `dist/` (`apps/web/src/especies-construido.test.ts`) y
  E2/E3/E5/E6 + clave + cobertura + presencia en `run.py check`.
- **Entorno:** local y efímero. `dist/` construido (`pnpm --filter web build`) y servido **por HTTP**
  (nunca `file://`). Chromium de Playwright, project `movil` (Pixel 7). Pipeline en su venv, sin red.
  **Sin cloud, sin prod**: ni el diff, ni el DOM, ni el código han salido del contenedor, y ningún
  modelo externo ha revisado nada.
- **Verde de partida, remedido antes de atacar:** `pnpm lint` 0 · `pnpm typecheck` 0 · `pnpm test`
  **651 pass / 0 fail** (el comando de CI, en la raíz, sin `--filter`) · `pnpm --filter web build` 0 ·
  `pnpm test:e2e` 61 · `python run.py check` 0.
- **Reproducciones:** cinco recorridos nuevos en `tests/e2e/journeys/adversarial/` (**9 cuerpos**) +
  `utiles-especies.ts`. Los nueve llevan el **trinquete `test.fail()`**: `pnpm test:e2e` sigue en
  verde con los hallazgos abiertos (**70 passed**, 61 + 9) y se pondrá en rojo el día que alguien los
  arregle sin quitarlo. `pnpm lint`, `pnpm typecheck` y `pnpm test` siguen en 0 / 0 / 651.
- **Bundles:** `docs/qa/bundles/t20-adversario/` — nueve, uno por cuerpo, del run **en rojo** tomado
  antes de poner el trinquete.
- **Contexto asimétrico:** se ha leído **la promesa**, los contratos (`tipos.ts`,
  `normativa/v1`, `especies/v1`) y el código **para dirigir los ataques** —qué campo sale por dónde,
  qué gate mira qué—. **No** se ha leído `docs/trayectorias/T-20-plan.md`, ni el cuerpo de los
  commits del arreglo, ni la justificación del diff: ése es exactamente el modelo mental que aquí no
  hay que compartir. Las citas de comentarios que aparecen abajo son de **código publicado** y están
  porque son promesas comprobables, no porque expliquen una decisión.

## Estado de los cinco hallazgos: **CERRADOS** (2026-08-30, en este mismo PR)

Anotado aquí y no reescribiendo el informe: lo de arriba describe el `dist/` de `470cd87` y así se
queda, que es lo que hace comparable el pase. Los cinco se arreglaron **en la frontera común que el
propio informe señala** —«la comparación termina en el JSON»— y no síntoma a síntoma: `TallaDelAnexo`
tiene ahora las notas (resueltas contra `normativa/v1`, sin copiar el texto), `CatalogoDeEspecies`
tiene `sinNombreCientifico`, la columna del taxón tiene su **tercer** estado y publica el nombre del
registro al que apunta, cada fila cruza a la que publica su mismo `AphiaID`, y el motivo de no haber
preguntado a OBIS cruza como **booleano** con la frase en el código (`NO_SE_PREGUNTO_A_OBIS`).

Los **nueve cuerpos** pierden su `test.fail()` —Playwright avisó de «pasó lo que se esperaba que
fallara» en los nueve antes de retirarlo— y quedan como **gate permanente**, con sus asserts canario
donde estaban. Se suman dos gates sobre el `dist/`: **E7** (la nota **entera**, no la marca, en el
mismo bloque que la cifra, y ninguna llamada sin pie) y **E8** (toda fila del BOE fuera de la tabla,
nombrada con su motivo y su talla); los dos, y el **E4** corregido —se comparaba contra el propio
valor que vigilaba—, medidos **en rojo** contra el `dist/` anterior. El apunte del ledger sobre
`test.fail()` **sigue abierto**: es del framework, no de T-20.

## Promesa

> Mareia publica las 86 especies que el BOE regula: el nombre legal **literal**, el taxón aceptado
> hoy **con su procedencia comprobable**, el rango real —género cuando la norma regula un género—, y
> una presencia que **nunca** se lee como abundancia. Y ninguna cifra legal se contradice consigo
> misma entre dos páginas del mismo sitio.

Son cinco compromisos y el pase ataca los cinco por separado. Los cinco hallazgos se reparten así:

| Compromiso | Estado tras el pase |
|---|---|
| el nombre legal literal | **aguanta** (E1 lo mide bien; ver *No reproducidos* nº 4) |
| el taxón aceptado hoy, con procedencia comprobable | **roto** — H-2, H-3 |
| el rango real (género cuando la norma regula un género) | **aguanta** (E3 lo mide de verdad; nº 5) |
| la presencia nunca se lee como abundancia | **roto por una rendija** — H-5 |
| ninguna cifra legal se contradice entre dos páginas | **roto** — H-1, H-4 |

**El eje que atraviesa H-1 y H-4** conviene leerlo antes que ninguno: los dos gates nuevos (E5 y E6)
cierran el hueco **dentro del JSON** —rehacen el dataset desde la norma y desde la captura y lo
diffean campo a campo—, y lo hacen bien: comprobado aparte, una lectura **independiente** de
`tallas-minimas.json` reproduce los 115 pares publicados campo a campo (nº 2). Pero la comparación
**termina en el JSON**. Entre el dataset y la página hay un contrato (`TallaDelAnexo`,
`EspecieEnCaladero`) que **no tiene campo** para tres cosas que el dataset sí trae —las `notas` de
la talla, la fila `sinNombreCientifico`, el `nombreLocalCanario`— y un adaptador que no las lee. Lo
que se cae, se cae **después** del último gate, y ahí no mira nadie: el gate E1 mira nombres y el E4
mira cifras de presencia.

## Clases atacadas

| Clase | Qué se intentó, con la entrada concreta | Resultado |
|---|---|---|
| **A1** · doble envío | Doble pulsación simultánea (`Promise.all`) sobre una opción del filtro. | No reproducido (nº 7) |
| **A2** · estado stale / botón atrás | Filtrar → atrás → adelante → recargar, contando filas visibles en cada paso (86 → 31 → 86 → 31 → 31). | No reproducido (nº 7) |
| **A4** · el registro que miente | ¿Dice la página algo que la fuente no ha dicho? Se recomputa `consultadoComo` contra el nombre del BOE y se lee la celda del taxón de las 86 filas. | **H-2** |
| **A5** · límites 0 / N-grande, maquetación | Ancho de tinta a **320 y 360 px** en tres páginas (índice, índice filtrado, puerto); y cinco fragmentos hostiles en la URL buscando el estado «no se ve ninguna especie». | No reproducido (nº 1 y nº 6) |
| **A6** · entrada hostil / texto libre del dato | Afirmación de ausencia plantada en el único texto de la columna de presencia que sale del JSON, con build efímero y los siete gates del pipeline encima. | **H-5** |
| **A7** · frontera de autorización | Sitio estático, sin sesión, sin endpoint propio del módulo y sin mutación: **no hay frontera que cruzar**. Nada que escalar a `seguridad`. | No aplica |
| **A8** · sesión y caducidad | Ídem: no hay sesión ni formulario que caduque. La única caducidad del sitio (sello de vigencia del BOE) es de T-19 y ya tiene su recorrido. | No aplica |
| **A9** · callejón sin salida / sin JavaScript | Filtro con JS **deshabilitado** (funciona: 31 de 86 visibles) y estructura de la página con lector de pantalla. | No reproducido (nº 6) |
| **A10** · feedback ausente | Con el filtro puesto, qué dice la página de sí misma (h1, `<caption>`, cuentas de las opciones). | No reproducido (nº 8) |
| **A11** · reversibilidad / promesa offline | ¿Es cierto que «el catálogo no se guarda con este puerto»? Se comprueba contra el `sw.js` publicado. | No reproducido (nº 3) |
| **A12** · la promesa vs lo entregado | Cuatro frentes: la talla contra su excepción, la fila 118 del BOE, el mismo taxón en dos filas, y la falsificación coherente de captura+dataset. | **H-1, H-3, H-4** |

## Hallazgos

Cinco reproducidos, nueve cuerpos en rojo. Ordenados por lo que cuestan, no por la clase.

---

### H-1 · La cifra legal del catálogo se publica sin la excepción que la cambia; la página de puerto sí la publica

- **Clase:** A12 (con A4 dentro: la página imprime la llamada al pie y no publica el pie)
- **Recorrido:** `tests/e2e/journeys/adversarial/a12-la-talla-legal-sin-la-excepcion-que-la-cambia.spec.ts`
- **Bundles:** `docs/qa/bundles/t20-adversario/707c73d79bad/` (cuerpo 1) ·
  `docs/qa/bundles/t20-adversario/99cfcdce5d9b/` (cuerpo 2)

El RD 560/1995 le cuelga notas al pie a tres cifras que el catálogo publica. Las notas están en el
dataset (`caladeros[].tallas[].notas`), **E5 las diffea campo a campo** y pasan. Y no llegan a la
página, porque el contrato del módulo no tiene dónde ponerlas.

| Especie | Caladero | El catálogo dice | La norma añade | La página de puerto dice |
|---|---|---|---|---|
| `Dicentrarchus labrax` | Cantábrico–NO–Cádiz | «36 cm» | **(\*\*\*)** «Excepto en las divisiones 8a y 8b del CIEM, tanto para la pesca profesional como para la recreativa, en las que la talla mínima es de **44 centímetros**» | las dos cosas |
| `Engraulis encrasicholus` | Cantábrico–NO–Cádiz | «12 cm» | **(\*\*)** «Excepto en la división IX, a), en la que la talla mínima es de **10 centímetros**» | las dos cosas |
| `Octopus vulgaris` | Mediterráneo | «1 kg de peso» | **(\*)** «no es de aplicación en las aguas interiores y la plataforma continental de la Comunidad Autónoma de las **Illes Balears**» | las dos cosas, **y** si ese puerto está dentro o fuera |

El caso del pulpo es el peor porque no deja rastro: el literal que la fila cita es «1 kg», sin marca,
así que quien lea el catálogo no tiene forma de sospechar que en Baleares esa cifra no rige. La misma
web se lo cuenta en la página de Arenys de Mar, con la nota entera y una frase de interpretación
(«En este puerto sí se aplica: la excepción es solo para Illes Balears»).

En los otros dos casos la marca **sí** viaja —«el BOE imprime «36 (\*\*\*)»»— y la página **no publica
ningún pie en ninguna parte**: dos llamadas huérfanas. La propia página señala que ahí falta algo y
luego no hay nada. Es el segundo cuerpo del recorrido.

- **Dónde se manifiesta:** `packages/modules/species/src/tipos.ts:TallaDelAnexo` y
  `vista.ts:TallaDeLaFila` no declaran las notas; `apps/web/src/modulos/especies/catalogo.ts:232`
  (`leerTallaDelAnexo`) no las lee. *(Señalar dónde se ve no es proponer el arreglo: el diseño es del
  arquitecto.)*
- **Por qué ningún gate lo ve:** E5 compara JSON contra JSON, y ahí las notas están. E1 mide nombres.
  E4 mide cifras de presencia. La frontera dataset→página no la mide nadie para este campo.
- **Observación de la misma familia, sin promoverla a hallazgo:** `nombreLocalCanario` («Agujón»
  para `Belone belone`) también viaja en el dataset, se publica en las páginas de puerto canarias y
  desaparece en el catálogo. No rompe la promesa —no es una cifra legal—, pero es exactamente la
  misma frontera.

---

### H-2 · Veinte filas le atribuyen a WoRMS una frase que WoRMS no ha dicho

- **Clase:** A4
- **Recorrido:** `tests/e2e/journeys/adversarial/a4-worms-no-acepta-el-nombre-que-la-fila-le-atribuye.spec.ts`
- **Bundles:** `docs/qa/bundles/t20-adversario/a6923d65f758/` (cuerpo 1) ·
  `docs/qa/bundles/t20-adversario/a7c519970543/` (cuerpo 2)

La columna «Taxón aceptado hoy» tiene **tres** estados posibles y sólo dos están modelados
(`MISMO_NOMBRE` y `remiteA`). Falta el tercero, que son 22 de las 86 filas: **a WoRMS no se le
preguntó ese nombre**, porque el de la norma no resuelve y fuimos nosotros quienes decidimos qué
preguntarle. En 20 de esas 22 el módulo cae en la rama «acepta el nombre de la norma»:

- `Cáncer pagurus` → «**WoRMS acepta el nombre de la norma.**» y, dos líneas más abajo **en la misma
  celda**, «Correspondencia nuestra, no de WoRMS: el género es «Cancer»: el latín no lleva la tilde
  que imprime la norma». La celda se contradice a sí misma.
- `Sepia spp` → «WoRMS acepta el nombre de la norma.» sobre un nombre que no existe en WoRMS (se
  preguntó «sepia»). Igual en las 15 filas de género.
- `Thunnus aibacares` → «WoRMS acepta el nombre de la norma.» sobre un binomio que no nombra a ningún
  animal (se preguntó «thunnus albacares»).

El segundo cuerpo mide la consecuencia, que es la que rompe la promesa de la **procedencia
comprobable**: en las **6 erratas**, el binomio que WoRMS sí devolvió no aparece **en ninguna parte
de la fila**.

| Fila del BOE | AphiaID publicado | Nombre de ese registro | ¿Está en la fila? |
|---|---|---|---|
| `Cáncer pagurus` | 107276 | `Cancer pagurus` | no |
| `Gliptocephalus cynoglossus` | 127136 | `Glyptocephalus cynoglossus` | no |
| `Melanogrammús aeglefinus` | 126437 | `Melanogrammus aeglefinus` | no |
| `Microstommus kitt` | 127140 | `Microstomus kitt` | no |
| `Panaeux kerathurus` | 246388 | `Penaeus kerathurus` | no |
| `Thunnus aibacares` | 127027 | `Thunnus albacares` | no |

El enlace va rotulado «**Ficha del nombre de la norma en WoRMS** · AphiaID 107276», que es la
atribución al revés: la ficha es del nombre **corregido**, no del de la norma. Quien quiera comprobar
la fila tiene que salir del sitio para saber a qué taxón apunta el identificador que está leyendo —
que es justo lo que esa columna existe para evitar.

- **Dónde se manifiesta:** `packages/modules/species/src/vista.ts:taxonDeLaFila` (la rama
  `aceptado === null → MISMO_NOMBRE`) sobre el colapso que hace
  `apps/web/src/modulos/especies/catalogo.ts:leerTaxon` (`aceptado.nombre === nombre → null`).
- **Por qué E1 no lo ve:** mide que el nombre del BOE esté literal (lo está) y que en las 11 filas con
  aceptado **distinto** se publiquen los dos (se publican). Estas 20 no son de esas 11 según el
  dataset, porque en ellas el aceptado coincide con el nombre **resuelto** — no con el de la norma.

---

### H-3 · La misma especie está dos veces, con dos grafías del BOE, y ninguna fila lo dice

- **Clase:** A12
- **Recorrido:** `tests/e2e/journeys/adversarial/a12-la-misma-especie-partida-en-dos-filas.spec.ts`
- **Bundles:** `docs/qa/bundles/t20-adversario/33065439f669/` (cuerpo 1) ·
  `docs/qa/bundles/t20-adversario/7a7b9b7e2da8/` (cuerpo 2)

La clave con digest resuelve bien el problema **como identificador**: `Thunnus thynnus` y
`Thunnus Thynnus` son dos filas y dos claves, ninguna se come a la otra. Lo que no está resuelto es
lo que ve quien lee. Tres registros de WoRMS se publican **en dos filas cada uno**, con el mismo
`AphiaID`, el mismo enlace y el mismo nombre común:

| AphiaID | Filas | Caladeros de cada una |
|---|---|---|
| 127029 | `Thunnus thynnus` · `Thunnus Thynnus` | Cantábrico + Mediterráneo · **Canario** |
| 127027 | `Thunnus albacares` · `Thunnus aibacares` | Cantábrico · **Canario** |
| 126032 | `Mugil spp` · `Mugil spps` | Cantábrico · Mediterráneo |

La consecuencia no es estética: quien busque el atún rojo por el nombre que la ciencia acepta
—`Thunnus thynnus`, que es además el que escriben los Anexos I y II— encuentra una fila que publica
**dos** caladeros y ningún aviso. De ahí se sigue que en Canarias esa especie no tiene talla mínima.
La tiene: **6,4 kg**, Anexo III, en la fila de al lado, bajo la `T` mayúscula que imprimió el BOE.

El segundo cuerpo lo mide desde donde entra el lector de verdad —el enlace de las 153 páginas de
puerto, que abre el catálogo ya filtrado—: con el filtro canario puesto, el binomio que WoRMS acepta
para el atún rojo (`Thunnus thynnus`) y para el rabil (`Thunnus albacares`) **no está a la vista en
ninguna fila**; está en las que el CSS esconde. Siete taxones quedan así en los tres caladeros.

---

### H-4 · La fila 118 del BOE desaparece del catálogo, y el catálogo dice que no falta ninguna

- **Clase:** A12
- **Recorrido:** `tests/e2e/journeys/adversarial/a12-la-fila-que-el-boe-regula-y-el-catalogo-calla.spec.ts`
- **Bundles:** `docs/qa/bundles/t20-adversario/17f423ce6f10/` (cuerpo 1) ·
  `docs/qa/bundles/t20-adversario/18b0723bf1c6/` (cuerpo 2)

La entradilla del catálogo dice:

> «La lista la fija el BOE: **ni sobra ninguna ni falta ninguna por decisión nuestra**.»

Y falta una por decisión nuestra. El Anexo I le fija **3,7 cm** a «Cigalas (colas)», y esa fila no
entra en el catálogo porque la norma no escribe ahí ningún binomio. La decisión está tomada **y
razonada**: el dataset la guarda en `sinNombreCientifico` con su motivo («la norma escribe «Cigalas
(colas)» y ahí no hay ningún nombre latino entre paréntesis; no se infiere»), el resumen la cuenta
(`filasSinNombreCientifico: 1`) y `run.py check` la nombra. Lo único que no pasa es que **llegue a la
página**: el adaptador no la lee y la plantilla no la pinta.

Eso deja el catálogo incumpliendo la doctrina que su propio código repite campo por campo —*una
ausencia dice por qué lo es, o no se distingue de un fallo nuestro*— justo donde la ausencia tiene
consecuencia legal: son **tres** medidas del mismo animal en el mismo anexo (cefalotórax 2 cm,
longitud total 7 cm, colas 3,7 cm) y el catálogo publica dos, sin decir que hay una tercera.

El segundo cuerpo lo recorre entre las dos superficies: la página de Vigo publica «Cigalas (colas) ·
3,7 cm» y, unos párrafos más abajo, enlaza al catálogo; se sigue el enlace y la fila no está, ni
nombrada ni explicada.

---

### H-5 · La regla dura de la trayectoria la sostienen dos constantes del código… y una cadena del JSON

- **Clase:** A6 (con A12 detrás: es el hallazgo H-1 de T-21 en otro campo)
- **Recorrido:** `tests/e2e/journeys/adversarial/a6-la-unica-frase-de-presencia-que-viaja-en-el-dato.spec.ts`
- **Bundle:** `docs/qa/bundles/t20-adversario/0326e106f80a/`

El módulo lo dice en su cabecera, y es la lección que se pagó en T-21:

> «**Y por eso ninguna de las dos frases duras viaja en el dataset** … `SESGO_JUNTO_A_LA_CIFRA` y
> `LA_CAJA_NO_ES_LA_COSTA` son **constantes del código**.» (`species/src/textos.ts`)

Las dos lo son, y bien. Pero la columna de presencia tiene **tres** salidas, no dos, y la tercera —la
del silencio «no se llegó a preguntar»— es `presenciaAusente`, una cadena del JSON que la vista
imprime tal cual:

```ts
presencia: caladero.presencia === null ? (caladero.presenciaAusente ?? SIN_REGISTROS) : …
```

Lo único que la vigila es que **exista**: `errores_de_presencia` comprueba `.strip()` no vacío. Y E4
no la ve, porque su patrón es `\d+ registros?` y una frase sin cifra no lo dispara.

**Medido.** Se sustituye esa cadena por «Sin registros: OBIS confirma que la especie no está presente
en este caladero.» en un `data/` efímero y se construye el sitio con `MAREIA_DATA_DIR`:

| Gate | Resultado |
|---|---|
| `errores_de_cobertura` + E2 + E3 + clave + presencia + E5 + E6 | verde, **0 problemas** |
| `astro build` | verde, código 0 |
| La página `/pesca/especies/` | **publica la frase**, en la columna de presencia |

Es una afirmación sobre lo que hay o no hay en el mar, publicada en la columna que existe para
impedir exactamente eso, y sobre la única fila del catálogo a la que **no se le preguntó nada** a
OBIS. Hoy esa cadena dice la verdad; lo que este recorrido demuestra es que nada la obliga a decirla.

## No reproducidos

Ocho. Cada uno con la entrada concreta que se probó y por qué la app aguantó. Sin esta lista, una
pasada estéril y una alucinada se ven igual desde fuera.

1. **Desbordamiento a 320 px (A5).** Era la sospecha más fuerte de partida —la tabla tiene tres
   columnas, párrafos largos dentro de celdas y binomios sin espacios, y en T-19 se escapó un
   desbordamiento en 80 puertos por medir una sola página—. Medido en **tres páginas y dos anchos**
   (índice, índice filtrado por `#cal-mediterraneo`, página de puerto; 320 y 360 px), por el borde
   derecho de **todos** los elementos del `body`, no por `scrollWidth` de la sección:
   `scrollWidth == clientWidth` en los seis casos y **cero culpables**. La cura de H-5 de T-11
   (`overflow-wrap: anywhere` en `th`/`td`) está puesta y funciona, y `.tabla-especies__talla` no
   lleva el `nowrap` que rompió los 80 puertos mediterráneos.
2. **La reconstrucción de E5 se cancela sola (A12).** La hipótesis: E5 rehace la talla con
   `caladeros_del_boe`, que es **la misma función que publica**, así que un fallo *en esa función* se
   confirmaría a sí mismo. Se escribió una lectura **independiente** de `tallas-minimas.json` (30
   líneas, sin importar nada de `especies.py`) y se diffearon los 115 pares publicados campo a campo,
   `notas`, `procedencia`, `medida` y `nombreLocalCanario` incluidos: **ninguna diferencia**. Hoy la
   autoconfirmación no esconde nada. Sigue siendo un riesgo estructural, no un hallazgo.
3. **La promesa offline (A11).** La sección de puerto afirma «el catálogo no se guarda con este
   puerto: aunque lo tengas en favoritos, este enlace necesita cobertura». Se comprobó contra el
   `sw.js` publicado: no menciona `/pesca/especies` por ninguna parte. La frase es **verdad**, que es
   lo contrario de lo que pasó en T-19 (H-4, una frase que prometía lo que el precacheo no hacía).
4. **El aceptado leyéndose como el legal (E1).** Se recorrieron las **11 filas** donde los dos nombres
   difieren buscando un camino por el que el aceptado se leyera como el de la norma: el nombre del BOE
   está en `<th scope="row">` y primero, el aceptado va en la segunda columna, y la frase que los une
   («WoRMS registra este nombre como «unaccepted» y **remite a** X») usa un verbo que no corrige a la
   norma. E1 lo mide sobre el `dist/` con el literal, tilde imposible incluida. Aguanta. *(El fallo
   está en la dirección contraria: H-2.)*
5. **El género convertido en especie (E3).** Se intentó colar un binomio por un campo que el gate no
   mirase: E3 recorre **todas** las cadenas de la ficha, no una lista de campos, así que un
   `nombresComunes: ["Chirla (Venus verrucosa)"]` cae igual. Y `Mugil spps` —la errata del Anexo II—
   se reconoce como género. Las 15 filas publican rango género y ninguna nombra una especie concreta.
   Aguanta. *(Lo que sí se rompe es la lectura de esas filas: H-2.)*
6. **El filtro sin JavaScript y con la URL manipulada (A5/A9).** Se buscó el estado «no se ve ninguna
   especie y parece que no hay». Cinco fragmentos: `#cal-noexiste`, `#titulo-filtro` (un `id` real de
   otra cosa), `#cal-todas`, `#` y `#cal-canario#cal-mediterraneo` (dos filtros a la vez) → **86 filas
   visibles en los cinco**. Con JavaScript **deshabilitado** y `#cal-canario`, 31 de 86. `:target`
   sólo puede casar un ancla, y la regla que esconde cuelga de anclas escritas a mano en la hoja, así
   que un fragmento inventado no esconde nada. Estructura para lector de pantalla: `lang="es"`,
   `<caption>`, `scope` en los 4 `th`, 0 enlaces sin nombre accesible, 0 `img` sin `alt`, y el único
   `<script>` es `application/ld+json`.
7. **Doble pulsación y botón atrás (A1/A2).** Dos clics simultáneos (`Promise.all`) sobre la opción
   del filtro: 31 filas y la misma URL, idempotente. Filtrar → atrás → adelante → recargar:
   86 → 31 → 86 → 31 → 31. No hay mutación, no hay servidor y el único estado es el fragmento.
8. **La cabecera no cambia al filtrar (A10).** Con 31 filas a la vista, el `h1` y el `<caption>` siguen
   diciendo «Las 86 especies que el BOE regula». Se consideró y **no se promueve**: 86 es una
   propiedad del catálogo y no de la vista, la nota del filtro dice explícitamente qué esconde, y la
   opción activa lleva su cuenta (31) y su filete. Se deja anotado porque es lo que un lector de
   pantalla oye antes de recorrer una tabla que ya no tiene 86 filas.

### Un límite que se midió y **no** se cuenta como hallazgo

E6 declara en su propia docstring que no puede cazar «que la captura y el dataset se falsifiquen
juntos». Se comprobó que es literalmente así: falsificando la respuesta capturada de `conger conger`
(AphiaID → 126425, `scientificname` → `Sardina pilchardus`) **y** rehaciendo el bloque `taxon` del
dataset desde esa misma captura con `_taxon_a_json`, **los siete gates del pipeline dan verde** y el
catálogo publicaría la anguila congrio como sardina. No es un hallazgo —el gate lo declara, es el
mismo límite que G4 y P6, y un gate offline no puede tener otro— pero conviene que quede escrito
**dónde queda el ancla**: `tallas-minimas.json` se ancla contra la captura del BOE, y la captura del
BOE contra el BOE; la captura de WoRMS no se ancla contra nada más que contra sí misma. Se registró
también que la cobertura es completa: **82 ficheros de captura = 82 consultas distintas**, ninguna
falta, y cubren las 85 filas resueltas (tres consultas están compartidas por dos grafías del BOE) más
la única a la que no se preguntó. Borrar un fichero pone E6 en rojo nombrando la fila.

## Apunte para el ledger — `test.fail()` es fail-open ante *cualquier* fallo

No es de T-20; es del trinquete, y se ha mirado en estos nueve cuerpos porque el verificador lo pidió.

`test.fail()` se conforma con que el test falle **por el motivo que sea**. Un `ENOENT` porque alguien
renombró `data/especies/catalogo.json`, un selector podrido, un `webServer` que no levanta, un
`timeout`: los cinco cuentan como «el fallo esperado» y el recorrido sale **verde** sin haber medido
nada. Un hallazgo así se pudre sin avisar, y el día del arreglo nadie se entera porque el test ya
«pasaba».

Los nueve cuerpos de este pase llevan, **antes** del assert del hallazgo, al menos un assert que
falla por causas distintas y que hace de canario:

- `expect(conExcepcion.length).toBeGreaterThan(0)` — «ninguna cifra del catálogo lleva excepción en
  la norma: el ataque no está midiendo nada».
- `expect(noSePreguntaron.length).toBeGreaterThan(0)`, `expect(parejas.size).toBeGreaterThan(0)`,
  `expect(fuera.length).toBeGreaterThan(0)`, `expect(erratas.length).toBeGreaterThan(0)`.
- En H-5, además, los gates del pipeline sobre el dataset **limpio** tienen que salir en `[]` antes de
  atacar, y el build efímero tiene que devolver 0.

Eso **reduce** el problema y no lo resuelve: si el fallo es un `ENOENT` al leer el dataset, revienta
antes del canario y `test.fail()` se lo traga igual. La distinción «falló por el defecto» vs «falló
por otra cosa» **no la puede hacer `test.fail()` solo**: lo único que hoy la hace es leer el
`FAILURE.md` del bundle, y el bundle **no se escribe** cuando el fallo era el esperado. Es decir:
mientras el hallazgo está abierto, la razón exacta por la que falla deja de registrarse.

Lo que se propone anotar en el ledger (no es una petición a T-20; es del framework):

- **Fecha de cada hallazgo abierto**, para releerlo en vez de confiarlo — ya está en la skill y aquí
  se cumple: los nueve son de 2026-08-30.
- **El canario como convención**, no como costumbre: todo cuerpo con trinquete abre con un assert de
  «esto está midiendo algo», y el informe lo cita.
- **Lo que falta y hoy no existe**: un modo del fixture `qa-bundle` que **también** selle bundle
  cuando `status === expectedStatus`, aunque sea reducido (mensaje del assert y su línea). Con eso, un
  hallazgo que empieza a fallar por otro motivo se ve en el diff del bundle. Sin eso, el trinquete
  garantiza que el hallazgo queda *ejecutable*, pero no que siga *midiendo*.

## Cómo se reproduce todo esto

```bash
pnpm install && pnpm --filter web build         # el dist/ es lo que se ataca
pnpm test:e2e                                   # 70 passed (61 + 9 con trinquete)

# los nueve cuerpos en ROJO, que es como nacieron los bundles: quitar `test.fail()` y
npx playwright test tests/e2e/journeys/adversarial/a12-la-talla-legal-sin-la-excepcion-que-la-cambia.spec.ts
npx playwright test tests/e2e/journeys/adversarial/a4-worms-no-acepta-el-nombre-que-la-fila-le-atribuye.spec.ts
npx playwright test tests/e2e/journeys/adversarial/a12-la-misma-especie-partida-en-dos-filas.spec.ts
npx playwright test tests/e2e/journeys/adversarial/a12-la-fila-que-el-boe-regula-y-el-catalogo-calla.spec.ts
npx playwright test tests/e2e/journeys/adversarial/a6-la-unica-frase-de-presencia-que-viaja-en-el-dato.spec.ts
```
