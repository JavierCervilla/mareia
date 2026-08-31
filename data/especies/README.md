# Catálogo de especies (`especies/v1`)

`catalogo.json` son **las 86 especies que el RD 560/1995 regula**, ni una más: el catálogo lo fija
la norma y no nosotros. De cada una publica el nombre con el que la nombra la ley, el taxón que la
ciencia acepta hoy, los caladeros que le ponen talla mínima y la presencia que hay registrada en
OBIS. Lo genera `data/pipeline` (`python run.py especies`) y se commitea: regenerarlo necesita red
y no corre en CI.

Todo lo de aquí sale de tres fuentes públicas y anónimas —el BOE, WoRMS y OBIS—, cada una con su
licencia, que están más abajo. **El campo `origenes` del propio fichero dice de cuál sale cada
campo**, para no tener que venir aquí a averiguarlo.

## Las tres reglas

**1 · El nombre del BOE nunca se sustituye.** Va literal en `nombreBoe`, porque es el que tiene
consecuencia legal. El aceptado va aparte, en `taxon`, con su estado. Se publican los dos y cada uno
con su fuente: elegir uno obliga a decidir entre mentir sobre la ley o mentir sobre la taxonomía.

Medido el 2026-08-30: de los 86 nombres, **64 se preguntaron a WoRMS tal cual y los 64 resuelven**;
de esos, **10 resuelven a un nombre distinto del que usa la norma**, porque el real decreto es de
1995 y la taxonomía se mueve.

| En el BOE | Estado en WoRMS | Aceptado hoy | AphiaID |
|---|---|---|---|
| `Dentex filosus` | unaccepted | Dentex gibbosus | 273964 |
| `Dentex macrophtalmus` | unaccepted (misspelling) | Dentex macrophthalmus | 273965 |
| `Dicologoglossa cuneata` | unaccepted | Dicologlossa cuneata | 127154 |
| `Engraulis encrasicholus` | unaccepted (misspelling) | Engraulis encrasicolus | 126426 |
| `Merlangus merlangus` | unaccepted (misspelling) | Merlangius merlangus | 126438 |
| `Mugil auratus` | unaccepted (synonym) | Chelon auratus | 1044127 |
| `Psetta maxima` | unaccepted | Scophthalmus maximus | 127149 |
| `Solea vulgaris` | unaccepted (synonym) | Solea solea | 127160 |
| `Sparus auratus` | misspelling - incorrect subsequent spelling | Sparus aurata | 151523 |
| `Trisopterus minutus capelanus` | unaccepted | Trisopterus capelanus | 712475 |

**Esto no es un error del BOE que haya que arreglar.** Ninguna de esas diez filas cambia de nombre
en el catálogo.

Son diez **de los 64 que se preguntaron tal cual**. En el censo del catálogo entero son **11**: se
suma `Panaeux kerathurus`, que llega a WoRMS por una correspondencia nuestra (regla 3) y allí resulta
ser una combinación superada de *Penaeus (Melicertus) kerathurus*. Las dos cifras son la misma cosa
contada sobre poblaciones distintas, y por eso van dichas las dos.

**2 · El género no se convierte en especie.** Las **15 filas `spp`** —**14 géneros distintos**,
porque el Anexo II escribe además `Mugil spps` y las dos filas se publican tal cual— se resuelven
**al género** en WoRMS y publican `taxon.rango: "genero"`.
Que una talla mínima aplique a todo un género es un hecho jurídico; elegirle una especie concreta
sería inventar un alcance que la norma no tiene. Lo comprueba el **gate E3**, que además recorre
todas las cadenas de la ficha: no basta con dejar el rango bien y colar el nombre de una especie
por otro campo.

**3 · Todo mapeo que no venga de WoRMS es nuestro y va firmado.** Las **22 correspondencias** que no
son el nombre literal de la norma llevan `correspondencia.origen: "mareia"` y su motivo; las **6**
que corrigen una errata llevan además `laNormaNoDiceEso: true` y el `AphiaID` al que apuntan. Un
mapeo sin dueño es una cifra inventada con otro traje, y eso lo comprueba el **gate E2**
recomputando: compara con qué nombre se preguntó contra el nombre del BOE normalizado, así que no se
satisface declarando.

| En el BOE | Se consulta como | Qué le pasa a la grafía |
|---|---|---|
| `Cáncer pagurus` | Cancer pagurus | tilde que el latín no lleva |
| `Melanogrammús aeglefinus` | Melanogrammus aeglefinus | ídem |
| `Gliptocephalus cynoglossus` | Glyptocephalus cynoglossus | i por y |
| `Microstommus kitt` | Microstomus kitt | doble m |
| `Panaeux kerathurus` | Penaeus kerathurus | «Panaeux» no existe |
| `Thunnus aibacares` | Thunnus albacares | la l impresa como i |

**Y una errata que no se mapea**: `Lophius piscatorius, L. Budegassa` nombra **dos** especies en una
celda. Corregir una grafía no cambia ninguna consecuencia, pero repartir una fila legal en dos
decide a qué alcance se aplica una talla mínima, y esa decisión no es nuestra. Se publica sin taxón
y con su motivo, como el `1 1` ilegible de la boga en `data/normativa`.

**4 · Lo que se publica se contrasta contra lo que dijo la fuente, no contra sí mismo.** Las tres
reglas de arriba son de coherencia y de firma, y ninguna comprueba **la cifra**. Los dos gates que sí
lo hacen **rehacen** el dato y lo diffean campo a campo, que es el mismo patrón que usa `normativa`
con el BOE (gate G4):

* **E5 · la talla es la de la norma.** Las **117** tallas del catálogo se reconstruyen desde
  `data/normativa/tallas-minimas.json` —con la **misma** función que las publica, no con una segunda
  lectura— y se comparan campo a campo, `medida` incluida. Hace falta porque la talla legal se
  publica en **dos** superficies —esta ficha y la página de cada puerto— y hasta que existió el gate
  el catálogo podía decir 12 cm donde el puerto decía 27, con todo en verde. Lo único que deja fuera
  es la presencia de OBIS, que no se puede rehacer sin red.
* **E6 · el taxón es el que contestó WoRMS.** Los **85** taxones se reconstruyen desde las **82
  respuestas de WoRMS capturadas** en `data/pipeline/tests/fixtures/worms/` —una por consulta, byte a
  byte, escritas por la propia ingesta para que no puedan quedarse viejas— pasándolas por el mismo
  parser de producción, y **recomputando** con qué nombre se pregunta en vez de leerlo del artefacto.
  Cubre `aphiaId`, `estado`, `aceptado`, `rango`, `cita` y el resto de la ficha: sin él, una fila
  podía publicar el `AphiaID` de otra especie con su correspondencia intacta y nadie se enteraba.
  La captura **no es un mirror** de WoRMS —su licencia lo prohíbe—: son los nombres que este real
  decreto obliga a resolver, con la cita que la fuente devuelve para cada uno.

## Qué hay dentro

```
schema      "especies/v1"
fuentes     BOE, WoRMS y OBIS, cada una con su licencia y la fecha en que se consultó
origenes    de qué fuente sale cada campo
recortes    los rectángulos con los que se pregunta a OBIS, uno o varios por caladero
resumen     el censo, recontado sobre lo publicado
especies[]  nombreBoe · clave · nombreComun/nombresComunes · correspondencia · taxon · caladeros[]
sinNombreCientifico[]   las filas del BOE que no dan latín (hoy, «Cigalas (colas)»)
```

Censo de la última generación: **86 especies**, **85 resueltas** en WoRMS (68 especies, 15 filas
de género sobre **14 géneros distintos** —`Mugil` sale dos veces, con la errata `Mugil spps` del
Anexo II—, 1 familia —`Palinuridae`— y 1 subespecie) y **1 sin resolver**; **118 filas** del real decreto
contadas (117 con nombre científico y la que no lo trae); **114 cifras de presencia**, de las cuales
9 son un cero.

### La `clave`: dos grafías de la norma no acaban en una

Cada especie trae una `clave` única y estable, que es el identificador con el que la interfaz nombra
su fila. **No es un slug**: es el slug del nombre **más el digest del literal exacto**
(`clave_de`, en `mareia_pipeline/especies.py`), y el sufijo lo pide un caso medido —el BOE escribe
`Thunnus thynnus` en los Anexos I y II y `Thunnus Thynnus` en el III, dos filas que cualquier slug
en minúsculas convierte en una—. Al salir sólo del nombre, no depende de la posición de la fila ni
de qué otras filas existan: añadir o quitar una especie no le mueve la clave a ninguna otra. Que
ninguna se repita y que todas salgan de su nombre lo comprueba `run.py check`, y el lector de la web
**rechaza el dataset entero** si dos especies comparten clave.

## La presencia es esfuerzo de muestreo, no abundancia

Cada `presencia` trae los recuentos de OBIS dentro del recorte de su caladero **y la frase de sesgo
en el mismo objeto que el número**, a propósito: así publicar la cifra desnuda exige borrar antes la
advertencia a mano.

Tres cifras medidas el 2026-08-30 que dicen por qué:

- **`Maja squinado` (centollo) sale con 0 registros en el recorte cantábrico-noroeste**, y en todo
  OBIS tiene 27.348. No es que no haya centollos en Galicia: el centollo atlántico se registra hoy
  como *Maja brachydactyla*, que en ese mismo recorte tiene **117 registros de 2 datasets**. El
  número habla del nombre con el que se pregunta, no del animal. Y aun así `Maja squinado` se
  publica tal cual, porque es lo que dice la norma y WoRMS lo da por aceptado: separar dos especies
  no es corregir una grafía, y ese mapeo no lo hacemos nosotros.
- **`Clupea harengus` (arenque) sale con 0 registros** en ese mismo recorte, y el BOE le pone talla
  mínima.
- La dorada, que sí está bien nombrada, son **56 registros** en ese recorte y **3.190** en todo
  OBIS. La mediana de las 114 cifras del dataset son **141 registros**, y 9 están en cero: un número
  bajo puede significar sólo que ahí no se ha muestreado, y uno alto, que hay una campaña
  científica cerca.

Por eso el dataset **no publica mapas de distribución ni probabilidad de captura**: con estas
cifras, un mapa sería una mentira dibujada.

### Los recortes

Se pregunta a OBIS con **rectángulos en grados declarados en el propio fichero** (`recortes`), no
con la demarcación real del caladero. Un rectángulo no es un caladero: mete mar de más, y se dice en
`recortes[].advertencia`.

| Caladero | Rectángulos | Qué mete de más |
|---|---|---|
| `cantabrico-noroeste-y-golfo-de-cadiz` | Cantábrico · Noroeste gallego · Golfo de Cádiz | aguas francesas, el norte de Portugal, el Algarve oriental |
| `mediterraneo` | Alborán y Levante · Baleares y costa catalana | costa de Marruecos y Argelia, golfo de León |
| `canario` | Archipiélago canario | banco sahariano |

Los límites no son a ojo: están ajustados hasta que **cada recorte contiene los puertos de su
caladero y ninguno de otro** (153 puertos de `data/geo/ports.json`), y eso lo comprueba un gate
offline en cada ejecución de CI. No los hace exactos; impide el fallo que rompería la cifra, que es
que el recorte de un caladero se trague el litoral del de al lado.

Un caladero con dos fachadas se consulta con un **MULTIPOLYGON y en una sola petición**, porque los
recuentos de `datasets` y `species` **no son sumables**: medido con la dorada, el Cantábrico da 5
datasets y el golfo de Cádiz 3, y los dos juntos devuelven **5**, no 8.

## Las fotos (`fotos.json`, `fotos/v1`)

El segundo fichero de esta carpeta es **la foto de cada especie con su autor y su licencia**, y el
motivo por escrito de cada una que no la tiene. Lo genera `python run.py fotos` desde el catálogo de
aquí al lado y se commitea, como todo lo demás: regenerarlo necesita red y no corre en CI.

```
schema        "fotos/v1"
consultadoEn  el día en que se preguntó, arriba y a la vista
fotos{}       por clave de especie: fichero · url · descripcion · autor · licencia
              · licenciaCodigo · licenciaUrl (sólo si la licencia tiene condiciones)
              · identificadaPor{fuente, entidad, propiedad}
sinFoto{}     por clave de especie: motivo
```

`consultadoEn` está a la vista porque los metadatos **se congelan** el día de la ingesta: si mañana
en Commons le cambian la licencia a una foto, lo que dice este fichero es lo que la fuente decía ese
día, y la fecha es lo único que permite darse cuenta.

### La foto se coge por `P18`, no buscándola por el nombre

Buscar el nombre científico en Commons **funciona**, y ése es el problema: **devuelve siempre algo**.
Lo primero que sale puede ser un mapa de distribución, un grabado del XIX, un sello o directamente
otra especie. [`P18`](https://www.wikidata.org/wiki/Property:P18) es la imagen que alguien vinculó
**a mano** al ítem del taxón en Wikidata, así que la identificación es una decisión editorial
citable y con dueño en vez de una conjetura nuestra sobre una cadena de búsqueda. **Sin `P18`, no
hay foto**, y el hueco se rotula.

Llegar al ítem sigue siendo una búsqueda de texto, así que **se comprueba el destino**: se lee el
`P225` que el propio ítem declara —su nombre científico— y si no es aquel por el que se preguntaba,
no se publica nada. No es teórico: de los 81 taxones consultados, **3 llevan a otro sitio**. `Mugil`
lleva a `Q234014`, que declara ser *Mugil cephalus* —una especie concreta donde la norma regula el
género entero—; `Sepia` lleva a `Q286026`, que declara ser *Sapia*; y `Venus` lleva a `Q47652`, que
no declara ningún nombre científico porque no es un animal. Las tres habrían publicado una foto con
todos los campos bien puestos y el animal equivocado.

### El dominio público no tiene condiciones, así que no se le piden

`licenciaUrl` es el **único campo condicional** del contrato, y lo es porque exigirlo siempre resultó
ser un error de categoría que se pagó en cobertura y, peor, en motivos falsos. Medido el 2026-08-30
sobre los 26 ficheros que había detrás de los 23 huecos de entonces: **25 son `License = "pd"`,
`LicenseShortName = "Public domain"`, `Copyrighted = "False"` y sin `LicenseUrl`**. El dominio
público no tiene condiciones de reutilización, así que no hay ninguna URL de condiciones que
enlazar; y sin embargo **15 fichas publicaban «una imagen sin autor o sin licencia no se publica»**
de ficheros que publican las dos cosas. La regla, enmendada:

1. **`autor` y `licencia` siguen siendo obligatorios sin excepción.** Eso no se toca.
2. **`licenciaCodigo`** —el `License` legible por máquina de Commons (`cc-by-sa-4.0`, `pd`, `cc0`)—
   es obligatorio siempre. Existe para que la excepción sea **comprobable en el artefacto**: sin él,
   quien lea el JSON no puede distinguir «dominio público, no hay condiciones» de «se perdió la URL».
3. **`licenciaUrl` es condicional**: obligatoria y URL válida cuando la licencia tiene condiciones, y
   **ausente** —ni `""`, ni `null`, ni presente— cuando no las tiene. La ausencia obligatoria es a
   propósito: si en esa rama se admitiera una URL, sería el único sitio del dataset donde una URL
   rota no la comprobaría nadie.
4. Una licencia cuenta como sin condiciones **sólo si dos campos independientes de la fuente están
   de acuerdo**: `License` en un allowlist cerrado (hoy, `pd` y nada más) **y** `Copyrighted` a
   `"False"`. Un campo solo es una afirmación; dos que coinciden es una comprobación. Cualquier otra
   licencia sin URL sigue cayendo a `sinFoto`.
5. Lo que una foto de dominio público ofrece **en lugar** de la URL de condiciones es `descripcion`,
   la página del fichero en Commons, que ya es obligatoria: el lector siempre llega a la fuente.

### Ninguna especie se queda sin foto por no tener imagen: se quedan por los metadatos

Censo de la ingesta del **2026-08-31**, contado sobre lo publicado: **85 de las 86 especies publican
foto** y **1 publica el motivo de no tenerla**.

| Por qué no hay foto | Especies |
|---|---|
| WoRMS y Wikidata escriben ese nombre distinto (`Penaeus (Melicertus) kerathurus`) | 1 |

El único hueco no es «no hay foto»: es que las dos autoridades **no escriben igual el mismo nombre**.
WoRMS publica el subgénero entre paréntesis y el `P225` de Wikidata no, así que ningún ítem declara
esa forma exacta y la búsqueda de texto tampoco llega. Cerrarlo obligaría al módulo de fotos a
caminar la lista de sinónimos de WoRMS —o sea, a ampliarle la superficie de fuentes— y esa es una
decisión de diseño, no un descuido: mientras no se tome, el hueco publica su motivo.

**Ninguna cae por falta de `P18`**, ninguna cae ya por el dominio público, y **ninguna de las 63 que
se publicaban antes se ha perdido**. Los tres caminos que cerraron los ocho huecos anteriores son, en
orden de cuántos cierran:

1. **Preguntar por el nombre declarado, no buscarlo como texto.** `haswbstatement:"P225=<nombre>"`
   lleva al ítem que **declara** ese nombre científico; la búsqueda de texto llevaba a `Q234014`
   (que declara *Mugil cephalus*, no el género), a `Q286026` (que declara «Sapia») y a `Q47652` (que
   no es un animal).
2. **Publicar sin autor sólo cuando la fuente dice que no hace falta.** Son **3 ficheros**, los
   tres con `AttributionRequired = false` y `Copyrighted = False` en Commons. Con
   `AttributionRequired = true` y sin autor **no se publica jamás**: ahí quien lo impide es la
   licencia, no nosotros.
3. **Dos filas toman prestada la foto de una especie que nombra la propia norma** y lo dicen en la
   ficha: `Lophius spp.` y `Lophius piscatorius, L. Budegassa`. La elección la hace el BOE, no
   nosotros.

Y cuando dos ítems declaran el mismo nombre científico, la ambigüedad se deshace **con la fuente**:
primero descartando los que Wikidata marca como duplicados (`P31 = Q17362920`) y, si aún quedan
varios, quedándose con aquél en el que **coinciden los dos caminos** —el exacto y el de texto—.
Los dos fallan de maneras distintas, así que su concordancia es una comprobación y no una
preferencia. Si ninguna de las dos cosas deshace el empate, la fila cae con los ítems nombrados.

**Cambiaron de fichero 6 de las 63 fotos que ya se publicaban**, y no porque se tocara la elección de
imagen: en esos 6 taxones la **primera** `P18` que manda Wikidata era de dominio público y el
contrato viejo la rechazaba, así que se publicaba la segunda. Al dejar de rechazarla, se publica la
que la fuente pone primero, que es la regla que este módulo tenía escrita desde el principio. Son
`homarus-gammarus`, `octopus-vulgaris`, `pagrus-pagrus`, `salmo-salar`, `sardina-pilchardus` y
`scomber-japonicus`.

**Se miraron las seis, y no hay regla de desempate mejor que la de la fuente.** Los cambios van en
las dos direcciones: el pulpo gana —la lámina de Merculiano (1896) enseña ventosas, color y
disposición de brazos sobre blanco, y la anterior era una foto submarina turbia— y el salmón pierde
—antes un dibujo lateral limpio, ahora una foto entre algas—. Cualquier criterio que se añadiera
(«prefiere fotografías», «prefiere láminas») sería **nuestro gusto aplicado a 85 especies a partir de
dos ejemplos**, y es justo la conjetura que este módulo existe para no hacer. La única preferencia
que sí se añadió sale de un campo de la fuente y no de una opinión: entre candidatas igualmente
publicables, **gana la que acredita a su autor** (ver el hallazgo A-T23-1 del pase adversario).

### No existe «la licencia de las fotos»: son 8 en 85 ficheros

<!-- gate:licencias-de-fotos -->

| Licencia | Ficheros |
|---|---|
| `CC BY-SA 4.0` | 28 |
| `Public domain` | 24 |
| `CC BY 4.0` | 13 |
| `CC BY-SA 3.0` | 12 |
| `CC BY 3.0` | 5 |
| `CC BY 2.5` | 1 |
| `CC BY-SA 2.5` | 1 |
| `CC0` | 1 |

<!-- /gate:licencias-de-fotos -->

Esto **sí es un censo** de las 85 fotos publicadas, y lo recuenta un gate de la suite sobre el
propio `fotos.json`: si el dataset cambia y esta tabla no, se pone en rojo. (La tabla de seis
licencias en doce ficheros del plan de T-23 era **una muestra**, medida para saber si la variedad
existía; no decía cuántas hay de cada una, y no es la misma cosa.)

De ahí la consecuencia de diseño: **`autor`, `licencia`, `licenciaCodigo` y —cuando la hay—
`licenciaUrl` van dentro de cada entrada** y se muestran junto a su foto, nunca en un pie global. Un
pie que dijera «fotos de Wikimedia Commons» sería falso para las ocho a la vez, y no acreditaría a
ninguna de las **46 personas distintas** que firman estas 85 fotos. **61 de las 85 traen
`licenciaUrl`** y las otras 24 son de dominio público, que no la tiene; de esas 61, cinco la traen en
`http` —la forma que imprimen las plantillas viejas de Commons— y se publica tal cual: reescribirla
a `https` sería cambiar lo que la fuente dice sobre sus propias condiciones.

### La identificación es de Wikidata, y se cita

Cada foto publica `identificadaPor: { fuente: "Wikidata", entidad: "Q…", propiedad: "P18" }`. Quien
dude de que esa foto es de ese animal tiene el ítem exacto al que ir, y la respuesta no es nuestra.
De las **15 filas `spp`** —las que regulan un género entero— **10 publican foto**, y en 9 de las 10
el nombre del fichero nombra una especie concreta de ese género (`File:Alosa fallax.jpg` para `Alosa
spp`): lo que Wikidata identifica ahí es **el ítem del género**, así que la ficha tiene que decir
eso y no convertir la foto en la especie, que es la regla 2 de este catálogo.

### Lo que las fotos no hacen

1. **No se mirrorea Commons**: se guardan los metadatos y se enlaza el fichero, que sigue estando
   donde estaba y con su licencia.
2. **No se busca una foto por texto** cuando no hay `P18`. El hueco rotulado es barato y una foto
   equivocada es cara.
3. **No se publica ninguna imagen sin autor y sin licencia**, aunque exista y esté vinculada al
   taxón. Lo comprueba el **gate F2** sobre el artefacto, en cada ejecución de CI.

## Licencias, fuente por fuente

**BOE · RD 560/1995** (nombres, tallas y caladeros). Reutilización de la legislación (art. 13 de la
Ley 37/2007 y RD 1495/2011). *Solo el texto publicado en el BOE tiene carácter auténtico.* La
procedencia viaja por cifra dentro de cada talla; ver `data/normativa`.

**WoRMS · World Register of Marine Species** (`AphiaID`, nombre aceptado, estado y rango).
El texto de las páginas de WoRMS es **CC-BY**, y sus condiciones de uso dicen literalmente:
*«Re-distribution of the entire database is not permitted, unless by prior written agreement»*
(verificado el 2026-08-30 en <https://www.marinespecies.org/about.php?p=terms>).

De ahí sale la forma de esto: **es una extracción curada** de los 86 nombres que regula la norma
española, **no un mirror**, y cada especie publica en `taxon.cita` la cita que la propia fuente pide
para ese registro —que a menudo acredita a FishBase o a otra base albergada por WoRMS, no sólo a
WoRMS—. Quien reutilice este dataset hereda esa condición: **no se puede reconstruir la base de
WoRMS a partir de aquí, ni se pretende.**

**OBIS · Ocean Biodiversity Information System** (recuentos de presencia). Su política de datos dice
que *«Most OBIS data are available under a Creative Commons Attribution (CC BY 4.0) License»* y que
algunos datasets llevan CC BY-NC, CC BY-NC-ND o CC BY-SA, y que *«Users must cite the original data
sources and the OBIS database»* (<https://obis.org/data/datapolicy>, verificado el 2026-08-30).

Aquí **no se republica ni un registro de OBIS**: sólo recuentos —hechos sobre el índice, no los
datos de nadie—, así que los datasets de origen conservan su licencia y su atribución. La de OBIS
va en `fuentes.obis.atribucion`:

> OBIS (2026). Ocean Biodiversity Information System. Intergovernmental Oceanographic Commission of
> UNESCO. https://obis.org

**Wikidata · la identificación** (qué imagen corresponde a qué taxón). Los datos estructurados de
Wikidata están bajo [CC0](https://www.wikidata.org/wiki/Wikidata:Copyright), o sea que la vinculación
`P18` no impone condiciones; se cita igualmente **ítem a ítem** en `identificadaPor`, porque la
decisión de que esa foto es de ese animal no es nuestra y quien lea la ficha tiene derecho a saber
de quién es.

**Wikimedia Commons · las fotos**. Aquí **no hay una licencia**: son siete distintas en 63 ficheros
(ver arriba) y cada foto viaja con la suya, con su autor y con el enlace a sus condiciones, tal y
como los devuelve el `extmetadata` de Commons el día de la ingesta. Commons **no se mirrorea**: se
enlaza el fichero. Quien reutilice `fotos.json` hereda la licencia **de cada imagen**, no una común,
y las condiciones de casi todas incluyen acreditar a su autor.

## Lo que este dataset no hace

1. No trae hábitat, profundidad ni talla máxima (eso es otra trayectoria). La foto de cada especie
   sí está, en `fotos.json`, y con su licencia por fichero.
2. No publica mapas de distribución ni abundancia. Ver arriba.
3. No mirrorea WoRMS ni OBIS.
4. No inventa una especie donde la norma dice género.
5. No corrige el nombre del BOE, ni siquiera cuando está mal escrito: lo mapea firmando el mapeo.
