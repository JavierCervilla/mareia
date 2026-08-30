# T-20 — El nombre que dice la ley y el taxón que dice la ciencia, y la distancia entre los dos

**Trayectoria**: `cmtg3rr4n004ibo7ynhavbswq` · hija de la épica del módulo de especies
(`cmtejril4009ilkc2cc0pvlsg`) · **Proyecto**: Mareia (`cmtc83g5n000pvv7zga2az24g`)

**Qué entrega**: un catálogo de las **86 especies que el BOE regula**, en `/pesca/especies/`, con el
nombre legal tal cual lo escribe la norma, el taxón aceptado hoy, en qué caladeros está regulada y
qué presencia tiene registrada. **Sin ficha individual**: eso es T-23.

**Por qué existe**: T-19 nos regaló el catálogo sin ninguna decisión editorial —las especies son las
que la norma nombra, ni una más—. Lo que falta es poder mirarlas juntas.

---

## Lo que sale de medir las fuentes, y define la trayectoria entera

### 1. El BOE nombra en una nomenclatura que la ciencia ya movió

Resueltos los 86 nombres científicos contra WoRMS: **64 resuelven, 22 no**. Y de los 64, **10
resuelven a un nombre distinto del que usa la norma**:

| Nombre en el BOE | Estado en WoRMS | Nombre aceptado hoy |
|---|---|---|
| `Solea vulgaris` | unaccepted | **Solea solea** |
| `Psetta maxima` | unaccepted | **Scophthalmus maximus** |
| `Sparus auratus` | *misspelling* | **Sparus aurata** |
| `Merlangus merlangus` | unaccepted | **Merlangius merlangus** |
| `Engraulis encrasicholus` | unaccepted | **Engraulis encrasicolus** |
| `Mugil auratus` | unaccepted | **Chelon auratus** |
| `Dentex filosus` | unaccepted | **Dentex gibbosus** |
| `Dentex macrophtalmus` | unaccepted | **Dentex macrophthalmus** |
| `Dicologoglossa cuneata` | unaccepted | **Dicologlossa cuneata** |
| `Trisopterus minutus capelanus` | unaccepted | **Trisopterus capelanus** |

**Esto no es un error del BOE que haya que arreglar: es que la norma es de 1995 y la taxonomía se
mueve.** El nombre de la norma es el que tiene consecuencia legal; el aceptado es el que sirve para
buscar la especie en cualquier otra base. **Se publican los dos, cada uno con su fuente**, y jamás
se sustituye el legal por el científico.

### 2. Los 22 que no resuelven son de dos clases muy distintas, y se tratan distinto

**(a) Quince filas son un GÉNERO, no una especie** —**catorce géneros distintos**— y la norma
regula el género entero:

`Alosa spp` · `Diplodus spp` · `Epinephelus spp` · `Lepidorhombus spp` · `Lophius spp` · `Mugil spp`
· `Mullus spp` · `Pagellus spp` · `Pecten spp` · `Scomber spp` · `Sepia spp` · `Trachurus spp` ·
`Venerupis spp` · `Venus spp` (y `Mugil spps`, con la errata de la propia norma).

**No se les elige una especie.** Que la talla mínima aplique a todo el género es un hecho jurídico, y
convertirlo en una especie concreta sería inventar un alcance que la norma no tiene. Se resuelven **al
género** en WoRMS y se rotulan como lo que son.

**(b) Siete son erratas o grafías viejas del propio BOE**:

| En el BOE | Casi con seguridad | Qué pasa |
|---|---|---|
| `Cáncer pagurus` | `Cancer pagurus` | tilde que el latín no lleva |
| `Melanogrammús aeglefinus` | `Melanogrammus aeglefinus` | ídem |
| `Gliptocephalus cynoglossus` | `Glyptocephalus cynoglossus` | i/y |
| `Microstommus kitt` | `Microstomus kitt` | doble m |
| `Panaeux kerathurus` | `Penaeus kerathurus` | |
| `Thunnus aibacares` | `Thunnus albacares` | l→i |
| `Lophius piscatorius, L. Budegassa` | dos especies en una celda | |

Aquí está **la decisión con más filo de la trayectoria**. T-19 estableció que no se corrige por
inferencia una cifra legal (el `1 1` de la boga sigue publicándose ilegible). Un **nombre** no es una
cifra —corregirlo no cambia ninguna consecuencia— pero **la correspondencia sigue siendo nuestra, no
del BOE**. Así que: se publica el nombre del BOE tal cual, y **si mapeamos, el mapeo va declarado
como nuestro**, con el `AphiaID` al que apunta y la advertencia de que la norma no dice eso. Un mapeo
sin dueño es lo mismo que una cifra inventada.

### 3. OBIS mide esfuerzo de muestreo, no abundancia — y la cifra lo grita

Medido hoy: la **dorada en toda la costa gallega** son **12 registros**, de 3 datasets, entre 2014 y
2025. La misma especie en el conjunto de OBIS pasa de 18.000. Nadie que conozca la ría de Arousa
diría que allí hay doce doradas.

**Por eso la presencia se publica como lo que es**: número de registros, número de datasets y rango
de años, **con el sesgo dicho en la misma frase**, y **nunca** como abundancia, como probabilidad de
captura ni como mapa. Es el mismo criterio con el que `rmse_m` se publica como cota y no como
precisión.

---

## Think Before Coding

### Tres asunciones
1. **WoRMS seguirá devolviendo `status` y `valid_AphiaID`.** Verificado hoy. Ojo: cuando no encuentra
   responde **HTTP 204 sin cuerpo**, no 404 — un cliente que mire solo 200/404 y haga `.json()` del
   cuerpo vacío revienta.
2. **El catálogo lo fija el BOE**, así que crece o mengua solo cuando cambie la norma, y de eso ya
   avisa el gate G2 de T-19.
3. **OBIS acepta consulta por nombre y geometría** y devuelve `records`, `datasets` y `yearrange`.

### Dos tradeoffs
- **Publicar los dos nombres frente a publicar uno.** Dos nombres es más ruido en la página y obliga
  a explicar por qué difieren. **Se acepta**: elegir uno obliga a decidir entre mentir sobre la ley o
  mentir sobre la taxonomía.
- **Presencia por caladero con caja envolvente declarada, frente a demarcación marina real.** La caja
  no es la costa y mete mar de más. **Se acepta y se dice**: la alternativa era una fuente de
  geometría más para un dato que ya publicamos como pobre. Publicar un dato pobre con su método
  visible es honrado; afinarle el método sin afinar el dato es maquillaje.

---

## Entregables

1. **Ingesta** `sources/worms.py` — resuelve los 86 contra WoRMS. **Trata el 204 como «no
   encontrado», no como error**, y distingue las tres salidas: aceptado, sinónimo con nombre válido,
   y no encontrado. Cachea: la API es de un tercero y no se le machaca en cada build.
2. **Ingesta** `sources/obis.py` — presencia por caladero con caja envolvente **declarada en el
   dataset**, no escondida en el código.
3. **Dataset** `data/especies/catalogo.json` (`especies/v1`): por especie, el nombre del BOE, el
   nombre común, el `AphiaID` y el nombre aceptado **con su estado**, el rango taxonómico (especie o
   **género**), los caladeros que la regulan con su talla, la presencia OBIS con su sesgo, y **el
   origen de cada campo**.
4. **Módulo `species`** — amplía `ModuleId` por tercera vez. Su sección en la página de puerto es
   **un enlace al catálogo filtrado por el caladero de ese puerto**, no una segunda tabla: la tabla
   de tallas ya la pone `regulations` y dos superficies del mismo dato se desincronizan.
5. **Índice** `/pesca/especies/` — las 86, con filtro por caladero **sin JavaScript** (el patrón de
   radios ocultos que ya usa el portal). Ruta decidida por el humano.
6. **Gates**:
   - **E1 · nadie sustituye al BOE**: el nombre legal aparece literal en todas las fichas del índice;
     si en alguna solo está el aceptado, rojo.
   - **E2 · el mapeo tiene dueño**: toda correspondencia que no venga de WoRMS va marcada como
     nuestra, con su motivo. Un mapeo sin dueño, rojo.
   - **E3 · el género no se convierte en especie**: las 15 filas `spp` (14 géneros distintos, porque
     `Mugil` sale dos veces) publican rango género y ninguna nombra una especie concreta.
   - **E4 · la presencia no se lee como abundancia**: ninguna página publica un número de registros
     sin su frase de sesgo al lado.
   Los cuatro, **medidos sobre el artefacto** y **probados en rojo**.
7. `data/especies/README.md` con licencia por fuente (**WoRMS CC-BY, y prohibido mirrorear la base
   entera**; OBIS con su atribución), `ROADMAP.md` y `CHANGELOG.md`.

## Lo que NO hace
1. **No hace la ficha individual** (`/pesca/especies/<slug>/`): es T-23.
2. **No trae FishBase** (hábitat, profundidad): entra con las observaciones, T-22.
3. **No publica fotos.** T-23, con su licencia por fichero.
4. **No publica mapas de distribución** — con 12 registros de dorada en Galicia, un mapa es una
   mentira dibujada.
5. **No mirrorea WoRMS ni OBIS.** Extracción curada con atribución.
6. **No inventa una especie donde la norma dice género.**

## Definition of Done
Suite verde con **el comando de CI**, E1–E4 probados en rojo, ROADMAP y CHANGELOG en el PR, pase de
`verificador` y de **`qa-adversario`** con sus trinquetes, CI en verde. Y la condición que T-19 dejó
escrita: **el ledger sin hallazgos que hagan mentir a la página**, no el color de CI.
