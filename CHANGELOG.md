# Changelog — Mareia

Formato *Keep a Changelog* relajado; lo más reciente arriba.

## 2026-08-29 — T-13 · España completa, y el 78 % del catálogo diciendo que no está medido

- **El portal pasa de 12 puertos a 153**, de Viveiro a El Hierro y de Menorca a La Palma, y con
  ellos el sitio de **32 a 191 páginas** sin tocar `getStaticPaths`: la web se generó sola desde
  `data/geo/ports.json`, que es lo que T-09 prometió que pasaría. Medido: **build de 11,9 s** (13 s
  de reloj) y **`dist/` de 4 614 156 B (4,40 MiB)**, frente a los 1,8 s y 417 794 B (0,40 MiB) de
  `main`. Casi seis veces más páginas por once veces más peso, porque lo que se multiplica son las
  páginas de puerto (~26 KB) y no los índices (~4 KB). El pipeline entero tarda **4,3 min desde
  cero** (258 s, con las descargas) y **24 s** con la caché caliente.
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
- **El golden del coeficiente se puso en rojo, como T-04 avisó, y se resolvió midiendo.** Añadir los
  cinco constituyentes mueve el coeficiente de Brest: el sesgo contra los 32 valores publicados por
  el SHOM pasa de **+0,91 a +1,38** y el error máximo de 2 a 3. Quitar del cálculo la modulación
  radiacional (MA2, MB2) —la salida que T-04 dejaba abierta— no lo arregla: deja el sesgo en +1,19.
  El desacuerdo no viene de qué constituyentes entran sino de comparar dos análisis armónicos
  distintos del mismo puerto. Se ensancha el acuerdo exigido a ±3 con la medida escrita en el
  fixture, porque el dataset nuevo predice **mejor la marea de verdad** (contra el IOC, Brest sube a
  grade A) mientras se aleja un pelo del otro oráculo. Hay dos oráculos y sólo uno es el mar.
- **La política de selección de mareógrafo tenía un fallo que sólo la escala destapó.** Al ensanchar
  el radio de búsqueda a 60 km, Gandía se llevó las constantes del mareógrafo de Valencia —mejor
  licencia y registro más largo, a 53,8 km— teniendo uno en su propia bocana. La licencia y los años
  de registro deciden ahora **dentro del mismo sitio** (5 km del más cercano) y nunca entre sitios
  distintos. Con su test, que reproduce el caso.
- **El informe QC se vuelve navegable**: resumen con el reparto de grades, cobertura por región, los
  15 peores medidos, la tabla de descartes con su motivo, y el detalle por región separado en dos
  tablas —**medidos** y **estimados**— porque son dos poblaciones distintas y mezclarlas es lo que
  hace que un número prestado parezca propio.
- **Los invariantes siguen mordiendo a escala.** El test de coherencia catálogo↔dataset (T-07) ya no
  cuenta doce puertos sino que exige que ninguno publique un número que no se haya medido en él y
  que ningún estimado alcance grade A; `python run.py check` repite la comprobación sin red antes de
  CI; el golden de Vigo sigue siendo golden; y el gate adversario A-1 («la curva no se congela») se
  re-apuntó con la medida delante: 17 puertos daban mesetas de más de una hora y ninguno es la
  avería original —son puertos de 2 a 11 cm de carrera diaria publicada al milímetro—, así que el
  umbral de una hora se mantiene donde puede significar algo y donde no, se exige que la curva no se
  pase el día quieta.
- **Lo que se queda abierto**: las zonas marítimas de AEMET siguen mapeadas sólo para los 12 puertos
  del piloto (el módulo degrada solo y ahora hay un test que cuenta la cobertura en vez de
  callarla); la portada sigue enseñando los 153 puertos de golpe —35,6 KB de HTML, más que una
  página de puerto— y sustituirla por el índice de regiones es una decisión de producto, no una
  consecuencia de este cambio.

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
