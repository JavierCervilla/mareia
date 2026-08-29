# Despliegue

## Qué se despliega hoy y qué no

Se despliegan **dos servicios** sobre el mismo dominio, `mareia.cervilla.es`, separados **por ruta**:

| ruta | servicio | Dockerfile | puerto |
|---|---|---|---|
| `/v1/*` | `mareia-api` (Deno) | `apps/api/Dockerfile` | 8787 |
| todo lo demás | `mareia-web` (nginx + SSG) | `apps/web/Dockerfile` | 3000 |

La web se puso en pie en T-17 y el API en T-15. Lo que sigue de este documento cuenta primero la
web (T-17) y luego el API (T-15, más abajo: **«El API»**).

El orden no es capricho. `mareia.cervilla.es` ya estaba enganchado en Dokploy a dos aplicaciones que
apuntaban a Dockerfiles que no existían, así que los servicios no arrancaban y Traefik contestaba
**502**. Enganchar un dominio a un servicio que no puede arrancar convierte una URL «que aún no
existe» en una URL «rota», y para quien la visita no es lo mismo. La web ya estaba terminada; es lo
que se puede poner en pie hoy.

## La imagen

```sh
# El contexto es la RAÍZ del repo, no apps/web
docker build -f apps/web/Dockerfile -t mareia-web .
```

El contexto tiene que ser la raíz porque **el sitio no se rellena en el navegador: se calcula en
build** llamando a los casos de uso. Necesita `packages/` y el dataset de `data/`. Lo que no
necesita lo recorta `.dockerignore` (dependencias, `dist/`, cachés, `.env`, capturas de QA).

Son dos etapas y la frontera importa:

| | qué hay | tamaño medido |
|---|---|---|
| etapa `build` | `node:22-alpine` + pnpm + `node_modules` + el código | 232 MB, **no se despliega** |
| etapa `runtime` | nginx + `dist/` (313 KB de HTML) | **94 MB** (26,3 MB comprimida) |

La imagen final es la base `nginx:alpine` (94,2 MB / 26,28 MB comprimida) **más 528 KB de sitio**:
todo lo demás se queda en la primera etapa. Comprobado sobre la imagen construida: `node`, `npm`,
`pnpm` y `corepack` no existen en ella, y no hay ningún `node_modules`.

Las **dos bases van fijadas por digest**, no solo por el tag. `22-alpine` y `alpine` son etiquetas
móviles, y con el rebuild diario de T-15 la base cambiaría bajo los pies **sin que ningún commit lo
cuente**: la avería llegaría un martes sin que nada del repo hubiera cambiado. Así, subir la base es
un cambio que se revisa:

```sh
docker pull node:22-alpine
docker image inspect node:22-alpine --format '{{index .RepoDigests 0}}'   # y al Dockerfile
```

### Los dos `ARG`

- **`SITE_URL`** (por defecto `https://mareia.cervilla.es`): de él cuelgan las **canónicas** y el
  `sitemap.xml`. Si no se pasa nada, Astro avisa y hornea `localhost:4321`, es decir, publica un
  mapa del sitio que apunta a la máquina de quien construyó.
- **`BUILD_DATE`** (por defecto, el día UTC del build): el día que publican las páginas.

`BUILD_DATE` es un argumento **de build** y no puede ser otra cosa: el sitio es SSG y el día está
horneado en el HTML de las 33 páginas. Una variable de entorno que se cambiara al arrancar el
contenedor **no movería ni una marea, solo mentiría**. Es decir: el rebuild diario de T-15 **tiene
que reconstruir la imagen**; lo que sí se ha hecho es que sea barato. Los `ARG` van declarados
*después* del `pnpm install`, así que un día nuevo invalida la caché solo a partir del `astro
build`:

```
build completo desde cero .................... 18,3 s
rebuild del día siguiente (mismo commit) ......  8,4 s   ← «pnpm install» CACHED
```

Y el día horneado se puede leer desde fuera sin abrir el HTML, que es como se sabe si el contenedor
que está corriendo es el rebuild de hoy o el de la semana pasada: sale en la **primera línea del
log de arranque** (ver más abajo) y vive en `/etc/mareia/build-date`.

## El servidor estático: nginx, y por qué ése

Se sirve con **`nginx:alpine`**. La comparación se hizo midiendo, no de memoria:
`nginx:alpine` pesa 94,2 MB y `caddy:2-alpine` 88,7 MB, así que **el tamaño no decide**; un
`busybox httpd` sería 20 veces más pequeño, pero su redirección de directorios y su página de error
propia son folclore, y precisamente eso es lo que aquí no puede fallar. Decide la semántica de
rutas: nginx hace de serie las tres cosas que este sitio necesita, **sin ningún catch-all**.

1. **Directorios con `index.html`**. Las URL del portal terminan en barra
   (`trailingSlash: "always"` en `astro.config.mjs`) y el `dist/` son directorios: `index index.html`.
2. **Barra final**. `/mareas/galicia/pontevedra/vigo` responde **301** a `/mareas/…/vigo/`, no sirve
   la misma página en dos URL. Con **`absolute_redirect off`**, porque si no el `Location` se
   construye con el host y el **puerto interno** (`http://…:3000/…`) y detrás de Traefik eso manda
   al visitante a una dirección que desde fuera no existe.
3. **404 de verdad**. `error_page 404 /404.html` devuelve el cuerpo de la página de error **con
   estado 404**. Aquí está la razón de no usar `try_files … /index.html`, que es el patrón de las
   SPA: devolvería la portada con un 200 y le diría a un buscador que cada URL inventada es una
   página real del portal. Este sitio es SSG y su motivo de existir es el SEO.

4. **Ninguna superficie de error ajena al portal**, que es la misma idea llevada hasta el final.
   Un directorio real sin `index.html` —`/_astro/`, donde viven los assets— responde 403, y por
   defecto lo contestaría la página de error **compilada en nginx**: en inglés, ajena al portal y
   con la marca `nginx` a pesar del `server_tokens off`. `error_page 403 =404 /404.html` la
   sustituye por la del portal, **con estado 404 y no 403** a propósito: un 403 confirma que ese
   directorio existe, y de cara afuera este sitio no tiene más superficie que sus páginas.
5. **La raíz web de la base se vacía antes de copiar el `dist/`**. `COPY` **fusiona, no limpia**:
   sin ese `rm -rf`, los ficheros de la base que el sitio no pisa sobreviven, y `/50x.html`
   respondía **200** con una página en inglés que no es del portal y que publica la marca `nginx`.
   Una URL del dominio que contesta 200 con algo ajeno es exactamente lo que no puede pasar.

Quedan tres respuestas que nginx genera él y que **no son navegables**: el cuerpo del 301 (que
ningún visitante llega a ver), el **405** ante un método no soportado (`POST /`) y el **414** ante
una URI desmedida. Medidas, no supuestas. No se han tocado porque `error_page` sobre esos códigos
tiene semántica sutil —el 405 se decide antes de leer el cuerpo de la petición— y convertirlos en
404 sería mentir sobre lo que ha pasado; ninguna publica versión y a ninguna se llega navegando.

Además, y por reducir superficie: `server_tokens off`, sin autoindex, el `server` por defecto del
puerto 80 borrado, los logs al stdout/stderr del contenedor (que es lo que lee Dokploy) y el
proceso **corriendo como el usuario `nginx`, no como root** — el 3000 está por encima de 1024, así
que no hace falta privilegio para escucharlo, y el HTML que sirve no le pertenece.

### El puerto, y la trampa del 502

nginx escucha en **`0.0.0.0:3000`**, escrito explícitamente en `apps/web/nginx.conf` aunque nginx ya
escuche por defecto en todas las interfaces. El motivo es que esa línea es la que el arranque lee y
publica en el log:

```
$ docker logs mareia-web | head -1
[mareia] escucha: 0.0.0.0:3000 · raíz: /usr/share/nginx/html · publica el día: 2026-08-29
```

La dirección **se lee de la configuración**, no está escrita a mano en el mensaje: un log escrito a
mano puede decir `0.0.0.0` mientras el servidor escucha en otro sitio, y entonces deja de ser una
prueba y pasa a ser una opinión. Y hace falta una prueba porque **ésta es la avería silenciosa**: un
servidor que bindea al hostname del contenedor arranca sin quejarse, el contenedor queda `running`,
el log dice «listo» y Traefik devuelve 502. Si esa línea no dice `0.0.0.0`, el 502 ya tiene causa.

### El `EXPOSE 80` heredado, y por qué NO se escucha también en el 80

La imagen **hereda un `EXPOSE 80`** de `nginx:alpine` y Docker no tiene `UNEXPOSE`, así que
`docker ps` muestra `80/tcp` además del 3000. Como `ExposedPorts` es un mapa JSON sin orden y
`80 < 3000`, cualquier heurística de «el primero» o «el menor» elegiría el puerto **malo** y
volveríamos al 502. La tentación evidente es escuchar también en el 80 para que dé igual cuál se
escoja. Se probó, y **se descarta**. Los dos experimentos:

| escenario | resultado |
|---|---|
| `listen 0.0.0.0:80;` con los **defaults de Docker** (`net.ipv4.ip_unprivileged_port_start=0`) | funciona: 200 por el 80 **y** por el 3000 |
| lo mismo con `--sysctl net.ipv4.ip_unprivileged_port_start=1024` (un entorno sin ese default) | `bind() to 0.0.0.0:80 failed (13: Permission denied)`, **nginx no arranca**, contenedor `exited (1)` y **el 3000 tampoco responde** |

Es decir: escuchar en el 80 no añade una segunda vía, añade una **dependencia de arranque** sobre
una condición del kernel del host que aquí no se puede verificar. Y el intercambio sale al revés de
lo que parece: hoy, elegir mal el puerto daría un 502 con el sitio **vivo** en el 3000; con el
`listen 80`, un bind denegado **mata el servidor entero**. Además el riesgo que evitaría ya está
cerrado —el dominio tiene el 3000 declarado a mano en Dokploy—, así que se cambiaría un riesgo
inexistente por uno real. Tampoco se baja a root ni se le ponen capacidades al binario para forzarlo.

**Lo que hay que hacer, entonces**: declarar el **3000** a mano en Dokploy y no dejar que se
autodetecte el puerto.

## Configuración en Dokploy

- Aplicación de la **web** → tipo **Dockerfile**.
- Ruta del Dockerfile: `apps/web/Dockerfile`. Contexto de build: **la raíz del repo** (`.`).
- Dominio `mareia.cervilla.es` → **puerto 3000** (HTTPS y certificado los pone Traefik; el
  contenedor habla HTTP plano, como debe ser detrás de un proxy que termina el TLS).
- Build args opcionales: `SITE_URL` y `BUILD_DATE`. **Ninguna variable secreta**: la web es estática
  y no habla con nada.

## Comprobar la imagen antes de desplegar

Es lo que hay que hacer siempre, y no mirando si el contenedor está `running`, sino pidiéndole las
páginas. Las ocho comprobaciones y su salida real sobre la imagen construida:

```sh
docker build -f apps/web/Dockerfile -t mareia-web --build-arg BUILD_DATE=2026-08-29 .
docker run -d --name mareia-web -p 3000:3000 mareia-web
docker logs mareia-web | head -1                    # 0. debe decir 0.0.0.0, no un id de contenedor

# Con `-w '%{http_code}'`: lo que importa es el ESTADO, no que salga algo por pantalla.
B=http://localhost:3000
curl -sS -o /dev/null -w '%{http_code}\n' $B/                                        # 1. 200
curl -sS -o /tmp/vigo.html -w '%{http_code}\n' $B/mareas/galicia/pontevedra/vigo/     # 2. 200 + tabla
curl -sS -o /dev/null -D - $B/mareas/galicia/pontevedra/vigo | grep -i '^location'    # 3. 301 relativo
curl -sS -o /dev/null -w '%{http_code}\n' $B/sitemap.xml                             # 4. 200
curl -sS -o /tmp/404.html -w '%{http_code}\n' $B/mareas/galicia/pontevedra/no-existe/ # 5. 404
docker cp mareia-web:/usr/share/nginx/html/404.html /tmp/404-de-la-imagen.html
diff /tmp/404.html /tmp/404-de-la-imagen.html   # el cuerpo del 404 ES el 404.html, no la portada
curl -sS -o /dev/null -w '%{http_code}\n' $B/50x.html                                # 6. 404, no 200
curl -sS -o /tmp/astro.html -w '%{http_code}\n' $B/_astro/                            # 7. 404 del portal
docker run --rm --entrypoint sh mareia-web -c 'command -v node npm pnpm corepack'     # 8. nada
```

```text
### 0. log de arranque
   [mareia] escucha: 0.0.0.0:3000 · raíz: /usr/share/nginx/html · publica el día: 2026-08-29

### 1. portada /
HTTP 200  text/html  5951 bytes

### 2. página de puerto /mareas/galicia/pontevedra/vigo/
HTTP 200  19706 bytes
   <title>: <title>Mareas en Vigo · sábado, 29 de agosto de 2026 · Mareia
   <table> servidas: 2 · filas <tr>: 36
   tabla del día (las 4 mareas de hoy en Vigo):
     pleamar 05:25  3,30 m
     bajamar 11:25  0,51 m
     pleamar 17:37  3,54 m
     bajamar 23:50  0,43 m

### 3. la misma SIN barra final
HTTP/1.1 301 Moved Permanently
Location: /mareas/galicia/pontevedra/vigo/
HTTP 301
   siguiendo la redirección: HTTP 200 tras 1 salto -> http://localhost:3000/mareas/galicia/pontevedra/vigo/

### 4. /sitemap.xml
HTTP 200  text/xml  6120 bytes
   <url> declaradas: 32 · primera: https://mareia.cervilla.es/

### 5. URL inventada /mareas/galicia/pontevedra/no-existe-este-puerto/
HTTP 404  5857 bytes
   <title>: <title>Esta página no existe · Mareia
   cuerpo idéntico al 404.html de dist/: SÍ (no es la portada con un 200 disfrazado)

### 6. /50x.html — el residuo de la imagen base (B1)
HTTP 404  5857 bytes
   ¿queda algún fichero de la base en la raíz web?
     404.html
     _astro
     index.html
     mareas
     sitemap.xml

### 7. /_astro/ — directorio real sin index.html (B2)
HTTP 404  5857 bytes
   <title>: <title>Esta página no existe · Mareia
   cuerpo: el 404.html del portal, no la página compilada en nginx
   marca «nginx» en los cuerpos de /50x.html y /_astro/: 0 veces

### 8. la imagen no lleva toolchain
   node      -> AUSENTE
   npm       -> AUSENTE
   pnpm      -> AUSENTE
   corepack  -> AUSENTE
   node_modules en la imagen: 
   35 ficheros bajo /usr/share/nginx/html
```

## El API (T-15)

```sh
# El contexto es la RAÍZ del repo, no apps/api
docker build -f apps/api/Dockerfile -t mareia-api .
```

Por la misma razón que la web: el proceso no es solo `apps/api`. Los casos de uso, el motor de
mareas y los adaptadores viven en `packages/`, y el dataset en `data/`. En Dokploy eso se dice
poniendo **`dockerContextPath` = `.`**; con el defecto (el directorio del Dockerfile) los `COPY`
fallan sobre ficheros que sí existen.

### Qué lleva la imagen, y qué no

Dos etapas, como la web, aunque la frontera aquí sea distinta y conviene decir por qué. **En Deno el
runtime *es* la herramienta**: no hay un artefacto compilado que separar del compilador, así que la
etapa final no puede quedarse «sin toolchain» en el sentido literal en que la de la web se queda
solo con nginx. Lo que sí se queda fuera es todo lo demás.

| | qué hay | medido |
|---|---|---|
| etapa `build` | el monorepo entero + la caché de dependencias | **no se despliega** |
| etapa `runtime` | el binario de Deno, 5 paquetes, el dataset y las dependencias resueltas | **118,5 MiB** en disco, de los que **104,4 MiB** son la base `denoland/deno:alpine-2.9.6` |

Es decir, la imagen es la base **más 14,2 MiB**: 12 MiB de dependencias ya descargadas y verificadas
contra `deno.lock` (`/deno-dir`) y **2,3 MiB** del árbol de la aplicación. Comprobado sobre la
imagen construida:

```text
  node       -> AUSENTE
  npm        -> AUSENTE
  pnpm       -> AUSENTE
  corepack   -> AUSENTE
  yarn       -> AUSENTE
  node_modules: 0 directorios
  __tests__:    0 directorios
  ficheros bajo /repo: 230
  /repo pesa: 2.2M · /deno-dir pesa: 11.5M
  /repo/apps: api  /repo/data: geo stations  /repo/packages: adapters domain-core module-contract modules usecases
```

El árbol se **arma a mano** en la etapa 1 en vez de heredarse: solo los cinco paquetes que resuelve
el import map de `deno.json`, `data/geo` y `data/stations`, y **sin `__tests__/`** (552 KB de 940 KB
de `packages/`, casi todo fixtures dorados de la USNO y capturas de Open-Meteo: material de CI, en
la imagen solo serían superficie). Que la lista esté escrita en el Dockerfile es lo que hace
comprobable la frase «la imagen lleva esto».

La imagen conserva **la forma del monorepo** (`/repo/apps/api/src`, `/repo/packages`, `/repo/data`)
en vez de aplanarla, y no es decorativo: `core-deps.ts` resuelve el dataset relativo a su propio
fichero (`../../../data`) y no desde el cwd, precisamente para que la ruta sea la misma en
desarrollo, en los tests y aquí.

Por lo mismo se descartó **`deno compile`**, que habría dado una imagen mínima sobre una base
distroless: en un ejecutable compilado `import.meta.url` apunta al sistema de ficheros virtual del
binario, así que el dataset dejaría de ser un árbol de ficheros legible dentro de la imagen para
pasar a ser opaco — y el dataset es el producto.

La base va **fijada por digest**, igual que las dos de la web y por lo mismo. Para subirla:

```sh
docker pull denoland/deno:alpine-2.9.6
docker image inspect denoland/deno:alpine-2.9.6 --format '{{index .RepoDigests 0}}'   # y al Dockerfile
```

### Los permisos, uno a uno

El `CMD` concede exactamente lo que `apps/api/deno.json` declara para las tareas de desarrollo, más
lo que el contenedor añade:

```
--allow-net                    Open-Meteo y AEMET, y escuchar en los dos puertos
--allow-env                    PORT/HOST/HEALTH_PORT/MAREIA_KV_PATH y AEMET_API_KEY
--allow-read=/repo/data        el dataset, lo único que este proceso lee del disco…
--allow-read=/var/lib/mareia   …salvo el almacén de KV
--allow-write=/var/lib/mareia  el ÚNICO sitio del contenedor donde este proceso puede escribir
--cached-only                  ninguna dependencia se descarga al arrancar
--unstable-kv                  Deno KV sigue siendo API inestable
```

Dos de esas líneas merecen nota. **`--allow-write` sobre el KV es obligatorio y no era obvio**: el
comentario de `weather-kv.ts` decía que el almacén «lo abre el runtime y no pasa por este permiso»,
y eso es cierto solo **mientras no se le da ruta**. Con ruta explícita, medido:

```text
$ deno run --unstable-kv --allow-read=/tmp/kvprueba prueba.ts
error: Uncaught (in promise) NotCapable: Requires write access to "/tmp/kvprueba/x.sqlite",
run again with the --allow-write flag
```

Y **`--cached-only`** es lo que impide que un arranque en producción salga a internet a buscar
código: si faltara algo de la etapa 1, el contenedor muere diciéndolo en vez de descargarlo.

El proceso corre como el usuario **`deno` (uid 1000), no como root**: los dos puertos están por
encima de 1024 y el dataset que sirve no le pertenece.

### El puerto, y la trampa del 502 — comprobada contra el kernel

`main.ts` bindea a **`0.0.0.0` explícito** aunque Node ya escuche por defecto en todas las
interfaces. La avería silenciosa de este despliegue es un proceso que bindea a la interfaz
equivocada: arranca sin quejarse, el contenedor queda `running`, el log dice «listo» y Traefik
devuelve 502. Que la interfaz sea un dato del arranque —y no una omisión— es lo que permite fijarla
si el entorno cambia.

El banner **lee la dirección del socket** (`server.address()`), no repite la constante:

```
$ docker logs mareia-api
[mareia-api] público (sin /health): 0.0.0.0:8787
[mareia-api] interno (/health): 0.0.0.0:8788
```

**Pero el log no es la prueba**, y aquí menos que en ningún sitio: un banner que se cree a sí mismo
es exactamente el fallo que se está buscando. La prueba se pidió al kernel, dentro del contenedor y
sin herramientas de por medio (la imagen no trae `ss` ni `netstat`, así que se lee `/proc/net/tcp`,
que es la tabla del propio kernel):

```text
$ docker exec mareia-api cat /proc/net/tcp
  sl  local_address rem_address   st ... uid
   0: 00000000:2254 00000000:0000 0A ... 1000
   1: 00000000:2253 00000000:0000 0A ... 1000
```

`st=0A` es `LISTEN`; `00000000` es `0.0.0.0` y no la IP del contenedor; `0x2253` = 8787 y `0x2254` =
8788; `uid=1000` es el usuario `deno`. No hay `/proc/net/tcp6`: no hay sockets IPv6 escuchando.

Y la segunda prueba, la que de verdad importa, es la que hace Traefik: pedirlo **desde otro
contenedor de la misma red**, contra la IP del contenedor y no contra `localhost`.

```text
GET http://172.18.0.2:8787/v1/ports    HTTP 200  application/json  43628 bytes  (153 puertos, todos con `quality`)
GET http://172.18.0.2:8787/health      HTTP 404  text/html          145 bytes
GET http://172.18.0.2:8788/health      HTTP 200  application/json    38 bytes
GET http://172.18.0.2:8787/v1/modules  HTTP 200  application/json   319 bytes
```

### Dónde se corta `/health`, y por qué ahí

**En los dos sitios**: en el enrutado de Dokploy y en el código. No es indecisión, es que cada uno
tapa lo que el otro no.

El corte **barato** es el del dominio: se declara la ruta `/v1` y Traefik no manda nada más. Pero
esa configuración vive **fuera del repositorio**, y el día que alguien clone el servicio para otro
entorno, o toque el dominio, el healthcheck vuelve a estar en internet y **ningún test lo nota**.
Por eso el corte de verdad está en `apps/api/src/http/public-app.ts`, que es lo que hace que el
proceso no publique `/health` **aunque el proxy le mande todo**.

Cómo: se levantan **dos servidores sobre la misma app**. El público (`PORT`, 8787) va envuelto en
`createPublicApp()`, que deja `/health` sin manejador (`next("router")`); el interno
(`HEALTH_PORT`, 8788) sirve la app entera y **no se expone**. Son dos puertos y no dos rutas porque
lo que separa a los dos públicos es **quién puede llegar**, y en Docker eso se dice con un puerto.

El 404 de `/health` es **el mismo, byte a byte, que el de cualquier ruta inventada** (el manejador
final de Express), y hay un test que lo ata: un cuerpo distinto para `/health` confirmaría a quien
sondea que esa ruta existe y está tapada, que es media respuesta.

El healthcheck **sigue existiendo**, que es lo que Dokploy necesita para distinguir «arrancando» de
«sirviendo». Va en el `HEALTHCHECK` de la imagen, por loopback contra el 8788, y no sale del
contenedor:

```text
$ docker inspect mareia-api --format '{{.State.Health.Status}}'
healthy
```

### El volumen de Deno KV

`Deno.openKv()` **sin ruta** usa el almacén por defecto del proceso, que en un contenedor vive en la
capa efímera: **cada redespliegue tira la caché del boletín** y el primer arranque vuelve a pegarle
a AEMET y a Open-Meteo por los 153 puertos. La ruta se declara con **`MAREIA_KV_PATH`**, que el
Dockerfile fija en `/var/lib/mareia/kv/weather.sqlite`. En desarrollo la variable no se pone y se
sigue usando el almacén por defecto, que es lo que allí se quiere.

**Cuánto ocupa, medido** — un ciclo completo de peticiones (153 puertos × `/weather` y `/bulletin`,
306 respuestas, 25 s, todas 200):

```text
entradas: 288  (144 celdas × marine y forecast)
valores serializados a JSON: 71.970 bytes
en disco: 4.296.208 bytes = 4,1 MiB
          weather.sqlite      131.072 B
          weather.sqlite-wal 4.128.272 B
          weather.sqlite-shm    32.768 B
```

Tres cosas que esa medida dice y conviene no perder:

1. **Casi todo es el WAL de SQLite**, no los datos: 72 KB de valores ocupan 4,1 MiB en disco. Quien
   dimensione el volumen tiene que contar con el WAL, no con el JSON.
2. **Tres ciclos más no añadieron un solo byte** (4.296.208 en los cuatro): el segundo pase se sirve
   entero de caché. Esa es justamente la prueba de que la caché funciona, y de que el almacén no
   crece con las lecturas.
3. **El boletín aporta cero entradas** porque la instancia de prueba corrió **sin `AEMET_API_KEY`**.
   Con clave, el boletín cachea **por zona costera y no por puerto**: como mucho **11 entradas**
   (las 11 zonas de `aemet-zones.json`), y Deno KV topa cada valor en 64 KiB, así que el techo que
   añaden son ~700 KiB.

Y que la caché **sobrevive al redespliegue** no se supone, se comprobó reiniciando el contenedor con
el volumen montado:

```text
marine:   {'status': 'ok', 'fetchedAt': '2026-08-29T22:22:39Z', 'ageSeconds': 60, 'stale': False}
```

`fetchedAt` es de antes del reinicio y `ageSeconds` > 0: la respuesta salió del volumen, no de
Open-Meteo.

El volumen es **comodidad y no requisito**. Si el día del despliegue no está montado —o está montado
sin permiso de escritura para el uid 1000—, `openOnce()` captura el fallo, lo cuenta por stderr y la
caché degrada a memoria: se pierde entre reinicios, pero el servicio sirve igual.

### Configuración en Dokploy (el API)

- Aplicación `mareia-api` → tipo **Dockerfile**.
- Ruta del Dockerfile: `apps/api/Dockerfile`. Contexto de build: **la raíz del repo** (`.`).
- Dominio `mareia.cervilla.es` → **ruta `/v1`** y **puerto 8787**. La ruta es la mitad del corte de
  `/health`; la otra mitad está en el código.
- **Volumen**: `/var/lib/mareia/kv` (volumen con nombre; **no** un bind mount del host, que traería
  la propiedad del host y dejaría al uid 1000 sin escribir). Dimensionar con holgura sobre los
  4,1 MiB medidos.
- **Variables de entorno**: `AEMET_API_KEY` (secreto; **sin ella el servicio arranca igual** y el
  boletín degrada diciendo que falta la credencial). `MAREIA_KV_PATH`, `HOST`, `PORT` y
  `HEALTH_PORT` ya vienen en la imagen y no hay que declararlas salvo para cambiarlas.
- **El 8788 no se publica.** Es el healthcheck.

### Comprobar la imagen antes de desplegar

```sh
docker build -f apps/api/Dockerfile -t mareia-api .
docker network create mareia-red
docker volume create mareia-kv
docker run -d --name mareia-api --network mareia-red -v mareia-kv:/var/lib/mareia/kv mareia-api
IP=$(docker inspect mareia-api --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')

# 1. Dónde escucha DE VERDAD (la tabla del kernel, no el log). 0A = LISTEN, 00000000 = 0.0.0.0
docker exec mareia-api cat /proc/net/tcp

# 2. Desde OTRO contenedor, que es lo que hace Traefik. No vale `localhost`.
docker run --rm --network mareia-red curlimages/curl:8.11.1 -sS -o /dev/null \
  -w '%{http_code}\n' "http://$IP:8787/v1/ports"    # 200
docker run --rm --network mareia-red curlimages/curl:8.11.1 -sS -o /dev/null \
  -w '%{http_code}\n' "http://$IP:8787/health"      # 404, NO 200
docker run --rm --network mareia-red curlimages/curl:8.11.1 -sS -o /dev/null \
  -w '%{http_code}\n' "http://$IP:8788/health"      # 200

# 3. El healthcheck del contenedor pasa a `healthy` en ~40 s
docker inspect mareia-api --format '{{.State.Health.Status}}'

# 4. La imagen no lleva toolchain de Node
docker run --rm --entrypoint sh mareia-api -c 'command -v node npm pnpm corepack'   # nada
```

## El rebuild diario de la web

Lo monta `.github/workflows/rebuild-diario.yml`, con `cron` a las **04:20 UTC** y
`workflow_dispatch` para lanzarlo a mano.

**De qué depende, y qué depende de él** — es lo que hay que leer antes de tocarlo:

- Depende del `ARG BUILD_DATE` de `apps/web/Dockerfile` **y de pasárselo explícito**. Un
  redespliegue a secas **no basta**: el `RUN` que escribe la fecha es una capa de Docker y, con el
  mismo commit y sin build arg, se reutiliza de caché. El sitio publicaría el día de ayer **con un
  despliegue nuevo y en verde**, que es la peor forma de estar roto.
- De él depende la **normativa fechada de T-19** (vedas, tallas mínimas), que está pensada para
  **degradar cuando envejece**. Un dato que degrada con el tiempo, sobre un sitio que no se
  reconstruye, no degrada nunca: se queda para siempre en el día en que se construyó, diciendo que
  está fresco. Si este workflow se apaga, **T-19 deja de cumplir su promesa en silencio**.

Qué hace, en orden: comprueba que están los secretos → lee los `buildArgs` que ya tiene la
aplicación y **sustituye solo la línea `BUILD_DATE`** (mandar el campo entero a ciegas borraría
`SITE_URL` o cualquier otro que alguien haya puesto en el panel) → **relee para confirmar que el
PATCH surtió efecto** → despliega → y **comprueba el resultado**, no la llamada: espera hasta diez
minutos a que `mareia.cervilla.es/mareas/galicia/pontevedra/vigo/` publique
`data-otro-dia-build="<hoy>"`.

Los dos pasos de confirmación existen porque «se pidió un despliegue» y «el sitio publica hoy» son
cosas distintas, y la segunda es la que le importa a quien lo visita. La relectura del `buildArgs`
además cubre una incertidumbre honesta: el campo se escribe contra `application.update` de la API de
Dokploy y **eso no se pudo probar contra el panel real desde la sesión que lo escribió**; si algún
día la API cambia de forma, esto se pone **rojo** en vez de desplegar la fecha de ayer con toda la
pinta de haber funcionado.

**Secretos del repositorio** que necesita — sin ellos el job sale en **rojo a propósito**, porque un
rebuild que no corre es invisible (el sitio sigue en pie, solo que con la fecha de otro día) y la
única señal posible es esa:

| secreto | qué es |
|---|---|
| `DOKPLOY_API_URL` | raíz del panel, sin `/api` |
| `DOKPLOY_API_KEY` | credencial de la API |
| `DOKPLOY_WEB_APP_ID` | `applicationId` de `mareia-web` |

## El e2e contra producción

```sh
pnpm test:e2e:prod                                    # https://mareia.cervilla.es
MAREIA_URL=https://otro.ejemplo pnpm test:e2e:prod     # otro despliegue
```

Tres recorridos (`tests/e2e/produccion/despliegue.spec.ts`), que son las tres promesas de T-15:
que **`/v1/ports` responde** con el catálogo y su `quality`, que **`/health` NO es alcanzable desde
fuera**, y que **la portada sigue sirviéndose** (enganchar el API al dominio no puede llevarse por
delante la web de T-17).

Dos decisiones que lo hacen usable justo después de desplegar:

- **No necesita navegador.** Todo se comprueba con el fixture `request`, así que corre sin
  `playwright install` — nada de bajarse 150 MB de Chromium para preguntar por tres URL.
- **Se puede lanzar sin haber desplegado**, y dice qué pasa en vez de escupir un error de red. Los
  dos modos de «no está» se cuentan distintos porque llevan a mirar sitios distintos:

```text
# sin desplegar el API (el estado del dominio antes de T-15)
Error: https://mareia.cervilla.es/v1/ports contesta 502: hay un proxy delante, pero el servicio de
detrás no está sirviendo. […] un contenedor 'running' con el puerto mal declarado da este mismo 502.

# dominio que no resuelve
Error: No se pudo ni conectar con https://…/v1/ports.
  Esto NO es un fallo del recorrido: o el dominio no resuelve, o no hay nada escuchando, o la
  máquina desde la que se lanza no tiene salida.
  Si el despliegue aún no se ha hecho, es lo esperado: despliega y vuelve a lanzarlo.
  Causa original: apiRequestContext.get: getaddrinfo ENOTFOUND …
```

Y **sabe fallar**, que es lo que lo convierte en un gate. Se probó levantando localmente los dos
contenedores reales detrás de un nginx que reproduce el corte por ruta de Traefik (`/v1` al API, el
resto a la web): los tres recorridos en verde. Con la misma maqueta pero publicando el healthcheck
—una línea más en el nginx—, el recorrido de `/health` se pone en rojo diciendo «devolvió el payload
del healthcheck: está publicado en internet».

Este recorrido **no corre en CI** a propósito: los PR se validan contra el `dist/` construido
(`pnpm test:e2e`), y hacer que un PR dependa de que producción esté en pie sería atar el rojo del
repositorio a una avería que no está en el PR. Se lanza **después de desplegar**.

## Qué vigila esto en CI

En el job `anti-slop`, y por imagen fijada para que local y CI corran **exactamente lo mismo**:

```sh
git ls-files -z '*.sh' | xargs -0 --no-run-if-empty \
  docker run --rm -i -v "$PWD:/repo" -w /repo koalaman/shellcheck:v0.10.0 -S error
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.7 -color
docker run --rm -i hadolint/hadolint:v2.12.0-alpine hadolint - < apps/web/Dockerfile
docker run --rm -i hadolint/hadolint:v2.12.0-alpine hadolint - < apps/api/Dockerfile
```

Existe porque este repo tiene un `.sh` que corre como **PID 1 en una imagen de producción** y dos
Dockerfiles que construyen lo que se sirve en el dominio: haberlos leído una vez no es un gate. Los
cuatro pasos se han comprobado **en rojo** además de en verde (un `[ "$1" = ]`, un workflow con
`github.eventt_name`, un `FROM alpine:latest`); un gate que no sabe fallar no vigila nada.

**`actionlint` (T-15)** cierra el peldaño que faltaba desde T-17: los workflows son código de CI y
hasta ahora no los miraba nadie. La imagen trae `shellcheck` dentro, así que de paso revisa los
bloques `run:` —shell que corre en cada PR y que el `shellcheck` de arriba **no** ve, porque no son
ficheros `.sh`—. Y lo primero que sacó fue un hallazgo **en el propio paso de shellcheck de T-17**:

```text
.github/workflows/ci.yml:47:9: shellcheck reported issue in this script:
SC2046:warning:2:12: Quote this to prevent word splitting [shellcheck]
```

Era real. `$(git ls-files '*.sh')` sin comillas se parte por espacios: un `.sh` con un espacio en la
ruta se convertiría en dos argumentos, shellcheck miraría dos ficheros que no existen y **saldría en
verde**. Un gate que se calla ante una entrada rara no es un gate. De ahí el `-z` + `xargs -0`.

`hadolint` cubre ahora **los dos** Dockerfiles; sobre el del API sacó `DL3003` (un `cd` dentro de un
`RUN`), arreglado con rutas absolutas.

## Qué queda pendiente

- **El despliegue en sí.** T-15 deja la imagen, la configuración y las pruebas locales; enganchar
  `mareia-api` en Dokploy, crear el volumen y lanzar `pnpm test:e2e:prod` es el paso siguiente.
- **`AEMET_API_KEY`** en el entorno de la aplicación. Sin ella la instancia funciona y el boletín
  dice que falta la credencial, así que no bloquea el despliegue — pero mientras falte, la caché de
  boletines del volumen está vacía y las cifras de arriba se quedan cortas.
- **Compresión y cabeceras de caché** de la web: hoy no hay ni `gzip` ni `Cache-Control` explícito
  (se sirve con `ETag`/`Last-Modified`). Decidir si lo pone nginx o Traefik.
- **Pase adversario de despliegue** y la medida de **Lighthouse SEO ≥ 95**, que necesita un
  navegador y quedó pendiente desde T-09.
- **El `deno.lock` fija integridad de las dependencias, pero el `--frozen-lockfile` del build vive
  en la etapa 1**: subir el digest de una base hay que hacerlo **en tres sitios** (los dos `FROM` de
  `apps/api/Dockerfile`, que son la misma referencia, y la receta del final de este documento).

### Cerrado en T-15

- El API `/v1` tiene imagen, permisos acotados y escucha comprobada contra el kernel.
- El volumen de Deno KV, con su ruta por variable y su tamaño medido.
- El healthcheck del contenedor, y `/health` fuera del enrutado público.
- El rebuild diario programado.
- `actionlint` sobre los workflows, `hadolint` sobre los dos Dockerfiles y el `shellcheck` arreglado.
- **El build es hermético**: el `packageManager` de la raíz lleva su hash de integridad
  (`pnpm@10.33.0+sha512.…`) y **corepack verifica el tarball contra él** antes de ejecutarlo. Sigue
  descargándolo —eso no lo cierra un Dockerfile—, pero ya no confía en lo que le llegue: un registry
  comprometido o un intermediario que sirva otro pnpm **hacen fallar el build** en vez de meter un
  gestor de paquetes ajeno en la imagen que se despliega. Comprobado que sabe fallar: alterando un
  carácter del hash, `Error: Mismatch hashes. Expected …0, got …9`.
- El e2e contra producción.

## Nota sobre el entorno de desarrollo del enjambre

La verificación de arriba se hizo en un entorno cuyo tráfico HTTPS pasa por un proxy que
**intercepta el TLS**, y la imagen base de Node no confía en su CA: `pnpm install` muere ahí con
`SELF_SIGNED_CERT_IN_CHAIN`. Eso es del entorno, no del Dockerfile —en Dokploy no existe ese
proxy—, así que **no se ha metido ningún parche de certificados en la imagen**: hornear la CA de un
MITM en algo que se despliega sería un defecto de seguridad de verdad, y además permanente.

Lo que se hace es **sustituir la base al construir, sin tocar el Dockerfile**. La receta completa,
para que la pueda repetir cualquiera:

```sh
# 1. Una base igual que la del Dockerfile, pero que confíe en la CA del proxy.
#    Ojo: `apk add ca-certificates` NO sirve aquí, porque para bajar ese paquete haría falta
#    justamente la confianza que falta. Se añade la CA al bundle que la imagen ya trae.
mkdir -p /tmp/base-ca && cp /root/.ccr/ca-bundle.crt /tmp/base-ca/proxy-ca.crt
cat > /tmp/base-ca/Dockerfile <<'DOCKERFILE'
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32
COPY proxy-ca.crt /usr/local/share/ca-certificates/proxy-ca.crt
RUN cat /usr/local/share/ca-certificates/proxy-ca.crt >> /etc/ssl/certs/ca-certificates.crt
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/proxy-ca.crt
DOCKERFILE
docker build -t node-con-ca-del-proxy:22-alpine /tmp/base-ca

# 2. El build de siempre, con la base sustituida. La clave del `--build-context` es la referencia
#    EXACTA que aparece en el `FROM` del Dockerfile, digest incluido.
docker build -f apps/web/Dockerfile -t mareia-web --build-arg BUILD_DATE=2026-08-29 \
  --build-context 'node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32=docker-image://node-con-ca-del-proxy:22-alpine' .
```

`/root/.ccr/ca-bundle.crt` es la ruta de la CA en el arnés del enjambre; si el proxy es otro, ese es
el único dato que cambia. Y si algún día se sube el digest de la base (ver «La imagen»), hay que
subirlo **en los dos sitios**: en el `FROM` del Dockerfile y en esta receta.

**La imagen del API tiene el mismo problema y la misma solución**, cambiando lo que hay que cambiar:
allí quien no confía en la CA es Deno (`invalid peer certificate: UnknownIssuer` al descargar las
dependencias npm), y lo que se le añade es `DENO_CERT`.

```sh
mkdir -p /tmp/base-ca-deno && cp /root/.ccr/ca-bundle.crt /tmp/base-ca-deno/proxy-ca.crt
cat > /tmp/base-ca-deno/Dockerfile <<'DOCKERFILE'
FROM denoland/deno:alpine-2.9.6@sha256:aa665f8777136863b5b8a0445a5cdfccff8103b5f40c9a877de5276b04facb1e
COPY proxy-ca.crt /usr/local/share/ca-certificates/proxy-ca.crt
RUN cat /usr/local/share/ca-certificates/proxy-ca.crt >> /etc/ssl/certs/ca-certificates.crt
ENV DENO_CERT=/usr/local/share/ca-certificates/proxy-ca.crt
DOCKERFILE
docker build -t deno-con-ca-del-proxy:alpine-2.9.6 /tmp/base-ca-deno

docker build -f apps/api/Dockerfile -t mareia-api \
  --build-context 'denoland/deno:alpine-2.9.6@sha256:aa665f8777136863b5b8a0445a5cdfccff8103b5f40c9a877de5276b04facb1e=docker-image://deno-con-ca-del-proxy:alpine-2.9.6' .
```

**Con una diferencia que hay que decir, porque muerde**: `--build-context` sustituye la base en
**todas** las etapas que la nombran. En la web eso da igual —su etapa final es `nginx:alpine`, que
no se sustituye, así que la imagen que se despliega sale limpia—, pero **las dos etapas del API son
la misma base de Deno**, de modo que la imagen construida con esta receta **sí lleva la CA del
proxy dentro**:

```text
$ docker run --rm --entrypoint sh mareia-api -c 'ls /usr/local/share/ca-certificates/ | wc -l; echo $DENO_CERT'
1
/usr/local/share/ca-certificates/proxy-ca.crt
```

Es decir: **la imagen que sale de esta receta es para probar en local y no se publica**. Hornear la
CA de un interceptor en algo que va a producción sería un defecto de seguridad de verdad, y además
permanente. En Dokploy no existe ese proxy y el build corre **sin `--build-context`**, con la base
oficial y sin CA añadida — que es la razón de que el parche viva en el comando y no en el
Dockerfile: así no hay forma de que se cuele en un despliegue por olvido.
