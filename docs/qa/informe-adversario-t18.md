# Informe adversario — la credencial de AEMET en el borde público (T-18)

- **Trayectoria:** T-18 · **PR:** #17 (`claude/T-18-credencial-borde-publico`) · **Fecha:** 2026-08-29
- **Superficie atacada:** los cuatro cuerpos públicos del módulo `weather`
  (`GET /v1/modules/weather/weather`, `GET .../bulletin` en sus dos ramas y el `healthcheck()`), el
  texto que la sección meteo pinta a partir de ellos (`vista.ts`), los tres fixtures de boletín de la
  web, el `dist/` horneado (33 páginas) y el canal del operador (`scripts/check-aemet-key.ts` +
  `.github/workflows/aemet-key.yml`).
- **Entorno:** local y efímero, sin red hacia fuera. Node 22.22.2 con el módulo montado detrás de
  Express y hablado **por HTTP** (nunca llamando a la función que se cree responsable); Deno 2.9.6
  —el runtime de `apps/api` en producción— para medir la forma real del error de `fetch` y para
  ejecutar el canal del operador. Sin cloud, sin prod: ni el diff, ni el DOM, ni el código han salido
  del contenedor, y ningún modelo externo ha revisado nada.
- **Reproducciones:** `packages/modules/weather/src/__tests__/adversario-t18.test.ts` (4 hallazgos en
  5 cuerpos + 3 gates) y `apps/web/src/modulos/meteo/adversario-t18.test.ts` (A-18 en la pantalla +
  1 gate). Los cuatro hallazgos van con el trinquete `hallazgoAbierto()` puesto: **CI queda en
  verde** mientras estén abiertos y se pone rojo el día que se arreglen.
- **Bundle:** `docs/qa/bundles/t18-adversario/FAILURE.md` — el run **en rojo** de los cinco cuerpos,
  tomado antes de poner el trinquete, con los cuerpos HTTP tal cual salieron por el cable.
- **Contexto asimétrico:** se ha leído **la promesa** (el plan como enunciado de contrato,
  `payload.ts`, `aemet-key.ts`, `aemet.ts`, `errors.ts`, `http-json.ts`, `vista.ts`, el workflow del
  operador) y el código **para dirigir los ataques** — qué campo sale por dónde, con qué reloj, desde
  qué caché. **No** se ha leído la justificación del diff ni el razonamiento del implementador sobre
  por qué eligió cada cosa: ése es exactamente el modelo mental que aquí no hay que compartir.

## Nota de método

Dos sondas de esta épica dieron falsos verdes por comprobar la función y no el artefacto. Aquí
**todos** los asertos de los cuatro hallazgos se hacen sobre el **cuerpo HTTP publicado** —módulo
montado en Express, `fetch` real contra el puerto, `JSON.parse` de lo que llegó— o sobre el texto que
la vista produce para la pantalla. `inspectAemetKey` solo se usa como *guardia del escenario* («que
este caso sea de verdad el estado que dice»), nunca como sujeto.

El trinquete es `test.fail()` traducido a `node --test`, **con un diente más**: además de exigir que
el cuerpo falle, exige que falle **por la seña del hallazgo**. La skill declara como caveat que
`test.fail()` se conforma con cualquier fallo y que por eso un test podrido se pudre en silencio;
aquí un cuerpo que reviente por otra cosa pone el CI en rojo diciéndolo. Ya sirvió durante este mismo
pase: el segundo escenario de A-17 pasaba por un error del arnés (un *spread* congelaba el secreto) y
el envoltorio lo cazó en la primera ejecución en vez de contarlo como hallazgo vivo.

## Promesa

> El borde público del módulo weather **no publica el manual de quien administra la instancia** —ni
> el nombre de la variable de entorno, ni la URL de alta, ni la instrucción de renovar— **y aun así
> sigue diciendo el hecho**: quien consume el API puede seguir sabiendo *por qué* no hay boletín. El
> aviso completo se queda intacto en el canal del operador.

Son **tres** compromisos, y el pase ataca los tres por separado: no decir de más (A-18), **seguir
diciendo el hecho** —y que el hecho sea verdad— (A-17, A-19, A-20), y no romper el canal del operador
al recortar el público (residuo R-1).

## Clases atacadas

| Clase | Qué se intentó | Resultado |
|---|---|---|
| **A5** · límites 0/1/N | `exp` en el borde del rango de `Date` (8 640 000 000 000 ± 1), en microsegundos (1e14) y negativo desmesurado; clave vacía, sólo espacios, JWT de 2 segmentos, payload que no es objeto. | **A-19** · el borde del rango rompe el endpoint. |
| **A6** · input hostil | Texto del upstream (`descripcion` de AEMET) en el sobre `estado != 200`; `datos` apuntando a otro origen; documento con charset raro; slug con `<script>` y `../`. | **A-18** · el `descripcion` se republica literal. El resto aguantó. |
| **A9** · callejón sin salida | Provocar cada estado degradado y preguntar qué le queda a quien consume el API. | Plegado en **A-19**: un 500 no lleva `credential` ni `reason`. |
| **A12** · promesa vs entregado | Releer qué promete el cuerpo público **ignorando el ticket**: ¿se contradice a sí mismo? ¿cuadran sus números entre ellos? ¿la frase obligatoria dice algo verdadero? | **A-17** y **A-20**. |
| **A2** · estado stale | Caché caliente y el secreto cambiando debajo (borrado, caducado); dato servido `stale` con la credencial ya en otro estado. | Es el vehículo de **A-17** (segundo escenario). |
| **A4** · idempotencia | Repetir `/bulletin` con el estado de credencial cambiado entre peticiones; el estado se recalcula por petición con el reloj inyectado. | No rompió (queda el gate del reloj). |
| **A1** · concurrencia | Dos `/bulletin` simultáneos sobre la misma zona con la caché fría. | **Descartada tras probar**: sin escritura de dominio, el peor caso es una petición de más al upstream; no afecta a la promesa. |
| **A3** · fallo parcial | Red caída y timeout en las dos llamadas a AEMET, con y sin `urls.aemet` inyectada. | No rompió → **gate del punto ciego** (abajo). |
| **A7** · autorización | **Descartada con motivo**: el módulo no tiene fronteras de autorización — dos GET sin sesión, sin usuario y sin recurso ajeno. Nada que escalar a `seguridad`. |
| **A8** · sesión y caducidad | **Descartada con motivo**: el borde es sin estado y sin cookies. La única «caducidad» es la de la credencial, y va por A-17/A-20. |
| **A10** · feedback ausente / **A11** · reversibilidad | **Descartadas con motivo**: no hay acción de usuario que confirmar ni nada destructivo que deshacer en esta superficie. La mitad «obligar a decir algo» que sí toca a A10 se atacó desde A-17. |

## Hallazgos

Los cuatro **abiertos**, cada uno reproducido en rojo antes de ponerle el trinquete. Bundle común:
`docs/qa/bundles/t18-adversario/FAILURE.md`.

### A-17 · A12 · El cuerpo público publica el boletín y en la misma respuesta dice que no lo publica

T-18 sustituyó el `message` público por una frase «neutra derivada del `status`». Dos de las cinco no
son neutras: **afirman un hecho** —«…: no publica el boletín oficial»— y ese hecho es falso en dos
situaciones alcanzables:

- **`expired`** · la caducidad se lee **en local**, del `exp` del JWT y con el reloj del servidor. Que
  la fecha haya pasado no impide que AEMET siga sirviendo, ni —sobre todo— que la caché del propio
  módulo siga entregando el boletín durante 4×TTL (`RETAIN_FACTOR`).
- **`missing`** · el operador borra o rota el secreto con la caché caliente: la credencial pasa a
  `missing` y el boletín se sigue sirviendo.

En los dos casos la respuesta lleva `"status":"ok"`, el `document` entero de AEMET, y al lado
`"message":"…no publica el boletín oficial"`. Quien consume el API no puede decir *por qué* no hay
boletín: le están diciendo que no lo hay **mientras se lo entregan**.

Es regresión de esta trayectoria, no algo heredado: el `message` de `expired` de T-08 decía una fecha
(«caducó hace N día(s)»), que era verdad. El nuevo dice una **consecuencia**, que no siempre lo es. La
mitad que obliga a decir algo se cumplió —frase no vacía, distinta por estado, con «AEMET»— y aun así
lo que se publica es falso: eso es exactamente lo que preguntaba el objetivo 4.

- Se manifiesta en `packages/modules/weather/src/aemet-key.ts:214` y `:218` (las dos frases) leídas
  desde `module.ts:271` y `:295`.
- Repro: `adversario-t18.test.ts` · los dos cuerpos «A-17 …».
- Aserto: si el cuerpo trae el `document`, la frase pública de la credencial no puede negar que se
  publique. **No congela la prosa**: reescribir la frase sin la negación lo pone verde.

### A-18 · A6 · La tercera copia de la fuga: el `reason` republica lo que escribe AEMET

El implementador encontró dos copias del manual del operador (`credential.message` y el `reason` que
redactamos nosotros) y montó un gate que serializa la respuesta entera buscando cinco señas. Hay una
tercera y el gate no puede verla, porque no la escribimos nosotros: el `descripcion` que devuelve
AEMET en un sobre con `estado != 200` viaja **literal** al `reason` público
(`aemet.ts:139`), sin más filtro que un recorte a 200 caracteres.

Con un 401 redactado como se redactan los errores de credencial —diciendo dónde se pide una nueva—,
el cuerpo público publica `opendata.aemet.es` y `centrodedescargas`: **dos de las cinco señas que la
propia trayectoria declaró prohibidas**. Y no se queda en el JSON: `vista.ts:502` compone «(el
servidor informa: `${reason}`)» y el texto acaba **en la pantalla**, por los dos caminos de
`motivoDelBoletin` (con credencial `valid` el `reason` se pinta solo; con `expired`, detrás de la
frase de la credencial). El gate de T-18 sí ejercita la rama del 401, pero con un `descripcion`
elegido para no morder: mide la rama sin medir el canal.

> **Honestidad sobre el ataque.** El texto exacto que devuelve AEMET en un 401 **no está verificado en
> este repositorio** — no hay clave con la que comprobarlo, la misma razón por la que las zonas siguen
> con `verified: false`. Lo que este recorrido demuestra no es qué dice AEMET, sino que **nada mira lo
> que dice** antes de republicarlo en el borde público y en la página. Un canal de paso sin filtro es
> una copia de la fuga esperando a que el upstream escriba la frase.

- Repro: `adversario-t18.test.ts` (cuerpo HTTP) y `apps/web/src/modulos/meteo/adversario-t18.test.ts`
  (la pantalla, los dos caminos).
- Aserto: el `reason` que sale por HTTP —y el texto que lee un humano— no lleva las señas del canal
  del operador, **las haya escrito quien las haya escrito**.

### A-19 · A5 · Una clave que no entendemos rompe el endpoint en vez de degradarlo

`inspectAemetKey` tiene una rama explícita para «una clave que no entendemos» (`unreadable`) y su
comentario la razona bien. Pero solo comprueba **la forma** del `exp` (`typeof number` +
`Number.isFinite`), no **el rango**: un `exp` finito que multiplicado por 1000 se sale del rango de
`Date` hace que `new Date(…).toISOString()` lance `RangeError` desde dentro de la función pura
(`aemet-key.ts:124`). Umbral medido: `exp = 8 640 000 000 000` pasa; `+1` revienta.

`bulletinHandler` la llama en sus dos ramas, así que `GET /bulletin` devuelve **HTTP 500 «Error
interno sirviendo la petición»** — sin `credential`, sin `reason`, sin hecho. Y `healthcheck()` lanza
**síncronamente**, de modo que el día que `/health` lo conecte (deuda de T-15) se lleva la salud por
delante. Es la promesa incumplida por el lado contrario al que se vigiló: no se filtra nada porque no
se publica nada.

- Repro: `adversario-t18.test.ts` · «A-19 …», con `exp: 1e14` (un `exp` en microsegundos, que es la
  confusión de unidad plausible; también revienta un negativo desmesurado).
- Aserto: HTTP 200 y `credential.status === "unreadable"`. El módulo degrada, no rompe.

### A-20 · A12 · El `daysLeft` público no cuadra con el `expiresAt` que viaja a su lado

`daysBetween` hace `Math.floor((exp - now) / DÍA)`, y para una diferencia negativa eso redondea
**hacia abajo**: **un milisegundo** después de caducar, el cuerpo público ya publica `daysLeft: -1`
junto a un `expiresAt` de hace 1 ms. No es un decimal perdido: es un día entero de más, siempre,
desde el primer milisegundo, y en los dos canales a la vez, porque el aviso al operador interpola ese
mismo número («caducó hace 1 día(s)»).

Ya está en dato commiteado: el fixture que esta misma trayectoria re-proyectó
(`fixtures/bulletin-clave-caducada.json`) lleva `expiresAt: 2026-07-20` con `daysLeft: -40` para un
`now` de `2026-08-28T13:37Z` — habían pasado **39** días completos.

Importa porque `daysLeft` es el único número con el que un consumidor decide si el hueco de boletín es
de esta mañana o de la semana pasada, y porque la promesa dice que **el hecho** sigue viajando: un
hecho que se equivoca en un día no es el hecho.

- Repro: `adversario-t18.test.ts` · «A-20 …», afirmado sobre el cuerpo HTTP.
- Aserto, sin prosa: `|daysLeft| × DÍA <= (now − expiresAt)`. Es decir, los días que se publican
  tienen que haber pasado de verdad.

## No reproducidos

Lo que se intentó, con entrada concreta, y **no rompió**. Va aquí porque es lo único que distingue una
pasada estéril de una alucinada.

1. **El punto ciego del camino real (objetivo 1) — el que regaló la verificación.** El gate de T-18
   nunca ejercita la URL por defecto porque todos sus escenarios inyectan `urls.aemet`, y
   `AEMET_BASE_URL` **contiene la seña `opendata.aemet.es`**. Montado el módulo **sin** `urls` y con
   la forma de error que produce de verdad el runtime de producción (medida en Deno 2.9.6, con y sin
   proxy): `TypeError: fetch failed` con la URL **en la `cause`**, no en el `message`; y el timeout,
   `TimeoutError: The operation was aborted due to timeout`, sin `cause`. `http-json.ts:40` compone
   con `cause.message`, así que **la URL no sale**. Probadas además las cadenas de causas anidadas, la
   **segunda** llamada (la de `datos`, que no pasa por `fetchJson` y llega cruda a `reasonFrom`) y el
   sobre que apunta a otro origen: cuatro escenarios, cero señas en el cuerpo. El punto ciego existía;
   la fuga, no. **Queda como gate** (`GATE · el camino real…` + `GATE · el camino por defecto pide de
   verdad a la URL de AEMET`, que impide que alguien vuelva a inyectar `urls.aemet` «para no salir a
   la red» y lo apague sin que nadie se entere).
2. **La URL en el `message` en vez de en la `cause`.** Sería fuga inmediata (`String(cause)` /
   `cause.message` la publicarían). Deno 1.x lo hacía —`error sending request for url (…)`—, pero el
   repo fija `deno-version: v2.x` y 2.9.6 no. **Sin runtime que lo produzca, no hay repro**: queda
   anotado como dependencia de versión, no como hallazgo.
3. **El artefacto horneado.** `pnpm --filter web build` (33 páginas) y `grep` de las cinco señas sobre
   todo `apps/web/dist/` —HTML, JS de `_astro`, `sw.js`, `manifest.webmanifest`, `sitemap.xml`,
   `404.html`—: **0 apariciones**. Los tres fixtures de boletín tampoco las llevan, ni en crudo ni por
   la pantalla. Queda como gate en el gemelo de la web.
4. **XSS por el texto del upstream.** El `descripcion` de AEMET y el `document` del boletín llegan al
   DOM, pero toda la isla escribe con `textContent` (comprobado: cero `innerHTML` /
   `insertAdjacentHTML` en `apps/web/src`; el único `set:html` del sitio es el JSON-LD del layout).
   Con `<img src=x onerror=…>` en `descripcion` sale texto, no marcado. **No rompió.**
5. **Cabeceras y códigos.** `Cache-Control` es lo único que el borde añade (`no-store` o
   `public, max-age=…`); no hay cabecera propia que lleve estado de credencial. El 400 de `port`
   ausente y el 404 de slug desconocido reflejan el slug del cliente en un cuerpo
   `application/json` — reflejo, no señas del operador, y sin sink de marcado. **No rompió.**
6. **`/health` del API.** Es alcanzable sin autenticar, pero devuelve un cuerpo estático: nadie llama
   al `healthcheck()` del módulo en producción (`server.ts:53`; el único llamante es el test). El
   `detail` recortado por T-18 es prudencia por anticipación, no una fuga cerrada — como el propio
   plan acabó reconociendo. **Confirmado, sin hallazgo** (salvo por A-19, que sí lo alcanza el día que
   se conecte).
7. **A1 · dos `/bulletin` simultáneos** con la caché fría: el peor caso es una petición de más al
   upstream. Sin escritura de dominio no hay duplicado que enseñar. **No rompió.**
8. **`AEMET_API_KEY` en la respuesta.** Buscado el valor de la clave (no solo su nombre) en los cuatro
   cuerpos, en las cabeceras y en el `reason` de los cinco estados: la clave viaja en la cabecera
   `api_key` y no aparece en ninguna URL ni en ningún mensaje. **No rompió** — y el gate de T-08 que
   lo vigila sigue mordiendo.

## Residuos medidos (no son hallazgos: son agujeros de vigilancia, con su número)

### R-1 · El «trinquete al revés» no cubre el artefacto que el operador lee (objetivo 3)

**Sí se puede** satisfacer el test que exige que `inspectAemetKey` siga produciendo el aviso completo
y **dejar mudo el canal del operador**. El test mira la función; lo que el humano lee es la salida de
`scripts/check-aemet-key.ts`, y ese script **no tiene ni un test** en ningún job de CI (el `pnpm test`
de Node no lo alcanza y el `deno task test` corre sólo sobre `apps/api/src/`).

Medido con una mutación de dos líneas —imprimir `publicCredentialView(state).message` en vez de
`state.message` y quitar los `RENEWAL_STEPS` del stderr—:

```
[aemet-key] expired: La credencial de AEMET de esta instancia ha caducado: no publica el boletín oficial
…
Hace falta acción humana.
```

Eso es lo que llegaría al issue de GitHub: sin nombre de variable, sin URL de alta, sin los tres
pasos. El aviso deja de servir para lo único que existe. **Y la suite entera se queda verde:
`pnpm test` 499/0 y `deno task test` 20/0.** No se reproduce en rojo porque hoy el código es
correcto: lo que falta es quien lo vigile.

No se ha añadido gate desde aquí a propósito: cubrirlo pide ejecutar el script (`--allow-run` en
`deno.json`) o moverlo bajo un directorio con tests, y las dos cosas son código de producción, que no
es del adversario.

### R-2 · La mitad que obliga se satisface con ruido (objetivo 4)

El recorrido nuevo exige frase no vacía, distinta por estado y con «AEMET». Sustituidas las cinco
frases por `"AEMET a"`, `"AEMET b"`, `"AEMET c"`, `"AEMET d"`, `"AEMET e"`, **ese test pasa**. Lo
único que se puso rojo en toda la suite fue un test de salud de T-08 que congela la prosa de *uno* de
los cinco estados (`/no tiene credencial de AEMET/`) — y los dos cuerpos de A-17, que gritaron
«YA NO FALLA» porque el ruido, al no afirmar nada, deja de contradecir a la respuesta. Cuatro de las
cinco frases pueden convertirse en ruido sin que nada avise.

## Juicio de producto (A12 — sin test, ponderar como tal)

- **`credential.status: "valid"` es una afirmación que nadie ha comprobado.** El estado sale de
  decodificar el `exp` de un JWT **sin verificar la firma** y sin preguntar a AEMET. Una clave
  revocada, mal copiada o de otro entorno se publica como «La credencial de AEMET de esta instancia
  está vigente» en el mismo cuerpo que dice `"reason":"…respondió HTTP 401"` (se ve en el bundle,
  A-18). No se reporta como rotura porque es un límite de conocimiento declarado y la alternativa
  —gastar una petición por consulta— es peor. Pero la palabra «vigente» promete más de lo que se sabe,
  y quien lea el API a las 3 de la mañana la va a creer.

## Recuento

- **Hallazgos reproducidos en rojo: 4** (A-17, A-18, A-19, A-20), en **7 cuerpos** de test — 5 en el
  borde HTTP del módulo, 2 en la pantalla.
- **No reproducidos: 8**, listados arriba con su entrada concreta y su medida.
- **Residuos medidos: 2** (R-1, R-2), con la mutación y el número de la suite que los deja pasar.
- **Juicios A12 sin test: 1.**
- **Gates que se quedan vigilando: 4** (el punto ciego del camino por defecto, que ese camino siga
  siendo el de verdad, el reloj inyectado, y los fixtures de la web).
- **Suite tras el pase:** `pnpm test` **499/0** (488 → 499: +8 en el módulo, +3 en la web),
  `deno task check` + `deno task test` **20/0**, Playwright **44/44**, `pnpm lint`, `pnpm typecheck` y
  `astro check` limpios. Los cuatro hallazgos abiertos **no ponen CI en rojo**: para eso está el
  trinquete.
