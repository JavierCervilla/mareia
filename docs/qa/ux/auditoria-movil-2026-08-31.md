# Auditoría de UX/UI en móvil — mareia.cervilla.es

**Fecha:** 2026-08-31 · **Método:** Playwright + Chromium 1234, medición con JS en la página
**Viewports:** 360×800 DPR 3 (Android), 390×844 DPR 3 (iPhone), 1280×900 DPR 1 (control)
**Páginas:** 9 (portada · índice nacional · región · provincia · 3 puertos de los 3 caladeros ·
catálogo de especies · 404) × 3 viewports = **27 mediciones**
**Datos crudos:** `/tmp/ux-audit/datos/` · **Capturas:** `/tmp/ux-audit/capturas/` · **Recortes:** `/tmp/ux-audit/recortes/`

---

## 1. Veredicto en tres líneas

1. **El portal es usable en móvil salvo en una página.** Ocho de las nueve páginas medidas no parten
   ni una sola palabra, no desbordan, no bajan de 5,42:1 de contraste y tienen la prosa a 15 px con
   interlínea 1,45. El texto corrido de este sitio en un móvil está **bien**.
2. **Lo peor, con diferencia, es `/pesca/especies/`**: a 360 px hay **376 palabras partidas por la
   mitad**, y **467 de los 484 cortes de línea intrapalabra de la tabla (el 96 %) caen en la tercera
   columna**, que mide **62,3 px = 8,9 `ch`**; y su cabecera
   («CALADEROS QUE LA REGULAN · REGISTROS EN OBIS») se pinta en **10 líneas** a 3,7 caracteres por
   línea. Es la página que publica qué caladero regula cada especie y con qué talla, y ese dato es
   el que queda ilegible.
3. **La causa no es «faltan `@media`»**: es **una regla concreta**, `.tabla-especies th, td {
   overflow-wrap: anywhere }`. Verificado quitándola en el navegador: las 376 roturas pasan a **0**,
   la columna sube de 8,9 a **14,8 `ch`** y la página **encoge un 34 %** (56.626 → 37.404 px). Las
   otras cuatro hojas sin `@media` (`tallas-minimas`, `areas-protegidas`, `actividad-solunar`,
   `indices`) **no producen daño medible** a 360 px.

---

## 2. Hallazgos por gravedad

Gravedad = cuánto impide **leer el dato que la página existe para publicar**.

| # | Gravedad | Página | Viewport | Medida exacta | Elemento / selector | Tipo de arreglo |
|---|----------|--------|----------|---------------|---------------------|-----------------|
| **H-1** | **Crítico** | `/pesca/especies/` | 360 y 390 | **376** palabras partidas a media palabra a 360 px (**217** a 390). **35 palabras distintas**: `Cantáb/rico`, `Medite/rráneo`, `noroest/e`, `abundan/cia`, `conjunto/s`, `Calad/eros`, `Regis/tros`, `Internaci/onal`, `Explorac/ión`, `profesio/nal`, `recreativ/a`, `centímet/ros`, `divisione/s`. A 1280 px: **0**. | `.tabla-especies th, .tabla-especies td { overflow-wrap: anywhere }` (`especies.css:269`) aplicado a **toda** la tabla | **Restringir la regla al binomio**, no a la tabla. `anywhere` se puso a propósito para reducir el min-content y que la tabla no empujara — y por eso mismo deja que la columna 3 colapse a 8,9 `ch`. Con `overflow-wrap: normal` en `th/td` y `anywhere` sólo en `.tabla-especies__boe/__aceptado`: 376 → **1** rotura. |
| **H-2** | **Crítico** | `/pesca/especies/` | 360 y 390 | Columna 3 = **62,3 px / 8,9 `ch`** a 360 px (66,8 px / 9,5 `ch` a 390). Contiene el nombre del caladero, la talla y la nota legal. El umbral en el que una palabra española normal deja de caber es ~12 `ch`. | `td` 3.ª de `table.tabla-especies` con `table-layout: auto` | Mismo arreglo que H-1: al quitar `anywhere` la columna sube sola a **14,8 `ch`**. **No hace falta contenedor con desplazamiento** a 360/390 px: medido, el documento no gana scroll horizontal (`scrollWidth` = `innerWidth`). **Por debajo de ~340 px sí**: a 320 px la tabla arreglada fuerza 27 px de scroll. |
| **H-3** | **Alto** | `/pesca/especies/` | 360, 390 y **también 1280** | La cabecera de la col. 3 se pinta en **10 líneas** a **3,7 caracteres/línea** a 360 px; **8** a 412 px; **5** a 600 px; **3** aún a 1280 px. Es la avería «letra por línea» de la captura del humano. | `.tabla-especies thead th { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase }` sobre un título de **43 caracteres** en 8,9 `ch` | **Rótulo más corto o sin tracking cuando la columna es estrecha.** 0,22 em de tracking sobre 11 px añaden 2,42 px por letra: en 62 px caben 3,7 caracteres. El tracking es una decisión tipográfica del sitio y funciona en los rótulos anchos; lo que no puede es convivir con una cabecera de 43 caracteres en una columna de 8,9 `ch`. |
| **H-4** | **Alto** | `/pesca/especies/` | 360 y 390 | La tabla mide **53.194 px** de alto (86 filas) y la página **56.626 px** = **70,8 pantallas**. Sin cabecera fija ni primera columna fija: al llegar a la fila 40 no se ve de qué columna es cada cosa. | `table.tabla-especies` — sin `position: sticky` en `thead` ni en la 1.ª columna, sin contenedor `overflow-x` | **Ficha apilada por debajo de ~700 px**, no contenedor con desplazamiento. Motivo: no es una tabla de comparar (3 columnas, una de ellas prosa larga de 62 `ch`); es una ficha por especie que se ha maquetado en filas. Medido: apilando las celdas la página cae a **30.277 px** (−47 %). Un `thead` fijo tampoco sirve a 70 pantallas de scroll. |
| **H-5** | **Medio** | página de puerto (los 3 caladeros) | **sólo 360** | **25 de 31** filas de la tabla del mes separan la altura de marea de su unidad por un salto de línea: `3,33` / `m`, `3,23` / `m`. A 390 px y 1280 px: **0**. | `.tabla-mes__mareas` (celda de 203 px / 22,6 `ch`) | **`white-space: nowrap` en el par cifra+unidad** (o `&nbsp;`). Es un arreglo de una línea: la cifra y su unidad son un único dato y no deben poder separarse. Gravedad media y no alta porque el número sigue leyéndose, pero es exactamente el dato que la página publica. |
| **H-6** | **Medio** | portada, región, 404 | 360 y 390 | **153 enlaces de puerto** en la portada, cada uno de **320 × 21,8 px**, con **23 px de hueco muerto** entre uno y el siguiente (paso vertical 44,8 px). El ritmo respeta los 44 px; el **área pulsable, no**: es la mitad. En la portada **170 de 170** objetivos interactivos bajan de 44 px de alto. | `a.indice__enlace` (alto 21,8 px) dentro de `li.indice__entrada` (alto 40,8 px, `padding: 9px 0`) | **Mover el relleno del `li` al `a`** (`display:block; padding:9px 0`). Nota honesta: como el hueco está vacío, un toque fallido **no acierta el enlace equivocado**, sólo no acierta ninguno. Por eso es medio y no alto. |
| **H-7** | **Medio** | página de puerto | 360 y 390 | El dato principal (la tabla de mareas de hoy) empieza en **y = 1.256 px = 1,6 pantallas**. En `/pesca/especies/` la tabla empieza en **y = 2.741 px = 3,4 pantallas**. La cabecera+migas+aviso ocupan un razonable **18,2 %** de la primera pantalla. | prosa introductoria antes del dato en `main.pagina` | **Ninguno de maquetación**: no es un problema de CSS sino de orden de contenido. Lo apunto medido para que se decida a propósito; el aviso «NO APTO PARA NAVEGACIÓN» encima del dato es una decisión editorial defendible. |
| **H-8** | **Bajo** | página de puerto, portada, 404 | 360 y 390 | **29** elementos de texto a **11 px** en la página de puerto (12 en portada, 5 en especies). El token `--m-text-eyebrow` vale **11 px** y sólo sube a 12 px en `@media (width>=1100px)`: es decir, la letra pequeña **sólo es pequeña en móvil**. | `--m-text-eyebrow: 11px` (`packages/ui/src/tokens.css:48`) sobre `.etiqueta`, `thead th`, `.tabla-mes thead th` | **Invertir el `@media` del token**: subir el rótulo a 12 px en móvil y dejar 11 px como excepción, o simplemente 12 px en todas partes. Son rótulos en versalita, no texto de lectura: el impacto real es bajo, pero el criterio de 12 px es el que se pidió medir y estos 46 elementos lo incumplen. |
| **H-9** | **Bajo** | página de puerto | 360 y 390 | **6** elementos con `letter-spacing` que envuelven a más de una línea (4 a 390 px, 2 a 1280 px), a **5,5–9,5 caracteres/línea**: `TALLA MÍNIMA` (2 líneas), `COMO LO ESCRIBE EL BOE` (3), `FRANJA HORARIA` (2), `DISTANCIA APROXIMADA` (2). | `thead th` de `.tabla-tallas`, `.tabla-solunar`, `.tabla-areas` | **Ninguno urgente.** Verificado en captura: se leen perfectamente. Lo listo por completitud de la medida 4 del encargo y para separarlo de H-3, que es el mismo mecanismo llevado a 10 líneas. |
| — | **Nulo** | todas | todos | **0 desbordamientos horizontales** en las 27 mediciones. `documentElement.scrollWidth == innerWidth` siempre. | — | — |
| — | **Nulo** | todas | todos | **0 textos** por debajo de 4,5:1. Mínimo medido **5,42:1** sobre **3.283** elementos de texto. | — | — |
| — | **Nulo** | todas | todos | **0** párrafos con interlínea < 1,2. `body { line-height: 1.45 }`. | — | — |

---

## 3. Qué comparten los hallazgos

**Tres causas explican los nueve hallazgos. Ninguna es «faltan `@media`».**

### Causa A — `overflow-wrap: anywhere` aplicado a una tabla entera (H-1, H-2, H-4)

Reparto de las 376 roturas a 360 px, por elemento:

| elemento | roturas | qué es |
|---|---|---|
| `span.tabla-especies__presencia` | **204** | «6 registros de 3 conjuntos de datos, entre…» — prosa en 6,9 `ch` |
| `span.tabla-especies__caladero` | **135** | el nombre del caladero: `Cantáb/rico`, `Medite/rráneo` |
| `span.tabla-especies__nota` | 19 | la nota que **cambia la cifra legal** («36 cm pasan a 44 en 8a y 8b») |
| `span.tabla-especies__boe` | 11 | el binomio científico — **el único caso para el que `anywhere` se puso** |
| `th` (cabecera) | 3 | `Calad/eros`, `regu/lan`, `Regis/tros` |
| `span.tabla-especies__medida` | 3 | |
| `span.tabla-especies__comun` | 1 | |

**365 de las 376 roturas son daño colateral**: sólo 11 caen en el elemento que la regla venía a curar.

`especies.css:269` lo pone en **todos** los `th` y `td` de `.tabla-especies`. El propio comentario del
autor explica por qué eligió `anywhere` y no `break-word`: *«sólo aquélla reduce el tamaño mínimo de
contenido, que es lo que empuja al contenedor»*. Es correcto y es exactamente el problema: al anular el
`min-content` de **todas** las celdas, el algoritmo de tabla `auto` queda libre para dar a la columna 3
lo que le sobre — 8,9 `ch` — y `anywhere` se encarga de que ahí quepa cualquier cosa, letra a letra.
La cura pensada para dos binomios científicos (`Dicologoglossa cuneata`) se aplicó a las 258 celdas.

Verificado en navegador (inyectando CSS, sin tocar el repo):

| escenario | palabras partidas | ancho col. 3 | alto de página |
|---|---|---|---|
| A — tal cual está | **376** | 8,9 `ch` | 56.626 px |
| B — `overflow-wrap: normal` en `th/td` | **0** | 14,8 `ch` | 37.404 px |
| C — `anywhere` sólo en `__boe`/`__aceptado` | **1** | 14,8 `ch` | 37.404 px |
| D — C + celdas apiladas | **0** | — | 30.277 px |

### Causa B — el mismo `thead th` en cinco tablas: 11 px + 0,22 em de tracking + versalita (H-3, H-8, H-9)
La receta `font-size: var(--m-text-eyebrow); letter-spacing: var(--m-track-label); text-transform:
uppercase` se repite literalmente en `.tabla-especies`, `.tabla-tallas`, `.tabla-solunar`,
`.tabla-areas` (y con `--m-track-eyebrow` en `.tabla-mes`). A 11 px, 0,22 em son **2,42 px por letra**:
un rótulo cuesta ~40 % más de ancho del que ocuparía sin tracking. **Funciona en las cuatro tablas de la
página de puerto** (2-3 líneas, legible — ver recortes 03 y 05) y **revienta en la quinta**, porque allí
la columna mide 8,9 `ch` y el rótulo 43 caracteres. Es decir: **la receta no está mal; está mal el
maridaje con la Causa A.** Si se arregla A, H-3 baja de 10 líneas a ~5.

### Causa C — el área pulsable no coincide con el ritmo vertical (H-6)
El `padding: 9px 0` está en el `li`, no en el `a`. Sale un ritmo de 44,8 px (correcto) con un blanco
pulsable de 21,8 px (la mitad). Afecta a las **153** entradas de la portada, las **41** de la región y
las **167** del 404: en total el grueso de la navegación del portal. Un solo cambio de dos líneas las
arregla todas.

### Lo que la hipótesis de partida acertó y lo que no
- **Acertó:** `especies.css` no tiene ni una `@media` y es la hoja que rompe la página.
- **No acertó:** las otras cuatro hojas sin `@media` (`tallas-minimas`, `areas-protegidas`,
  `actividad-solunar`, `indices`) **rinden bien a 360 px** — 0 palabras partidas, 0 desbordamiento,
  tablas legibles (recortes 03, 04, 05, 09). La base del sitio es *mobile-first*: los tokens sólo tienen
  `@media (width>=1100px)` para **subir** tamaños en escritorio, así que la ausencia de `@media` en una
  hoja de módulo no implica nada por sí sola. **Contar `@media` no habría encontrado H-1 ni descartado
  las otras cuatro hojas; medir el render sí.**

---

## 4. Qué páginas están BIEN (con su medida)

A 360 px y 390 px, salvo que se indique otra cosa:

| Página | Palabras partidas | Desborde | Contraste mín. | Interlínea | Veredicto |
|---|---|---|---|---|---|
| **portada** `/` | **0** | no | 5,42:1 | 1,45 | Bien salvo el área pulsable (H-6). 153 puertos en 8.185 px. |
| **índice nacional** `/mareas/` | **0** | no | 5,42:1 | 1,45 | **Impecable.** 972 px, 14 enlaces, 0 hallazgos de cualquier clase. |
| **región** `/mareas/andalucia/` | **0** | no | 5,42:1 | 1,45 | Bien salvo H-6 y 6 rótulos a 11 px. |
| **provincia** `/mareas/andalucia/cadiz/` | **0** | no | 5,42:1 | 1,45 | **Impecable.** 853 px, dato visible a 0,4 pantallas, 0 rótulos a 11 px. |
| **puerto** ×3 (Cádiz, Gandía, LPGC) | **0** a media palabra (las 3 roturas son en `/` o `-` de una URL, legítimas) | no | 5,42:1 | 1,45 | **Las cinco tablas de módulo se leen.** Ver recortes 03/05/09. Sólo H-5 (unidad separada, sólo a 360) y H-8. |
| **404** | **0** | no | 5,42:1 | 1,45 | Devuelve el índice completo de puertos. Bien salvo H-6. |
| `/pesca/especies/` | **376** | no | 5,42:1 | 1,45 | **La única rota.** |

**Lo que hay que preservar explícitamente:**
- **Contraste.** 3.283 elementos de texto medidos en 27 páginas×viewport; **mínimo 5,42:1**, mediana
  entre 5,78:1 y 12,59:1. Ni un solo fallo de WCAG AA. La paleta `oklch` está bien elegida.
- **Cero desbordamiento horizontal** en las 27 mediciones. El grid usa `minmax(0,1fr)` en todas partes
  y eso está haciendo su trabajo.
- **La prosa a 360 px.** 15 px, interlínea 1,45, medida de columna ~35 `ch`: se lee mejor que en la
  mayoría de portales de datos. Ver recorte 06.
- **Los controles sí se pensaron para el dedo** donde hay controles: `.filtro__opcion`,
  `.filtro-caladero__opcion`, `.sin-red__accion`, `.otro-dia__accion` y `.otro-dia__fecha` llevan todos
  `min-height: 44px` explícito. H-6 es una omisión en los enlaces de lista, no un descuido general.
- **La tabla de tallas mínimas se lee a 360 px** (recorte 03): la cifra legal —`30 cm`, `15 cm`,
  `La norma no fija talla`— sale en cuerpo 15 px sin partir. Es el dato más delicado del portal y
  **está bien**.

### Sobre `ficha-especie.css` (la única hoja con `@media` de maquetación)
**No se puede medir en producción: las fichas no están desplegadas.** El sitemap no trae ni una
(`/pesca/especies/<clave>/`), el catálogo no enlaza a ninguna y las tres claves reales que probé
(`alosa-spp-8c0b29`, `boops-boops-4520ef`, `conger-conger-c8ac0d`) devuelven **404**. Su
`@media (width>=700px)` sobre `.ficha__campo` es, hoy, **código muerto en producción**. No lo puedo
puntuar ni a favor ni en contra; lo dejo dicho en vez de estimarlo.

---

## 5. Qué de esto es convertible en gate determinista

Los gates actuales del portal miran el `dist/` (HTML/JSON). **Ninguno ha mirado nunca un ancho de
pantalla.** De las nueve cosas medidas, cinco son deterministas, baratas y no opinables. Van ordenadas
por relación señal/coste.

| Gate | Umbral propuesto | Cómo se mide | Coste | Falsos positivos |
|---|---|---|---|---|
| **G1 · Palabra partida a media palabra** | **0** en toda página, a 320/360/390 px | `Range` por palabra + `getClientRects()`; se cuenta rotura sólo si el carácter anterior **y** el posterior al corte son letras (`\p{L}`). Eso deja fuera URLs, guiones y códigos, que **sí** deben poder romper. | Bajo. ~2 s/página. | **Ninguno observado**: 8 de 9 páginas dan 0 hoy y la que falla, falla con 376. Separa perfecto. Es el gate que habría cazado esto. |
| **G2 · Desbordamiento horizontal** | `documentElement.scrollWidth <= innerWidth + 1` a 320/360/390 px | Una línea de JS. Si falla, listar los elementos con `right > innerWidth`. | Trivial. | Ninguno. Hoy pasa en las 27 mediciones: es un gate que nace **en verde**, que es como hay que instalarlos. |
| **G3 · Ancho de columna de tabla en `ch`** | Ninguna celda con texto por debajo de **10 `ch`** a 360 px | `width / measureText('0').width` con la `font` computada de la celda. | Bajo. | Bajo, si se limita a `td`/`th` **con palabras** (>3 letras) y se exceptúan las celdas puramente numéricas (`font-variant-numeric: tabular-nums`) y las `.solo-lectores`. Hoy sólo lo incumple la col. 3 de `.tabla-especies` (8,9 `ch`). |
| **G4 · Contraste WCAG AA** | ≥ 4,5:1 normal / 3:1 grande | Ya implementado y validado en esta auditoría. **Aviso**: hay que resolver el color con el motor (canvas `fillStyle` + `getImageData`), no con una regex de `rgb()`. Este sitio usa `oklch()` y una regex devuelve **0 hallazgos falsamente**, que es peor que no medir. | Bajo. | Ninguno. Margen actual 5,42 vs 4,5 → el gate nace en verde con holgura, y avisará si alguien retoca la paleta. |
| **G5 · Objetivo táctil** | ≥ 44×44 px el **área pulsable**, no el paso vertical | `getBoundingClientRect()` sobre `a[href], button, input, select, [role=button]`. | Bajo. | **Alto tal cual**: hoy fallarían 170/170 en la portada. **Instalar en modo aviso**, o con umbral de altura 24 px + separación ≥ 8 px hasta que se corrija H-6. Si no, el gate nace en rojo y se ignora, que es como mueren los gates. |

**Deliberadamente fuera del gate** (medibles pero de juicio, no de umbral):
- **`letter-spacing` sobre texto que envuelve** (H-3/H-9). El umbral honesto no es «envuelve» sino
  «caracteres por línea»: `< 5` es una avería, `6-10` es una decisión tipográfica. Se puede vigilar
  como **presupuesto** («ningún rótulo de cabecera por debajo de 5 caracteres/línea»), no como binario.
- **Letra < 12 px** (H-8). El sitio usa 11 px a propósito en rótulos de versalita. Un gate binario
  obligaría a discutir el token en cada PR. Mejor como **inventario** que se revisa, no como bloqueo.
- **Above-the-fold** (H-7). No hay umbral defendible: «el dato a menos de N pantallas» depende de si
  el aviso legal debe ir primero, y eso es editorial.

**Sugerencia de instalación:** G1 + G2 + G4 pueden ir hoy como gate duro (los tres nacen en verde y
G1 habría cazado el fallo del que sale esta auditoría). G3 duro en cuanto se cierre H-1. G5 en aviso
hasta que se cierre H-6.

---

## 6. Evidencia

### Capturas de página completa — `/tmp/ux-audit/capturas/`
`<slug>--<ancho>.png`, 27 ficheros:
`portada`, `mareas-indice`, `region-andalucia`, `provincia-cadiz`, `puerto-cadiz`,
`puerto-valencia-gandia`, `puerto-canarias-lpgc`, `especies-catalogo`, `error-404`
× `360`, `390`, `1280`.

### Recortes de lo peor — `/tmp/ux-audit/recortes/`
| Fichero | Qué enseña |
|---|---|
| `01-especies-cabecera-vertical--360.png` | **El disparador, reproducido.** `C A L A D / E R O S / Q U E / L A / R E G U / L A N ·` en 10 líneas, y debajo `Cantáb/rico`, `noroest/e`, `conjunto/s`. |
| `02-especies-palabras-partidas--360.png` | Una fila completa del catálogo con la columna 3 a 8,9 `ch`. |
| `03-puerto-tallas-cabecera--360.png` | **Contraejemplo:** la tabla de tallas mínimas a 360 px, legible. `30 cm`, `15 cm`, `La norma no fija talla`. |
| `04-puerto-solunar-cabecera--360.png` | Tabla solunar a 360 px, legible. |
| `05-puerto-areas-cabecera--360.png` | Áreas protegidas a 360 px, legible. |
| `06-especies-primera-pantalla--360.png` | La prosa del portal a 360 px: bien. El problema empieza 3,4 pantallas más abajo. |
| `07-puerto-primera-pantalla--360.png` | Primera pantalla de la página de puerto. |
| `08-portada-primera-pantalla--360.png` | Primera pantalla de la portada. |
| `09-puerto-tabla-mes--360.png` | H-5: `3,33` y su `m` en líneas distintas, 25 veces de 31. |

### Datos crudos — `/tmp/ux-audit/datos/`
- `resultados.json` — las 27 mediciones completas (9 apartados por página×viewport).
- `clasificacion-cortes.json` — roturas clasificadas en «a media palabra» vs «en guion/barra».
- `especies-columnas-360.json` — anatomía de la tabla de especies columna a columna.

### Scripts (reproducibles) — `/tmp/ux-audit/`
`medir.js` (medición en página) · `auditar.mjs` (barrido 9×3) · `clasificar.mjs` ·
`barrido.mjs` (11 anchos de 320 a 1280) · `recortes.mjs`, `recortes2.mjs` · `fold.mjs` ·
`mirror.sh` + `servidor.mjs` (espejo local).

---

## 7. Barrido de anchos: dónde deja de romperse

Palabras partidas a media palabra en `/pesca/especies/`:

| ancho | 320 | 360 | 375 | 390 | 412 | 430 | 480 | 600 | 768 | 1024 | 1280 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **roturas** | **866** | **484** | **379** | **219** | **211** | **210** | **88** | **36** | 0 | 0 | 0 |
| **col. 3** | 8,0 `ch` | 8,9 | 9,2 | 9,5 | 10,0 | 10,4 | 11,5 | 14,1 | 17,7 | 23,2 | 27,7 |
| **líneas cabecera** | 11 | 10 | 10 | 10 | 8 | 8 | 8 | 5 | 5 | 4 | 3 |

La página **no se arregla sola hasta los 768 px**: no es un caso límite de móviles pequeños, es
**todo el rango de móvil y tableta en vertical**. La correlación con el ancho de la columna 3 es
directa y el umbral está en ~14 `ch`, coherente con el criterio de 12 `ch` del encargo.

---

## 8. Nota de método (limitación conocida, declarada)

**Chromium no puede alcanzar ningún destino HTTPS a través del proxy de agente de este entorno**:
`net::ERR_CONNECTION_RESET` contra `mareia.cervilla.es`, `example.com` y `fonts.googleapis.com` por
igual, con y sin `--proxy-server` explícito (`recentRelayFailures` del proxy: `ws_closed_mid_exchange`,
código 1006). `curl` sí funciona.

Por eso las mediciones se han hecho sobre un **espejo byte a byte de producción** servido en
`127.0.0.1:8899`: las 9 páginas descargadas con `curl` y user-agent de Android, más `AlmanaqueLayout.
BkUn175Q.css` (la **única** hoja del sitio, 22.967 B), los 2 scripts y **las 10 fuentes `woff2` de
Google descargadas y re-servidas en local**. La única modificación al HTML es reescribir el `<link>` de
Google Fonts a la copia local y quitar los `preconnect`. **El árbol de render y las métricas
tipográficas son idénticos a producción**; lo que no se ha medido con esto es latencia de red ni
`font-display: swap` real. Todo lo que se afirma arriba es geometría de layout, que no depende de eso.

Segunda nota: la primera pasada de contraste devolvió **0 hallazgos falsamente** porque el sitio usa
`oklch()` y el parser de color esperaba `rgb()`. Se detectó comprobando la **distribución** de ratios
(salían 0 muestras de 487 elementos), se corrigió resolviendo el color con el motor del navegador, y se
volvió a correr la auditoría entera. Los 5,42:1 del apartado 4 son de la pasada corregida.

Tercera nota: no se han auditado meteo/almanaque/normativa como páginas propias porque **no existen**:
son secciones (`#meteo`, `#actividad-solunar`, `#tallas-minimas`, `#areas-protegidas`, `#especies`) de
la página de puerto, que sí está auditada en sus tres caladeros. Las 86 fichas de especie no están
desplegadas (404).
