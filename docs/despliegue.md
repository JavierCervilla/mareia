# Despliegue

## Qué se despliega hoy y qué no

Hoy se despliega **la web**: las 33 páginas estáticas que genera Astro (32 páginas del portal más
la de «no existe»). **El API `/v1` no**, y tampoco el volumen de Deno KV ni el rebuild diario: eso
sigue en T-15.

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

## Qué vigila esto en CI

En el job `anti-slop`, y por imagen fijada para que local y CI corran **exactamente lo mismo**:

```sh
docker run --rm -v "$PWD:/repo" -w /repo koalaman/shellcheck:v0.10.0 -S error $(git ls-files '*.sh')
docker run --rm -i hadolint/hadolint:v2.12.0-alpine hadolint - < apps/web/Dockerfile
```

Existe porque este repo tiene desde ahora un `.sh` que corre como **PID 1 en una imagen de
producción** y un Dockerfile que construye lo que se sirve en el dominio: haberlos leído una vez no
es un gate. Los dos pasos se han comprobado **en rojo** además de en verde (un `[ "$1" = ]` y un
`FROM alpine:latest` los hacen fallar); un gate que no sabe fallar no vigila nada. Y de paso cierra
media casilla de T-15: el `shellcheck -S error` que tenía apuntado ya corre, sobre **todos** los
`.sh` del repo.

## Qué queda pendiente (T-15)

- **El API `/v1`**: su propia imagen, el volumen persistente para Deno KV y el secreto
  `AEMET_API_KEY` (sin él la instancia funciona: el boletín dice que falta la credencial).
- **El rebuild diario programado**, que es lo que hace que el portal publique el día de hoy:
  reconstruir con `--build-arg BUILD_DATE=$(date -u +%F)` y redesplegar. Cuesta ~8 s de build.
- **Healthcheck del contenedor**: aquí se ha dejado fuera a propósito para no ampliar el alcance,
  pero para Dokploy es lo que distingue «arrancando» de «sirviendo».
- **Compresión y cabeceras de caché**: hoy no hay ni `gzip` ni `Cache-Control` explícito (se sirve
  con `ETag`/`Last-Modified`). Decidir si lo pone nginx o Traefik.
- **e2e contra producción, pase adversario de despliegue y la medida de Lighthouse SEO ≥ 95**, que
  necesita un navegador y por eso quedó pendiente desde T-09.
- **El build todavía no es hermético**: `corepack` descarga el tarball de pnpm en cada build limpio.
  Cerrarlo pide que el `packageManager` de la raíz lleve su hash de integridad
  (`pnpm@10.33.0+sha512.…`, que corepack verifica) o vendorizar el tarball. Las dos cosas son del
  monorepo, no de esta imagen, y por eso no se han hecho aquí.
- **`actionlint`** sobre `.github/workflows/`, que sigue siendo el peldaño 1 pendiente de T-15 (el
  `shellcheck` ya corre, ver arriba).

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
