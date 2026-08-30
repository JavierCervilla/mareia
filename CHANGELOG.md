# Changelog — Mareia

Formato *Keep a Changelog* relajado; lo más reciente arriba.

## 2026-08-30 — T-20 · Las 86 especies que el BOE regula, con los dos nombres que tienen

El portal estrena página: **`/pesca/especies/`**, el catálogo de las **86 especies** a las que el RD
560/1995 le fija una talla mínima, con el nombre que usa la norma, el que la ciencia acepta hoy, los
caladeros que la regulan con su talla y los registros de presencia de OBIS. Es la primera vez que el
proyecto publica un dato de **dos fuentes internacionales** (WoRMS y OBIS) y la primera vez que
publica un número que **no significa lo que parece**.

- **Los dos nombres, y el de la norma no se sustituye nunca.** La norma es de 1995 y la taxonomía se
  ha movido: de los 86 nombres, **64 resuelven en WoRMS preguntándolos tal y como los escribe el
  BOE**, **21 resuelven porque nosotros decidimos qué preguntar** —las 15 filas de género
  (`Sepia spp`, `Mullus spp`…) más 6 erratas de la propia norma (`Cáncer pagurus`,
  `Melanogrammús aeglefinus`, `Thunnus aibacares`…), todas con la **correspondencia declarada como
  nuestra** y su motivo— y **1 no resuelve** y publica por qué: `Lophius piscatorius, L. Budegassa`
  nombra **dos** especies en una sola celda, y repartir una fila legal en dos decide un alcance que
  no es nuestro. De las que resuelven, **11 tienen hoy un nombre aceptado distinto**
  (`Solea vulgaris` → **Solea solea**, `Psetta maxima` → **Scophthalmus maximus**, `Sparus auratus`
  → **Sparus aurata**…). **No es un error del BOE que haya que arreglar**: el nombre de la norma es
  el que tiene consecuencia legal y el aceptado es el que sirve para buscar la especie en cualquier
  otra base, así que se publican los dos, cada uno con su fuente y su `AphiaID`, y la fila dice **por
  qué** difieren. El gate **E1** exige el nombre del BOE **literal en las 86 filas** del `dist/`;
  probado en rojo publicando sólo el aceptado, que nombra las **11** filas afectadas.
- **Un género no se convierte en especie.** Las **15** filas `spp` publican su rango («género, no
  especie») y ninguna nombra una especie concreta: que la talla aplique al género entero es un hecho
  jurídico, y elegirle una especie sería estrecharle a la norma un alcance que la norma no estrecha.
  Son 15 filas del BOE sobre **14 géneros distintos** —`Mugil` sale dos veces, como `Mugil spp` en el
  Anexo I y como `Mugil spps`, con la errata de la propia norma, en el II, y las dos se publican tal
  cual—, y las dos cifras se dicen siempre juntas porque no son la misma. Con el mismo criterio se
  rotulan las otras **dos filas que tampoco son una especie**: `Palinuridae`, que es una **familia**
  entera, y `Trisopterus minutus capelanus`, que es una **subespecie**. **17 rótulos sobre 86**, y
  ninguno en las 68 que sí son una especie.
- **Los registros de OBIS son esfuerzo de muestreo, no abundancia, y ninguna cifra sale sin decirlo.**
  La dorada en toda la costa gallega son **12 registros**, de 3 conjuntos de datos; la misma especie
  en el conjunto de OBIS pasa de 18.000. Así que en esta página **no existe el elemento «número»**:
  la cifra sale siempre dentro de una frase que lleva el sesgo pegado, en el mismo elemento, y la
  explicación larga va antes de la primera cifra. El gate **E4** lo mide en el **bloque más interno**
  que contiene cada número —no «en la página»—, sobre **todos** los HTML construidos: **106 cifras**,
  todas con su sesgo al lado. Probado en rojo quitándole la coletilla a la frase: **105 cifras
  desnudas** con la explicación larga todavía en la página, o sea que un gate a nivel de página
  habría seguido verde. Y el cero no se publica como cifra: el dataset publica los 114 recuentos tal
  y como los devolvió OBIS —**9 de ellos son un cero**— y la interfaz los convierte en la ausencia
  que son, porque un `0 registros` se lee como una ausencia medida y eso es lo que OBIS no puede
  afirmar. **Los dos silencios se distinguen**: «se preguntó y no hay ningún registro» (9) no es lo
  mismo que «no se preguntó», que le pasa a la única fila sin taxón y publica su propio motivo.
- **La sección de la página de puerto es UN ENLACE, no una segunda tabla.** Las tallas ya las publica
  `regulations` con sus notas pegadas a cada cifra; repetirlas serían **dos superficies del mismo
  dato**, y dos superficies del mismo dato se desincronizan hasta publicar dos cifras legales
  distintas para la misma especie en la misma página. La sección enlaza al catálogo **ya filtrado por
  el caladero del puerto** —51 especies en el Cantábrico y golfo de Cádiz, 33 en el Mediterráneo, 31
  en el Canario— y ocupa **1.453 B** (753 B comprimidos). El mismo argumento decide el código: la
  talla no se vuelve a escribir aquí, se presta `textoDeTalla` de `regulations`.
- **El filtro por caladero es CSS puro, y usa `:target` en vez de los radios de la portada.** Un radio
  no se puede preseleccionar desde una URL sin JavaScript, y la sección de los **153** puertos tiene
  que enlazar al catálogo ya filtrado. Con `:target` el estado vive en el fragmento: los 153 enlaces
  funcionan, el estado es compartible y la página conserva su **cero bytes de JavaScript**. Como un
  selector de atributo no puede leer un identificador que sale del dataset, los tres caladeros están
  escritos a mano en la hoja y **un gate exige que todo caladero del catálogo tenga sus reglas**, para
  que un cuarto no rompa el filtro en silencio.
- **`ModuleId` se amplía por tercera vez, a seis.** `species` no cuelga de `regulations` aunque hable
  de lo mismo: lo que añade **no sale del BOE**, sale de WoRMS y de OBIS, y una de esas licencias trae
  una condición —**no se puede redistribuir la base entera ni partes sustanciales de ella**— que hay
  que poder leer sola y no diluida entre la reutilización de la legislación española. Lo que
  publicamos es una **extracción curada**, y eso está escrito en el campo de licencia de la
  atribución, no en un comentario. Va con `order: 35`, la última de las cinco secciones de módulo, y
  es **el único módulo sin política offline**: el precacheo de esta PWA es **por favorito** y el
  catálogo no está en lo que guarda un favorito, así que en vez de prometerlo la sección dice lo
  contrario («este enlace necesita cobertura»).
- **Dos hallazgos que salieron de medir y no de leer.** El gate E1 se puso rojo en su primera pasada
  con una fila real: el BOE escribe **`Thunnus thynnus`** en los Anexos I y II y **`Thunnus Thynnus`**
  en el III, dos nombres que cualquier slug en minúsculas colapsa en uno —y con la clave repetida, el
  gate encuentra siempre la primera fila y la segunda puede publicarse a medias en verde—. No se
  corrige la ortografía de la norma: son dos entradas, y ahora el dataset les da **dos claves**. La
  `clave` es el slug del nombre **más el digest de su literal exacto**, y el sufijo va en las 86 y no
  sólo en las dos que chocan: al salir únicamente del nombre, no depende de la posición de la fila ni
  de qué otras filas existan, así que añadir o quitar una especie no repunta el `data-especie` de
  ninguna otra. Distinguirlas sólo por la caja —`thunnus-thynnus` frente a `Thunnus-Thynnus`— habría
  vuelto a colapsarlas en cuanto algo las comparase sin distinguir mayúsculas. Lo comprueban **dos**
  gates y los dos están probados en rojo con el sabotaje que de verdad ocurre (implementar la clave
  como un slug en minúsculas y regenerar las 86): `run.py check` sale en **exit 1** nombrando las dos
  filas que colisionan, y `pnpm --filter web build` en **exit 1** porque el lector **rechaza el
  dataset entero si dos especies comparten clave**. Y la cigala (`Nephrops norvegicus`) tiene **dos
  tallas en el mismo anexo** —2 cm de cefalotórax y 7 cm de longitud total—: sin decir qué mide cada
  una, las dos cifras se leen como una contradicción, y publicadas como dos entradas repetirían el
  mismo recuento de OBIS dos veces en la misma fila, que es una invitación a sumarlos. Las tallas
  cuelgan de su caladero (varias) y la presencia es una sola, en el dataset y en la interfaz.
- **Los dos carriles se juntan, y manda el artefacto.** La interfaz se escribió en paralelo al
  dataset y contra la forma que se esperaba de él; al fusionar, la forma real mandó y se adaptó el
  lector, que es literalmente un adaptador entre lo que publica el pipeline y lo que consume el
  módulo. Con **una regla**: se renombran campos, **no se reescriben valores** —el `origen: "mareia"`
  con el que el dataset firma una correspondencia llega a la interfaz sin traducir, porque un
  adaptador que reescribe firmas publica una que no ha estampado nadie—. Lo que se midió al juntarlos
  y no se sabía antes: el dataset resuelve **cuatro** rangos y no dos, y los dos raros son justo los
  que una unión de dos valores habría tenido que aplastar contra «especie».
- **Medido al cerrar, con el comando de CI**: `pnpm test` **651 en verde** (268 de ellos contra el
  `dist/`) · `pnpm test:e2e` **61 passed** · `pytest` **1.903 en verde** · `pnpm lint`,
  `pnpm typecheck`, `pnpm --filter web check`, `pnpm --filter web build`, `ruff` y `run.py check` en
  **0** · el catálogo son **105.902 B** de HTML (10.280 B comprimidos) con **86 filas** y **cero
  scripts** salvo el JSON-LD · **153** páginas de puerto con su enlace al catálogo filtrado,
  comprobado contra el `dist/`.

## 2026-08-30 — T-21 · Áreas marinas protegidas: 348 avisos, 10 «ninguna» y ni un vértice

La página de puerto publica los espacios marinos protegidos que tiene a menos de **30 km** —nombre
oficial, figura y distancia aproximada— a partir de **RAMPE 2025** (MITECO). Es la primera sección
del portal que **no es información sino advertencia**, y eso mueve dónde se coloca y cómo se
escribe.

- **Se hace la mitad defendible del encargo.** Lo pedido era «zonas de pesca y zonas prohibidas».
  Las de pesca **no se publican**: no hay fuente, y decir dónde *sí* se puede pescar es inventar. Las
  protegidas sí, porque hay fuente oficial y el error cae del lado conservador. La consecuencia va
  escrita en la página y no insinuada: el aviso de la fuente —«que no haya un área protegida cerca no
  autoriza a pescar: esto dice dónde NO se puede, nunca dónde sí»— va **antes** de la lista, en las
  **153** páginas, y un gate del `dist/` busca ocho maneras de sugerir lo contrario («pesca
  permitida», «zona libre», «apto para la pesca»…).
- **143 de 153 puertos tienen alguna, y son 348 relaciones de las 86 áreas de la fuente.** El
  reparto por figura de lo publicado: **208 ZEPA · 108 ZEC · 26 reservas marinas · 6 AMP**. La quinta
  figura de RAMPE, `ZEC/AMP`, tiene una sola área —El Cachucho, en el Cantábrico abierto— y no cae a
  menos de 30 km de ningún puerto del catálogo: está glosada y probada en el módulo, y el gate lo
  dice en vez de fingir que la mide.
- **Los 10 puertos sin ninguna área lo DICEN**, y es la decisión de producto de la trayectoria.
  Alboraya, Arenys de Mar, Donostia, Getaria, Mataró, Melilla, Sagunto, Sevilla, Silla y Valencia no
  pierden la sección: publican «Ninguna a menos de 30 km de este puerto» y, debajo, hasta dónde se ha
  mirado y que el radio es **una decisión nuestra, no una ausencia de la fuente**. Una sección que
  desaparece se lee como «no hay nada que saber» y no se distingue de «esto no lo hemos hecho».
- **La distancia es al BORDE del área, y la primera versión de esta trayectoria la medía al vértice
  más cercano.** El verificador rechazó ese primer intento y midió el coste: la cota por vértice
  **perdía 6 relaciones reales** de las 348, tres de ellas del **Corredor de Migración de Cetáceos
  del Mediterráneo**, que es la **única AMP** del catálogo y que así se publicaba en tres puertos y
  se perdía en otros tres. Que el error cayera siempre del lado de «alejar» no lo hacía inofensivo:
  en una sección cuya única razón de ser es avisar, alejar es **avisar de menos**. La causa está en
  la fuente —RAMPE tiene una mediana de arista de 2,01 m pero **728 aristas de más de 1 km y una de
  159,6 km**, y el error de la cota es del orden de media arista—, y el arreglo es distancia punto a
  segmento sobre cada arista, en `geo.distancia_a_segmento_km`, con `math` y sin `pyproj` ni
  `shapely`. Pollença tenía el Corredor a **27,6 km** de su borde y a **69,8 km** de su vértice.
  Se sigue publicando como **cota entera** —«a menos de 9 km» y no «8,7 km»—, ahora con los dos
  redondeos hacia arriba (la décima en el dato, el kilómetro en la página). Las **59** relaciones por
  debajo del kilómetro dicen todas «a menos de 1 km», y las **10** en las que el puerto cae
  **dentro** de un área lo dicen con esas palabras en vez de disolverlo en una distancia corta.
- **Gate P5: las dos métricas, comparadas en cada ingesta.** El derivado publica cuánto se separan
  —**6 relaciones de diferencia, 342 → 348**, la mayor de **42,2 km**— y `run.py check` lo comprueba
  sin red contra un umbral declarado, porque CI no se baja los 54,8 MB de RAMPE. Dos rojos distintos:
  por **umbral**, si la fuente pierde densidad de vértices y la divergencia crece; y sin umbral
  ninguno, si alguna relación *desaparece* al medir el borde, que es aritméticamente imposible —el
  vértice **es** un punto del borde— y por tanto sólo puede ser un error en la distancia
  punto-segmento. Probado en rojo por las dos vías.
- **Y `k0` quedó atado a algo que no somos nosotros.** El gate P1 anunciaba una capa de «escala» que
  validaba `k0 = 0,9996`, y no la validaba: `k0` entraba por los dos lados de la comparación y se
  cancelaba. Medido con `K0 = 1` —olvidarse entero del factor de escala de UTM, 1,8 km sobre el
  terreno—: las **cuatro** capas seguían en verde. La quinta capa es un punto que publica un tercero
  con sus **dos** coordenadas a la vez, la UTM y la geográfica —el ejemplo numérico de la transversa
  de Mercator de Snyder, USGS Professional Paper 1395 (1987), págs. 269-270—; nuestra inversa lo
  devuelve a **4,7 cm** de donde su autor lo puso, con tolerancia de 1 m, y se pone roja en cuanto
  `k0` se equivoca en la **séptima cifra** (verde en +2,0 × 10⁻⁷, roja en +2,2 × 10⁻⁷).
- **Las siglas se glosan; el régimen, no.** ZEPA → «Zona de Especial Protección para las Aves», ZEC →
  «Zona Especial de Conservación», AMP → «Área Marina Protegida», pegadas a la sigla y no en un pie.
  Lo que **no** se escribe es qué permite o prohíbe cada figura: eso lo fija la declaración oficial de
  cada espacio y no está en esta fuente. Desarrollar una sigla es leer; contar su régimen sería
  redactar derecho por nuestra cuenta. El `switch` que las escribe cierra con `never`: una sexta
  figura **no compila** hasta que alguien decida qué significa.
- **Módulo propio, y `order: 12`: la primera de las secciones de módulo.** `ModuleId` pasa a
  cinco (`fishing | weather | navigation | regulations | protected-areas`); es la **segunda** vez que
  se ejerce esa puerta y el motivo está en el diff del contrato: no es pesca —aquélla calcula una
  convención sin respaldo experimental— ni normativa —el BOE dice qué mide una pieza; RAMPE, qué
  espacios están protegidos—, y colgarla de cualquiera de las dos habría metido en una sola lista de
  atribuciones la licencia real del BOE junto al hueco de licencia de RAMPE. El `order: 12` la pone
  delante de solunar y meteo (20) y de las tallas (30) porque **es una advertencia y no una
  consulta**: en la jerarquía del design brief las advertencias están fuera de los tres niveles. El
  hueco por debajo de 20 lo dejó reservado T-19 con esas palabras. Lo que ese 12 **no** hace, dicho
  para que nadie lo suponga: `order` ordena las secciones de módulo entre sí, no por encima de los
  bloques del core, así que la sección se lee justo **después** del dato de marea y no es un banner.
- **Ni un vértice cruza a `dist/`.** La página de descarga de RAMPE **no declara licencia ni
  condiciones de uso**, así que se publican **hechos derivados** —nombre, figura, código, distancia—
  y ninguna geometría, ni simplificada ni en una caja envolvente. La atribución dice el hueco tal
  cual: «MITECO · RAMPE 2025 — condiciones de uso no declaradas en origen». No se le pone una CC
  porque otras fuentes del ministerio la lleven. Un gate mide el HTML publicado —nada con pinta de
  coordenadas, y tope de bytes por sección— porque el último sitio por el que la geometría podría
  escaparse es un `data-` puesto para «un mapita».
- **Cero *juice* sobre una advertencia.** Ni parpadeo, ni halo, ni recuadro de estado, ni contador,
  ni orden por «más interesante»: el orden es el del dato, que es la proximidad, y la plantilla **no
  reordena** —si el derivado llegara desordenado, levanta, porque ordenarlo aquí taparía el fallo—.
  La mancha de terracota cae solo en los dos avisos, nunca sobre un nombre ni sobre una distancia, y
  hay un gate que lo mide sobre la hoja (sin `@keyframes`, `animation`, `transition`, `box-shadow`
  ni `border-radius`).
- **Sin cobertura la lista se lee, y el aviso empieza por su condición.** `offline: cache-first` y
  **cero JavaScript**: el aviso no se enciende, va horneado siempre, y empieza por «si guardas este
  puerto» porque quien guarda una página es la caja de favoritos y solo la del puerto que el lector
  marque. Es la corrección de H-4 de T-19 aplicada **antes** de publicar, no después.
- **El gate de la trayectoria, probado en rojo dos veces.** «Los 10 puertos sin área lo dicen» se
  mide sobre el `dist/`: la frase, el motivo del dato y la marca del caso vacío, en las 10 páginas
  construidas. Se probó (a) quitándole la frase a la rama vacía —salieron los 10 listados por su
  slug— y (b) escondiendo la sección en esos 10 puertos con un `isEnabledForPort`, que es la
  tentación real: se cayeron **9 de los 11** recorridos del fichero —los nueve que leen el `dist/`—,
  nombrando el primer puerto sin sección.
- **Lo que pesa, medido sobre el `dist/`** —la página con la sección menos la página sin ella, sobre
  las 153—. La sección añade **1.955 B** en Valencia (sin ninguna área, +4,7 %), **2.944 B** en Vigo
  (una área, +6,3 %) y **4.925 B** en Guía de Isora (seis, el máximo del catálogo, +11,5 %);
  comprimida, entre **599 y 1.186 B**. La hoja de estilos suma **1.004 B** al bundle común
  (18.782 → 19.786, +5,3 %) y el `dist/` entero pasa de 7,733 a 8,249 MB (+6,7 %). **Ni un byte de
  JavaScript.** El máximo ya no se teclea: un recorrido lo recalcula sobre las 153 páginas
  construidas. Hasta la revisión de esta trayectoria aquí figuraba **Agaete** como el más gordo con
  4.808 B, y Agaete es el **quinto** —4.684 B—: la cifra reproducía, la palabra «máximo» no.
  (Tras el pase adversario el máximo es **4.866 B**: las filas en las que el puerto cae dentro del
  área ya no publican cota. Comprimido, entre **607 y 1.174 B**, gzip por defecto sobre ese mismo
  coste marginal.)
- **El pase adversario reprodujo cuatro hallazgos, y el eje de los cuatro es el mismo**: el derivado
  se **commitea** y **nada en CI lo vuelve a derivar de la fuente** —`run.py areas-protegidas`
  necesita red y el job de datos no la usa, a propósito—, así que todos los gates del artefacto eran
  de **coherencia interna** y cualquier fichero coherente se publicaba. Lo arreglado:
  - **La regla dura ya no viaja como texto libre del dataset.** «Que no haya un área protegida cerca
    no autoriza a pescar» llegaba a las 153 páginas desde `fuente.aviso`, y lo único que lo miraba
    eran **ocho expresiones regulares y una subcadena**: un aviso plantado de los mismos 186 bytes
    —«…no autoriza a pescar **sin licencia; con ella, en el resto no hay veda**»— las pasaba todas y
    se publicaba en negrita, antes de la lista, con `pnpm test`, `run.py check`, `pytest` y `ruff` en
    verde. Igual el «hasta dónde hemos mirado» de los 10 puertos vacíos, que era `puertos[].motivo`.
    Las dos frases son ahora **constantes del módulo** (`NO_AUTORIZA_A_PESCAR`,
    `hastaDondeSeHaMirado`) y la sección las pinta venga lo que venga en el dato; el derivado sigue
    trayendo las suyas —son su registro— pero **no llegan al HTML**. El texto publicado no cambia ni
    una palabra: cambia **quién responde de él**. Gate: las 153 páginas del `dist/` tienen que traer
    la constante **literal**, y se probó en rojo quitando el párrafo (0 ocurrencias en la página de
    Vigo, `pnpm --filter web test` a 241/2) y volviendo a pintar el texto del dato (el recorrido
    adversario, en rojo por el permiso plantado).
  - **Ninguna fila puede contradecir el título de su sección.** `dentro: true` apagaba la única cota
    numérica del radio —en el pipeline la condición era `distancia > radio and not dentro`, y del
    lado de la web no había segunda opinión—, así que Alicante podía publicar *«Reserva marina de la
    Isla de Tabarca · a menos de **480 km** · El punto de este puerto cae dentro de esta área»* bajo
    el rótulo **«Áreas marinas protegidas a menos de 30 km»**, todo verde. Ahora
    `proximidadDeArea` recibe el radio que el título publica: si el puerto **cae dentro** no se
    publica cota —ahí la distancia al borde mide lo metido que está el puerto, no lo lejos que está
    el área— y si está **fuera** y la cota pasa del radio, **levanta** y rompe el build, que es
    fail-safe. Las 10 relaciones con `dentro` de hoy están todas a 0,1 km o menos, así que la cota
    que se deja de publicar decía «a menos de 1 km» y no añadía nada al hecho que la sustituye.
- **Gate P6: lo publicado se vuelve a derivar de la fuente, y dice por escrito qué NO cubre.** Es el
  único gate que compara el artefacto contra **la fuente** y no contra sí mismo, y es la respuesta
  parcial a los otros dos hallazgos: (a) moviendo una fila de puerto y recalculando el resumen, el
  Vendrell perdía la reserva marina que tiene a **0,1 km** y Carboneras publicaba esa misma reserva
  «a menos de 28 km» estando a unos 700, con el total en **348** antes y después; (b) con el semieje
  mayor del GRS80 desviado **255 m** —un **0,004 %**, el tamaño de una errata— las cinco capas del
  gate P1 devuelven **cero fallos** y salen las mismas 348 relaciones, pero **191 distancias cambian
  y 5 `dentro` vuelcan**. P6 rehace las relaciones desde el **recorte de RAMPE ya commiteado** —el
  mismo parser, la misma `vecindad_de`, el mismo `_area_a_json`— y las diffea campo a campo; el
  precedente es **G4 de T-19** con las respuestas capturadas del BOE. **Su alcance va escrito y no
  prometido**: cubre las **14 relaciones de las 7 áreas** del fixture y **NO cubre las otras 334 de
  348**, porque RAMPE 2025 son 54,8 MB que no se commitean; la línea del ✓ de `run.py check` imprime
  las dos cifras. Probado en rojo cinco veces, incluido **el elipsoide desviado**, que mueve **8 de
  las 14** con P1 en verde —eso se afirma en el mismo test—, y enchufado al comando con los otros
  tres gates silenciados a propósito.
- **Y lo que el pase adversario *refutó*.** La revisión previa contaba **36 de 153** páginas con la
  tabla fuera de la columna de contenido. Medido con la **tinta real** de los nodos de texto y no con
  cajas ni `scrollWidth`, son **0/153** a 320 px y **0/153** a 412 px: lo que contaba de más era el
  `<caption class="solo-lectores">`, que está en `clip-path: inset(50%)` y **no se pinta**. No se ha
  tocado nada por ese motivo.

## 2026-08-30 — T-19 · Tallas mínimas por caladero: 118 cifras del BOE, y ninguna sin su excepción

La página de puerto publica la talla mínima legal de captura del caladero al que pertenece, con la
fecha de la redacción en vigor, el día en que una máquina comprobó que la norma sigue viva y el
enlace ELI. Es la primera sección del portal que publica un dato **con consecuencia jurídica**, y eso
cambia dos reglas: el error es asimétrico —publicar una talla menor de la vigente le cuesta una multa
a quien se fía; mayor, solo un pez— y el adorno deja de ser una cuestión de gusto.

- **El texto consolidado del BOE no es una tabla: son tres apiladas.** Cada bloque de anexo conserva
  las redacciones históricas envueltas en `<version fecha_vigencia>` —`ani` trae la de 19950409 (54
  filas), 20230721 (54) y 20251102 (55)—, y **solo la última está en vigor**. Un parser que leyera
  todos los `<tr>` del bloque publicaría en el caladero canario **seis cifras derogadas, cinco del
  lado que multa**: aligote 12 en vez de 20, cabrilla 15 en vez de 19, cachucho 18 en vez de 22,
  chopa 19 en vez de 23, serrano imperial 15 en vez de 20 (y el pargo, 33 en vez de 28, conservador).
  El parser selecciona por `fecha_vigencia` y **aborta** si no hay ninguna `<version>`, en vez de
  caer hacia atrás a «leer el bloque». El trinquete G3 fija esas seis y mide **el JSON publicado**,
  no la función del parser — lección pagada en T-13.
- **118 tallas publicadas: 53 del Anexo I, 34 del II y 31 del III.** Y **17 no son un entero de
  centímetros**, aunque la columna se titule «Talla (en cm)»: 9 son un **peso** (`6,4 kg` del atún
  rojo, `1 kg` del pulpo), 6 son «talla **por determinar**» —la norma declara que no la ha fijado—,
  1 es una disyunción (`80 cm o 10 kg de peso`) y 1 es **ilegible en origen**. Con las cuatro
  decimales (`3,7` en las colas de cigala, `2,5` en la almeja y la chirla, `8,5` en el cefalotórax
  del bogavante), **21 de las 118** no son un entero. `talla: number` habría sido un tipo falso que
  obliga a inventarse un número 17 veces: es una **unión cerrada de cinco clases**, cada celda
  conserva su literal del BOE y el `switch` que las escribe **no tiene `default`** —cierra con
  `never`—, así que la rama que pintaría un «por determinar» como si fuera un número no existe.
- **El `1 1` de la boga no se corrige.** El BOE imprime `1 1` donde casi con seguridad quiso decir
  `11`. Corregir por inferencia una cifra legal es inventarla: se publica el literal, con el motivo a
  la vista y el enlace al texto auténtico. Hay un recorrido cuya única función es que nadie lo
  «arregle» sin darse cuenta.
- **Las 9 especies con excepción llevan su nota entera y pegada a la cifra**, no en un pie al que
  haya que bajar. Son las 6 «por determinar» del Anexo I con su `(*)`, el boquerón con su `(**)`, la
  lubina con su `(***)` y el pulpo del Anexo II con su `(*)`. Y tres de esas notas **cambian el
  número para puertos de este portal**: la lubina son 36 cm salvo en las divisiones 8a y 8b del CIEM
  —el golfo de Vizcaya, o sea los puertos cantábricos— donde son **44**; el boquerón, 12 salvo en la
  división IX a) donde son **10**; y la talla del pulpo **no se aplica** en aguas interiores de Illes
  Balears, y ahí hay **17** puertos del catálogo. Las **dos del CIEM no se resuelven por puerto** y es
  una decisión de alcance: exige saber en qué división cae cada dársena —geometría— y asignarla mal
  da un número **seguro y falso**. Una excepción visible es honrada; un número seguro y equivocado,
  no. **La balear sí se resuelve**, porque su criterio es administrativo y el portal ya sabe la
  comunidad de cada puerto (ver el pase adversario, más abajo).
- **Los 153 puertos declaran su caladero: 47 · 80 · 26.** El campo lo **genera** el pipeline en cada
  `make build` (un campo tecleado en `ports.json` duraría una ejecución), y sale de la provincia en
  141 de los 153. Los otros doce se curan uno a uno **con su motivo publicado**, porque Cádiz es la
  única provincia española que cruza el límite entre dos caladeros —Punta Marroquí—: siete al golfo
  de Cádiz, tres al Mediterráneo, Sevilla al Atlántico por ser un puerto fluvial 80 km Guadalquivir
  arriba, y **Tarifa**, que está *sobre* el límite y se resuelve al Atlántico **diciendo que es una
  decisión y no un dato**. Un gate compara la lista con el README: una curación sin motivo publicado
  es una opinión que nadie puede revisar.
- **Módulo propio, no una sección de pesca.** `ModuleId` pasa a cuatro (`fishing | weather |
  navigation | regulations`): la unión está cerrada para que dar de alta un módulo se vea en el diff
  del contrato, y esta es la primera vez que se ejerce esa puerta. Colgarlo de `fishing` «para no
  tocar el contrato» habría dado dos módulos con una identidad, una versión y las atribuciones
  mezcladas —la teoría solunar y la Agencia Estatal en la misma lista—, y darlos de baja por separado
  dejaría de ser borrar una línea. Una sección `static`, `order: 30` (consultable: se viene a esta
  página a por la marea), **cero JavaScript de cliente** y la sección **pide su caladero por slug**,
  como pesca y meteo: `ContextoDeSeccion` no cambia.
- **Sin cobertura la tabla se muestra, y lo dice.** `offline: cache-first`, decisión del humano
  frente a la recomendación del arquitecto de ocultarla: ocultarla la haría inútil justo el día que
  sirve —un teléfono en la orilla, con la pieza en la mano—. El precio no se disimula: la sección no
  tiene JavaScript con el que enterarse de si hay red, así que el aviso duro va **horneado siempre**
  y redactado para ser verdad en los dos casos («… puedes estar viendo una copia de hace semanas …
  una talla derogada se lee igual de bien que la vigente»). Y empieza por **su condición** —«si
  guardas este puerto»—: quien guarda la página es la caja de favoritos, y sin marcar el puerto no
  hay copia (ver el pase adversario).
- **G2 vigila la vigencia a diario, y tiene tres desenlaces y tres colores** — que es la pieza que lo
  hace sostenible. **Verde**: nada ha cambiado, se escribe `fuente.verificadoEn` y se commitea; es el
  **único sitio** desde el que se escribe esa fecha, porque tecleada a mano no diría nada. **Rojo**:
  la norma está derogada o el texto consolidado ha cambiado → CI en rojo y acción crítica en el
  dashboard. **Ámbar**: no se ha podido preguntar (red, BOE caído) → `verificadoEn` **no se toca**, el
  sello envejece a la vista y la página degrada sola. Confundir el ámbar con el rojo es como se
  consigue que un gate acabe desactivado el primer día que el BOE tenga un mal día.
- **Cero *juice* sobre una cifra legal.** Ni barra, ni estrella, ni rareza, ni contador, ni orden por
  «mejores especies», ni la mancha de terracota sobre ningún número. No es una preferencia estética:
  el adorno consigue que se le crea al número más de lo que merece, y lo que merece está escrito
  encima con la fecha en la que se comprobó. Hay un gate que lo mide sobre la hoja de estilos —sin
  `@keyframes`, `animation`, `transition`, `box-shadow` ni `border-radius`, y la única regla con
  `--m-terra` es la de los avisos—. La ampliación del design brief (§7 quinquies) lo escribe como
  regla, no como gusto.
- **El gate de la trayectoria, probado en rojo.** «Ninguna cifra sin su nota» se mide sobre el
  `dist/`: se busca la fila de cada especie con excepción en las **153 páginas construidas** y se
  exige el **texto entero de la nota dentro de esa misma fila** — 8 especies del Anexo I × 47 puertos
  + el pulpo del Anexo II × 80 = **456 comprobaciones**. Se probó dejando en la fila solo la marca
  `(***)` y reconstruyendo: las 456 salieron listadas con su puerto y su especie. Un gate que
  exigiera «la fila menciona la nota» habría pasado en verde publicando «36 cm (***)» en Bilbao,
  donde son 44.
- **Lo que pesa, medido.** La página de puerto pasa de **29.167 a 46.580 B** en el Anexo I (+60 %;
  comprimida, de **8.598 a 11.664 B**, +36 %), de 29.925 a 41.461 B en el Mediterráneo (+39 %) y de
  30.733 a 42.550 B en el canario (+38 %). El Anexo I es el que más crece porque tiene 53 filas **y**
  sus tres notas repetidas dentro de ellas. La hoja de estilos añade **1.287 B** al bundle común
  (17.384 → 18.671, +7,4 %) y el `dist/` entero pasa de 5,62 a 7,67 MB (+36,5 %). **Ni un byte de
  JavaScript**: esta sección conserva el cero-JS del core, al revés que la de meteo.
- **El pase adversario encontró cinco roturas, y tres eran afirmaciones falsas.** Se arreglaron
  cuatro y la quinta se documentó como tradeoff:
  - **El sello de vigencia envejecía sin degradar nada.** El workflow de G2 prometía dos veces que
    en su rama ámbar «la página degrada sola»; construyendo con `verificadoEn` = `2019-04-07` la
    sección publicada era **idéntica salvo la cadena de la fecha**, y el único gate que miraba ese
    campo comprobaba su *formato*. Ahora hay dos umbrales con nombre y su porqué escrito —**7 días**
    (G2 pregunta a diario: siete días ya no es un mal día del BOE, son siete intentos fallidos) y
    **60** (a los dos meses nadie puede sostener que lo publicado esté verificado)— y **tres
    estados**: la sección cambia de rótulo, publica `data-vigencia` y añade un aviso que solo existe
    cuando hay algo que decir. Los avisos dicen «hace **más de** N días», una **cota inferior**,
    porque el HTML se queda en el teléfono de quien lo abrió y una cuenta exacta sería mentira
    mañana.
  - **El trinquete de cifras miraba 6 de las 118, y en 1 de los 3 caladeros.** Plantando merluza a
    7 cm (47 puertos), salmonete a 3 (80), vieja colorada a 5 (26, **en la misma tabla que G3
    vigila**) y sardina a 0 y a −11, los cinco gates deterministas salían verdes. **G4 ·
    reconstrucción**: el dataset se regenera entero desde las respuestas del BOE capturadas y se
    diffea campo a campo contra el JSON commiteado —**118 tallas, 3 anexos**, notas, literales y
    procedencias, sin salir a la red—. **G5 · rango sano**: ninguna magnitud publicada puede ser
    cero ni negativa, porque un cero no se lee como un error sino como que **no hay mínimo**. G3 se
    queda: sigue siendo el trinquete específico de la selección de versión.
  - **«Esta tabla se guarda para leerla sin cobertura» era falso en las 153 páginas.** El precacheo
    es **por favorito**: sin marcar el puerto no hay copia y sin red no hay tabla. Se corrigió el
    **texto y no el precacheo** —inflarlo a 153 páginas es un coste que nadie ha pedido—: el aviso
    empieza ahora por su condición, y un recorrido ata la frase a la condición real (guardar el
    puerto y cortar la red).
  - **Los 17 puertos de Balears leían la talla del pulpo idéntica a Valencia**, con una coartada que
    describía a otra nota. La excepción del pulpo es **administrativa** —la Comunidad Autónoma— y el
    portal ya sabe la de cada puerto: ahora se resuelve **por las dos ramas** (17 leen que ahí no se
    aplica, 63 que sí) **añadiendo** la respuesta debajo de la nota entera, nunca en su lugar.
  - **Una fila mal anotada deja el `dist/` en 2 páginas de puerto de 191**: se documenta como
    tradeoff explícito en ADR-03 —fallar el build es *fail-safe*, y el disparador lo caza
    `run.py check` antes de construir— con su radio de explosión escrito y una mitigación barata
    propuesta y **no** implementada. Su recorrido conserva el `test.fail()` como medida permanente
    de esa decisión.
- **Lo que este dataset no publica**, dicho para que no se busque: vedas y cupos (no hay fuente
  estructurada; el art. 5 del RD 347/2011 solo habilita al Ministerio a fijarlos por orden), zonas de
  pesca (no existe la fuente), normativa autonómica (es otra trayectoria) y las **dos notas del CIEM
  resueltas por puerto** (exigen geometría marina que este portal no calcula).

## 2026-08-29 — T-15 · el API en producción, `/health` fuera del enrutado público y el sitio que no envejece solo

`mareia.cervilla.es` servía las 192 páginas desde T-17, pero **`/v1` devolvía 502**: `mareia-api` no
tenía Dockerfile. Enganchar un hostname a un servicio que no puede arrancar convierte una URL «que
aún no existe» en una URL **rota**, y para quien la visita no es lo mismo. T-15 deja la imagen, la
configuración y las pruebas locales que demuestran que funciona; el despliegue es el paso siguiente.

- **`apps/api/Dockerfile`: el API, con lo justo dentro.** Dos etapas sobre `denoland/deno:alpine-2.9.6`
  fijada **por digest**. La final pesa **118,5 MiB** en disco, de los que **104,4 MiB** son la base:
  la aplicación añade **14,2 MiB** (12 MiB de dependencias resueltas contra `deno.lock` y 2,3 MiB de
  árbol). Dentro no hay `node`, `npm`, `pnpm`, `corepack` ni un solo `node_modules`; tampoco la web,
  ni el pipeline de datos, ni los `__tests__` (552 KB de 940 KB de `packages/`, casi todo fixtures
  dorados de la USNO: material de CI, en la imagen solo serían superficie). Son **225 ficheros**, y
  la lista de lo que entra está **escrita en el Dockerfile**, que es lo que hace comprobable la
  frase «la imagen lleva esto». Se descartó `deno compile`, que habría dado una imagen más pequeña,
  porque `core-deps.ts` resuelve el dataset desde `import.meta.url` y en un binario compilado eso
  apunta al sistema de ficheros virtual: el dataset dejaría de ser un árbol legible dentro de la
  imagen, y el dataset es el producto.
- **Dónde escucha, preguntado al kernel y no al log.** La avería silenciosa de este despliegue es un
  proceso que bindea a la interfaz equivocada: arranca sin quejarse, el contenedor queda `running`,
  el log dice «listo» y Traefik contesta 502. `main.ts` bindea a `0.0.0.0` **explícito** y su banner
  **lee la dirección del socket** en vez de repetir la constante. Pero eso sigue siendo el proceso
  hablando de sí mismo, así que la prueba se pidió fuera: `/proc/net/tcp` **dentro del contenedor**
  —la imagen no trae `ss` ni `netstat`— da `00000000:2253` y `00000000:2254` en estado `0A`, es
  decir **0.0.0.0:8787 y 0.0.0.0:8788 en LISTEN**, con `uid=1000` (no root) y sin ningún socket
  IPv6. Y desde **otro contenedor de la misma red**, que es lo que hace Traefik: `/v1/ports` → 200
  con los **153 puertos**, todos con su `quality`.
- **`/health` deja de ser alcanzable desde fuera, y se corta en dos sitios.** El barato es el
  dominio (ruta `/v1` en Dokploy), pero esa configuración vive **fuera del repositorio**: el día que
  alguien clone el servicio, el healthcheck vuelve a internet y **ningún test lo nota**. Así que el
  corte de verdad está en el código (`src/http/public-app.ts`): dos servidores sobre la misma app,
  el público (8787) sin `/health` y el interno (8788) con la app entera, sin exponer. Son dos
  **puertos** y no dos rutas porque lo que separa a los dos públicos es *quién puede llegar*, y en
  Docker eso se dice con un puerto. El 404 del puerto público es **el mismo, byte a byte, que el de
  cualquier ruta inventada**, con un test que lo ata: un cuerpo propio para `/health` confirmaría a
  quien sondea que esa ruta existe y está tapada. El healthcheck sigue vivo para Dokploy, en el
  `HEALTHCHECK` de la imagen por loopback contra el 8788 (`healthy` en ~40 s). **Ningún endpoint de
  `/v1` cambia**: la app pública envuelve a la de `createServer()` sin sustituirla.
- **El volumen de Deno KV, con la cifra medida.** `Deno.openKv()` sin ruta usa el almacén por
  defecto del proceso, que en un contenedor vive en la capa efímera: cada redespliegue tiraba la
  caché del boletín y el primer arranque volvía a pegarle a AEMET y a Open-Meteo por los 153
  puertos. Ahora la ruta se declara con **`MAREIA_KV_PATH`** (el Dockerfile la fija en
  `/var/lib/mareia/kv/weather.sqlite`; en desarrollo se sigue usando el almacén por defecto, que es
  lo que allí se quiere). Tras un ciclo completo —153 puertos × `/weather` y `/bulletin`, 306
  respuestas, 25 s, todas 200— el almacén tiene **288 entradas** (144 celdas × marine y forecast),
  **71.970 bytes** de valores serializados y **4.296.208 bytes = 4,1 MiB en disco**, de los que
  **4,0 MiB son el WAL de SQLite**: quien dimensione el volumen tiene que contar con el WAL y no con
  el JSON. **Tres ciclos más no añadieron un solo byte**, que es la prueba de que la caché funciona.
  El boletín aporta **cero** porque la instancia corrió sin `AEMET_API_KEY`: con clave cachea **por
  zona costera y no por puerto**, como mucho 11 entradas topadas a 64 KiB cada una. Y que la caché
  **sobrevive al redespliegue** no se supone: reiniciando el contenedor, la respuesta vuelve con el
  `fetchedAt` de antes del reinicio y `ageSeconds: 60`.
- **Un permiso que no era obvio.** El comentario de `weather-kv.ts` decía que el almacén de KV «lo
  abre el runtime y no pasa por este permiso», y eso es cierto **solo mientras no se le da ruta**.
  Con ruta explícita, `Deno.openKv()` exige `--allow-read` **y `--allow-write`** sobre ella —medido:
  `NotCapable: Requires write access to …`—, así que el `CMD` los concede sobre ese directorio y
  solo sobre ése. `/var/lib/mareia` es el único sitio del contenedor donde este proceso puede
  escribir. Y `--cached-only` impide que un arranque en producción salga a internet a por código.
- **El rebuild diario de la web, y de qué depende.** El sitio es SSG y publica **el día en que se
  construyó**, horneado en el HTML de las 192 páginas. `.github/workflows/rebuild-diario.yml` lo
  reconstruye a diario (04:20 UTC), y la parte importante es lo que va escrito en su cabecera:
  **un redespliegue a secas no basta**, porque el `RUN` que escribe la fecha es una capa de Docker y
  con el mismo commit se reutiliza de caché — el sitio publicaría el día de ayer **con un despliegue
  nuevo y en verde**. Por eso el workflow escribe `BUILD_DATE` antes de desplegar (por **POST**, no
  por `PATCH`: el vault ya tenía medido que con `PATCH` la llamada no aplica) y **relee** para
  confirmar dos cosas: que se escribió lo que se quería, y que **no cambió nada más** — porque
  `application.update` se asume parcial y esa asunción no está probada contra el panel real. Después no da por buena la llamada: espera a que el dominio
  publique `data-otro-dia-build="<hoy>"`, porque «se pidió un despliegue» y «el sitio publica hoy»
  son cosas distintas. Sin los secretos configurados el job sale **en rojo a propósito**: un rebuild
  que no corre es invisible —el sitio sigue en pie, solo que con la fecha de otro día— y esa es la
  única señal posible. **Esto es lo que la normativa fechada de T-19 necesita para poder degradar**:
  un dato que envejece, sobre un sitio que no se reconstruye, no degrada nunca — se queda para
  siempre en el día en que se construyó, diciendo que está fresco.
- **`actionlint` en CI, y lo primero que encontró.** Cierra el peldaño que faltaba desde T-17: los
  workflows son código de CI y hasta ahora no los miraba nadie. Y el primer hallazgo fue **en el
  propio paso de `shellcheck` de T-17**: `SC2046`, `$(git ls-files '*.sh')` sin comillas. Era real —
  un `.sh` con un espacio en la ruta se parte en dos argumentos y shellcheck acaba mirando ficheros
  que no existen. Medido antes de escribirlo: sale con **exit 2** y «openBinaryFile: does not
  exist», **no en verde** — el gate no se callaba, fallaba diciendo otra cosa mientras el fichero
  que dice lintar no se lintaba nunca. Un rojo por el motivo equivocado tampoco es un gate: manda a
  arreglar lo que no está roto. Arreglado con `git ls-files -z | xargs -0`. `hadolint` pasa
  ahora por **los dos** Dockerfiles; sobre el del API sacó `DL3003` (un `cd` dentro de un `RUN`),
  arreglado con rutas absolutas. Los dos linters se probaron **en rojo** además de en verde.
- **El build es hermético.** El `packageManager` de la raíz lleva su hash de integridad
  (`pnpm@10.33.0+sha512.…`) y **corepack verifica el tarball contra él** antes de ejecutarlo. Sigue
  descargándolo —eso no lo cierra un Dockerfile—, pero ya no confía en lo que le llegue: un registry
  comprometido o un intermediario que sirva otro pnpm **hacen fallar el build** en vez de meter un
  gestor de paquetes ajeno en la imagen que se despliega. Comprobado que sabe fallar (alterando un
  carácter: `Error: Mismatch hashes`), que la imagen de la web sigue construyendo con él, y que
  `pnpm/action-setup` lo sigue entendiendo — ese `+sha512.…` es *build metadata* de semver y `npm`
  lo resuelve a `10.33.0`, que es exactamente lo que la action hace por dentro.
- **e2e contra producción** (`pnpm test:e2e:prod`): que `/v1/ports` responde con el catálogo y su
  `quality`, que **`/health` NO es alcanzable desde fuera** y que la portada sigue sirviéndose.
  **No necesita navegador** —todo con el fixture `request`—, así que corre sin `playwright install`,
  que es lo que lo hace lanzable en el minuto siguiente a un despliegue. Y **se puede lanzar sin
  haber desplegado**: los dos modos de «no está» se cuentan distintos porque llevan a mirar sitios
  distintos —el 502 («hay un proxy delante, pero el servicio de detrás no está sirviendo») y el
  fallo de conexión («o el dominio no resuelve, o no hay nada escuchando… si el despliegue aún no se
  ha hecho, es lo esperado»)—, en vez de un `ENOTFOUND` que obliga a adivinar. **Sabe fallar**: con
  los dos contenedores reales detrás de un nginx que reproduce el corte por ruta de Traefik, los
  tres recorridos van en verde; añadiendo una línea que publique el healthcheck, el de `/health` se
  pone en rojo. No corre en CI a propósito: atar el rojo de un PR a que producción esté en pie sería
  atarlo a una avería que no está en el PR.

## 2026-08-29 — T-14B (arreglo del pase adversario) · la señal llega a las tres listas, y el `null` se explica por su motivo

El pase adversario de T-14B reprodujo en rojo dos cosas que la trayectoria había dejado a medias.
Ninguna era un fallo de lo implementado —lo implementado funcionaba—: eran una superficie que se
quedó fuera y una frase que explicaba un dato con el motivo de otro.

- **La calidad se dice en las tres listas de puertos, no en una.** El portal tiene tres —la portada,
  las **12** páginas de región y las **24** de provincia— y las dos últimas son la ruta que la propia
  portada llama canónica («Ver todas las regiones»). La señal aparecía en **una sola página del
  sitio**: medido, **306 entradas mudas**, con el resultado de que el último clic antes de la ficha
  se daba a ciegas —en `/mareas/galicia/pontevedra/`, Vigo (medida) y Baiona (estimada) se
  presentaban idénticos—. Ahora las dos familias pasan `estimada` al mismo componente
  (`Indice.astro`) con **la misma palabra** que la portada: «medida» / «estimada», en la meta de la
  entrada («Europe/Madrid · estimada» en provincia). Ni una regla de CSS nueva, ni un segundo
  vocabulario, ni un byte de JavaScript: estas páginas conservan su cero-JS.
- **Lo que pesa, medido.** Las 12 páginas de región pasan de **58.545 a 73.812 B** de HTML
  (**+26,1 %**) y las 24 de provincia de **93.717 a 104.394 B** (**+11,4 %**). Por página, la mayor
  (Andalucía, 32 puertos) 8.936 → 12.129 B y Pontevedra 4.570 → 5.266 B; **comprimidas**, que es
  como viajan, 1.965 → 2.078 B (**+5,7 %**) y 1.351 → 1.402 B (**+3,8 %**): la señal es texto que se
  repite, y eso es lo que gzip hace mejor.
- **El filtro no baja con la señal, y se dice por qué.** Es un mando para descartar en una lista que
  no cabe de un vistazo —en la portada quita 120 de 153—, y aquí la región mediana tiene **12**
  puertos y la provincia mediana **5,5**: el control, sus tres cuentas y su nota explicativa
  pesarían más que la lista que filtran. Además, en **7 de las 24 provincias** «Solo los medidos» dejaría la página
  vacía (Alicante 11/0, Barcelona 9/0, Castellón 3/0, Lugo 2/0, Gipuzkoa 2/0, Sevilla 1/0, Ceuta
  1/0). Quien quiera filtrar tiene el catálogo entero en la portada, a un toque. El razonamiento
  completo, en `apps/web/design-brief.md` §7 quater.
- **El `null` del error de hora se documenta por su motivo real, con las dos cifras.** El contrato
  estrenado por T-14B explicaba los `null` de `hw_time_err_p95_min` con un solo motivo —«la
  observación existe pero no tiene pleamares identificables»— y eso es cierto en **13** puertos y
  falso en **118**: en esos 118 no hay observación ninguna (`rmse_m: null`), y su propia ficha lo
  venía diciendo con otras palabras desde T-09. Dos superficies publicadas del mismo portal
  afirmando hechos contrarios sobre el mismo `null`. `apps/api/README.md` publica ahora los tres
  casos en una tabla, cada uno con la frase con la que la ficha lo cuenta y con su cifra contada del
  dataset: **118 de 153** sin observación, **13 de 153** micromareales medidos y **22 de 153**
  medidos con pleamares (131 `null` en total). Y se dice que **no hay un cuarto caso**: un error de
  hora medido contra una observación que no existe es imposible por construcción.
- **Los gates atan el significado, no la presencia** — que es exactamente por lo que esto reapareció:
  T-09 ya había arreglado la misma confusión en la ficha, y volvió cuando el dato estrenó una
  superficie nueva porque lo único gateado era que el campo **estuviera**. Ahora: `/v1/ports`
  clasifica cada puerto en su caso y lo compara con `metrics.samples` y `matched_extremes`, dos
  contadores del QC que **no viajan por el API** y que nadie puede ajustar «para que pase»; y el
  recorrido adversario recalcula las cifras de la tabla del contrato desde el dataset y clasifica las
  **153 fichas construidas** por lo que dicen sus filas, exigiendo el mismo reparto puerto a puerto.
- **Comprobados mordiendo, los cuatro.** Poner un error de hora a un puerto sin observación
  (Alicante) deja **verdes los dos gates de presencia de T-14B** y pone rojo el nuevo: «alicante:
  /v1/ports lo publica como «imposible» (rmse_m null, hw_time_err_p95_min 12.3) y el QC del dataset
  dice «sin observación» (0 muestras de observación, 0 pleamares casadas)». Bajar la cifra del
  contrato de 118 a 117 da «las cifras de la tabla del contrato no son las del dataset». Reescribir
  el motivo con la frase vieja da «el contrato explica el null «sin observación» con otras palabras
  que la ficha del puerto». Y quitarle la señal a **un solo puerto** —la forma real de romperse
  esto— da «vigo: su entrada de /mareas/galicia/ no dice «medida»» y «vigo: su entrada de
  /mareas/galicia/pontevedra/ no dice «medida»», con los dos recorridos adversarios en rojo
  nombrándolo también.
- **Los tres recorridos adversarios se quedan como gate permanente**: se les ha quitado el
  `test.fail()` con el que afirmaban el defecto y ahora vigilan el arreglo. Suite: `pnpm test`
  519/0, Playwright 48/48, Deno 23/0 y 7/0, `pnpm lint` y el anti-slop de UI **LIMPIO**.
- **Sigue abierto, a propósito**: H-3 (el filtro ordena por procedencia y no por error: Puerto del
  Rosario, «medida», RMSE 1,3424 m, sobrevive al filtro; San Sebastián de la Gomera, «estimada»,
  grade B, 0,0364 m, se esconde) es una decisión de producto y la toma el humano, no este PR.

## 2026-08-29 — T-14B · la calidad deja de ser un dato que hay que ir a buscar

El proyecto sabía de cada puerto si su predicción está medida y con cuánto error, y lo decía bien
**en la ficha**. En los dos sitios donde alguien **elige** puerto —la portada y `GET /v1/ports`— esa
información no estaba, así que los 153 se presentaban como si valieran lo mismo. Y **120 de ellos
(78 %) publican una marea estimada**: constantes prestadas del mareógrafo más cercano. No era una
mentira, era una **omisión en el punto de decisión**, que en un portal cuya regla es «un puerto no
publica una precisión que no tiene» acaba teniendo el mismo efecto.

- **`GET /v1/ports` publica la calidad de cada puerto.** Cada entrada del catálogo lleva `quality`
  con `grade`, `estimated`, `rmse_m` y `hw_time_err_p95_min`. Antes, saber cuáles están medidos
  costaba **153 peticiones** a `/v1/ports/:slug`; ahora, una. Los `null` viajan **como `null`** y no
  se omiten del objeto: «no se pudo medir» es dato, y un campo ausente se rellena con un cero. Las
  frases que explican el porqué (`grade_reason`, `estimated_reason`) se quedan en la ficha: son un
  párrafo por puerto y una lista no es donde se lee un párrafo. Medido contra el servidor,
  no contra la función: el cuerpo pasa de 30.956 a 43.628 B (**+41 %**; gzip 4.175 → 4.660,
  **+11,6 %**) y la primera petición tarda 87 ms leyendo las
  153 estaciones — las siguientes, 2,2 ms, porque el repositorio cachea por fichero.
- **La portada lo dice en cada entrada, y se lee sin JavaScript.** «Almería · estimada», «Almería ·
  medida», en la misma cursiva de la meta del índice: una palabra, no un chip de color (el color
  solo refuerza). Va **horneada en el HTML**, porque una señal que solo existe si corre el JS es una
  señal que a veces no está (lección de T-11). Medido: 35.710 → 47.997 B de HTML (**+34,4 %**; gzip
  4.013 → 4.770, **+18,9 %**), de los que 10.557 son la señal de las 153 entradas.
- **Y se puede filtrar por ella, con cero bytes de JavaScript.** Tres radios ocultos a la vista —no
  al teclado ni al lector de pantalla— y reglas de hermano en CSS: «Todos los puertos 153 · Solo los
  medidos 33 · Solo los estimados 120», con las cuentas horneadas del catálogo. **No es una isla**:
  la portada conserva su cero scripts (`scripts-de-core.ts`) y el presupuesto de bytes de T-12 no se
  toca. Cuesta 1.044 B de HTML y 1.515 B de CSS minificado en la hoja que ya comparten todas las
  páginas (15.869 → 17.384 B). Una región que se queda sin puertos al filtrar **desaparece con ellos** (sus cuentas van
  horneadas en el bloque), para no dejar un rótulo sobre una lista vacía. El recorrido Playwright que
  lo comprueba corre con `javaScriptEnabled: false`: 153 → 33 → 120 → 153, y de 12 regiones visibles
  a 11.
- **El orden no cambia y la escala no se inventa.** Sigue mandando la geografía —ordenar por calidad
  escondería puertos legítimos al final de la lista— y `grade`/`estimated` son los que ya calculaba
  el QC del pipeline: aquí sólo se **enseñan donde se decide**.
- **La documentación publica el umbral, no el adjetivo.** `apps/api/README.md` describe los cuatro
  campos y qué significa cada `grade` con la cifra que lo decide, leída de `grade.py`: A/B piden
  mareógrafo a ≤ 5 / ≤ 30 km de la dársena, registro de ≥ 10 / ≥ 1 años, coste de truncado ≤ 1 / ≤ 3
  cm RMS, RMSE normalizado ≤ 0,05 / ≤ 0,15 y error de hora p95 ≤ 20 / ≤ 45 min. Y que `estimated`
  **no** se deduce del grade: hace falta mareógrafo a ≤ 5 km **y** observación propia.
- **Tres gates, comprobados mordiendo.** Su forma de fallar no es «no aparece», es «aparece en 148 de
  153 y nadie lo nota», así que los tres **recomputan la lista desde el catálogo** —no desde una
  constante que haya que acordarse de subir— y **fallan nombrando el puerto**: quitarle la calidad a
  La Manga da «la-manga-del-mar-menor: sin quality»; borrar `rmse_m` del objeto (hueco en vez de
  `null`) da «cabo-de-palos: no publica rmse_m»; quitarle la señal a Adra da «adra: su entrada de la
  portada no dice «estimada»» y «adra: su entrada no lleva data-estimado, el filtro no la alcanza»,
  y el mismo defecto en el navegador sin JS da «entradas de la portada sin decir su calidad:
  AdraAlmería»; falsear la cuenta de una región da «canarias: dice 0 medidos y tiene 4». Los dos
  primeros miran el **cuerpo HTTP servido** y los otros el **HTML de `dist/`**, no la función que los
  genera.

## 2026-08-29 — T-14A · la licencia del dataset dice la verdad

El portal promete que cada dato trae «su fuente, su licencia y el código que lo calcula». La carta
de presentación fallaba justo ahí, en dos afirmaciones que ahora están **medidas** contando los JSON
publicados uno a uno.

- **El dataset no es CC-BY 4.0: dos tercios son CC-BY-NC.** `README.md` decía que los constituyentes
  «se publican bajo CC-BY 4.0» y, dos secciones más abajo, que eran CC-BY «en su mayoría; **algunas**
  estaciones (p. ej. Bilbao y Huelva) llevan CC-BY-NC». Contado sobre `source.primary.license` de las
  153 estaciones —que es la licencia que gobierna el dato publicado—: **104 `cc-by-nc-4.0` y 49
  `cc-by-4.0`**. La mayoría es NC y «algunas» eran **el 68 %**. No es una errata de documentación:
  la gracia del proyecto es que cualquiera se descargue el dataset y corra su propia instancia, y
  quien lo hiciera leyendo «CC-BY 4.0» heredaba una restricción sin saber que la tenía. El README
  publica ahora el reparto **con su cifra**, y el arreglo es decir la verdad y no purgar 104 puertos
  para salvar un titular: `cc-by-nc-4.0` es compatible con publicar, Mareia no es comercial.
- **Se atribuían dos fuentes de las que no sale ni un dato, y faltaban dos que sí se usan.**
  `README.md` acreditaba los constituyentes a REDMAR, TICON-4 y FES2022. Medido: **TICON-4 es la
  primaria de las 153** estaciones, **REDMAR 0 y FES2022 0** (ni como primaria ni como fallback). Y
  al revés, `openwatersio/tide-database` (agrega y normaliza las constantes, en las 153) y
  `GeoNames` (nombre y coordenadas de la dársena, en 141) **no aparecían en ninguna atribución del
  README** aunque cada JSON las acredita. Sobraban dos y faltaban dos, y faltar es la falta grave:
  es publicar un dato sin decir de quién es. La tabla de fuentes es ahora exactamente el conjunto
  usado; REDMAR y FES2022 se nombran **con su motivo y fuera de la línea de atribución**, porque una
  atribución es una afirmación de procedencia, no una lista de cortesía.
- **El permiso de redistribución filtra ANTES que el rango de fuente.** `_DATASET_RANK` daba a
  REDMAR la **máxima prioridad**, y las condiciones del banco de datos de Puertos del Estado dicen
  que «en ningún caso se permite la transferencia de los datos a terceros». Hoy no hay vía de
  ingesta, así que **ningún dato publicado cambia**; lo que había era que el día que la hubiera, el
  pipeline la habría elegido la primera y publicado lo que no puede publicarse, sin que nada lo
  parase. Ahora las candidatas que no se pueden republicar se apartan del conjunto entero —antes
  incluso de medir cuál es la más cercana, porque si no una fuente impublicable seguiría decidiendo
  qué otras compiten— y el rango decide **entre las publicables**. Es una lista de licencias
  **permitidas** con defecto **excluir**: una licencia que nadie ha leído no entra por existir.
  `cc-by-nc-4.0` está dentro a propósito: prohíbe el uso comercial, no la redistribución. Si un
  puerto se quedara sin ninguna candidata publicable, **no se publica** y el fallo la nombra: un
  puerto que falta se ve el mismo día; un dato republicado sin permiso, ya está fuera.
- **Dos gates, y los cuatro ataques vistos en rojo.** El del README **recomputa** el reparto y el
  conjunto de fuentes desde `data/stations/*.json` —no lee ningún campo resumen, porque comparar una
  declaración con otra declaración del mismo autor no comprueba nada— y exige **igualdad exacta**,
  no ausencia: un gate que sólo prohíbe se satisface callando. Comprobado que muerde: cambiar 104 por
  100 da «el README dice 100 y los JSON de data/stations dan 104» (y «suma 149 y hay 153»); atribuir
  `FES2022` da «el README atribuye fuentes que NINGÚN dato del dataset usa»; quitar `GeoNames` da «el
  dataset usa fuentes que el README NO atribuye … la falta grave de las dos» — **mensajes distintos
  a propósito**, para que quien lo vea sepa cuál de los dos le ha pasado. El segundo **inyecta** en
  `reconcile.py` una fuente sin permiso de redistribución con rango 0, la más cercana y con el
  registro más largo, y exige que pierda, que no aparezca ni como `fallback` y que una licencia sin
  revisar tampoco entre; con el filtro quitado (el estado de antes) la inyectada gana y acaba dentro
  del JSON emitido.

## 2026-08-29 — T-13 · el pase adversario: tres hallazgos arreglados y un tope que no medía nada

El rol `qa-adversario` atacó lo que el `verificador` y el rol `qa` ya habían dado por bueno y sacó
**cuatro hallazgos** (informe en `docs/qa/informe-adversario-t13.md`, bundle en
`docs/qa/bundles/t13-adversario/`). Tres de los cuatro no son del catálogo: son **de los gates que
T-13 dejó vigilando el catálogo**, que es lo que quedaba sin atacar. Se arreglan aquí y sus
recorridos se quedan **como gate permanente**, sin envoltorio de trinquete.

- **A-17 · el detector de curva congelada sólo miraba UNA meseta por día.** El gate A-1 preguntaba
  por la meseta **más larga** del día y sólo medía dentro de ésa, así que cualquier congelación más
  corta que la meseta natural del puerto le era invisible **por construcción**: la meseta natural
  hacía de escondite. Con 12 puertos apenas había mesetas; con los 153 de T-13 hay 103, y en **65
  (42,5 % del catálogo)** cabía una congelación real que el gate no veía — el peor caso, el golfo de
  Valencia (Valencia, Alboraya, Silla y Sueca): meseta natural de **200 min** escondiendo **190 min**
  de curva falsa con **62,06 mm** de marea real suprimida, sesenta y dos veces el umbral. Es la
  tercera vez que este gate cambia de sitio la sonda —puntas → interior → **todos los tramos**— y la
  lección es la misma cada vez: *la pregunta estaba mal hecha porque su respuesta dependía del tamaño
  del catálogo*. Ahora recorre **todas** las mesetas (`tramosPlanos`). Ni el umbral ni el sitio donde
  se mide se han tocado: lo único que cambia es **cuántas veces se mide**. No puede enrojecer sola:
  los tramos son maximales y disjuntos y dentro de cualquiera de ellos todas las muestras publicadas
  valen lo mismo, así que sus alturas reales no pueden diferir más que el paso de publicación —
  medido sobre 8 fechas repartidas por 2026 × 153 puertos (**1 224 días-puerto, 6 526 mesetas**), la
  excursión máxima de una meseta legítima es **0,993 mm** (Borriana, 2026-10-20, 80 min). Comprobado
  que muerde: inyectada la congelación de Valencia en la curva real, el gate la caza con **61,8 mm**
  y el instrumento viejo, con el mismo fraude delante, se queda **verde**.
- **A-18 · la prueba de sensibilidad del gate se ponía roja por el calendario.** `A-1 bis` —el test
  que demuestra que A-1 **sabe fallar**— construía su meseta alrededor de **la primera pleamar del
  día**, y cuando ésa cae cerca de medianoche la ventana se recorta contra el borde del día: **33 de
  los 365 días de 2026 (9,0 %)** daban menos de las cuatro horas exigidas, con un mínimo de 150 min.
  No es teórico: era el rojo con el que el adversario se encontró al llegar, con un `dist/` del
  2026-03-29. Un gate que enrojece por el calendario invita exactamente a lo prohibido —bajar la
  constante hasta que el día malo pase—, así que **se cambia de ventana, no de umbral**:
  `pleamarConSitio` elige la pleamar del día con más sitio a los dos lados. Las cuatro horas siguen
  intactas. Comprobado sobre los **365 días** del año (el propio gate los recorre) y con la suite
  completa construida en **2026-03-29, 2026-02-27 y 2026-12-20** —tres de los 33 días malos—, verde
  en los tres; con el instrumento viejo, `A-1 bis` da `la meseta inyectada debería durar horas y dura
  150 min`. El gate exige además que la elección **siga haciendo falta**: si volver a la primera
  pleamar dejara de fallar ningún día, avisa de que ya no mide nada.
- **A-19 · la cifra que justifica la estimación se publicaba en formato inglés.** «las constantes son
  las del mareógrafo `X`, a **24.8** km de la dársena» y «no alcanza B: RMSE normalizado **0.221** >
  **0.15**», en páginas es-ES donde el punto **sí** separa millares dos bloques más abajo («381.367
  km» a la Luna): **130 de las 153 páginas, 283 ocurrencias**. Es la frase que sostiene la promesa de
  la trayectoria, mal escrita. Arreglado **donde el número se convierte en texto** —`_cifra()` en
  `data/pipeline/mareia_pipeline/grade.py`— y no en la plantilla, que sobre una frase ya escrita sólo
  admitiría un reemplazo a ciegas sobre prosa. Las **170 frases** del dataset ya committeado se
  migraron re-derivándolas con el `grade.py` parcheado: las 153 estaciones reprodujeron su frase
  **carácter a carácter salvo el separador**, y el grade y el flag `estimated` de ninguna cambió. El
  gate mira el **HTML publicado de `dist/`**, no la función que lo genera. Y de paso se le tapó un
  agujero al propio ataque: su excepción de millares, escrita `^\d{1,3}\.\d{3}$`, se tragaba
  «0.270» y «0.221» —el RMSE normalizado se publica con tres decimales y tiene la forma de un
  millar—, así que veía el umbral y no la medida; ahora el primer dígito no puede ser cero, porque
  nadie escribe un millar empezando por cero. `dist/` completo: **0 ofensas**.
- **A-20 · la procedencia del error medido sigue siendo autodeclarada.** Se queda **abierto y con su
  trinquete puesto**, a propósito: su arreglo —contrastar las coordenadas del mareógrafo declarado
  contra lo que el propio dataset dice de él en otro fichero— es de integridad de procedencia y va a
  revisión del rol `seguridad` en una trayectoria aparte. Hoy los 32 códigos de mareógrafo del
  dataset son consistentes entre sí y **no hay ningún puerto real afectado**: lo que se documenta es
  que el gate no puede ver el fraude que existe para impedir.

Y lo que el `verificador` rechazó de todo lo anterior, arreglado aquí mismo:

- **El trinquete de A-17 no trinqueteaba: medía con una copia del detector.** El recorrido que se
  quedaba «como gate permanente» para que nadie volviera a estrechar el detector de curva congelada
  medía con una **copia local** del instrumento (`adversario-t13.test.ts`), y los dos ficheros no se
  importaban entre sí: la copia no se enteraba de lo que le pasara al original. Restaurado el
  defecto exacto de A-17 en el detector real, la suite se quedaba en **17/17 verde** con los 65
  puertos otra vez ciegos. Un trinquete que no trinquetea es peor que no tenerlo, porque promete una
  garantía que no da — y los dos comentarios que afirmaban lo contrario («si allí cambia, este
  fichero se pone en rojo») eran documentación que mentía sobre esa garantía. El detector pasa a
  tener **un único cuerpo**, `apps/web/src/curva-congelada.ts`, que importan los dos ficheros:
  `tramosPlanos`, `tramoPlanoMasLargo`, la excursión real y el nuevo `congelacionesDeLaCurva`, que
  es el detector entero. `loQueVeElGateMm` ya no reproduce lo que el gate haría: **es lo que el gate
  denuncia**. Comprobado que muerde, con el defecto puesto en el módulo compartido: **A-17 en rojo
  con los 65 puertos** (Valencia, Alboraya, Silla y Sueca a la cabeza: 62,06 mm reales suprimidos y
  0,00 mm vistos) mientras **A-1 sigue verde**, que es exactamente el agujero que A-17 existe para
  tapar. Restaurado, los dos ficheros vuelven a verde.
- **Y la excepción de millares de A-19 pasa a ser contextual.** Apretarla a `^[1-9]\d{0,2}\.\d{3}$`
  fue otra vuelta de regex sobre la **forma**, y por la forma un millar y una medida son el mismo
  string: medido en el `dist/` del 2026-08-29, el sitio publica **352 cifras españolas** que la
  excepción por forma habría exonerado si volvieran al formato inglés — **279 coordenadas**
  («36,745° N»), **72 alturas en metros** («nivel medio 1,945 m») y el **RMSE normalizado de
  Tarragona, 2,902**, que es justo la cifra sobre la que descansa la promesa de la trayectoria.
  Millares de verdad hay uno: la distancia a la Luna, que sólo escribe `kilometros()` de
  `formato.ts`, **153 ocurrencias, todas «Distancia N km»**. Así que la excepción se ata al **sitio**
  y no a la forma. Comprobado que muerde, devolviendo `2.902` al HTML publicado de Tarragona: con la
  excepción contextual, **A-19 en rojo** (`mareas/cataluna/tarragona/tarragona/index.html: «2.902»`);
  con la de forma, **verde con el defecto delante**. Y el recorrido nuevo `A-19 sensibilidad` deja
  eso como gate: coge cada cifra española publicada con forma de millar, le devuelve el punto y
  exige que el detector la denuncie — con la excepción por forma salen **352** sin denunciar,
  que son las mismas 352 de arriba: la cifra que este renglón publicaba antes (301) no la reproduce
  ninguna de las dos mutaciones de la excepción, y la midió el `verificador` en su segundo rechazo.

Y un tope que ya no medía nada, que llegó al mergear `main` (T-12):

- **El presupuesto agregado de las constantes se retira; el de por puerto se queda.**
  `pwa-construido.test.ts` afirmaba `total <= 12 * TOPES.estacionBytes` bajo el nombre «y los doce
  juntos siguen siendo poco»; con 153 puertos y **449 370 B** medidos se puso en rojo. Cambiar el 12
  por 153 sería una constante persiguiendo al dato, y **derivarlo del catálogo lo deja imposible de
  fallar**: la suma de N medidas que el mismo bucle ya ha comprobado una a una contra el tope nunca
  puede pasar de N veces el tope. Un gate que no puede fallar es peor que no tenerlo, porque cuenta
  como cobertura. Lo que aquella aserción quería decir —«el catálogo entero pesa menos que una foto»—
  lo dice ya el tope **por puerto**, que es el único que no depende de cuántos puertos haya hoy y el
  que describe lo que de verdad se baja al marcar un favorito: nadie se descarga el catálogo. El test
  pasa a llamarse «las constantes de cada puerto caben en su presupuesto» y el total medido se
  imprime como diagnóstico para que la cifra no desaparezca del run.

**Fuera de alcance, anotado**: el informe QC de `data/pipeline/reports/` sigue escribiendo sus
números con punto (lo genera `report.py`, es un documento interno y no se publica en ninguna página);
y los dos residuos que el adversario midió sin poder poner en rojo —el 1,1 % de aire del umbral de
1 mm y el 4,8 % de la cota del sesgo de Brest— no se tocan aquí.

## 2026-08-29 — T-13 · España completa, y el 78 % del catálogo diciendo que no está medido

- **El portal pasa de 12 puertos a 153**, de Viveiro a El Hierro y de Menorca a La Palma, y con
  ellos el sitio de **33 a 192 páginas HTML** (191 `index.html` más el 404) sin tocar
  `getStaticPaths`: la web se generó sola desde `data/geo/ports.json`, que es lo que T-09 prometió
  que pasaría. Medido: **build de 11,9 s** (13 s de reloj) y **`dist/` de 4 613 414 B (4,40 MiB)**,
  frente a los 1,8 s y 417 794 B (0,40 MiB) de `main`. Casi seis veces más páginas por once veces
  más peso, porque lo que se multiplica son las páginas de puerto (~26 KB) y no los índices (~4 KB).
  El pipeline entero tarda **4,3 min desde cero** (258 s, con las descargas) y **24 s** con la caché
  caliente.
- **Y 120 de esos 153 puertos dicen en su página que su marea es una estimación.** Es el resultado
  que da sentido a la trayectoria. Un puerto sólo se publica como medido si se dan las dos cosas a
  la vez: mareógrafo en su propia dársena (el mismo umbral de 5 km que exige el grade A) y
  observaciones **suyas** con las que contrastar la predicción. El reparto medido: **8 grade A · 15
  grade B · 130 grade C**, 35 puertos con error medido y 120 marcados `quality.estimated`. Un
  catálogo que hubiera publicado 153 páginas con la misma pinta de exactitud que las 12 de T-05
  habría sido exactamente el fraude que este proyecto existe para no cometer.
- **Se retiró el atajo que lo hacía posible.** Hasta ahora, un puerto sin mareógrafo del IOC en la
  dársena se validaba contra la observación del mareógrafo que le presta las constantes, y ese RMSE
  se publicaba como suyo: Cabo de Palos enseñaba el error medido en Cartagena, a 24,8 km. Con doce
  puertos era una nota al pie; con ciento cincuenta es la mentira de fondo. Ahora, sin observación
  propia, `rmse_m` y `hw_time_err_p95_min` salen `null` y el puerto explica por qué en
  `quality.estimated_reason` —una frase distinta según herede las constantes de lejos, le falte la
  observación, o las dos—, que la página imprime literalmente en un aviso sobre la tabla y en la
  nota de calidad («¿Está medida aquí esta marea?»). El aviso de «estación sin observación» de T-09
  desaparece absorbido por este, del que era un subconjunto.
- **El catálogo ya no se escribe a mano, y esa es la decisión gorda.** Doce coordenadas se teclean;
  doscientas de memoria serían doscientos números que nadie ha medido. Los puertos derivados salen
  del volcado público de **GeoNames** (CC-BY 4.0, un fichero de 3,3 MB): la coordenada es la de una
  instalación portuaria real, el nombre es el del municipio oficial —con sus acentos— y la jerarquía
  región/provincia sigue siendo editorial, en una tabla de 24 provincias dentro del pipeline, porque
  las etiquetas de la fuente vienen en inglés y mezcladas. **Tercera licencia en el dataset**, y
  como las otras dos viaja dentro de cada JSON al que obliga, no en un README. Se evaluó y descartó
  Overpass/OSM: la política de egreso del entorno corta toda consulta que tarde más de unos
  segundos.
- **Qué se descartó, con nombre y motivo**: 185 candidatos. 121 segundas dársenas del mismo
  municipio (que son el mismo puerto a efectos de marea), 24 instalaciones tierra adentro por encima
  de 20 m de altitud, 17 que ya eran del piloto con otro nombre, 4 dentro de la laguna del Mar Menor
  —casi cerrada: allí el nivel lo manda el viento— y **19 sin mareógrafo a menos de 60 km**, el
  doble del umbral de grade B. Esos 19 son toda la Costa Brava y el norte de Castellón, y se listan
  uno a uno en el informe QC para que el hueco del portal sea un dato y no un olvido.
- **La horquilla del plan (200-300 puertos) no se alcanza: son 153, y el techo lo pone la fuente.**
  GeoNames documenta pocas instalaciones portuarias en la cornisa cantábrica —Asturias sale con 2
  puertos, Cantabria con 3, Lugo con 2, Gipuzkoa con 2, cuando tienen decenas—. Subir de ahí pide
  una segunda fuente de topónimos portuarios; relajar el filtro sólo produciría puertos llamados
  «Barrio de la Concepción» y clubes náuticos de embalse.
- **El dataset se regenera con los 42 constituyentes**, la deuda que T-04 dejó anotada y que llevaba
  desde entonces truncando el dataset a 37. La predicción del QC de T-05 —«esto es lo que impide
  llegar a grade A a Vigo, Santander y Brest»— **se cumplió a medias, y comprobarlo destapó un fallo
  del propio informe**. El coste del truncado bajó del umbral de A en los tres, como estaba
  previsto: Vigo 1,30 → 0,69 cm RMS, Santander 1,06 → 0,50, Brest 2,23 → 0,47. Pero sólo **Santander
  y Brest** subieron a A: **Vigo sigue en B** porque incumple otro umbral, el error de hora de
  pleamar (26,8 min sobre 20)… que **ya incumplía en T-05 con 25,4 min**. El motivo del grade se
  paraba en el primer umbral que fallaba y nunca llegó a nombrarlo, así que el informe invitó a
  predecir que quitando ese bastaba. Arreglado: `grade.assign` enumera ahora **todos** los umbrales
  incumplidos.
- **El golden del coeficiente se puso en rojo, como T-04 avisó, y lo que cambia es el instrumento,
  no el umbral.** Los cinco constituyentes nuevos mueven el coeficiente de Brest y el error máximo
  contra los 32 valores publicados por el SHOM pasaba de 2 a 3. La primera versión de este cambio
  ensanchó la tolerancia a ±3 con un argumento que no se sostenía —«quitar la modulación radiacional
  no lo arregla», que es falso para esa aserción—, así que se ha revertido: **`toleranceUnits` sigue
  en 2, sin tocar**. Lo que se corrige es el cálculo: `MA2` y `MB2` son la modulación
  **radiacional** de M2 —las mueve el calentamiento solar, no la gravedad, y por eso este
  repositorio ya las definía sin corrección nodal lunar— y la escala del SHOM describe la marea
  astronómica, así que salen del coeficiente (no del dataset, que las sigue publicando). Con ellas
  fuera: sesgo +1,19, máximo 2, los 32 valores dentro de ±2. Lo único que se ensancha es la cota del
  **sesgo agregado**, de 1 a 1,25, que es una aserción secundaria y mide un desacuerdo que ya
  existía (+0,91 con el dataset truncado): 3,6 cm de semirrango sobre 6,6 m de marea, es decir, dos
  análisis armónicos distintos del mismo puerto. Sacar además `EP2` habría dejado el sesgo en 0,84
  sin tocar nada, y **no se ha hecho**: `EP2` es marea astronómica pura y elegir constituyentes por
  lo bien que le sientan al golden es el mismo pecado con otro traje. La tabla completa está en
  `fixtures/README.md`.
- **Y se corrige el pilar con el que se había justificado todo eso.** Aquel README decía que «contra
  las observaciones del IOC, Brest pasó de 2,23 a 0,47 cm RMS de coste de truncado». El coste de
  truncado **no se mide contra el IOC**: es `predict(todas) − predict(las emitidas)`, el modelo
  contra sí mismo, y baja por definición al dejar de descartar constituyentes. Lo que sí mira al mar
  se mueve poco y en las dos direcciones: RMSE 0,0794 → 0,0806 m y R² 0,99731 → 0,99728 (peor),
  error de hora p95 14,53 → 13,31 min (mejor). Y el salto de Brest a grade A es **mecánico**: el
  truncado era su único umbral incumplido.
- **La política de selección de mareógrafo tenía un fallo que sólo la escala destapó.** Al ensanchar
  el radio de búsqueda a 60 km, Gandía se llevó las constantes del mareógrafo de Valencia —mejor
  licencia y registro más largo, a 53,8 km— teniendo uno en su propia bocana. La licencia y los años
  de registro deciden ahora **dentro del mismo sitio** (5 km del más cercano) y nunca entre sitios
  distintos. Con su test, que reproduce el caso.
- **El informe QC se vuelve navegable**: resumen con el reparto de grades, cobertura por región, los
  15 peores medidos, la tabla de descartes con su motivo, y el detalle por región separado en dos
  tablas —**medidos** y **estimados**— porque son dos poblaciones distintas y mezclarlas es lo que
  hace que un número prestado parezca propio.
- **Los invariantes muerden a escala, y el arreglo tiene trinquete.** Retirar el atajo de T-05 en el
  dato no bastaba: se pudo volver a inyectar a mano en un JSON el RMSE de un mareógrafo a 46 km y
  toda la suite siguió verde, porque lo único que cazaba el caso era una aserción clavada a Cabo de
  Palos. Ahora el dataset **publica la procedencia del número** —con qué mareógrafo del IOC se
  midió, a qué distancia de la dársena y **desde qué coordenadas**— y hay un invariante, en Python y
  en TypeScript con aritmética propia, que **recomputa** esa distancia por haversine y exige que sea
  menor de 5 km. Reproducida la inyección en sus cuatro formas —sólo el RMSE; con la fuente; con la
  fuente y la distancia real; y con la distancia forjada a 0,9 km, que era la que quedaba abierta
  porque la procedencia de la observación se autodeclaraba— las cuatro salen en rojo, y la última
  nombra los 46,418 km que hay de verdad. Se añaden además las cuatro ramas de `grade.estimate()` y
  un test que fija que la observación se busca **una sola vez y en el puerto**, que es donde vive el
  arreglo. `python run.py check` repite la coherencia catálogo↔dataset sin red; el golden de Vigo
  sigue siendo golden.
- **El gate adversario A-1 se re-apunta sin ningún número elegido, y a la tercera mirando donde hay
  que mirar.** El primer intento cambió una constante por otras dos igual de arbitrarias, y las dos
  estaban mal. El segundo acertó el diseño —medir movimiento y no duración, con el paso de
  publicación (1 mm) como umbral— pero puso la sonda en las **puntas** de la meseta, que es
  exactamente la magnitud que la avería original anula: una meseta centrada en un extremo tiene los
  dos bordes a la misma altura pase lo que pase en medio, y la avería de A-1 era literalmente «una
  pleamar de cinco horas». Medido congelando la curva a propósito, aquel instrumento dejaba pasar en
  verde mesetas de **670 min en Gijón** (0,49 mm en los bordes, 3 283,7 mm de movimiento real
  dentro) y las admitía en **133 de los 153 puertos**: para el caso que da nombre al hallazgo era
  más débil que la regla de una hora que sustituía. Ahora la sonda mira **los instantes de muestreo
  publicados que caen dentro del tramo**, que son los que la página podría haber dibujado distintos
  y no dibujó; no se mira la curva continua a propósito, porque entre dos muestras la marea puede
  abombarse sobre un extremo hasta 2,4 mm y eso no es representable en el artefacto. Medido sobre
  153 puertos × 15 días (**9 941 mesetas**): la excursión máxima de una meseta legítima es **0,995
  mm**. Y congelando la pleamar de los 153 puertos, el gate las caza **153 de 153**, con un test de
  sensibilidad permanente que reconstruye esa avería sobre Vigo para que nadie vuelva a apuntar la
  sonda a los bordes sin enterarse.
- **El motivo del grade nombra todos los umbrales, también los que faltaban.** El primer arreglo
  dejaba fuera las ramas de «sin observaciones» y 39 puertos publicaban un motivo que sólo culpaba a
  la distancia al mareógrafo; ahora hay una sola función que evalúa y enumera, y quedan 1, que es el
  único al que de verdad le sobra un solo obstáculo (San Sebastián de la Gomera).
- **Y CI empieza a lintear Python.** T-13 añadió ~1.200 líneas de Python mientras el TypeScript
  pasaba por dos linters y el pipeline por ninguno. Se instala `ruff` pinneado con su `ruff.toml`
  (`make lint`, y un paso en el job de datos). El primer pase encontró una variable muerta en
  `validate.py` y dos `int()` redundantes.
- **Lo que se queda abierto**: las zonas marítimas de AEMET siguen mapeadas sólo para los 12 puertos
  del piloto (el módulo degrada solo y ahora hay un test que cuenta la cobertura en vez de
  callarla); la portada sigue enseñando los 153 puertos de golpe —35,6 KB de HTML, más que una
  página de puerto— y sustituirla por el índice de regiones es una decisión de producto, no una
  consecuencia de este cambio.

## 2026-08-29 — T-18 · la credencial de AEMET deja de contar cómo se administra la instancia

- **El aviso del operador sale del canal público.** `GET /v1/modules/weather/bulletin` publicaba,
  dentro del estado de la credencial, la frase escrita para quien administra la instancia: qué
  variable de entorno usa, en qué URL de AEMET se pide una clave nueva y que hay que «actualizar el
  secreto». No hay material de clave ahí y la web no lo pintaba, así que no fue incidente; pero es
  reconocimiento gratis y, sobre todo, es el canal equivocado — quien puede renovar la clave no se
  entera por el JSON público. Es **fix forward** de T-08, no un rollback: el estado sigue viajando
  (`status`, `expiresAt`, `daysLeft`, `source`, `thresholdDays`), porque quien consume el API
  necesita poder decir *por qué* dejó de haber boletín. Lo que se recorta es la instrucción.
- **Dos canales, dos textos.** `publicCredentialView()` proyecta el estado a lo que sale por HTTP y
  sustituye el mensaje por una frase neutra **derivada del `status` y sin interpolar números** —los
  números ya viajan en sus campos—, aplicada en las dos ramas del boletín y en el `detail` del
  healthcheck. El mensaje completo se queda intacto donde sirve de algo: el workflow
  `aemet-key.yml`, que es el único sitio desde el que alguien puede ir a renovar la clave.
- **El gate mira la respuesta entera, no el campo.** Un test sobre `credential.message` habría
  arreglado este bug dejando pasar el siguiente, porque el defecto **se mueve** de campo. El
  recorrido nuevo serializa los cuatro cuerpos públicos del módulo (`/weather`, `/bulletin` con zona
  y sin zona, y el healthcheck) en los **cinco** estados de la credencial y exige que en ninguno
  aparezca ninguna de las cinco señas del canal del operador: 100 comprobaciones. Busca **señas**
  —el nombre de la variable, el dominio de alta, los verbos de instrucción— y no la frase literal,
  para que reescribir el aviso no desactive el gate. Comprobado mordiendo, seña a seña: revertir el
  recorte del `credential` lo pone rojo en los cinco estados; revertir **solo** el del healthcheck
  lo pone rojo en cuatro; y con el `credential` ya recortado, devolver el nombre del secreto al
  `reason` lo pone rojo igual — que es exactamente el bug moviéndose de campo.
- **Y el `reason` del boletín tampoco nombra el secreto.** Ahí estaba la segunda copia de la fuga:
  sin clave, el motivo decía «falta la variable de entorno AEMET_API_KEY». Ese texto viaja al
  cliente por diseño (`errors.ts`), así que ahora dice el hecho —«no hay credencial con la que pedir
  el boletín»— y deja el nombre del secreto para el canal del operador.
- **Y el gate obliga a decir algo, no solo prohíbe decir de más.** Una prohibición se satisface
  callando: con solo el recorrido de arriba, `message: ""` en los cinco estados habría pasado verde,
  y también una única frase repetida para los cinco. Eso no sería recortar el canal, sería apagarlo,
  y quien consume el API dejaría de poder decir *por qué* no hay boletín — justo lo que este fix
  forward prometió conservar. Así que un segundo recorrido exige que cada estado tenga su frase: no
  vacía, distinta de las otras cuatro y nombrando de qué credencial habla. No congela la prosa
  (reescribirla no lo rompe); vaciarla o colapsarla en una sola frase, sí. Comprobado mordiendo con
  las dos mutaciones: vaciar las cinco frases lo pone rojo («no dice nada»), y darles a las cinco la
  misma frase lo pone rojo nombrando el par que colisiona.
- **Trinquete al revés**: un test exige que `inspectAemetKey` **siga** produciendo el aviso
  completo, con su URL de alta y su instrucción, para que «arreglar» esto nunca consista en vaciar
  el único aviso que impide que la clave caduque por sorpresa.
- Los tres fixtures de boletín de la web se **re-proyectaron con la función real**, no a mano: son
  capturas de lo que sirve el módulo y tenían congelada la frase vieja (una de ellas, la del
  «Renuévala», es la que el recorrido Playwright sirve como respuesta del API).
- **Pase adversario (rol `qa-adversario`): 4 hallazgos reproducidos en rojo, abiertos con
  trinquete.** El gate de arriba prohíbe decir de más; el pase preguntó si lo que sí se dice es
  verdad. (a) La frase «neutra» no es neutra: afirma «no publica el boletín oficial», y la misma
  respuesta publica el boletín en cuanto la caché sirve con el secreto ya borrado o caducado. (b) La
  **tercera copia** de la fuga la escribe AEMET: su `descripcion` en un 401 viaja literal al `reason`
  público y de ahí **a la pantalla**, sin pasar por el criterio que se aplicó a las dos copias
  propias. (c) Un `exp` finito fuera del rango de `Date` lanza `RangeError` dentro de
  `inspectAemetKey`: `/bulletin` devuelve **500** y el healthcheck revienta, que es la promesa
  incumplida por el lado contrario — no se filtra nada porque no se publica nada. (d) `daysLeft`
  cuenta un día entero de más desde el primer milisegundo y no cuadra con el `expiresAt` que viaja a
  su lado (ya visible en un fixture commiteado: `-40` con 39 días transcurridos).
  Informe: `docs/qa/informe-adversario-t18.md`; bundle: `docs/qa/bundles/t18-adversario/FAILURE.md`.
- **Pase adversario cerrado: los 4 hallazgos arreglados y sus 7 ataques como gate permanente.** El
  envoltorio `hallazgoAbierto()` hizo su trabajo —los cinco cuerpos del módulo gritaron «YA NO
  FALLA» a la vez— y se retiró; los cuerpos se quedan tal cual, midiendo lo mismo que medían cuando
  reproducían el fallo, sólo que ahora tienen que pasar.
  - **(a) La frase pública dice el estado de la credencial y sólo eso.** Se le quita la
    consecuencia: `missing` y `expired` ya no afirman «no publica el boletín oficial», porque la
    caducidad se lee **en local** del `exp` y la caché sigue sirviendo durante 4×TTL — el cuerpo se
    desmentía a sí mismo. Quién publica y quién no ya lo dicen el `status` y la presencia del
    `document`; hacer que la frase dependa de si hay caché la acoplaría al estado de otra cosa.
  - **(b) El filtro de la tercera copia va en el borde, no en el adaptador.** `reasonFrom()`
    —el borde por el que se llena el `reason` público— recorta las cinco señas del canal del
    operador, las haya escrito quien las haya escrito. Es lista negra y se dice en el propio
    comentario: conserva el diagnóstico del upstream a cambio de no prometer nada sobre prosa ajena
    que no lleve esas señas. Ahora el gate ataca con un `descripcion` de AEMET que **sí** muerde —el
    de T-18 estaba elegido para no morder— y el recorrido de la web compone su `reason` llamando al
    borde real en vez de copiar el resultado a mano, así que quitar el filtro se ve en la pantalla.
  - **(c) Una clave cuyo `exp` no es una fecha es una clave ilegible.** Antes de construir la fecha
    se comprueba que el instante cabe en el rango de `Date`; si no cabe, `unreadable`, que ya es un
    estado del dominio. `/bulletin` vuelve a devolver 200 con su `credential` y su `reason`, y el
    `healthcheck()` deja de lanzar. El gate cubre los tres `exp` que reventaban, incluido **el borde
    exacto medido** (`8 640 000 000 000` pasa, `+1` reventaba), y afirma que el último que sí es una
    fecha se sigue leyendo como tal.
  - **(d) El redondeo se arregla donde se calcula.** `daysBetween()` trunca hacia cero en vez de
    hacia abajo, así que los dos canales —el `daysLeft` público y el «caducó hace N día(s)» del
    operador— dejan de contar un día que no ha pasado. Y el **estado** deja de decidirse con ese
    número: una clave muerta hace un minuto vale `daysLeft: 0` y `0 < 0` la habría dado por viva, de
    modo que `expired` se pregunta comparando instantes. Los fixtures de boletín de la web se
    re-proyectaron **con la función arreglada** (`-40` → `-39`), y un gate nuevo compara su bloque
    `credential` con `publicCredentialView(inspectAemetKey(...))`: editar ese JSON a mano se pone
    rojo.
- **R-1 cerrado: el canal del operador ya tiene quien lo mire.** El «trinquete al revés» de T-18
  vigilaba `inspectAemetKey`, pero lo que el humano lee dentro del issue de GitHub es la salida de
  `scripts/check-aemet-key.ts`, y ese script **no lo alcanzaba ningún job** (`pnpm test` no lo ve
  porque es Deno; el `deno task test` de la API corre sólo sobre `apps/api/src/`). Siete recorridos
  nuevos **ejecutan el script** como subproceso —no importan su lógica: probar la función y no el
  artefacto es el fallo que esto cierra— y afirman sobre su stdout, su stderr y su código de salida,
  estado por estado. Comprobado mordiendo con **la mutación exacta que midió el adversario** (dos
  líneas: imprimir la frase pública en vez del mensaje del operador y quitar los tres pasos del
  stderr): antes dejaba la suite en 499/0 y el issue mudo; ahora pone dos recorridos en rojo
  citando el texto que habría llegado al issue. Uno de los siete es el trinquete del trinquete: que
  la línea de comando que se ejecuta aquí siga siendo la que ejecuta `aemet-key.yml`.
  El job `api` de CI corre `deno task check` + `deno task test` desde `scripts/`, con su propio
  `scripts/deno.json` — **no en la raíz** a propósito: medido que un `deno.json` en la raíz hace que
  Deno tome el `package.json` de pnpm por miembro de workspace y reescriba `apps/api/deno.lock`.
- **Y el punto ciego que dejó la verificación, cerrado con gate y sin hallazgo**: el recorrido nunca
  ejercitaba la URL por defecto (todos los escenarios inyectan `urls.aemet`, y `AEMET_BASE_URL` lleva
  la seña `opendata.aemet.es`). Atacado con la forma de error **medida** del runtime de producción
  —Deno 2.9.6: `fetch failed` con la URL en la `cause`, no en el `message`— más el timeout, la
  segunda llamada sin envolver y el sobre que apunta a otro origen: cero señas. Quedan cuatro gates
  nuevos vigilando, uno de ellos para que nadie vuelva a inyectar `urls.aemet` y lo apague en
  silencio.
- **Rechazo del verificador (1/2): la lista negra fallaba contra sus propias señas.** El comentario
  de `reasonFrom` prometía recortar las cinco «las haya escrito quien las haya escrito» y el filtro
  casaba sobre texto **crudo**. Medido por el camino real (`aemet.ts` → `WeatherSourceError` →
  `reasonFrom`), cuatro variantes de las propias señas salían **enteras** por el `reason` público:
  «Renuévala» en `NFD` (`e` + U+0301 — la misma palabra en pantalla, otra cadena para `includes`),
  `AEMET-API-KEY` con guion, `AEMET<U+200B>_API_KEY` con un carácter de ancho cero dentro y
  `opendata. aemet.es` partido por un salto de línea. Agravante: el gate escribía las señas a mano y
  **sólo en `NFC`**, así que vigilaba una forma de cinco y no se habría puesto rojo nunca. Ahora el
  texto se **sanea antes de casar y se publica saneado** —fuera los invisibles, `NFC`, espacio
  aplastado; casar sobre una forma y publicar otra dejaría el recorte aplicado a un texto distinto
  del que sale por el cable— y el patrón tolera `-`, `_`, espacio o nada como separador de
  `AEMET_API_KEY` y el espacio alrededor de los puntos del dominio. Las cinco variantes son casos
  del gate, y el de la respuesta entera vigila cada seña en **las dos formas Unicode**. Comprobado
  mordiendo, mutación a mutación: sin el saneado salen el `NFD` y el ancho cero; sin la tolerancia
  del separador sale `AEMET-API-KEY`; sin la del dominio sale `opendata. aemet.es`; y una frase
  pública con «Renuévala» en `NFD` deja el gate viejo en **7/0 verde** y el nuevo en rojo.
- **Y lo que la lista negra NO cubre, contado en vez de callado.** No casa **codificaciones**:
  `opendata&#46;aemet&#46;es` (entidades HTML) sale entero, igual que la prosa ajena sin señas («Su
  clave ha expirado. Solicite una nueva y configúrela en el servidor»). Es decisión y no olvido —
  descodificar es publicar un texto que el upstream no escribió, y el espacio de escapes no tiene
  fondo (`&#x2E;`, `&period;`, doble codificación, porcentaje): perseguirlo dejaría la misma lista
  negra con la promesa más grande y ninguna garantía nueva. El límite tiene **recorrido propio**
  (`LÍMITE ·`) que se pone rojo si alguien amplía el filtro sin ampliar la frase —comprobado
  mordiendo: descodificando `&#46;` en el saneado, rojo— porque lo que no puede pasar es que el
  comentario y este changelog prometan una cosa y el código haga otra.
- **Rechazo del verificador (2/2): «la única puerta» era falso, y ahora es verdad.** Había **dos**
  sitios llenando el `reason` público y sólo uno pasaba por `reasonFrom`: la rama sin zona marítima
  de `module.ts` lo componía a mano. No era una fuga —esa frase la escribimos nosotros y está
  limpia—, era una **afirmación por costumbre**, la misma clase de frase que A-18 desmontó. Se
  enruta esa rama por el borde, con lo que la frase pasa a ser cierta, y un gate lo mide **por
  HTTP** (comprobado mordiendo: al volver a componer el `reason` a mano, rojo citando el cuerpo).
  El comentario de `errors.ts` dice ahora **dos, con nombre y contados**, y añade que un tercer
  camino no lo garantiza la función sino que quien lo escriba la llame — por eso los recorridos
  atacan por HTTP y no llamando a `reasonFrom`.
- **Cifra descuadrada, corregida (doctrina T-161).** Donde se decía «los 4 hallazgos y sus **8**
  ataques» eran **7**: cinco recorridos sobre el cuerpo HTTP y dos sobre la pantalla. El 8 contaba
  los `gatePermanente(` de un solo fichero —tres de ellos del punto ciego, que nunca fueron
  hallazgo— y dejaba fuera los dos de la web. Contado hoy sobre los dos ficheros del pase: **7 con
  letra de hallazgo + 7 sin ella** (6 `GATE ·` y 1 `LÍMITE ·`) = 14 recorridos.
- **`scripts/deno.json`**: la tarea `test` llevaba `--allow-read ..`, y ese `..` no era el valor del
  permiso sino un **path posicional** — o sea, «descubre tests desde la raíz del repo». Hoy no
  encuentra ninguno más porque el resto son de Node, pero el día que Deno cambie cómo acota el
  descubrimiento esa tarea intentaría correr los ~500 recorridos de Node bajo Deno. Ahora el permiso
  va explícito y acotado (`--allow-read=.,../.github`: este directorio y el workflow que se lee) y
  el path de descubrimiento es `.`. Sigue en 7/0.
- **Las tres funciones «que no las usa la sección» viven donde dice su intención.**
  `inspectAemetKey`, `publicCredentialView` y `reasonFrom` se exportaban desde `ui.ts` con un
  comentario explicando que no eran para la sección sino para los gates de la web (no pueden salir
  por `index.ts`, que arrastra Express). Un comentario no impide que mañana alguien las use: se van
  a un subpath propio, `@mareia/module-weather/testing`, y `ui.ts` vuelve a ser sólo lo que la
  página pinta.


## 2026-08-29 — T-12 · el almanaque funciona sin cobertura, y lo dice

- **Un puerto guardado se abre y *calcula* sin red.** Es la diferencia entre una PWA y un caché de
  páginas: la copia guardada trae el día que se guardó, pero pedir el **14 de marzo de 2027** en una
  playa sin cobertura devuelve su tabla, calculada ahí mismo con las constantes armónicas del puerto
  y **el mismo motor de `@mareia/domain-core` que usa el API** — incluido el mismo redondeo, que
  ahora se importa de `@mareia/usecases/dto` en vez de reescribirse. Un test lo comprueba en los
  **doce puertos** contra `getTides`, evento a evento, y otro lo comprueba en la noche en que la
  hora cambia y el día civil dura 23 h.
- **La prueba de la promesa muerde sobre el fichero publicado**, y no solo sobre el motor: el bucle
  de los doce puertos lee `dist/offline/estaciones/<slug>.json` —el fichero que de verdad se baja al
  teléfono— y lo compara evento a evento con `getTides`, ventana del día civil incluida. Sin eso, un
  endpoint que publicara constantes de menos dejaba toda la suite en verde mientras la tabla del
  navegador se separaba centímetros y minutos de la del servidor: horas plausibles y equivocadas.
- **Un favorito guarda constantes, no un almanaque.** Medido: **2 535–2 640 B** por puerto (los doce
  del catálogo, **30,9 kB** en total) frente a los **49 162 B** que ocuparía el almanaque
  precalculado de **un solo año** de un puerto — **18,6×** más, y caducando en Nochevieja. Con las
  constantes se calcula cualquier día de la ventana (año del build ±1, **la misma que sirve el
  API**), y fuera de ella la página **dice por qué no puede** en vez de dar una hora que no sostiene.
- **Guardar es un acto explícito y la página dice lo que ocupa.** No se precachea nada al instalar el
  worker ni al navegar: solo lo que se pide con el botón. El sello enseña la medida con su unidad
  completa —«Ocupa 2,6 kB de constantes armónicas»— en **kB de mil**, nunca en KiB ni en un «KB» que
  cada cual interprete.
- **«Sin red» y «el dato no existe» son dos ausencias distintas, y ahora también en la meteo.** Es la
  lección de A-11 (T-09) y H-6 (T-11) llevada al caso offline. Sin cobertura, el estado del mar se
  sirve de la copia que guardó el service worker **con la edad real en la cara**: el worker sella
  cada respuesta con la hora a la que la guardó (`x-mareia-guardado-en`) y la sección suma esa espera
  a la edad que declaró el backend, así que una copia de hace tres horas se lee «Dato de hace 3 h ·
  Sin conexión: esto es la última copia que se guardó en este dispositivo». Y **no se confunde** con
  el `stale` del backend («la fuente no responde»), que es otra avería. Cuando no hay ni copia, la
  frase es la quinta: «Sin conexión… y no hay ninguna copia guardada aquí. El dato existe; lo que
  falta es la red». Es un sello **por fuente**: una copia guardada no le cuelga su edad a la otra. Y
  **falla hacia el silencio**: una copia que llega sin la marca de la hora se lee «de fecha
  desconocida», no «consultado hace menos de un minuto», que era la más confiada de las salidas.
- **La ventana de años la manda la copia guardada, no el build de la página.** Se congelan en
  instantes distintos —el payload el día que se guardó, la página cada madrugada—, así que un
  favorito de diciembre en una página ya de enero hacía que la sección prometiera «cualquier día
  entre 2026 y 2028» mientras la calculadora contestaba «esta copia calcula de 2025 a 2027», con el
  campo de fecha dejando elegir el año que luego rechazaba. La regla vive ahora en un solo sitio y
  el campo, el rótulo y el cálculo salen de ella.
- **Guardar un segundo favorito ya no desarma al primero.** La Cache API no sabe de quién es cada
  fichero, así que el worker lleva su propio registro de qué necesita cada puerto guardado y poda
  conservando la unión. Antes tiraba todo asset que no usara la página que se estaba guardando —una
  premisa que es falsa en cuanto hay dos favoritos de dos builds, que con el rebuild diario de T-15
  es el caso normal—: el primero se quedaba con su página y **cero assets**, abriéndose sin estilos,
  sin la isla meteo y sin el trozo de la calculadora. Hay recorrido nuevo que simula el rebuild y lo
  reproduce en rojo con el comportamiento viejo.
- **Y no podar es una respuesta válida.** Si el registro no se puede leer —no está, o se quedó a
  medias— el worker guarda igual pero **no poda**: no saber qué sobra no es que sobre todo, y
  colapsar las dos cosas en un «no hay favoritos» borraba de golpe todo lo que había bajo `/_astro/`,
  o sea el mismo fallo que el registro vino a arreglar. Va con su recorrido, que corrompe el registro
  a propósito y comprueba sobre la caché —no sobre cómo pinte el navegador, que puede taparlo con su
  propia caché HTTP— que no falta un solo fichero.
- **El esquema de caché sube a v2.** Una caché de la v1 tiene favoritos y no tiene registro, y ese
  estado a medias es indistinguible de uno corrupto. Subiendo el esquema, `activate` la barre entera
  y quien tuviera un puerto guardado lo vuelve a guardar con un clic; el precio se paga una vez y
  solo dentro de este PR, que no está desplegado.
- **Las constantes guardadas se revalidan.** Su URL no lleva hash y el pipeline las corrige —T-13
  acaba de regenerar el dataset entero—, así que el worker las sirve `stale-while-revalidate` y la
  página compara su copia de IndexedDB con la del servidor cuando hay cobertura. Un `cache-first`
  puro habría dejado al teléfono calculando con las viejas bajo el rótulo «las mismas que usa el
  servidor».
- **Y la sección «sin cobertura» tiene sus cinco estados**, con el mismo sello de T-11 —que se muda
  de la meteo al core (`src/sello.ts`) porque ya no es cosa de un módulo—: sin soporte para guardar,
  con red y sin guardar, **sin red y sin guardar** (no se ofrece un botón que iba a fallar), guardado
  con red, y guardado sin red. Los cinco dicen además qué de la página depende de la conexión y qué
  no: las mareas y las efemérides se calcularon en build, el estado del mar no.
- **Política de actualización decidida y escrita** (`docs/adr/ADR-02`): el HTML va **`network-first`**
  —con red nunca se sirve una página vieja, aunque el worker sea el de ayer—, los assets con hash van
  `cache-first` (su URL cambia con su contenido, así que no pueden envejecer), **no** se llama a
  `skipWaiting` y **no** hay banner de «hay versión nueva». Lo que se pierde está en el ADR: el
  arranque instantáneo offline-first, y que una pestaña abierta días conserva el worker viejo.
- **El worker es un `.ts` de verdad**, tipado contra el protocolo y contra el contrato de módulos, y
  el build lo publica en `/sw.js` quitándole los tipos con el propio Node. **El build se cae** si el
  fichero acaba con una sola forma de traer código de fuera: estático, **dinámico**, `require` o
  **`importScripts`** —que es la que más importa, porque es la única de las cuatro que *sí* funciona
  en un worker clásico y por tanto la única capaz de colar código sin auditar sin romper nada—. Y sin
  confundirse con los que aparecen en sus propios comentarios, cadenas o expresiones regulares. **No conoce ni una ruta de meteo**: las políticas
  salen de la `PrecachePolicy` que cada módulo declara en `AppModule` (T-06), así que dar de baja un
  módulo se lleva su política por delante.
- **Instalable**: manifiesto (`minimal-ui`, no `standalone` — quien instala esto sigue queriendo ver
  la URL) e icono SVG dibujado con la curva de marea y el filete doble del almanaque. Sus dos colores
  son la conversión sRGB de los tokens `--m-bg` y `--m-navy`, y hay un test que los recalcula desde
  `tokens.css` para que no se conviertan en una paleta paralela.
- **El cero-JS del core aguanta, re-apuntado por segunda vez y sin relajarse.** La PWA no es de
  ningún módulo, así que en vez de ampliar la excepción a ojo se le da al gate la otra mitad de la
  lista: `src/scripts-de-core.ts`, un registro que declara qué scripts de core existen, por qué no
  pueden ser HTML y en qué páginas se sirven. La cuenta sigue siendo **exacta** página a página, y la
  portada, el 404 y los índices geográficos siguen en **cero** JavaScript.
- **Coste medido en la página de puerto**: el bundle que baja *cualquiera* que abra un puerto sube
  **16 639 B** (5 970 comprimidos) — el motor de mareas, que son **70 372 B**, va en un trozo aparte
  con `import()` dinámico y solo lo baja quien pide otro día o guarda el puerto. Sin ese corte serían
  **83 980 B** para todo el mundo (medido haciendo estático el `import()` y reconstruyendo). El
  `/sw.js` publicado pesa **27 329 B** (8 771 comprimidos), comentarios incluidos: son su
  documentación y su auditoría. Un favorito ocupa en la Cache API **164 547 B** el primero —página
  28 906, hoja de estilos 15 883, isla meteo 13 234, bundle de la PWA 16 639, su trozo común 1 698,
  motor 70 372, constantes 2 537 y el camino desde la portada 15 278— y **entre 36 553 y 38 770 B**
  cada siguiente (su página, sus constantes y los dos índices que no comparte), porque el resto ya
  está. Se publica el rango y no una media: los doce puertos van de bilbao a la-manga y **ninguno**
  vale la cifra única que decía antes esta línea. Todas las
  cifras en bytes y kB de mil, medidas sobre el `dist/` de este commit, y las comprimidas con
  `zlib.gzipSync(datos, { level: 9 })`.
- **El sello mira los dos almacenes, no uno.** Prometía los bytes de la caché del worker
  componiéndose **solo** con IndexedDB, y los dos se separan por caminos nada exóticos: un `addAll`
  que falla porque un fichero con hash ya no está en el servidor, el barrido de un cambio de esquema,
  un desalojo del navegador. La pantalla llegaba a decir «Guardado en este dispositivo… La página se
  guarda con su hoja de estilos» con la caché **vacía**, y quien lo leía se iba a la playa creyendo
  que llevaba el almanaque encima. Hay dos estados nuevos para los dos lados de esa separación —«La
  copia de esta página ya no está en este dispositivo» y «Guardado en este dispositivo, pero sin sus
  constantes»— y el invariante «el sello afirma que hay copia si y solo si la hay» se comprueba en
  las ocho combinaciones sin navegador y en tres recorridos con él.
- **La app instalada abre sin red.** El manifiesto invita a instalar Mareia y quien acepta se queda
  sin barra de direcciones: su única puerta es el `start_url`, que es `/` y **no se guardaba nunca**,
  así que el icono de la pantalla de inicio abría el error de red del navegador con el almanaque
  intacto a un toque. Un favorito guarda ahora **el camino hasta él** —portada, índice de mareas, su
  región y su provincia: **15 278 B** los cuatro, compartidos entre favoritos— y hay un test que lee
  el `start_url` del manifiesto **publicado** y exige que esté entre lo que se guarda.
- **Sin cobertura no se ofrece borrar el almanaque que se está leyendo.** Era la única acción
  destructiva de la sección, pegada al sello que se lee justo para comprobar la copia, sin
  confirmación y sin deshacer — y sin red no se podía rehacer, cosa que la propia página decía dos
  estados más arriba. Ahora se dice y se ofrece cuando hay cobertura, igual que ya pasaba con guardar.
- **La poda exige un censo completo, no solo legible.** El fail-safe anterior no evitaba el borrado:
  lo aplazaba un paso. Con el registro ilegible se escribía un censo de un puerto indistinguible de
  uno completo, y el siguiente «dejar de guardar» lo trataba como la verdad y borraba los ficheros
  del otro favorito. El registro lleva ahora si es completo, y **la página le manda el censo entero**
  desde IndexedDB para repararlo (tercer verbo del protocolo).
- **Y dos cosas que el pase señaló sin poder reproducir, cerradas igual.** El `fetch` de las
  navegaciones va con `cache: "no-store"`: un `fetch` dentro del worker puede contestarse desde la
  caché HTTP del navegador, y entonces el `network-first` de ADR-02 dependería de unas cabeceras que
  el despliegue no fija — si la garantía depende de eso, no existe. Y las operaciones sobre el
  registro se serializan en una cola: la carrera estaba en el código aunque no se supiera disparar.
- **Los gates de antes siguen mordiendo con el worker puesto**: los pases adversarios de T-09, T-10 y
  T-11 quedan en verde sin tocar un solo assert suyo, salvo los dos que contaban scripts, que se
  re-apuntan al registro de scripts de core. `apps/web` pasa de **114 a 193 tests** y los recorridos
  Playwright de **25 a 44**, cortando la red de verdad (`context.setOffline` + enrutado de contexto,
  porque las peticiones del worker no pasan por la página).
- **Pase adversario cerrado**: los 4 hallazgos arreglados y sus 6 recorridos **como gate permanente**,
  cada uno comprobado en rojo revirtiendo su arreglo antes de retirar el trinquete. Ver
  `docs/qa/informe-adversario-t12.md`. Los dos juicios de producto que dejó abiertos —el «segundo
  día» y el orden de lectura del sello cuando la copia es vieja— quedan anotados como trabajo, no
  parcheados al final de la trayectoria.

## 2026-08-29 — T-11 · los 7 hallazgos del pase adversario, arreglados

- **El sello de antigüedad ya no se congela.** Era el hallazgo grave: la isla calculaba la edad al
  pintar y no la volvía a mirar, así que con la pestaña abierta tres horas la página rotulaba
  «Consultado hace menos de un minuto» sobre un dato de hace tres horas, con la hora de consulta al
  lado dándole crédito. El defecto que ADR-01 dice eliminar no estaba eliminado: estaba **movido**
  del momento del build al de abrir la pestaña. Ahora la edad **sigue viva mientras la página lo
  está**: temporizador de 30 s (la edad se escribe al minuto), `visibilitychange` (una pestaña en
  segundo plano tiene los temporizadores estrangulados o congelados) y `pageshow` (en el bfcache la
  página vuelve intacta de ayer al pulsar «atrás»). Medido con el mismo ataque: a las 3 h el bloque
  dice **«Dato de hace 3 h»** donde antes decía «Consultado hace menos de un minuto».
- **Y a partir de cierta antigüedad cambia el estado, no solo el rótulo.** Pasada la ventana de
  frescura de esa fuente, el dato deja de tener cara de fresco. El umbral **no se lo inventa la
  página**: las tres ventanas del módulo (mar 1 h, atmósfera 30 min, boletín 6 h) se exportan ahora
  desde `@mareia/module-weather/ui`, así que cada fuente tiene la suya — a los 45 minutos el mar
  sigue siendo de ahora y la atmósfera ya no. Y las **dos** caducidades se leen distinto, porque son
  dos averías distintas: «la fuente no responde y se sirve lo último guardado» / «se consultó a las
  15:12 y esta página no ha vuelto a preguntar; recarga».
- **Un 200 con el cuerpo cambiado ya no mata la sección.** Un backend a medio desplegar, un proxy que
  contesta su propio JSON o una versión del módulo por delante dejaban la sección en «Pidiendo el
  estado del mar…» con `aria-busy="true"` **indefinidamente** —un quinto estado que no existe en el
  contrato y que además miente—, porque la excepción se perdía en una promesa que nadie esperaba.
  Ahora el cuerpo pasa por un portero antes de llegar a la vista y la sección resuelve a uno de sus
  ausentes en ~300 ms; y si algo imprevisto lanza, se dice, en vez de dejar el aviso de carga colgado.
- **Cada ausencia dice cuál es, también en la capa de red.** El 200 ilegible y el API caído
  publicaban una frase **idéntica carácter por carácter**, aunque en un caso el servidor contestó y
  en el otro el navegador ni pudo preguntar. Son cuatro motivos y ahora cada uno tiene el suyo. Es la
  lección de A-11 en T-09, otra vez.
- **El bloque que ya llegó deja de esperar al que tarda.** Los dos endpoints se pedían por separado
  pero se pintaban juntos: con AEMET contestando a los 5 s, el estado del mar estaba descargado en el
  navegador y la pantalla seguía diciendo «Pidiendo…» (los 8 s enteros si AEMET no contestaba). Ahora
  cada uno se pinta al llegar —el mar está en pantalla **antes de los 3 s** en ese mismo escenario— y
  el bloque que falta dice **qué** está pidiendo, no un «cargando» genérico.
- **El boletín de AEMET ya no maqueta la página.** Un enlace de los que AEMET pone en sus boletines
  (84 caracteres sin un espacio) le imponía el ancho a la sección: **490 px de `scrollWidth` en una
  ventana de 320** (+170) y de 360 (+130), con la página entera desplazándose en horizontal. Con
  `overflow-wrap: anywhere` vuelve a ser el de la ventana. Una sonda propia encontró la misma puerta
  en el motivo del backend cuando trae la URL que falló (+49 px a 320): misma cura.
- **La sección se anuncia a quien no ve la pantalla.** `aria-busy` dice «espera», no anuncia nada, y
  nada en `#meteo` era región viva: quien navega con lector oía «El estado del mar todavía no ha
  llegado» y **nunca** se enteraba de que el dato llegó, de que la fuente cayó ni de que lo que hay
  en pantalla es de hace tres horas. Ahora hay un `role="status"` que dice la situación de cada
  fuente — y que **no** lleva la edad, para no interrumpir cada minuto cantando «hace cuatro minutos».
- **El trinquete de ADR-01 tenía cuatro puertas abiertas y ya no.** `data-ola=1,68m` (valor sin
  comillas), `data_ola=`, `x:ola=` y un comentario HTML llegaban al `dist/` dentro de `#meteo` con el
  gate en verde — y el comentario es justo donde un framework deja su carga de hidratación. El gate
  deja de depender de la FORMA del atributo: lee etiqueta a etiqueta, con el nombre entero que admite
  HTML5, con valor o sin él, y prohíbe los comentarios dentro de la sección. Las cuatro cargas ponen
  ahora el gate en rojo; las tres que ya estaban cerradas siguen cerradas.
- **Los 13 ataques del pase quedan como gate permanente**, sin `test.fail()` y sin que se tocara un
  solo assert: cada uno afirmaba el comportamiento correcto, así que pasaron a verde solos. La suite
  sube a **23 recorridos** (13 adversarios + 10 confirmatorios) y `apps/web` de **71 a 95 tests**.
  Coste del arreglo en el bundle de la isla: de 9,3 KB a **12,8 KB** (de 3,7 a **4,8 comprimidos**),
  medido sobre el bundle construido; el resto del portal sigue en **cero JavaScript**.

## 2026-08-29 — T-11 · la isla meteo, y el primer dato del portal que caduca

- **La sección meteo en la página de puerto**, por el contrato `AppModule`: olas (total, mar de
  viento y mar de fondo) con altura, dirección y periodo, temperatura del agua, viento y rachas,
  presión, visibilidad e índice UV. Las direcciones se publican en rosa de 16 rumbos **y** en grados
  —«de 287° (ONO)»—, y con la preposición delante porque el convenio de Open-Meteo es de
  procedencia: «287°» a secas se descifra, no se lee.
- **El dato entra por isla hidratada, no horneado en build** (`docs/adr/ADR-01`). El HTML que se
  publica **no contiene ni una magnitud meteorológica** —hay un test sobre `dist/` que lo exige— y
  eso no es una omisión: la meteo caduca en 30 min y el sitio se reconstruye una vez al día, así que
  un dato horneado envejecería dentro de la página *sin poder decir cuánto*. Un HTML que dice
  «consultado hace 4 minutos» lo sigue diciendo veinte horas después. Coste medido: **9,3 KB
  (3,7 KB comprimidos)** de JavaScript, solo en las páginas de puerto; el resto del portal —tabla,
  curva, coeficiente, sol y luna, índices— sigue en **cero JavaScript** y se lee entero sin él.
- **Los cuatro estados tienen cara propia y ninguno se parece a otro**: `ok` con la hora de la
  consulta; **caducado con la antigüedad en la cara** («Dato de hace 3 h 10 min», texto visible, no
  un icono ni un *tooltip*) y sin dejar de enseñar el dato viejo, que para eso lo guarda el backend;
  **no disponible con el motivo que da el backend**; y **carga sin datos**, que es literalmente lo
  que sale de `dist/` y lo que se ve con JavaScript desactivado.
- **La antigüedad se mide como intervalo, no como instante**: a los `ageSeconds` que declaró el
  servidor se les suma lo transcurrido desde que llegó la respuesta. Nunca se resta `fetchedAt` del
  reloj del navegador — un móvil desajustado dos horas convertiría un dato fresco en uno rancio, o
  al revés. Con el reloj del cliente atrasado el dato **no rejuvenece**.
- **Un ausente dice cuál es.** En la sección hay cuatro maneras distintas de no tener un número y
  cada una se escribe distinto: la fuente no respondió (motivo del backend), el modelo no publica ese
  valor en esa celda («el modelo no publica la altura de esta ola en esta celda»), el navegador no
  pudo preguntar («al servidor de Mareia», nunca achacado a Open-Meteo) y el dato aún no ha llegado.
  Es la lección de A-11 en T-09, donde un `null` significaba dos cosas y le colgó a Cádiz un cartel
  falso. Y un **0 medido es un cero**: la mar de viento en calma se publica como «0,00 m», no como
  hueco.
- **Cuando lo que falta es la credencial de AEMET, se dice la causa y no el síntoma.** Un «HTTP 401»
  a secas no le dice nada a quien lee la página; la sección compone la frase con el estado
  estructurado de la clave («La credencial de AEMET de esta instancia caducó el 2026-07-20: hasta
  que se renueve no hay boletín oficial») y conserva detrás el motivo técnico del servidor. Las
  instrucciones de renovación **no** salen: son para quien opera la instancia, no para quien mira la
  marea.
- **El boletín de AEMET se cita, no se reescribe**: párrafos literales con su rótulo (Avisos,
  Situación, Predicción), su zona y su hora de emisión. Si el documento no trae ninguno de los campos
  conocidos, la sección lo dice —su esquema sigue sin verificar mientras no haya clave— en lugar de
  enseñar un trozo adivinado; y si AEMET no declara hora de elaboración, se dice **esa** falta y no
  otra. La zona sin verificar contra el catálogo se publica advirtiéndolo.
- **Atribuciones visibles en la propia sección** (Open-Meteo CC-BY 4.0 y AEMET), en HTML estático:
  se ven aunque la petición no salga y aunque no haya JavaScript.
- **Dar de baja el módulo sigue siendo borrar una línea** de `apps/web/src/modules.config.ts`: la
  página vuelve a cero JavaScript y sigue construyendo. Lo vigilan tres tests, incluido uno de
  arquitectura que comprueba que nadie fuera del mapa de renderizadores nombra el componente.
- **Cero red en los tests**: los fixtures son **capturas del módulo real montado en Express** —el
  estado `ok` contra Open-Meteo de verdad, los degradados forzando el mecanismo del backend— y no
  JSON escritos a mano. 8 capturas, documentadas una a una en `fixtures/README.md`, con su única
  excepción declarada (el boletín con documento, que necesita una clave que no tenemos).
- **Recorridos Playwright** contra el sitio construido con el API servido desde esos fixtures: 9
  recorridos, uno por estado más los cruzados (degradación parcial, hueco del modelo, API caído), con
  captura de cada uno para el informe del pase adversario. El propio recorrido **cierra la salida a
  internet** y afirma que los únicos orígenes externos que la página pide son los conocidos: un CDN
  o una analítica nuevos lo ponen en rojo.
- El gate «cero JavaScript de cliente» del pase adversario de T-09 se **re-apunta, no se relaja**:
  ahora exige que todo script servido esté declarado como `renderMode: "island"` en el registry, con
  `src` y sin código en línea. Una isla que se cuele sin declararse sigue rompiéndolo.
- Por dentro: el contrato de respuesta y la identidad del módulo salen de `module.ts` a ficheros
  hoja (`payload.ts`, `meta.ts`, `ui.ts`), para que la UI pueda tipar la respuesta **sin arrastrar
  Express** —el build de la web es Node con Astro y no lo tiene—. `apps/web` pasa de **41 a 71
  tests**; los 62 del módulo weather y los 20 de la API siguen en verde sin tocarlos.
## 2026-08-28 — T-10 · el módulo pesca, el primero con interfaz

- **Los periodos solunares se leen encima de la marea**. La página de puerto sombrea bajo la curva
  de 24 h las ventanas que la teoría solunar asocia a la Luna: 2 h en cada tránsito (mayores) y
  1 h 30 min en su salida y su puesta (menores). En el build de hoy son **4 bandas** en Vigo. Van
  emitidas **antes** del trazo —en SVG no hay `z-index`: pinta después quien viene después—, en el
  acento cálido que ya existía y sin texto dentro del lienzo, para que lo legible del gráfico siga
  siendo la marea. **Cero JavaScript de cliente**: SVG estático, como el resto del core.
- **Las bandas se recortan al día civil.** Un periodo pertenece al día en el que cae su fenómeno,
  así que su ventana puede empezar antes de medianoche o acabar después: la parte que se sale se
  corta en el borde del lienzo y la que no toca el día no se dibuja. La franja completa sí se
  escribe entera en la tabla, con la coletilla («de 23:30 del día anterior a 01:00»): recortar el
  dibujo es geometría, recortar el texto sería mentir.
- **Sección «Actividad solunar» con el rating 0-100, su etiqueta y el desglose de por qué.** Qué
  suma la fase lunar, qué suman las coincidencias con el orto y el ocaso del Sol, cuánto da la suma
  **sin redondear** y qué número se publica («100,0 → 100 · Muy alta»). Enseñar solo el entero
  obligaría a creerse la suma.
- **El rating se publica como lo que es: una convención, no una medida**, con esas palabras, y la
  sección declara que **la teoría solunar no tiene respaldo experimental sólido** con enlace a la
  metodología (el README del módulo `solunar/`, que es código público: el portal no tiene página de
  metodología y prometer una que no existe fue el hallazgo A-3 del pase adversario de T-09). No se
  promete pesca en ningún texto: se publica un cálculo reproducible. **Un test comprueba que el
  aviso está en las 12 páginas**, así que borrarlo pone el CI en rojo.
- **La cifra del rating es un peldaño más pequeña que la del coeficiente de marea y no lleva la
  mancha de terracota.** El coeficiente se calcula sobre la marea real y esto es una convención: la
  jerarquía tipográfica dice cuál manda sin tener que escribirlo.
- **Golden contra el dominio, no contra el HTML**: las horas de las bandas y de la tabla se comparan
  con las que publica el caso de uso `getSolunar` para ese puerto y ese día, y el rating de las 12
  páginas con el que calcula el dominio. Con dos propiedades que el pase adversario buscaría:
  ninguna banda se sale del lienzo en ninguna página, y los estados terminales (100 y 0) solo salen
  si la fórmula llega exactamente ahí, nunca redondeando.
- **Dar de baja el módulo es borrar una línea** de `apps/web/src/modules.config.ts`. Verificado
  construyendo sin él: **33 páginas**, sin sección y sin bandas. El core no nombra a `fishing` en
  ninguna línea — el gráfico solo sabe de «ventanas destacadas» con un peso y una etiqueta, y quién
  las llena es el registro de secciones de la superficie.
- **Una avería silenciosa cazada por el camino**: importando la hoja de estilos desde el propio
  componente, Astro **no la mete en el bundle** cuando el componente llega por el mapa de
  renderizadores, y la sección se publicaba **sin estilos con todo el CI en verde**. La hoja pasa a
  importarse desde el layout (que es la regla del brief) y **un test comprueba que las reglas
  siguen en la hoja publicada**.
- **Coste medido**: la hoja compartida pasa de **9.988 a 11.759 bytes** (+1.771, y esa cifra no
  depende de la fecha del build: sale idéntica el 28-08, el 29-08 y el 01-12). La página de puerto
  crece entre **+4.786 y +4.929 bytes** —de media +4.861, un 24 %—, medido sobre los 12 puertos en
  esas tres fechas contra el mismo `main` construido a la par. Se publica el incremento y no un
  tamaño absoluto porque el absoluto se mueve con el día que se construye: la página de Vigo del
  28-08 son 24.572 bytes y la del 01-12, 24.485. **25 tests nuevos** (9 del módulo, 5 del recorte de
  bandas, 3 del registro de ventanas, 7 sobre el `dist/` construido y 1 del registry): la suite de
  la web pasa de 41 a 57 y el repositorio queda en 344 en verde.

### El pase adversario, y sus cuatro arreglos

El rol `qa-adversario` atacó lo que los otros tres ya habían dado por bueno y sacó **cuatro
hallazgos reproducidos** (más 12 sospechas que no se materializaron y cuatro juicios de producto:
informe en `docs/qa/informe-adversario-t10.md`). Ninguno cambia un número —los números salen bien en
los 12 puertos y en los dos días de cambio de hora—: los cuatro son **la sección publicándose peor
de lo que se calcula**. Los cuatro van corregidos en este mismo PR y sus ataques se quedan de gate
permanente, así que deshacer un arreglo pone el CI en rojo.

- **El rótulo que califica la cifra ya no puede prometer pesca a espaldas de nadie.** «Actividad
  prevista por la convención» estaba escrito a mano en la plantilla, fuera de los textos auditados:
  el adversario lo sustituyó por **«Hoy pican seguro»**, las 12 páginas lo publicaron y la suite
  entera quedó en verde. Ahora vive en `textos.ts` y la regla «aquí no se promete pesca» se aplica a
  **todas las cadenas de la superficie pública del package** —se recorre `index.ts`, que es
  exactamente el conjunto que el gate del `dist/` declara auditado— en vez de a tres elegidas a
  mano; y la lista negra caza el ataque exacto, que con las palabras de antes no casaba. Y el rótulo
  se reescribe a **«Índice de la convención solunar»**: «prever» era justo lo que el aviso niega doce
  párrafos más abajo.
- **Las bandas se ven al sol y se distinguen sin depender del color.** Medían **1,30:1** y
  **1,14:1** sobre el fondo, y mayor contra menor **1,14:1**, frente al 3:1 de WCAG 1.4.11. Ahora la
  banda lleva **filete** en terracota a opacidad plena, **continuo de 2 px** el mayor y
  **discontinuo de 1,6 px** el menor: una diferencia que se ve en escala de grises y que no depende
  de distinguir dos tonos del mismo naranja. Medido **sobre el SVG servido** —14 anchos de
  presentación de 300 a 1440 px × 2 temas × los 4 bordes, 56 muestras por caso—: mayor
  **5,42–5,81:1** en claro y **5,68–5,99:1** en noche, menor **3,95–5,78:1** y **4,13–5,94:1**,
  **cero muestras por debajo de 3:1**. Los grosores no son de gusto: un filete de w px centrado en el
  borde reparte su cobertura entre dos columnas de píxel y en la peor alineación se queda en w/2, así
  que por debajo de 1,36 px no hay 3:1 que valga — con 1 px el menor caía a **2,31:1** en 9 de esos
  14 anchos. La mancha se queda tenue a propósito: subirla al 3:1 exigiría 0,70 de opacidad y
  taparía la curva.
- **La sección del módulo se expone como región.** La página tenía ocho secciones y Chromium
  anunciaba **siete**: la del módulo salía sin nombre accesible, con su `<h2>` ya emitido y sin que
  nadie lo referenciase. Ahora son **8 de 8**, y el arreglo está en el envoltorio genérico, así que
  el módulo de meteo (T-11) lo hereda.
- **El pie del gráfico dice qué son esas manchas.** El `aria-label` enumeraba las cuatro franjas con
  sus horas y el `<figcaption>` seguía hablando solo de metros: quien no veía el gráfico recibía la
  explicación entera y quien lo veía, cuatro manchas sin leyenda. El pie da ahora la clave de las dos
  tramas, sin repetir las horas (que ya están en la tabla y en el nombre accesible).

**Suite en 348 en verde** (61 de la web, con los cuatro ataques ya como gate duro), `astro check` sin
diagnósticos, el gate anti-slop de UI **limpio** en `apps/web/src` y en `packages/ui/src`, y los 20
tests del API en Deno pasando.
## 2026-08-29 — T-17 · la web, en pie (adelanto de T-15)

- **`apps/web/Dockerfile`**: imagen de la web en dos etapas. Se construye desde la **raíz** del repo
  (`docker build -f apps/web/Dockerfile .`) y no desde `apps/web`, porque el sitio no se rellena en
  el navegador: se **calcula en build** llamando a los casos de uso, y necesita `packages/` y el
  dataset de `data/`. La imagen final son **94 MB**: la base `nginx:alpine` (94,2 MB) más **528 KB**
  de HTML. El toolchain —232 MB de Node, pnpm, `node_modules` y el código fuente— se queda en la
  primera etapa; comprobado sobre la imagen construida: `node`, `npm`, `pnpm` y `corepack` no
  existen en ella. Lo que no está en la imagen no se puede explotar ni se paga al desplegar.
- **Existe porque el dominio estaba roto, no porque tocara desplegar**: `mareia.cervilla.es` ya
  estaba enganchado en Dokploy a dos apps que apuntaban a Dockerfiles inexistentes, así que Traefik
  contestaba **502**. Un dominio enganchado a un servicio que no arranca no es una URL «que aún no
  existe», es una URL rota. Esto pone en pie lo que ya estaba terminado, la web; el API, el volumen
  KV y el rebuild diario siguen en T-15.
- **Escucha en `0.0.0.0:3000` y lo dice en el log**, leyendo la dirección de su propia
  configuración en vez de repetirla en el mensaje. Esta es la avería que el proyecto ya conoce: un
  servidor que bindea al hostname del contenedor arranca sin quejarse, el contenedor queda
  `running`, el log dice «listo» y Traefik devuelve 502 igualmente. Un mensaje escrito a mano podría
  decir `0.0.0.0` mientras el servidor escucha en otro sitio; leído de la configuración, es una
  prueba y no una opinión. La primera línea del arranque publica además **el día que hornea el
  HTML**, que es como se ve desde fuera si el contenedor es el rebuild de hoy o el de la semana
  pasada.
- **Servidor: nginx, elegido midiendo**. `nginx:alpine` (94,2 MB) frente a `caddy:2-alpine`
  (88,7 MB): el tamaño no decide. Decide la semántica de rutas, y en concreto **que no haya ningún
  catch-all**. Un `try_files … /index.html` —el patrón de las SPA— devolvería la portada con un
  **200** ante cualquier URL inventada y le diría a un buscador que todas son páginas reales; este
  sitio es SSG y su motivo de existir es el SEO, así que el 404 tiene que ser un 404, con el cuerpo
  de `404.html`. Las otras dos reglas: `index index.html` para los directorios y **301** de
  `/mareas/…/vigo` a `/mareas/…/vigo/` con **`absolute_redirect off`**, porque un `Location`
  absoluto se construiría con el **puerto interno** y detrás de Traefik mandaría al visitante a una
  dirección que desde fuera no existe.
- **Sin root**: el proceso corre como el usuario `nginx` (el 3000 no necesita privilegio) y el HTML
  que sirve no le pertenece. Además `server_tokens off`, sin autoindex, fuera el `server` por
  defecto del puerto 80 y los logs al stdout/stderr del contenedor, que es lo que lee Dokploy.
- **`BUILD_DATE` es un `ARG` de build, y no puede ser otra cosa**: el día está horneado en el HTML
  de las 33 páginas, así que una variable de runtime no movería ni una marea, solo mentiría. El
  rebuild diario de T-15 tendrá que reconstruir la imagen; lo que se ha hecho es que sea barato.
  Los `ARG` van declarados **después** del `pnpm install`, de modo que un día nuevo invalida la
  caché solo a partir del `astro build`: **18,3 s** el build desde cero, **8,4 s** el del día
  siguiente sobre el mismo commit. También hay `SITE_URL` (por defecto el dominio de producción):
  sin él, el `sitemap.xml` y las canónicas se publicarían apuntando a `localhost`.
- **La prueba, no el Dockerfile, es el entregable**: imagen construida y levantada de verdad, y las
  seis preguntas hechas con `curl` — portada 200; `/mareas/galicia/pontevedra/vigo/` 200 con las
  cuatro mareas del día en la tabla; la misma sin barra final **301** con `Location` relativo;
  `sitemap.xml` 200 con 32 `<loc>` sobre el dominio de producción; una URL inventada **404** y su
  cuerpo **byte a byte igual** al `404.html` del `dist/`; y la imagen sin rastro de toolchain. La
  salida completa está en `docs/despliegue.md`, junto a cómo se configura en Dokploy —incluido el
  aviso de que la imagen hereda un `EXPOSE 80` de la base que no se puede deshacer, y de que
  autodetectar ese puerto sería otro 502— y qué queda pendiente de T-15.
- **Ninguna URL del dominio contesta con una página que no sea del portal.** Dos fugas, la misma
  familia: `COPY` **fusiona, no limpia**, así que el `50x.html` de la imagen base sobrevivía a la
  copia del `dist/` y `/50x.html` respondía **200** con una página en inglés que además publicaba la
  marca `nginx` pese al `server_tokens off`; y `/_astro/`, que es un directorio real sin
  `index.html`, respondía **403** con la página de error compilada en nginx. Ahora la raíz web de la
  base se **vacía** antes de copiar el sitio, y `error_page 403 =404 /404.html` devuelve el 404 del
  portal — **404 y no 403** a propósito: un 403 confirma que ese directorio existe. Medido después:
  cero apariciones de la marca `nginx` en esos cuerpos. Quedan tres respuestas que genera nginx y a
  las que **no se llega navegando** (el cuerpo del 301, el 405 de un método no soportado y el 414 de
  una URI desmedida); se dejan como están porque convertirlas en 404 sería mentir sobre lo que pasó.
- **Las dos bases van fijadas por digest**, no por tag: `22-alpine` y `alpine` se mueven, y con el
  rebuild diario de T-15 la base cambiaría bajo los pies **sin que ningún commit lo cuente** — una
  avería que aparece un martes sin que nadie haya tocado nada. Subirla pasa a ser un cambio que se
  revisa.
- **El `.sh` que corre como PID 1 y el Dockerfile ya tienen quien los vigile**: `shellcheck -S error`
  sobre todos los `.sh` del repo y `hadolint` sobre el Dockerfile, en el job `anti-slop` y **por
  imagen fijada**, de modo que local y CI corren exactamente lo mismo. Los dos pasos se probaron
  **en rojo** además de en verde: un gate que no sabe fallar no vigila nada. Con esto queda cerrada
  media casilla del peldaño 1 que T-15 tenía apuntado (falta `actionlint`).
- **Se probó escuchar también en el puerto 80 y se descarta, con la medida delante.** La imagen
  hereda un `EXPOSE 80` de la base que Docker no deja deshacer, y como `ExposedPorts` es un mapa sin
  orden, una heurística de «el primero» elegiría el puerto malo. Escuchar en los dos parecía gratis:
  funciona con los defaults de Docker (`ip_unprivileged_port_start=0`), pero con
  `--sysctl net.ipv4.ip_unprivileged_port_start=1024` el bind falla con `Permission denied`, **nginx
  no arranca y el 3000 se cae con él**. No es una segunda vía, es una dependencia de arranque sobre
  una condición del host que no podemos verificar: cambiaría un 502 con el sitio vivo en el 3000 por
  una caída entera. Se queda declarar el 3000 a mano en Dokploy, que es lo que ya está configurado.
- **El rodeo para construir en el entorno del enjambre es ahora una receta que se puede repetir.**
  Aquí el tráfico HTTPS pasa por un proxy que intercepta el TLS y `pnpm install` muere con
  `SELF_SIGNED_CERT_IN_CHAIN`. La CA **no** se hornea en la imagen —sería un defecto de seguridad de
  verdad, y permanente—: se sustituye la base al construir con `--build-context`, que no toca el
  Dockerfile. `docs/despliegue.md` lleva los comandos exactos, probados copiándolos tal cual desde
  cero.
- **`.dockerignore`** en la raíz: fuera dependencias y `dist/` (se reconstruyen dentro; un `dist/`
  viejo del portátil podría acabar servido en producción sin que nadie lo notara), y fuera `.env` y
  las capturas de QA, que en una imagen quedarían en una capa legible para siempre.

## 2026-08-28 — T-08 · el módulo weather, primer módulo real del registry

- **`GET /v1/modules/weather/weather?port=<slug>`**: estado del mar (olas total/wind/swell con
  altura, dirección y periodo, y temperatura del agua) y de la atmósfera (viento, rachas, presión,
  visibilidad, UV) desde **Open-Meteo**, sin API key. Cada fuente viaja con su `fetchedAt`, su
  `ageSeconds` y su `stale`, y la respuesta dice de qué **celda** habla (el *cuándo* va en cada
  fuente: las dos se refrescan por separado y pueden traer instantes distintos).
- **`GET /v1/modules/weather/bulletin?port=<slug>`**: boletín marítimo costero de **AEMET** para la
  zona del puerto (patrón de dos llamadas, con la clave en cabecera y nunca en la URL). El documento
  se pasa tal cual y se decodifica con el charset que declare AEMET (ISO-8859-15 en buena parte de
  sus productos). Los códigos de zona son los INE de provincia y van marcados `verified: false`:
  comprobarlos exige una API key, y cuando la haya será un cambio de datos, no de código.
- **Degradar en vez de romper**, con tres escalones: caché fresca (cero red) → red → caché caducada
  marcada `stale`. Solo cuando no hay ninguna de las tres se contesta `unavailable` con el motivo, y
  siempre con HTTP 200: un dato de hace tres horas sirve para decidir si sales a navegar; un 500,
  no. **Sin `AEMET_API_KEY` la instancia funciona**: el boletín dice que falta la credencial.
- **Caché por celda de 0,1°** sobre **Deno KV**, con TTL por fuente (1 h mar, 30 min atmósfera, 6 h
  boletín) y una ventana de retención de 4 TTL para poder degradar. Dos peticiones seguidas del
  mismo puerto salen a la red **una sola vez**, y la caché sobrevive al reinicio del proceso. Si KV
  no está disponible, degrada a memoria. La clave es **tipo + celda, sin instante**: una clave que
  rotara con la hora dejaría el dato guardado ilegible justo en el momento en que la fuente se cae,
  que es para lo que se guarda.
- **Las atribuciones viajan solas**: `/v1/modules` publica Open-Meteo (CC-BY 4.0) y AEMET, y además
  van en cada respuesta. El contrato de T-06 no deja compilar un módulo sin ellas.
- Solo se deja cachear fuera (`Cache-Control`) lo que salió entero; una respuesta degradada va con
  `no-store` para no congelar la avería en un CDN.
- **Cero red en CI**: el `fetch` entra inyectado en los dos adaptadores y los fixtures son capturas
  reales de las APIs. 57 tests del módulo y 5 de integración en la API, incluido el de oro (segunda
  llamada a la misma celda → 0 peticiones), el de degradación sin clave y los dos que defienden la
  ventana de retención: un dato de un minuto cruzando la hora en punto se sirve con el upstream
  caído, y pasado el TTL se sirve marcado `stale` mientras dure la retención.
- **La caducidad de la clave de AEMET se lee y se avisa antes de que muerda**. AEMET emite claves
  con tres meses de vida, y las emitidas sin fecha dejan de valer el **15-10-2026**; el alta lleva
  reCAPTCHA y dos correos, así que renovarla es un trámite humano y lo único que puede hacer el
  software es que la fecha no llegue por sorpresa. `inspectAemetKey` lee el `exp` del propio JWT
  **sin gastar una petición**; una clave sin `exp` no se da por eterna, hereda la fecha anunciada, y
  una que no se deja leer se declara ilegible en vez de inventarle un plazo. El estado viaja en
  `/bulletin` y entra en el healthcheck —una clave que caduca en tres días es un problema hoy, no el
  día del 401— y un workflow diario abre el aviso en el repositorio con los pasos exactos de
  renovación. Los avisos van **por escalones (21, 7 y 1 días)**, uno por escalón y no uno al día: un
  aviso que aparece cada mañana durante tres semanas se deja de leer, que es justo lo contrario de
  lo que se busca. **Ya caducada sí insiste** —un aviso al día mientras el boletín siga roto—,
  porque ahí el coste de repetirse es menor que el de que nadie mire. Y la identidad del aviso
  **lleva la fecha de caducidad de la clave concreta**, así que una clave renovada estrena sus
  avisos en lugar de heredar el silencio de los del ciclo anterior; el issue, además, **se cierra
  solo** en cuanto el secreto vuelve a tener una clave válida. Que la clave *falte* no cierra nada:
  un secreto borrado por accidente apagaría justo la alarma que lo delata. Y si **el comprobador
  mismo** se avería —una permisión corta, un import roto, el binario ausente—, eso no pasa por
  silencio: abre su propio aviso, sin afirmar que la clave esté mal, y **el job sale en rojo**. Un
  canal de alarma que se rompe en verde no es un canal.
- Arrastrados de T-07: el **año del almanaque se valida sobre el crudo** (`/^\d{4}$/`, así que
  `/almanac/0x7ea` ya no sirve el de 2026), **`listPorts` ordena de verdad** por región, provincia y
  puerto con `Intl.Collator("es")` —el orden pasa a ser contrato verificado— y el **`--allow-read`
  de la API queda acotado al dataset** en vez de a todo el disco.
## 2026-08-28 — T-09 · la página de puerto, y el gate de UI que la vigila

- **El portal existe**: 32 páginas estáticas construidas desde el dataset —12 puertos bajo
  `/mareas/<región>/<provincia>/<puerto>/` más los índices de provincia, región, `/mareas/` y la
  portada—, con **cero JavaScript de cliente**. La página de puerto trae la tabla de pleamares y
  bajamares del día, la curva de 24 h en SVG con sus extremos marcados, el coeficiente con su
  etiqueta de la escala francesa, sol y luna (ortos y ocasos con acimut, los tres crepúsculos, fase
  e iluminación) y la tabla del mes entero, pensada para imprimirla y llevársela.
- **Los datos se calculan en build con los casos de uso del API** (`getTides`, `getAstro`,
  `getPort`): la web no tiene su propia versión de la marea, tiene la misma. El día que publica el
  sitio es un parámetro (`BUILD_DATE`, o el día UTC del reloj) y se enseña en la página —«datos
  generados el …»—, así que el build es reproducible y el `dist/` se puede testear contra el
  dominio. El coeficiente, que todavía no tiene endpoint, se calcula con el dominio y se memoiza:
  es el mismo para los doce puertos y solo cambia dónde se corta el día civil.
- **Transparencia en la propia página**: grade de la estación con lo que significa, RMSE, error de
  hora p95 y su motivo cuando falta, cero hidrográfico y las atribuciones **de esa estación**
  —cambian de licencia entre puertos—. Y **dos avisos distintos** antes de la tabla, porque son dos
  cosas distintas: en Cabo de Palos, La Manga y Palma, que la marea astronómica es de centímetros
  (19-24 cm de carrera al mes) y quien manda es el residuo meteorológico; en Cádiz, que la
  predicción **no se ha podido comprobar** con un mareógrafo —su marea sube y baja 3,4 m en el mes
  que publica—.
- **SEO**: canónicas, `sitemap.xml` con el `lastmod` del build, JSON-LD (`Place` +
  `BreadcrumbList`, generado del mismo array que pinta las migas) y anclas por sección.
- **Gate de UI** (deuda de T-01, prerrequisito de esta trayectoria): brief de diseño commiteado
  antes de la primera vista (`apps/web/design-brief.md`), tokens en OKLCH con su contraste medido
  —el peor par, 5,4:1—, linter determinista de frontend en CI, `eslint-plugin-astro` (`pnpm lint`
  cubre ya los `.astro`) y `astro check` en el job web. Se cierran también las deudas menores del
  verificador de T-01: pin de semgrep y `--frozen` en los `deno task` del CI.
- El **pase adversario** de la tranche 1 sigue siendo gate: sus siete hallazgos se re-apuntan al
  sujeto nuevo —la curva se ataca en los 12 puertos; enlaces rotos y landmarks, en las 32 páginas— y
  la promesa «lo que se lee es lo que se calculó» se comprueba ahora contra los casos de uso.
- **Y una tranche 2 sobre las 32 páginas ya construidas**, con cinco hallazgos más, corregidos aquí
  y convertidos en gate permanente:
  - El aviso de «marea de centímetros» lo decide ahora la **carrera de marea medida** del mes, no el
    grade del QC. Con el criterio viejo Cádiz leía que su marea no importaba encima de su propia
    tabla, que ese día marcaba 2,90 m de carrera; era el aviso más grave de la página, en el puerto
    equivocado.
  - La **nota de calidad ya no habla de observaciones que no existen**: donde no hubo mareógrafo lo
    dice con esas palabras, en vez de confundirlo con «no hay pleamares medibles».
  - **Sol y Luna**: los ~25 días al año en que el orto o el ocaso de la Luna caen fuera del día
    civil se cuentan bien. La fila «Sale» ya no anunciaba el ocaso, y la página ya no afirma que la
    Luna «está todo el día bajo el horizonte» junto a la hora de su propio ocaso.
  - **Página de «no encontrado»** (`404.html`): una URL vieja o mal escrita ya no es un callejón sin
    salida, sino la portada del portal con el índice de puertos.
## 2026-08-28 — T-16 · especificación de widgets de pantalla de inicio (PWA + Capacitor)

- **Spec v1 en `docs/espec-widgets-pwa-capacitor.md`**: widgets iOS (WidgetKit) y Android (Glance)
  alimentados por la PWA vía Capacitor, adaptada al dominio de Mareia — el widget muestra la tabla
  del día del puerto favorito (siguiente pleamar/bajamar, coeficiente, eventos del día civil del
  puerto) generada **sin red** desde el mismo almanaque que precacheará T-12.
- El contrato es un único JSON versionado (`WidgetPayload`, clave `widget_payload_v1`): widgets
  «tontos» que solo pintan, 4 estados obligatorios (normal/vacío/desactualizado/error), textos ya
  localizados por la web, deeplinks `mareia://` y `expiresAt` en la medianoche local del puerto.
- Solo documentación: el shell Capacitor y las extensiones nativas son trayectorias futuras
  (nueva línea en Fase 2 del roadmap). Decisiones abiertas señaladas en la propia spec (bundle
  id/App Group, esquema de deeplink definitivo, validación sin zod).

## 2026-08-28 — T-04 · coeficiente de mareas y dos mejoras del motor

- **Coeficiente de marea** (escala francesa 20-120) en `@mareia/domain-core/coefficient`: un valor
  por pleamar y el reparto mañana/tarde del día civil, calculados con predicción propia de Brest y
  la unidad de altura `U = 3,05 m`. Los constituyentes entran por parámetro; el dominio sigue sin
  tocar disco. Contrastado contra **32 coeficientes publicados de 2026**: error máximo de **2
  unidades** y sesgo de +0,9.
- Se calcula sobre la **onda semidiurna** de Brest, no sobre la predicción completa: los valores
  publicados de un mismo día son casi iguales entre sí y la marea real tiene desigualdad diurna.
  Con la marea completa el error subiría a 5 unidades. Va documentado y con su test.
- **Cinco constituyentes nuevos en el motor** —EP2, MA2, MB2, MKS2 y 2MS6—, los que el QC de T-05
  señaló como techo del dataset (2,2 cm RMS de truncado en Brest, y el grado A fuera de alcance para
  Vigo y Santander). El catálogo del motor y el del pipeline vuelven a ser el mismo contrato en dos
  idiomas. **El dataset se regenera en T-13**: hasta entonces sigue truncado a los 37 anteriores.
- **`f(M3)` pasa a la forma publicada de Schureman** (SP-98) en vez de derivarse como `f(M2)^1,5`.
  Medido: las dos formas son la misma expresión (4·10⁻¹⁶ de diferencia), y lo único que separa a
  este motor del pipeline es el redondeo del 0,8758 impreso — 0,022 %, no el 1 % que se sospechaba.
- Los golden tests contra NOAA CO-OPS no se mueven un dígito con ninguno de los dos cambios.

## 2026-08-28 — T-07 · los endpoints core del API

- **Seis rutas nuevas** sobre el dataset de T-05 y el dominio de T-02/T-03: `GET /v1/ports`,
  `/v1/ports/:slug`, `/v1/ports/:slug/tides?from&to[&step]`, `/v1/ports/:slug/almanac/:year`,
  `/v1/ports/:slug/astro?date` y `/v1/ports/:slug/solunar?date`. Son del **core**, no un módulo:
  se montan junto a `/health`, que sigue igual que el registry de módulos de T-06.
- **`data/geo/ports.json`** (schema `ports/v1`): los 12 puertos con slug, jerarquía
  región/provincia —los tramos de la URL pública, `/galicia/pontevedra/vigo`—, coordenadas, zona
  horaria y su estación. Un test impide que se desincronice del dataset: ni estaciones huérfanas ni
  referencias muertas. Brest sigue fuera: es la referencia del coeficiente, no un puerto.
- **Las fechas son días civiles del puerto**, no ventanas UTC: pedir un día en Vigo devuelve de
  medianoche a medianoche locales, y el día del cambio de hora dura 23 o 25 horas. Cada instante
  viaja dos veces, en epoch ms y en ISO 8601; horas locales, ninguna.
- **La transparencia viaja por el API**: toda respuesta con alturas lleva la calidad de la estación
  (grade, RMSE, error de hora p95) y sus atribuciones. En los puertos micromareales —Cabo de Palos,
  La Manga, Cádiz, Palma— el error de hora no es medible y se publica como `null`: el cliente puede
  decirlo en vez de fingir una precisión que no hay.
- **Validación ruidosa con límites publicados**: `tides` ≤ 40 días, `step` de 1 a 60 min y ≤ 6.000
  puntos de curva, `almanac` solo el año en curso ±1 (contado en la zona del puerto). Cada 400 dice
  qué se esperaba y qué llegó; un slug desconocido es 404, no una lista vacía.
- **Caché**: las respuestas son deterministas y salen con `Cache-Control: public, max-age=86400`.
  Los errores, sin caché.
- **Clean architecture de verdad**: `@mareia/usecases` (casos de uso puros, con repositorios,
  efeméride y reloj inyectados) y `@mareia/adapters` (JSON de disco con caché y ruta inyectada). Los
  límites viven en los casos de uso y no en las rutas, para que el build del sitio los reutilice sin
  pasar por HTTP.
- **Contract tests** en Deno contra el dataset real —status, esquema, cabeceras y los ocho errores—
  y un golden fino: los extremos de Vigo que publica el API son los mismos que da el motor llamado a
  mano sobre el mismo JSON de estación.
- El endpoint de **coeficiente** queda pendiente de que merjee T-04, que va en paralelo.

## 2026-08-28 — T-05 · Cabo de Palos y La Manga, y arreglo de la detección de extremos

- **Dos puertos nuevos** en el piloto: **Cabo de Palos** y **La Manga** (lado mediterráneo, no la
  laguna del Mar Menor, que no tiene marea astronómica utilizable). Ambos dependen del mareógrafo de
  Cartagena, a 25 y 27 km, y están en zona micromareal (rango 0,23 m): salen **grade C**, con el
  aviso correspondiente en el informe QC.
- **La distancia al mareógrafo pasa a ser un umbral del grade** (A ≤ 5 km, B ≤ 30 km): un puerto que
  toma prestadas las constantes de otro sitio ya no puede heredar el grade de quien se las presta.
- **Corregida la detección de extremos**, que comparaba puntos vecinos y tomaba por pleamar
  cualquier rizo del registro: en un mareógrafo que muestrea cada 6 s daba decenas de miles de
  extremos donde había cuarenta, y con ellos el error de hora salía excelente y falso. Ahora se
  exige prominencia y se fuerza la alternancia pleamar/bajamar. Consecuencia: varias p95 empeoran
  respecto a la medición anterior porque aquélla estaba inflada, y **Huelva baja de A a B**
  (17,9 → 22,9 min). El reparto final es 4 A, 5 B, 4 C.
- Donde la observación no tiene pleamares identificables, el error de hora **ya no se publica** en
  lugar de publicarse un número sin significado.
- El agregador se cita por su nombre real, `openwatersio/tide-database`, en las atribuciones.

## 2026-08-28 — T-05 · dataset de los 10 puertos piloto

- **Dataset `station/v1`** en `data/stations/` para Vigo, A Coruña, Santander, Bilbao, Cádiz,
  Huelva, Málaga, Palma, Las Palmas y Santa Cruz de Tenerife, más `data/brest/constituents.json`
  como referencia del coeficiente de mareas. Con su JSON Schema y sus atribuciones dentro de cada
  fichero. Grades: 5 A, 4 B, 2 C.
- **Pipeline Python** en `data/pipeline/` (`make all`): descarga con caché, política de
  reconciliación de mareógrafo, validación contra 30 días de observaciones del IOC e informe QC
  commiteado. Requirements pinneados; fuente de constantes fijada a un commit.
- **Motor de predicción armónica de referencia** en Python (Doodson + Schureman), verificado contra
  la tabla publicada de velocidades y contra `@neaps/tide-predictor`.
- El dataset se **trunca a los 37 constituyentes** que soporta el motor de `domain-core`; lo
  descartado queda registrado en cada JSON y su coste medido influye en el grade.
- **Aviso de licencia**: el dataset no es CC-BY 4.0 uniforme. Dos puertos (Bilbao y Huelva) sólo
  tienen mareógrafo disponible bajo **CC-BY-NC 4.0**; está declarado estación por estación.
- CI: nuevo job `data-pipeline` con el camino offline (tests + validación contra el schema).

## 2026-08-28 — astronomía y periodos solunares (T-03)

- `astronomy/` en `@mareia/domain-core`: ortos y ocasos de Sol y Luna con acimut, crepúsculos civil,
  náutico y astronómico, fase lunar (edad real desde la nueva anterior, iluminación y próximos
  cuartos), tránsito superior e inferior y distancia lunar. Los casos polares no devuelven `null`:
  `SkySearch` es una unión discriminada que distingue el sol de medianoche de la noche polar.
- **Primera y única dependencia de runtime del dominio**: `astronomy-engine` (MIT, pinneada, sin
  dependencias transitivas), importada por un solo fichero y escondida tras la interfaz
  `AstronomyGateway`. Es la excepción del Design Doc bajo «matemática vendorizada»: una efeméride
  reimplementada a mano no falla ruidosamente, devuelve una hora plausible y falsa.
- Golden tests contra efemérides publicadas del **USNO** (8 fechas de 2026 × Madrid y Las Palmas,
  descargadas con su script y commiteadas con las URLs exactas): error máximo 0,49 min en ortos,
  ocasos, tránsitos y crepúsculo civil —frente a tolerancias de ±2 y ±3 min— y 1,33 min en los 50
  cuartos lunares del año, frente a ±1 h. El USNO tabula al minuto: ≤0,5 min es acuerdo exacto.
- `solunar/`: periodos mayores (2 h centradas en cada tránsito lunar) y menores (1 h 30 min en el
  orto y el ocaso de la Luna) del día civil de una zona IANA, con rating de actividad 0-100 y
  etiqueta. El cálculo es en UTC de punta a punta; la zona solo decide qué periodos caen en el día,
  y eso está verificado comparando Madrid, UTC y Auckland.
- El rating se documenta como la convención que es, con su desglose auditable: 100 y 0 solo se
  alcanzan por exactitud de la fórmula (nunca por redondeo) y los umbrales de etiqueta son los
  cuartos iguales del rango alcanzable, no números inventados.

## 2026-08-28 — motor de predicción de mareas propio (T-02)

- Motor de predicción de mareas propio en `@mareia/domain-core`: suma armónica con correcciones
  nodales por el método de Schureman (SP-98), 37 constituyentes, buscador de pleamares y bajamares y
  curva muestreada. TypeScript puro —sin IO, sin reloj del sistema, sin dependencias de runtime—
  para correr igual en la API (Deno), en el build del sitio (Node) y en el navegador.
- Golden tests contra las predicciones **oficiales** de NOAA CO-OPS en dos regímenes de marea
  (San Francisco, mixto; Boston, semidiurno): error máximo 2,9 cm en la curva y 2,9 min / 1,7 cm en
  los extremos, frente a un contrato de ±15 cm y ±10 min. Oráculo cruzado adicional contra el motor
  independiente `@neaps/tide-predictor`, con acuerdo por debajo de 0,4 mm.
- Los packages ya se testean en CI con el runner nativo de Node 22 (`pnpm test`), sin framework de
  test ni dependencias añadidas.

## 2026-08-28 — contrato de módulos enchufables (T-06)

- `@mareia/module-contract`: el contrato `AppModule` (con `PageSection`, `Attribution`, `CorePorts`,
  `PrecachePolicy`, `Health`) que hace enchufables pesca, meteo y navegación. Sin dependencias: el
  router es un parámetro de tipo que estrecha cada adaptador, y las atribuciones son una tupla no
  vacía, así que un módulo sin fuentes declaradas no compila.
- Registries: `apps/api/src/modules.config.ts` y `apps/web/src/modules.config.ts`. Dar de alta o de
  baja un módulo es editar ese array y nada más.
- API: nuevo `GET /v1/modules`, que lista los módulos activos con su versión y sus atribuciones; cada
  módulo se monta bajo `/v1/modules/<id>`. `/health` no cambia.
- Test de capas en CI: el dominio (`domain-core`, `usecases`) no puede importar módulos ni el
  contrato, y el contrato no puede importar de `apps/*`.

## 2026-08-28 — nace el proyecto

- Monorepo inicial: web Astro (SSG), API Deno + Express con `/health`, y el esqueleto de packages de
  la clean architecture (dominio, casos de uso, contrato de módulos, adapters, módulos pesca/meteo).
- Gates de calidad y seguridad del enjambre instalados en CI: linter anti-slop, escáner de secretos,
  SAST, auditoría de dependencias y checks de presencia de QA.
- Licencia AGPL-3.0, README con principios (OpenSource, no comercial, transparencia) y atribuciones
  de las fuentes de datos.
