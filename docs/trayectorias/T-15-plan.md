# T-15 — el API en producción, y el sitio que no envejece solo

**Por qué existe**: `mareia.cervilla.es` sirve las 192 páginas desde T-17, pero **`/v1` devuelve 502**
porque `mareia-api` no tiene Dockerfile. Enganchar un hostname a un servicio que no puede arrancar
convierte una URL «que aún no existe» en una URL **rota**, y no es lo mismo para quien la visita.

Y hay una segunda cosa que esta trayectoria tiene que dejar en pie, porque **otra trayectoria ya
depende de ella**: el **rebuild diario**. La web es SSG y se construye una vez; el módulo de especies
(T-19) va a publicar normativa **fechada** que degrada cuando envejece, y esa degradación **no puede
funcionar sin un rebuild**. Publicar vedas sobre un sitio que no se reconstruye es exactamente el
dato caducado con pinta de fresco que el proyecto existe para no publicar.

## Entregables

1. **`apps/api/Dockerfile`**. Deno con `--unstable-kv`, permisos acotados como en `deno.json`
   (`--allow-net --allow-env --allow-read` solo al dataset), y el dataset dentro de la imagen.
   - **Escuchar en `0.0.0.0`**: la lección del framework es un 502 con el contenedor `running` y el
     log diciendo `Ready` porque el proceso bindeaba al hostname del contenedor. `main.ts` usa
     `listen(port)`; **verifícalo contra el contenedor real**, no contra la documentación.
   - `dockerContextPath` = `"."` (el `COPY` falla sobre ficheros que sí existen si Dokploy usa el
     directorio del Dockerfile; ya documentado en la skill).
2. **Volumen para Deno KV**. `apps/api/src/weather-kv.ts` abre `Deno.openKv()` sin ruta: en un
   contenedor eso es un almacén **efímero**, así que la caché del boletín se pierde en cada
   despliegue y cada arranque vuelve a pegarle a AEMET. Ruta explícita por variable de entorno +
   volumen en Dokploy. **Mide** cuánto ocupa tras un ciclo, no lo supongas.
3. **El healthcheck fuera del enrutado público**. Hoy `/health` es alcanzable; el dominio debe
   publicar **solo `/v1/*`**. El healthcheck sigue existiendo para Dokploy, por la red interna.
4. **Rebuild diario de la web** con `BUILD_DATE` del día, que ya es `ARG` en el Dockerfile de T-17.
   Que quede escrito **de qué depende**: sin esto, la normativa fechada de T-19 no puede degradar.
5. **`actionlint` sobre los workflows y `shellcheck -S error` sobre los `.sh`**, en CI. Deuda
   declarada desde T-17.
6. **e2e contra producción**: un recorrido que compruebe que `/v1/ports` responde, que `/health`
   **no** es alcanzable desde fuera, y que la portada sigue sirviéndose.
7. **`corepack` hermético** (deuda de T-17).

## Lo que NO hace

- **No cambia ni un endpoint del API.** Esto es despliegue: si algo del contrato hay que tocarlo, es
  otra trayectoria.
- **No toca el dataset.**

## Asunciones

1. El `mareia-api` de Dokploy (`elEvKwzMC6k_wrvN6dAOq`) ya existe con su dominio enganchado; lo que
   falta es que la imagen arranque. **Compruébalo antes de tocar nada**: si el dominio no está o
   apunta a otro sitio, el plan cambia.
2. La caché KV es **prescindible**: si el volumen se pierde, el API degrada a pedirle a AEMET, no se
   rompe. (Si no fuera cierto, el volumen pasaría de comodidad a requisito y habría que decirlo.)
3. `AEMET_API_KEY` está en el entorno de Dokploy (el humano lo confirmó) y **no** se commitea.
4. **`application.update` es PARCIAL**, no un reemplazo: mandar `{applicationId, buildArgs}` cambia
   ese campo y deja los demás en paz. **No está probado contra el panel real** — y es la asunción de
   esta trayectoria con peor consecuencia, porque si fuera un reemplazo la aplicación **viva**
   perdería su dominio, sus variables de entorno (`AEMET_API_KEY`) y su `dockerContextPath`, que es
   justo el campo sin el cual el build falla.
   Y no basta con declararla, porque la comprobación obvia **no la ve**: releer `buildArgs` después
   de escribirlo confirma lo que acabamos de mandar, que es el peor sitio donde mirar. Así que el
   workflow **guarda la ficha entera antes** y compara después `domains`, `env`,
   `dockerContextPath`, `dockerfile`, `buildType`, `branch`, `repository`, `sourceType` y
   `applicationStatus`: si alguno cambió, el job se pone rojo **antes de desplegar** y con la ficha
   previa a mano para restaurar. Lo que la cerraría del todo es una corrida real contra el panel;
   hasta entonces, queda comprobada en cada ejecución en vez de supuesta.

## Tradeoffs

- **Dataset dentro de la imagen vs. volumen compartido**: dentro hace la imagen reproducible y el
  despliegue atómico —la imagen es el dataset—, a costa de que actualizar datos exija reconstruir.
  Es lo coherente con el rebuild diario.
- **Publicar solo `/v1/*` vs. publicar todo**: acotar el enrutado deja el healthcheck y cualquier
  ruta futura fuera del alcance de internet por defecto. Coste: una ruta nueva pública hay que
  declararla a propósito, y alguien lo olvidará. Es el olvido barato de los dos.

## Verificación

- **Localmente**: construir la imagen, levantarla, y comprobar con `curl` que `/v1/ports` responde
  200 con los 153 puertos y su calidad, que `/health` responde por dentro, y que el proceso escucha
  en `0.0.0.0` (`ss`/`netstat` dentro del contenedor, no el log).
- **Suite completa** + `actionlint` + `shellcheck` + hadolint sobre el Dockerfile nuevo.
- **En producción**, después del despliegue: los tres del punto 6, contra el dominio real.
