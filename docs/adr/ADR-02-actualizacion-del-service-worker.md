# ADR-02 — Qué pasa cuando hay versión nueva y ya hay un service worker instalado

- **Trayectoria**: T-12 (`pwa-offline`)
- **Estado**: aceptada
- **Fecha**: 2026-08-29
- **Decide**: con qué política se actualiza el service worker de Mareia y qué se sirve mientras
  tanto, para que un almanaque nunca enseñe el día equivocado.

## Contexto

Un service worker mal puesto **sirve una versión vieja para siempre**, y es de los bugs más caros de
diagnosticar: no hay error, no hay 500, no hay nada en los logs — simplemente hay quien ve una
página de hace tres semanas y quien no, y ninguno de los dos sabe por qué. En un portal cualquiera
eso es molesto. Aquí es peor: **el contenido de la página es la fecha**. Una página de puerto se
reconstruye a diario (T-15) y su tabla es la tabla de *ese* día; servirla de una caché es servir las
mareas de otro día con cara de hoy, que es exactamente el defecto que ADR-01 existe para no cometer.

El mecanismo del navegador es fijo y conviene tenerlo delante:

- el navegador vuelve a pedir `/sw.js` en cada navegación (con un tope de 24 h de caché) y **solo
  reinstala si el fichero difiere byte a byte**;
- un worker nuevo se queda en `waiting` hasta que no queda ningún cliente controlado, salvo que él
  mismo llame a `skipWaiting()`;
- lo que ya está en la caché no caduca solo: alguien tiene que borrarlo.

Las tres salidas habituales:

1. **Activación inmediata** (`skipWaiting` + `clients.claim`): el worker nuevo toma el control al
   instante, incluso de las pestañas abiertas.
2. **Aviso al usuario**: un banner «hay una versión nueva, recarga».
3. **Recarga al navegar**: el worker nuevo espera y entra cuando toca.

## Decisión

**La 3, sin banner — y con una red de seguridad que es la parte importante: el HTML se pide siempre
a la red antes que a la caché.**

En concreto:

1. **`/sw.js` lleva la versión del build en sus bytes** (`<día>-<huella>`, donde la huella cubre el
   código del worker, el protocolo y las políticas de los módulos activos). Sin eso, un despliegue
   que cambia el comportamiento del worker no reinstala nada y el dispositivo se queda con el de
   antes. Con eso, dos builds idénticos del mismo día **no** producen churn.
2. **No se llama a `skipWaiting()`.** Un worker nuevo no le cambia el motor a una pestaña que
   alguien está leyendo en la playa.
3. **El relevo llega con la siguiente navegación.** Mareia es multipágina: cada enlace es una
   navegación de documento de verdad, el último cliente controlado se destruye y el worker en espera
   activa solo. No hace falta pedirle nada a nadie.
4. **En `activate` se barren las cachés de esquemas anteriores** y se hace `clients.claim()`.
5. **Las navegaciones van `network-first`**: se pide el HTML a la red y solo si la red falla se
   sirve la copia guardada. **Y sin temporizador que corte la espera**: un timeout serviría la
   página de ayer a quien solo tiene un 3G lento, y una tabla de mareas de ayer con cara de hoy es
   el fallo que este portal no se puede permitir. Sin cobertura el `fetch` falla en milisegundos y
   la copia entra sola.
5 bis. **Y ese `fetch` va con `cache: "no-store"`, que es lo que hace que el punto 5 sea una
   garantía del worker y no del servidor.** Un `fetch` hecho dentro de un service worker **puede
   contestarse desde la caché HTTP del navegador**: con `Last-Modified` y sin `Cache-Control` —que es
   lo que `docs/despliegue.md` describe hoy para producción— Chromium aplica caché heurística y
   serviría HTML viejo *teniendo red*, que es exactamente lo que este documento promete que no puede
   pasar. Lo señaló el pase adversario de T-12 sin poder reproducirlo (el servidor del arnés no manda
   esas cabeceras, y montar uno que sí lo hiciera habría medido el andamio). Se cierra aquí en vez de
   dejarlo en manos del despliegue: **si la garantía depende de una cabecera que el despliegue no
   fija, la garantía no existe**. Fijar bien las cabeceras en producción sigue siendo buena idea; ya
   no es la condición de nada.
6. **Los assets con hash van `cache-first`**, y ahí es seguro: `/_astro/AlmanaqueLayout.<hash>.css`
   cambia de URL cuando cambia de contenido, así que una copia guardada no puede ser la versión
   vieja de nada.
6 bis. **Las constantes armónicas (`/offline/estaciones/<slug>.json`) NO van `cache-first`, van
   `stale-while-revalidate`**, y la distinción es la que se coló en la primera versión de este ADR:
   esa URL **no lleva hash**. El pipeline de datos corrige constantes —para eso existe, y T-13 acaba
   de regenerar el dataset entero—, así que un `cache-first` puro dejaría al teléfono calculando con
   las viejas indefinidamente bajo el rótulo «las mismas que usa el servidor», que entonces sería
   falso. Se sirve la copia al instante (sin red incluida) y se refresca de camino cuando hay
   cobertura; la página hace lo propio con su copia de IndexedDB.
7. **La caché no se versiona por build.** Se versiona por *esquema* (`ESQUEMA_CACHE`), que se sube a
   mano cuando cambia la forma de lo guardado. Versionar por build obligaría a re-descargarlo todo
   cada día y —lo grave— dejaría sin copia offline a quien actualizara el worker justo cuando se
   quedó sin cobertura, que es el momento exacto en que la copia hace falta. Cuando sí toca subirlo,
   se sube: el registro de favoritos del apéndice es una entrada obligatoria nueva, así que la caché
   pasó a **v2**. Una caché de la v1 tiene favoritos y no tiene registro, y ese estado a medias es
   indistinguible de un registro corrupto — el worker no podría decidir si «no hay registro» es
   «esta caché es de antes» o «alguien la ha roto».

## Por qué

El razonamiento que decide es este: **el bug de la página vieja no nace del ciclo de vida del
worker, nace de aplicar `cache-first` al HTML**. Mientras el HTML se pida a la red primero, da
igual que el worker en memoria sea el de ayer: el documento que se sirve es el del despliegue de
hoy, y los assets que ese documento referencia llevan hashes nuevos que no están en ninguna caché,
así que también se piden a la red. El sistema **no puede** servir una página vieja mientras haya
red, y esa propiedad no depende de que nadie recargue nada.

Con eso en pie, `skipWaiting` deja de comprar nada y sigue costando lo suyo: cambiarle el worker a
una pestaña viva es cómo se acaba con un documento de la versión N pidiéndole trozos a una caché
que ya es de la N+1.

Y el banner de la opción 2 se descarta por dos motivos, uno de producto y otro de diseño. El de
producto: la pregunta que de verdad le importa a quien abre esto no es «¿tengo la última versión del
sitio?» sino «¿de cuándo son estos datos?», y esa ya está contestada en la cabecera de todas las
páginas («Datos generados el …») desde T-09. El de diseño: el design brief §3 veta explícitamente
los banners y los CTA, y un aviso de actualización es las dos cosas.

## Qué se pierde

Tres cosas, y conviene tenerlas escritas:

- **El arranque instantáneo offline-first.** Con cobertura, cada navegación paga la latencia de la
  red aunque la página esté guardada. Es el precio directo del punto 5 y se paga a sabiendas: un
  almanaque que tarda un segundo es mejor que uno que enseña el día de ayer.
- **Una pestaña abierta durante días conserva el worker viejo** hasta que se navegue o se cierre. Lo
  que se queda atrás es su *lógica de caché*, no el contenido — pero si un día hay que arreglar algo
  del propio worker (un fallo en el sellado, una estrategia mal puesta), ese arreglo tarda en llegar
  a quien no cierra nunca la pestaña. No hay forma de arreglarlo sin `skipWaiting`, y `skipWaiting`
  cuesta más de lo que arregla.
- **No hay aviso de «hay versión nueva».** Quien quiera saber si está viendo lo último no tiene
  dónde mirarlo, más allá de la fecha de los datos. Si algún día hace falta —por ejemplo, para un
  aviso de seguridad— la salida no es el banner: es que el worker publique su `VERSION` en un sitio
  visible de la página de transparencia.
- **En la primerísima visita, la meteo no se queda guardada.** El worker se está registrando cuando
  la isla dispara su petición, así que esa respuesta sale sin pasar por él y no hay copia que sellar.
  A partir de la segunda visita la página va controlada (`clients.claim()`) y cada respuesta servida
  queda guardada con su hora. Se acepta —quien se quede sin cobertura tras una única visita ve la
  quinta ausencia, «sin conexión y sin copia guardada aquí», que es verdad— pero es un agujero real
  y su sitio es este documento, no un comentario en un spec. Cerrarlo exigiría retrasar la petición
  de la isla hasta que el worker controle la página, y eso es pagar latencia en **todas** las
  visitas para arreglar la primera.

## Cómo se comprueba

- `apps/web/src/pwa/generar-sw.test.ts` — el worker publicado **no llama a `skipWaiting`**, las
  navegaciones consultan la copia solo dentro del `catch` del `fetch`, y la versión cambia cuando
  cambia el código, las políticas o el día (y **no** cambia cuando no cambia nada).
- `apps/web/src/pwa-construido.test.ts` — el `/sw.js` del `dist/` es exactamente el que genera el
  fuente de este commit.
- `tests/e2e/journeys/offline.spec.ts` — con cobertura, la navegación pasa por el worker **y
  transfiere bytes**: la sirvió la red, no la caché.
- `tests/e2e/journeys/adversarial/` — los seis recorridos del pase adversario de T-12, ya en verde y
  como gate permanente: el sello no promete una copia que no está, la poda no borra lo que no sabe
  que sobra, la app instalada abre sin red y un toque sin cobertura no destruye el almanaque. Y dos favoritos guardados en dos builds
  distintos conservan cada uno sus ficheros, que es la parte del punto 7 que se comprobaba sola.

## Apéndice — por qué el worker lleva un registro de favoritos

La Cache API es un saco de respuestas **sin dueño**: sabe que tiene guardado
`/_astro/hoja.<hash>.css`, no para quién. La primera versión de la poda daba por hecho que los
assets que no usara la página que se estaba guardando «ya no los referencia ningún HTML guardado», y
eso es falso en cuanto hay dos favoritos de dos builds — que con el rebuild diario del punto 7 es el
caso **normal**. Guardar el segundo puerto dejaba al primero con su página y cero assets: se abría
sin estilos, sin la isla meteo y sin el trozo de la calculadora, sin un solo error por ninguna parte.

Por eso el worker guarda, bajo una clave sintética de su propia caché, qué URL necesita cada
favorito, y poda conservando **la unión**. Es lo único que convierte «qué sobra» en una pregunta con
respuesta en vez de en una adivinanza.

Y de ahí se sigue lo que no era obvio y costó un segundo rechazo: **cuando el registro no se puede
leer, la respuesta correcta es no podar**. Colapsar «no hay registro» y «el registro dice que no hay
favoritos» en un mismo objeto vacío devuelve la adivinanza por la puerta de atrás, y esta vez adivina
«sobra todo»: borra de golpe cuanto hay bajo `/_astro/` y deja al favorito con su página y ningún
fichero — el fallo original, con el arreglo puesto. Un `{}` de verdad sí es una respuesta (no queda
ningún favorito, y entonces sus assets sobran); la ausencia de registro no lo es. La decisión de
podar vive en quien sabe si el registro es de fiar, y no repartida entre dos funciones, porque
repartir una guardia es cómo una de las dos mitades se queda sin ella en el siguiente refactor.
