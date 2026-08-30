# Design Brief — portal Mareia (página de puerto + índices geográficos)

> Paso 1 del proceso *brief-first* de la skill `frontend-anti-slop`. **Ninguna línea de CSS de
> presentación se escribe antes de este brief y de los tokens que se derivan de él** (`@mareia/ui`,
> `src/tokens.css`). El orden es contrato, no sugerencia: el brief se commitea antes que la vista.
>
> Alcance: las superficies públicas del portal — la página de puerto (`/mareas/<región>/<provincia>/
> <puerto>/`) y los índices geográficos que llevan a ella. Cuando lleguen la UI de módulos (T-10
> pesca, T-11 meteo) o la PWA (T-12), **se amplía este brief**; no se abre otro.

## 1. Contexto, industria y audiencia

- **Producto / superficie**: portal público de datos costeros. Páginas estáticas (SSG, cero
  JavaScript de cliente en el core) generadas en build con el mismo dominio que sirve el API.
- **Industria / dominio**: efemérides marítimas — mareas astronómicas, coeficiente, sol y luna.
  Sector con dos tradiciones visuales fuertes: el **anuario impreso** (tablas, filetes, versalitas) y
  el **dashboard náutico comercial** (widgets, iconos de colores, publicidad). Mareia se coloca en la
  primera y **rechaza** la segunda.
- **Audiencia primaria**: quien va a estar en la orilla o va a salir a ella —marisqueo, pesca desde
  costa, baño, fotografía, surf, paseo— y necesita **cuatro datos exactos** (a qué hora es la
  pleamar, cuánto sube, cuándo amanece, si la marea es viva o muerta). No es un cliente: es alguien
  consultando una herramienta.
- **Entorno de uso real, y esto manda sobre todo lo demás**: teléfono, **a pleno sol en la playa**,
  con brillo insuficiente, a veces con guantes o manos mojadas, a menudo con mala cobertura. De ahí
  tres consecuencias no negociables: **mobile-first**, **alto contraste** (todos los pares de la
  paleta ≥ 5,4:1, muy por encima del 4,5:1 de AA) y **página que se lee sin red y se imprime**.
- **Densidad de información esperada**: **densa pero jerarquizada**, como un anuario. La página no
  «respira» al modo marketing: quien la abre viene a leer una tabla. Lo que se controla no es la
  cantidad de dato sino su **orden de lectura**.

### Jerarquía de la información (qué se lee primero)

Tres niveles, y cada elemento de la página pertenece a uno solo:

| Nivel | Qué | Tratamiento |
|---|---|---|
| **Crítico** | Pleamares y bajamares del día: hora y altura. | Cifras grandes (`--m-text-hora`), tabla al principio, primer bloque en móvil. |
| **Contextual** | Coeficiente del día, curva de 24 h, sol y luna, grade de la estación. | Tamaño de cuerpo, rótulos en versalita, agrupados debajo. |
| **Consultable** | Tabla mensual, progresión mensual del coeficiente, atribuciones, metodología. | Cuerpo pequeño, al final, optimizado para **imprimir** y llevárselo. |

El **aviso «No apto para navegación»** y el **aviso micromareal** (puertos donde la marea
astronómica es de centímetros y manda el residuo meteorológico) están fuera de esa jerarquía: son
**advertencias**, se ven siempre y no compiten con el dato — banner fijo el primero, bloque
destacado en la cabecera del contenido el segundo.

## 2. Tone & Direction (una, comprometida)

- **Dirección elegida**: **«almanaque de puerto»** — la página como *página de un anuario de mareas
  impreso*: papel cálido, tipografía con serifas, filete doble bajo la cabecera, rótulos en
  versalita con interletraje amplio, tablas con reglas finas y cifras alineadas, y **una sola
  mancha de color** (el terracota del coeficiente). Composición asimétrica en escritorio: la tabla
  —lo crítico— ocupa la columna estrecha izquierda y la curva se estira en la ancha, en vez del
  centrado-todo de plantilla.
- **Justificación**: el anuario de mareas es *exactamente* este producto, resuelto durante dos
  siglos con papel. Hereda de él lo que sigue siendo cierto: la tabla es el dato, la tipografía es
  la interfaz, y el adorno estorba. Además resuelve tres requisitos del entorno de uso de una vez:
  imprime bien porque nació impreso, es legible a pleno sol porque es tinta sobre papel de alto
  contraste, y no necesita JavaScript porque no hay nada que animar. Y comunica lo que el proyecto
  es —transparente, no comercial, auditable— sin decirlo: **no parece un producto que quiera
  venderte algo, parece una fuente**.

## 3. Anti-objetivos (lo que esta UI NO será)

- **NO** un dashboard SaaS: nada de *cards* con sombra y esquinas redondeadas, sidebars, «hero + 3
  cards», chips de colores ni KPIs con flechitas.
- **NO** comercial: sin CTA, sin banners de suscripción, sin *upsell*, sin publicidad, sin
  *cookie banner* (porque no hay analítica ni cookies), sin gamificación del dato.
- **NO** genérico: nada de Inter/Roboto/Helvetica/system-ui como fuente de marca, nada de gradiente
  morado→azul, nada de paleta tímida equidistante, nada de iconografía meteo tipo emoji.
- **NO** decorativo con el dato: sin fotos de olas de stock, sin relleno de área bajo la curva con
  gradientes, sin colores «alegres» sobre magnitudes que se leen en centímetros.
- **NO** con JavaScript de cliente en el core: si una sección necesita hidratación, es una isla de
  módulo (T-10/T-11) y entra por el contrato `AppModule`, no por aquí.
- **NO** dato inventado: ningún hueco se rellena con un guion bonito; si un valor no existe (p95 de
  una estación micromareal, orto de un día polar) **se dice por qué falta**.

## 4. Paleta (roles → tokens OKLCH)

Base neutra dominante (papel), tinta oscura, **una** dominante fría (azul marino, para lo que es
navegación/agua/enlace) y **un** acento cálido nítido (terracota, reservado al coeficiente y a los
avisos). Nada más: cinco colores, dos temas.

| Rol | Token | Claro (OKLCH) | Noche (OKLCH) | Contraste sobre fondo |
|---|---|---|---|---|
| Base / papel | `--m-bg` | `oklch(95.8% 0.018 89.4)` | `oklch(20.2% 0.014 253.2)` | — |
| Tinta / texto | `--m-ink` | `oklch(28.8% 0.028 248.8)` | `oklch(91.3% 0.025 89.2)` | 12,6 : 1 · 13,9 : 1 |
| Tinta secundaria | `--m-sub` | `oklch(47.9% 0.014 169.8)` | `oklch(71.9% 0.030 124.9)` | 5,8 : 1 · 7,3 : 1 |
| Dominante (agua, enlaces, pleamar) | `--m-navy` | `oklch(34.6% 0.074 256.0)` | `oklch(74.3% 0.055 245.2)` | 10,2 : 1 · 7,9 : 1 |
| Acento (coeficiente, avisos) | `--m-terra` | `oklch(51.2% 0.141 32.0)` | `oklch(66.7% 0.116 39.9)` | 5,4 : 1 · 5,7 : 1 |

- **Ningún literal de color vive fuera de `packages/ui/src/tokens.css`.** Las páginas consumen
  custom properties; el linter anti-slop lo comprueba.
- El peor par de la paleta da **5,4 : 1**: AA con margen para el sol de mediodía. El color **nunca**
  es el único portador de significado (la pleamar se distingue por su rótulo, no por su tono).
- Tema noche por `prefers-color-scheme` **y** por `data-theme` explícito, con `color-scheme`
  declarado en el mismo bloque que la paleta.

## 5. Tipografía

- **Display — Instrument Serif**: serifa de anuario, contraste alto, cursiva viva; da el carácter de
  portada impresa al nombre del puerto y a la cifra del coeficiente. No es una fuente «de sistema» y
  no se parece a ningún SaaS: es la mitad de la personalidad del portal.
- **Texto — Newsreader**: serifa de lectura diseñada para pantalla y para tamaños pequeños, con
  cifras que se leen sin ambigüedad. Sostiene tablas densas a 15 px en un móvil al sol.
- **Mono**: no se usa. Las horas y las alturas viven en tablas con columnas alineadas y tamaño
  fijado por token; una mono aquí sería un guiño «técnico» sin función.
- **Jerarquía por peso, tamaño y tracking, no por color**: rótulos en versalita con
  `letter-spacing` amplio (`--m-track-label`), cifras críticas dos peldaños por encima del cuerpo.
  La escala completa sube un peldaño en escritorio, desde los tokens (no desde la página).
- **Carga**: las dos familias vienen de Google Fonts con `display=swap` y `preconnect`; la pila de
  respaldo es Georgia, serifa presente en todos los sistemas, para que el salto de fuente no cambie
  la métrica de la tabla.

## 6. Movimiento

- **Profundidad: sin motion.** Cero animaciones, cero transiciones, cero `@keyframes`. No es
  minimalismo estético: la página no tiene estado que cambie —es HTML generado en build— y animar
  algo que no cambia sería decoración pura. Además, cualquier movimiento cuesta batería y legibilidad
  en el único entorno que nos importa (sol, playa, mano temblando).
- **Único feedback**: el `:hover`/`:focus` de los enlaces, resuelto con opacidad y con el anillo de
  foco nativo del navegador (no se suprime jamás).

## 7. Referencias conceptuales

1. **_Annuaire des marées_ del SHOM** (Francia) — de ahí vienen la tabla como protagonista, la
   pareja de coeficientes por día y la idea de que el coeficiente es una **cifra grande y sola**.
2. **_Almanaque Náutico_ del Real Instituto y Observatorio de la Armada** (San Fernando) — de ahí, el
   tratamiento de las efemérides de sol y luna: columnas apretadas, rótulos en versalita, y la
   costumbre de **publicar el método y sus límites junto al número** (nuestro badge de grade).
3. **Tablas horarias ferroviarias suizas** — de ahí, la disciplina de retícula y de reglas finas:
   densidad altísima con lectura inequívoca, sin una sola línea decorativa.

## 7 bis. Ampliación T-12 — la PWA y sus dos controles

Esta sección **amplía el brief** (no abre otro) al llegar la PWA offline, tal y como anuncia la
cabecera.

- **Dos secciones nuevas en la página de puerto y ninguna en el resto del sitio**: «Sin cobertura»
  (justo después de los avisos del puerto: cuando no hay red, saber que se está leyendo una copia es
  **crítico** en la jerarquía de §1, porque cambia cómo hay que leer todo lo de abajo) y «Mareas de
  otro día» (después del cuerpo: es **consultable**, se viene a por el día de hoy).
- **Los dos primeros controles del portal** —un botón y un campo de fecha— se componen como
  tipografía del almanaque: sin relleno de color, sin sombra, sin esquinas redondeadas; un filete
  bajo el texto, como un pie de imprenta que se puede pulsar. El anti-objetivo del dashboard (§3)
  sigue en pie y este portal no tiene ningún CTA que vender. Altura mínima de 44 px, que es lo que
  pide el entorno de uso de §1 (guantes, manos mojadas).
- **El sello se generaliza.** El sello de antigüedad de T-11 deja de ser de la sección meteo y pasa
  al core: una copia guardada en el teléfono también tiene edad, y para quien lee es la misma
  pregunta. Mismos tres tonos y misma regla — **lo que separa los estados es el texto**, el filete
  solo refuerza, y en papel siguen distinguiéndose.
- **Sin motion, también aquí** (§6). Guardar un puerto no anima nada: cambia el texto del sello y la
  etiqueta del botón. La única señal de progreso es la palabra «Guardando…».
- **En papel, las dos secciones desaparecen.** Son controles, y un control impreso es tinta gastada;
  la tabla del día y la del mes ya viajan en el papel, que es de lo que va imprimir un almanaque.
- **Instalado no es otra cosa.** El manifiesto declara `minimal-ui` y **no** `standalone`: quien
  instala esto sigue queriendo ver la URL —para compartirla y para recortarla, que es una promesa de
  la jerarquía de URL de T-09— y sigue queriendo recargar. Parecer una app nativa no es un objetivo.

## 7 ter. Ampliación T-14B — la calidad en la lista, y su filtro sin JavaScript

Esta sección **amplía el brief** (no abre otro), como anuncia la cabecera: la portada deja de
presentar los 153 puertos como si valieran lo mismo.

- **El problema es de jerarquía, no de dato.** La calidad ya se publica —entera— en la página del
  puerto (§1, nivel *contextual*: «grade de la estación»). Lo que faltaba es que llegara al sitio
  donde se **elige**: una lista plana invita a leerla como plana, y 120 de los 153 puertos publican
  una marea **estimada**. En la lista, esa marca sube a **crítica**: cambia qué puerto abres.
- **La señal es una palabra, no un chip.** «medida» / «estimada» junto a la provincia, en la misma
  cursiva de la meta del índice (`--m-text-meta`, `--m-sub`), separada por un punto medio. Nada de
  pastilla de color, que es el anti-objetivo §3 («chips de colores») y además obligaría al color a
  portar significado. Lo único que hace el color es **reforzar**: la palabra «estimada» va en
  terracota (`--m-terra`), el mismo tono con el que la página del puerto ya marca sus avisos, y se
  distingue igual leída en gris, impresa o dictada por un lector de pantalla.
- **La señal se hornea en el HTML.** Va en el índice construido, sin una línea de JavaScript: una
  señal que solo existe si corre el JS es una señal que a veces no está (lección de T-11). La
  portada **conserva su cero scripts** (`scripts-de-core.ts`), y por tanto no toca el presupuesto de
  bytes de T-12.
- **El grade no sube a la lista.** Viaja en `/v1/ports` para quien afine, y se lee entero —con su
  motivo— en la ficha. En la lista, una letra sin su umbral al lado es un adorno técnico: lo que
  decide al elegir es si la marea está medida aquí o prestada de otro sitio.
- **El filtro es CSS, no una isla.** Tres radios visualmente ocultos (pero enfocables) y reglas de
  hermano: `#calidad-medidos:checked ~ .grupo .indice__entrada[data-estimado="true"]`. Cero bytes de
  JavaScript, cero hidratación, funciona en cualquier navegador con radios y sin depender de `:has()`.
  Se compone como los controles de §7 bis —tipografía del almanaque, filete bajo la opción activa,
  sin relleno ni esquinas redondeadas, 44 px de zona pulsable—, como el pie de un índice impreso que
  dice qué se está listando.
- **Las cuentas van en la propia opción** («Todos 153 · Medidos 33 · Estimados 120»), horneadas del
  catálogo. Sin JavaScript no hay contador vivo, y no hace falta: la cuenta de cada opción **es** el
  resultado, y de paso dice el dato incómodo —cuántos hay de cada— antes de que nadie filtre.
- **Una región que se queda sin puertos desaparece con ellos.** Cada bloque de región lleva
  horneadas sus dos cuentas (`data-medidos`, `data-estimados`) y el CSS oculta el bloque cuyo
  contador es `0`: un rótulo de región sobre una lista vacía es peor que no filtrar.
- **En papel se imprime lo que se ve**, con la opción activa marcada por su filete. No se esconde el
  control al imprimir: un papel que lista 33 puertos sin decir que están filtrados miente sobre el
  catálogo, y ese es justo el pecado que esta trayectoria vino a corregir.
- **Quedaba fuera** —y duró lo que tardó el pase adversario en medirlo—: los índices de región y
  provincia se dejaron sin la marca porque T-14B corregía «los dos sitios donde el proyecto declaró
  que se elige puerto». Resultaron ser cuatro superficies, y la §7 quater cuenta el arreglo.

## 7 quater. Arreglo de T-14B — la señal en las tres listas de puertos, y por qué el filtro no

El pase adversario midió lo que costaba dejarlo fuera: la clase `indice__calidad` aparecía en **una
sola página del sitio**, y las otras dos familias de listas —12 de región y 24 de provincia, que
son la ruta que la propia portada llama canónica («Ver todas las regiones»)— presentaban los 153
puertos planos. **306 entradas mudas**, y el último clic antes de la ficha dado a ciegas: en
`/mareas/galicia/pontevedra/`, Vigo (medida) y Baiona (estimada) idénticos.

- **La misma señal, el mismo componente, la misma palabra.** Las dos páginas pasan `estimada` al
  `Indice.astro` que ya existía; ni una regla de CSS nueva, ni un segundo vocabulario. Decir «sin
  contrastar» aquí y «estimada» allí serían dos cosas distintas para quien lee, aunque sean el
  mismo `quality.estimated`.
- **En provincia la señal comparte meta con la zona horaria** («Europe/Madrid · estimada»), con el
  mismo punto medio que la portada usa para la provincia. La jerarquía de §1 no cambia: la meta
  sigue siendo *contextual* y la marca es lo último que se lee de la entrada.
- **El filtro NO baja a estas 36 páginas** (decisión, no olvido), por tres razones medidas:
  1. **Lo que habría que descartar no lo pide.** El filtro es un mando para una lista que no cabe
     de un vistazo: en la portada descarta 120 de 153. La región mediana tiene **12** puertos (la
     mayor, Andalucía, 32; dos tienen **1**) y la provincia mediana **5,5** (la mayor, 17). El mando
     cuesta tres radios, sus tres cuentas y una nota que explica qué significa «medida»: en una
     provincia de 5 puertos, el control pesa más que la lista que filtra.

     (Las medianas se recontaron del catálogo al cerrar la trayectoria: las 12 regiones miden
     `1,1,2,4,5,7,17,17,19,22,26,32` y las 24 provincias `1,1,1,2,2,2,2,3,4,5,5,5,6,7,7,8,8,9,10,
     11,11,12,14,17`. Antes decía 17 y 5, que son los centrales de arriba y de abajo y no las
     medianas; y daba una nota «de 63 palabras» que ninguna forma de contarlas reproduce. Con las
     cifras buenas el argumento es **más** fuerte, no menos.)
  2. **En 7 de las 24 provincias «Solo los medidos» dejaría la página vacía** (Alicante 11/0,
     Barcelona 9/0, Castellón 3/0, Lugo 2/0, Gipuzkoa 2/0, Sevilla 1/0, Ceuta 1/0). Un mando cuyo
     resultado más probable en un tercio de las páginas es «no hay nada» no es un filtro: es un
     callejón sin salida con etiqueta (§A9 del pase adversario).
  3. **Quien quiere filtrar quiere el catálogo entero**, y ése está en la portada, a un toque desde
     la cabecera de cualquier página. Un filtro por página parcela el descarte y multiplica por 37
     la superficie de un mando que, además, tiene **una pregunta de producto abierta**: ordena por
     procedencia y no por error (H-3 del informe adversario, sin resolver). Replicarlo antes de esa
     decisión sería 36 copias de algo que puede cambiar.
- **La señal, en cambio, no está en revisión: es la promesa.** Por eso va donde haya una lista de
  puertos, y el gate lo comprueba **puerto a puerto y página a página**
  (`sitio-construido.test.ts`, y los dos recorridos adversarios convertidos en gate permanente).
- **Lo que pesa, medido.** Las 12 páginas de región pasan de 58.545 a 73.812 B de HTML (+26 %) y
  las 24 de provincia de 93.717 a 104.394 B (+11 %); comprimidas, la mayor (Andalucía) pasa de
  1.965 a 2.078 B (+5,7 %) y Pontevedra de 1.351 a 1.402 B (+3,8 %). La señal es texto que se
  repite, que es lo que gzip hace mejor. Ni un byte de JavaScript: estas páginas conservan su
  cero-JS.

## 7 quinquies. Ampliación T-19 — una cifra legal en la página, y por qué no se adorna

Esta sección **amplía el brief** (no abre otro), como anuncia la cabecera: llega la primera sección
que publica un dato con **consecuencia jurídica** —las tallas mínimas de captura del RD 560/1995— y
eso mueve una regla que hasta ahora era estética.

- **Es información *consultable*, y va donde le toca** (§1). La sección entra por el contrato de
  módulos con `order: 30`, detrás de la actividad solunar y de la meteo, que empatan a 20. A esta
  página se viene a por la marea; quien mira la talla la mira porque **ya tiene la pieza en la
  mano**, y ese momento no compite con la pleamar. Ponerla más arriba no la haría más útil: una
  cifra legal no gana por estar antes, gana por estar **completa**.
- **Cero *juice*, y aquí el argumento no es de gusto.** Ni barra, ni estrella, ni rareza, ni
  dificultad, ni contador, ni orden por «mejores especies», ni la mancha de terracota sobre ningún
  número. El anti-objetivo §3 ya prohíbe la gamificación del dato; sobre una cifra con consecuencia
  jurídica se convierte en una regla dura: **el adorno consigue que se le crea al número más de lo
  que merece**, y lo que merece está escrito encima con su fecha de comprobación. Lo único con color
  de la sección son los dos avisos, con el mismo filete de terracota que ya usan los avisos del
  puerto — y ninguno cae sobre una cifra. Hay un gate que lo mide sobre la hoja
  (`tallas-construido.test.ts`).
- **La nota va pegada a la cifra, no en el pie.** Es la decisión de composición que sostiene la
  trayectoria entera: el boquerón son 12 cm salvo en la división IX a) —de Galicia sur al golfo de
  Cádiz, donde sí tenemos puertos—, donde son 10; el pulpo del Anexo II no aplica en aguas interiores
  de Balears, y ahí hay 17 puertos. (La nota de la lubina, 44 cm en las divisiones 8.a/8.b, es la de
  mayor diferencia y por eso se cita, pero **no toca a ningún puerto del portal**: la costa española
  es la división 8.c.) Una marca sola (`36 (***)`) es una
  **promesa de nota** que hay que ir a buscar, y en un móvil al sol nadie la busca. Se paga en
  repetición —la nota `(*)` sale seis veces en el Anexo I— y en bytes; se acepta, porque la
  alternativa es publicar una cifra legal falsa para esos puertos. El pie con las notas enteras se
  mantiene igualmente, para quien lea la tabla como tabla.
- **La ausencia se escribe, no se rellena** (§3, «NO dato inventado»), y aquí toma cinco formas
  porque la columna «Talla (en cm)» del BOE no contiene solo tallas en cm: 6 especies con la talla
  *por determinar* (se dice que **la norma no la fija**), 9 en kilos (se dice **de peso**), una en
  «80 cm o 10 kg», y la boga, cuya celda el BOE imprime como `1 1`: se publica el literal, se dice
  que la norma lo escribe así y **no se corrige por inferencia**. La cifra alineada con
  `tabular-nums` solo cuando de verdad **es** una cifra: una frase alineada como número se lee como
  si lo fuera.
- **El literal del BOE viaja al lado, siempre**, en una tercera columna de cuerpo pequeño. Es lo que
  permite comparar lo que pintamos con lo que dice la norma sin salir de la página, y es la misma
  costumbre del §7 (referencia 2): publicar el método junto al número.
- **Sin cobertura la tabla se sigue leyendo, y lo dice.** El módulo declara `offline: cache-first`
  —decisión del humano frente a la recomendación de ocultarla— y la sección **no tiene JavaScript**
  con el que enterarse de si hay red, así que el aviso no se enciende: **está siempre escrito**,
  redactado para ser verdad en los dos casos. Es la única forma honrada de sostener «se muestra sin
  red»: si la copia guardada no puede decir que es una copia guardada, el sello de verificación se
  lee como si fuese de hoy. Es el reverso exacto de ADR-01 —allí el dato caducaba en horas y por eso
  hacía falta una isla; aquí no caduca, **se deroga**— y por eso esta sección conserva el cero JS del
  core.
- **En papel se imprime entera**, al contrario que los controles de §7 bis: no es un mando, es la
  tabla, y llevarse impresa la talla mínima del caladero es exactamente el uso que un almanaque tiene
  en un barco.

## 7 sexies. Ampliación T-21 — una advertencia por encima del dato, y por qué el hueco se dice

Esta sección **amplía el brief** (no abre otro), como la de T-19: llega la primera sección que no es
información sino **advertencia** —las áreas marinas protegidas que el puerto tiene a menos de **30
km**, de RAMPE 2025 (MITECO)— y eso mueve dos reglas, una de colocación y otra de redacción.

- **Es la primera de las secciones de módulo, y es la primera advertencia que entra por ahí.** El
  contrato la coloca con `order: 12`: delante de la actividad solunar y de la meteo (20) y de las
  tallas mínimas (30). La jerarquía de §1 tiene tres niveles —crítico, contextual, consultable— y
  **las advertencias están fuera de los tres**: el banner «No apto para navegación» y el aviso
  micromareal no compiten con el dato, avisan. Ésta es de esa clase. Quien mira una talla la mira
  porque ya tiene la pieza en la mano; quien tiene delante una reserva marina necesita saberlo
  **antes** de decidir nada, y una advertencia colocada detrás de lo que califica llega tarde. El
  hueco por debajo de 20 estaba reservado desde T-19 con esas palabras; éste es el módulo que lo
  ocupa. Se queda en 12 y no en 5 porque debajo tiene que seguir habiendo sitio para un aviso más
  urgente —uno que dependa del día y no del sitio— sin renumerar a nadie.
  **Y el límite de ese 12, dicho y no supuesto**: `order` ordena las secciones de módulo entre sí y
  nada más. Los bloques del core —tabla, gráfico, coeficiente, sol y luna— los coloca la página y
  van antes, así que esta sección **no es un banner**: es lo primero que se lee **después** del dato
  de marea. Subirla por encima de la tabla exigiría tocar la plantilla, que es lo que el contrato de
  módulos existe para no tener que hacer.
- **La regla que manda sobre todas las demás: en ningún sitio, ni por omisión, puede leerse que se
  pueda pescar.** El encargo era «zonas de pesca y zonas prohibidas» y se publica **solo la mitad
  defendible**: dónde **no** se puede, que tiene fuente oficial y cuyo error cae del lado
  conservador. Por eso el aviso de la fuente —«que no haya un área protegida cerca no autoriza a
  pescar: esto dice dónde NO se puede, nunca dónde sí»— va **antes** de la lista y en las **153**
  páginas, y por eso hay un gate que busca en el `dist/` ocho maneras de sugerir lo contrario
  («pesca permitida», «zona libre», «apto para la pesca»…). Una lista de zonas prohibidas sin ese
  encabezado se lee por descarte como un mapa de zonas libres.
- **Los 10 puertos sin ninguna área lo DICEN**, y es la decisión de producto de la trayectoria. De
  los **153** puertos, **143 de 153** tienen al menos un área a menos de 30 km —**348** relaciones
  publicadas de las **86** áreas de la fuente— y **10** no tienen ninguna. Esos 10 no pierden la
  sección: publican «Ninguna a menos de 30 km de este puerto» y, debajo, hasta dónde se ha mirado y
  que el radio es una decisión nuestra y no una ausencia de la fuente. Una sección que desaparece se
  lee como «no hay nada que saber» y no se distingue de «esto todavía no lo hemos hecho». Es la
  misma regla que §3 («NO dato inventado»: ningún hueco se rellena, pero **tampoco se calla**).
- **La distancia se publica como cota, no como medida.** El derivado mide al **borde** del área,
  arista a arista, así que un `8,7 km` en la página fingiría una precisión que el método no da. Se
  escribe «a menos de 9 km»: verdadero, entero, y del lado que conviene en una advertencia. Cuando
  el puerto cae **dentro** de un área (10 relaciones del dataset) eso se dice con sus palabras, no
  disuelto en un «a menos de 1 km». Y `tabular-nums` sobre la distancia sin peso ni color: es una
  cota, no un titular.
  **La primera versión medía al vértice más cercano y eso costó seis avisos.** El vértice aleja, así
  que la cota parecía del lado seguro; en una sección cuya única razón de ser es avisar, alejar es
  avisar de menos. Medido: la cota por vértice perdía **6 relaciones de 348**, tres de ellas del
  Corredor de Migración de Cetáceos —la única AMP del catálogo, que se publicaba en tres puertos y
  desaparecía en otros tres—, porque RAMPE tiene aristas de hasta 159,6 km entre dos vértices
  consecutivos. Es la clase de error que este brief llama de §3 («NO dato inventado») por el otro
  lado: no inventa nada, calla lo que sabe.
- **Las siglas se glosan; el régimen, no.** ZEPA, ZEC, AMP y ZEC/AMP salen con la sigla desarrollada
  pegada al lado, porque «ZEPA» sola no informa a quien no la conozca ya y en un móvil al sol nadie
  baja a buscar un pie. Lo que **no** se escribe es qué permite o prohíbe cada figura: eso lo fija la
  declaración oficial de cada espacio y no está en esta fuente. Desarrollar una sigla es leer; contar
  su régimen sería redactar derecho por nuestra cuenta. (`RESERVA MARINA` no lleva glosa porque la
  fuente ya la escribe en palabras.)
- **Cero *juice*, y aquí es la regla más dura de la casa.** Ni parpadeo, ni halo, ni recuadro de
  estado, ni contador de áreas, ni orden por «más interesante» —el orden es el del dato, que es la
  proximidad, y la plantilla **no reordena**—. La mancha de terracota cae solo en los dos avisos,
  nunca sobre el nombre de un área ni sobre una distancia. Sobre una advertencia el adorno consigue
  que se le crea por el adorno, y lo que esta sección puede sostener está escrito con sus
  condiciones al lado. Hay un gate que lo mide sobre la hoja.
- **Sin cobertura la lista se sigue leyendo, y lo dice con su condición delante.** `offline:
  cache-first` y **cero JavaScript**: el aviso no se enciende, está siempre escrito, y empieza por
  «si guardas este puerto» porque quien guarda una página es la caja de favoritos y solo la del
  puerto que el lector marque. Es la corrección de H-4 de T-19 aplicada antes de publicar, no
  después.
- **El hueco de licencia se publica tal cual.** La página de descarga de RAMPE no declara licencia ni
  condiciones de uso, así que la atribución al pie de la sección dice «MITECO · RAMPE 2025 —
  condiciones de uso no declaradas en origen». No se le pone una CC porque otras fuentes del
  ministerio la lleven. La consecuencia da forma a la sección entera: se publican **hechos
  derivados** —nombre oficial, figura, código, distancia— y **ninguna geometría**, ni siquiera
  simplificada, que es justo lo que una licencia no declarada no deja redistribuir.

## 7 septies. Ampliación T-20 — dos nombres para la misma especie, y una cifra que no se puede leer sola

Esta sección **amplía el brief** (no abre otro), como las de T-19 y T-21. Llega la primera **página
nueva** del portal desde T-13 —`/pesca/especies/`, el catálogo de las **86** especies que el BOE
regula— y con ella tres cosas que el brief no había tenido que decidir todavía: qué hacer cuando el
mismo objeto tiene **dos nombres igual de válidos**, cómo se compone una cifra que **no significa lo
que parece**, y cómo se filtra sin JavaScript algo a lo que **otra página tiene que poder enlazar ya
filtrado**.

- **Los dos nombres se publican, y ninguno de los dos es la letra pequeña del otro.** La norma es de
  1995 y la taxonomía se ha movido: **10 de las 86** especies tienen hoy en WoRMS un nombre aceptado
  distinto del que escribe el BOE (`Solea vulgaris` → **Solea solea**, `Psetta maxima` →
  **Scophthalmus maximus**…). Tipográficamente eso se resuelve **no resolviéndolo**: los dos van en
  cursiva, en el mismo cuerpo y en columnas distintas —el del BOE en la cabecera de fila, el
  aceptado en la suya—, y entre ellos hay una frase que dice **por qué** difieren. Poner uno en
  cuerpo pequeño o entre paréntesis sería contar con el estilo una decisión que no es nuestra: el
  del BOE es el que tiene consecuencia legal, el aceptado es el que sirve para buscar la especie en
  cualquier otra base, y ninguno de los dos «gana». El gate **E1** mide sobre el `dist/` que el
  nombre de la norma esté literal en las 86 filas.
- **Ninguna cifra de OBIS aparece sin lo que es, y eso es una regla de composición además de una de
  redacción.** Los registros miden **esfuerzo de muestreo, no abundancia** —la dorada en toda la
  costa gallega son **12 registros**—, así que en esta página no existe el elemento «número». La
  cifra sale siempre dentro de una frase (`presenciaEscrita`) que lleva el sesgo pegado, en el mismo
  `<span>`, y la explicación larga va **antes** de la primera cifra de la página. Es la misma
  doctrina con la que T-19 pega cada nota a su talla en vez de mandarla a un pie: lo que va en un
  pie no viaja con la fila que alguien copia. Y por eso tampoco hay `tabular-nums` sobre estas
  cifras ni ninguna forma de destacarlas: alinear como número una cifra que no es una medida es
  prestarle una precisión que no tiene. El gate **E4** lo mide en el elemento **más interno** que
  contiene cada número, no «en la página».
- **El filtro por caladero usa `:target`, y no los radios de la portada.** El patrón sin JavaScript
  del portal (T-14B) son radios ocultos y reglas de hermano; aquí no sirve, y no por gusto: la
  sección de cada página de puerto tiene que **enlazar al catálogo ya filtrado por su caladero**, y
  un radio no se puede preseleccionar desde una URL sin JavaScript. Con `:target` el estado vive en
  el fragmento, así que los **153** enlaces funcionan, el estado es compartible y el navegador deja
  al lector justo encima de la lista filtrada. Se paga en tres sitios y se dice: el estado se ve en
  la barra de direcciones, cada opción necesita su ancla —incluida «Todas»— y los tres
  identificadores de caladero están escritos a mano en la hoja, porque un selector de atributo no
  puede leer un valor del dataset. Para que un cuarto caladero no rompa el filtro **en silencio**,
  un gate comprueba que todo caladero del catálogo tiene sus reglas en `especies.css`. Lo que no
  cambia es la composición: mismas etiquetas de 44 px, mismo filete bajo la activa, misma cuenta
  horneada al lado de cada opción.
- **La sección de la página de puerto es un enlace y no una tabla, y eso también es diseño.** La
  tabla de tallas ya está arriba: repetirla aquí con otra composición serían dos superficies del
  mismo dato, que se desincronizan a la primera corrección. Va la **última** de las secciones de
  módulo (`order: 35`, detrás de las tallas en 30) porque es lo que amplía lo que se acaba de leer;
  puesta delante, ofrecería irse a otra página a quien todavía no ha visto lo que ya tiene aquí
  horneado y sin cobertura. Ocupa **1.453 B** en la página de puerto (753 B comprimidos).
- **Y dice que no se guarda.** El módulo **no declara política offline**, porque el precacheo de esta
  PWA es **por favorito** —un favorito guarda la página del puerto, sus constantes, el camino hasta
  ella y sus assets— y el catálogo no está en esa lista. En vez de prometerlo, la sección escribe lo
  contrario: «este enlace necesita cobertura». Es la corrección de H-4 de T-19 aplicada antes de
  publicar y no después.
- **Cero *juice* sobre dos clases de cifra a la vez.** La página publica tallas legales y recuentos
  de muestreo, y las dos aguantan mal el énfasis por motivos distintos: adornar una talla es pedirle
  crédito prestado a la ley, y destacar un recuento es convertirlo en abundancia. La hoja no tiene
  animación, transición, sombra ni esquina redondeada, y la única mancha de terracota del módulo cae
  en su aviso —nunca sobre un número—; hay un test que lo mide.
- **Lo que la ruta se deja por el camino, dicho aquí y no escondido.** `/pesca/especies/` la decidió
  el humano; `/pesca/` **no es una página**, así que es la única URL del portal cuyo padre no se
  puede recortar en la barra de direcciones. Las migas no lo enlazan —enlazarían a un 404— y no se
  inventa un índice de una sola entrada para disimularlo. El día que cuelgue algo más de `/pesca/`,
  ese índice tendrá contenido y entrará con él.

## 8. Cómo se audita

```bash
# desde la raíz del repo
bash .claude/skills/frontend-anti-slop/scripts/audit-anti-slop.sh apps/web/src
bash .claude/skills/frontend-anti-slop/scripts/audit-anti-slop.sh packages/ui/src
pnpm lint      # ESLint (preset anti-slop) — incluye .astro vía eslint-plugin-astro
pnpm --filter web check   # astro check: tipos de las páginas y del layout
```

La medida de **Lighthouse** (SEO ≥ 95, el objetivo del ROADMAP) **no corre en CI**: necesita un
navegador y aquí no hay ninguno instalado. El comando, para ejecutarlo a mano sobre el `dist/`
servido —o en el despliegue de T-15, que es donde tiene sentido medirlo—:

```bash
pnpm --filter web build && pnpm --filter web preview   # sirve dist/ en :4321
npx lighthouse http://localhost:4321/mareas/galicia/pontevedra/vigo/ \
  --only-categories=seo,accessibility,performance --quiet --chrome-flags="--headless"
```

Los tres primeros son gates duros de los jobs `anti-slop` y `web` del CI. Toda excepción del linter va con
`anti-slop-allow: <razón>` en la línea y traza a una decisión de este brief.

**Regla de dónde vive el CSS**: el linter de la skill escanea `.ts`, `.css` y `.html`, pero **no**
`.astro`. Un `<style>` dentro de una página quedaría fuera del gate, que es justo donde el slop se
cuela sin que nadie lo vea. Por eso el CSS de presentación vive en **ficheros `.css`** bajo
`apps/web/src/estilos/`, importados desde el layout, y las páginas no llevan bloque `<style>`. El
precio es perder el *scoping* automático de Astro: se compensa con nombres BEM (`.bloque__elemento`)
y con una hoja por bloque de la página. La ganancia colateral es real: una sola hoja compartida y
cacheada por las 12+ páginas en vez de un `<style>` repetido en cada HTML.
