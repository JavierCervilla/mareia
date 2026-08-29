# syntax=docker/dockerfile:1

# Imagen de la web de Mareía: las 33 páginas SSG servidas como ficheros estáticos.
#
# El contexto de build es la RAÍZ del repo, no `apps/web`:
#
#     docker build -f apps/web/Dockerfile -t mareia-web .
#
# porque el sitio no se rellena en el navegador, se CALCULA en build llamando a los casos de uso.
# Necesita `packages/` y el dataset de `data/`. Lo que no necesita, lo recorta `.dockerignore`.

# ---------------------------------------------------------------------------------------------
# Etapa 1: construir el sitio. Todo el toolchain vive y muere aquí.
# ---------------------------------------------------------------------------------------------
# La base va fijada por DIGEST y no solo por el tag: `22-alpine` es una etiqueta móvil, y con el
# rebuild diario de T-15 la base cambiaría bajo los pies sin que ningún commit lo cuente. Así, la
# base es dato del repo y actualizarla es un cambio que se revisa. Para subirla:
#   docker pull node:22-alpine && docker image inspect node:22-alpine --format '{{index .RepoDigests 0}}'
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS build

# corepack usa el pnpm EXACTO que fija `packageManager` en el package.json de la raíz: la versión
# del gestor es dato del repo, no de esta imagen, y así no se puede desincronizar del lockfile.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
# corepack sigue DESCARGANDO el tarball de pnpm en cada build limpio —eso no lo cierra un
# Dockerfile—, pero desde T-15 lo que se descargue ya no puede ser cualquier cosa: el
# `packageManager` de la raíz lleva su hash de integridad (`pnpm@10.33.0+sha512.…`) y corepack
# **verifica el tarball contra él** antes de ejecutarlo. Es decir, el build depende de la red pero
# ya no confía en ella: un registry comprometido o un intermediario que sirva otro pnpm hacen
# fallar el build en vez de meter un gestor de paquetes ajeno en la imagen que se despliega.

WORKDIR /repo

# El monorepo entero en una capa. La alternativa —copiar primero cada `package.json` para que la
# instalación cachee aparte— es más rápida al tocar código, pero se rompe en silencio el día que
# alguien añada un paquete al workspace y no lo apunte aquí. Y el caso que de verdad importa, el
# rebuild diario de T-15, no toca ni un fichero: reaprovecha esta capa entera.
COPY . .

RUN pnpm install --frozen-lockfile

# Los dos ARG van DESPUÉS de la instalación a propósito: cambiar el día invalida la caché a partir
# de esta línea, así que el rebuild diario vuelve a hacer solo el `astro build` (segundos), no la
# instalación de dependencias.
#
# SITE_URL: de él cuelgan las canónicas y el `sitemap.xml`. Sin él, Astro avisa y hornea
# `localhost:4321`, es decir, publica un mapa del sitio que apunta a la máquina de quien construyó.
ARG SITE_URL=https://mareia.cervilla.es

# BUILD_DATE es un ARG de BUILD y no una variable de runtime, y no puede ser otra cosa: el día
# publicado se hornea en el HTML de las 33 páginas. Un `ENV` que se cambiara al arrancar el
# contenedor no movería ni una marea, solo mentiría. Vacío = el día UTC del build, que es lo que
# quiere el rebuild diario; fijarlo hace el build reproducible byte a byte.
ARG BUILD_DATE=""

RUN set -eu; \
    fecha="${BUILD_DATE:-$(date -u +%F)}"; \
    mkdir -p /marca; \
    printf '%s\n' "$fecha" > /marca/build-date; \
    SITE_URL="$SITE_URL" BUILD_DATE="$fecha" pnpm --filter web build

# ---------------------------------------------------------------------------------------------
# Etapa 2: servir. Aquí no hay node, ni pnpm, ni node_modules, ni el código fuente: solo el HTML
# y nginx. Lo que no está en la imagen no se puede explotar ni se paga al desplegar.
# ---------------------------------------------------------------------------------------------
# Fijada por digest, por lo mismo que la de arriba (cómo subirla: ver el comentario de la etapa 1).
FROM nginx:alpine@sha256:db35bfc6b2951e7f8a72db5db120288c127ffaeeb4a6d4b95a26fead017d5913 AS runtime

# El `server` por defecto de la imagen escucha en el 80 y sirve su propia portada: fuera, para que
# el único sitio que responda sea el nuestro.
# Y `/var/cache/nginx` tiene que ser escribible por el usuario `nginx`: el master crea ahí sus
# directorios temporales al arrancar y, como aquí NO es root, sin este chown el arranque muere.
# Y la raíz web de la base se VACÍA antes de copiar la nuestra: `COPY` fusiona, no limpia, así que
# los ficheros de la base que el `dist/` no pisa (su `50x.html`) sobrevivirían y el dominio
# respondería 200 en una URL que no es del portal, con una página en inglés que además publica la
# marca `nginx` pese al `server_tokens off`. Se borra el contenido, no el directorio: es la raíz.
RUN rm -f /etc/nginx/conf.d/default.conf \
    && rm -rf /usr/share/nginx/html/* \
    && chown -R nginx:nginx /var/cache/nginx

COPY apps/web/nginx.conf /etc/nginx/nginx.conf
COPY --chmod=0755 apps/web/docker-entrypoint.sh /usr/local/bin/mareia-entrypoint
# El día que publica el HTML, para que el arranque lo diga: es la forma de ver desde fuera si el
# contenedor que está corriendo es el rebuild de hoy o el de la semana pasada.
COPY --from=build /marca/build-date /etc/mareia/build-date
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

# Sin root: el 3000 está por encima de 1024, así que no hace falta privilegio para escucharlo, y
# el contenido que sirve tampoco le pertenece (lo lee, no lo puede reescribir).
USER nginx

# El puerto que el dominio declara en Dokploy.
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/mareia-entrypoint"]
