# Informe adversario — España completa, 153 puertos (T-13)

- **Trayectoria:** T-13 · **PR:** #16 (`claude/T-13-stations-full-spain`) · **Fecha:** 2026-08-29
- **Superficie atacada:** el catálogo publicado (153 estaciones en `data/stations/`, `data/geo/ports.json`),
  las 192 páginas del `dist/` construido, los avisos nuevos (`AvisoEstimado.astro`,
  `Transparencia.astro`, `datos/pagina-puerto.ts`) y **los gates que T-13 dejó vigilando el dataset**:
  el detector de curva congelada (A-1 de T-09, re-apuntado en esta trayectoria) y el invariante
  «ningún puerto publica una precisión que no tiene» de `packages/adapters/src/__tests__/dataset.test.ts`.
- **Entorno:** local y efímero, **cero red**. `pnpm --filter web build` sin `BUILD_DATE` (día UTC
  2026-08-29, 192 páginas en 15,4 s) + el dataset committeado. Sin cloud: ni el diff, ni el DOM, ni el
  código han salido del contenedor, y no se ha usado ningún modelo externo para revisar nada.
- **Reproducciones:** `apps/web/src/adversario-t13.test.ts` — 1 premisa en verde + 4 hallazgos con
  trinquete `hallazgoAbierto()`.
- **Estado (2026-08-29, tras el arreglo):** **A-17, A-18 y A-19 cerrados**, sus recorridos en verde y
  **sin `hallazgoAbierto()`**: quedan como gate permanente. Cada arreglo se comprobó **en rojo
  revirtiéndolo** antes de retirar el trinquete; el detalle, en el CHANGELOG y en cada hallazgo.
  **A-20 sigue abierto** con su trinquete puesto, escalado al rol `seguridad`.
- **Bundle:** `docs/qa/bundles/t13-adversario/FAILURE.md` (+ `run-sin-test-fail.tap`), nacido del run
  **sin** trinquete, que es donde está la evidencia.
- **Contexto asimétrico:** se ha leído la **promesa** (`docs/trayectorias/T-13-plan.md`, el schema
  `station/v1`, los contratos de validación) y los **artefactos** (dataset + `dist/`). El código se ha
  leído para *dirigir* los ataques —dónde nace la curva, qué mide cada gate, qué campo alimenta cada
  aviso—, nunca para juzgarlo. El diff del PR y su justificación no se han abierto.

## Promesa

**Un puerto no publica una precisión que no tiene.** Escalar de 12 a 153 puertos no es escalar la
lista: es escalar la honestidad del QC. Los 120 puertos que toman prestadas las constantes de otro
mareógrafo van marcados `estimado` y **lo dicen en su página**, no sólo en el JSON; el error que se
publica es el que se midió *aquí*; y el grade se gana por exactitud, nunca por redondeo.

Lo que el `verificador` y el rol `qa` ya cubrieron —los 120 avisos están, los invariantes muerden a
escala, el sitio construye— aguanta y así se dice más abajo. Lo que quedaba sin atacar es **la otra
mitad de la promesa: quién vigila a los vigilantes**. T-13 no publica sólo 153 páginas: publica los
gates que garantizan que esas páginas no mienten. Tres de los cuatro hallazgos son de ahí.

## Clases atacadas

| Clase | Atacada | Resultado |
|---|---|---|
| **A5** · límites 0/1/N | Sí — 153 puertos, 103 con meseta natural, 8 109 días-puerto, 365 días de calendario | **A-17** |
| **A6** · input hostil | Sí — formato de cifras, locale, slugs derivados de GeoNames, apóstrofos y acentos en URL | **A-19** |
| **A9** · callejón sin salida | Sí — 191 URLs del sitemap, índices de región/provincia, enlaces desde portada | sin hallazgo |
| **A12** · la promesa vs lo entregado | Sí — la procedencia del dato, el golden, los avisos, lo que ve quien llega desde un buscador | **A-18**, **A-20** + 3 juicios |
| **A3** · fallo parcial | Parcial — el dataset con campos ausentes/`null` contra `JsonReader` | sin hallazgo |

**Descartadas, con motivo** (un descarte silencioso parece cobertura):

- **A1** (concurrencia y doble envío), **A2** (estado stale y botón atrás), **A4** (idempotencia y
  reintento), **A11** (reversibilidad): el portal es **estático y de sólo lectura**. No hay formulario,
  no hay mutación, no hay acción destructiva. La superficie de T-13 es un pipeline de datos y 192
  ficheros HTML.
- **A7** (frontera de autorización) y **A8** (sesión y caducidad): no hay usuarios, ni sesión, ni
  cookie, ni recurso privado. Todo el sitio es público y anónimo por diseño. **A-20 se escala igualmente
  al rol `seguridad`** como integridad de procedencia del dato publicado, que es la clase de riesgo que
  sí existe aquí.
- **A10** (feedback ausente): T-11 ya la atacó sobre la única superficie con latencia del portal (la
  isla meteo) y T-13 no la toca.

## Hallazgos

> Los cuatro cuerpos afirman **el comportamiento correcto**, no el síntoma, y van envueltos en
> `hallazgoAbierto()`: CI sigue verde con los hallazgos abiertos —imprimiendo el motivo como
> diagnóstico en cada run— y se pondrá **rojo el día que alguien los arregle**, pidiendo que se retire
> el trinquete. A partir de ahí, cada ataque es gate permanente.

### A-17 · el detector de curva congelada sólo mira **una** meseta por día · clase A5 · **alta**

El gate A-1 —el que promete que «la curva no se congela en ningún puerto del catálogo»— pregunta por
la meseta **más larga** del día y sólo mide dentro de ésa. Por construcción, cualquier congelación
más corta que la meseta natural del puerto le es invisible, por mucha marea que se trague: **la
meseta natural funciona de escondite**.

Con el catálogo de T-13 el escondite es enorme, y lo es *por culpa de T-13*: la mayoría del
Mediterráneo incorporado en esta trayectoria tiene mesetas naturales de decenas o cientos de minutos,
porque su carrera del día es de milímetros y la curva se publica al milímetro. Con 12 puertos casi no
había mesetas; con 153 hay 103.

- **Medido (2026-08-29, 153 puertos):** 103 tienen meseta natural y en **65 (42,5 % del catálogo)**
  cabe una congelación real invisible.
- **Testigo:** el golfo de Valencia — **Valencia, Alboraya, Silla y Sueca**: meseta natural de
  **200 min** que esconde una congelación de **190 min** con **62,06 mm** de movimiento real
  suprimido. Sesenta y dos veces el paso de publicación de 1 mm que el propio gate usa de umbral.
- **La avería que esto deja pasar es la que le da nombre al hallazgo A-1**: una pleamar dibujada
  plana. En Valencia caben 190 min de curva falsa sin que el gate levante la mano.

Y la trampa de la que hay que salir: el fallo anterior de este gate fue **medir en las puntas de la
meseta** en vez de dentro (Gijón, 670 min con 3 283,7 mm de movimiento real, en verde). Aquello se
arregló mirando dentro. Lo que queda ahora **no es dónde se mide sino cuántas mesetas se miden**: el
instrumento mide bien un tramo y el día tiene muchos.

- **Repro:** `A-17 · ninguna congelación real de la curva se le escapa al detector`.
- **Estado:** **CERRADO** (trinquete retirado; el recorrido es gate permanente)
- **Arreglo:** el detector recorre **todas** las mesetas del día (`tramosPlanos`) en vez de preguntar
  por la máxima. Ni el umbral ni el sitio donde se mide cambian: cambia **cuántas veces se mide**.
  Comprobado que muerde: con la congelación de Valencia inyectada en la curva real, el gate la caza
  con **61,8 mm** y el instrumento viejo, con el mismo fraude delante, se queda verde. Margen medido
  sobre 1 224 días-puerto y 6 526 mesetas: excursión máxima legítima **0,993 mm**.
- **Corrección posterior (rechazo del `verificador`, mismo PR):** este recorrido medía con una
  **copia local** del detector, así que no trinqueteaba: estrechar el detector real a una sola meseta
  lo dejaba en verde con los 65 puertos otra vez ciegos. El detector vive ahora en un único cuerpo,
  `apps/web/src/curva-congelada.ts`, que importan el gate y su ataque; comprobado en rojo con el
  defecto puesto ahí (65 puertos) y en verde al restaurarlo.
- **Premisa en verde** (deliberadamente sin trinquete): `A-17 premisa · la congelación inyectada se
  dibuja plana en la curva publicada` comprueba, sobre el `<path>` que va al SVG, que el fraude se
  dibujaría de verdad —≥ 4 puntos consecutivos a la misma altura— y no es un espejismo de la
  aritmética. Si esa premisa cae, el hallazgo hay que releerlo entero: el trinquete se conforma con
  que el cuerpo falle.

### A-18 · la prueba de sensibilidad del gate A-1 se pone roja por el calendario · clase A12 · **alta**

`A-1 bis` es la pieza que sostiene todo el gate: es el test que demuestra que **el gate sabe fallar**,
reconstruyendo la avería original —una pleamar congelada cinco horas en Vigo— y exigiendo que se vea.
Sin él, A-1 es una conjetura.

Ese instrumento construye la meseta como ±150 min alrededor de **la primera pleamar del día** y luego
exige que dure al menos cuatro horas. Cuando la primera pleamar de Vigo cae cerca de la medianoche, la
ventana se recorta contra el borde del día y no llega: **el test se pone rojo sin que nada esté
averiado**. Y el día que se mide no lo elige nadie: el sitio publica el día en que se construyó y CI
construye sin `BUILD_DATE`.

- **Medido sobre los 365 días de 2026:** **33 días (9,0 %)** dan una meseta de menos de cuatro horas.
  Mínimo **150 min** (2026-02-27, 03-28, 05-25, 10-20, 11-20, 12-20).
- **No es teórico:** es el rojo con el que me encontré al llegar al worktree, con un `dist/` del
  2026-03-29 (220 min): `pnpm test` daba `# pass 115 · # fail 1` y el único fallo era
  `A-1 bis`, con `error: 'la meseta inyectada debería durar horas y dura 220 min'`. Reconstruible:
  `BUILD_DATE=2026-03-29 pnpm --filter web build && pnpm --filter web test`.
- **Por qué es grave y no una molestia:** un gate que enrojece por el calendario invita exactamente a
  lo que este repositorio prohíbe —bajar la constante de 4 h hasta que el día malo pase—, y esa es la
  vía por la que un gate deja de medir. *Cuando un test resulta frágil se cambia de instrumento, no de
  constante.*
- **Repro:** `A-18 · la prueba de sensibilidad del gate A-1 no depende del día en que corra CI`.
- **Estado:** **CERRADO** (trinquete retirado; el recorrido es gate permanente)
- **Arreglo:** `pleamarConSitio` elige la pleamar del día con más sitio a los dos lados; **la
  constante de las cuatro horas no se toca**. Comprobado con la suite completa construida en
  2026-03-29, 2026-02-27 y 2026-12-20 —tres de los 33 días malos—, verde en los tres; con el
  instrumento viejo, `A-1 bis` da `la meseta inyectada debería durar horas y dura 150 min`. El gate
  recorre los 365 días y además exige que la elección **siga haciendo falta**.

### A-19 · la cifra que justifica la estimación se publica en formato inglés · clase A6 · media

La frase que T-13 existe para publicar —«las constantes armónicas son las del mareógrafo `carg1`, a
**24.8** km de la dársena»— la escribe el pipeline con `f"{km:.1f}"` y la página la pinta tal cual. Lo
mismo el motivo del grade: «no alcanza B: RMSE normalizado **0.221** > **0.15**». En la misma página,
todo lo demás va en español: «0,18 m», «39,442° N», «3,05 m» — y, dos bloques más abajo, la distancia
a la Luna como «**381.367** km», donde el punto **sí** es separador de millares.

- **Medido en el `dist/`:** **130 de 153 páginas de puerto**, **283 ocurrencias** (el motivo de la
  estimación se publica dos veces por página: en el aviso y en la nota de calidad).
- **Por qué no es cosmético:** es la única cifra sobre la que descansa la promesa de la trayectoria, y
  la página le ha enseñado al lector, en la misma pantalla, que el punto separa millares. «24.8 km» y
  «381.367 km» no pueden significar cosas distintas en la misma página.
- **Repro:** `A-19 · ninguna página publica una cifra con el decimal en formato inglés` (descuenta el
  separador de millares español y las versiones de licencia, que no son medidas).
- **Estado:** **CERRADO** (trinquete retirado; el recorrido es gate permanente)
- **Arreglo:** `_cifra()` en `data/pipeline/mareia_pipeline/grade.py`, donde el número se convierte en
  texto. Las 170 frases del dataset committeado se migraron re-derivándolas con el `grade.py`
  parcheado: las 153 estaciones reprodujeron su frase carácter a carácter salvo el separador, sin
  cambiar ningún grade ni ningún flag `estimated`. Al ataque se le tapó además un agujero propio: su
  excepción de millares (`^\d{1,3}\.\d{3}$`) se tragaba «0.270» y «0.221», que es la medida y no el
  umbral. `dist/` completo: **0 ofensas**.
- **Corrección posterior (mismo PR):** apretar esa excepción a `^[1-9]\d{0,2}\.\d{3}$` seguía siendo
  una regla sobre la **forma**, y por la forma un millar y una medida son el mismo string: exoneraba
  las 352 cifras españolas que el sitio publica con esa pinta (279 coordenadas, 72 alturas y el RMSE
  normalizado de Tarragona, 2,902). La excepción es ahora **contextual** —sólo la fila «Distancia N
  km» de la Luna, la única que escribe un millar de verdad— y el recorrido `A-19 sensibilidad` lo
  deja como gate: devuelto `2.902` al HTML de Tarragona, A-19 se pone en rojo.

### A-20 · la procedencia del error medido sigue siendo autodeclarada · clase A12 · media · **escalado a `seguridad`**

El fraude que T-05 cometió y T-13 vino a cerrar era publicar el RMSE de Cartagena como si fuera el de
Cabo de Palos. El invariante que lo cierra **recomputa** la distancia al mareógrafo en vez de creerse
la declarada, con este motivo escrito al lado: *«si sólo se comprobara el número declarado, para colar
un RMSE ajeno bastaría con escribir al lado una distancia pequeña»*.

Pero la recomputación usa las coordenadas del mareógrafo **que escribe el mismo productor del RMSE**,
y no las contrasta con nada. El fraude no ha desaparecido: **ha subido un nivel**. Antes bastaba una
cifra falsa; ahora hacen falta tres, del mismo fichero.

Y el artefacto publicado tiene con qué desmentirlo sin salir a la red: el dataset dice que `carg1`
está en 37,570 N −0,980 E, porque lo publica Cartagena. Un Cabo de Palos que declare `carg1` a 709 m
de su dársena se contradice con otro fichero del mismo dataset y **nadie lo mira**.

- **Repro:** se construye ese fichero en memoria —RMSE real de Cartagena (0,0506 m) bajo el código
  `carg1`, coordenadas reescritas a 0,709 km de la dársena, distancia declarada recomputada para que
  cuadre— y se le pasa el invariante tal y como está escrito hoy: **cero incoherencias**, con el
  mareógrafo declarado a **26,6 km** de donde el propio dataset lo sitúa.
- **Contexto honesto:** hoy los 32 códigos de mareógrafo del dataset son consistentes entre sí (lo
  comprobé estación por estación) y **no hay ningún puerto real afectado**. Lo que se reporta es que el
  gate no puede ver el fraude que existe para impedir, no que el fraude esté cometido.
- **Escalado al rol `seguridad`** como integridad de procedencia del dato publicado. No es A7: no hay
  frontera de autorización que cruzar.

## No reproducidos

Lo que sospeché, ataqué y **no rompió**. Sin esta lista, una pasada estéril y una alucinada se ven
igual desde fuera.

| # | Sospecha | Qué hice | Por qué aguantó |
|---|---|---|---|
| 1 | Algún puerto `estimado` publica su página **sin decirlo** | Los 120 estimados contra su HTML del `dist/`, buscando la frase literal del aviso | **120/120** la traen |
| 2 | Se llega a un puerto estimado por una vía que no dice que lo es (sitemap, índices, portada, JSON-LD, API) | 191 URLs del sitemap · portada y páginas de provincia · el `<script type="application/ld+json">` · el DTO del API | Sitemap y enlaces cubren los 153 sin huérfanos; el JSON-LD es `Place`+`BreadcrumbList` y **no publica marea**; el DTO lleva `estimated`/`estimated_reason` y `JsonReader.flag` **rechaza ausente y `null`** (un `undefined` colado como «falso» era la vía obvia y está tapiada) |
| 3 | El flag `estimated` se decide por **redondeo** | `estimate()` compara la distancia cruda contra 5,0 km; busqué casos frontera | Ninguno: el no-estimado más lejano es **Tarragona a 4,585 km** y no hay nada entre 4,9 y 5,1 km |
| 4 | El `grade` se decide por redondeo, o publica una frase contradictoria del tipo «5.0 km > 5 km» | Parseé los 153 `grade_reason` comparando valor y umbral | **0 contradicciones**; las comparaciones se hacen sobre valores crudos |
| 5 | El golden de Brest se ensanchó de **±2 a ±3** para acomodar los datos | `brest-2026-published.json` + el test | `toleranceUnits` **sigue en 2** y los 32 valores caen dentro. Lo que subió es la cota del **sesgo agregado**, 1 → 1,25 (ver residuos) |
| 6 | El umbral de 1 mm del gate A-1 no tiene margen y enrojecerá solo | 153 puertos × 53 fechas repartidas por 2026 = **8 109 días-puerto** | Excursión máxima en meseta legítima **0,989 mm**: no conseguí ponerlo en rojo (ver residuos) |
| 7 | Al escalar se **uniformizó la licencia** del dataset | Las 153 estaciones y el pie de las 153 páginas | **104 `cc-by-nc-4.0` + 49 `cc-by-4.0`**, cada una con su `notes` de origen y su atribución en el pie |
| 8 | Alguna distancia declarada no es la que dan las coordenadas | Recomputé `source.primary.distance_km` y `observation_distance_km` en los 153 | Coinciden dentro de 20 m en los 153 |
| 9 | `estimated` incoherente con su motivo, o con la distancia, o con la observación | Los 153 contra la regla de `estimate()` | **0 incoherencias** |
| 10 | Un puerto estimado hereda el grade A del mareógrafo que le presta las constantes | Los 153 | **0**; y ninguno con grade A sin RMSE |
| 11 | Un puerto publica un RMSE medido lejos como si fuera suyo | Los 35 con observación | Máximo **4,585 km** (Tarragona); ninguno por encima de 5 |
| 12 | Al regenerar quedó algún puerto truncado al catálogo viejo | Cuenta de constituyentes de los 153 | Los 153 publican **39** |
| 13 | Páginas huérfanas, provincias sin índice, puertos fuera del sitemap, slugs duplicados o con forma no-URL | `dist/` completo + `ports.json` | **0** en las cuatro |
| 14 | El aviso le dice «no lo hemos medido» a un puerto que publica su propio error (Garachico, 126,07 min) | Su página construida | La plantilla tiene las dos versiones y Garachico cae en la correcta; su grade C y su error salen publicados |
| 15 | El fix del fraude de T-05 no tiene trinquete | Busqué la prueba de sensibilidad del invariante | No la hay —eso no es en sí un hallazgo— pero al construir el fraude para comprobarlo salió **A-20**, que sí lo es |

**Juicios de producto (clase A12, sin repro — se ponderan, no se cuentan como hechos):**

1. **La página lo dice; el buscador no.** Las 120 páginas estimadas llevan `<title>` «Mareas en X ·
   fecha · Mareia» y una descripción que promete «pleamares y bajamares de hoy … cálculo propio con
   fuentes abiertas». Ni el título ni la descripción dicen que la marea es una estimación, y ése es el
   único texto que ve mucha gente antes de decidir si entra o si se queda con lo que leyó. La promesa
   se cumple al pie de la letra —*lo dice en su página*— y el sitio sigue siendo indistinguible de uno
   medido allí donde se elige.
2. **El listado presenta 153 puertos iguales.** La portada enseña los 153 sin ninguna marca (`estimad`
   no aparece ni una vez en `index.html`), así que el usuario elige entre 153 idénticos y sólo descubre
   al llegar que 120 no están medidos. Con 12 puertos casi todos medidos eso no importaba; con 120 de
   153 sin medir, el listado es donde se toma la decisión.
3. **«Mareógrafo en la propia dársena» a 4,6 km.** Los puertos no estimados publican «Sí: mareógrafo en
   la propia dársena y predicción contrastada contra su observación». En Tarragona el mareógrafo está a
   **4,585 km** y en Canet d'En Berenguer a **4,437 km**. El umbral de 5 km es defendible y está
   documentado; la frase, menos: 4,6 km de costa no son «la propia dársena», y el dataset publica la
   distancia exacta con la que podría decirlo.

## Residuos medidos (para el orquestador)

Cosas que **no** son hallazgos porque no las conseguí poner en rojo, pero cuyo margen está medido y
conviene que alguien lo sepa antes de que enrojezcan solas:

- **El umbral de 1 mm del gate A-1 tiene un 1,1 % de aire.** Máximo medido en meseta legítima:
  **0,989 mm** sobre 8 109 días-puerto (153 puertos × 53 fechas de 2026). El umbral no es arbitrario
  —es el paso de publicación— pero el margen entre «meseta legítima» y «avería» es de una centésima de
  milímetro, y basta un puerto nuevo del Mediterráneo o un cambio de resolución de la curva para que
  cruce.
- **La cota del sesgo del golden de Brest tiene un 4,8 % de aire.** Sesgo medido **1,19** contra una
  cota de **1,25**, subida desde 1 en esta trayectoria. `toleranceUnits` no se tocó (sigue en 2), así
  que la aserción que ve el usuario está intacta; pero el propio fichero de fixtures escribe el aviso
  que suscribo: *«1 → 1,5 → 1,25 es una constante persiguiendo al dato»*. Lo intenté romper y no pude:
  hoy la cota mide, con muy poco aire.
- **65 de 153 puertos** admiten una congelación de curva invisible (A-17), y **33 de 365 días** ponen
  CI en rojo sin avería (A-18). Los dos números salen del mismo sitio: el gate A-1 y su prueba de
  sensibilidad son instrumentos de un solo tramo y un solo día, y el catálogo de T-13 los ha
  desbordado.

## Recuento

**4 reproducidos · 15 no reproducidos · 3 juicios A12 · 3 gates** (A-17, A-18 y A-19 arreglados y
con el trinquete retirado; A-20 sigue abierto, escalado al rol `seguridad`). Suite completa en verde,
antes del arreglo con los cuatro trinquetes y después con tres retirados: `pnpm lint`,
`pnpm typecheck`, `pnpm --filter web check`, `pnpm test` (7 paquetes, 0 fail) y
`deno task check && deno task test` (20 passed) del API.
