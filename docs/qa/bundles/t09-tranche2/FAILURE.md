# Failure bundle — pase adversario T-09, tranche 2

> **Qué es esto.** La evidencia sellada del run **en rojo** de los cinco hallazgos A-8…A-12, tomada
> *antes* de poner el trinquete (con `test.fail()`/`hallazgoAbierto()` puesto no nace bundle: el
> fallo era el esperado). Es el equivalente manual del bundle que escribe el fixture `qa-bundle` de
> `qa-staging`: en este repo **todavía no hay runner de Playwright**, así que no hay captura ni DOM
> serializado por el fixture — lo que hay es el HTML construido, que en un sitio SSG **es** el DOM.
>
> Un solo bundle para los cinco hallazgos, con un apartado por hallazgo (mismo sellado, mismo run).

- **snapshotId:** `t09-tranche2` · **Fecha:** 2026-08-28
- **Sujeto:** worktree `/home/user/mareia-t09`, rama `claude/T-09-web-port-page-core`, HEAD `69741eb`
- **Entorno:** local y efímero. Node 22 (`--experimental-strip-types`), Astro build estático,
  Chromium de Playwright **solo para exploración** (no hay dependencia de Playwright en el repo).
  Sin red hacia fuera: ni el diff, ni el DOM, ni el código han salido del contenedor.
- **Reproducción:** `apps/web/src/adversario-t09-tranche2.test.ts`
- **Informe:** `docs/qa/informe-adversario-t09-tranche2.md`

## Cómo se reprodujo

```bash
export PATH="/opt/deno/bin:/opt/node22/bin:$PATH"
BUILD_DATE=2026-08-28 pnpm --filter web build      # 32 páginas
cd apps/web
# el mismo fichero de tests, con `test(...)` en vez de `hallazgoAbierto(...)`:
node --experimental-strip-types --test src/tmp-red-adversario.test.ts
```

```tap
not ok 1 - A-8 · el aviso «de centímetros» solo sale donde la carrera es de centímetros
  error: 'avisos micromareales falsos: Cádiz: aviso «de centímetros» con 2.90 m de carrera'
not ok 2 - A-9 · la fila de la Luna habla de su propia efeméride
  error: 'filas de la Luna que anuncian la efeméride contraria:
           2026-08-05 · fila «Sale» dice: La Luna no se pone: hoy está todo el día sobre el horizonte |
           2026-08-19 · fila «Se pone» dice: La Luna no sale: hoy está todo el día bajo el horizonte'
not ok 3 - A-10 · la Luna no está bajo el horizonte y sobre él a la vez
  error: 'el bloque de la Luna se contradice a sí mismo:
           2026-08-05: «todo el día sobre el horizonte» y la misma página publica su orto/ocaso |
           2026-04-05: «todo el día bajo el horizonte» con paso superior a 23.5° |
           2026-08-19: «todo el día bajo el horizonte» con paso superior a 22.3° |
           2026-04-19: «todo el día sobre el horizonte» y la misma página publica su orto/ocaso'
not ok 4 - A-11 · la nota de calidad no inventa una observación
  error: 'notas de calidad que hablan de una observación inexistente: Cádiz:
           «sin pleamares medibles en la observación» con rmse null y validado contra
           «contraste cruzado entre fuentes (sin observaciones)»'
not ok 5 - A-12 · el sitio construido tiene página de «no encontrado»
  error: 'el sitio construido no trae 404.html: quien llega a una URL que no existe se queda fuera'
1..5
# tests 5 · pass 0 · fail 5
```

---

## A-8 · el aviso micromareal en un puerto de 2,90 m de carrera

`apps/web/dist/mareas/andalucia/cadiz/cadiz/index.html`, texto renderizado en orden de DOM
(`BUILD_DATE=2026-08-28`):

```
En Cádiz la marea astronómica es de centímetros
La carrera de marea de este puerto es tan pequeña que el nivel del agua lo decide sobre todo el
residuo meteorológico: la presión atmosférica y el viento mueven aquí más que la Luna. […]

Mareas de hoy · viernes, 28 de agosto de 2026
  pleamar   04:13   3,20 m
  bajamar   10:09   0,70 m
  pleamar   16:25   3,46 m
  bajamar   22:35   0,56 m
```

Carrera medida sobre `dia.muestras` (la misma serie que dibuja la curva), 12 puertos,
`BUILD_DATE=2026-08-28`:

```
a-coruna                    grade=A carrera=3.23m aviso=false
bilbao                      grade=A carrera=3.56m aviso=false
cabo-de-palos               grade=C carrera=0.17m aviso=true
cadiz                       grade=C carrera=2.90m aviso=true   <-- AVISO CON CARRERA GRANDE
huelva                      grade=B carrera=2.91m aviso=false
la-manga-del-mar-menor      grade=C carrera=0.17m aviso=true
las-palmas-de-gran-canaria  grade=A carrera=2.19m aviso=false
malaga                      grade=B carrera=0.54m aviso=false
palma-de-mallorca           grade=C carrera=0.14m aviso=true
santa-cruz-de-tenerife      grade=A carrera=2.11m aviso=false
santander                   grade=B carrera=3.55m aviso=false
vigo                        grade=B carrera=2.98m aviso=false
```

Los tres puertos micromareales de verdad están entre 0,14 y 0,17 m. Cádiz está **17 veces** por
encima del mayor de ellos, y por encima de Las Palmas y Santa Cruz, que no llevan aviso.

El propio dataset lo dice (`data/stations/es-ca-cadiz.json`):

```json
"metrics": { "predicted_range_m": 3.424, "samples": 0, "observed_extremes": 0,
             "matched_extremes": 0, "extremes_usable": false, "observation_source": null }
```

## A-9 y A-10 · el bloque de la Luna

`BUILD_DATE=2026-04-05`, `dist/mareas/cantabria/cantabria/santander/index.html`, bloque «Luna»:

```
Luna
  Fase            menguante gibosa · 89,5 % iluminada
  Sale            La Luna no sale: hoy está todo el día bajo el horizonte
  Se pone         08:57 · 237° (OSO)
  Paso superior   04:23 · 23,5° de altura
  Distancia       403.005 km
```

`BUILD_DATE=2026-08-05`, mismo bloque, cinco puertos a la vez (Santander, Bilbao, Palma, Cabo de
Palos, La Manga):

```
Luna
  Fase            menguante gibosa · 57,7 % iluminada
  Sale            La Luna no se pone: hoy está todo el día sobre el horizonte
  Se pone         14:36 · 295° (ONO)
  Paso superior   07:10 · 62,4° de altura
```

Barrido de un año natural (`getAstro`, slug `santander`, 2026-01-01 → 2026-12-31): **25 días** con
`outcome: "no-event"`, todos de la Luna, ninguno del Sol. Cadencia ~29 días para el orto y ~29 para
el ocaso, que es exactamente el desfase del día lunar (24 h 50 min), no un fenómeno circumpolar:

```
2026-04-05 moon.rise no-event reason=always-below
2026-04-19 moon.set  no-event reason=always-above
2026-05-04 moon.rise no-event reason=always-below
…
2026-08-05 moon.rise no-event reason=always-above
2026-08-19 moon.set  no-event reason=always-below
…
2026-12-29 moon.rise no-event reason=always-above
dias sin evento: 25
```

Latitudes del catálogo: 27,9° N (Las Palmas) – 43,5° N (Santander). La Luna es circumpolar a partir
de ~61° de latitud (declinación máxima 28,7°), así que en las doce páginas la frase «todo el día
sobre/bajo el horizonte» **no puede ser cierta ningún día del año**.

## A-11 · la nota de calidad

`dist/mareas/andalucia/cadiz/cadiz/index.html`, sección «Calidad y procedencia del dato», tres filas
consecutivas:

```
Error cuadrático medio frente a la observación   no medido
Error de hora de la pleamar (p95)                sin pleamares medibles en la observación
Validado contra                                  contraste cruzado entre fuentes (sin observaciones)
```

Contraste con La Manga, donde la misma frase **sí** es cierta (hay observación, sin pleamares
identificables):

```
Error cuadrático medio frente a la observación   0,043 m
Error de hora de la pleamar (p95)                sin pleamares medibles en la observación
Validado contra                                  IOC carg1
```

## A-12 · sin página de «no encontrado»

```
$ ls apps/web/dist
_astro  index.html  mareas  sitemap.xml
$ find apps/web/dist -name '*.html' | wc -l
32
$ ls apps/web/dist/404.html
ls: cannot access 'apps/web/dist/404.html': No such file or directory
```
