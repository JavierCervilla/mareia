# data/normativa

Tallas mínimas de captura por caladero, tal y como las dice la norma. Un solo fichero,
[`tallas-minimas.json`](tallas-minimas.json) (schema `normativa/v1`), generado por
[`data/pipeline`](../pipeline) con `python run.py normativa` y commiteado: quien clona el repo tiene
el dataset sin ejecutar nada ni pedirle nada al BOE.

**Fuente**: Real Decreto 560/1995, de 7 de abril, por el que se establecen las tallas mínimas de
determinadas especies pesqueras — **texto consolidado** `BOE-A-1995-8639`, ELI
<https://www.boe.es/eli/es/rd/1995/04/07/560>. La redacción que se publica aquí es la que entró en
vigor el **2025-11-02** por el Real Decreto 936/2025, de 21 de octubre (`BOE-A-2025-22024`).

> ⚠️ **Solo el texto publicado en el BOE tiene carácter auténtico.** Esto es un derivado para
> consulta. Antes de tomar una decisión con consecuencias —quedarse una pieza, no quedársela— la
> referencia es el enlace ELI, no esta tabla.

## Licencia

Reutilización de la legislación: art. 13 de la Ley 37/2007 y RD 1495/2011, que permiten reutilizar
los textos legales publicados en el BOE. La declaración viaja **dentro del propio dataset**
(`fuente.licencia`, `fuente.licenciaUrl` y `fuente.aviso`), no sólo en este README: la atribución
tiene que acompañar al dato allá donde vaya, que es la misma regla que en
[`../stations`](../stations/README.md).

## Qué mirar dentro del fichero

| Campo | Qué cuenta |
|---|---|
| `fuente` | La norma, su ELI, su licencia, el aviso de autenticidad y `verificadoEn` |
| `fuente.verificadoEn` | El día en que **una máquina** comprobó contra el BOE que la norma sigue en vigor. Ver G2 |
| `caladeros[].bloque` / `fechaVigencia` | El bloque del texto consolidado y la fecha en la que su redacción entró en vigor |
| `caladeros[].normaModificadora` | La norma que dio esa redacción (`BOE-A-2025-22024`) |
| `caladeros[].notas` | Las notas al pie de esa versión, con su marca (`(*)`, `(**)`, `(***)`) |
| `especies[].talla` | La talla, en una **unión cerrada** de cinco clases (abajo) |
| `especies[].textoOriginal` | El literal de la celda del BOE, **siempre**, en las cinco clases |
| `especies[].notas` | Las marcas que le aplican: nunca se pinta la cifra sin ellas |
| `especies[].procedencia` | `bloque`, `fechaVigencia` y `eli` de **esa** cifra (gate G1) |

## `talla` es una unión, no un número

La columna se titula «Talla (en cm)» y no contiene sólo tallas en cm. De las **118** tallas
publicadas, **17** no son un entero de centímetros:

| Clase | Qué es | Ejemplo medido | Cuántas |
|---|---|---|---|
| `longitud_cm` | Longitud en centímetros; admite decimal con coma | `36`, `3,7`, `2,5`, `8,5` | 101 |
| `peso_kg` | La norma fija peso, no longitud | `6,4 kg` (atún rojo), `1 kg` (pulpo) | 9 |
| `longitud_o_peso` | Cualquiera de las dos | `80 cm o 10 kg de peso` | 1 |
| `por_determinar` | La norma **declara** que no la ha fijado | `(*)` en anguila, buey, calamar, faneca, jibias y rape | 6 |
| `sin_dato_legible` | La celda no se puede leer como talla y **no se arregla** | `1 1` en la boga del Anexo I | 1 |

Normalizarlo todo a un número daría una tabla más bonita y mentiría en 17 celdas. Se paga en que la
interfaz tiene que saber pintar cinco formas distintas; es el mismo criterio con el que
`quality.rmse_m` se publica como cota superior y no como «precisión».

**El `1 1` no se corrige.** El BOE imprime `1 1` donde casi con seguridad quiso decir `11`.
Corregir por inferencia una cifra legal es inventarla, así que se publica el literal, con el motivo
a la vista y el enlace al texto auténtico. Hay un recorrido en `tests/test_boe_dataset.py` cuya
única función es que nadie lo «arregle» sin darse cuenta.

### Las notas viajan pegadas a la cifra

Tres de las cifras publicadas tienen una excepción que las cambia para puertos concretos de este
portal:

- **`(***)` Anexo I** — la lubina son 36 cm **salvo en las divisiones 8a y 8b del CIEM**, donde son
  44. Esas divisiones son el golfo de Vizcaya: los puertos cantábricos de aquí.
- **`(**)` Anexo I** — el boquerón son 12 cm salvo en la división IX a) —golfo de Cádiz y Atlántico
  ibérico—, donde son 10.
- **`(*)` Anexo II** — la talla del pulpo **no se aplica** en aguas interiores y plataforma
  continental de Illes Balears. Son 17 puertos del catálogo.

**No se resuelven por puerto**, y es una decisión de alcance: resolverlas exige saber en qué
división CIEM cae cada dársena, o sea geometría, y asignar mal una división da un número seguro y
falso. Así que la nota viaja pegada a la cifra y se renderiza junto a ella, siempre. Una excepción
visible es honrada; un número seguro y equivocado, no.

### Especies que se miden de varias formas

El BOE escribe `Cigala (entera) (Nephrops norvegicus):` sin cifra y cuelga de esa cabecera dos
filas: `Longitud cefalotórax` (2) y `Longitud total` (7). Igual con el bogavante del Anexo II.

**Decisión**: se publican como **filas hijas con su rótulo** —una entrada por medida, con el nombre
de la cabecera y un campo `medida`—, y la cabecera **no** se publica. La alternativa era una especie
con un array de medidas; se descartó porque cambiaba la forma de `talla`/`textoOriginal` para todas
las demás. Lo que no se hace en ningún caso es publicar la cabecera como una especie a la que le
falta la talla: no le falta, la llevan sus hijas.

Son cinco filas hijas: cigala (×2) en el Anexo I, bogavante y cigala (×2) en el Anexo II.

### Cuando un nombre no está, se dice por qué

`nombreCientificoAusente` y `nombreLocalCanarioAusente` llevan el motivo en vez de un hueco mudo.
Pasa en `Cigalas (colas)` —el paréntesis es una aclaración en castellano, no un binomio latino— y en
tres filas del Anexo III donde la norma deja vacía la celda de nombre local. Inventarlos sería
relleno; omitirlos, esconder que la fuente no lo da.

## `caladero` en `../geo/ports.json`

Cada puerto declara a cuál de los tres caladeros pertenece, porque la tabla que le toca depende de
eso: `cantabrico-noroeste-y-golfo-de-cadiz` (Anexo I, 47 puertos) · `mediterraneo` (Anexo II, 80) ·
`canario` (Anexo III, 26). El campo lo **genera** el pipeline (`normativa.caladero_de_puerto`) en
cada `make build`, no está tecleado: `ports.json` se reescribe entero y un campo a mano duraría una
ejecución.

Sale de la provincia en 141 de los 153 puertos. Los otros doce se curan uno a uno, porque **Cádiz es
la única provincia española que cruza el límite entre dos caladeros** —Punta Marroquí, en Tarifa—:

| Puerto | lon | Caladero | Por qué |
|---|---|---|---|
| Sanlúcar de Barrameda | −6,336 | golfo de Cádiz (Anexo I) | desembocadura del Guadalquivir |
| Chipiona | −6,430 | golfo de Cádiz (Anexo I) | al oeste de Punta Marroquí |
| Rota | −6,354 | golfo de Cádiz (Anexo I) | al oeste de Punta Marroquí |
| Cádiz | −6,280 | golfo de Cádiz (Anexo I) | al oeste de Punta Marroquí |
| Chiclana de la Frontera | −6,209 | golfo de Cádiz (Anexo I) | al oeste de Punta Marroquí |
| Conil de la Frontera | −6,137 | golfo de Cádiz (Anexo I) | al oeste de Punta Marroquí |
| Barbate | −5,931 | golfo de Cádiz (Anexo I) | al oeste de Punta Marroquí |
| **Tarifa** | **−5,606** | **golfo de Cádiz (Anexo I)** | **Está _sobre_ el límite: es el caso frontera.** Punta Marroquí es el punto en el que la norma separa los dos caladeros, y la flota de Tarifa faena a los dos lados. Ninguna asignación es limpia; se resuelve al Atlántico —el puerto y la playa de los Lances quedan al oeste del cabo— y se dice aquí que es una decisión, no un dato |
| Algeciras | −5,442 | mediterráneo (Anexo II) | bahía de Algeciras, al este de Punta Marroquí |
| San Roque | −5,272 | mediterráneo (Anexo II) | bahía de Algeciras, al este de Punta Marroquí |
| La Línea de la Concepción | −5,357 | mediterráneo (Anexo II) | bahía de Algeciras, al este de Punta Marroquí |
| **Sevilla** | −5,994 | golfo de Cádiz (Anexo I) | Puerto **fluvial**: está 80 km Guadalquivir arriba, en el tramo mareal —por eso tiene marea y por eso está en el catálogo—. Su caladero es el del estuario al que sale |

Los doce, por su `slug` en el catálogo: `sanlucar-de-barrameda`, `chipiona`, `rota`, `cadiz`,
`chiclana-de-la-frontera`, `conil-de-la-frontera`, `barbate`, `tarifa`, `algeciras`, `san-roque`,
`la-linea-de-la-concepcion` y `seville` —el catálogo lo nombra en inglés porque el topónimo viene
del volcado de GeoNames, y renombrarlo cambiaría una URL pública—. La lista se comprueba contra este
README en `tests/test_boe_caladeros.py`: una curación que no esté documentada aquí pone el gate en
rojo, porque una decisión editorial sin motivo publicado es una opinión que nadie puede revisar.

El resto sale entero de la provincia: Ceuta y Melilla al Mediterráneo; Málaga, Granada y Almería al
Mediterráneo; Huelva, Galicia y toda la cornisa cantábrica al Anexo I; Cataluña, Comunitat
Valenciana, Región de Murcia y Illes Balears al Anexo II; Las Palmas y Santa Cruz de Tenerife al
Anexo III.

Si mañana el catálogo trae un puerto de una provincia sin caladero asignado, `make build`
**levanta** en vez de elegir uno: un puerto con el caladero equivocado publica la tabla de otro mar,
y eso se lee igual de bien que la correcta.

## Los tres gates

| Gate | Dónde | Qué mide |
|---|---|---|
| **G1 · procedencia** | `python run.py check` (CI, sin red) + `tests/test_boe_dataset.py` | Cada cifra **declara** su `(bloque, fechaVigencia, eli)`, y esa declaración tiene que coincidir con la del caladero. Obliga a declarar en vez de sólo prohibir la ausencia: una prohibición se satisface callando. También cierra la unión de `talla` — ni un tipo inventado ni un campo de más |
| **G2 · vigencia** | `.github/workflows/normativa-vigencia.yml`, diario a las 03:50 UTC | Re-consulta el BOE y compara `fecha_actualizacion` de la norma y de los tres bloques, más `estatus_derogacion` y `vigencia_agotada` |
| **G3 · trinquete** | `python run.py check` + `tests/test_boe_dataset.py` | Fija las **seis** especies canarias que movió el RD 936/2025 y falla si al dataset llega la cifra de 1995 |

**G2 tiene tres desenlaces y tres colores, y esa es la pieza que lo hace sostenible**:

- **verde** — nada ha cambiado. Se escribe `fuente.verificadoEn` y se commitea. **Es el único sitio
  desde el que se escribe esa fecha**: dice «alguien lo comprobó ese día», y tecleada a mano no
  diría nada.
- **rojo** — la norma está derogada o el texto consolidado ha cambiado. Además de poner el job en
  rojo, deja una acción crítica en el dashboard del enjambre.
- **ámbar** — no se ha podido preguntar (red, BOE caído). `verificadoEn` **no se toca**, el sello
  envejece y la sección degrada sola. Confundir este caso con el anterior significa romper el
  despliegue cada vez que el BOE tenga un mal día, que es como se consigue que un gate acabe
  desactivado.

**G3 mide el JSON publicado, no la función del parser.** Un trinquete que mide una copia del
instrumento deja de morder en cuanto el instrumento cambia — lección pagada en T-13. Las seis
especies y el error que evitan:

| Especie canaria | 1995 (derogada) | Vigente 2025 | Si se publicara la vieja |
|---|---|---|---|
| Aligote (*Pagellus acarne*) | 12 | **20** | te multan |
| Cabrilla (*Serranus cabrilla*) | 15 | **19** | te multan |
| Cachucho (*Dentex macrophtalmus*) | 18 | **22** | te multan |
| Chopa (*Spondyliosoma cantharus*) | 19 | **23** | te multan |
| Serrano imperial (*Serranus atricauda*) | 15 | **20** | te multan |
| Pargo (*Pagrus pagrus*) | 33 | 28 | conservador |

Cinco de seis caen del lado que le cuesta una sanción a quien se fíe. Por eso el parser selecciona
la versión en vigor por `fecha_vigencia` y **aborta** si el bloque no trae ninguna `<version>`, en
lugar de caer hacia atrás a «leer el bloque entero»: ese apaño mezclaría las tres redacciones que el
texto consolidado guarda apiladas dentro del mismo bloque.

## Lo que este dataset **no** publica

1. **Vedas y cupos.** No hay fuente estructurada: el art. 5 del RD 347/2011 sólo habilita al
   Ministerio a fijarlos por orden.
2. **Zonas de pesca.** No existe la fuente.
3. **Normativa autonómica.** Es otra trayectoria, y va después.
4. **Las notas resueltas por puerto.** Exigen división CIEM; ver arriba.
