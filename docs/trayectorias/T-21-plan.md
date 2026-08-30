# T-21 — Las áreas marinas protegidas que tienes al lado, y ninguna geometría en el móvil

**Trayectoria**: `cmtfqmd4c001vbo7y9y408gu0` · hija de la épica del módulo de especies
(`cmtejril4009ilkc2cc0pvlsg`) · **Proyecto**: Mareia (`cmtc83g5n000pvv7zga2az24g`)

**Por qué existe, y por qué esta parte del encargo sí se hace.** El humano pidió «zonas de pesca y
zonas prohibidas». Las de pesca **no se hacen**: no existe fuente y publicar dónde *sí* se puede
pescar es inventar. Las protegidas sí, y la razón es una **asimetría moral**: publicar dónde **no**
se puede es defendible —hay fuente oficial y el error cae del lado conservador— mientras que su
contrario daña. Esta trayectoria hace exactamente la mitad defendible.

**Entrega**: en la página de un puerto, las áreas marinas protegidas a menos de 30 km, con su tipo,
su nombre oficial y la distancia. **Ninguna geometría cruza a `dist/`.**

---

## Lo que cambió al medir la fuente, antes de escribir una línea

El design doc de la épica había descargado RAMPE y sus cifras **reproducen exactas**: 12,0 MB
comprimidos → 54,8 MB de GeoJSON, **86 features**, **1.076.504 vértices**, y el reparto por tipo
—42 ZEPA, 32 ZEC, 10 RESERVA MARINA, 1 ZEC/AMP, 1 AMP—. Nada que corregir ahí.

Pero hay **dos cosas que no dice y que deciden el trabajo entero**.

### 1. Esto no es GeoJSON estándar: las coordenadas están en metros

Los dos ficheros declaran un CRS **proyectado**, no WGS84:

| Fichero | CRS declarado | Qué es | Primera coordenada medida |
|---|---|---|---|
| `Rampe_p.geojson` | `EPSG:25830` | ETRS89 / **UTM 30N** | `[710636.30, 4170823.77]` |
| `Rampe_c.geojson` | `EPSG:32628` | WGS84 / **UTM 28N** | `[193847.21, 3074113.50]` |

El RFC 7946 dice que un GeoJSON es longitud/latitud en WGS84 y **no admite otro CRS**. Estos traen
uno, así que **cualquier librería que los lea como GeoJSON estándar tratará metros como grados**, en
silencio y sin error. Un puerto y un área a 700 km de distancia aparente pasarían por vecinos.

### 2. `Rampe_c` no es «continental-costera»: es **Canarias**

El design doc glosa el reparto como «48 poligonales + 38 continentales-costeras». Los 38 de
`Rampe_c` son **canarios** —«Espacio marino de la zona occidental de El Hierro», «de los Roques de
Salmor», «del norte de La Palma», «de La Gomera-Teno»— y su CRS es UTM **28N**, que es precisamente
la zona de Canarias. La `_p` es peninsular y la `_c`, canaria.

**Por qué importa y no es una pedantería**: si se toma esa glosa por buena y se reproyecta todo con
la zona 30, cada área canaria acaba a cientos de kilómetros de donde está. Es el mismo error que en
T-19 me costó una corrección pública: una glosa plausible que el dato desmiente.

### 3. Y la consecuencia buena: no hace falta ninguna dependencia nueva

`requirements.txt` declara una política —«todo lo demás sale de la biblioteca estándar a propósito:
menos superficie que fijar y menos que pueda romperse dentro de un año»— y el pipeline no tiene
`pyproj`, `shapely` ni `geopandas`. Traerlos por dos inversiones de UTM sería caro.

**Medido: no hace falta.** La inversa de la transversa de Mercator (series de Krüger) son unas
sesenta líneas de `math`, y validada contra las dos zonas cae donde debe:

| Sitio | Reproyectado | Dónde está de verdad |
|---|---|---|
| Reserva marina de Cabo de Palos e Islas Hormigas | `−0,612 · 37,660` | Cabo de Palos, Murcia |
| Espacio marino de la zona occidental de El Hierro | `−18,106 · 27,757` | El Hierro, Canarias |

### 4. El tamaño real del entregable, medido

Cruzando las 86 áreas reproyectadas contra los 153 puertos, con **distancia al borde** del área
(punto a segmento sobre cada arista; ver la corrección de más abajo):

| | |
|---|---|
| Puertos con al menos un área a ≤ 30 km | **143 de 153** |
| Relaciones puerto–área publicables | **348** |
| Puertos **sin ninguna** | **10** |
| Reparto | 53 puertos con 1 área · 32 con 2 · 21 con 3 · 22 con 4 · 10 con 5 · 5 con 6 |

Los **10 sin ninguna** no son un hueco: son un dato, y se publican diciéndolo. Una sección que
desaparece se lee como «no hay nada que saber»; una que dice «ninguna a menos de 30 km» dice lo que
sabemos y hasta dónde miramos.

---

## Think Before Coding

### Tres asunciones

1. **RAMPE seguirá declarando su CRS en el fichero.** Hoy lo hace, en `crs.properties.name`. El
   parser **lo lee y no lo supone**: si falta, o si trae una zona que no conocemos, **aborta**. Una
   reproyección con la zona equivocada no falla, acierta a producir basura, que es peor.
2. ~~**La distancia al vértice más cercano basta para «tienes esto al lado».**~~ **Falsa, medida y
   retirada** — ver «La asunción 2 era falsa» al final. Se mide al borde, punto a segmento.
3. **El nombre oficial y el tipo son estables.** Se crean por norma; RAMPE los versiona por año.

### Dos tradeoffs

- ~~**Vértice más cercano frente a borde del polígono.**~~ **El tradeoff estaba mal planteado y el
  plan se equivocó dos veces**: dijo que el error de la cota «cae del lado de avisar de menos, no de
  dar por lejos algo que tienes encima», que es la misma cosa dicha dos veces —avisar de menos **es**
  dar por lejos algo que tienes cerca—, y dijo que el puerto dentro de un área grande era el único
  caso peligroso, que es falso. Se mide al **borde**. Ver el apartado final.
- **Reproyectar nosotros frente a traer `pyproj`.** Nuestra inversa es código que hay que mantener y
  probar; `pyproj` es una dependencia nativa pesada con datos de PROJ. **Se elige la nuestra**,
  contra la política de menos código propio pero a favor de la política declarada de menos
  dependencias, y **con un gate que la ata a puntos de referencia conocidos**.

---

## Entregables

1. **Ingesta** `data/pipeline/mareia_pipeline/sources/rampe.py`: descarga el ZIP, **lee el CRS de
   cada fichero**, reproyecta con la zona que el fichero declara, y aborta si no la reconoce.
2. **Reproyección** `data/pipeline/mareia_pipeline/utm.py`: inversa de Krüger, solo `math`.
3. **Derivado** `data/geo/areas-protegidas.json`: por puerto, las áreas a ≤ 30 km con nombre, tipo,
   `SITE_CODE`, distancia aproximada y si el puerto cae dentro. **Ni un vértice.**
4. **Módulo `protected-areas`**, `order: 12` — **por encima del dato**, porque es una advertencia y
   no una consulta. `offline: cache-first`: nombres y distancias de un puerto favorito son ~1 kB.
5. **Gates**:
   - **P1 · reproyección atada**: puntos de referencia conocidos con su lat/lon; si la inversa se
     desvía más de una tolerancia declarada, rojo.
   - **P2 · la geometría no cruza**: ningún vértice, ningún `coordinates`, ningún polígono en
     `dist/`. Medido sobre el artefacto, con tope de bytes de la sección.
   - **P3 · los 10 sin área lo dicen**: las 10 páginas publican la frase, no una sección vacía.
   - **P4 · CRS leído, no supuesto**: un fichero con CRS desconocido aborta la ingesta en rojo.
   - **P5 · la métrica** (añadido tras el rechazo del verificador): la distancia al borde y la vieja
     cota por vértice se comparan en cada ingesta, y la ingesta aborta si la divergencia pasa del
     umbral declarado o si alguna relación **desaparece** al medir el borde, que es imposible.
6. **Licencia**: `data/geo/README.md` + `attributions` del módulo con **«MITECO · RAMPE 2025 —
   condiciones de uso no declaradas en origen»**. Verificado hoy por mí: la página de descarga **no
   declara licencia ni condiciones de uso**. Consecuencia práctica, y es la que manda: publicamos
   **hechos derivados** (nombre oficial, tipo, distancia), **no las geometrías**, que es justo lo que
   una licencia no declarada no nos deja redistribuir.

## Lo que NO hace

1. **No publica zonas de pesca.** No hay fuente. Es la parte del encargo que más se parece a slop.
2. **No publica el régimen de cada reserva** (qué se puede y qué no): eso vive en fichas del MAPA sin
   estructurar. Puntero, no dato.
3. **No manda geometría al cliente**, ni simplificada. Un mapa es T-23 como pronto, y con su fuente.
4. **No dice «puedes pescar aquí»** en ningún caso, ni por omisión: la ausencia de área protegida
   cerca **no** es permiso.

## La asunción 2 era falsa: la cota por vértice perdía seis avisos

Escrito **después** del rechazo del verificador, y aquí y no en un hilo porque el plan afirmaba lo
contrario en tres sitios.

El plan dijo que la distancia al vértice más cercano bastaba, que su error «cae del lado de avisar
de menos» —presentado como el lado bueno— y que el único caso peligroso era un puerto **dentro** de
un área muy grande. Lo primero es cierto y no es una defensa: en una sección cuya única razón de ser
es avisar, **avisar de menos es el fallo**, no la salvaguarda. Lo tercero es directamente falso.

Medido sobre RAMPE 2025 contra los 153 puertos, con el puerto **fuera** del polígono:

| Puerto | Área | Al borde | Al vértice |
|---|---|---|---|
| `pollenca` | Corredor de Migración de Cetáceos del Mediterráneo (AMP) | 27,6 km | **69,8 km** |
| `altea` | Plataforma-talud marinos del Cabo de la Nao (ZEPA) | 28,5 km | 31,0 km |
| `alajero` | Franja marina Teno - Rasca (ZEC) | 27,7 km | 34,1 km |
| `sant-antoni-de-portmany` | Corredor de Cetáceos (AMP) | 25,6 km | 30,2 km |
| `oliva` | Cabo de la Nao (ZEPA) | 24,4 km | 31,8 km |
| `soller` | Corredor de Cetáceos (AMP) | 22,7 km | 36,8 km |

Seis relaciones reales que no se publicaban, y **tres de las seis son la única AMP del catálogo**:
el Corredor de Cetáceos salía en tres puertos y desaparecía en otros tres. La causa no es el método
sino la fuente: RAMPE no tiene vértices densos —mediana de arista **2,01 m**, pero **728 aristas de
más de 1 km**, 286 de más de 5 y una de **159,6 km**, justo en el Corredor—, y el error de la cota
es del orden de media arista.

**El arreglo**: distancia punto a segmento sobre cada arista, en `geo.distancia_a_segmento_km`, con
`math` y sin `pyproj` ni `shapely` —la arista se toma como arco de círculo máximo, que es el mismo
modelo esférico que `haversine_km` ya usaba en todo el pipeline, y el error de esa elección frente a
tomarla como recta en el plano UTM de origen está medido: **≤ 2 m** entre las relaciones que se
publican—. Y **el gate P5**, para que el día que la fuente cambie de densidad se vea en vez de
quedar en una relación menos.

**Y una segunda de la misma familia, en el gate P1**: la capa de «escala» se anunciaba como la que
validaba `k0 = 0,9996` y **no podía fallar**, porque `k0` entraba por los dos lados de la
comparación y se cancelaba. Medido con `K0 = 1`: las cuatro capas del gate, en verde. La quinta capa
es un punto UTM que publica un tercero con sus dos coordenadas a la vez (Snyder, USGS PP 1395,
1987), y ésa sí se pone roja.

## Definition of Done

Suite entera verde, los gates P1–P5 **probados en rojo** además de en verde, `ROADMAP.md` y
`CHANGELOG.md` en el mismo PR, pase de `verificador`, de `qa` y de **`qa-adversario`** con sus
trinquetes, y CI en verde. Y la condición que T-19 dejó escrita con sangre: **el ledger sin hallazgos
abiertos, no el color de CI.**
