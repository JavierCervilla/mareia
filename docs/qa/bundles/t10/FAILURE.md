# Failure bundle — pase adversario T-10 (actividad solunar)

> **Qué es esto.** La evidencia sellada del run **en rojo** de los cuatro hallazgos A-13…A-16,
> tomada *antes* de poner el trinquete (con `hallazgoAbierto()` puesto no nace bundle: el fallo era
> el esperado). Es el equivalente manual del bundle que escribe el fixture `qa-bundle` de
> `qa-staging`: en este repo **todavía no hay runner de Playwright como dependencia**, así que no
> hay captura ni DOM serializado por el fixture — lo que hay es el HTML construido, que en un sitio
> SSG **es** el DOM.
>
> Un solo bundle para los cuatro hallazgos, con un apartado por hallazgo: el run en rojo es uno.

- **snapshotId:** `t10` · **Fecha:** 2026-08-29
- **Sujeto:** worktree `/home/user/mareia-t10`, rama `claude/T-10-module-fishing-ui`, HEAD `7b8d141`
- **Entorno:** local y efímero. Node 22 (`--experimental-strip-types`), Astro build estático
  (`BUILD_DATE=2026-08-29`, 33 páginas), Chromium de Playwright **solo para exploración** (árbol de
  accesibilidad, muestreo de píxeles, viewports de móvil, `emulateMedia({media:"print"})`; no hay
  dependencia de Playwright en el repo y los tests no la usan). Sin red hacia fuera: ni el diff, ni
  el DOM, ni el código han salido del contenedor; ningún modelo externo ha revisado nada.
- **Reproducción:** `apps/web/src/adversario-t10.test.ts`
- **Informe:** `docs/qa/informe-adversario-t10.md`

## Cómo se reprodujo

```bash
export PATH="/opt/deno/bin:$PATH"
BUILD_DATE=2026-08-29 pnpm --filter web build        # 33 páginas
# el mismo fichero de tests, con `test(...)` en vez de `hallazgoAbierto(...)`:
node --experimental-strip-types --test apps/web/src/adversario-t10.test.ts
```

```tap
not ok 1 - A-13 · la sección de módulo se expone como región, igual que las otras siete
  error: 'secciones de bloque sin nombre accesible (no se exponen como región):
           a-coruna → <section id="actividad-solunar">, bilbao → …, cabo-de-palos → …,
           cadiz → …, huelva → …, la-manga-del-mar-menor → …, las-palmas-de-gran-canaria → …,
           malaga → …, palma-de-mallorca → …, santa-cruz-de-tenerife → …, santander → …,
           vigo → <section id="actividad-solunar">   (12/12 páginas)'
not ok 2 - A-14 · las bandas se ven sobre el fondo y la mayor se distingue de la menor
  error: 'bandas por debajo de 3:1 (WCAG 1.4.11):
           claro/fuerte vs fondo = 1.30:1 · claro/suave vs fondo = 1.14:1 · claro/mayor vs menor = 1.14:1 ·
           noche/fuerte vs fondo = 1.30:1 · noche/suave vs fondo = 1.14:1 · noche/mayor vs menor = 1.14:1'
not ok 3 - A-15 · el pie visible del gráfico dice qué son las franjas sombreadas
  error: 'páginas con bandas cuyo pie visible no las nombra:
           vigo → «Entre 0,43 m y 3,54 m sobre el cero del puerto.» … (12/12 páginas)'
not ok 4 - A-16 · el rótulo que califica el rating es un texto auditado del módulo
  error: 'rótulos del rating que no son constantes auditadas de @mareia/module-fishing
           (la regla «aquí no se promete pesca» no los cubre):
           vigo → «Actividad prevista por la convención» … (12/12 páginas)'
1..4
# tests 4 · pass 0 · fail 4
```

Con el trinquete puesto, el mismo fichero deja CI en verde e imprime los cuatro motivos como
diagnóstico en cada ejecución (`# tests 4 · pass 4 · fail 0`).

---

## A-13 · la sección del módulo no se expone como región

**DOM construido** (idéntico en las 12 páginas de puerto):

```html
<section class="bloque cuerpo__mareas" id="tabla-de-mareas"  aria-labelledby="titulo-hoy">
<section class="bloque cuerpo__grafico" id="curva-de-marea"  aria-labelledby="titulo-curva">
<section class="bloque"                 id="tabla-mensual"   aria-labelledby="titulo-mes">
<section class="transparencia"          id="transparencia"   aria-labelledby="titulo-transparencia">
<section id="actividad-solunar" class="bloque">                    ← sin nombre accesible
  <h2 class="bloque__titulo" id="titulo-actividad-solunar">Actividad solunar</h2>
</section>
```

`titulo-actividad-solunar` aparece **una sola vez** en el HTML: nadie lo referencia.

**Árbol de accesibilidad de Chromium** (`page.accessibility.snapshot`, viewport 1280×900),
`/mareas/galicia/pontevedra/vigo/`:

```
region :: Coeficiente de marea del día
region :: Mareas de hoy · sábado, 29 de agosto de 2026
region :: Altura de marea · 24 horas
region :: Sol
region :: Luna
region :: Mareas de agosto de 2026
region :: Calidad y procedencia del dato
        ← «Actividad solunar» NO aparece: 7 regiones de 8 secciones
```

## A-14 · las bandas por debajo del umbral de objeto gráfico

**CSS publicado** (`apps/web/src/estilos/pagina-puerto.css`):

```css
.grafico__banda                        { fill: var(--m-terra); }
.grafico__banda[data-enfasis="fuerte"] { opacity: 0.18; }
.grafico__banda[data-enfasis="suave"]  { opacity: 0.09; }
```

**Medida sobre los tokens** (OKLCH → sRGB, composición source-over, luminancia WCAG). Es lo que
calcula el test, sin navegador:

| Tema | fuerte vs fondo | suave vs fondo | mayor vs menor |
|---|---|---|---|
| claro | **1,30:1** | **1,14:1** | **1,14:1** |
| noche | **1,30:1** | **1,14:1** | **1,14:1** |

**Confirmación empírica** leyendo píxeles renderizados por Chromium sobre HTTP (screenshot 1×1 en
el centro de cada banda y del lienzo entre bandas, `colorScheme: light|dark`):

```
claro  fondo rgb(246,241,228)  fuerte rgb(231,209,195)  suave rgb(238,225,211)
       fuerte/fondo = 1,302:1   suave/fondo = 1,139:1    fuerte/suave = 1,143:1
noche  fondo rgb(18,23,29)     fuerte rgb(52,40,40)     suave rgb(35,31,34)
       fuerte/fondo = 1,269:1   suave/fondo = 1,107:1    fuerte/suave = 1,147:1
```

Umbral de referencia: **3:1** (WCAG 2.2 · 1.4.11, objetos gráficos portadores de información). El
propio `tokens.css` anota 5,4:1 como *peor* par del sitio «porque esta página se lee al sol».

## A-15 · el pie del gráfico no nombra las bandas

```html
<svg role="img" aria-label="Curva de altura de marea de las 24 horas: pleamar a las 05:25, 3,30 m;
     …; bajamar a las 23:50, 0,43 m. Franjas sombreadas: periodo mayor de 02:12 a 04:12; periodo
     menor de 08:27 a 09:57; periodo mayor de 14:34 a 16:34; periodo menor de 20:58 a 22:28.">
  <rect class="grafico__banda" data-ventana="solunar-upper-transit" data-enfasis="fuerte" …>
  … (4 bandas)
</svg>
<figcaption class="datos__nota">Entre 0,43 m y 3,54 m sobre el cero del puerto.</figcaption>
```

El nombre accesible enumera las cuatro franjas con sus horas; el único texto **visible** del
`<figure>` no las menciona. 12/12 páginas.

## A-16 · el rótulo del rating fuera de los textos auditados

```html
<p class="solunar__veredicto">
  <span class="etiqueta">Actividad prevista por la convención</span>
  <span class="solunar__valoracion">Muy alta</span>
</p>
```

La cadena está escrita a mano en `apps/web/src/componentes/modulos/ActividadSolunar.astro`; no es
ninguna de las constantes exportadas por `@mareia/module-fishing`, que es donde `textos.ts` declara
que viven los textos de la sección y donde `actividad.test.ts` aplica la lista negra
`/garantiz|infalible|picarán|asegura que/i`.

**Ataque ejecutado** (mutación revertida; el árbol de trabajo quedó limpio):

```bash
sed -i 's/Actividad prevista por la convención/Hoy pican seguro/' \
  apps/web/src/componentes/modulos/ActividadSolunar.astro
pnpm --filter web build && pnpm -r --if-present test && pnpm lint
# → «Hoy pican seguro» publicado en las 12 páginas
# → 344 pass / 0 fail en toda la suite · eslint sin hallazgos
```

Contraste con la mutación equivalente **dentro** de `textos.ts` (suavizar `AVISO_SIN_RESPALDO` a
«La teoría solunar acumula un siglo de uso entre pescadores…»), que **sí** la caza
`packages/modules/fishing/src/__tests__/actividad.test.ts:161`:

```tap
not ok 9 - los textos declaran la convención y no prometen capturas
  actual: 'La teoría solunar acumula un siglo de uso entre pescadores. …'
```
