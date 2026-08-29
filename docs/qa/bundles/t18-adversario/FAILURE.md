# Failure bundle — pase adversario T-18 (la credencial en el borde público)

> **Qué es esto.** La evidencia sellada del run **en rojo** de los cinco cuerpos de los cuatro
> hallazgos A-17…A-20, tomada *antes* de poner el trinquete: con `hallazgoAbierto()` puesto el fallo
> es el esperado y no nace bundle. Es el equivalente manual del bundle que escribe el fixture
> `qa-bundle` de `qa-staging`; aquí el sujeto no es una página sino **el cuerpo HTTP publicado**, así
> que lo que se sella es el cuerpo tal cual salió por el cable, más el texto tal cual lo pintaría la
> sección meteo.
>
> Un solo bundle para los cuatro hallazgos: el run en rojo es uno.

- **snapshotId:** `t18-adversario` · **Fecha:** 2026-08-29
- **Sujeto:** worktree `/home/user/mareia-t18`, rama `claude/T-18-credencial-borde-publico`, HEAD `16a5a1f`
- **Entorno:** local y efímero, sin red hacia fuera. Node 22.22.2 (type stripping) para los cuerpos
  HTTP y la vista; Deno 2.9.6 para medir la **forma real** del error de `fetch` del runtime de
  producción y para el canal del operador. Ni el diff, ni el DOM, ni el código han salido del
  contenedor; ningún modelo externo ha revisado nada.
- **Reproducción:**
  - `packages/modules/weather/src/__tests__/adversario-t18.test.ts` (A-17, A-18, A-19, A-20 + 3 gates)
  - `apps/web/src/modulos/meteo/adversario-t18.test.ts` (A-18 en la pantalla + 1 gate)
- **Informe:** `docs/qa/informe-adversario-t18.md`

## Cómo se reprodujo

```bash
export PATH="/opt/deno/bin:$PATH"
pnpm --filter web build                       # 33 páginas (los tests de dist se saltan sin build)
# los mismos ficheros, con el cuerpo de hallazgoAbierto() re-lanzando el fallo en vez de tragárselo:
cd packages/modules/weather && node --test src/__tests__/adversario-t18.test.ts
cd apps/web && node --experimental-strip-types --test src/modulos/meteo/adversario-t18.test.ts
```

## A-17 · clase A12 — el cuerpo público publica el boletín y a la vez lo niega

```tap
not ok 1 - A-17 · clave caducada y AEMET sirviendo: la respuesta publica el boletín y a la vez lo niega
  error: el cuerpo público publica el boletín y a la vez lo niega (clave caducada, AEMET responde,
         credencial 'expired'): «La credencial de AEMET de esta instancia ha caducado: no publica el
         boletín oficial» viaja en la misma respuesta que el documento de AEMET.
  cuerpo: {"port":{"slug":"vigo"}, … ,"credential":{"status":"expired",
           "expiresAt":"2026-08-25T13:37:00.000Z","daysLeft":-3,"source":"jwt-exp","thresholdDays":0,
           "message":"La credencial de AEMET de esta instancia ha caducado: no publica el boletín oficial"},
           "status":"ok","fetchedAt":"2026-08-28T13:37:00Z","ageSeconds":0,"stale":false,
           "issuedAt":"2026-08-28T11:00:00Z","document":[{"elaborado":"2026-08-28T11:00:00Z",
           "prediccion":{"texto":"Marejada."}}]}

not ok 2 - A-17 · secreto borrado con la caché caliente: la respuesta publica el boletín y a la vez lo niega
  error: … credencial 'missing': «Esta instancia no tiene credencial de AEMET: no publica el boletín
         oficial» viaja en la misma respuesta que el documento de AEMET.
  cuerpo: {… "credential":{"status":"missing","message":"Esta instancia no tiene credencial de AEMET:
           no publica el boletín oficial"},"status":"ok", … "document":[…]}
```

## A-18 · clase A6 — el `reason` republica el manual que escribe el upstream

```tap
not ok 3 - A-18 · el `reason` público republica el manual de renovación que escribe el upstream
  error: el borde público republica la seña «opendata.aemet.es» del canal del operador porque la
         escribió AEMET y nadie la mira.
  cuerpo: {… "credential":{"status":"valid", … "message":"La credencial de AEMET de esta instancia
           está vigente"},"status":"unavailable","reason":"AEMET boletín costero rechazó la petición
           (estado 401): API key expirada. Solicite una nueva en
           https://opendata.aemet.es/centrodedescargas/altaUsuario"}
```

Y la misma seña, en la pantalla (`apps/web`), por los dos caminos de `motivoDelBoletin`:

```tap
not ok 1 - A-18 · la sección pinta el manual … (credencial 'valid')
  pantalla: … · Boletín marítimo de AEMET · No se ha podido traer · AEMET boletín costero rechazó la
            petición (estado 401): API key expirada. Solicite una nueva en
            https://opendata.aemet.es/centrodedescargas/altaUsuario ·

not ok 2 - A-18 · la sección pinta el manual … (credencial 'expired')
  pantalla: … · No se ha podido traer · La credencial de AEMET de esta instancia caducó el
            2026-07-20: hasta que se renueve no hay boletín oficial. (el servidor informa: AEMET
            boletín costero rechazó la petición (estado 401): API key expirada. Solicite una nueva en
            https://opendata.aemet.es/centrodedescargas/altaUsuario) ·
```

## A-19 · clase A5 — un `exp` que no cabe en un `Date` rompe el endpoint

```tap
# módulo weather: fallo sirviendo /v1/modules/weather/bulletin?port=vigo: RangeError: Invalid time value
#     at Date.toISOString (<anonymous>)
#     at inspectAemetKey (packages/modules/weather/src/aemet-key.ts:124:43)
#     at packages/modules/weather/src/module.ts:271:40
not ok 4 - A-19 · un `exp` que no cabe en un `Date` devuelve 500 en vez de degradar a 'unreadable'
  error: una clave con un `exp` fuera del rango de `Date` rompe el borde público en vez de degradar:
         HTTP 500 · {"error":"Error interno sirviendo la petición"}
         500 !== 200
```

Y por la otra puerta del mismo defecto, medido a mano (no va en el spec porque `healthcheck()` lanza
**síncronamente** y ni siquiera devuelve una promesa rechazada):

```
SONDA D health: LANZA RangeError: Invalid time value
```

Umbral exacto, medido sobre `inspectAemetKey` con `nowMs = 2026-08-28T13:37:00Z`:

```
exp = 8_640_000_000_000      -> {"status":"valid","expiresAt":"+275760-09-13T00:00:00.000Z","daysLeft":99979306,…}
exp = 8_640_000_000_001      -> LANZA RangeError: Invalid time value
exp = 1e14  (microsegundos)  -> LANZA RangeError: Invalid time value
exp = -1e14                  -> LANZA RangeError: Invalid time value
```

## A-20 · clase A12 — el `daysLeft` público no cuadra con el `expiresAt` que viaja a su lado

```tap
not ok 5 - A-20 · el `daysLeft` público cuenta un día entero de más desde el primer milisegundo
  error: el cuerpo público publica días que todavía no han pasado: dice daysLeft -1 junto a un
         expiresAt de hace 1 ms (0.000000 días).
  cuerpo: {… "credential":{"status":"expired","expiresAt":"2026-08-28T13:36:59.999Z","daysLeft":-1,
           "source":"jwt-exp","thresholdDays":0, …}, "status":"ok", … }
```

Corroboración fuera del test, en dato ya commiteado — el fixture que T-18 re-proyectó
(`apps/web/src/modulos/meteo/fixtures/bulletin-clave-caducada.json`) lleva
`"expiresAt":"2026-07-20T00:00:00.000Z"` con `"daysLeft":-40` para un `now` de `2026-08-28T13:37Z`:
habían pasado **39** días completos, no 40. Y el canal del operador interpola el mismo número:

```
$ AEMET_API_KEY=<jwt con exp = ahora - 3 días> deno run --allow-env=AEMET_API_KEY scripts/check-aemet-key.ts
[aemet-key] expired: La AEMET_API_KEY caducó hace 4 día(s) (2026-08-26T13:04:37.000Z, …)
```

## Lo que aguantó (y se queda de gate)

```tap
ok 6 - GATE · el camino real (sin `urls.aemet`) no publica la URL de AEMET cuando la red falla
ok 7 - GATE · el camino por defecto pide de verdad a la URL de AEMET
ok 8 - GATE · la credencial publicada usa el reloj inyectado, no el del proceso
ok 3 - GATE · ningún fixture de boletín de la web lleva las señas del canal del operador   (apps/web)
```

Forma real del error de `fetch` en el runtime de producción, medida (Deno 2.9.6, con y sin proxy):

```
name: TypeError | message: "fetch failed"
cause: Error: error sending request for url (https://opendata.aemet.es/…): client error (Connect): dns error…
timeout: name: TimeoutError | message: "The operation was aborted due to timeout" | cause: (none)
```

`http-json.ts:40` compone con `cause.message`, no con `String(cause)`: la URL se queda dentro de la
`cause`. El punto ciego existía; la fuga, no.
