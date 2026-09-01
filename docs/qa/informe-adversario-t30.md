# Informe adversario — G5, el objetivo táctil (T-30)

- **Trayectoria:** T-30 · **PR:** #30 (`claude/T-30-objetivo-tactil`) · **Fecha:** 2026-09-01
- **Superficie atacada:** el gate **G5** recién nacido (`tests/e2e/journeys/legibilidad-movil.spec.ts`)
  y el arreglo que lo pone verde (`packages/ui/src/tokens.css`, `apps/web/src/estilos/{almanaque,
  especies,indices,pagina-puerto,ficha-especie}.css`), sobre el sitio **construido**.
- **Entorno:** local y efímero — `pnpm build` + Playwright sobre `apps/web/dist/`. Sin cloud: ni el
  diff ni el DOM han salido del contenedor.
- **Ejecutor:** el orquestador **a mano**. El rol `qa-adversario` está caído por cupo semanal hasta
  el 3-sep; se dice aquí porque un informe que no dijera quién lo firmó valdría menos.
- **Reproducciones:** el propio **G5**, con el arreglo retirado. No hacen falta ficheros nuevos: los
  dos hallazgos son *«el gate no miraba aquí»*, así que su reproducción es **ensanchar el gate** y
  verlo enrojecer — y al arreglarlo el recorrido se queda dentro como trinquete permanente.

## Promesa atacada

> «El sitio no publica objetivos táctiles por debajo de 24 × 24 px (WCAG 2.5.8 AA)», sostenida por
> G5 con dos canarios y dos exenciones escritas.

No se ataca el razonamiento del diff: se ataca **la frase**. Y la frase dice «el sitio».

## Clases atacadas

| Clase | Hipótesis (entrada concreta) | Resultado |
|---|---|---|
| **A8** · alcance del oráculo | ¿Sobre **qué universo** mide? G5 nació copiando la lista de 3 páginas de G1/G2/G4; el sitio publica **279** en ~8 familias | 🔴 **roto** → **A-T30-1** y **A-T30-2** |
| **A11** · el arreglo atado a la forma | El arreglo de la llamada suelta se ató a una clase (`.portada__enlace`) puesta en `index.astro`; ¿hay otra página que publique la misma línea? | 🔴 **roto** → **A-T30-2** |
| **A2** · exención abusable | La exención «va en línea» se concede si el padre tiene texto suelto: ¿basta con meter texto junto a un botón pequeño para eximirlo? | 🟡 **cierto pero no explotable hoy**: ver *No reproducidos* |
| **A3** · instrumento ciego | ¿Puede G5 estar verde por no medir a nadie? | 🟢 aguantó — canario de **cobertura**, probado en rojo rompiendo el selector |
| **A3** · instrumento saturado | ¿Puede G5 estar verde midiendo mal? | 🟢 aguantó — canario de **sensibilidad**, probado en rojo agrandando el testigo a 30 px |
| **A9** · el gate lee lo que vigila | Si el umbral saliera del token `--m-tap-min`, bajar el token pondría el gate verde y el sitio malo | 🟢 aguantó — bajado a 10 px, G5 **sigue exigiendo 24** y enrojece con 71 de 177 |
| **A7** · eje no recorrido | ¿Cambia el tamaño del objetivo con `prefers-color-scheme`, como le pasó a G4? | 🟢 aguantó — ningún token de tamaño depende del esquema |
| **A5** · anchos límite | 320 / 360 / 390 | 🟢 aguantó — el mismo resultado en los tres |

## Hallazgos

### A-T30-1 · La ficha individual de especie: 87 páginas con objetivos de 14 px, y G5 verde

**Reproducción.** `/pesca/especies/alosa-spp-8c0b29/` a 320, 360 y 390 px:
**4 objetivos de 7 medidos** por debajo de 24 px —WoRMS (233 × **14**), la licencia de la foto
(167 × **14**), «ver la ficha de» (188 × **14**) y «volver al catálogo» (268 × **14**)—. G5 estaba
**verde 9 de 9** mientras tanto, porque su lista de páginas no incluía esta familia.

**Por qué importa más que sus cuatro enlaces.** Es la superficie que **T-23 estrenó** y son **87
páginas**. Repite el patrón de T-20 y T-27: *una superficie nueva no hereda los gates de las viejas*.
El gate se escribió mirando el sitio que existía cuando se escribió.

**Arreglo.** `.ficha__enlace a` a `--m-tap-min`. Y **la familia entra en el universo de G5**, que es
la mitad que importa: sin eso, el arreglo dura hasta el próximo enlace que alguien añada ahí.

### A-T30-2 · El 404 publica la llamada de la portada sin la clase con la que se arregló la portada

**Reproducción.** `/404.html` a los tres anchos: **1 objetivo de 167** por debajo de 24 px —«Ver todas
las regiones», 131 × **16**—, el mismo enlace que en la portada mide 44 desde este PR.

**El mecanismo, que es el hallazgo.** El arreglo se escribió como `.portada__enlace a`, con la clase
añadida a mano en `index.astro`. `404.astro` publica **la misma línea, sin la clase**. Un arreglo
atado al **nombre de una instancia** no alcanza a la segunda instancia, y no hay nada que avise: la
página 404 no estaba en el universo del gate.

**Arreglo — y no es ponerle la clase al 404.** La regla pasa a ser **estructural**:

```css
.pagina p > a:only-child { … min-height: var(--m-tap-comodo); }
```

Un enlace que es el **único elemento de su párrafo** no tiene texto alrededor del que formar parte,
que es *literalmente* la excepción «inline» de 2.5.8 que el gate aplica. Así **la condición del CSS y
la del gate son la misma condición dicha dos veces**, en vez de dos listas de sitios que hay que
acordarse de mantener iguales. Ponerle la clase al 404 habría cerrado este caso y dejado abierto el
siguiente.

## No reproducidos (dichos, no escondidos)

- **A2 · la exención «en línea» es abusable en teoría.** Un objetivo pequeño se exime si su padre
  tiene texto suelto, así que envolver un botón junto a una palabra lo saca del gate. **No se cuenta
  como hallazgo porque no se reprodujo sobre el sitio**: hoy los 18 objetivos exentos por esta vía son
  enlaces dentro de frases de verdad. Queda escrito aquí porque el día que aparezca un control real
  con texto al lado, el gate mirará hacia otro lado y esta línea es lo único que lo recordará.
- **Oclusión.** Un objetivo de 44 × 44 tapado por otro elemento no es pulsable y G5 lo daría por
  bueno: mide la caja, no si llega el dedo. No se reprodujo —no se encontró ninguno— y cubrirlo pide
  otro instrumento (*hit-testing* en el punto medio), no un umbral.
- **Estado.** G5 mide el estado por defecto. Si una superficie escondiera objetivos tras un
  `<details>` o un filtro, no se medirían. Hoy el único estado del sitio es el filtro CSS de la
  portada, que **oculta** entradas y no encoge ninguna.

## Veredicto

**Dos hallazgos, los dos reproducidos en rojo por el propio gate y los dos arreglados**, con sus
recorridos dentro como trinquete: G5 pasa de **9 a 15 casos** (5 familias × 3 anchos).

Lo que este pase confirma es incómodo y vale más que los dos arreglos: **G5 se escribió con los dos
canarios puestos, con las exenciones escritas a mano para que no se auto-concedieran y con el umbral
a prueba de que le bajaran el token… y aun así estaba ciego a dos de cada cinco familias del sitio.**
Un gate puede ser honrado en todo lo que mide y no medir donde está el fallo. La pregunta que lo
destapa no es «¿mide bien?» sino **«¿sobre qué universo?»** — y esta vez la respuesta no era una
página que faltaba, sino **una superficie estrenada hace dos trayectorias** y **una página que copia
el marcado de otra**.
