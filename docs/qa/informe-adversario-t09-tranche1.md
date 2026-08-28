# Informe adversario — página de puerto, tranche 1 (T-09)

- **Trayectoria:** T-09 · **PR:** #6 (`claude/design-6dty63`) · **Fecha:** 2026-08-28
- **Superficie atacada:** `apps/web/src/pages/puerto/santander.astro`, `apps/web/src/grafico-marea.ts`,
  `apps/web/src/layouts/AlmanaqueLayout.astro`, `packages/ui/src/tokens.css` y el sitio construido
  (`apps/web/dist/`).
- **Entorno:** local y efímero — build estático de Astro + `node --test`. Sin cloud: ni el diff, ni el
  DOM, ni el código han salido del contenedor.
- **Reproducciones:** `apps/web/src/adversario-t09.test.ts` (referencias A-1…A-7).
  Van ahí, y no en `tests/e2e/journeys/adversarial/`, porque en este repo **no hay runner de
  Playwright todavía**: los ataques que sí puedo reproducir son deterministas sobre el generador de
  curva y sobre el HTML/CSS construidos, y el arnés que los corre en CI es
  `node --experimental-strip-types --test src/*.test.ts` (job `web`). Cuando entre Playwright, los
  ataques que necesiten navegador (los listados en *No reproducidos*) se escriben allí.

> **Trinquete.** `test.fail()` es de Playwright; el equivalente aquí es el helper `hallazgoAbierto()`
> del propio fichero: ejecuta un cuerpo que afirma **el comportamiento correcto**, deja CI en verde
> mientras el bug esté abierto (imprimiendo el motivo como diagnóstico en cada ejecución) y **se pone
> en rojo el día que alguien lo arregle**, pidiendo que se retire el trinquete para que el ataque
> quede como gate permanente. Misma tabla de verdad que `test.fail()`, mismo caveat: se conforma con
> que el cuerpo falle por cualquier motivo, por eso cada assert es específico y el motivo se imprime.

## Promesa

La página de puerto entrega, en HTML estático y sin una línea de JavaScript de cliente, el almanaque
del día —horas y alturas de marea, coeficiente, sol, luna, solunar y estado de la mar— con una curva
SVG que pasa por los extremos, cubre las 24 h, es monótona entre extremos y está acotada **para
cualquier fixture válido**, en tema claro y noche, y accesible en lo que promete (tabla real,
aria-labels del rating).

## Clases atacadas

| Clase | Hipótesis (entrada concreta) | Resultado |
|---|---|---|
| **A5** · límites 0/1/N | Un día de **tres** extremos (`00:20`/`06:35`/`12:50`), que es ~1 de cada 7 en un puerto semidiurno, no un caso raro | 🔴 **roto** → A-1 (curva congelada 295 min) |
| **A5** · límites | Día de **dos** extremos (marea diurna), día con extremos en `00:00`/`23:59`, alturas iguales, alturas negativas bajo el cero del puerto | 🟢 aguantó (las 4 invariantes se mantienen) |
| **A6** · input hostil | Extremos **desordenados** en el tiempo (los cuatro del fixture permutados) | 🔴 **roto** → A-2 (curva falsa, sin error) |
| **A6** · input hostil | Extremos con **la misma hora** repetida (`04:12` dos veces) | 🔴 mismo mecanismo que A-2, no se cuenta aparte |
| **A6** · input hostil | Alturas `±1e308` → `NaN` en el `d` del path y en los `cy` de los círculos | 🟡 fuera de contrato (ver *No reproducidos*) |
| **A6** · inyección | **Build completo con fixture hostil**: `<script>`, `" onload=`, `autofocus onfocus=`, `<img src=x onerror=` en `nombre`, `region`, `coordenadas`, `fechaISO`, `fechaTexto`, `tipo`, `fase`, `fuente`, `procedencia`… | 🔴 **roto parcialmente** → A-4 (marcado crudo en atributo; **no ejecutable**) |
| **A6** · inyección | Los mismos payloads en texto (`<h1>`, `<title>`, tabla, solunar) y en atributos entrecomillados (`datetime`, `data-tipo`, `aria-label`, `viewBox`, `d`) | 🟢 aguantó: Astro escapa `&` y `"`; imposible salir del atributo |
| **A9** · callejón sin salida | Seguir cada enlace del HTML construido | 🔴 **roto** → A-3 (`/metodologia/` es un 404) |
| **A12** · promesa vs entregado | Releer la spec ignorando el ticket: ¿sirve el segundo día? ¿qué dice la página de sí misma? | 🔴 **dos juicios** (ver *Juicios de producto*) |
| Promesa 2 · cero JS | `grep` de `<script>`, de handlers `on*=` y de `astro-island` en `dist/` | 🟢 aguantó (gate permanente añadido) |
| Promesa 4 · tema | Contraste WCAG de los 8 pares de tokens en claro y noche; guarda `:root:not([data-theme="claro"])` frente a la preferencia del SO | 🟢 aguantó (mínimo 5,42:1 — ver *No reproducidos*) |
| Promesa 4 · tema | `color-scheme` bajo `data-theme` forzado | 🔴 **roto** → A-7 (cosmético) |
| Promesa 5 · a11y | Landmarks, semántica de la tabla, listas, `aria-label` del rating | 🔴 **roto** → A-5 y A-6 |

**Descartadas y por qué.** La superficie es una **página estática sin servidor, sin sesión, sin
formularios y sin mutación**: no hay nada que enviar dos veces, nada que quede a medias, nada que
reintentar, ningún recurso de otro usuario y ningún estado que revertir. Por eso quedan fuera **A1**
(concurrencia/doble envío), **A3** (fallo parcial), **A4** (idempotencia y reintento), **A7**
(frontera de autorización — no hay autenticación ni recursos por usuario: **nada que escalar a
`seguridad` por esta vía**), **A8** (sesión y caducidad), **A10** (feedback ausente) y **A11**
(reversibilidad). **A2** (estado stale) no aplica en su forma clásica —no hay botón atrás sobre datos
mutados— pero sí en la forma que le toca a un almanaque, y ahí se recoge como juicio J-1.

## Hallazgos

Siete reproducidos, todos con su test en rojo antes de poner el trinquete (evidencia al final).
Ninguno es una vulnerabilidad explotable; el más grave es un dato **falso presentado como cierto**.

> **Los siete están corregidos en este PR** (ver el «Estado» de cada uno). Los trinquetes se han
> retirado y **los mismos cuerpos, sin tocar una línea de sus asserts**, se quedan como gates
> permanentes en `apps/web/src/adversario-t09.test.ts`: un recorrido adversario arreglado no se
> borra, se queda vigilando.

### A-1 · A5 · La curva se congela hasta cinco horas en un día de tres extremos

- **Qué se consigue:** en cualquier día con **tres** extremos —~1 de cada 7 en un puerto
  semidiurno— el gráfico dibuja una **recta horizontal de hasta 295 min (20 % del ancho)**: una
  pleamar (o una bajamar) que dura cinco horas y luego salta. No es «menos preciso»: es falso, y
  nada en la página lo indica. Con los cuatro extremos del fixture no se ve nunca, porque con cuatro
  extremos el reflejo virtual siempre rebasa los dos bordes del día.
- **Dónde se manifiesta:** `apps/web/src/grafico-marea.ts:104` (el recorte `Math.min/Math.max`) sobre
  los nodos virtuales de `:82-86`.
- **Medido:** `00:20`/`06:35`/`12:50` → 295 min planos desde las 19:05 (20,5 % del día);
  `11:00`/`17:10`/`23:20` → 290 min planos desde las 00:00 (20,1 %).
- **Repro:** `apps/web/src/adversario-t09.test.ts` → `A-1 · la curva no se congela en un día de tres
  extremos`.
- **Estado:** ~~abierto (trinquete puesto)~~ → **corregido en este PR**. `nodosDelDia` repite el
  reflejo de los extremos virtuales hasta rebasar las 00:00 y las 24:00, así que el periodo del día
  continúa por los dos bordes en vez de aplanarse; el recorte de `alturaEnMinutos` solo entra ya
  fuera del día. Trinquete retirado y recorrido convertido en **gate permanente**: `A-1 · la curva
  no se congela en un día de tres extremos`.
- **Severidad:** **alta para el dominio** — dato de marea silenciosamente falso en una app de
  mareas, en el bloque más visible de la página. Mitiga (no cancela) el aviso «No apto para
  navegación».
- **Escalado:** no (no es seguridad).

### A-2 · A6 · Unos extremos desordenados producen una curva falsa, sin un solo error

- **Qué se consigue:** con los mismos cuatro extremos del fixture **permutados**,
  `trazarCurvaMarea` devuelve una curva de aspecto perfectamente normal: los cuatro círculos de
  pleamar/bajamar quedan hasta a **128 px** del trazo que se dibuja, y `alturaEnMinutos` devuelve la
  misma altura (0,87 m) para los cuatro extremos. El módulo valida el **número** de extremos (lanza
  con menos de dos) pero no su **orden**, así que el mismo contrato falla ruidoso en un caso y mudo
  en el otro.
- **Por qué importa hoy:** el fixture está ordenado a mano, pero su propia cabecera dice que **T-05
  lo sustituye por la salida del motor armónico**. El día que ese orden no venga garantizado, esto
  no se nota.
- **Repro:** `apps/web/src/adversario-t09.test.ts` → `A-2 · unos extremos desordenados no producen
  una curva falsa en silencio` (acepta como correcto **cualquiera** de las dos salidas honestas:
  lanzar, o dibujar coherente).
- **Estado:** ~~abierto (trinquete puesto)~~ → **corregido en este PR**. `nodosDelDia` exige orden
  temporal estricto y lanza nombrando las dos horas en conflicto, así que el mismo contrato falla
  ruidoso por el número de extremos y por su orden. Trinquete retirado, **gate permanente**: `A-2 ·
  unos extremos desordenados no producen una curva falsa en silencio`.
- **Severidad:** media — hoy latente, mañana el mismo síntoma que A-1 sin manera de detectarlo.
- **Escalado:** no.

### A-3 · A9 · El pie enlaza a `/metodologia/`, que no existe

- **Qué se consigue:** el usuario que desconfía del número pulsa «metodología» —el único enlace que
  la página ofrece para explicar de dónde sale el dato, justo al lado de «No apto para
  navegación»— y cae en un **404** sin vuelta. Está en todas las páginas de puerto.
- **Dónde se manifiesta:** `apps/web/src/pages/puerto/santander.astro:199`.
- **Repro:** `apps/web/src/adversario-t09.test.ts` → `A-3 · ningún enlace interno del sitio
  construido lleva a un 404` (comprueba **todos** los `href` internos de todas las páginas
  construidas, no solo éste).
- **Estado:** ~~abierto (trinquete puesto)~~ → **corregido en este PR**. El pie ya no enlaza a una
  página que no existe (la de metodología es otra tranche: no se ha creado, se ha quitado el enlace
  muerto). Trinquete retirado, **gate permanente**: `A-3 · ningún enlace interno del sitio
  construido lleva a un 404` — que además exigirá la página construida el día que vuelva el enlace.
- **Severidad:** media-baja — callejón sin salida, y precisamente en el enlace que sostiene la
  credibilidad del dato.
- **Escalado:** no.

### A-4 · A6 · Un dato con marcado viaja crudo a un atributo del HTML construido

- **Qué se consigue:** construí el sitio con un fixture hostil (nombre de puerto con
  `<script>window.__pwned=1</script>` y `x" onload="…`). Resultado: **el `dist/` contiene dos
  `<script>` literales**, dentro del valor de `<meta name="description">`. Astro escapa `&` y `"` en
  los valores de atributo, pero **no** `<` ni `>`.
- **Lo que NO es, dicho explícitamente:** **no es un XSS**. El tokenizador de HTML no abandona el
  estado «valor de atributo entrecomillado» al ver un `<`, y las comillas sí van escapadas
  (`&quot;`), así que no hay forma de salir del atributo. En el mismo build hostil, el `<h1>`, el
  `<title>`, la tabla, el `datetime`, el `data-tipo` y los `aria-label` **escaparon correctamente**.
- **Lo que sí es:** (a) falsifica la promesa 2 **tal y como se verifica** —el HTML construido pasa a
  contener literales `<script>`, y cualquier gate que haga `grep '<script'` empieza a mentir en un
  sentido o en otro—; (b) deja de ser inocuo en cuanto ese mismo string caiga en un `set:html`, un
  bloque JSON-LD o un `og:description` consumido por otro parser, que es exactamente lo que pide un
  portal orientado a SEO; (c) los datos dejan de ser de confianza en T-05/T-07, cuando vengan de
  adaptadores externos.
- **Repro:** `apps/web/src/adversario-t09.test.ts` → `A-4 · un dato con marcado no viaja crudo a un
  atributo del HTML` (reproduce el mecanismo exacto que produjo el artefacto: `addAttribute` del
  runtime de Astro).
- **Estado:** ~~abierto (trinquete puesto)~~ → **corregido en este PR**. Nuevo
  `apps/web/src/escapar-marcado.ts` (escapa `<`/`>`, que es lo que Astro deja pasar) aplicado en
  `AlmanaqueLayout` al único atributo que compone datos, la `<meta name="description">`. Trinquete
  retirado, **gate permanente**: `A-4 · un dato con marcado no viaja crudo a un atributo del HTML`,
  que sigue atacando el mecanismo real (`addAttribute` del runtime de Astro) con el dato ya
  escapado. El escalado a `seguridad` sigue en pie para que fije la política del proyecto.
- **Severidad:** baja hoy (dato de confianza, no ejecutable), media el día que el dato venga de
  fuera.
- **Escalado:** **sí, al rol `seguridad`**, como defensa en profundidad y para que decida si la
  política del proyecto exige escapar `<`/`>` en atributos. No es A7 y no hay veredicto de seguridad
  aquí: es suyo.

### A-5 · Accesibilidad · La página de puerto no tiene landmark principal

- **Qué se consigue:** todo el contenido cuelga de `<div class="pagina">`. Sin `<main>` no hay
  «saltar al contenido» ni navegación por landmarks: un lector de pantalla recorre cabecera, cuerpo y
  pie sin estructura. La **home del mismo sitio sí lo tiene**
  (`apps/web/src/pages/index.astro:16`), así que no es un criterio traído de fuera: es una
  inconsistencia interna.
- **Repro:** `apps/web/src/adversario-t09.test.ts` → `A-5 · la página de puerto expone un landmark
  principal`.
- **Estado:** ~~abierto (trinquete puesto)~~ → **corregido en este PR**: el contenedor de la página
  es un `<main class="pagina">`. Trinquete retirado, **gate permanente**: `A-5 · la página de puerto
  expone un landmark principal`. **Severidad:** baja. **Escalado:** no.

### A-6 · Accesibilidad · `list-style: none` global quita el rol de lista

- **Qué se consigue:** `AlmanaqueLayout` declara `ul, ol { list-style: none }` en global. WebKit
  retira la semántica de lista cuando la viñeta es `none`, así que en Safari/VoiceOver la **lista
  solunar** y el **eje de horas** dejan de anunciarse como listas: se pierde el «lista de 3
  elementos» y el recuento, que es justo la información que hace navegable el bloque solunar.
- **Repro:** `apps/web/src/adversario-t09.test.ts` → `A-6 · las listas sin viñeta conservan el rol de
  lista` (el test se autodesactiva si algún día deja de quitarse la viñeta).
- **Estado:** ~~abierto (trinquete puesto)~~ → **corregido en este PR**: `role="list"` explícito en
  la lista solunar y en el eje de horas (menos invasivo que acotar la regla global, y el gate cubre
  **todas** las listas de la página, así que la siguiente que se añada sin rol lo pone en rojo).
  Trinquete retirado, **gate permanente**: `A-6 · las listas sin viñeta conservan el rol de lista`.
  **Severidad:** baja. **Escalado:** no.

### A-7 · Tema · `data-theme` cambia la paleta pero no el `color-scheme`

- **Qué se consigue:** `:root { color-scheme: light dark }` deja la decisión al SO. Con
  `data-theme="noche"` sobre un sistema en claro —el **único** caso para el que existe ese
  atributo— la paleta se vuelve oscura pero los widgets de UA (barras de scroll, gutter de
  overscroll, controles de formulario) se quedan en claro sobre página oscura. Simétrico con
  `data-theme="claro"` sobre un sistema en oscuro.
- **Dónde se manifiesta:** `packages/ui/src/tokens.css`, bloques `:root[data-theme="noche"]` y
  `@media (prefers-color-scheme: dark)`.
- **Repro:** `apps/web/src/adversario-t09.test.ts` → `A-7 · el tema forzado por data-theme ajusta
  también el color-scheme`.
- **Estado:** ~~abierto (trinquete puesto)~~ → **corregido en este PR**: `color-scheme` se declara
  ahora en `tokens.css` y **solo ahí** —`light` en `:root`, `dark` en los dos bloques de noche—, y
  se retira el `:root { color-scheme: light dark }` de `AlmanaqueLayout`, que era la segunda fuente
  de verdad que dejaba sin efecto al atributo (en el sentido `data-theme="claro"` ganaba por ser
  posterior). Trinquete retirado, **gate permanente**: `A-7 · el tema forzado por data-theme ajusta
  también el color-scheme`. **Severidad:** muy baja, cosmética. **Escalado:** no.

## No reproducidos

Sospechas que **no** se materializaron, o que no pude materializar con el arnés que hay. Van aquí a
propósito: sin esta lista, una pasada estéril y una pasada alucinada se ven igual desde fuera.

| Sospecha | Qué pasó al intentarlo |
|---|---|
| Inyección de HTML por los strings del fixture (nombre, región, coordenadas, fase lunar, meteo, procedencia) | **Aguantó.** Construí el sitio entero con payloads en todos los campos: en texto (`<h1>`, `<title>`, tabla, solunar, pie) Astro escapa `<`, `>` y `&`; en atributos (`datetime`, `data-tipo`, `aria-label` del SVG y del rating, `viewBox`, `d`) escapa `"` y `&`. **Cero handlers `on*=` inyectados, cero salidas del atributo.** Solo quedó el `<` crudo del A-4, que no es explotable. |
| La curva se sale del lienzo, devuelve `NaN` o rompe la monotonía con alturas negativas, alturas iguales o extremos en `00:00`/`23:59` | **Aguantó** en las seis formas de día válidas probadas: pasa por todos los extremos (±0,01 m), arranca en x=0, acaba en x=620, todas las coordenadas finitas y dentro del lienzo, acotada al rango del día y monótona minuto a minuto entre extremos consecutivos. Convertido en gate permanente (test `promesa 3`). |
| Alturas `±1e308` producen `d="M0,NaN…"` y `cy="NaN"` | **Reproducible, pero fuera de contrato**: `recorrido` se va a `Infinity` y la división da `NaN`. No lo cuento como hallazgo porque ninguna marea válida se acerca; queda anotado por si alguien alimenta el módulo desde una fuente sin validar. |
| Un día con **un solo** extremo (puerto diurno en marea trópica) tumba el build entero | Reproducible —`trazarCurvaMarea` lanza y la build de **todo el sitio** falla, no solo esa página—, pero es **comportamiento deliberado y ya testeado** (`grafico-marea.test.ts:85`). No es un hallazgo: es una decisión de diseño. La anoto porque el radio de daño (todo el sitio, no un puerto) merece revisarse cuando haya catálogo de puertos. |
| El tema noche rompe el contraste | **Aguantó, con margen.** Los 8 pares de tokens sobre su fondo: claro 12,59 / 5,78 / 10,20 / 5,42 : 1 (ink/sub/navy/terra); noche 13,94 / 7,31 / 7,94 / 5,68 : 1. **Todos pasan AA para texto normal** (≥4,5:1); el peor es `--m-terra` en claro con 5,42:1. |
| `data-theme="claro"` pierde contra `prefers-color-scheme: dark` (el error clásico de orden de reglas) | **Aguantó.** La media query lleva la guarda `:root:not([data-theme="claro"])`, así que el atributo explícito gana en los dos sentidos. Está resuelto a propósito y documentado en `tokens.css`. |
| Los círculos de extremo no caen sobre el trazo porque el path se muestrea cada 10 min y los extremos caen a `:12`, `:26`, `:38`, `:51` | **Aguantó.** La desviación máxima es de ~0,035 px (la curva es plana en el extremo y el redondeo del path es a 0,1). Invisible. |
| El nombre de puerto de 10.000 caracteres, el emoji o el RTL revientan la maquetación; el SVG desborda en móvil; el eje de horas se desalinea de la curva | **No reproducible con este arnés.** No hay Playwright ni jsdom en el repo (`node_modules` sin `playwright`/`vitest`/`jsdom`), así que no puedo medir maquetación ni geometría renderizada. Queda como ataque pendiente para cuando entre el runner de navegador. |
| `rating` fuera de `[0, RATING_MAXIMO]` (7, −1, 2,5) trunca en silencio y produce un `aria-label` contradictorio («Actividad 7 de 4») | Reproducible sólo con fixture inválido y `puntosDeRating` no está exportado, así que la reproducción exigiría construir el sitio con datos fuera de contrato. **No lo cuento**: entrada fuera de contrato + sin test aislable. Anotado para cuando el rating venga calculado (T-07). |
| Hay JavaScript de cliente escondido (isla hidratada, script de tema, prefetch de Astro) | **Aguantó.** `dist/puerto/santander/index.html` (9.854 B): cero `<script>`, cero atributos `on*=`, cero `astro-island`. Convertido en gate permanente (test `promesa 2`). |
| Los datos del fixture no llegan íntegros al HTML | **Aguantó.** Las 4 filas de la tabla (`04:12 4,82 m` … `22:51 0,81 m`), el coeficiente 87 y «Mareas vivas», sol `07:37`/`20:52`, luna 99 % y fase, los 3 periodos solunares con 3/2/4 puntos llenos de 4, viento/olas/agua/aire y la procedencia están todos. La fecha `2026-08-28` **sí** es viernes, como dice `fechaTexto`. Gate permanente para la tabla (test `promesa 1`). |
| La tabla es un `<div>` disfrazado y el rating no tiene texto alternativo | **Aguantó.** Es un `<table>` real con `<th scope="row">` por fila, y cada rating es `role="img"` con `aria-label="Actividad N de 4"`. (Sin `<caption>` ni cabeceras de columna para hora/altura, lo cual es mejorable pero no rompe nada: se anuncia «pleamar, 04:12, 4,82 m».) |

## Juicios de producto (A12 — sin test, ponderar como tales)

La única excepción admitida a `repro-or-drop`. **No son hechos verificados por un test**: son
juicios, y se marcan como tales para que se lean distinto.

### J-1 · La página promete «hoy» y entrega una fecha congelada

La home enlaza «**Mareas de hoy** en Santander» y la página responde con `2026-08-28` grabado en el
HTML. Hoy es cierto. Mañana —y todos los días hasta que alguien reconstruya— la home mentirá sin que
nada en la página avise: la fecha aparece en la cabecera, pero en tipografía pequeña y sin ningún
«esto no es hoy». Es el caso del *segundo día* que pide la clase A12: un almanaque estático necesita
o una regeneración diaria garantizada o un aviso explícito cuando la fecha mostrada no es la de hoy,
y la tranche no trae ninguna de las dos. No lo reproduzco en test a propósito: un assert contra
`new Date()` sería una bomba de relojería en CI.

### J-2 · El pie atribuye procedencia REDMAR/Foreman a datos escritos a mano

El pie dice «Constituyentes **REDMAR** · calidad **A** · método **Foreman (1977)** · datos **CC-BY
4.0**» sobre unas cifras que —según la cabecera del propio fixture— son «los mismos valores del
canvas de diseño, escritos a mano». La página se presenta como más fiable de lo que es, y quien vea
una captura en el PR (o la indexe un buscador) no tiene forma de saberlo. Hay indicio objetivo de que
las cifras no están calculadas: los periodos solunares mayores del fixture están centrados a las
06:58 y 19:24, cuando con una luna al 99 % (un día después de la llena) el paso por el meridiano cae
cerca de las 03:00 hora local — un desfase de ~4 h que corresponde a una luna varios días más vieja.
Ninguno de los bloques se valida contra los otros. Mientras el fixture sea provisional, la
procedencia debería decirlo (o no afirmarse); es decisión de arquitectura/producto, no mía.

> **Adoptado como spec y corregido en este PR.** La procedencia la declara ahora el propio dato
> (`procedencia.fuente`, hoy «Datos de muestra (fixture) — pendiente REDMAR») y el pie se limita a
> pintarla: cuando T-05 sustituya el fixture por el motor armónico, el pie dirá la verdad sin tocar
> la página. Como el juicio ya tiene una afirmación comprobable, se le pone **gate permanente**:
> `J-2 · el pie declara la procedencia que trae el dato, no una atribución fija`. J-1 (la fecha
> congelada) sigue abierto y sin test, por lo que dice su propio párrafo.

## Comandos corridos

| Comando | Resultado |
|---|---|
| `pnpm --filter web build` | ✅ 2 páginas en 1,98 s |
| `node --experimental-strip-types probe.ts` (batería de 11 días hostiles contra las 7 invariantes de la curva) | 🔴 rompe en desordenados, hora repetida y `±1e308`; 🟢 en las 8 formas válidas |
| `astro build` con **fixture hostil** (payloads en 12 campos) | 🔴 2 `<script>` literales en `dist` (A-4); resto del escapado correcto |
| `node --test src/tmp-red-adversario.test.ts` (**sin trinquete**, para que nazca la evidencia) | 🔴 **7 fail / 3 pass** — es la evidencia de los siete hallazgos |
| `node --test src/*.test.ts` (**con trinquete**) | ✅ 21/21, con los 7 diagnósticos `A-N sigue abierto — …` |
| `pnpm test` (monorepo) | ✅ verde |
| `pnpm lint` (gate anti-slop) | ✅ verde |
| `pnpm typecheck` | ✅ verde |

### Evidencia del run en rojo (los siete hallazgos, antes del trinquete)

```
not ok 1 - A-1 · la curva no se congela en un día de tres extremos
  error: 'tres extremos, el primero de madrugada: la marea se queda quieta 295 min desde las 19:05 (20.5 % del día)'
not ok 2 - A-2 · unos extremos desordenados no producen una curva falsa en silencio
  error: 'el círculo del extremo de las 16:38 está a 128.1 px del trazo'
not ok 3 - A-3 · ningún enlace interno del sitio construido lleva a un 404
  error: 'enlaces internos rotos en el sitio construido: /metodologia/'
not ok 4 - A-4 · un dato con marcado no viaja crudo a un atributo del HTML
  error: 'el atributo sale con marcado crudo: content="<script>alert(1)</script>"'
not ok 5 - A-5 · la página de puerto expone un landmark principal
  error: 'el contenido de la página de puerto no está dentro de ningún landmark principal'
not ok 6 - A-6 · las listas sin viñeta conservan el rol de lista
  error: 'listas sin role="list" con list-style:none: <ol class="grafico__horas" …> <ul class="solunar__lista" …>'
not ok 7 - A-7 · el tema forzado por data-theme ajusta también el color-scheme
  error: 'la regla de data-theme=noche no fija color-scheme: la UA sigue pintando sus widgets en claro'
# tests 10 · pass 3 · fail 7
```

**Recuento honesto: 7 reproducidos · 2 juicios A12 (sin test) · 12 sospechas no reproducidas.**

### Estado tras la corrección (este PR)

Los siete hallazgos corregidos, los siete trinquetes retirados y los siete cuerpos en verde como
gate permanente; J-2 pasa de juicio a gate.

| Comando | Resultado |
|---|---|
| `pnpm lint` (gate anti-slop) | ✅ verde |
| `pnpm typecheck` | ✅ verde |
| `pnpm test` (monorepo) | ✅ 43/43 — `apps/web` 22/22, **0 skipped, 0 trinquetes** |
| `pnpm build` | ✅ 2 páginas |
| `grep -c '<script' dist/puerto/santander/index.html` | ✅ `0` (promesa 2 intacta) |
