# Informe adversario — la talla mínima legal en la página de un puerto (T-19)

- **Trayectoria:** T-19 · **PR:** #22 (`claude/T-19-tallas-minimas-boe`, head `3286c0f`) ·
  **Fecha:** 2026-08-30
- **Superficie atacada:** el módulo `regulations` entero (`vista.ts`, `module.ts`, `textos.ts`), su
  adaptador en la web (`apps/web/src/modulos/normativa.ts`), la sección construida
  (`TallasMinimas.astro` + `estilos/tallas-minimas.css`) en las **153 páginas de puerto** del
  `dist/`, el dataset `data/normativa/tallas-minimas.json` (118 tallas · 3 caladeros), los gates
  G1/G2/G3 del pipeline (`data/pipeline/mareia_pipeline/normativa.py`, `run.py check`), el reparto
  puerto→caladero (`caladero_de_puerto` + `data/geo/ports.json`) y el camino sin red (worker de
  T-12 con la política `offline` que declara el módulo).
- **Entorno:** local y efímero. `dist/` construido y servido **por HTTP**
  (`tests/e2e/servidor-estatico.ts`, nunca `file://`: con `file://` faltan las webfonts y las
  medidas de ancho mienten). Chromium de Playwright, project `movil` (Pixel 7). Python del pipeline
  en su venv. **Sin cloud, sin prod**: ni el diff, ni el DOM, ni el código han salido del
  contenedor, y ningún modelo externo ha revisado nada.
- **Reproducciones:** cinco recorridos nuevos en
  `tests/e2e/journeys/adversarial/` (8 cuerpos de test) + `utiles-normativa.ts`. Los cinco llevan
  el **trinquete `test.fail()`** puesto: CI sigue en verde con los hallazgos abiertos (56 pasan) y
  se pondrá en rojo el día que alguien los arregle sin quitarlo.
- **Bundles:** `docs/qa/bundles/t19-adversario/` — ocho, uno por cuerpo, del run **en rojo** tomado
  antes de poner el trinquete.
- **Contexto asimétrico:** se ha leído **la promesa** y el código **para dirigir los ataques** —qué
  campo sale por dónde, qué gate mira qué, qué puerto cae en qué anexo—. **No** se ha leído el
  `docs/adr/ADR-03`, ni `docs/trayectorias/T-19-plan.md`, ni el razonamiento del implementador sobre
  por qué eligió cada cosa: ése es exactamente el modelo mental que aquí no hay que compartir. Las
  citas de comentarios que aparecen abajo son de **código y workflows**, y están porque son
  promesas operativas comprobables, no porque sean la justificación del diff.

## Promesa

> En la página de cualquier puerto español, Mareia dice la talla mínima legal que aplica **a ese
> puerto**, la que está **en vigor hoy**, y **nunca una cifra sin la excepción que la modifica**.

Son tres compromisos y el pase ataca los tres por separado: *«a ese puerto»* (H-5), *«en vigor
hoy»* (H-1, H-2), *«nunca una cifra sin su excepción»* (aguantó: ver **No reproducidos** nº 3).
Y como el módulo declara además que sin cobertura la tabla **se lee**, se ataca también esa cuarta
afirmación (H-4), más la que nadie escribió pero la página hereda: que mirar la talla no puede
costarle a nadie la marea (H-3).

## Clases atacadas

| Clase | Qué se intentó, con la entrada concreta | Resultado |
|---|---|---|
| **A2** · sello congelado | Construir con `verificadoEn` = `2019-04-07` y comparar la sección publicada con la de hoy. | **H-1** |
| **A4** · el registro que miente | ¿Dice la página algo que el sistema no hace? Tres claims medidos: «la sección degradará sola», «esta tabla se guarda», «no se resuelve por puerto porque exige el CIEM». | **H-1, H-4, H-5** |
| **A5** · maquetación / límites de ancho | `scrollWidth` a 320 y 360 px en **seis** páginas, dos por caladero (Vigo, Bilbao / Valencia, Palma / Telde, Las Palmas). | No reproducido (nº 1) |
| **A6** · entrada hostil / codificación | El U+00A0 recién metido: `window.find("36 cm")`, `innerText`, `textContent`, y los tests que comparan con espacio normal. | No reproducido (nº 4) |
| **A7** · frontera de autorización | Sitio estático sin sesión ni endpoint propio del módulo: no hay frontera que cruzar. | No aplica (nº 9) |
| **A8** · tiempo y husos | `fechaLarga` con `TZ` = UTC / America/Los_Angeles / Pacific/Kiritimati / Atlantic/Canary. | No reproducido (nº 2) |
| **A9** · sin JavaScript / lector de pantalla | La sección no trae `<script>` ni manejadores; `<caption>`, `scope="col"`/`scope="row"`, región con `aria-labelledby`. | No reproducido (nº 6) |
| **A10** · bloque rehén | Una marca de nota colgando en **una** fila del Anexo II, y medir qué se publica. | **H-3** |
| **A11** · promesa offline | Worker instalado, puerto **no** guardado, cobertura cortada de verdad, volver a la página. | **H-4** |
| **A12** · el gate permeable | Plantar cifras que no son las de la norma (7 cm, 3 cm, 5 cm, **0 cm**, −11 cm) y correr los gates que CI corre. | **H-2** |

## Hallazgos

Cinco reproducidos. Ordenados por lo que cuestan, no por la clase.

### H-1 · A2/A4 — el sello de vigencia envejece y no pasa nada: ni en la página ni en ningún gate

- **Recorrido:** `tests/e2e/journeys/adversarial/a2-sello-de-vigencia-que-no-caduca.spec.ts`
- **Bundle:** `docs/qa/bundles/t19-adversario/98297c6c420d/FAILURE.md`

Todo el «en vigor **hoy**» de la promesa se apoya en el gate diario G2, que le pregunta al BOE si el
RD 560/1995 sigue vivo y **solo si pudo preguntar y salió bien** escribe `fuente.verificadoEn`. G2
tiene tres colores a propósito, y el tercero —ámbar, «no se ha podido preguntar»— no rompe el
despliegue, que es la decisión correcta. Lo que el workflow dice que pasa entonces, dos veces:

> «`verificadoEn` **no se toca**, el sello envejece y **la página degrada sola**.»
> (`.github/workflows/normativa-vigencia.yml`, cabecera y `::warning::` de la línea 75)

**No degrada, porque no hay nada que degrade.** La sección imprime `verificadoEn` con `fechaLarga` y
no lo compara con nada. Construyendo el sitio con `verificadoEn` = `2019-04-07` —siete años y cuatro
meses— la sección publicada en Vigo es **idéntica byte a byte** salvo la cadena de la fecha:

```
- <span class="datos__valor">domingo, 30 de agosto de 2026</span>
+ <span class="datos__valor">domingo, 7 de abril de 2019</span>
```

Ese fue **el diff entero** de la sección (medido dos veces: mutando el dataset y reconstruyendo, y
con el `data/` efímero del recorrido). Sigue el mismo rótulo, la misma entradilla afirmando que *«por
debajo de estas medidas la pieza no se puede desembarcar ni retener»*, y el mismo aviso duro, que
además atribuye la posible antigüedad a **otra causa** («la fecha de comprobación de arriba es la
del día en que se guardó») — o sea que un lector **con** red no tiene ni esa pista.

Y no lo ve nadie. Con el sello de 2019 quedaron en verde: `python run.py check` (0), `pytest` del
pipeline (1759), `pnpm -r test` (557), `pnpm lint` (0) y `pnpm --filter web build` (0). El único
gate que mira ese campo comprueba su **forma**:
`assert.match(fuente.verificadoEn, /^\d{4}-\d{2}-\d{2}$/u)`.

Consecuencia: la rama ámbar de G2 puede durar meses —un cambio en la API del BOE, un secreto
caducado, el job desactivado— y el portal sigue publicando cifras legales con aspecto de
verificadas, sin que la página ni CI digan una palabra.

### H-2 · A12 — el trinquete de la versión en vigor mira 6 de las 118 cifras, y solo en 1 de los 3 caladeros

- **Recorrido:** `tests/e2e/journeys/adversarial/a12-el-trinquete-de-cifras-mira-seis-de-118.spec.ts`
  (4 cuerpos)
- **Bundles:** `fd2f39c2240e` (Merluza) · `b99b1319c77b` (Salmonete) · `8c682eb6ac5d` (Vieja
  colorada) · `96f82e9917f8` (Sardina a 0 cm)

G3 existe por un defecto **medido** de la fuente: un bloque del texto consolidado apila varias
redacciones y solo la última rige. La cura fue un trinquete con las seis especies canarias que movió
el RD 936/2025 (`TRINQUETE_CANARIO`).

**Los tres bloques apilan tres redacciones cada uno.** Comprobado en las fixtures del propio
pipeline:

| Bloque | Redacciones que trae el bloque |
|---|---|
| `ani` (Anexo I) | `BOE-A-1995-8639` · `BOE-A-2023-16726` · `BOE-A-2025-22024` |
| `anii` (Anexo II) | `BOE-A-1995-8639` · `BOE-A-2006-756` · `BOE-A-2025-22024` |
| `aniii` (Anexo III) | `BOE-A-1995-8639` · `BOE-A-2015-12897` · `BOE-A-2025-22024` |

Y hay diferencias reales entre la derogada y la vigente fuera del caladero canario: el atún rojo del
Anexo II pasó de `70` a `80 cm o 10 kg de peso`, y la cigala del Anexo II de `24` a `7 cm` de
longitud total. El trinquete cubre **un** bloque, y dentro de él **6 de sus 31 especies**.

Plantando una cifra que no es la de la norma en una especie de cada caladero, **ningún gate
determinista del repo la ve**:

| Cifra plantada | Puertos que la publican | `run.py check` | `pytest` (1759) | `pnpm -r test` (557) | `lint` | `build` |
|---|---|---|---|---|---|---|
| Merluza (Anexo I) 27 → **7 cm** | 47 | 0 | verde | verde | 0 | 0 |
| Salmonete (Anexo II) 11 → **3 cm** | 80 | 0 | verde | verde | 0 | 0 |
| Vieja colorada (Anexo III) 22 → **5 cm** | 26 | 0 | verde | verde | 0 | 0 |
| Sardina (Anexo II) 11 → **0 cm** | 80 | 0 | — | — | — | — |
| Sardina (Anexo I) 11 → **−11 cm** | 47 | 0 | — | — | — | — |

La «Vieja colorada» es el caso que mejor describe la forma del agujero: está **en la misma tabla que
G3 vigila**, a dos filas de una de las seis que sí mira. Y el `0` es el que peor se lee: `magnitud()`
solo exige que sea un número finito, así que un cero llega a la página pintado como cifra, con
`tabular-nums`, y una talla mínima de cero **no se lee como un error: se lee como que no hay
mínimo**.

Y lo plantado se publica con toda la ceremonia de autoridad de la sección — medido en el `dist/`:

```
Vigo  → Merluza Merluccius merluccius 7 cm 7
Telde → Vieja colorada Sparisoma cretense En Canarias: Vieja 5 cm 5
```

…bajo el enlace ELI, el sello «Vigencia comprobada contra el BOE el …» y el aviso de que solo el BOE
es auténtico.

Esto **no** es pedir que se congelen 118 números a mano. Es que hoy **nada compara lo publicado con
la fuente**: G2 no descarga el texto (lo dice y lo argumenta: le basta el sello de fecha del bloque)
y G3 mira el 5 % de las cifras. Es el mismo patrón que esta trayectoria ya cazó dos veces —el
recorrido A5 que solo miraba Vigo y no vio desbordarse los 80 puertos mediterráneos—, aplicado ahora
al dato en vez de a la maqueta.

### H-3 · A10 — una fila mal anotada del BOE deja sin publicar las 153 tablas de marea

- **Recorrido:** `tests/e2e/journeys/adversarial/a10-la-normativa-toma-de-rehen-la-marea.spec.ts`
- **Bundle:** `docs/qa/bundles/t19-adversario/141d616fcbbf/FAILURE.md`

La sección de tallas es, por decisión escrita del módulo, lo **consultable** de la página: `order:
30`, la última, «se viene a esta página a por la marea». Pero **el módulo no falla como se ausenta**:
`filasDeTallas` levanta —bien argumentado— y esa excepción sale en medio del render de una página de
puerto, dentro del build de Astro, donde no hay degradación posible.

Poniéndole al «Salmonete» del Anexo II una marca `(**)` que ese anexo no publica (solo tiene la `(*)`
del pulpo):

- `pnpm --filter web build` sale con **código 1**, en la primera página mediterránea por orden
  alfabético (`/mareas/andalucia/almeria/adra/`);
- `apps/web/dist/` se queda con **2 de las 191 páginas**: la construcción anterior ya se ha borrado y
  la nueva no llega;
- caen las **3 páginas de puerto** que el recorrido mide, una por caladero, ninguna relacionada con
  la fila rota — y con ellas la portada, el sitemap, el `sw.js` y las 153 tablas de marea.

El defecto no es que se levante: es **dónde**. Y el disparador vive fuera de la revisión de nadie —
el dataset lo escribe un pipeline que lee el BOE, y hay un job programado que reescribe y commitea
ese fichero con `[skip ci]`.

### H-4 · A11/A4 — «Esta tabla se guarda para leerla sin cobertura» es falso en las 153 páginas por defecto

- **Recorrido:** `tests/e2e/journeys/adversarial/a11-la-tabla-que-dice-guardarse-y-no-se-guarda.spec.ts`
- **Bundle:** `docs/qa/bundles/t19-adversario/cc0f8d87ecaa/FAILURE.md`

La decisión del humano fue que sin red la tabla **se muestra**, con aviso duro. El aviso empieza así,
horneado en las 153 páginas:

> «**Esta tabla se guarda para leerla sin cobertura**, así que puedes estar viendo una copia de hace
> semanas…»

Las dos mitades de esa frase no tienen el mismo estatuto. La segunda es una advertencia y es cierta.
La primera es una **afirmación sobre lo que hace la aplicación**, y es falsa por defecto: el worker
solo guarda la página de un puerto si el lector lo marca como favorito (`urlsDeFavorito`), y la
estrategia de navegación lo dice con todas las letras — «la copia solo se refresca si ya estaba
guardada, o sea, si es la página de un favorito. Al navegar por el resto del sitio no se guarda
nada». Sin copia y sin red, `laPaginaDeLaRedODeLaCopia` hace `throw`.

Medido: abrir Vigo con cobertura, leer la sección (que promete guardarse), dejar que el worker se
instale, **no** guardar el puerto —el aviso no lo pide ni lo menciona—, cortar la red y volver. No
hay `#tallas-minimas`: **no hay página**. Ni siquiera la pantalla de sin-cobertura del portal: el
error de red del navegador.

El módulo declara `offline: cache-first` con `routes` vacías, así que su política no aporta nada
aquí; quien decide si la tabla existe sin red es la caja de favoritos del core, no el módulo que
promete guardarse. La cifra que se promete tener a mano cuando se tiene la pieza en la mano es
exactamente la que no está.

### H-5 · A4 — los 17 puertos de Balears leen la talla del pulpo igual que Valencia, y la razón que da la página no es la de este caso

- **Recorrido:** `tests/e2e/journeys/adversarial/a4-la-excepcion-balear-no-se-resuelve-y-si-se-sabe.spec.ts`
- **Bundle:** `docs/qa/bundles/t19-adversario/357b20089027/FAILURE.md`

La nota `(*)` del Anexo II, literal del BOE: *«La talla del pulpo (Octopus vulgaris) recogida en la
presente tabla **no es de aplicación** en las aguas interiores y la plataforma continental de la
Comunidad Autónoma de las Illes Balears»*. De los 80 puertos del caladero mediterráneo, **17 son de
Illes Balears**. Medido en el `dist/`: el `<tr>` del pulpo de **Palma de Mallorca** y el de **Ibiza**
son **idénticos byte a byte** al de **Valencia**.

La sección explica por qué no resuelve las excepciones, y ahí está el defecto:

> «No se resuelve por puerto porque eso exige saber en qué división del CIEM cae cada dársena, y
> asignarla mal daría un número seguro y equivocado.»

Para la nota de la lubina eso es verdad (divisiones 8a/8b: geometría). Para ésta no: el criterio es
**administrativo** —la comunidad autónoma— y el portal ya tiene ese dato. Está en `ports.json`,
construye la propia URL en la que el lector está
(`/mareas/illes-balears/illes-balears/palma-de-mallorca/`) y es con lo que el pipeline decide que a
ese puerto le toca el Anexo II. La única de las tres excepciones que se puede resolver con lo que ya
hay en el repo es la que se deja sin resolver, con una explicación que describe a otra.

Lo que sí cumple: la nota está pegada a la cifra en las 80 páginas, y eso el gate de T-19 lo
asegura. El hallazgo es que el trabajo de decidir si aplica se le pasa al lector precisamente donde
no hacía falta.

## Observaciones (no cuentan como hallazgo: no las he reproducido en rojo)

1. **`/v1/modules` no publica `regulations`.** `module.ts` argumenta que el aviso de autenticidad
   viaja dentro del `name` de la atribución porque «`Attribution` tiene tres campos y son los tres
   que publica `/v1/modules`: **es ahí donde la atribución sale del portal**». El registry de la API
   (`apps/api/src/modules.config.ts`) solo trae `weather`, así que hoy la atribución del BOE no sale
   por ahí. No lo cuento como rotura porque `fishing` está igual —parece convención: la API registra
   los módulos con parte servidor— y porque la promesa que ataco es de la página, donde la
   atribución **sí** está. Lo que queda desalineado es la razón escrita.
2. **Las divisiones 8a/8b del CIEM.** Los comentarios de `vista.ts`, del componente y del gate
   glosan la nota de la lubina como «las divisiones 8a y 8b del CIEM —los puertos cantábricos de
   este portal—». Hasta donde alcanza mi conocimiento (y **no lo he verificado contra fuente en este
   entorno**, así que lo dejo como pregunta y no como hecho), la costa cantábrica española cae en la
   división **8.c**, no en 8.a/8.b. Si es así, la excepción de 44 cm no aplica a ninguno de los 153
   puertos, y lo publicado sigue siendo correcto —el texto de la nota es literal del BOE— pero el
   caso que justifica el gate no sería el que se cree. **Se escala al arquitecto para que lo
   verifique**, porque afecta al argumento y no al dato.
3. **«La norma no fija talla» y la lectura «no hay límite».** Las seis `por_determinar` se publican
   con esa frase más la nota `(*) Talla por determinar.`, debajo de una entradilla que afirma en
   universal que «por debajo de estas medidas la pieza no se puede desembarcar ni retener». Un lector
   puede salir de ahí creyendo que la anguila o el rape no tienen mínimo. No lo cuento como hallazgo
   porque convertirlo en test exigía **prescribir la redacción**, que no es mi papel; lo dejo
   nombrado para quien decida el contrato.

## No reproducidos

Lo que se intentó, con la entrada concreta, y por qué la app aguantó. Esta lista vale tanto como la
de arriba: sin ella, una pasada estéril y una alucinada se ven igual.

1. **Desbordamiento horizontal en los caladeros que el trinquete A5 no mira (el objetivo dirigido
   nº 1).** Era la pista más prometedora: A5 corre sobre Vigo, que es Anexo I. Se midieron
   `scrollWidth`/`clientWidth` a **320 y 360 px** en **seis** páginas, dos por caladero: Vigo y
   Bilbao (Anexo I), Valencia y Palma (Anexo II), Telde y Las Palmas (Anexo III). **No reproducido:
   320/320 y 360/360 en las doce medidas, cero px de desbordamiento.** La cura de `3286c0f` (quitar
   los dos `white-space: nowrap` y pegar la unidad con U+00A0) aguanta también en el Anexo III, que
   es el único con una tercera línea en la celda de especie (`En Canarias: …`).
2. **Huso horario del build (A8).** `fechaLarga` con `TZ` = `UTC`, `America/Los_Angeles`,
   `Pacific/Kiritimati` y `Atlantic/Canary`, sobre `2025-11-02` (entrada en vigor) y `2026-08-30`
   (sello). **No reproducido**: «domingo, 2 de noviembre de 2025» y «domingo, 30 de agosto de 2026»
   en los cuatro. El formateador fija `timeZone: "UTC"` y la fecha se ancla al mediodía
   (`new Date("…T12:00:00Z")`): no hay deriva de un día posible, se construya donde se construya.
3. **La tercera nota, la que solo tiene una instancia (el objetivo dirigido nº 2).** La sospecha era
   que el gate de 456 comprobaciones cubriera solo las notas con muchas instancias. **No
   reproducido, y por partida doble:** mutando el texto de la `(**)` del boquerón («10 centímetros»
   → «1 centímetro») y el de la `(*)` («Talla por determinar.» → «Sin talla mínima: cualquier
   ejemplar es legal.»), `pnpm -r test` se pone **en rojo** en dos cuerpos —«las tres notas que
   cambian la cifra para puertos de este portal dicen el número de la excepción» y «las seis “talla
   por determinar” dicen que la norma no la fija, y por qué»—. Las **tres** notas están fijadas por
   contenido (`44 centímetros`, `10 centímetros`, `Balears`), no solo las populares.
4. **El U+00A0 recién metido (el objetivo dirigido nº 3).** Se buscó a quién rompe. **No
   reproducido en cinco frentes:** `window.find("36 cm")` con espacio normal encuentra `36 cm`
   (Chromium normaliza), `innerText` devuelve `"36 cm\n(***) Excepto…"`, `textContent` lo conserva
   sin romper nada, el gate del `dist/` colapsa `\s+` (que en JS **incluye** el U+00A0) y el test de
   la vista compara contra `"36 cm"` explícitamente, no por casualidad. En el HTML publicado
   viaja como carácter, no como entidad (31–46 por página).
5. **Claves de fila duplicadas.** `claveDeFila` normaliza a slug; dos especies que colapsaran a la
   misma clave harían que el gate del `dist/` midiera la fila equivocada. **No reproducido**: cero
   colisiones en los tres caladeros, incluidas las multifila («Cigala (entera)» × 2 medidas, que se
   separan por su `medida`).
6. **Accesibilidad de la tabla (A9).** `<section aria-labelledby="titulo-tallas-minimas">` con su
   `<h2>`, `<caption class="solo-lectores">` que nombra el puerto, `scope="col"` en las tres
   cabeceras y `scope="row"` en cada especie; la nota que cambia la cifra va **dentro de la misma
   celda** que la cifra, así que un lector de pantalla que lea la celda lee las dos cosas. Cero
   `<script>` y cero manejadores en línea en la sección. **No reproducido**: no encontré por dónde
   separar la cifra de su excepción para quien no ve la tabla.
7. **Degradaciones del dataset.** Puerto sin caladero, puerto con un caladero que la norma no
   publica, `schema` distinto de `normativa/v1`, una clase de talla fuera de la unión cerrada, un
   `cm` que no es número: **todas levantan nombrando el fichero y el campo**, y el build se para. No
   hay camino por el que se publique «NaN cm» ni una tabla de otro mar en silencio. (El precio de
   esa decisión es H-3, que es otra cosa.)
8. **La geografía del reparto puerto→caladero.** Se revisaron los 153 puertos contra su provincia y
   las 12 curaciones del Estrecho más Sevilla. **No reproducido**: Algeciras / San Roque / La Línea
   al Mediterráneo y Sanlúcar / Chipiona / Rota / Cádiz / Chiclana / Conil / Barbate al Atlántico
   están del lado correcto de Punta Marroquí; Ceuta y Melilla al Anexo II; las dos provincias
   canarias enteras al Anexo III; Sevilla, fluvial, al estuario al que sale. **Tarifa** es el único
   caso frontera y el código lo dice en su motivo en vez de disimularlo.
9. **A7 · frontera de autorización.** No aplica y se dice en vez de callarlo: la sección es HTML
   estático sin sesión, sin parámetros y sin endpoint propio (el módulo no declara `api`). No hay
   nada que escalar a `seguridad` por esta superficie.
10. **A3 · entrada hostil.** Tampoco hay superficie: ni un solo dato de esta sección viene del
    lector. Todo lo hostil que se pudo meter se metió por el dataset, que es lo que hay arriba.
11. **Zoom de texto al 200 %.** Los tokens tipográficos (`--m-text-body: 15px`, `--m-text-meta:
    12px`) están en **píxeles**, así que la preferencia de tamaño de letra del navegador no escala
    nada — pero eso es de todo el sitio y de mucho antes de T-19, no de esta superficie, y el zoom
    de página (que sí funciona) equivale a la medida de reflow del nº 1. **Descartado por alcance**,
    no por bueno.

## Estado de los trinquetes

Los cinco recorridos llevan `test.fail()` con el `snapshotId` de su bundle en el comentario. **CI
queda en verde** con los hallazgos abiertos: `npx playwright test` → **56 pasan** (48 anteriores + 8
cuerpos nuevos como fallo esperado), `pnpm lint` 0, `pnpm typecheck` 0. Cuando se arregle cada
hallazgo hay que **quitar su `test.fail()`**; a partir de ahí el recorrido se queda como gate
permanente y no se borra. Si alguien arregla el defecto y se olvida del trinquete, Playwright lo dice
(«expected to fail, but passed»).

Nada de lo que este pase midió tocó el árbol de trabajo: las mutaciones viven en un `data/` efímero
que se le pasa al build por `MAREIA_DATA_DIR` y a los gates de Python por el argumento que ya
aceptan. El repo quedó como estaba (`git status` limpio salvo lo que este informe añade), y el
`dist/` está reconstruido desde el dataset publicado.
