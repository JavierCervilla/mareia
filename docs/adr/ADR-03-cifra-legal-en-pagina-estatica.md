# ADR-03 — Cómo entra un dato que no caduca pero se deroga

- **Trayectoria**: T-19 (`tallas-minimas-boe`)
- **Estado**: aceptada
- **Fecha**: 2026-08-30
- **Decide**: cómo llega a la página de puerto una **cifra legal** —la talla mínima de captura del
  RD 560/1995— cuando el core del portal es SSG, cuando el dato no envejece con el reloj y cuando
  equivocarse le cuesta una sanción a quien se fía.

## Contexto

ADR-01 decidió cómo entra el estado del mar: un dato que **caduca en horas**, con TTL de 30 min a
6 h, en una página que se construye una vez al día. La respuesta fue una isla hidratada, y la mitad
de la decisión era que *la inyección en build no puede sellar su propio dato*: un HTML que dice
«consultado hace 4 minutos» sigue diciéndolo veinte horas después.

Las tallas mínimas rompen esa forma por el otro lado. **No caducan con el reloj.** El RD 560/1995
lleva treinta años en vigor; su redacción actual entró el 2 de noviembre de 2025 y la anterior duró
casi diez años. Un HTML de ayer publica exactamente las mismas cifras que uno de hoy, y lo seguirá
haciendo dentro de un año — hasta el día en que no, porque una norma no envejece: **se deroga o se
modifica**, de golpe y por otra norma.

Y el error es **asimétrico**, que es lo que hace que esta decisión no sea la misma que la de ADR-01
con otro TTL:

- Publicar una talla **menor** que la vigente le cuesta una **multa** a quien se queda la pieza.
- Publicar una talla **mayor** le cuesta un pez.

Está medido, no supuesto: el texto consolidado del BOE conserva las tres redacciones históricas
apiladas dentro del mismo bloque, y un parser que leyera el bloque entero en vez de la versión en
vigor publicaría en el caladero canario seis cifras equivocadas, **cinco de ellas del lado que
multa** (aligote 12 en vez de 20, cabrilla 15 en vez de 19, cachucho 18 en vez de 22, chopa 19 en
vez de 23, serrano imperial 15 en vez de 20; solo el pargo, 33 en vez de 28, cae del lado
conservador).

Las opciones sobre la mesa eran las mismas dos de ADR-01, con una tercera que aquí sí tenía sentido:

1. **Inyección en build** — leer el dataset commiteado al generar el HTML y hornear la tabla dentro.
2. **Isla hidratada** — pedir la normativa al API desde el navegador, como la meteo.
3. **No publicarla** — enlazar al BOE y no repetir la cifra.

## Decisión

**Inyección en build**, con tres condiciones que son la mitad de la decisión:

1. **La página publica el sello de la comprobación, no la de la lectura.** Lo que se imprime no es
   «esta cifra es correcta» sino «el *2026-08-30* una máquina comprobó contra el BOE que esta norma
   sigue en vigor y que su texto no ha cambiado». Ese sello (`fuente.verificadoEn`) lo escribe **solo
   el gate G2**, en su día verde, y nunca la mano ni el reloj del build.
2. **La cifra viaja con su procedencia y con su literal.** Cada talla declara `(bloque,
   fechaVigencia, eli)` —gate G1— y arrastra `textoOriginal`, la celda tal y como la imprime el BOE.
   La página los publica los dos: la fecha en la que esa redacción entró en vigor y el literal al
   lado de lo que hemos escrito nosotros.
3. **Ninguna cifra se publica sin su excepción**, y la excepción va **pegada a ella**, no en un pie.

## Por qué, y qué se pierde

El argumento decisivo es el simétrico del de ADR-01. Allí, *la inyección no puede sellar su propio
dato*; aquí, **la isla no tendría nada que sellar**. Una talla mínima no tiene antigüedad relevante:
saber que se pidió al API hace cuatro minutos no dice absolutamente nada sobre si la norma sigue
viva, porque una norma no se degrada, se sustituye. Pagar JavaScript de cliente, una dependencia del
API en tiempo de lectura y un estado de carga a cambio de una frescura que no informa de nada sería
comprar el coste de ADR-01 sin su beneficio.

Y hay un argumento de servicio que en ADR-01 iba en contra y aquí va a favor: el entorno de uso que
manda el design brief es un teléfono en la orilla, a menudo **sin cobertura**. Es exactamente cuando
alguien tiene la pieza en la mano y necesita el número. Una isla dejaría la sección vacía justo ahí.

La tercera opción —no publicarla— se descarta porque el BOE consolidado en un móvil al sol no es una
respuesta: son tres anexos, tres redacciones apiladas por bloque y una columna titulada «Talla (en
cm)» que en 17 de sus 118 celdas no contiene centímetros. Si no lo hace esta página, lo hace de
memoria quien está en la roca.

### Lo que se paga, medido

- **La tabla envejece en silencio si el rebuild se para.** Es el riesgo real de esta decisión y no
  se disimula: se acota con el **rebuild diario** y con **G2**, que corre antes y tiene *tres*
  desenlaces —verde escribe `verificadoEn`; rojo (derogada o texto cambiado) rompe CI y deja acción
  crítica; **ámbar** (no se pudo preguntar) **no toca la fecha**, el sello envejece a la vista y la
  página degrada sola—. Confundir el ámbar con el rojo es como se consigue que un gate acabe
  desactivado el primer día que el BOE tenga un mal día.
- **Bytes.** La página de puerto pasa de **29.167 a 46.580 B** en el Anexo I (+60 %; comprimida, de
  **8.598 a 11.664 B**, +36 %), de 29.925 a 41.461 B en el Mediterráneo (+39 %) y de 30.733 a
  42.550 B en el canario (+38 %). La hoja de estilos suma **1.287 B** al bundle común (17.384 →
  18.671, +7,4 %). El Anexo I es el que más crece porque tiene 53 filas **y** las tres notas del
  caladero repetidas en las suyas. Se paga en texto, que es lo que gzip hace mejor: el 60 % crudo se
  queda en 36 % comprimido.
- **Ni un byte de JavaScript.** La sección conserva el cero-JS del core, al revés que la de meteo.

### La nota va pegada a la cifra, y esa es la parte cara

Tres de las cifras publicadas tienen una excepción que **las cambia para puertos concretos de este
portal**:

| Nota | Qué dice | A quién afecta aquí |
|---|---|---|
| `(***)` Anexo I | la lubina son 36 cm salvo en las divisiones 8a y 8b del CIEM, donde son **44** | las 8a/8b son el golfo de Vizcaya: los puertos cantábricos |
| `(**)` Anexo I | el boquerón son 12 cm salvo en la división IX a), donde son **10** | golfo de Cádiz y Atlántico ibérico |
| `(*)` Anexo II | la talla del pulpo **no se aplica** en aguas interiores de Illes Balears | **17** puertos del catálogo |

**No se resuelven por puerto**, y es una decisión de alcance: resolverlas exige saber en qué división
CIEM cae cada dársena —geometría, que T-19 no hace— y asignar mal una división da un número **seguro
y falso**, que es peor que una excepción visible. Así que la nota viaja pegada a la cifra y se
renderiza junto a ella, **siempre**, en la misma celda.

Y se renderiza **entera**, no como marca. Una marca (`36 (***)`) es una promesa de nota que hay que
ir a buscar al pie, y en un móvil al sol nadie la busca: publicaría «36» a secas en Bilbao, donde
son 44, con aspecto de dato anotado. El precio es repetición —la nota `(*)` sale seis veces en el
Anexo I— y se acepta.

### La ausencia también es una cifra legal

La columna se titula «Talla (en cm)» y no contiene solo tallas en cm: de las **118** publicadas,
**17** no son un entero de centímetros. Modelarlas como `number` obligaría a inventarse un número en
17 celdas, así que `talla` es una **unión cerrada de cinco clases** y cada una se escribe como lo que
es:

| Clase | Cómo se publica | Cuántas |
|---|---|---|
| `longitud_cm` | `36 cm`, `3,7 cm` (los decimales que tenga, ni uno más) | 101 |
| `peso_kg` | `6,4 kg **de peso**` — porque la columna dice «en cm» y esta fila no es una talla | 9 |
| `longitud_o_peso` | `80 cm o 10 kg de peso` | 1 |
| `por_determinar` | «**La norma no fija talla**», con la nota que lo dice | 6 |
| `sin_dato_legible` | «La norma no imprime una talla legible», con el literal `1 1` a la vista | 1 |

El `switch` que las escribe **no tiene `default`** y cierra con `never`: la rama que pintaría un
«por determinar» como si fuera un número no existe, y una sexta clase en el dataset no compilaría
hasta que alguien decidiese cómo se escribe.

**El `1 1` de la boga no se corrige.** El BOE imprime `1 1` donde casi con seguridad quiso decir
`11`. Corregir por inferencia una cifra legal es inventarla, así que se publica el literal, con el
motivo a la vista y el enlace al texto auténtico.

### Y no se adorna

Cero *juice* sobre estas cifras: ni barra, ni estrella, ni rareza, ni contador, ni orden por «mejores
especies», ni la mancha de terracota sobre ningún número. No es una preferencia estética heredada del
design brief §3: **el adorno consigue que se le crea al número más de lo que merece**, y lo que
merece está escrito encima, con la fecha en la que se comprobó. Lo único con color de la sección son
sus dos avisos, y ninguno cae sobre una cifra.

### Sin cobertura se muestra, y lo dice

El módulo declara `offline: cache-first`: sin red la tabla **se sigue leyendo**. Es una decisión del
humano **contra la recomendación del arquitecto**, que proponía ocultarla por lo mismo que la hace
valiosa —una copia guardada no puede saber si la norma que enseña sigue viva—. Se aceptó el riesgo
porque ocultarla la haría inútil justo el día que sirve.

El precio se paga en la página y no se disimula. La sección **no tiene JavaScript** con el que
enterarse de si hay red, así que el aviso no se enciende: **está siempre escrito**, y redactado para
ser verdad en los dos casos —«puedes estar viendo una copia de hace semanas: la fecha de comprobación
de arriba es la del día en que se guardó, no la de hoy … Una talla derogada se lee igual de bien que
la vigente»—. Es la única forma honrada de sostener «se muestra sin red»: si la copia guardada no
puede decir que es una copia guardada, el sello se lee como si fuese de hoy.

## Consecuencias comprobables

- **Ninguna especie con nota se publica sin el texto de su nota, en su propia fila.** El gate busca
  la fila de cada especie en las **153** páginas construidas y exige la nota **entera dentro de esa
  fila**: 8 especies del Anexo I × 47 puertos + el pulpo del Anexo II × 80 = **456 comprobaciones**.
  Probado en rojo dejando en la fila solo la marca `(***)`: las 456 salieron listadas con su puerto y
  su especie. Un gate que exigiera «la fila menciona la nota» habría pasado.
- **Las cinco clases de talla están en el fichero publicado, y en las cantidades censadas**
  (101/9/6/1/1). Si una dejara de aparecer, su rama se quedaría sin cobertura sin que nada se pusiera
  rojo.
- **Los 153 puertos resuelven su caladero** (47 · 80 · 26). Un puerto sin caladero, o con uno que la
  norma no publica, **levanta nombrándose**: publicar la tabla de otro mar se lee igual de bien que
  la correcta.
- **Cada cifra declara su procedencia** y coincide con la del caladero (G1, visto desde la web), y
  cada una arrastra su literal del BOE.
- **La sección no trae JavaScript**: ni `<script>` ni manejadores en línea, comprobado sobre el HTML
  de las 153 páginas.
- **La hoja de estilos no anima ni destaca nada**: sin `@keyframes`, `animation`, `transition`,
  `box-shadow` ni `border-radius`, y la única regla con `--m-terra` es la de los avisos.
- **El sello no se puede teclear**: `verificadoEn` sale del dataset y lo escribe G2; la página lo
  imprime tal cual y no lo recompone con el reloj del build.
