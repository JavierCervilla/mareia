# Informe adversario — el error medido en las listas de puertos (T-34)

- **Trayectoria:** T-34 (`cmtuxa3vz00a492khaca7pmo1`) · **PR:** #36 · **Fecha:** 2026-09-10
- **Superficie atacada:** `/`, `/mareas/<region>/`, `/mareas/<region>/<provincia>/`, `404.html`,
  `formato.ts`, y **los cuatro gates que T-34 escribió para vigilarse a sí misma**
- **Entorno:** local, sobre el `dist/` construido · sin cloud

## Promesa

*En las tres listas donde alguien elige puerto, si la predicción de ese puerto está medida se ve
**cuánto** se equivoca; y si no está medida, no se ve ninguna cifra que pueda confundirse con una.*

El pase la rompió por los dos lados de esa frase: resultó que las listas **no eran tres**, y que
«no se ve» y «no está escrito» no son lo mismo.

## Clases atacadas

| Clase | Hipótesis (entrada concreta) | Resultado |
|---|---|---|
| A12 | hay una lista de puertos fuera del censo del gate | 🔴 **roto** — `404.html`, 153 puertos, 0 señales |
| A12 | el gate no mira las filas que no esperaba (fila ajena con cifra inventada) | 🔴 **roto** |
| A12 | el gate no mira las filas duplicadas (dos «Mahón», la falsa delante) | 🔴 **roto** |
| A12 | ningún gate mira si la cifra se **pinta**, sólo si está escrita | 🔴 **roto** — 35 escritas, 0 visibles, suite verde |
| A6 | un `rmse_m: 0` legítimo se convierte en «sin medida» por el camino | 🟢 aguantó |
| A6 | una clave `rmse_m` ausente se confunde con una medida | 🟢 aguantó |
| A6 | no finitos (`1e999` → `Infinity`, `NaN`) atraviesan la ingesta | 🟢 aguantó |
| A6 | dos puertos con el mismo nombre se pisan en el emparejamiento | 🟢 aguantó (153 nombres distintos) |
| A12 | la web y el API publican cifras distintas del mismo `rmse_m` | 🟢 aguantó |
| A9 | el nombre accesible del enlace se funde con la meta | 🟢 aguantó |
| A5 | la fila con una cifra más desborda a 320/360/390 px | 🟢 aguantó |
| A12 | hay una página de lista que `getStaticPaths` produce y el gate no censa | 🟢 aguantó (la única era el 404 → H-1) |

**Descartadas y por qué:** A1/A4 (no hay escritura ni formulario en estas páginas: son estáticas y
sin JavaScript), A7 (sin recursos por usuario ni autorización que saltarse), A3 (no hay mutación de
red: el dato viaja horneado), A2 (no hay sello de frescura en esta superficie), A10 (no hay bloque
que pueda quedar rehén: no hay carga asíncrona). Un descarte razonado es información; uno silencioso
parece cobertura.

## Hallazgos

### H1 · A12 · Hay una **cuarta** lista de puertos, y es muda

- **Qué se consigue:** quien cae en una URL que no existe —un enlace viejo, un slug que cambió— ve
  los 153 puertos y elige a ciegas: **0 cifras y 0 palabras de calidad** en `404.html`. Es la página
  que un hosting estático sirve ante cualquier ruta desconocida, y su propia cabecera dice que
  existe porque «quien cae aquí venía a por **un** puerto».
- **Lo que de verdad enseña:** el gate **no podía verla nunca**. Censaba sus páginas desde el
  catálogo (1 + 12 + 24 = 37) y su canario contaba *«he mirado las listas que yo mismo enumeré»*,
  que es una tautología con forma de cobertura. Es la forma exacta de **A-T14B H-1** (la señal llegó
  a una lista de tres) y de **A-T30-2** (el 404 publicaba la llamada de la portada sin la clase con
  la que se arregló la portada), una superficie más abajo. **Tercera vez que la misma página se
  queda fuera de la misma clase de arreglo.**
- **Repro:** `tests/e2e/journeys/adversarial/a12-la-cuarta-lista-de-puertos.spec.ts`
- **Bundle:** `qa-bundles/b2fc03f369b9/FAILURE.md`
- **Estado:** **arreglado** (`test.fail()` retirado → gate permanente). `404.astro` construye sus
  entradas con `estimada` y `errorM`, y —lo que importa más— **el gate censa las páginas leyendo el
  `dist/`, no el catálogo**: cualquier página que publique entradas de puerto o la juzga o la pone
  en rojo por no saber juzgarla. Una quinta lista tampoco podría nacer muda.
- **Severidad:** molestia con pérdida de información en el punto de decisión.
- **Escalado:** no.

### H2 · A12 · El gate cuenta las filas que espera y no mira las que sobran (2 recorridos)

- **Qué se consigue:** publicar cifras que nadie compara con el dataset. Dos formas, las dos con el
  gate en **código 0**: (a) una fila **de más** —*Baiona*, de las 118 sin medida y de otra
  provincia— plantada en la lista de Illes Balears con `±3 cm`; (b) una fila **duplicada** —dos
  «Mahón», la falsa (`±99 cm`) **delante** de la buena (`±4 cm`)—: el `Map` se queda con la última,
  así que el gate lee la buena y el lector ve la falsa.
- **Lo que de verdad enseña:** el gate afirmaba «**ninguno** sin medida publica una cifra» y
  comprobaba «ninguno *de los que yo esperaba aquí*». Iterar lo esperado y preguntarle a un `Map`
  nunca puede sostener una afirmación universal sobre lo publicado.
- **Repro:** `tests/e2e/journeys/adversarial/a12-el-gate-no-mira-las-filas-que-sobran.spec.ts`
- **Bundles:** `qa-bundles/a2e7f70aca0a/FAILURE.md` (fila ajena) · `qa-bundles/bd32d8c7de2e/FAILURE.md` (duplicada)
- **Estado:** **arreglado** (`test.fail()` retirado → trinquete permanente). El gate juzga **cada
  fila publicada**, emparejada por su **`href`** (que lo construye el catálogo y es único, mientras
  que el nombre lo escribe la página), rechaza que un puerto salga dos veces en la misma página, y
  comprueba además que el nombre de la fila sea el del catálogo.
- **Severidad:** corrupción silenciosa del dato publicado.
- **Escalado:** no.

### H3 · A12 · Los gates comprobaban lo que la lista **dice**; ninguno miraba si se **ve**

- **Qué se consigue:** una línea en la hoja construida —`@media (max-width:700px){.indice__error{display:none}}`,
  o sea escondida **sólo en el teléfono**— deja las 35 cifras escritas en el HTML y **0 en la
  pantalla**, con los **318 tests de la web en verde**.
- **Lo que de verdad enseña:** los cuatro gates de T-34 leen texto (`readFileSync`, cadenas a mano,
  `textContent` —que devuelve igual esté pintado o no—). Es **literalmente** la avería para la que
  este repositorio ya escribió **G6** en la tabla de especies —*«todos leen el HTML; ninguno mira lo
  que se pinta»*— y T-34 no la heredó al añadir una regla CSS nueva a una hoja donde el portal ya
  esconde entradas con `display: none`. **Un gate que lee el artefacto no puede afirmar nada sobre
  lo que se ve, y eso se arregla con un gate de otra clase, no con más aserciones de la misma.**
- **Repro:** `tests/e2e/journeys/adversarial/a12-la-cifra-esta-en-el-html-y-no-en-la-pantalla.spec.ts`
- **Bundle:** `qa-bundles/f3a35546833d/FAILURE.md`
- **Estado:** **arreglado** (`test.fail()` retirado → gate permanente). Nace **G7** en
  `journeys/legibilidad-movil.spec.ts`: «lo que la lista dice, la pantalla lo enseña», sobre las
  **cuatro** clases de lista × **tres anchos** × **los dos** `<span>` de los que depende elegir
  puerto (la cifra y la palabra de calidad, que viven en la misma hoja y se esconderían por el mismo
  atajo). Probado en rojo con este mismo sabotaje: nombra los puertos afectados.
  **Y el recorrido cambió de método al quedarse**: su versión original mutaba la hoja del `dist/`
  **compartido** mientras la suite corría, y su propia cabecera avisaba de que *«el día que exista
  ese gate, éste tendrá que servirse su propia copia»*. Ese día llegó: ahora sabotea un espejo
  efímero en `/tmp` servido en su propio puerto (el arnés acepta `RAIZ_ESTATICA`). Mutar el árbol
  con la suite corriendo es el error que costó cuatro rojos inventados en T-32; no se hereda por
  comodidad.
- **Severidad:** pérdida total de la feature en el aparato que manda, sin síntoma en CI.
- **Escalado:** no.

## No reproducidos

Se anotan a propósito: sin ellos, una pasada estéril y una alucinada se ven igual desde fuera.

- **NR-1 · el cero que se convierte en nada.** Medido en runtime: `JsonReader.nullableNumber({rmse_m:0})`
  → `0` (y `-0` → `0`); `0 ?? undefined` → `0`; `errorDeLaPrediccion(0)` → `±0 cm`. Sólo `null` o la
  clave ausente dan `null`. No hay ruta donde un cero legítimo pase a «sin medida».
- **NR-2 · el `rmse_m` que desaparece.** Una clave ausente sí se lee como «sin medida» con
  `estimated` intacto. Lo cubre `apps/api/src/http/core_test.ts` contra `metrics.samples`, que no
  viaja por el API. **No se pudo ejecutar** (no hay `deno` en el contenedor del pase): cobertura
  afirmada **por lectura, no medida**, y se dice así.
- **NR-3 · el no finito.** `1e999` parsea a `Infinity` pero `JsonReader.number` lo rechaza
  (`Number.isFinite`) en la ingesta; `NaN` no es expresable en JSON. Puerta cerrada.
- **NR-4 · dos puertos con el mismo nombre.** 153 nombres distintos. Colisionan nombres de puerto
  con nombres de región (Ceuta, Melilla) y de provincia (11), pero ésos van en `<h2 class="etiqueta">`,
  no en `li.indice__entrada`. De este descarte salió H-2b, que sí entra: basta con que **la página**
  repita el nombre.
- **NR-5 · la web y el API dicen cosas distintas.** Misma fuente y mismo adaptador; la ficha publica
  `metros(rmse, 3)` («0,036 m») y la lista `±4 cm`, coherentes bajo redondeo.
- **NR-6 · el nombre accesible fundido.** Medido: `link "Mahón Europe/Madrid · medida · ±4 cm"`. El
  navegador separa nombre y meta.
- **NR-7 · la fila que ya no cabe.** Sin desborde horizontal a 320/360/390 en las tres listas. Sólo
  `404.html` a 320 px desborda (352 px), por un `<code>` de su entradilla **anterior a T-34**.
- **NR-8 · una página de lista fuera del censo.** Los 37 ficheros que enumeraba el gate coincidían
  1:1 con los de `getStaticPaths`. La única lista fuera del censo era `404.html` → se convirtió en H-1.

## Juicios de producto (A12 sin repro)

Se ponderan, no cuentan como hechos.

- **J-1 · `±0 cm` en un puerto medido.** Medido: `errorDeLaPrediccion(0.0049)` → `±0 cm`;
  `(0.005)` → `±1 cm`. **Hoy no ocurre** (el mejor del catálogo es 0,0359 → `±4 cm`), pero todo el
  intervalo `[0, 0.005)` publicaría «predicción perfecta» en un puerto rotulado «medida».
  **Disposición:** no se inventa un umbral para un caso que no existe —eso es diseñar contra una
  hipótesis—, pero **no se deja entrar en silencio**: nace un canario en
  `error-en-listas-construido.test.ts` que se pone rojo el día que una estación caiga en ese
  intervalo, y obliga a decidir **con el caso delante**.
- **J-2 · negativos sin cota.** `errorDeLaPrediccion(-0.5)` → `±-50 cm`, y no hay gate de rango sobre
  `quality.rmse_m` en `run.py check`. No reproducido de punta a punta y **un RMSE negativo no lo
  produce `sqrt`**. **Disposición:** queda **abierto en el ledger** como deuda del pipeline, no de
  T-34; meterlo aquí sería ensanchar el PR.
- **J-3 · el filtro y la cifra no hablan el mismo idioma.** «Solo los medidos» → **33 visibles**, y
  esconde a **Garachico (`±17 cm`)** y **San Sebastián de la Gomera (`±4 cm`)**, que **sí tienen
  error medido**. El filtro se apoya en `estimated` (procedencia); T-34 introdujo una segunda noción
  de «medido» (hay medida del error) que no coincide con la primera en **2 de 35** filas.
  **Disposición: se sube al humano.** Es la misma tensión que originó H-3 de T-14B —un mando que se
  llama «calidad» y ordena por otra cosa— y resolverla es decidir qué promete la palabra «medidos»,
  no un arreglo de render.
- **J-4 · la cifra sin leyenda.** En región y provincia no hay ninguna frase que diga qué es `±4 cm`,
  y en la portada la nota del filtro sigue diciendo «El error concreto de cada uno está en su
  página», que ahora es incompleto. **Disposición:** la frase se corrige en este PR (es texto que
  T-34 dejó desfasado); la leyenda por lista se sube al humano junto con J-3, porque es la misma
  decisión.
- **J-5 · el `±` y el lector de pantalla** (no verificable localmente). Toda la distinción frente a
  una altura de marea se apoya en el `±`; si el lector no lo anuncia, se evapora justo para quien no
  ve la pantalla. **Disposición: abierto en el ledger**, pendiente de una medida con lector real.

## Recuento

**3 hallazgos reproducidos** (4 recorridos en rojo) · **8 no reproducidos** · **5 juicios A12**.
Los tres hallazgos quedan **arreglados con su trinquete retirado**: 4 recorridos que se quedan de
gate permanente, más **G7** (12 casos) y el canario de J-1.
