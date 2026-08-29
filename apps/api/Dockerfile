# syntax=docker/dockerfile:1

# Imagen del API de Mareía: el core (`/v1/ports…`) y los módulos, sobre Deno.
#
# El contexto de build es la RAÍZ del repo, no `apps/api`:
#
#     docker build -f apps/api/Dockerfile -t mareia-api .
#
# porque el proceso no es solo `apps/api`: los casos de uso, el motor de mareas y los adaptadores
# viven en `packages/`, y el dataset en `data/`. En Dokploy eso se dice poniendo el contexto de
# build en `.` y NO en el directorio del Dockerfile: si se deja el defecto, estos `COPY` fallan
# sobre ficheros que sí existen.

# ---------------------------------------------------------------------------------------------
# Etapa 1: resolver dependencias y ARMAR el árbol exacto que el proceso ejecuta.
# ---------------------------------------------------------------------------------------------
# Base fijada por DIGEST y no solo por el tag, igual que en `apps/web/Dockerfile`: un tag es una
# etiqueta móvil y la avería llegaría un martes sin que nada del repo hubiera cambiado. Para subirla:
#   docker pull denoland/deno:alpine-2.9.6
#   docker image inspect denoland/deno:alpine-2.9.6 --format '{{index .RepoDigests 0}}'
FROM denoland/deno:alpine-2.9.6@sha256:aa665f8777136863b5b8a0445a5cdfccff8103b5f40c9a877de5276b04facb1e AS build

WORKDIR /repo

# El monorepo entero en una capa, por lo mismo que la web: copiar paquete a paquete es más rápido
# al tocar código pero se rompe en silencio el día que alguien añada uno y no lo apunte aquí.
# Lo que no debe viajar lo recorta `.dockerignore`.
COPY . .

WORKDIR /repo/apps/api

# `--frozen-lockfile`: si `deno.lock` no está al día, el build falla en vez de resolver
# dependencias nuevas en silencio (el equivalente del `--frozen-lockfile` de pnpm en la web).
# `--node-modules-dir=none`: las dependencias npm se resuelven desde la caché global de Deno, que
# es lo que la etapa siguiente se lleva. Sin esto podría aparecer un `node_modules/` a medias que
# ni viaja ni haría falta.
RUN deno cache --frozen-lockfile --node-modules-dir=none src/main.ts

# El árbol que se despliega, montado a mano y no heredado: solo los cinco paquetes que el import
# map de `deno.json` resuelve, el dataset que `core-deps.ts` lee, y nada más. Que esté escrito
# aquí es lo que hace comprobable la frase «la imagen lleva esto»: cualquier cosa que no aparezca
# en estas líneas no está dentro.
#
# Y sin `__tests__/`: son la mitad del peso de `packages/` (552 KB de 940 KB, medido) y en su
# mayoría fixtures dorados —efemérides de la USNO, capturas de Open-Meteo—. Material de CI, no de
# producción: en la imagen solo serían superficie.
# Rutas absolutas y ningún `cd`: hadolint lo marca (DL3003) y tiene razón, porque un `cd` a
# medias de un `RUN` encadenado deja el resto de la orden dependiendo de dónde acabó el anterior.
RUN set -eu; \
    mkdir -p /salida/apps/api /salida/packages /salida/data; \
    cp /repo/apps/api/deno.json /repo/apps/api/deno.lock /salida/apps/api/; \
    cp -R /repo/apps/api/src /salida/apps/api/src; \
    find /salida -name '*_test.ts' -delete; \
    for p in adapters domain-core module-contract usecases modules/weather; do \
      mkdir -p "/salida/packages/$p"; \
      cp -R "/repo/packages/$p/src" "/salida/packages/$p/src"; \
    done; \
    cp -R /repo/data/geo /repo/data/stations /salida/data/; \
    find /salida -type d -name __tests__ -prune -exec rm -rf {} +

# ---------------------------------------------------------------------------------------------
# Etapa 2: ejecutar. Aquí no está el monorepo, ni los tests, ni el pipeline de datos, ni la web.
# ---------------------------------------------------------------------------------------------
# La misma base, y hay que decir por qué no es una más pequeña: en Deno el runtime **es** la
# herramienta, no hay un artefacto compilado que separar del compilador. La alternativa era
# `deno compile` sobre una base mínima, y se descarta: `core-deps.ts` resuelve el dataset desde
# `import.meta.url`, que en un ejecutable compilado apunta al sistema de ficheros virtual del
# binario, no al disco — el dataset dejaría de ser un árbol de ficheros legible dentro de la
# imagen para pasar a ser opaco. Lo que sí se queda fuera es todo lo demás: la etapa 1 entera con
# su copia del monorepo, y ni npm ni node ni node_modules aparecen por ningún lado.
FROM denoland/deno:alpine-2.9.6@sha256:aa665f8777136863b5b8a0445a5cdfccff8103b5f40c9a877de5276b04facb1e AS runtime

# Las dependencias ya descargadas y verificadas contra el lockfile en la etapa 1. Van con
# `--chown` porque el proceso NO corre como root y Deno escribe aquí su caché de transpilación.
COPY --from=build --chown=deno:deno /deno-dir /deno-dir

# El árbol armado arriba, en la misma disposición que en el repo: `core-deps.ts` resuelve el
# dataset relativo a su propio fichero (`../../../data`), así que `/repo/apps/api/src/` tiene que
# tener `/repo/data/` tres niveles por encima. Es la razón de que la imagen conserve la forma del
# monorepo en vez de aplanarla.
COPY --from=build --chown=deno:deno /salida /repo

# Dónde persiste la caché del boletín. Sin esta ruta, `Deno.openKv()` usa el almacén por defecto
# del proceso, que vive en la capa efímera del contenedor: cada redespliegue tiraría la caché y el
# primer arranque volvería a pegarle a AEMET y a Open-Meteo por todos los puertos. Con la ruta
# puesta, basta montar un volumen aquí (ver `docs/despliegue.md`).
# El directorio se crea con su dueño AUNQUE no se monte nada: así el arranque sin volumen también
# escribe, en vez de degradar en silencio a la caché en memoria.
ENV MAREIA_KV_PATH=/var/lib/mareia/kv/weather.sqlite
RUN mkdir -p /var/lib/mareia/kv && chown -R deno:deno /var/lib/mareia

WORKDIR /repo/apps/api

# Sin root. Los dos puertos están por encima de 1024, así que no hace falta privilegio, y el
# dataset que sirve tampoco le pertenece: lo lee, no lo puede reescribir.
USER deno

# `0.0.0.0` explícito: la avería silenciosa de este despliegue es un proceso que bindea a la
# interfaz equivocada, arranca sin quejarse, deja el contenedor `running` y hace que Traefik
# conteste 502. Lo dice `main.ts`, y el banner de arranque lo LEE del socket en vez de repetirlo.
# Sin esto el runtime abre una conexión TLS a Cloudflare **en cada arranque**, antes de la primera
# petición y sin que ninguna línea de nuestro código lo pida: es su comprobación de versión. No es
# un fallo de seguridad, pero un servicio que sale a internet para algo que no le hemos pedido es
# ruido en el perímetro y una dependencia que no controlamos en el arranque. Lo midió el
# verificador de T-15 sobre el contenedor recién levantado.
ENV DENO_NO_UPDATE_CHECK=1

ENV HOST=0.0.0.0
ENV PORT=8787
ENV HEALTH_PORT=8788

# El puerto que el dominio declara en Dokploy. El 8788 NO se expone a propósito: es el healthcheck,
# y quien tiene que alcanzarlo está dentro de la red del despliegue.
EXPOSE 8787

# El healthcheck que Dokploy necesita para distinguir «arrancando» de «sirviendo», contra el
# puerto interno y por loopback: no sale del contenedor. `wget` es el de busybox, ya en la base.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --spider --tries=1 http://127.0.0.1:8788/health || exit 1

# Los permisos, uno a uno y acotados como en `deno.json`:
#   --allow-net                    salir a Open-Meteo y AEMET, y escuchar en los dos puertos.
#   --allow-env                    PORT/HOST/HEALTH_PORT/MAREIA_KV_PATH y AEMET_API_KEY.
#   --allow-read=/repo/data        el dataset, que es lo ÚNICO que este proceso lee del disco…
#   --allow-read=/var/lib/mareia   …salvo el almacén de KV: con ruta explícita, `Deno.openKv()`
#   --allow-write=/var/lib/mareia  exige leer Y escribir sobre ella (medido: sin `--allow-write`
#                                  lanza `NotCapable`). Es el único sitio del contenedor donde
#                                  este proceso puede escribir.
#   --cached-only                  ninguna dependencia se descarga al arrancar: si faltara algo de
#                                  la etapa 1, el contenedor muere diciéndolo en vez de salir a
#                                  internet a por código en producción.
#   --unstable-kv                  Deno KV sigue siendo API inestable (lo mismo que declara
#                                  `deno.json`; aquí va explícito porque el `CMD` es el contrato).
CMD ["run", \
    "--cached-only", \
    "--unstable-kv", \
    "--allow-net", \
    "--allow-env", \
    "--allow-read=/repo/data,/var/lib/mareia", \
    "--allow-write=/var/lib/mareia", \
    "src/main.ts"]
