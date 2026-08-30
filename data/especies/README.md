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

Censo de la última generación: **86 especies**, **85 resueltas** en WoRMS (68 especies, 15 géneros,
1 familia —`Palinuridae`— y 1 subespecie) y **1 sin resolver**; **118 filas** del real decreto
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

## Lo que este dataset no hace

1. No trae ficha individual de especie (hábitat, profundidad, fotos): eso es otra trayectoria.
2. No publica mapas de distribución ni abundancia. Ver arriba.
3. No mirrorea WoRMS ni OBIS.
4. No inventa una especie donde la norma dice género.
5. No corrige el nombre del BOE, ni siquiera cuando está mal escrito: lo mapea firmando el mapeo.
