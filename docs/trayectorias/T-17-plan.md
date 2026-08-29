# T-17 — deploy-web-estatica (adelanto de T-15)

**Por qué existe**: el dominio `mareia.cervilla.es` ya está enganchado en Dokploy a las dos apps,
pero **no hay Dockerfiles**, así que los dos servicios están en `error` y Traefik devuelve **502**.
Enganchar un hostname a un servicio que no puede arrancar convierte una URL «que aún no existe» en
una URL «rota», y eso no es lo mismo para quien la visita. Esta trayectoria pone en pie **la web
estática**, que es lo que ya está terminado (33 páginas SSG de T-09).

**Alcance deliberadamente estrecho**: solo la web. El API, el volumen KV, el rebuild diario, el e2e
contra producción y el pase adversario de despliegue **siguen en T-15**.

## Entregables

1. **`apps/web/Dockerfile`** multi-etapa: build con Node 22 + pnpm sobre el monorepo (el sitio se
   calcula en build con los casos de uso, así que necesita los `packages/`), y una etapa final que
   sirve `dist/` como estático. Imagen final **sin toolchain de build** y sin `node_modules`.
   - El servidor estático debe escuchar en **0.0.0.0** y en el **puerto 3000** (es el que declara el
     dominio en Dokploy). Ojo con la lección del framework: un servidor que bindea al hostname del
     contenedor da 502 con Traefik aunque el contenedor esté `running`.
   - **`BUILD_DATE`**: la página publica el día que se construyó. Que sea un `ARG`/`ENV` con el día
     UTC del build por defecto, para que el rebuild diario de T-15 lo pueda fijar sin tocar la
     imagen.
   - Rutas SSG: el sitio son directorios con `index.html`. La configuración del servidor tiene que
     resolver `/mareas/galicia/pontevedra/vigo/` **y** servir `404.html` en los no encontrados.
2. **`.dockerignore`** en la raíz para que el contexto no arrastre `node_modules`, `dist/`,
   `qa-shots/` ni el `.git`.
3. **Prueba local antes de desplegar** (esto es el entregable de verdad, no el Dockerfile):
   construir la imagen, levantarla, y comprobar con `curl` que responden la portada, una página de
   puerto, el `sitemap.xml` y que una URL inventada da **404 con el `404.html`**, no un 200 vacío.
   Deja el comando y su salida en el PR.
4. **Documentar en `docs/despliegue.md`** cómo se despliega y qué queda pendiente de T-15.

## No-objetivos
El API (`/v1`), el volumen KV, el rebuild diario programado, HTTPS/Traefik (lo pone Dokploy), el
pase adversario de despliegue y el e2e contra producción. Todo eso es T-15.

## DoD extra (doctrina T-161)
Entrada en `CHANGELOG.md` y una línea bajo T-15 en `ROADMAP.md` diciendo qué parte queda hecha aquí.
Sin `[skip-traj]`. **No toca UI** (ni un `.astro`, ni CSS): no requiere pase adversario.
