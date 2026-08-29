# Informe adversario — actividad solunar en la página de puerto (T-10)

- **Trayectoria:** T-10 · **PR:** #12 (`claude/T-10-module-fishing-ui`) · **Fecha:** 2026-08-29
- **Superficie atacada:** la sección **Actividad solunar** tal y como se publica en las **12 páginas
  de puerto** del `dist/` y las bandas que aporta al SVG de la curva de 24 h — es decir
  `packages/modules/fishing/src/` (`actividad.ts`, `textos.ts`, `module.ts`),
  `apps/web/src/componentes/modulos/ActividadSolunar.astro`,
  `apps/web/src/componentes/{GraficoMarea,SeccionesDeModulos}.astro`,
  `apps/web/src/modulos/{actividad-solunar,ventanas,contexto}.ts`, el recorte de
  `apps/web/src/grafico-marea.ts` y la hoja `apps/web/src/estilos/actividad-solunar.css` + el tramo
  de bandas de `pagina-puerto.css`.
- **Entorno:** local y efímero, sin cloud. `BUILD_DATE=2026-08-29 pnpm --filter web build` (33
  páginas estáticas) + `node --test`. Chromium de Playwright **solo para exploración** (árbol de
  accesibilidad, muestreo de píxeles, viewports de 320/360/414 px, `emulateMedia({media:"print"})`):
  el repo no depende de Playwright y las reproducciones no lo usan. Ni el diff, ni el DOM, ni el
  código han salido del contenedor; ningún modelo externo ha revisado nada.
- **Reproducciones:** `apps/web/src/adversario-t10.test.ts` (A-13…A-16).
- **Bundle:** `docs/qa/bundles/t10/FAILURE.md` (un bundle, un apartado por hallazgo: el run en rojo
  es uno).
- **Contexto asimétrico:** se ha leído el **contrato** —`README` del módulo `solunar/` del dominio,
  `apps/web/design-brief.md`, `packages/module-contract/`, el catálogo `data/stations/`— y el
  **artefacto construido**. El código se ha leído para *dirigir* los ataques (encontrar el selector,
  el token, la constante), nunca para juzgarlo; el plan de T-10 y la justificación del diff no se
  han abierto.

> **Dónde viven las reproducciones.** La skill las pide en `tests/e2e/journeys/adversarial/`; en
> este repo el arnés que gatea es `node --test` sobre `apps/web/src/**/*.test.ts` —un spec en
> `tests/e2e/` no lo ejecutaría nadie— así que se sigue el precedente de T-09 y viven junto a los
> demás tests del `dist/`. Es el mismo trato: project por defecto, gate duro, no un cajón aparte.
>
> **Trinquete.** `test.fail()` es de Playwright; aquí el equivalente es `hallazgoAbierto()`, con la
> misma tabla de verdad: el cuerpo afirma **el comportamiento correcto**, CI se queda verde mientras
> el hallazgo está abierto (imprimiendo el motivo como diagnóstico en cada ejecución) y se pone
> **rojo el día que alguien lo arregle**, pidiendo que se retire el trinquete para que el ataque
> quede como gate permanente. Los cuatro cuerpos se corrieron **sin** trinquete primero: ahí nació
> el bundle (4 tests, 0 pass, 4 fail).

## Promesa

**Quien abre la página de su puerto ve, sobre el gráfico de marea y en una tabla, las ventanas
solunares que el dominio calcula para ese puerto y ese día, con un rating que se presenta como
convención con su desglose y que jamás promete capturas — sin un byte de JavaScript de cliente.**

De esa frase, lo que el `verificador` ya ató con mutation testing es *«las que el dominio calcula»*:
el golden contra `getSolunar`, el recorte de las bandas, el redondeo del rating y la baja del módulo
muerden. Aquí se ha atacado la otra mitad: **que lo publicado se pueda ver, se pueda nombrar, y no
prometa lo que su propio aviso jura no prometer.**

## Clases atacadas

| Clase | Hipótesis (entrada concreta) | Resultado |
|---|---|---|
| **A5** · límites 0/1/N | La página gana una octava sección: ¿la trata el DOM como a las otras siete? Árbol de accesibilidad de Chromium sobre las 12 páginas | 🔴 **roto** → **A-13** (7 regiones expuestas de 8 secciones; `id="titulo-actividad-solunar"` sin referenciar) |
| **A5** · a pleno sol (criterio del brief) | Medir el contraste **real** de las bandas: OKLCH → sRGB, composición a `opacity` 0,18/0,09, en los dos temas; y confirmarlo leyendo píxeles renderizados | 🔴 **roto** → **A-14** (1,30:1 y 1,14:1 sobre el fondo; mayor↔menor **1,14:1**) |
| **A12** · promesa vs entregado | El `aria-label` del SVG creció para enumerar las bandas: ¿creció también lo que ve quien mira el gráfico? | 🔴 **roto** → **A-15** (el `figcaption` sigue hablando solo de metros) |
| **A12/A6** · promesa vs entregado · input hostil | `textos.ts` promete que los textos de la sección viven ahí y que el CI los vigila. ¿Está ahí el rótulo que califica la cifra? Sustituirlo por «Hoy pican seguro» y correr el CI | 🔴 **roto** → **A-16** (12 páginas publican la promesa de pesca con 344 pass / 0 fail y lint limpio) |
| **A12** · promesa vs entregado | ¿Se puede convertir el aviso en algo que ya no avise editando `textos.ts`, con el CI en verde? (pista del verificador) | 🟢 **aguantó** — `actividad.test.ts:161` ancla el contenido, no solo la presencia. Ver *No reproducidos* |
| **A5** · límites 0/1/N | **Zona horaria de Canarias**: cruzar el HTML construido de los 12 puertos contra `getSolunar` (franjas, bandas, geometría), no solo Vigo | 🟢 aguantó: 0 discrepancias, incluidos `Atlantic/Canary` (Las Palmas, Santa Cruz) |
| **A5** · límites 0/1/N | **Días raros**: cambio de hora `2026-03-29` (23 h) y `2026-10-25` (25 h), construidos de verdad | 🟢 aguantó (ver *No reproducidos*) |
| **A5** · límites 0/1/N | Día con **0 o 1 periodo**, día con **más de 4**, **dos periodos con la misma ancla** (colisión de `id`), ventana **enteramente fuera** del día: barrido de 12 puertos × 365 días de 2026 (4 380 días-puerto) | 🟢 aguantó: solo 3 (600) o 4 (3 780) periodos; cero anclas repetidas; cero ventanas fuera |
| **A5** · límites | **Solapamiento** de dos ventanas (dos bandas pisándose ⇒ opacidad sumada que miente sobre la intensidad): mismo barrido de 4 380 días-puerto | 🟢 aguantó: cero solapes (la geometría lo impide en estas latitudes) |
| **A12** · coherencia entre superficies | ¿Pueden discrepar la tabla y el gráfico? Banda sin fila, fila sin banda, franja del texto contra `x`/`width` del `<rect>`, en los 12 puertos | 🟢 aguantó: 4 filas ↔ 4 bandas, geometría dentro de `[0, 620]`, franjas idénticas |
| **A12** · coherencia entre secciones | ¿Se contradicen la sección nueva y el bloque `#luna` de T-09? (orto, ocaso, paso superior, fase vs «a 1,2 días de la sicigia») | 🟢 aguantó: 21:43 / 09:12 / 03:12 y 98,3 % iluminada ↔ 1,2 días de la sicigia |
| **A9** · callejón sin salida | El enlace de metodología (`…/blob/main/packages/domain-core/src/solunar/README.md`) — el hallazgo A-3 de T-09 fue exactamente un enlace a una página que no existía | 🟢 aguantó: el README existe **en `main`**, no solo en la rama |
| **A5** · móvil | La tabla de 3 columnas con «la Luna en lo más bajo, bajo el horizonte, a las 15:34 · cae sobre la salida o la puesta del Sol» a 320 / 360 / 414 px | 🟢 aguantó: `scrollWidth == clientWidth`, 0 elementos desbordando dentro de `#actividad-solunar` |
| **A5** · impresión | Las bandas no tienen regla `@media print` y la página está pensada para llevarse al muelle | 🟢 aguantó por otra vía: `.grafico { display: none }` en print, así que las bandas no llegan al papel; la sección sí se imprime, con `--m-terra` en negro |
| Promesa · determinismo | Build con `TZ=Pacific/Kiritimati` (+14) contra el build de referencia | 🟢 aguantó: `diff -r` idéntico |
| Promesa · cero JS | Ejecutables en el HTML publicado | 🟢 aguantó: un único `<script type="application/ld+json">`, cero bundles JS en `dist/_astro/` |

**Descartadas y por qué.** Sigue siendo una **página estática sin servidor, sin sesión, sin
formularios y sin mutación**, y T-10 no cambia eso: no hay nada que enviar dos veces, nada que quede
a medias, nada que reintentar, ningún recurso de otro usuario y ningún estado que revertir. Quedan
fuera **A1** (concurrencia), **A2** (estado stale — su forma aplicable a un almanaque es el juicio
J-1, que sigue abierto y se re-registra abajo), **A4** (idempotencia), **A7** (frontera de
autorización: no hay autenticación ni recursos por usuario, **nada que escalar a `seguridad` por
esta vía**), **A8** (sesión), **A10** (feedback: no hay acción que dar feedback) y **A11**
(reversibilidad). De **A3** solo aplica «el recurso no llega», ya cubierto por el gate A-3 de T-09.
De **A6** solo aplica la variante «una cadena que nadie audita acaba publicada», que sí se atacó y
es el hallazgo A-16.

## Hallazgos

Cuatro reproducidos, los cuatro con su run **en rojo antes** de poner el trinquete (evidencia en el
bundle). Ninguno es una vulnerabilidad y ninguno cambia un número: los números están bien en los 12
puertos y en los dos días de cambio de hora. Los cuatro son **la sección publicándose peor de lo que
se calcula** — y el cuarto es el único que permite publicar exactamente lo que el aviso jura que no
se publica.

### A-13 · A5 · la sección del módulo es la única de la página que no se expone como región

- **Qué se consigue:** quien recorre la página con un lector de pantalla saltando por landmarks no
  encuentra «Actividad solunar»: la página anuncia **7 regiones** y tiene **8 secciones**. Las siete
  de T-09 llevan `aria-labelledby` hacia el `id` de su `<h2>`; la octava, la que emite
  `SeccionesDeModulos`, sale como `<section id="actividad-solunar" class="bloque">` a secas. El
  componente del módulo **sí** emite `<h2 id="titulo-actividad-solunar">` y ese `id` **no lo
  referencia nadie** en todo el HTML — la huella de la intención que se quedó a medias. Afecta a las
  12 páginas, y al siguiente módulo con UI (meteo, T-11) le pasará igual, porque el defecto está en
  el envoltorio genérico, no en el módulo.
- **Repro:** `apps/web/src/adversario-t10.test.ts` · `todaSeccionDeBloqueTieneNombreAccesible`
- **Bundle:** `docs/qa/bundles/t10/FAILURE.md` §A-13
- **Estado:** abierto (trinquete puesto)
- **Severidad:** molestia con sesgo — la información existe y es correcta, pero es más difícil de
  alcanzar justo para quien más depende de la estructura del documento
- **Escalado:** no

### A-14 · A5 · las bandas se dibujan por debajo del umbral de un objeto gráfico, y mayor y menor no se distinguen

- **Qué se consigue:** las bandas son **lo que T-10 añade al gráfico**, y sobre el fondo del sitio
  miden **1,30:1** (mayor) y **1,14:1** (menor) — frente al 3:1 que WCAG 2.2 · 1.4.11 pide a un
  objeto gráfico que porta información, y en una página cuyos propios tokens anotan 5,4:1 como peor
  par «porque esta página se lee al sol». Peor: la **única** diferencia entre una ventana mayor y
  una menor es un salto de opacidad de 0,18 a 0,09, que son **1,14:1** — un canal exclusivamente
  cromático y por debajo de cualquier umbral de percepción a plena luz. El resultado es que el
  gráfico dibuja cuatro manchas que ni se ven bien ni se pueden ordenar por importancia; el dato
  útil sigue estando entero en la tabla, que es lo que evita que esto sea grave.
- **Medida** (tokens y píxeles renderizados coinciden, ver bundle):

  | Tema | fuerte vs fondo | suave vs fondo | mayor vs menor |
  |---|---|---|---|
  | claro | 1,30:1 | 1,14:1 | **1,14:1** |
  | noche | 1,27:1 – 1,30:1 | 1,11:1 – 1,14:1 | **1,15:1** |

- **Repro:** `apps/web/src/adversario-t10.test.ts` · `lasBandasSeVenYSeDistinguenEntreSi`
- **Bundle:** `docs/qa/bundles/t10/FAILURE.md` §A-14
- **Estado:** abierto (trinquete puesto). **Caveat honesto:** el cuerpo mide contraste; si la
  distinción se resolviera con un canal **no cromático** (trama, filete, rótulo) el assert habría
  que reescribirlo, no solo destrincarlo.
- **Severidad:** molestia — información contextual degradada, no dato erróneo
- **Escalado:** no

### A-15 · A12 · el pie visible del gráfico no dice qué son esas manchas

- **Qué se consigue:** al añadir las bandas, el `aria-label` del `<svg>` se amplió y hoy enumera las
  cuatro franjas con sus horas. El `<figcaption>` —el único texto que ve quien mira el gráfico— se
  quedó como estaba: «Entre 0,43 m y 3,54 m sobre el cero del puerto». **La asimetría es la prueba
  de que es un olvido y no una decisión**: quien no ve el SVG recibe la explicación completa y quien
  lo ve recibe cuatro manchas sin leyenda. Y la sección que las explica va **después** del bloque de
  sol y luna (`order: 20`), así que en móvil median dos pantallas entre la mancha y su significado.
  12/12 páginas.
- **Repro:** `apps/web/src/adversario-t10.test.ts` · `elPieDelGraficoExplicaLasBandas`
- **Bundle:** `docs/qa/bundles/t10/FAILURE.md` §A-15
- **Estado:** abierto (trinquete puesto)
- **Severidad:** molestia — un elemento visual nuevo sin leyenda en la superficie que lo muestra
- **Escalado:** no

### A-16 · A12/A6 · el rótulo que califica la cifra escapa a los textos auditados, y con él la regla «aquí no se promete pesca»

- **Qué se consigue:** `textos.ts` declara en su cabecera **por qué** existe —los textos de la
  sección viven ahí «y no en la plantilla» porque «son requisito de producto», con la regla explícita
  *«aquí no se promete pesca»* y un test que los vigila—. El rótulo que dice al lector **qué es ese
  90** («Actividad prevista por la convención») está escrito a mano en `ActividadSolunar.astro`,
  fuera del package. La lista negra `/garantiz|infalible|picarán|asegura que/i` no lo alcanza.
  Ataque ejecutado: sustituido por **«Hoy pican seguro»**, las 12 páginas lo publican, la suite
  entera queda en **344 pass / 0 fail** y el lint limpio. La mutación queda revertida; el árbol de
  trabajo está limpio.
- **Contraste que lo delimita:** la mutación equivalente **dentro** de `textos.ts` (suavizar
  `AVISO_SIN_RESPALDO`) **sí** la caza `actividad.test.ts:161`. El guardián funciona; lo que falla es
  su **alcance**, y falla justo sobre la cadena que el rol `qa` señaló como la más cercana al filo
  de prometer pesca.
- **Repro:** `apps/web/src/adversario-t10.test.ts` · `elRotuloDelRatingSaleDeLosTextosAuditados`
- **Bundle:** `docs/qa/bundles/t10/FAILURE.md` §A-16
- **Estado:** abierto (trinquete puesto)
- **Severidad:** **la más alta de la pasada** — es la promesa central de la trayectoria («jamás
  promete capturas») sin guardián, en la única cadena que la puede romper de un `sed`
- **Escalado:** no (no es seguridad; es integridad editorial del producto)

## No reproducidos

Sospechas que **no** se materializaron. Se listan a propósito: sin esto, una pasada estéril y una
pasada alucinada se ven igual desde fuera.

| Sospecha | Qué pasó al intentarlo |
|---|---|
| «El golden solo corre sobre Vigo: un fallo de zona horaria específico de Canarias no lo cogería nadie» (pista del verificador) | Se cruzó el HTML de los **12** puertos contra `getSolunar`: franjas, número de bandas y geometría. **0 discrepancias**, incluidos `Atlantic/Canary`. La zona sale del puerto en `getSolunar` (`port.timezone`) y en el formato del borde; no hay ningún camino donde se asuma la Península |
| «El test del aviso protege la presencia, no el contenido: suavizarlo pasaría el CI» (pista del verificador) | **Falso.** `actividad.test.ts:161` ancla `/no tiene respaldo experimental sólido/`, `/una convención, no una medida/`, `/Knight/` y prohíbe `/garantiz\|infalible\|picarán\|asegura que/i`. Sustituido el aviso por «La teoría solunar acumula un siglo de uso entre pescadores…», el CI se pone **rojo**. Lo que sí escapa es el rótulo del rating → A-16 |
| Cambio de hora: el día de 25 h admite **dos tránsitos superiores** (24 h 50 min < 25 h) ⇒ dos periodos con la misma ancla ⇒ `id` duplicado en `data-ventana`/`data-periodo` | No ocurre. Barrido de 12 puertos × (2026-03-28/29/30 y 2026-10-24/25/26) × 2 años: cero anclas repetidas. Y el barrido de 4 380 días-puerto de 2026 tampoco encuentra ninguna |
| El día del cambio de hora rompe la proyección del gráfico o la franja de la tabla | Construido de verdad. `2026-10-25` (25 h): eje `00:00 / 05:15 / 11:30 / 17:45 / 24:00` (el salto atrás se ve en la marca), banda mayor de 49,6 px = 2 h sobre 620 px de 25 h. `2026-03-29` (23 h): 3 periodos, eje `00:00 / 06:45 / …`. Todo coherente con `civilDayBounds` |
| Días con 0 o 1 periodo, o con más de 4 | No existen en el catálogo: 4 380 días-puerto dan 3 periodos (600) o 4 (3 780). El invariante 1–4 del dominio se cumple con holgura |
| Dos ventanas que se pisan ⇒ opacidades que se suman y mienten sobre la intensidad | Cero solapes en 4 380 días-puerto. Entre 28° y 43,5° de latitud, un orto/ocaso lunar dista ≥ 4 h de un tránsito y las semiventanas suman 1 h 45 min |
| Una banda dibujada sin su fila, o una fila sin su banda | 4 filas ↔ 4 bandas en los 12 puertos; ninguna ventana cae entera fuera del día (su fenómeno está dentro y la ventana es simétrica), así que el recorte nunca la elimina |
| La sección nueva contradice el bloque `#luna` de T-09 (mismos fenómenos, dos redacciones) | Coinciden al minuto: sale 21:43, se pone 09:12, paso superior 03:12; «98,3 % iluminada» ↔ «a 1,2 días de la sicigia» |
| Las bandas no tienen `@media print` y la tabla del mes está pensada para imprimirse | No llega a pasar: `almanaque.css` oculta `.grafico` entera al imprimir. La sección solunar **sí** se imprime, con la paleta de tinta negra (`--m-terra: oklch(0% 0 0)`) |
| Los extremos de marea y el coeficiente dejan de leerse con las bandas encima | Las bandas se emiten **antes** del trazo y de los círculos (en SVG manda el orden del documento) y con 0,18/0,09 de opacidad no tapan nada — irónicamente, por la misma razón que las hace invisibles (A-14) |
| El enlace de metodología repite el 404 del hallazgo A-3 de T-09 | `packages/domain-core/src/solunar/README.md` existe **en `main`** (`git cat-file -e origin/main:…`), no solo en la rama de la trayectoria |
| La sección desborda en móvil o mete JavaScript | 320 / 360 / 414 px: `scrollWidth == clientWidth`, 0 elementos desbordando. Cero ejecutables: un único `<script type="application/ld+json">` |
| El build deja de ser determinista con la sección nueva | `TZ=Pacific/Kiritimati`: `diff -r` idéntico contra el build de referencia |

## Juicios de producto (A12 — sin test, ponderar como tales)

Lo que la clase A12 destapa no siempre tiene reproducción. Van aquí, marcados como **juicio y no
como hecho**, para que se pesen distinto.

### J-2 · el marcador satura: «100 de 100» sale un día de cada siete, y la escala nunca baja de 30

Medido sobre los 12 puertos × 365 días de 2026 (4 380 días-puerto, `getSolunar` real):

```
min 37 · p25 57 · mediana 68 · p75 90 · max 100
=100:  613 días-puerto (14,0 %) · 59 días del año con algún puerto a 100
≥83 («Muy alta»): 1 261 (28,8 %) · <48 («Baja»): 222 (5,1 %)
Vigo, agosto 2026: 72 63 54 55 45 60 59 68 68 87 90 100 100 90 84 64 55 56 56 55 54 64 83 90 100 100 90 88 69
```

El README del dominio defiende que «100 y 0 solo se alcanzan por exactitud de la fórmula, nunca por
redondeo: un “día perfecto” conseguido redondeando sería una mentira barata» — y es cierto, el
redondeo está bien hecho. Pero **la fórmula da exactamente 100 con muchísima frecuencia** (basta
`daysFromSyzygy ≤ 2` y dos periodos sobre el orto/ocaso solar), así que el estado terminal que se
reservaba con tanto cuidado se publica en 12 páginas cuatro días de cada mes. Un «100 de 100 · Muy
alta» que sale un día de cada siete no informa: satura.

El otro extremo es el simétrico: la cifra **no puede bajar de 30** (`MOON_SCORE_MIN` + bonus 0),
pero el marcador anuncia «de 100» sin decirlo. El suelo real se puede *deducir* del desglose («baja
en línea recta hasta 30 en el cuarto»), que habla del factor lunar, no del total. Un 37 se lee como
«37 %» cuando en realidad es el peor día posible.

### J-3 · «Actividad prevista» es la palabra que el propio aviso dice que no es

El rótulo que califica la cifra dice «Actividad **prevista** por la convención»; doce párrafos más
abajo, el aviso dice que aquí se publica «un cálculo reproducible de sus ventanas horarias, **no una
predicción** de capturas». El hedge («por la convención») está y es correcto, pero el orden de
lectura juega en contra: la cifra grande y su rótulo van arriba, el aviso al final de la sección. Es
un juicio, no un hecho — pero es exactamente la cadena que A-16 demuestra que **nada** vigila.

### J-4 · la única pregunta que la convención solunar existe para responder no se puede hacer

El producto solunar clásico es un **calendario**: «¿qué día de esta semana salgo?». La sección
publica un solo día —el del build— sin forma de mirar otro, mientras la tabla de mareas de al lado
sí da el mes entero. Los datos de J-2 muestran que la información está justo en la comparación entre
días (de 45 a 100 en el mismo mes y el mismo puerto), y es la que no se puede hacer. La feature
funciona; el segundo día el usuario se queda con la misma pregunta que traía.

### J-1 (re-registrado de T-09) · la página no sabe si su «hoy» sigue siendo hoy

Sigue abierto y T-10 lo agrava un poco: la sección publica horas y un rating sin repetir la fecha en
ningún sitio visible (el `<caption>` que dice «de hoy» es `.solo-lectores`). Servida un día tarde,
la sección entera es falsa y no hay nada dentro de ella que lo delate.

## Recuento

**4 reproducidos · 12 no reproducidos · 4 juicios de producto** (J-1 re-registrado) → al ledger
(`Contexto_Base_SRE/04_Logs_de_Trayectoria/adversarial_ledger.md`).
