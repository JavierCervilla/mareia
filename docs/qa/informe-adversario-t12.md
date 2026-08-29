# Informe adversario — la PWA que abre el almanaque sin cobertura (T-12)

- **Trayectoria:** T-12 · **PR:** #15 (`claude/T-12-pwa-offline`) · **Fecha:** 2026-08-29
- **Superficie atacada:** la sección «Sin cobertura» y la calculadora «Mareas de otro día» de las
  páginas de puerto construidas, el service worker publicado en `/sw.js`, su registro de favoritos y
  el `manifest.webmanifest`. Todo sobre el `dist/` real, nunca sobre `astro dev`.
- **Entorno:** local y efímero. `pnpm --filter web build` + el `dist/` servido por
  `tests/e2e/servidor-estatico.ts`, con la salida a internet cerrada en `context.route` (el worker
  hace sus propias peticiones y `page.route` no las ve). Sin cloud, sin prod, sin red real.
- **Reproducciones:** `tests/e2e/journeys/adversarial/` (4 ficheros nuevos, 6 recorridos) + el arnés
  compartido `utiles-pwa.ts`.
- **Bundles:** `docs/qa/bundles/t12-adversario/<snapshotId>/FAILURE.md` — uno por recorrido, nacidos
  del run **sin** `test.fail()`. Se conservan `FAILURE.md`, `bundle.json` y `events.jsonl`; el DOM y
  las capturas se descartan por peso (CI los sube como artifact del job).
- **Contexto asimétrico:** se han leído **la promesa** (el contrato de la sección, `pwa/protocolo.ts`,
  `pwa/precacheo.ts`, `pwa/vista-sin-red.ts` y el manifiesto publicado) y el código **para dirigir los
  ataques** — dónde está cada clave de caché, cómo se llama cada `data-*`. **No** se ha leído el plan
  de la trayectoria, ni el diff comentado, ni los mensajes de commit del implementador: el modelo
  mental del autor es justo lo que aquí no hay que compartir.

## Nota de método (por lo que ha costado en esta épica)

1. **Se afirma sobre las claves de la caché del worker, nunca sobre lo que se ve.** La caché HTTP de
   Chromium sigue sirviendo assets ya podados: en esta misma trayectoria un recorrido con
   `toHaveCSS`/`toBeVisible` pasó en verde con los ficheros del favorito ya destruidos. Todos los
   recorridos de abajo miden `caches.open(...).keys()`.
2. **Se ataca el artefacto publicado.** El `start_url` del hallazgo H-3 se lee del
   `/manifest.webmanifest` que sirve el `dist/`, no de una constante copiada al test.
3. **Cada rojo se ha mirado dos veces.** El recorrido de A11 falló primero por un motivo equivocado
   (el botón oculto conserva el texto «Borrando…» y la espera se agotaba); se corrigió la espera y se
   volvió a generar el bundle. Un rojo inventado cuesta lo mismo que un verde inventado.

## Promesa

> Marcar un puerto como favorito deja **su almanaque entero dentro del teléfono**: la página se abre
> sin cobertura, cualquier día de la ventana se calcula ahí mismo con las constantes armónicas y el
> mismo motor que usa el API, y **cada cosa dice de cuándo es** — sin que guardar o borrar un
> favorito le quite nada a otro, ni siquiera cruzando un despliegue.

## Clases atacadas

| Clase | Hipótesis (entrada concreta) | Resultado |
|---|---|---|
| **A1** | Dos pestañas guardando dos puertos a la vez (y con un asset compartido retrasado 700 ms, para que los dos `addAll` terminen juntos): el registro se lee-modifica-escribe sin cerrojo, así que el último en escribir borra al otro del censo y la poda se lleva sus ficheros. | 🟢 aguantó |
| **A1** | Una pestaña olvida Vigo mientras otra guarda Málaga, los dos clics en el mismo `Promise.all`. | 🟢 aguantó |
| **A2** | Caché de páginas barrida (lo que hace `activate` al subir `ESQUEMA_CACHE`, y lo que hace el navegador al desalojar) con IndexedDB intacta: el sello sigue prometiendo la copia. | 🔴 **roto** (H-1) |
| **A2** | IndexedDB desalojada con la caché intacta: el sello niega una copia que sí está. | 🔴 **roto** (H-1) |
| **A2** | Reloj del dispositivo 400 días adelantado con el puerto ya guardado: el sello, la ventana de años y los `min`/`max` del campo. | 🟢 aguantó |
| **A3** | Un fichero con hash que ya no está en el servidor (pestaña de ayer + rebuild diario de T-15) a mitad de guardar: `addAll` es todo o nada, el favorito de IndexedDB ya está escrito. | 🔴 **roto** (H-1) |
| **A3** | La red se cae a los 120 ms de pulsar «Guardar». | 🟢 aguantó (el guardado ya había terminado; el estado repinta solo al volver `offline`) |
| **A4** | Guardar dos veces el mismo puerto; doble clic en el botón. | 🟢 aguantó |
| **A4** | Registro ilegible → guardar un segundo puerto (el fail-safe no poda, correcto) → **olvidar ese mismo puerto**, que es cuando la poda se cree el censo mutilado que el fail-safe dejó escrito. | 🔴 **roto** (H-2) |
| **A5** | Los dos bordes exactos de la ventana (`2025-01-01`, `2027-12-31`) y el año siguiente. | 🟢 aguantó |
| **A6** | Fechas hostiles en el campo con `min`/`max` quitados: año de seis cifras (`275760-09-13`), `0001-01-01`, `2026-02-30`, campo vacío. | 🟢 aguantó (con un matiz, abajo) |
| **A9** | La app instalada abierta por su `start_url` sin cobertura, con un puerto guardado. | 🔴 **roto** (H-3) |
| **A10** | Guardar con la respuesta de las constantes retrasada 3 s: ¿hay algo que diga que está pasando algo? | 🟢 aguantó («Guardando…» + botón deshabilitado) |
| **A11** | Sin cobertura y con el puerto guardado, un toque en «Dejar de guardar Vigo». | 🔴 **roto** (H-4) |
| **A12** | El día civil de Canarias (`Atlantic/Canary`) y los días de 23 h y 25 h, calculados sin red. | 🟢 aguantó (23 h y 25 h, con su coletilla) |
| **A12** | ¿Qué hace quien lee **el segundo día**, cuando la copia guardada ya no es la de hoy? | ⚖️ juicio (abajo) |

**Descartadas y por qué.** **A7** (frontera de autorización) y **A8** (sesión y caducidad): Mareia no
tiene cuentas, ni sesión, ni recursos por usuario — es una decisión de producto escrita en
`pwa/cliente/almacen.ts` («cero cuentas y cero servidor»), así que no hay frontera que cruzar ni
sesión que caducar. **Nada que escalar al rol `seguridad`**: ningún hallazgo toca autorización y
ninguna respuesta ni ningún log ha destapado un secreto.

## Hallazgos

### H-1 · A2/A3 · El sello promete un offline que nunca comprueba

- **Qué se consigue:** que la página diga **«Guardado en este dispositivo… La página se guarda con su
  hoja de estilos»** cuando en la caché del worker no hay absolutamente nada — y al revés, que diga
  «no está guardada aquí… puede no estar la próxima vez» sobre una copia que sí está y sí va a estar.
  Quien lo lee se va a la playa creyendo que lleva el almanaque encima; al abrirlo sin cobertura le
  sale el error de red del navegador.
- **Recorrido:** `tests/e2e/journeys/adversarial/a3-sello-sin-copia.spec.ts` (3 recorridos)
- **Bundles:** `b3d55218409f` (un fichero con hash que ya no está), `e5174ab760e4` (caché barrida),
  `a6345d9e9ceb` (IndexedDB desalojada)
- **Se manifiesta en:** `apps/web/src/pwa/cliente/sin-red.ts:vistaDe` — la vista se compone con
  `copia: favorito === undefined ? undefined : {...}`, o sea **solo con lo que hay en IndexedDB**.
  Los bytes de la página viven en la Cache API y nadie los mira. En el camino 1 se suma
  `sin-red.ts:guardar`, que escribe el favorito antes de hablar con el worker y **no lo deshace** si
  el worker contesta que no pudo: la advertencia sale como nota bajo el botón y **la primera recarga
  se la lleva** (`pintarEstado` sin `nota`), de modo que el aviso es transitorio y la promesa falsa es
  permanente.
- **Los tres caminos, ninguno exótico:**
  1. **Un 404 en un asset con hash.** `addAll` es todo o nada. Una pestaña abierta desde ayer con el
     rebuild diario de T-15 por medio pide un fichero que ya no existe: caché vacía, favorito escrito.
  2. **La caché barrida y IndexedDB no.** Es literalmente lo que hace `activate` al subir
     `ESQUEMA_CACHE` — el salto v1→v2 que este mismo PR introduce — y también el desalojo por presión
     de almacenamiento y el «borrar imágenes y archivos» del menú del navegador. El ADR asume que
     «quien tuviera un puerto guardado lo vuelve a guardar con un clic»; **nada en la pantalla se lo
     dice**, porque la pantalla sigue afirmando que está guardado.
  3. **Al revés.** IndexedDB desalojada y la caché intacta: la sección atribuye su propia copia
     garantizada a «la caché del navegador», que «puede no estar la próxima vez».
- **Estado:** abierto (`test.fail()` puesto en los tres)
- **Severidad:** **pérdida de la promesa central** — es exactamente lo que T-12 existe para no hacer.
- **Escalado:** no

### H-2 · A4 · El fail-safe de la poda no evita el borrado: lo aplaza un paso

- **Qué se consigue:** que un favorito se quede con su página y **cero ficheros** — sin estilos, sin
  la isla meteo y sin el trozo que calcula otro día, que es la promesa entera — por el gesto más
  normal del mundo: dejar de guardar *otro* puerto. Sin un error por ninguna parte.
- **Recorrido:** `tests/e2e/journeys/adversarial/a4-registro-que-miente.spec.ts`
- **Bundle:** `bb2e9b141d2e`
- **Se manifiesta en:** `apps/web/src/pwa/sw.ts:guardar` — con el registro ilegible, el puerto se
  guarda igual y se escribe `{ ...(registro ?? {}), [slug]: urls }`, o sea **un censo de un solo
  puerto indistinguible de uno completo**. La distinción que sostiene la poda («no sé qué hay» vs «no
  hay nada») está bien puesta en `leerRegistro` y muerde en el momento correcto; lo que no viaja con
  el dato es la propiedad que de verdad hace segura la poda, que no es *«¿legible?»* sino
  *«¿completo?»*. A partir de ahí, `sw.ts:olvidar` calcula `resto = {}` —un vacío «de verdad»— y
  `podarAssetsHuerfanos` borra todo lo que hay bajo `/_astro/`.
- **Cadena medida:** Vigo guardado (5 assets) → registro ilegible → Santander guardado con otro build
  (aquí el fail-safe **acierta**: no poda) → «Dejar de guardar Santander» → Vigo pierde **los 5**.
- **Estado:** abierto (`test.fail()` puesto)
- **Severidad:** corrupción de estado con pérdida de datos del usuario
- **Escalado:** no

### H-3 · A9 · La app instalada no abre sin red: su puerta de entrada no se guarda nunca

- **Qué se consigue:** con el puerto favorito guardado e intacto, tocar el icono de Mareia en la
  pantalla de inicio sin cobertura abre **el error de red del navegador**. Ni el almanaque, ni una
  página que diga qué hay guardado, ni una salida. Y quien instaló la PWA se quedó sin barra de
  direcciones y sin historial a mano: `start_url` es su única puerta.
- **Recorrido:** `tests/e2e/journeys/adversarial/a9-app-instalada-sin-red.spec.ts`
- **Bundle:** `fe9da3f631b8`
- **Se manifiesta en:** `apps/web/src/pwa/marca.ts:MANIFIESTO` (`start_url: "/"`) contra
  `apps/web/src/pwa/precacheo.ts:urlsDeFavorito`, que guarda la página del puerto, sus constantes y
  sus assets — la portada y el índice geográfico no están en esa lista, y el worker tiene prohibido
  guardar lo que nadie ha pedido. Las dos decisiones son razonables por separado y juntas dejan la
  app instalada sin puerta.
- **Nota de arnés:** en el recorrido se visita `/` **con** cobertura antes de cortarla, que es como se
  llega a un puerto de verdad; ni así la sirve nadie (la caché HTTP de Chromium tampoco la rescata).
- **Estado:** abierto (`test.fail()` puesto)
- **Severidad:** bloqueo del usuario en el escenario de uso que manda el design brief
- **Escalado:** no

### H-4 · A11 · Sin cobertura, un toque borra el almanaque que se está leyendo y no hay vuelta atrás

- **Qué se consigue:** en el estado 5 —sin red y con el puerto guardado, que es la situación para la
  que existe T-12— la sección ofrece «Dejar de guardar Vigo». Un toque, sin confirmación, sin decir
  qué se lleva por delante y sin deshacer: se borran la página y las constantes, y recargar la
  pestaña que se estaba leyendo da el error de red del navegador.
- **Recorrido:** `tests/e2e/journeys/adversarial/a11-olvidar-sin-red.spec.ts`
- **Bundle:** `71fa5adff241`
- **Se manifiesta en:** `apps/web/src/pwa/vista-sin-red.ts:guardadoSinRed`, que devuelve
  `accion: { verbo: "olvidar" }` sin mirar si hay red para rehacerlo. La página **sabe** que no la
  hay: el estado en el que se cae dice *«Cuando vuelva la red podrás guardar Vigo desde aquí»*. Ofrece
  con un toque una acción que ella misma declara irreversible hasta que haya cobertura, en el único
  momento en que no la hay.
- **Contraargumento, dicho a propósito:** el usuario ha pulsado un botón que dice lo que hace. Lo que
  lo convierte en hallazgo y no en opinión es el contexto: es el único botón de la sección, está
  pegado al sello que se lee para comprobar la copia, y su efecto es **irrecuperable en ese
  contexto** — es el patrón que la clase A11 nombra (borrado sin confirmación, sin deshacer y sin
  rastro), agravado porque quien está en el agua no tiene la red con la que arreglarlo.
- **Estado:** abierto (`test.fail()` puesto)
- **Severidad:** pérdida de datos irreversible con un solo toque
- **Escalado:** no

## No reproducidos

Sospechas que **no** se materializaron. Se listan a propósito: sin esto, una pasada estéril y una
pasada alucinada se ven igual desde fuera.

| Sospecha | Qué pasó al intentarlo |
|---|---|
| **A1 · Carrera en el registro de favoritos.** `sw.ts:guardar` lee el registro, lo modifica y lo escribe sin cerrojo; dos guardados solapados deberían perder una escritura y podar los ficheros del perdedor. | Dos pestañas guardando dos puertos de dos builds distintos con los clics en el mismo `Promise.all`: el censo quedó con los tres slugs y los 8 assets vivos. Repetido retrasando 700 ms **un asset compartido** para que los dos `addAll` terminen juntos: mismo resultado. `addAll` domina el tiempo y separa las dos ventanas de lectura-escritura lo bastante. **La carrera está en el código; no la he sabido disparar.** |
| **A1 · Olvidar y guardar a la vez.** Una pestaña olvida Vigo mientras otra guarda Málaga. | Censo y caché quedaron exactamente como debían (`{malaga: …}` y solo sus ficheros). |
| **A3 · Cortar la red a mitad de guardar.** `context.setOffline` 120 ms después del clic. | Para entonces el guardado ya había terminado; al volver el evento `offline` la sección repintó al estado correcto. La ventana existe pero es más estrecha que el tiempo de un clic — por eso el ataque que **sí** funciona (H-1, camino 1) no corta la red: quita un fichero. |
| **A4 · Doble guardado / doble clic.** | El botón se deshabilita en el primer clic y en la siguiente pintada ya ofrece «olvidar»: no hay segundo guardado que provocar. |
| **A2 · Reloj del dispositivo 400 días adelantado.** El sello se pinta con `Date.now()` una vez. | «Guardado en este dispositivo hace 400 días», y la ventana de años y los `min`/`max` del campo siguen viniendo de `generadoEn` de la copia (2025–2027). Coherente: la edad se mide como intervalo y la ventana no depende del reloj. |
| **A6 · Fechas hostiles.** Año de seis cifras, año 1, 30 de febrero, campo vacío. | `2026-02-30` no lo acepta ni el propio campo; el vacío da «Elige un día para calcular sus mareas»; `0001-01-01` da el mensaje de ventana correcto. **Matiz:** `275760-09-13` cae en «Escribe la fecha como día, mes y año», que es impreciso —la fecha está bien escrita, lo que pasa es que no cabe— pero no lo cuento como hallazgo: un `input type=date` con su `max` puesto no la produce, y hay que quitar el tope a mano para llegar ahí. |
| **A5 · Bordes de la ventana.** `2025-01-01` y `2027-12-31`. | Los dos calculan, y el rótulo, el `min` y el `max` dicen lo mismo que la calculadora acepta. |
| **A12 · Día civil de Canarias y días de 23/25 h.** `2027-03-28` y `2027-10-31` en `Atlantic/Canary`, sin red. | 3 extremos y 4 extremos respectivamente, con «Ese día dura 23 h / 25 h en la hora local del puerto» en la procedencia. Aguantó entero. |
| **A10 · Feedback con red lenta.** Constantes retrasadas 3 s. | «Guardando…» y el botón deshabilitado desde el primer momento. |
| **Caché HTTP heurística contra el `network-first` de ADR-02.** `sw.ts:laPaginaDeLaRedODeLaCopia` hace `fetch(peticion)`, y un `fetch` dentro del worker **puede contestarse desde la caché HTTP del navegador**: con `Last-Modified` y sin `Cache-Control` —que es lo que `docs/despliegue.md` §Pendientes describe hoy para producción— Chromium aplica caching heurístico y serviría HTML viejo *con* red. | **No reproducido, y lo dejo aquí en vez de forzarlo.** El servidor del arnés no manda `ETag` ni `Last-Modified`, así que la caché heurística no entra y la navegación transfiere bytes de verdad (comprobado). Reproducirlo exigiría montarme un servidor que imite al de producción, y entonces la sonda mediría mi andamio y no el artefacto. **Vale la pena decidir la cabecera antes de desplegar**: el `network-first` de ADR-02 se apoya en que el `fetch` del worker llegue a la red. |
| **Cuota (`QuotaExceededError`) a mitad de guardar.** | **No atacado**, y lo digo en vez de callarlo: no he encontrado forma determinista de forzar el tope de almacenamiento de un origen desde Playwright. El fallo de `addAll` sí está cubierto por otro camino (H-1, camino 1), que es el mismo `catch`. |

## Juicios de producto (A12 — sin test, ponderar como tales)

- **El segundo día.** Un favorito guarda la página **del día que se guardó**. Al día siguiente, sin
  cobertura, lo primero que se lee es «Mareas de hoy · sábado, 29 de agosto de 2026» — con la fecha
  al lado, sí, pero la palabra «hoy» horneada en el titular más grande del bloque más importante. Es
  el defecto que ADR-01 nombra para la meteo («el que dice *consultado hace 4 minutos* lo sigue
  diciendo veinte horas después») aplicado a la tabla de mareas. La respuesta del producto existe y
  es buena —la calculadora de abajo— pero **el camino desde «esta tabla es de anteayer» hasta «pídeme
  la de hoy» lo tiene que descubrir quien lee**: no hay un «calcular hoy» a un toque, ni nada arriba
  que lo sugiera cuando la copia ya no es del día. Juicio, no hecho.
- **«No dependen de la conexión», dicho como virtud.** El sello del estado 5 explica que las mareas y
  las efemérides se calcularon el día del build y «no dependen de la conexión». Es cierto y está bien
  dicho para una copia de esta mañana; para una de hace tres semanas, lo que el lector necesita
  primero no es que el dato sea independiente de la red, es que **es de hace tres semanas**. La edad
  de la copia sí está en el titular; la relación entre las dos frases no.

## Recuento

**4 reproducidos (6 recorridos en rojo, 6 bundles) · 11 no reproducidos · 2 juicios de producto**
→ al ledger (`Contexto_Base_SRE/04_Logs_de_Trayectoria/adversarial_ledger.md`).

Los cuatro salen de **una sola pregunta**, que es la que el rol `qa` no hace: *¿en qué se apoya la
página para afirmar lo que afirma?* El sello se apoya en IndexedDB y promete la Cache API (H-1); la
poda se apoya en un censo que puede estar mutilado y lo trata como completo (H-2); el manifiesto
promete una app instalable y su puerta no está en la lista de lo que se guarda (H-3); y la sección
ofrece la acción destructiva apoyándose en un estado —«hay copia»— sin mirar el otro —«no hay red
para rehacerla»— (H-4).
