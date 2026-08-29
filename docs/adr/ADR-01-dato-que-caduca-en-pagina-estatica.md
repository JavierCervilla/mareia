# ADR-01 — Cómo entra un dato que caduca en una página estática

- **Trayectoria**: T-11 (`module-weather-ui`)
- **Estado**: aceptada
- **Fecha**: 2026-08-28
- **Decide**: cómo llega a la página de puerto el estado del mar y del cielo, que caduca en horas,
  cuando el core del portal es SSG y cero JavaScript de cliente.

## Contexto

La página de puerto se genera **en build** (`output: "static"`) y hoy no carga ni un byte de
JavaScript: las mareas, la curva y las efemérides son astronomía, se calculan meses antes y no
envejecen. El módulo `weather` (T-08) rompe esa propiedad por primera vez: sus tres fuentes tienen
TTL de 30 min (atmósfera), 1 h (mar) y 6 h (boletín), y el backend ya expresa tres escalones de
degradación en su contrato de respuesta (`fetchedAt`, `ageSeconds`, `stale`, `unavailable` con
`reason`).

El sitio se reconstruye una vez al día (T-15). Las dos opciones sobre la mesa:

1. **Inyección en build** — pedir la meteo al generar el HTML y hornearla dentro. Mantiene el cero
   JS del core.
2. **Isla hidratada** — el HTML sale sin meteo y un script la pide al API desde el navegador.
   Cuesta JavaScript de cliente.

## Decisión

**Isla hidratada**, con una condición que es la mitad de la decisión: **el HTML construido no
contiene ni un solo dato meteorológico**. Lo que se publica en `dist/` es el cuarto estado —«el
estado del mar se pide al abrir la página y todavía no ha llegado»— y el script lo sustituye por
el dato cuando el API responde.

Y el sello de antigüedad se calcula **en el cliente**, no en el servidor:

```
edad = ageSeconds (lo que dijo el backend al responder) + (ahora − instante en que llegó la respuesta)
```

Se suma el transcurrido medido con el reloj del navegador **como diferencia**, no como instante
absoluto: así un reloj del cliente desajustado en horas no falsea la antigüedad (solo se le pide
medir un intervalo corto, que es lo único que un reloj torcido mide bien).

Y —esto es la otra mitad de la mitad— **el sello no se calcula una sola vez**: se recalcula
mientras la página está abierta, y cuando la edad supera la ventana de frescura que el propio
módulo publica para esa fuente, el bloque **cambia de estado**, no solo de rótulo. Por qué hizo
falta escribirlo aparte, abajo.

## Por qué, y qué se pierde

El argumento decisivo no es la frescura, es que **la inyección en build no puede sellar su propio
dato**. Un HTML que dice «consultado hace 4 minutos» sigue diciéndolo veinte horas después: el
sello es texto congelado y miente por construcción. Se podría imprimir solo el instante absoluto
(«consultado a las 15:12»), que nunca miente, pero entonces la página no puede distinguir `ok` de
`stale` —eso depende de *ahora*— y le carga al lector el trabajo de restar. Un dato de hace tres
horas presentado como fresco es peor que no publicarlo, y esa frase es el corazón de T-11.

### El argumento de arriba era refutable con una pestaña abierta (H-1)

El pase adversario de T-11 lo demostró con el reloj de la página, no con la teoría: la isla
calculaba la edad **al pintar** y no la volvía a mirar —ni temporizador, ni `visibilitychange`, ni
`pageshow`—, así que a las tres horas de tener la pestaña abierta el bloque seguía rotulando
«Consultado hace menos de un minuto» sobre un dato de hace tres horas, en verde y con la hora de
consulta al lado dándole crédito. El defecto que este ADR dice eliminar no estaba eliminado: estaba
**movido** del momento del build al momento de abrir la pestaña. Cambiaba la escala (horas en vez
de un día) y el que más lo sufría era el que más se fiaba, porque el dato llevaba su sello. Y el
entorno de uso que manda el design brief es justamente ése: un teléfono en el bolsillo, en la playa.

Lo que hace ahora la isla para que la frase de arriba vuelva a ser verdad:

- **La edad sigue viva mientras la página lo está**, con tres disparadores porque ninguno cubre lo
  del otro: un **temporizador de 30 s** (la edad se escribe al minuto, así que el rótulo nunca va
  más de medio minuto por detrás, y no despierta la CPU cada segundo en un móvil); **`visibilitychange`**,
  porque el navegador estrangula y a veces congela los temporizadores de una pestaña en segundo
  plano —al volver, el rótulo puede llevar horas parado y hay que ponerlo al día *antes* de que
  nadie lo lea, no en el siguiente latido—; y **`pageshow`**, porque en el **bfcache** la página se
  congela entera, temporizadores incluidos, y vuelve intacta al pulsar «atrás»: sin eso, volver a
  la pestaña de ayer enseñaría el sello exacto de ayer.
- **Repintar cuesta, mirar no**: en cada latido se recalcula el sello y solo se toca el DOM si el
  texto o el tono han cambiado. En una página abierta durante horas, eso es no tocar nada casi
  siempre, y nunca se le tira de debajo la cita del boletín a quien esté leyéndola.
- **A partir de su ventana de frescura, el estado cambia de verdad.** Un dato de tres horas con una
  ventana de 30 min ya no es `ok`: el bloque pasa a la cara de caducado, con la edad en el titular.
  El umbral **no se lo inventa la página** —eso sería re-derivar lo que manda el backend—: son las
  ventanas que publica el propio módulo (`MARINE_TTL_SECONDS` 1 h, `FORECAST_TTL_SECONDS` 30 min,
  `BULLETIN_TTL_SECONDS` 6 h), exportadas desde `@mareia/module-weather/ui` precisamente para esto.
  Cada fuente tiene la suya: a los 45 minutos el mar sigue siendo de ahora y la atmósfera ya no.
- **Y se dice cuál de las dos caducidades es.** El `stale` del backend («la fuente no responde y se
  sirve lo último guardado») y ésta («se consultó a las 15:12 y esta página no ha vuelto a
  preguntar; recarga») son dos averías distintas y llevan dos frases distintas — la lección A-11 de
  T-09, aplicada al tiempo.
- **Lo que no se hace: refrescar el dato solo.** Envejecer el sello es honesto y gratis; volver a
  pedir convertiría una caída del API en una tormenta de peticiones desde todos los móviles
  abiertos. El dato lo vuelve a pedir quien lee, recargando, y ahora la página se lo dice.

A cambio se aceptan tres costes, todos acotados:

- **JavaScript en la página.** Se acota a la isla del módulo: **13,1 KB (4,9 KB comprimidos)**
  —13.103 y 4.873 bytes medidos sobre el bundle construido, en KB decimales como el resto de este
  documento; en KiB serían 12,8 y 4,8, y mezclarlos era lo que hacía cuadrar mal la resta— que solo
  pintan la sección meteo. Eran 9,3 KB (3,7 comprimidos) antes de los arreglos del pase adversario:
  **+41 % crudo y +31 % comprimido**. Los 3,8 KB de más son el portero que
  valida la forma de la respuesta (H-2), el latido que mantiene viva la edad (H-1) y el anuncio a
  lectores de pantalla (H-7), y se pagan a gusto. La tabla de mareas, la curva, el coeficiente y las efemérides siguen siendo HTML
  puro y **se leen igual con JavaScript desactivado**. Es exactamente el hueco que el design brief
  ya dejó abierto (§3: «si una sección necesita hidratación, es una isla de módulo (T-10/T-11) y
  entra por el contrato `AppModule`») y el que el contrato nombra `renderMode: "island"`.
- **Sin red, no hay meteo.** El lector en la playa sin cobertura ve el estado «no ha llegado» con
  su motivo, no un dato viejo. Es honesto pero es peor servicio que el de la inyección en build,
  que al menos habría dejado algo. El precache offline del módulo es T-12 y es donde se recupera.
- **La sección depende del API en tiempo de lectura**, no solo en tiempo de build: si el API cae,
  la sección lo dice mientras el resto de la página sigue en pie.

Lo que **no** se acepta como coste, y por eso está en la decisión: que la página degrade a un
hueco mudo. Sin JavaScript, sin red o con el API caído, la sección **escribe por qué no hay dato**.

## Consecuencias comprobables

- El HTML de `dist/` no contiene ninguna magnitud meteorológica: el `#meteo` del sitio construido
  tiene que decir **exactamente** su texto estático y ninguna frase más (`sitio-construido.test.ts`),
  y es lo que hace imposible que envejezca. El test es una **lista blanca a propósito**: la primera
  versión perseguía unidades (`km/h`, `hPa`, `°C`) y no mordía —una inyección con altura de ola,
  dirección, periodo y el sello congelado dentro pasaba en verde—, porque perseguir magnitudes una
  a una es una carrera que se pierde en cuanto alguien añade una unidad nueva. Que el test se rompa
  al tocar el texto de la sección es el precio, y es barato al lado de la garantía. Y el barrido de
  atributos lee el **nombre entero** que admite HTML5 (con `_`, con `:`, con el valor sin comillas)
  y prohíbe los comentarios dentro de `#meteo`: por ahí se colaban cuatro cargas con el gate en
  verde (H-4), y el sitio del comentario es justo donde un framework deja su carga de hidratación.
- Los cuatro estados (`ok`, `stale` con su antigüedad en la cara, `unavailable` con el motivo del
  backend, y «carga sin datos») tienen cada uno un test de vista y un recorrido Playwright con el
  API mockeado.
- **El sello envejece**: con el reloj de la página adelantado tres horas, el bloque tiene que decir
  que el dato tiene tres horas (`tests/e2e/journeys/adversarial/a2-sello-congelado.spec.ts`, gate
  permanente desde el pase adversario). Y en `vista.test.ts`, que a los 45 minutos el mar siga
  siendo de ahora y la atmósfera ya no, cada una con la ventana que publica el módulo.
- El core sigue sin JavaScript: si mañana se borra la línea del módulo en
  `apps/web/src/modules.config.ts`, la página vuelve a ser cero JS y sigue construyendo.
