# T-18 — credencial en el borde público (fix forward de T-08)

**Por qué existe**: `GET /v1/modules/weather/bulletin` publica el estado de la credencial de AEMET
con el **mensaje del operador** dentro:

> `La AEMET_API_KEY caducó hace 3 día(s) (2026-10-15, jwt-exp). Renuévala en
> opendata.aemet.es/centrodedescargas/altaUsuario y actualiza el secreto.`

No hay material de clave y la web no lo pinta, así que no es un incidente. Pero es **prosa de
operación en un canal público**: le dice a cualquiera qué credencial usa la instancia, dónde se pide
y qué tiene que hacer quien la administra. Eso es reconocimiento gratis, y sobre todo es un canal
equivocado — el aviso existe para que lo lea quien puede renovar la clave, y quien puede renovarla
no se entera por el JSON público.

Es un **fix forward** de T-08, no un rollback: el estado de la credencial **sigue viajando** en la
respuesta, porque quien consume el API necesita poder decir *por qué* dejó de haber boletín. Lo que
se recorta es el mensaje, no el hecho.

## Los dos canales

| Canal | Quién lo lee | Qué debe llevar |
|---|---|---|
| Respuesta HTTP pública (`/bulletin`, `/health`) | cualquiera | **el hecho**: `status`, `expiresAt`, `daysLeft`, `source`, y una frase neutra |
| Aviso al operador (workflow `aemet-key.yml`, logs, issue) | quien administra la instancia | **la instrucción completa**, tal cual está hoy |

`AemetKeyState.message` se queda **exactamente como está**: es el canal del operador y ya tiene su
gate en `.github/workflows/aemet-key.yml`. Lo que se añade es una **vista pública** que se aplica en
el borde HTTP.

## Entregables

1. **`publicCredentialView(state)`** en el módulo weather: proyecta `AemetKeyState` a lo que sale por
   HTTP. Conserva `status`, `expiresAt`, `daysLeft`, `source`, `thresholdDays`. Sustituye `message`
   por una frase neutra derivada del `status` — sin nombre de variable de entorno, sin URL de alta,
   sin instrucciones.
2. **Aplicada en los dos sitios del borde**: las dos ramas de `bulletinHandler` y el `detail` del
   `snapshot()` de salud, que hoy concatena `credential.message`.
3. **El gate mira la respuesta entera, no el campo.** Un test que compruebe `credential.message`
   arregla este bug y deja pasar el siguiente, porque el defecto se **mueve** de campo en vez de
   desaparecer. El recorrido serializa la respuesta completa de cada endpoint público del módulo,
   en cada estado de la credencial (`missing`/`unreadable`/`valid`/`expiring`/`expired`), y exige
   que **en ninguna parte del cuerpo** aparezcan: `AEMET_API_KEY`, `opendata.aemet.es`,
   `centrodedescargas`, `Renuévala`, `actualiza el secreto`.
4. **Trinquete al revés**: un test que compruebe que el mensaje del operador **sí** sigue completo
   donde toca (`inspectAemetKey`), para que «arreglar» esto no consista en vaciar el aviso.

## Asunciones

1. ~~`/health` es alcanzable públicamente hoy; mientras lo sea, su `detail` es superficie
   pública.~~ **Corregida tras la verificación**: la ruta `/health` del API es pública, pero hoy
   devuelve un cuerpo estático y **nadie llama a `healthcheck()` del módulo en producción**, así que
   el `detail` con el aviso del operador todavía no sale por ningún sitio. El recorte se mantiene
   —es el borde por el que saldría en cuanto se conecte, y conectarlo es deuda de T-15— pero se
   documenta como **prudencia por anticipación, no como fuga cerrada**. Decir que cerramos una fuga
   que no estaba abierta sería inflar el arreglo.
2. Ningún consumidor depende de la prosa de `credential.message`: la web pinta estados, no frases.
3. El día que el aviso al operador cambie de texto, el gate no se entera — por eso el gate busca
   **las señas del canal equivocado** (nombre de la variable, dominio de alta, verbo de instrucción),
   no la frase literal.

## Tradeoffs

- **Frase neutra vs. omitir el campo**: se conserva un `message` público neutro en vez de quitarlo.
  Quitarlo rompería a quien ya lo lee y no gana nada: el problema no es que haya frase, es *qué*
  frase. Coste: un campo más que mantener en dos formas.
- **Recortar en el borde vs. no producir nunca la frase**: el mensaje del operador se sigue
  generando y se recorta al salir. Es una capa más, pero la alternativa —dos funciones que calculan
  el estado— duplica la lógica de caducidad, que es justo la que no queremos que se bifurque.

## Verificación

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `deno task check`, `deno task test`, y el recorrido nuevo
comprobado **mordiendo**: revertir el recorte tiene que ponerlo en rojo nombrando la seña encontrada.
