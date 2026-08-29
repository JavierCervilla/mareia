# Informe adversario — isla meteo con sus cuatro estados (T-11)

- **Trayectoria:** T-11 · **PR:** #13 (`claude/T-11-module-weather-ui`) · **Fecha:** 2026-08-29
- **Superficie atacada:** la sección meteo de las 12 páginas de puerto construidas —
  `apps/web/src/componentes/Meteo.astro`, `src/modulos/meteo/vista.ts`,
  `src/modulos/meteo/cliente/isla.ts`, `src/modulos/meteo/api.ts`, `src/estilos/meteo.css`— y el
  **trinquete que protege ADR-01** en `apps/web/src/sitio-construido.test.ts`.
- **Entorno:** local y efímero. `pnpm --filter web build` + el `dist/` servido por
  `tests/e2e/servidor-estatico.ts` + Playwright (project `movil`, Pixel 7). **Cero red**: los dos
  endpoints del módulo se sirven con `page.route` desde los fixtures capturados y toda petición a un
  origen que no sea `127.0.0.1` se aborta. Sin cloud: ni el diff, ni el DOM, ni el código han salido
  del contenedor, y no se ha usado ningún modelo externo para revisar nada.
- **Reproducciones:** `tests/e2e/journeys/adversarial/` (6 ficheros, 13 recorridos).
- **Bundles:** `docs/qa/bundles/t11-adversario/<snapshotId>/FAILURE.md` — uno por recorrido, nacidos
  del run **sin** `test.fail()`, que es donde está la evidencia. Se conservan `FAILURE.md`,
  `bundle.json` y `events.jsonl`; el DOM y las capturas se descartan por peso (CI los sube como
  artifact del job de recorridos).
- **Contexto asimétrico:** se ha leído la **promesa** (el contrato del módulo `weather` en
  `packages/modules/weather/src/ui.ts`, `docs/adr/ADR-01`, el design brief y las cabeceras de los
  ficheros atacados, que son especificación escrita) y el **artefacto construido**. El código se ha
  leído para *dirigir* los ataques —encontrar el selector, el `data-*`, el orden del pintado—, nunca
  para juzgarlo. El plan de la trayectoria y la justificación del diff no se han abierto.

> **Trinquete retirado: los siete están arreglados** (2026-08-29, commits `5baebac`…`f62dc7b`).
> Los 13 recorridos nacieron con `test.fail()` para que CI siguiera verde con los hallazgos
> abiertos; ya no queda ninguno. Cada recorrido se comprobó **en rojo con el arreglo revertido**
> antes de quitarle su `test.fail()`, y los 13 quedan como **gate permanente**. No se tocó **ni un
> assert**: cada uno afirmaba *el comportamiento correcto* y por eso el mismo cuerpo pasó a verde sin
> cambiar una línea — que era exactamente la promesa del trinquete. La suite de recorridos son hoy
> **23 en verde de verdad** (13 adversarios + 10 confirmatorios), y cada hallazgo lleva su ficha de
> **Arreglado** más abajo, con el mecanismo y lo medido después.
>
> El resto del informe se conserva tal como se escribió —hipótesis, medidas, no reproducidos y
> juicios—, porque lo que vale de un pase adversario es la evidencia, no el veredicto.

## Promesa

**Que la página de puerto enseñe el estado del mar de ahora y que nunca presente como fresco un dato
que no lo es: cuatro estados con cara propia, cuatro ausencias que dicen cuál es cada una, la edad
medida como intervalo y ni una magnitud dentro del HTML que se construye.**

La parte de esa frase que el `verificador` y el rol `qa` ya cubrieron es *«los cuatro estados se
distinguen»* y *«la edad no rejuvenece con el reloj torcido»*, y aguantan. Lo que quedaba sin atacar
es la otra mitad: **qué pasa cuando el tiempo corre** (el sello se calcula una vez y nadie lo vuelve
a mirar), **qué pasa cuando la red no está caída sino torcida** (un 200 con el cuerpo cambiado, un
endpoint lento), **qué pasa con el contenido ajeno** (el boletín de AEMET maqueta la página) y
**cuánto vale de verdad el trinquete de ADR-01**, que es de quien cuelga toda la decisión de
arquitectura de la trayectoria.

## Clases atacadas

| Clase | Hipótesis (entrada concreta) | Resultado |
|---|---|---|
| **A2** · estado stale | La página se queda abierta en el bolsillo. El sello se calcula una vez, al pintar: adelanto el reloj **de la página** 3 h con `page.clock.fastForward("03:00:00")` | 🔴 **roto** → **H-1** |
| **A3** · fallo parcial | El API contesta **200** con un cuerpo que no tiene la forma del contrato: sin `marine`, con `fetchedAt: "ayer por la tarde"`, con `uvIndex: "1.3"` (cadena) | 🔴 **roto tres veces** → **H-2** |
| **A3** · fallo parcial | El API contesta **200** con un cuerpo que ni siquiera es JSON (`<html>502 Bad Gateway</html>`), contra el API caído de verdad (`connectionrefused`) | 🔴 **roto** → **H-6** |
| **A10** · feedback ausente | AEMET tarda 5 s (dentro de la espera de 8 s) y Open-Meteo contesta al instante: ¿se enseña el mar que ya llegó? | 🔴 **roto** → **H-3** |
| **A12** · promesa vs entregado | El trinquete de ADR-01 se endureció tres veces. ¿Quedan puertas? Cuatro cargas: atributo **sin comillas**, nombre con `_`, nombre con `:`, **comentario HTML** | 🔴 **roto cuatro veces** → **H-4** |
| **A5** · límites 0/1/N-grande | El boletín de AEMET trae un enlace (84 caracteres sin espacios) o un token largo: ¿maqueta el contenido ajeno la página? A 320 y 360 px | 🔴 **roto** → **H-5** |
| **A9** · callejón sin salida | Quien navega con lector de pantalla: `aria-busy` cambia, ¿pero se **anuncia** que llegó el dato o que la fuente cayó? | 🔴 **roto** → **H-7** |
| **A6** · input hostil | `<img src=x onerror=alert(1)>`, `<script>window.__roto=1</script>`, `<b>`, RTL `U+202E`, árabe, emoji, `€`, 5.000 caracteres, en el texto del boletín | 🟢 aguantó (ver *No reproducidos*) |
| **A6** · input hostil | `credential.message` con `SECRETO-NO-MOSTRAR` y un JWT: ¿se pinta la credencial de AEMET? | 🟢 aguantó: ni el texto ni el JWT aparecen en el HTML de la página |
| **A5** · límites | Boletín **sin ninguno de los campos conocidos**, `zone: null`, `issuedAt: null`, texto vacío | 🟢 aguantó |
| **A5** · límites | Números de frontera: `-0`, `360°`, `0.004 m`, altura negativa, `1e21`, motivo del backend de 160 caracteres a 320 px | 🟢 aguantó como formato (dos juicios registrados abajo) |
| **A3** · fallo parcial | HTTP **500** con cuerpo JSON válido | 🟢 aguantó: «El servidor de Mareia no ha servido el estado del mar (HTTP 500)» |
| **A4** · idempotencia | Recargar **a mitad** de la petición (800 ms de retraso, recarga a los 300 ms) | 🟢 aguantó: un solo bloque, sin aviso de carga colgando |
| Promesa · orden del pintado | ¿Hay algún instante en que el dato esté en pantalla sin su sello? Muestreo cada 15 ms durante 1,2 s desde `waitUntil: "commit"` | 🟢 aguantó: solo dos estados observables, `sin-bloque` → `sello/dato` |
| Promesa · a pleno sol | Contraste **real** de la sección, con el color resuelto por el navegador (los tokens son `oklch`) | 🟢 aguantó: peor par 5,42:1 |
| Promesa · el trinquete que ya existía | Las tres puertas que el `verificador` cerró: prosa como nombre de clase, atributo con dígito, valor entre comillas simples | 🟢 siguen cerradas: las tres ponen el gate en rojo |

**Descartadas y por qué.** **A1** (concurrencia/doble envío), **A4** en su forma de mutación,
**A7** (frontera de autorización), **A8** (sesión) y **A11** (reversibilidad) no aplican: la sección
es de **solo lectura**, sin sesión, sin formulario, sin recurso por usuario y sin nada destructivo
que deshacer — los dos endpoints son `GET` públicos del mismo origen. **Nada que escalar al rol
`seguridad` por la vía A7.** De **A4** sí se atacó la variante que existe aquí (recargar a mitad de
la petición), y de **A2** la que existe aquí (el tiempo pasando sobre una página ya pintada), que es
justamente donde está el hallazgo más grave.

## Hallazgos

Siete, todos con su recorrido en rojo **antes** de poner el trinquete. Ninguno es una
vulnerabilidad. **H-1 es el grave**: es la página incumpliendo exactamente la promesa que da nombre
a la trayectoria, y por el mismo mecanismo que ADR-01 dice estar evitando.

Los siete están **arreglados** (2026-08-29): cada ficha lleva al final su commit, el mecanismo y lo
medido *después* del arreglo, con el mismo ataque que lo encontró.

### H-1 · A2 · El sello de antigüedad se congela: a las tres horas sigue diciendo «hace menos de un minuto»

- **Recorrido:** `tests/e2e/journeys/adversarial/a2-sello-congelado.spec.ts`
- **Bundle:** `docs/qa/bundles/t11-adversario/c4c11c16326d/FAILURE.md`
- **Se manifiesta en:** `apps/web/src/modulos/meteo/cliente/isla.ts:montarSeccion` (la llamada
  `vistaMeteo(..., Date.now(), ...)`, que se hace una vez y no se repite).

La isla calcula la edad en el instante en que pinta y no vuelve a tocarla: no hay temporizador, ni
`visibilitychange`, ni `pageshow`. Con la pestaña abierta tres horas —el móvil en el bolsillo, que
es el entorno de uso que manda el design brief— el bloque enseña un dato de hace tres horas rotulado
**«Consultado hace menos de un minuto»**, en verde, sin marca de caducidad y con la hora de consulta
al lado dándole crédito.

Lo que hace este hallazgo distinto de una imprecisión es de dónde viene. ADR-01 justifica **toda** la
arquitectura de la trayectoria —isla hidratada en vez de horneado en build— con esta frase: *«un HTML
horneado no puede sellar su propio dato: el que dice ‘consultado hace 4 minutos’ lo sigue diciendo
veinte horas después»*. El defecto no se ha eliminado: se ha **movido** del momento del build al
momento de abrir la pestaña. La escala cambia (horas en vez de un día) y el usuario que más lo sufre
es el que más se fía, porque el dato lleva su sello.

Medido: `t0` → «Consultado hace menos de un minuto»; `t0 + 3 h` (reloj de la página) → «Consultado
hace menos de un minuto».

**Arreglado** — `5693582` (isla) + `96b41fa`. La edad **sigue viva mientras la página lo está**,
con tres disparadores porque ninguno cubre lo del otro: temporizador de **30 s** (la edad se escribe
al minuto, así el rótulo nunca va más de medio minuto por detrás y no se despierta la CPU cada
segundo en un móvil), **`visibilitychange`** (una pestaña en segundo plano tiene los temporizadores
estrangulados o congelados: al volver hay que poner el rótulo al día *antes* de que lo lea nadie) y
**`pageshow`** (en el bfcache la página se congela entera y vuelve intacta al pulsar «atrás»). El
latido recalcula el sello y **solo toca el DOM si cambia** el texto o el tono: en una página abierta
durante horas eso es no tocar nada casi siempre, y no se le tira de debajo la cita del boletín a
quien la esté leyendo.

Y el **estado cambia, no solo el rótulo**: pasada la ventana de frescura de esa fuente el bloque deja
de tener cara de dato de ahora. El umbral no se lo inventa la página —eso sería re-derivar lo que
manda el backend—: las tres ventanas se mudaron a `packages/modules/weather/src/frescura.ts` y se
exportan desde `@mareia/module-weather/ui` (mar 1 h, atmósfera 30 min, boletín 6 h), así que **cada
fuente tiene la suya**: a los 45 min el mar sigue siendo de ahora y la atmósfera ya no. Las dos
caducidades se leen distinto, porque son dos averías distintas: «la fuente no responde y se sirve lo
último guardado» / «se consultó a las 15:12 y esta página no ha vuelto a preguntar; recarga».

Lo que **no** se hace es refrescar el dato solo: eso convertiría una caída del API en una tormenta de
peticiones desde todos los móviles abiertos (ADR-01 ya lo decidió, y sigue decidido).

Medido después, mismo ataque: `t0` → «Consultado hace menos de un minuto»; `t0 + 3 h` (reloj de la
página) → «**Dato de hace 3 h**», en la cara de caducado. **ADR-01 actualizado**: su argumento
central era refutable con una pestaña abierta y ahora cuenta qué hace la isla para que vuelva a ser
verdad.

### H-2 · A3/A6/A9 · Un 200 con el cuerpo cambiado mata la isla y la sección se queda «Pidiendo el estado del mar…» para siempre

- **Recorrido:** `tests/e2e/journeys/adversarial/a3-respuesta-hostil.spec.ts` (3 recorridos)
- **Bundles:** `8e4157cf2166` (sin `marine`), `92a0fe01f43d` (`fetchedAt` no parseable),
  `d642b4e833d8` (magnitud como cadena)
- **Se manifiesta en:** `cliente/isla.ts:traer` (devuelve `{ok:true}` para cualquier 2xx sin mirar el
  cuerpo) y `modulos/meteo/vista.ts`, que da la forma por hecha.

`traer()` sólo se defiende de dos cosas: que la petición no salga y que el estado no sea 2xx. Un 200
pasa entero a `vistaMeteo`, que lee `cuerpo.marine.status`, mete `fetchedAt` en `Date.parse` y llama
`.toFixed()` sobre cada magnitud. Tres entradas realistas —un backend a medio desplegar, un proxy que
contesta su propio JSON, una versión del módulo por delante de la del sitio construido— lanzan
excepción:

| Entrada | Excepción observada |
|---|---|
| `{"port":…,"status":"ok"}` sin `marine` | `Cannot read properties of undefined (reading 'status')` |
| `marine.fetchedAt: "ayer por la tarde"` | `Invalid time value` (`Intl.DateTimeFormat.format`) |
| `forecast.data.uvIndex: "1.3"` (cadena) | `e.toFixed is not a function` |

Y como `montarSeccion` es una promesa que nadie espera (`void montarSeccion(anclaje)`), la excepción
**no se ve**: no hay `catch`, no hay estado de error. Lo que queda en pantalla es
**«Pidiendo el estado del mar…» con `aria-busy="true"`, indefinidamente**. La sección afirma estar
pidiendo algo que ya no está pidiendo — no es ninguno de los cuatro estados que promete la
trayectoria, es un quinto estado que miente — y del que sólo se sale recargando a mano (A9: no hay
salida desde ahí, ni un enlace, ni un botón).

**Arreglado** — `b4e3bf9`. `traer()` pasa el cuerpo por un portero (`modulos/meteo/contrato.ts`)
antes de dárselo a la vista, y `montarSeccion` ya no se lanza sin `catch`: si algo imprevisto lanza,
se cierra el `aria-busy` y se dice que la sección no se ha podido pintar, en vez de dejar el aviso de
carga colgado. Dos decisiones escritas en la cabecera del portero: se valida **el cuerpo entero o no
se usa ninguno** (publicar la mitad de una respuesta que ya incumplió el contrato es enseñar un
número que no se puede defender; la degradación parcial de verdad la expresa el propio contrato con
`unavailable`), y las magnitudes se enumeran con `Record<keyof …, true>` para que renombrar un campo
del módulo **no compile** en vez de colarse en silencio.

Medido después: los tres cuerpos hostiles resuelven a «No se ha podido traer» en ~300 ms —antes el
recorrido agotaba los 10 s de espera con `aria-busy="true"`— y `aria-busy` queda en `"false"`. 15
tests nuevos en `contrato.test.ts` (los cinco estados reales del endpoint pasan; las tres entradas
del hallazgo, no).

### H-3 · A10/A3 · El bloque que ya llegó se queda de rehén del que tarda

- **Recorrido:** `tests/e2e/journeys/adversarial/a10-bloque-rehen.spec.ts`
- **Bundle:** `7a743a15109f`
- **Se manifiesta en:** `cliente/isla.ts:montarSeccion` (`Promise.all` de los dos endpoints antes de
  pintar).

La cabecera de `isla.ts` declara: *«los dos endpoints se piden por separado y fallan por separado:
que AEMET no conteste no puede dejar sin viento a quien mira la página»*. Se **piden** por separado,
pero se **pintan** juntos. Con AEMET contestando a los 5 s —dentro de la espera de 8 s, así que no
es el caso caído que sí cubren los recorridos confirmatorios— el estado del mar ya está descargado en
el navegador y el usuario sigue leyendo «Pidiendo el estado del mar…». Con AEMET colgado del todo son
los 8 s completos.

El boletín de AEMET es justamente el endpoint lento del par (fuente ajena, caché de horas). Y el
desenlace de A10 es A1: quien no ve nada, recarga — y recargar vuelve a pedir los dos.

**Arreglado** — `88e0b46`. Cada respuesta se anota y repinta **en cuanto llega**. Para que eso no
inventara un estado nuevo, la vista gana el que le faltaba —`PIDIENDO`, con su sello por bloque, que
dice **qué** falta y no un «cargando» genérico— y el primer pintado es ese esqueleto: la sección
nunca está en un estado que no sea uno de los suyos, ni durante la espera. El `aria-busy` se cierra
cuando han contestado los dos, que es cuando deja de estar ocupada de verdad. La edad se sigue
midiendo desde la **primera** respuesta: sobreestimar unos segundos la de la que llegó después es la
dirección segura.

Medido después, mismo ataque (AEMET a 5 s): el mar está en pantalla con su sello **antes de los 3 s**;
antes no estaba.

### H-4 · A12 · El trinquete de ADR-01 tiene cuatro puertas abiertas

- **Recorrido:** `tests/e2e/journeys/adversarial/a12-trinquete-adr01-permeable.spec.ts` (4 recorridos)
- **Bundles:** `9cc1dea283bb` (sin comillas), `ebcf37e59a1e` (`_`), `e0610e0b850f` (`:`),
  `045995b95405` (comentario)
- **Se manifiesta en:** `apps/web/src/sitio-construido.test.ts:atributosInesperados` (la expresión
  regular del barrido) y `textoDe` (el borrado de etiquetas).

El gate que protege ADR-01 ya se endureció tres veces, y lo que cerró sigue cerrado. Pero el barrido
de atributos es `/\s([a-zA-Z0-9-]+)=("[^"]*"|'[^']*')/` y el texto se extrae borrando `<[^>]+>`. De
ahí salen cuatro cargas que **llegan al HTML publicado, dentro de `#meteo`**, y dejan el gate en
verde:

| Carga inyectada en el `dist/` | Por qué pasa |
|---|---|
| `data-ola=1,68m` | HTML permite el valor **sin comillas**; la regex las exige. |
| `data_ola="1,68 m"` | el nombre lleva `_`, que no está en `[a-zA-Z0-9-]`. |
| `x:ola="1,68 m · viento 9,4 km/h"` | el nombre lleva `:`, tampoco. |
| `<!-- meteo horneada: ola 1,68 m · viento 9,4 km/h · 1021,5 hPa -->` | un comentario se borra como si fuera una etiqueta: no queda texto que comparar contra la lista blanca. |

Las tres primeras son atributos legales de HTML5 y legibles con `getAttribute()`; la cuarta es el
sitio clásico donde un framework deja su carga de hidratación. No hace falta mala fe: basta con que
alguien decida «dejo el último dato en el HTML por si el API tarda» — que es exactamente la tentación
que ADR-01 existe para bloquear. Mientras estas puertas estén abiertas, la garantía de ADR-01 vale
menos de lo que su propio test dice que vale.

**Método (importa).** No se toca una línea de producción: se inyecta en el **artefacto publicado**,
que es lo que el gate lee, y **antes de dictaminar nada se comprueba que la carga está de verdad
dentro de `#meteo` en el `dist/`** — una sonda que no comprueba eso mide su propio parche y falla en
verde, que es la dirección peligrosa. Si la carga no llega, el recorrido dice `INCONCLUSO` en vez de
declarar el gate ciego. El fichero se restaura siempre (`finally`), y la página elegida
(`la-manga-del-mar-menor`) no la abre ningún otro recorrido.

**Arreglado** — `5baebac`. El gate deja de barrer la sección con una regex que tiene que exigir
comillas para no confundir el texto con atributos: ahora parsea **etiqueta a etiqueta** y dentro de
cada una lee sus atributos con el nombre que dice la especificación (todo menos espacio, `=`, `/`,
`>` y comillas) y el valor con comillas, con comillas simples o **sin ellas**. Deja de depender de la
FORMA del atributo: lo que el navegador lea con `getAttribute()` pasa por la tabla, y los booleanos
(`hidden`, los anclajes `data-meteo-*`) entran con cadena vacía, así que también se declaran. Los
comentarios se comprueban aparte: **ni uno** dentro de `#meteo`.

Medido después con el mismo método —inyectar en el `dist/`, verificar que la carga está dentro de
`#meteo`, correr el gate como lo corre CI—: las cuatro cargas ponen el gate en **rojo** (antes,
exit 0 las cuatro). Las tres puertas que ya estaban cerradas siguen cerradas (sonda con `title='…'`,
`data-ola1="…"` y prosa como clase) y el gate sigue **verde con el `dist/` limpio**.

### H-5 · A5/A6 · Un enlace en el boletín de AEMET desborda la página en el móvil

- **Recorrido:** `tests/e2e/journeys/adversarial/a5-boletin-desborda.spec.ts` (320 y 360 px)
- **Bundles:** `c1231393134b` (320 px), `4efa92723f8e` (360 px)
- **Se manifiesta en:** `apps/web/src/estilos/meteo.css` (`.meteo__cita`, sin política de partición
  de palabra) sobre el texto que inyecta `cliente/isla.ts:pintarCita`.

El boletín es prosa ajena que se pinta tal cual —bien: se cita, no se reescribe— dentro de un
`<blockquote class="meteo__cita">` que es un flex en columna. El mínimo de contenido de un hijo flex
es su palabra más larga, y la hoja no declara `overflow-wrap`. Basta un enlace de los que AEMET pone
en sus propios boletines (84 caracteres sin espacios) para que esa palabra le imponga el ancho a toda
la sección:

| Ventana | `scrollWidth` | Desborde | Quién empuja |
|---|---|---|---|
| 320 px | 490 px | **+170 px** | `.meteo` → `.meteo__bloques` → `.meteo__bloque` → `.meteo__cita` → `<p>` |
| 360 px | 490 px | **+130 px** | ídem |
| 412 px (Pixel 7) | 491 px | +79 px | ídem |

La página entera se desplaza en horizontal. Es el mismo fallo que el pase de T-09 dejó gateado a
320/360 px, y este contenido lo esquiva por una razón estructural: **no está en el HTML construido**,
lo inyecta la isla en el navegador, así que ningún gate que mire el `dist/` puede verlo.

**Arreglado** — `e924393` y `f62dc7b`. `overflow-wrap: anywhere` en `.meteo__cita`, y no
`break-word`: solo `anywhere` baja el **ancho mínimo de contenido**, que es lo que aquí desbordaba —
`break-word` parte al pintar pero sigue midiendo la palabra entera—. Medido después: el `scrollWidth`
vuelve a ser el de la ventana a 320 y a 360 px.

Y una sonda propia encontró **la otra puerta del mismo hallazgo**, que este pase no llegó a abrir: el
`reason` del backend también es texto que no escribimos nosotros y puede traer la URL que falló. Con
la URL de Open-Meteo dentro, la página se desplazaba **49 px a 320**. Misma cura en
`.meteo__sello-detalle`; medido después, 320 de 320. (El pase probó un motivo largo *con* espacios y
por eso aguantó: la diferencia la hace la palabra sin espacios, no la longitud.)

### H-6 · A3 · Dos de las cuatro ausencias se leen exactamente igual

- **Recorrido:** `tests/e2e/journeys/adversarial/a3-respuesta-hostil.spec.ts` (último recorrido)
- **Bundle:** `6af5dbe76a62`
- **Se manifiesta en:** `cliente/isla.ts:traer` — el `catch` único cubre el fallo de red y el fallo de
  `respuesta.json()`.

La promesa son **cuatro ausencias, cada una diciendo cuál es**. Cuando el API contesta 200 con un
cuerpo que no es JSON (un proxy de por medio devolviendo su página de error), `respuesta.json()`
lanza y cae en el mismo `catch` que el fallo de red, así que la sección publica:

> No se ha podido **pedir** el estado del mar al servidor de Mareia.

…que es la frase reservada a *«el navegador ni siquiera pudo preguntar»*. Preguntó, y le contestaron
con un 200. Las dos causas —el servidor contesta algo ilegible / la petición no sale— producen hoy un
texto **idéntico carácter por carácter**, comprobado comparando las dos cadenas en el mismo recorrido.
Es exactamente la lección del hallazgo A-11 de T-09 (un `null` que significaba dos cosas), en la capa
de red y con dos de los cuatro ausentes de esta trayectoria.

Nota de contraste: con un HTTP **500** el mensaje sí es el correcto y distinto («El servidor de Mareia
no ha servido el estado del mar (HTTP 500)»). El hueco es sólo el del 2xx ilegible.

**Arreglado** — `b4e3bf9`, en el mismo sitio que H-2. El `json()` tenía su `try` compartido con el
`fetch`, así que un cuerpo ilegible se contaba como «la petición no salió». Ahora hay **cuatro**
motivos y cada uno dice el suyo: la petición no sale / el estado no es 2xx / 2xx con un cuerpo que no
es JSON / 2xx con otra forma. Medido después: el recorrido compara las dos frases y ya **no son
iguales**.

### H-7 · A9 · Para un lector de pantalla, la sección se queda en el estado que salió del `dist/`

- **Recorrido:** `tests/e2e/journeys/adversarial/a9-sin-anuncio-a-lector.spec.ts`
- **Bundle:** `72a13d0b64fc`
- **Se manifiesta en:** `componentes/Meteo.astro` (el marcado estático) y `cliente/isla.ts:pintar`
  (el `replaceChildren` sobre un contenedor que no es región viva).

La sección declara `aria-busy` y lo mueve de `"true"` a `"false"` cuando llega el dato. `aria-busy`
dice *«esto está cambiando, no lo leas todavía»*: **no anuncia nada**. Como el contenido se sustituye
con `replaceChildren` dentro de contenedores que no son regiones vivas —ningún `aria-live`, ningún
`role="status"` en toda la sección: comprobado recorriendo `#meteo` y todos sus descendientes—, quien
navega con lector de pantalla oye una vez «El estado del mar todavía no ha llegado» (el cuarto
estado, el que viaja en el HTML) y **nunca se entera** de que llegó el dato, ni de que la fuente se
cayó, ni de que lo que hay en pantalla es de hace tres horas.

Los cuatro estados tienen cara propia para quien mira la pantalla. Para quien no la mira, hay uno
solo, y es el que menos información lleva.

**Arreglado** — `96b41fa`. Un párrafo `role="status" aria-live="polite"` que viaja **vacío en el
HTML construido** —una región viva que aparece en el DOM a la vez que su texto no la anuncia nadie— y
que la isla rellena con la situación de cada bloque cada vez que la sección cambia de estado.

Lo que dice está pensado para no volverse ruido: habla del **estado** de cada fuente y nunca de la
edad. Si llevara la antigüedad cambiaría cada minuto y el lector interrumpiría para cantar «hace
cuatro minutos, hace cinco minutos»; así solo habla cuando hay noticia —el dato llegó, la fuente
cayó, el dato dejó de ser el de ahora—. Mientras no ha contestado ninguno de los dos endpoints se
calla: eso ya lo dice el texto que viaja en el HTML.

Medido después: la sección tiene **una** región viva (antes, cero) y dice, por ejemplo, «Estado del
mar, ya está en la página. Atmósfera, no se ha podido traer. Boletín marítimo de AEMET, no se ha
podido traer.». El recorrido A9 exige que la región exista; como una región viva **vacía** sería tan
muda como no tenerla, el recorrido confirmatorio afirma además lo que dice.

## No reproducidos

Lo que se intentó, con su entrada concreta, y aguantó. Sin este inventario una pasada estéril y una
alucinada se ven igual desde fuera.

| Sospecha | Entrada concreta | Qué pasó al intentarlo |
|---|---|---|
| El boletín de AEMET es prosa ajena: se podrá inyectar HTML | `<img src=x onerror=alert(1)>`, `<script>window.__roto=1</script>`, `<b>negrita</b>` en `prediccion.texto` | **Aguantó.** 0 nodos `<img>`/`<script>`/`<b>` en el bloque; `window.__roto` sigue `undefined`. Todo entra por `textContent`, como declara la cabecera de `isla.ts`. |
| Unicode hostil rompe la cita | RTL `U+202E`, árabe, emoji, `€`, `ñáéíóú` | **Aguantó.** Texto íntegro, sin recortes ni mojibake. |
| La credencial de AEMET se filtra | `credential.message = "SECRETO-NO-MOSTRAR eyJhbGciOiJIUzI1NiJ9.PAYLOAD.SIG"` | **Aguantó.** Ni la marca ni el JWT aparecen en el HTML de la página: la UI compone su propia frase desde `status`/`expiresAt`. (Confirma la sonda del `verificador` con una carga distinta.) |
| Contraste flojo, como en T-10 | Los 10 pares de la sección, con el color resuelto por el navegador (los tokens son `oklch`) | **Aguantó.** Peor par 5,42:1 (titular caducado, `--m-terra`); cuerpo 5,78:1; valores 12,59:1. **Aviso de método:** mis dos primeras medidas dieron 1,12:1 y 1,38:1 y **eran falsas** — la primera leía el fondo de `body`, que es transparente, y la segunda parseaba `oklch(...)` como si fuera `rgb(...)`. Sólo la tercera, resolviendo el color con un `canvas`, mide algo. Un rojo inventado cuesta tanto como un verde inventado. |
| El motivo largo del backend desborda en móvil | `reason` de 160 caracteres con un UUID, a 320 px | **Aguantó** (320/320): la frase tiene espacios y parte bien. El desborde de H-5 lo causa una palabra **sin** espacios. |
| Los números de frontera se escriben mal | `-0` → «0,00 m»; `360°` → «360° (N)»; `1e21`; `0,004 m` → «0,00 m»; altura `-3.2` → «-3,20 m» | **Aguantó como formato.** Dos observaciones se registran abajo como juicio, no como hallazgo. |
| El boletín sin los campos conocidos deja un hueco mudo | `document: [{elaborado, cosa}]`, `zone: null`, `issuedAt: null`, texto vacío | **Aguantó.** «AEMET respondió, pero el documento no trae ninguno de los campos de texto conocidos», «zona sin asignar», «AEMET no declara la hora de elaboración». |
| Un 500 se confunde con otra ausencia | HTTP 500 con cuerpo JSON válido | **Aguantó.** «El servidor de Mareia no ha servido el estado del mar (HTTP 500)»: distinto de los otros tres. |
| Recargar a mitad de la petición duplica o deja basura | 800 ms de retraso, `reload()` a los 300 ms | **Aguantó.** Un solo bloque de mar, cero avisos de carga visibles, sin estado a medias. |
| El dato aparece antes que su sello (o al revés) | Muestreo del bloque cada 15 ms durante 1,2 s desde `waitUntil: "commit"` | **Aguantó.** Sólo dos estados observables: `sin-bloque` → `sello/dato`. `replaceChildren` pinta el bloque entero de una vez. |
| Las tres puertas que el `verificador` cerró en el trinquete de ADR-01 se han vuelto a abrir | Prosa como nombre de clase (`class="mar rizada 1,68 m"`), atributo con dígito (`data-ola1="1,68 m"`), valor entre comillas simples (`title='mar rizada o marejada'`), las tres inyectadas en el `dist/` y verificadas presentes | **Siguen cerradas.** Las tres ponen el gate en rojo. |
| Meteo horneada **fuera** de `#meteo` (la lista negra del perímetro) | `<script type="application/ld+json">{"ola":"1,68 m"}</script>` y texto suelto dentro de la sección | **Aguantó**: el gate muerde. |
| Los gates de T-09 y T-10 se han caído con el HTML nuevo | `pnpm --filter web build` + la suite `node --test` completa, y los 9 recorridos confirmatorios | **Aguantaron**: todo en verde con el `dist/` de esta rama. |

### Juicios (A12 · sin repro, se ponderan distinto)

- **J-1 · «0,00 m» significa dos cosas.** La promesa reserva «0,00 m» para *un cero medido*
  («`windWaveHeightM: 0`» sí se publica como cero, y eso funciona). Pero `0,004 m` —4 mm de mar de
  viento, un dato real y distinto de cero— también se escribe «0,00 m». Es redondeo honesto y
  ninguna norma dice lo contrario; se anota porque la trayectoria eligió esa cadena exacta como
  portadora de un significado, y hay dos entradas que la producen.
- **J-2 · Una altura de ola negativa se publica tal cual.** `swellWaveHeightM: -3.2` sale como
  «-3,20 m», con su dirección y su periodo, con sello de dato fresco y sin ninguna marca. Es un valor
  físicamente imposible, y validar el rango es del contrato del módulo (T-08), no de la vista — por
  eso es juicio y no hallazgo. Pero hoy la última línea antes del ojo del usuario no tiene ninguna
  defensa, y la página cuyo argumento es la transparencia afirmaría un imposible sin pestañear.

## Recuento

**7 hallazgos reproducidos** (13 recorridos en rojo, 13 bundles) · **12 sospechas no reproducidas** ·
**2 juicios sin repro** · clases atacadas A2, A3, A5, A6, A9, A10, A12 · descartadas con motivo A1,
A4 (mutación), A7, A8, A11.

**Nada que escalar al rol `seguridad`**: no hay superficie A7 y no se ha filtrado ningún secreto.

## Cierre (2026-08-29)

**Los 7 arreglados**, cada uno comprobado en rojo con el arreglo revertido antes de retirarle el
`test.fail()`, y sin tocar un solo assert de los recorridos. Los **13 ataques quedan como gate
permanente** en `tests/e2e/journeys/adversarial/`, junto a los **10 confirmatorios**: 23 recorridos
en verde de verdad, más 95 tests de `apps/web` (24 nuevos: 15 del portero del contrato y 9 de la
vista), 62 del módulo weather, 20 de la API, `lint`, `typecheck` y `astro check`.

Lo que **no** se ha tocado y sigue abierto, con su motivo:

- **J-1 y J-2 siguen siendo juicios sin repro** y siguen igual. J-2 (una altura de ola negativa se
  publica tal cual) es de **validación de rango del contrato del módulo**, T-08, no de la vista: el
  portero nuevo comprueba que una magnitud sea un número finito o `null`, no que sea físicamente
  posible. Arreglarlo aquí sería poner la defensa en la última capa y dejar el API publicando el
  imposible por su cuenta.
- **El pase no volvió a correrse entero contra el código arreglado**: eso es del siguiente pase
  adversario, no de quien arregla — el sesgo de quien parchea es exactamente el que el rol existe
  para evitar. Lo que sí se corrió es el ataque de cada hallazgo, más los 23 recorridos y la suite
  completa.
- **Una sonda propia abrió la segunda puerta de H-5** (el `reason` del backend con una URL larga,
  +49 px a 320) y se arregló con la misma cura, pero **no tiene recorrido-gate**: el ataque que se
  versiona es el que el pase reprodujo. Si vuelve a hacer falta, ahí está la medida.
