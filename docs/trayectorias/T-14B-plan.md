# T-14B — la calidad deja de ser un dato que hay que ir a buscar

**Por qué existe**: el proyecto sabe de cada puerto si su predicción está medida y con cuánto error,
y lo dice bien **en la ficha**. Pero en los dos sitios donde alguien **elige** un puerto —la portada
y `/v1/ports`— esa información no está, así que los 153 se presentan como si valieran lo mismo. Y
**120 de ellos (78 %) son `estimado`**: toman prestadas las constantes del mareógrafo más cercano.

No es una mentira como las de T-14A: nada afirma lo falso. Es una **omisión en el punto de
decisión**, que en un portal cuya regla es «un puerto no publica una precisión que no tiene» acaba
teniendo el mismo efecto — porque quien elige de una lista plana asume que la lista es plana.

## Lo que hay hoy, medido

**La portada** (`apps/web/src/pages/index.astro`) lista los 153 puertos agrupados por región, con
`meta: puerto.province.name` como única información por entrada. Su propia entradilla promete:

> «Cada página dice de dónde sale su dato, con qué método y con cuánto error.»

Es cierto **de cada página** y **falso de la lista**: la lista es justo el sitio donde esa
diferencia decidiría algo, y es donde no está.

**El API**: `/v1/ports` devuelve `PortDto` — geografía y nada más (`packages/usecases/src/ports.ts`).
La calidad (`grade`, `rmse_m`, `hw_time_err_p95_min`, `estimated`, y sus `*_reason`) existe y viaja,
pero **solo en `/v1/ports/:slug`**, dentro de `station.quality`. Consecuencia práctica:

> **Para saber qué puertos están medidos hay que pedir los 153 uno a uno.**

Un dato que exige 153 peticiones para poder filtrar no es un dato publicado: es un dato disponible.

## Entregables

1. **`/v1/ports` publica la calidad de cada puerto**: `grade`, `estimated`, y las métricas que la
   sostienen (`rmse_m`, `hw_time_err_p95_min`), con sus `null` cuando no hay medida — un `null` es
   información, no un hueco. Que un consumidor pueda pedir el catálogo **una vez** y filtrar.
2. **La portada dice la calidad de cada puerto** en la propia entrada de la lista, y permite
   **filtrar** por ella. Sin JavaScript para leerla: la señal va en el HTML horneado, y el filtro es
   una isla declarada si hace falta (contrato de T-06 y presupuesto de T-12).
3. **La documentación del API** describe los campos nuevos y **qué significa cada `grade`**, con el
   umbral que lo decide, no con adjetivos.
4. **Un gate que impida volver atrás**: que `/v1/ports` publique la calidad de **todos** los puertos
   del catálogo (no de algunos), y que la portada la publique en **todas** las entradas. La forma de
   fallar de esto no es «no aparece»: es «aparece en 148 de 153 y nadie lo nota».

## Lo que este PR NO hace

- **No inventa una escala nueva.** `grade` y `estimated` ya existen, están medidos y tienen umbral
  publicado. Aquí solo se **muestran** donde se decide.
- **No rediseña la portada.** La lista completa se queda: sustituirla por el índice de regiones es
  una decisión de producto que la propia portada ya declara pendiente, y no la toma este PR.
- **No ordena por calidad.** Ordenar por grade escondería puertos legítimos al final de la lista;
  la geografía sigue mandando y la calidad se **enseña y se filtra**, que no es lo mismo.

## Asunciones

1. `grade` y `estimated` de la ficha son la misma verdad que hay que enseñar en la lista; no hace
   falta una métrica agregada nueva.
2. Añadir campos a `/v1/ports` es retrocompatible: nadie depende de que la respuesta **no** los
   tenga.
3. El coste en bytes de la portada (hoy 35,6 KB de HTML, ya por encima de una página de puerto)
   admite una señal corta por entrada. **Se mide antes de dar por buena la forma**: si la señal
   engorda la portada más de lo que aporta, se dice y se busca otra forma.

## Tradeoffs

- **Enseñar el grade vs. enseñar solo «estimado»**: el flag binario es más legible y el grade es más
  honesto (distingue A de B de C). Se publican los dos: el flag decide la señal visible y el grade
  viaja para quien quiera afinar. Coste: dos conceptos en la lista en vez de uno.
- **Filtro en cliente vs. rutas separadas**: el filtro en cliente no multiplica páginas ni URLs
  indexables, pero exige JavaScript. Por eso la **señal** no puede depender de él: se lee sin JS, y
  el filtro solo ahorra trabajo a quien lo tenga.

## Verificación

Suite completa (`pnpm lint`, `typecheck`, `test`, `--filter web check`, `deno task check/test`,
Playwright, `ruff`, `pytest`), el gate anti-slop de frontend, y **los gates del punto 4 comprobados
mordiendo**: quitar la calidad de un puerto en `/v1/ports` y quitar la señal de una entrada de la
portada tienen que salir en rojo **nombrando el puerto**, no con un conteo agregado.
