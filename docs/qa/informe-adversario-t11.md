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

> **Trinquete.** Los 13 recorridos llevan `test.fail()`: **CI sigue en verde** con los siete
> hallazgos abiertos (22 pasan: 13 fallos esperados + los 9 recorridos confirmatorios). El día que
> alguien arregle uno, Playwright gritará que «pasó lo que se esperaba que fallara» → se quita el
> `test.fail()` de esa línea y el ataque queda como **gate permanente**. Cada assert afirma **el
> comportamiento correcto**, nunca el síntoma: por eso el mismo cuerpo pasa a verde el día del fix
> sin tocar una línea.

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
