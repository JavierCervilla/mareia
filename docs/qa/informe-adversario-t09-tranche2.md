# Informe adversario — página de puerto SSG, tranche 2 (T-09)

- **Trayectoria:** T-09 · **PR:** #10 (`claude/T-09-web-port-page-core`) · **Fecha:** 2026-08-28
- **Superficie atacada:** las **32 páginas construidas** (`apps/web/dist/`: portada, 7 regiones, 10
  provincias, 12 puertos) y la capa que las calcula —`apps/web/src/datos/pagina-puerto.ts`,
  `datos/coeficiente.ts`, `datos/fecha-build.ts`, `cielo.ts`, `formato.ts`, `grafico-marea.ts`,
  `seo.ts`, `json-ld.ts`, los 11 componentes `.astro` y las tres hojas de `src/estilos/` +
  `packages/ui/src/tokens.css`.
- **Entorno:** local y efímero — `pnpm --filter web build` (Astro estático) + `node --test`, más un
  Chromium de Playwright **solo para exploración** (no hay dependencia de Playwright en el repo).
  Sin cloud: ni el diff, ni el DOM, ni el código han salido del contenedor; no se ha usado ningún
  modelo externo para revisar nada.
- **Reproducciones:** `apps/web/src/adversario-t09-tranche2.test.ts` (A-8…A-12).
- **Bundle:** `docs/qa/bundles/t09-tranche2/FAILURE.md` (un solo bundle, un apartado por hallazgo:
  el run en rojo es uno).
- **Contexto asimétrico:** se ha leído el **contrato** (`apps/web/design-brief.md`,
  `data/stations/*.json`, el README del portal) y el **artefacto construido**. El código se ha leído
  para *dirigir* los ataques (encontrar el selector, el flag, la ruta), nunca para juzgarlo, y el
  Design Doc del cambio no se ha abierto.

> **Trinquete.** `test.fail()` es de Playwright; aquí el arnés es `node --test` y el equivalente es
> el helper `hallazgoAbierto()` del propio fichero —el mismo que estrenó la tranche 1—: el cuerpo
> afirma **el comportamiento correcto**, CI se queda verde mientras el bug esté abierto (imprimiendo
> el motivo como diagnóstico en cada ejecución) y **se pone rojo el día que alguien lo arregle**,
> pidiendo que se retire el trinquete para que el ataque quede como gate permanente. Mismo caveat:
> se conforma con que el cuerpo falle por cualquier motivo, por eso cada assert es específico y el
> motivo se imprime en cada run.

## Promesa

**Cualquiera que abra la página de su puerto ve las mareas, el coeficiente y el sol/luna correctos
de hoy, entiende cuándo el dato es flojo, y la página funciona a pleno sol, en móvil, sin JS y al
imprimirla.**

De esa frase, la parte que la tranche 1 no pudo atacar —porque no había datos reales, sino un
fixture escrito a mano— es *«correctos»* y *«entiende cuándo el dato es flojo»*. Ahí se ha atacado.

## Clases atacadas

| Clase | Hipótesis (entrada concreta) | Resultado |
|---|---|---|
| **A12** · promesa vs entregado | El aviso destacado se decide con `grade === "C" && p95 === null`, y ese `null` significa dos cosas distintas en el QC de T-05: ¿hay algún puerto donde la frase «la marea es de centímetros» sea falsa? → **Cádiz**, carrera 2,90 m | 🔴 **roto** → **A-8** |
| **A12** · promesa vs entregado | La nota de calidad traduce `p95 === null` con una sola frase: ¿la afirma en una estación sin observación? → **Cádiz** (`rmse_m: null`, `samples: 0`) | 🔴 **roto** → **A-11** |
| **A5** · límites 0/1/N | Día civil **sin orto de Luna** (`2026-08-05`, `2026-04-05`) y **sin ocaso** (`2026-08-19`, `2026-04-19`): 25 días de 365 en Santander | 🔴 **roto dos veces** → **A-9** (la fila «Sale» anuncia el ocaso) y **A-10** (afirma «todo el día bajo el horizonte» junto al ocaso y a un paso superior de +23,5°) |
| **A5** · límites 0/1/N | Día con **un solo extremo** (`palma-de-mallorca`, `2026-01-17`) y día con **seis** (`cabo-de-palos`, `2026-01-09`) | 🟢 aguantó: tabla de una fila, un círculo en la curva, `aria-label` y `figcaption` coherentes |
| **A5** · límites | Día del **cambio de hora**: `2026-03-29` (23 h) y `2026-10-25` (25 h), en los 12 puertos | 🟢 aguantó (ver *No reproducidos*) |
| **A5** · límites | **Año bisiesto** `2028-02-29`, primer y último día del mes, tabla mensual de 28/29/30/31 filas | 🟢 aguantó: 29 filas, primera `2028-02-01`, última `2028-02-29` |
| **A9** · callejón sin salida | Llegar a una URL que no existe (slug viejo, tramo mal escrito, enlace compartido) | 🔴 **roto** → **A-12** (no hay `404.html`) |
| **A9** · callejón sin salida | Seguir **todos** los `href` internos de las 32 páginas construidas | 🟢 aguantó (lo cubre el gate A-3 de la tranche 1, ahora sobre 32 páginas) |
| **A6** · input hostil | `</script>`, `<`, `>`, `&`, U+2028/9 en el JSON-LD de las 32 páginas; `<` y `>` en la `<meta description>` | 🟢 aguantó: `serializarJsonLd` los pasa a `\uXXXX` y `escaparMarcado` cubre el atributo |
| **A6** · input hostil | Entidad doble en `grade_reason` (`RMSE normalizado 0.089 > 0.05`) | 🟢 aguantó: `&gt;` una sola vez, cero `&amp;gt;` |
| **A3** · fallo parcial | Que la hoja de estilos **no cargue** (`route.abort()` sobre `**/*.css`) y que Google Fonts no responda | 🟢 aguantó: el orden del DOM cuenta la historia entera y la pila de respaldo es Georgia |
| Promesa · datos vs presentación | Comparar el HTML de los **12 puertos** contra `getTides`/`getAstro`/`getPort` llamados a mano: tabla del día, cifra y calificación del coeficiente, amanece/anochece, sale/se pone | 🟢 aguantó: 0 discrepancias |
| Promesa · determinismo | Dos builds con el mismo `BUILD_DATE`; y el mismo build con `TZ=Pacific/Kiritimati` (+14) y `TZ=Pacific/Midway` (−11) | 🟢 aguantó: `diff -r` idéntico en los tres casos |
| Promesa · a pleno sol | Medir el contraste **real** del HTML construido, no el del brief: los 8 pares de tokens en sRGB desde OKLCH, más el compuesto de `a:hover{opacity:.8}` | 🟢 aguantó: peor par 5,40:1, peor hover 5,51:1 |
| Promesa · móvil | 320 px y 360 px de ancho, tres páginas: ¿algo se sale? | 🟢 aguantó: `scrollWidth == clientWidth`, 0 elementos desbordando |
| Promesa · impresión | `emulateMedia({media:"print"})` + PDF A4 | 🟢 aguantó: tinta negra sobre blanco, curva y migas ocultas, 31 filas del mes, `break-inside: avoid` |
| Promesa · SEO | 32 canónicas, 32 `<loc>` del sitemap, `SITE_URL` respetada, `@graph` parseable en las 12 páginas de puerto | 🟢 aguantó |

**Descartadas y por qué.** Sigue siendo una **página estática sin servidor, sin sesión, sin
formularios y sin mutación**: no hay nada que enviar dos veces, nada que quede a medias en una
escritura, nada que reintentar, ningún recurso de otro usuario y ningún estado que revertir. Quedan
fuera **A1** (concurrencia/doble envío), **A2** (estado stale — su forma aplicable a un almanaque es
el juicio J-1 de la tranche 1, que sigue abierto y se re-registra abajo), **A4** (idempotencia),
**A7** (frontera de autorización: no hay autenticación ni recursos por usuario, **nada que escalar a
`seguridad` por esta vía**), **A8** (sesión), **A10** (feedback: no hay acción que dar feedback) y
**A11** (reversibilidad: no hay nada destructivo que deshacer). De **A3** solo aplica la variante
«el recurso no llega», que sí se ha atacado (fila de la tabla).

## Hallazgos

Cinco reproducidos, los cinco con su test **en rojo antes** de poner el trinquete (evidencia en el
bundle). Ninguno es una vulnerabilidad; **los cuatro primeros son la página afirmando cosas que sus
propios datos desmienten**, que en un producto cuyo argumento de venta es la transparencia es el
peor sitio donde fallar.

### A-8 · A12 · La página le dice a Cádiz que su marea «es de centímetros», encima de una tabla de 2,90 m

- **Qué se consigue:** quien abre `/mareas/andalucia/cadiz/cadiz/` lee, en el bloque más destacado
  de la cabecera y antes que ningún dato: «**En Cádiz la marea astronómica es de centímetros**. La
  carrera de marea de este puerto es tan pequeña que el nivel del agua lo decide sobre todo el
  residuo meteorológico: la presión atmosférica y el viento mueven aquí más que la Luna». Justo
  debajo, la tabla del mismo día dice pleamar 3,46 m y bajamar 0,56 m: **2,90 m de carrera**, en la
  mitad alta de los doce puertos del catálogo y por encima de los dos canarios, que no llevan aviso.
- **Por qué pasa:** el aviso lo dispara `micromareal = grade === "C" && hw_time_err_p95_min === null`
  (`apps/web/src/datos/pagina-puerto.ts:133`), y ese `null` significa dos cosas distintas en el QC de
  T-05: «hay observación pero no tiene pleamares identificables» (Mar Menor, Palma: carrera 0,14–0,17
  m) y «**no hay observación** con la que medir nada» (Cádiz: `samples: 0`, `observed_extremes: 0`,
  `predicted_range_m: 3.424`). El aviso trata las dos igual y describe la primera.
- **Medido:** carrera del día sobre `dia.muestras`, 12 puertos, `BUILD_DATE=2026-08-28`: los tres
  micromareales de verdad, 0,14–0,17 m; **Cádiz, 2,90 m**; Las Palmas y Santa Cruz, 2,1–2,2 m **sin**
  aviso. Es decir: el puerto con aviso tiene más carrera que dos puertos sin aviso.
- **Dónde se manifiesta:** `apps/web/src/datos/pagina-puerto.ts:133` (el flag) →
  `apps/web/src/componentes/AvisoMicromareal.astro` (la frase).
- **Repro:** `apps/web/src/adversario-t09-tranche2.test.ts` → `A-8 · el aviso «de centímetros» solo
  sale donde la carrera es de centímetros`.
- **Bundle:** `docs/qa/bundles/t09-tranche2/FAILURE.md` § A-8.
- **Estado:** **abierto** (trinquete puesto).
- **Severidad:** **alta para el dominio**. No es un aviso de más: es un aviso que le dice a quien
  marisquea en La Caleta que la marea no importa, en uno de los puertos de España donde más importa.
  Y erosiona el propio aviso donde sí es cierto: un aviso que se ve obviamente falso en una página se
  ignora en las otras tres.
- **Escalado:** no (no es seguridad).

### A-9 · A5 · La fila «Sale» de la Luna anuncia que no se pone

- **Qué se consigue:** el 5 de agosto de 2026, la página de Santander (y las de Bilbao, Palma, Cabo
  de Palos y La Manga) publica en la fila **«Sale»**: «*La Luna no se pone: hoy está todo el día
  sobre el horizonte*». El 19 de agosto, en la fila **«Se pone»**: «*La Luna no sale: hoy está todo
  el día bajo el horizonte*». La frase que ocupa el hueco de una efeméride habla de la efeméride
  contraria.
- **Por qué pasa:** `cielo.ts` compone la ausencia a partir de la **razón** del DTO
  (`always-above` → «no se pone», `always-below` → «no sale») en vez de a partir de la fila que la va
  a mostrar; cuando la razón y la fila no coinciden, el verbo se invierte.
- **Frecuencia:** ~25 días al año por puerto (el día lunar dura 24 h 50 min, así que una vez cada
  ~29 días el orto —y otra el ocaso— se sale del día civil). De esos, la mitad larga cae con el
  verbo cambiado.
- **Dónde se manifiesta:** `apps/web/src/cielo.ts:26-31` (`ausencia`), consumido por
  `componentes/SolYLuna.astro`.
- **Repro:** `apps/web/src/adversario-t09-tranche2.test.ts` → `A-9 · la fila de la Luna habla de su
  propia efeméride`.
- **Bundle:** `docs/qa/bundles/t09-tranche2/FAILURE.md` § A-9 y A-10.
- **Estado:** **abierto** (trinquete puesto).
- **Severidad:** media — dato contradictorio en el bloque que la página vende como «lo que hay que
  saber para decidir si habrá luz».
- **Escalado:** no.

### A-10 · A5 · «Todo el día bajo el horizonte», y dos filas más abajo, la hora de su ocaso

- **Qué se consigue:** el 5 de abril de 2026 la página de Santander dice, en el mismo recuadro y sin
  scroll de por medio:

  ```
  Sale            La Luna no sale: hoy está todo el día bajo el horizonte
  Se pone         08:57 · 237° (OSO)
  Paso superior   04:23 · 23,5° de altura
  Fase            menguante gibosa · 89,5 % iluminada
  ```

  La página afirma que la Luna no cruzó el horizonte en todo el día y, acto seguido, publica la hora
  a la que se puso, la hora a la que culminó **23,5° por encima** del horizonte y que estaba iluminada
  al 89,5 %. Es la clase de contradicción que un lector detecta en dos segundos y que le hace dudar
  del resto de la página, incluida la tabla de mareas, que sí es correcta.
- **Por qué importa además:** la afirmación es **imposible** en el catálogo. Las doce estaciones van
  de 27,9° N a 43,5° N y la Luna solo es circumpolar por encima de ~61° de latitud (declinación
  máxima 28,7°). La frase existe para el caso polar que anuncia el propio módulo («la que lo esté
  mañana —T-13 amplía a 200-300 puertos— no puede mentir por omisión») y hoy solo se usa donde es
  falsa: lo que ocurre no es que la Luna no salga, es que **salió el día anterior**.
- **Dónde se manifiesta:** la frase la pinta `apps/web/src/cielo.ts:26-31`; la razón que la elige la
  trae `getAstro` (`@mareia/usecases`), así que el arreglo puede caer del lado del dominio. **No
  propongo el fix**: lo señalo porque cambia a quién le toca.
- **Repro:** `apps/web/src/adversario-t09-tranche2.test.ts` → `A-10 · la Luna no está bajo el
  horizonte y sobre él a la vez` (cuatro días, dos direcciones; el assert usa **solo lo que la propia
  página publica**: si afirma «bajo el horizonte», el paso superior tiene que ser ≤ 0°).
- **Bundle:** `docs/qa/bundles/t09-tranche2/FAILURE.md` § A-9 y A-10.
- **Estado:** **abierto** (trinquete puesto).
- **Severidad:** media-alta — dato astronómico falso publicado como cierto, ~25 días al año y en
  todas las páginas a la vez (la Luna es la misma para los doce puertos).
- **Escalado:** no.

### A-11 · A12 · La nota de calidad de Cádiz habla de una observación que no existe

- **Qué se consigue:** en «Calidad y procedencia del dato», tres filas consecutivas de la página de
  Cádiz:

  ```
  Error cuadrático medio frente a la observación   no medido
  Error de hora de la pleamar (p95)                sin pleamares medibles en la observación
  Validado contra                                  contraste cruzado entre fuentes (sin observaciones)
  ```

  La fila del medio afirma que **hubo** una observación en la que no se pudieron medir pleamares; la
  de abajo dice que **no hubo observación ninguna**, y el dataset lo confirma (`samples: 0`,
  `observed_extremes: 0`, `observation_source: null`). Es la misma raíz que A-8 en su otra puerta:
  un `null` con dos significados resuelto con una sola frase.
- **Por qué importa:** esta sección es literalmente donde el producto cobra («*«Transparencia como
  feature» se cumple aquí o no se cumple*», dice su propia cabecera). Confundir «medimos y no salió»
  con «no medimos» invierte el sentido del hueco: el primero es una limitación del sitio, el segundo
  es una limitación **nuestra**.
- **Dónde se manifiesta:** `apps/web/src/componentes/Transparencia.astro:53-62`.
- **Repro:** `apps/web/src/adversario-t09-tranche2.test.ts` → `A-11 · la nota de calidad no inventa
  una observación`.
- **Bundle:** `docs/qa/bundles/t09-tranche2/FAILURE.md` § A-11.
- **Estado:** **abierto** (trinquete puesto).
- **Severidad:** media — no cambia ninguna hora, pero le miente al único lector que se molestó en
  bajar a comprobar de dónde sale el número.
- **Escalado:** no.

### A-12 · A9 · El sitio construido no trae página de «no encontrado»

- **Qué se consigue:** las URL del portal son jerárquicas y profundas
  (`/mareas/<región>/<provincia>/<puerto>/`) y el `dist/` son 32 directorios con su `index.html`, sin
  `404.html`. Un tramo mal escrito, un enlace viejo compartido por WhatsApp o un slug que cambie al
  ampliar el catálogo (T-13, de 12 a 200-300 puertos) devuelven el 404 **crudo del servidor**: sin
  cabecera, sin buscador, sin «No apto para navegación» y sin una sola vía de vuelta a Mareia. Es el
  callejón sin salida de manual, y en un sitio cuyo modo de llegada dominante es el buscador.
- **Repro:** `apps/web/src/adversario-t09-tranche2.test.ts` → `A-12 · el sitio construido tiene
  página de «no encontrado»`.
- **Bundle:** `docs/qa/bundles/t09-tranche2/FAILURE.md` § A-12.
- **Estado:** **abierto** (trinquete puesto).
- **Severidad:** baja-media, y el más discutible de los cinco: **el arreglo puede vivir fuera de
  T-09** (una `src/pages/404.astro`, o la configuración del hosting en T-15). Lo reporto como
  comportamiento observable del artefacto que este PR publica, no como decisión de dónde ponerlo.
- **Escalado:** no.

## No reproducidos

Sospechas que **no** se materializaron, con la entrada concreta que se probó. Se listan a propósito:
sin esto, una pasada estéril y una pasada alucinada se ven igual desde fuera.

| Sospecha | Qué pasó al intentarlo |
|---|---|
| El día del cambio de hora (23 h / 25 h) descuadra el eje de la curva | `BUILD_DATE=2026-03-29` → eje `00:00 06:45 12:30 18:15 24:00`; `2026-10-25` → `00:00 05:15 11:30 17:45 24:00`. Las marcas no se fuerzan a horas redondas: se publica la hora local real de cada quinto del día. Correcto |
| El día del cambio de hora pierde o duplica un extremo entre la tabla del día y la del mes | 12 puertos × 3 fechas (`2026-03-29`, `2026-10-25`, `2026-08-28`): la fila mensual coincide **evento a evento** con `getTides` pedido día a día. 0 diferencias, 0 días vacíos |
| El último día del mes se queda sin extremos (la consulta mensual corta el rango en UTC) | Comprobados los 12 puertos, incluidos los dos de `Atlantic/Canary`: la última fila trae sus 4 extremos. `2026-03-31`, `2026-10-31`, `2028-02-29` completas |
| El mediodía solar no sigue al cambio de hora | `2026-03-29`: amanece 08:02, anochece 20:38, mediodía 14:19 (punto medio exacto). `2026-10-25`: 07:41 / 18:16 / 12:59. Correcto |
| Un año bisiesto rompe la tabla mensual | `BUILD_DATE=2028-02-29` → 29 filas, de `2028-02-01` a `2028-02-29`, la del día marcada `data-hoy="si"` |
| Un día con un solo extremo deja la tabla, la curva o el `aria-label` a medias | `palma-de-mallorca`, `2026-01-17`: una fila, un círculo en el SVG, `aria-label="…: pleamar a las 08:26, 0,17 m."`, `figcaption` «Entre 0,01 m y 0,17 m». Coherente. Y con seis extremos (`cabo-de-palos`, `2026-01-09`) también |
| Un día sin ningún extremo deja el `aria-label` colgando («Curva de las 24 horas: .») | **No reproducible con el dataset**: el mínimo en 2026, en los 12 puertos, es 1 extremo (Palma). La rama de tabla vacía existe pero no se alcanza |
| El HTML no dice lo que calculan los casos de uso en algún puerto que no sea Vigo/Santander | Barrido de los **12** puertos comparando tabla del día, cifra y calificación del coeficiente y las cuatro efemérides de horizonte contra `getTides`/`getAstro` llamados a mano: **0 discrepancias** |
| Dos builds del mismo commit dan HTML distinto | `diff -r` de dos `dist/` con el mismo `BUILD_DATE`: idénticos. Y con `TZ=Pacific/Kiritimati` (+14) y `TZ=Pacific/Midway` (−11): idénticos también. La zona de la máquina no se filtra al dato |
| El contraste real del HTML es peor que el del brief | Medidos en sRGB (conversión OKLCH→sRGB) los 8 pares de tokens **sobre el único fondo que usa el sitio** (`--m-bg`): 12,55 / 5,77 / 10,19 / **5,40** en claro y 13,93 / 7,30 / 7,95 / 5,69 en noche. Y el compuesto de `a:hover{opacity:.8}`: 5,84 (claro) y 5,51 (noche). Ningún par real por debajo del 5,4:1 prometido |
| La tabla mensual desborda en un móvil estrecho | 320 px y 360 px en Santander, Cádiz y Las Palmas: `scrollWidth == clientWidth`, cero elementos con `right > clientWidth` |
| Sin CSS el orden del DOM no cuenta la historia | Abortando `**/*.css` y Google Fonts: marca → fecha → migas → «No apto para navegación» → puerto → coeficiente → aviso → tabla del día → curva → sol → luna → tabla del mes → calidad → fuentes. Se lee entero y en el orden correcto |
| El CSS de impresión no existe o no gana al tema noche | `emulateMedia({media:"print"})`: `--m-ink`/`--m-navy`/`--m-terra` a `oklch(0 0 0)` sobre blanco, `.grafico` y `.migas` a `display:none`, tabla mensual con sus 31 filas y `break-inside: avoid`. PDF A4 de 5 páginas |
| Se puede inyectar marcado por el JSON-LD desde el dato | `serializarJsonLd` pasa `<`, `>`, `&`, U+2028 y U+2029 a `\uXXXX`; los 32 JSON-LD parsean y ninguno cierra su `<script>`. La otra puerta (atributo `content`) ya la cerró A-4 en la tranche 1 |
| `grade_reason` sale doblemente escapado | `RMSE normalizado 0.089 &gt; 0.05` una sola vez; cero `&amp;gt;` en las 32 páginas |
| Una atribución con `url: "javascript:…"` produce un enlace ejecutable en el pie | **No reproducible con el arnés actual**: el `href` sale del dataset sin validar el esquema, pero para probarlo hace falta renderizar el `.astro` con props hostiles y `node --test` no puede importar `.astro` (necesita vite/el container API de Astro, que no está montado). Hoy las 12 estaciones traen `https://`, así que no hay entrada hostil real: queda como **sospecha sin repro**, no como hallazgo |
| Las canónicas o el sitemap se desalinean de las 32 rutas | 32 `<loc>` = 32 rutas construidas; `SITE_URL=https://mareia.example` se respeta en canónicas y sitemap; sin ella, todo apunta a `localhost:4321` con un `console.warn` en el build (deliberado, ver *Juicios*) |
| Algún enlace interno lleva a un 404 | El gate A-3 de la tranche 1, ahora sobre las 32 páginas: verde |
| Se ha colado JavaScript de cliente | El gate «promesa 2», 32 páginas: cero `<script>` ejecutable, cero `on*=`, cero `astro-island` |

## Juicios de producto (A12 — sin test, ponderar como tales)

### J-3 · «Error bajo» y 44 minutos son la misma pantalla

Málaga es **grade B** («predicción validada contra observación con **error bajo**») con
`hw_time_err_p95_min: 43.98` y una carrera de 0,54 m: un error de hora de **44 minutos** sobre una
marea de medio metro. La página lo publica con exactamente la misma tipografía, el mismo tamaño y la
misma ausencia de aviso que A Coruña (grade A, 13 min sobre 3,2 m), y el número solo aparece al final
del todo, en cuerpo pequeño. La promesa dice *«entiende cuándo el dato es flojo»*, y hoy el único
puerto que avisa arriba es el que dispara `micromareal` — que, por A-8, ni siquiera es el criterio
correcto. **No lo reproduzco en test a propósito**: cualquier assert tendría que fijar un umbral
(«>30 min avisa») y ese umbral es una decisión de producto, no mía.

### J-4 · La cifra grande del coeficiente no dice sobre qué se mide

El coeficiente es **de la marea de Brest** (escala francesa, U = 3,05 m) y por eso el mismo número
—88 el 28 de agosto— sale en las doce páginas. En la cabecera se pinta como una cifra grande en
terracota junto al nombre del puerto, sin una palabra que lo aclare; la única mención a Brest está en
el pie, en la lista de fuentes, a una tabla mensual de distancia. Un lector de Cádiz lee «88 · marea
viva» como una propiedad de Cádiz. Curiosamente, el propio componente cree que ya lo dice
(`Coeficiente.astro`: *«Por eso el bloque lo dice en su nota»* — el bloque no lo dice). No es un dato
falso, es un dato al que le falta su etiqueta.

### J-1 (tranche 1) · sigue abierto y ahora es 32 veces más grande

«La página promete *hoy* y entrega una fecha congelada» se registró en la tranche 1 con dos páginas y
sigue igual con 32: `<h2>Mareas de hoy · viernes, 28 de agosto de 2026</h2>`. Mientras T-15 no
garantice el rebuild diario, cada página cacheada o indexada dirá «hoy» de un día que ya pasó. Se
mantiene sin test por la misma razón de entonces: un assert contra `new Date()` es una bomba de
relojería en CI.

## Comandos corridos

| Comando | Resultado |
|---|---|
| `BUILD_DATE=… pnpm --filter web build` × 9 fechas (`2026-08-28`, `2026-03-29`, `2026-10-25`, `2026-04-05`, `2026-08-05`, `2026-01-17`, `2028-02-29`, y dos repeticiones para el determinismo) | ✅ 32 páginas cada uno, ~2-5 s |
| Sonda de la tabla mensual vs `getTides` día a día (12 puertos × 3 fechas) | 🟢 0 diferencias |
| Sonda del HTML vs casos de uso (12 puertos: tabla, coeficiente, sol, luna, carrera) | 🔴 1 mentira (A-8); 🟢 0 discrepancias de dato |
| Barrido de `getAstro` sobre 365 días de 2026 | 🔴 25 días con `no-event` de Luna, todos falsos a esta latitud (A-9, A-10) |
| Barrido de extremos por día civil, 12 puertos × 12 meses | 🟢 mínimo 1 extremo, máximo 6; ninguno a 0 |
| Playwright (Chromium global, `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`) sobre `dist/` servido: 320/360 px, sin CSS, `media: print`, PDF A4 | 🟢 aguantó |
| `node --experimental-strip-types --test src/tmp-red-adversario.test.ts` (**sin trinquete**, para que nazca la evidencia) | 🔴 **5 fail / 0 pass** — la evidencia de los cinco hallazgos |
| `node --experimental-strip-types --test "src/**/*.test.ts"` (**con trinquete**) | ✅ 38/38, con los 5 diagnósticos `A-N sigue abierto — …` |
| `pnpm test` (monorepo) | ✅ 251/251 (domain-core 183, adapters 11, usecases 13, module-contract 6, web 38) |
| `pnpm lint` (gate anti-slop) | ✅ verde |
| `pnpm typecheck` | ✅ verde |

## Recuento

**5 reproducidos · 19 no reproducidos · 3 juicios de producto (J-3, J-4 y J-1 heredado)** → al ledger
(`Contexto_Base_SRE/04_Logs_de_Trayectoria/adversarial_ledger.md`).

Los cinco quedan **abiertos con trinquete**: CI sigue verde y cada run imprime el motivo. El día que
alguien los arregle —aunque sea sin querer— el test dirá «ya no falla, quita el trinquete» y el
ataque pasará a gate permanente, como los siete de la tranche 1.
