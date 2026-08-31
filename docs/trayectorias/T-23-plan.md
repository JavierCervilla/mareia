# T-23 — La ficha de cada especie: retícula fija, huecos rotulados, y una foto que sabe de quién es

**Trayectoria**: `cmtge8zjz0073bo7ys0v3dlyz` · hija de la épica del módulo de especies
(`cmtejril4009ilkc2cc0pvlsg`) · **Proyecto**: Mareia (`cmtc83g5n000pvv7zga2az24g`)

**Qué entrega**: `/pesca/especies/<slug>/` para las **86** especies, enlazada desde el índice que
dejó T-20. **Sin FishBase**: hábitat, profundidad y ritmo de actividad son el bloque «citado» de
**T-22**, no de ésta.

---

## Por qué un pokédex ayuda a la honradez, y con qué condición

Lo dice el design doc de la épica y conviene repetirlo, porque es la regla que gobierna cada
decisión de abajo: **una ficha tiene siempre los mismos campos, así que un campo vacío es visible y
dice «esto no lo sabemos»**. Un párrafo de texto libre esconde el hueco: no se ve lo que no se
escribió. La retícula fija convierte la ignorancia en información publicada.

**Estorba si se le deja hacer lo que hacen los juegos: rellenar y puntuar.** Por eso, y sin
excepciones: **cero barras de 0-100, cero estrellas, cero rareza, cero dificultad, cero puntos,
cero «mejor cebo», cero «temporada ideal», y ninguna ordenación que sugiera «mejores especies».**
La única cifra convencional del sitio sigue siendo el rating solunar, que ya lleva tres párrafos
explicando que es una convención.

---

## Lo que sale de medir las fuentes

### 1. La foto se coge por Wikidata P18, no por búsqueda de texto

Buscar en Commons por nombre científico **funciona** —12 de 12 en mi muestra devuelven algo— y ese
es justo el problema: **devuelve siempre algo**. El primer resultado puede ser un mapa de
distribución, un dibujo del XIX, un sello, o directamente otra especie. Publicar una foto equivocada
bajo un nombre es exactamente lo que este proyecto no hace.

**Wikidata `P18`** es la imagen que alguien ha vinculado *a mano* al taxón. Verificado hoy:
`Dicentrarchus labrax` → `Q217129` → **3 imágenes P18**. La identificación es entonces una decisión
editorial de Wikidata, citable y con dueño, en vez de una conjetura nuestra sobre una cadena de
búsqueda. **Si no hay P18, no hay foto**, y el hueco se rotula.

### 2. No existe «la licencia de las fotos»: son seis en doce ficheros

Muestra medida de 12 especies (8 de rango especie + 4 de género), **12 con imagen**:

| Licencia | Ficheros |
|---|---|
| CC BY-SA 4.0 | 6 |
| Public domain | 2 |
| CC BY-SA 3.0 | 1 |
| **CC BY-SA 3.0 de** (jurisdicción alemana) | 1 |
| CC BY 4.0 | 1 |
| CC BY 3.0 | 1 |

**Es una muestra, no un censo**: mide que la variedad existe, no cuántas hay de cada una en las 86.
La consecuencia de diseño no depende del censo: **licencia, autor y URL se guardan POR FICHERO en el
dataset y se muestran junto a la foto**, nunca en un pie global. Un pie que dijera «fotos de
Wikimedia Commons» sería falso para las seis a la vez.

### 3. Wikimedia limita por IP, y su política exige identificarse

Medido: sin `User-Agent` descriptivo, **HTTP 429** con `retry-after: 16` y `server: envoy` — o sea,
el límite lo pone Wikimedia, no nuestro proxy, y **es de la IP compartida del datacenter**. La
ingesta tiene que ser **educada**: `User-Agent` que diga quiénes somos y cómo contactarnos, respetar
`Retry-After`, concurrencia baja y **caché**, como ya hacen las ingestas del BOE, RAMPE y WoRMS.

### 4. Lo que ya está y no hay que volver a pedir

- **T-20**: `clave`, `nombreBoe`, `nombreComun`, `nombresComunes`, `taxon` completo (AphiaID,
  aceptado, estado, rango, cita, url) y `caladeros` con tallas, notas y presencia.
- **T-19**: el **nombre local canario** en **28 de las 31** especies del Anexo III.
- **T-21**: las áreas protegidas por puerto — el puntero de «dónde aplica régimen especial».

---

## Think Before Coding

### Tres asunciones
1. **Wikidata seguirá exponiendo `P18`** y Commons su `extmetadata` con `LicenseShortName`,
   `Artist` y `LicenseUrl`. Verificado hoy. Si falta cualquiera de los tres, **no se publica la
   foto**: una imagen sin autor o sin licencia no se puede publicar, y el hueco es más honrado.
2. **La identificación no es nuestra.** Se cita a Wikidata como quien la hizo.
3. **El catálogo de T-20 es la única fuente de las 86**; esta trayectoria no añade ni quita especies.

### Dos tradeoffs
- **P18 frente a búsqueda.** P18 da menos cobertura y mejor identificación. **Se acepta la menor
  cobertura**: el hueco rotulado es barato y una foto equivocada es cara, y además el pokédex está
  diseñado para que el hueco se vea.
- **Guardar los metadatos frente a enlazar en vivo.** Guardarlos congela la licencia el día de la
  ingesta y puede quedar vieja si en Commons la cambian; enlazar en vivo mete red en una página
  estática. **Se guardan**, con la fecha de consulta visible, como ya se hace con `verificadoEn` de
  la normativa.

---

## Entregables

1. **Ingesta** `sources/commons.py`: Wikidata `P18` → fichero de Commons → `extmetadata`. Educada
   (UA descriptivo, `Retry-After`, caché). **Aborta la fila, no el proceso**, si falta licencia o
   autor.
2. **Dataset** `data/especies/fotos.json` — **contrato congelado aquí para que los dos carriles no
   diverjan** (la lección de T-20, donde el desajuste eran nueve campos):
   ```jsonc
   { "schema": "fotos/v1",
     "consultadoEn": "2026-08-30",
     "fotos": { "<clave de T-20>": {
        "fichero": "File:…jpg", "url": "https://upload.wikimedia.org/…",
        "descripcion": "https://commons.wikimedia.org/wiki/File:…",
        "autor": "…",                 // sólo si la fuente exige atribuir (ver enmienda 3)
        "atribucionRequerida": true,  // siempre (ver enmienda 3)
        "licencia": "CC BY-SA 4.0", "licenciaCodigo": "cc-by-sa-4.0",
        "licenciaUrl": "https://…",   // sólo si la licencia tiene condiciones (ver enmienda 1)
        "prestadaDe": { "tipo": "una_del_genero", "nombre": "Lophius piscatorius",
                        "nombreBoe": "Lophius piscatorius, L. Budegassa" },  // sólo si la foto no
                                      // es del taxón de la fila (ver enmienda 3)
        "identificadaPor": { "fuente": "Wikidata", "entidad": "Q217129", "propiedad": "P18" } } },
     "sinFoto": { "<clave>": { "motivo": "el taxón no tiene P18 en Wikidata" } } }
   ```
   **`sinFoto` es obligatorio y explícito**: una especie ausente del mapa es un hueco mudo, y el
   hueco tiene que llevar motivo. Es la lección de los 10 puertos sin área de T-21.

   > ### Enmienda 1 (2026-08-31) · `licenciaUrl` deja de ser incondicional
   >
   > **Qué cambia.** El campo `licenciaCodigo` es nuevo y **obligatorio siempre**: es el `License`
   > legible por máquina de Commons (`cc-by-sa-4.0`, `pd`, `cc0`). Y `licenciaUrl` pasa a
   > **condicional**: obligatoria y URL válida cuando la licencia tiene condiciones, y **ausente**
   > —ni `""`, ni `null`, ni presente— cuando no las tiene. `autor` y `licencia` **no se tocan**:
   > siguen siendo obligatorios sin excepción y la promesa de F2 sigue entera.
   >
   > **Por qué, medido.** El contrato congelado exigía `licenciaUrl` en toda foto, y eso es un error
   > de categoría: el dominio público no tiene condiciones de reutilización, así que no hay ninguna
   > URL de condiciones que enlazar. Medido el 2026-08-30 sobre los 26 ficheros que había detrás de
   > los 23 huecos de `fotos.json`: **25 son `License = "pd"`, `LicenseShortName = "Public domain"`,
   > `Copyrighted = "False"` y sin `LicenseUrl`**; el único que no lo es (`File:Monkfish.jpg`,
   > `cc-by-sa-3.0`) tiene otro problema —no acredita autor— y sigue siendo un hueco legítimo.
   >
   > Y lo que lo convierte en defecto y no en preferencia: el motivo que se publicaba en las fichas
   > decía «Una imagen sin autor o sin licencia no se publica» de ficheros que publican **las dos
   > cosas**. **15 fichas publicaban una razón falsa**, que es peor que no dar ninguna: el que la
   > lee no vuelve a preguntar.
   >
   > **Cómo se comprueba, y por qué así.** Una licencia cuenta como sin condiciones **sólo si dos
   > campos independientes de la fuente están de acuerdo**: `License` en un allowlist **cerrado**
   > (hoy `pd` y nada más; `cc0` **no** entra, porque es una renuncia con texto y con URL) **y**
   > `Copyrighted == "False"`. Un campo solo es una afirmación; dos que coinciden es una
   > comprobación. Cualquier otra licencia sin URL sigue cayendo a `sinFoto`.
   >
   > `licenciaCodigo` existe para que la excepción sea **comprobable en el artefacto** y no
   > confiada: sin él, F2 —que lee el JSON publicado, no la ingesta— no puede distinguir «dominio
   > público, no hay condiciones» de «se nos perdió la URL». Y la **ausencia obligatoria** de
   > `licenciaUrl` es a propósito: si esa rama admitiera una URL, sería el único sitio del dataset
   > donde una URL rota no la comprobaría nadie. Lo que la foto de dominio público ofrece **en lugar**
   > de la URL es `descripcion`, la página del fichero en Commons, que ya era obligatoria: el lector
   > siempre llega a la fuente.
   >
   > **Qué recupera, medido al regenerar.** 63 → **78 fotos de 86**, y quedan **8 huecos**, todos por
   > motivos buenos: 4 por identificación no comprobable (`Mugil` ×2, `Sepia`, `Venus`), 1 sin ítem
   > en Wikidata, 1 sin taxón resuelto y 2 porque su única imagen no acredita autor (`gadus-morhua`,
   > `lophius-spp`).
   >
   > **Efecto que hay que decir: 6 de las 63 fotos que ya se publicaban cambian de fichero.** No se
   > tocó la elección de imagen —`P18`, el orden de la fuente, el rango, la comprobación `P225`
   > siguen igual—: en esos 6 taxones la **primera** `P18` que manda Wikidata era de dominio público
   > y el contrato viejo la rechazaba, así que se publicaba la segunda. Al dejar de rechazarla se
   > publica la que la fuente pone primero, que es la regla que el módulo tenía escrita desde el
   > principio. Son `homarus-gammarus`, `octopus-vulgaris`, `pagrus-pagrus`, `salmo-salar`,
   > `sardina-pilchardus` y `scomber-japonicus`.
   > ### Enmienda 3 (2026-08-31) · el ítem se identifica por `P225` exacto, el autor pasa a condicional y nace la foto prestada
   >
   > Tres cambios que van juntos porque los tres salen del mismo encargo —**las 86 especies con
   > foto**— y porque los tres hacen la identificación **más estricta**, no más laxa. Cerrar un
   > hueco publicando una foto de la que no podamos responder sería peor que el hueco.
   >
   > **1 · Al ítem se llega por el nombre que declara, no buscando texto.** Hasta hoy se llegaba con
   > `wbsearchentities` —una búsqueda— y se comprobaba después el `P225` del ítem que saliera. La
   > comprobación cazaba los errores, pero **el que se equivocaba era el buscador**: medido, `Sepia`
   > llevaba a `Q286026` («Sapia»), `Mugil` a `Q234014` («Mugil cephalus») y `Venus` a `Q47652`, que
   > no declara nombre científico. Wikidata sabe responder la pregunta buena —*qué ítem declara
   > exactamente este nombre*— con `list=search` y `haswbstatement:"P225=<nombre>"`, y los tres salen
   > bien a la primera: `Q3478857`, `Q631692`, `Q1408724`. **Las comillas del filtro no son adorno**:
   > sin ellas, un binomio devuelve vacío. La búsqueda de texto se queda **de reserva** para cuando
   > nadie declara el nombre, y la comprobación del `P225` del ítem devuelto **se queda en los dos
   > caminos**: por el primero es casi tautológica, pero el índice puede devolver ruido.
   >
   > Y si el nombre lo declaran **varios** ítems, **no se elige**: la fila cae a `sinFoto` diciendo
   > que hay ambigüedad y cuáles son. Elegir el primero sería la conjetura que este módulo no hace.
   >
   > **2 · `autor` pasa a condicional, con el mismo patrón que `licenciaUrl`.** Puede faltar **sólo**
   > cuando la propia Commons declara `AttributionRequired = "false"` **y** `Copyrighted = "False"`.
   > Medido: `File:Atlantic cod.jpg` y `File:Mugil cephalus.jpg` —los dos de la NOAA, detrás de los
   > huecos del bacalao y de las lisas— lo declaran los dos; `File:Monkfish.jpg` declara
   > `AttributionRequired = "true"` y `Copyrighted = "True"`, y con eso y sin autor **no se publica
   > jamás**: ahí quien lo impide es la licencia, no nosotros. Quien dice que no hace falta atribuir
   > es Commons; nosotros sólo lo publicamos y lo decimos en la ficha («Sin autor acreditado ·
   > Public domain. Wikimedia Commons no registra quién hizo esta foto…»), con el enlace a la página
   > del fichero para quien dude.
   >
   > El campo nuevo **`atribucionRequerida`** es obligatorio en toda foto y **booleano de verdad**
   > (`"false"` es un valor verdadero en JavaScript). Existe por lo mismo que `licenciaCodigo`: para
   > que F2 pueda **comprobar la excepción sobre el JSON publicado** en vez de confiar en ella. Su
   > límite, dicho: el `Copyrighted` que corrobora no viaja al artefacto, así que la mitad
   > corroborante de la regla la aplica la ingesta y lo que el gate comprueba es la condición
   > publicada. Ausente en la fuente se lee como **`true`**: el silencio de un tercero no es un
   > permiso.
   >
   > **3 · Una fila puede publicar la foto de otro taxón, si la elige la norma y lo dice la página.**
   > Dos filas del BOE no pueden ilustrarse con el suyo: `Lophius spp` —género cuya única `P18` es
   > la que la licencia prohíbe publicar— y `Lophius piscatorius, L. Budegassa`, que nombra dos
   > especies en una celda y por eso el catálogo la deja sin taxón. En las dos, la foto sale de una
   > especie **que nombra el propio BOE** y la entrada publica `prestadaDe` con `tipo`, `nombre` y
   > **`nombreBoe`** —la fila donde la norma la nombra—, que es lo que hace comprobable que la
   > elección no es nuestra. La ficha lo **rotula dentro de la figura**, no en una nota al final, y
   > el `alt` nombra el taxón de la foto y no el de la fila. Si un género en esa situación no tuviera
   > ninguna especie nombrada por el BOE, se queda en `sinFoto` con su motivo: ahí sí estaríamos
   > eligiendo nosotros.
   >
   > **Lo que no cambia.** La imagen sigue saliendo de `P18` y **nunca** de una búsqueda de imagen
   > por texto. `licencia` y `licenciaCodigo` siguen sin excepción. Y **la política de desempate
   > entre varias `P18` publicables no se toca**: sigue siendo el orden de la fuente (preferidas
   > primero, descartadas nunca).

3. **Ficha** `/pesca/especies/<slug>/` — retícula **fija**, con estos campos y en este orden:
   nombre del BOE · nombre común · nombre local canario (si lo hay) · taxón aceptado y su estado ·
   rango · **tallas por caladero, cada una con su nota entera** · presencia con su sesgo · áreas
   protegidas donde aplica · foto con **su** licencia y **su** autor. Cada hueco **rotulado con su
   motivo**, nunca en blanco.
4. **Ampliación del `design-brief.md`** (el brief manda ampliarlo, no abrir otro). Carga las skills
   **`frontend-anti-slop`** —que manda en el orden y en el criterio— y **`game-ui-web`** para la
   navegación del catálogo, con su **límite duro: cero *juice* sobre una cifra legal**. Una talla
   mínima no parpadea, no cuenta hacia arriba, no tiene halo.
5. **Gates**, todos sobre el `dist/` y **probados en rojo**:
   - **F1 · la nota viaja con la cifra, también aquí.** Es el hallazgo H-1 de T-20 y el gate de
     T-19: la ficha es una **tercera** superficie para la misma cifra legal, y nace con el gate
     puesto en vez de esperar a que un adversario lo encuentre.
   - **F2 · ninguna foto sin autor y licencia** visibles junto a ella. Desde la enmienda 1, también:
     la licencia se publica **por la rama que le toca** —enlace a su texto cuando tiene condiciones,
     estado dicho cuando no las tiene— y toda figura enlaza la página de su fichero. **Nunca un
     crédito que no lleve a ninguna parte.** Desde la enmienda 3, además: una foto sin autor que
     declare `atribucionRequerida: true` es **rojo**; una sin autor que declare `false` tiene que
     **decir** que su fuente no registra ninguno, no callarlo; y una foto **prestada** tiene que
     publicar su rótulo dentro de la misma figura.
   - **F3 · ningún hueco mudo**: todo campo vacío de la retícula publica su motivo.
   - **F4 · nada de puntuar**: ni barras, ni estrellas, ni rareza, ni dificultad, ni ordenación por
     «mejores». Que el gate mire el artefacto, no la intención.
6. `data/especies/README.md` con la licencia **por fichero** y la atribución a Wikidata; `ROADMAP.md`
   y `CHANGELOG.md`.

## Lo que NO hace
1. **No trae FishBase** (hábitat, profundidad, talla máxima): es T-22.
2. **No publica mapas de distribución.** Con 12 registros de dorada en toda Galicia, un mapa es una
   mentira dibujada.
3. **No inventa ninguna magnitud** ni ordena las especies por nada que se parezca a «mejor».
4. **No mirrorea Commons**: se guardan los metadatos y se enlaza el fichero.
5. **No añade ni quita especies** al catálogo de T-20.

> ### Enmienda 2 (2026-08-31) · la etiqueta del enlace al fichero no lleva su nombre
>
> El crédito de la foto rotulaba su enlace `Ver «File:…» en Wikimedia Commons`, con el nombre del
> fichero entero. Los nombres de Commons son cadenas cualesquiera, y uno de ellos —`File:Brachsenmakrele
> (Brama Brama) 22.12.2008 Strand von Callantsoog Nord Holland.JPG`— metía «22.12» en el texto
> visible de una ficha, donde un lector español lee un decimal con punto inglés y el gate A-19 lee
> una regresión. Las dos lecturas son razonables. La etiqueta pasa a ser `Ver el fichero en Wikimedia
> Commons`: un enlace no necesita nombrar su destino cuando el destino **es** la página donde ese
> nombre está escrito. **El campo `fichero` se queda en el dataset** —es procedencia—; lo que se
> quita es imprimirlo. Y no se esconde en un `title` ni en un `aria-label`: esconderlo para que el
> gate no lo vea sería hacer que el gate mienta.

## Definition of Done
Suite verde con **el comando de CI**, F1-F4 probados en rojo, ROADMAP y CHANGELOG en el PR, pase de
`verificador` y de **`qa-adversario`**, CI en verde. Y la condición de siempre: **el ledger sin
hallazgos que hagan mentir a la página**, no el color de CI.

---

## Enmienda 3 (2026-08-31) — de 78 a 85 de 86, endureciendo la identificación

El humano lo dijo sin rodeos: **«quiero con foto, si no la pokédex no tiene ningún valor»**. Los ocho
huecos que quedaban tras la enmienda 2 no eran, casi ninguno, «no hay foto»: eran **la identificación
fallando**. Se cierran por tres caminos, y los tres hacen la identificación **más** estricta.

**1 · Preguntar por el ítem que declara el nombre, no buscar el nombre como texto.**
`haswbstatement:"P225=<nombre>"` — **las comillas importan**: medido, sin ellas los nombres de dos
palabras devuelven vacío porque el espacio parte el filtro. La búsqueda libre llevaba a `Q234014`
(que declara *Mugil cephalus*, no el género), `Q286026` (que declara «Sapia») y `Q47652` (que no es
un animal). El `wbsearchentities` de siempre se queda **como reserva** para cuando nadie declara el
nombre, y el `P225` del ítem que devuelva se sigue comprobando igual.

**2 · Publicar sin autor sólo cuando la fuente dice que no hace falta.** `AttributionRequired = false`
**y** `Copyrighted = False`, los dos a la vez. Son cuatro ficheros, todos de dominio público de la
NOAA, para los que Commons no registra autor porque la obra es de una agencia. Con
`AttributionRequired = true` y sin autor **no se publica jamás** —`File:Monkfish.jpg` es el caso—:
ahí quien lo impide es la licencia, y no hay excepción que valga. El booleano viaja en el artefacto
(`atribucionRequerida`) por la misma razón que `licenciaCodigo`: **la excepción se comprueba, no se
confía**.

**3 · El género que no puede publicar su imagen curada toma prestada la de una especie que nombra el
propio BOE**, y la ficha lo rotula. La elección la hace la norma, no nosotros.

### La ambigüedad se deshace con la fuente, o no se deshace

Preguntar por `P225` exacto trae a veces **dos** ítems declarando el mismo nombre. El primer diseño
—no elegir nunca— era correcto en el principio y **costaba dos fotos que ya se publicaban**
(`Merluccius merluccius`, `Melanogrammus aeglefinus`). Se deshace por dos caminos, ninguno de ellos
nuestro:

1. **La marca de duplicado de Wikidata** (`P31 = Q17362920`, *Wikimedia duplicated page*). Leer que
   la fuente ya decidió no es decidir. Si el filtro se lo lleva todo, **no ha informado de nada** y
   la lista se devuelve intacta: «no sé cuál» y «no queda ninguno» son dos frases distintas.
2. **La concordancia de los dos caminos**: si el ítem al que llega la búsqueda de texto está entre
   los candidatos, esa coincidencia decide. Los dos caminos fallan de maneras **distintas** —el
   exacto trae de más con ítems repetidos, el de texto trae otra cosa con nombres que se parecen a
   un apellido o a un planeta—, así que coincidir es una comprobación. Es el mismo principio con el
   que la enmienda 2 acepta el dominio público: **una señal sola es una afirmación; dos que coinciden
   son una comprobación.**

Lo que **no** se hace nunca: desempatar por el primero, por el número más bajo, o por cuál tiene
foto. Si ninguno de los dos caminos deshace el empate, la fila cae nombrando los ítems.

### Los sabotajes, y los dos que pasaban por el camino equivocado

Los cuatro recorridos nuevos se probaron en rojo uno por uno. **Dos no mordieron a la primera**, y
por la misma razón: pasaban **por el otro camino**. El recorrido de la marca de duplicado se ponía
verde aunque se quitara el filtro, porque la concordancia lo rescataba; y el de «todos marcados» daba
el mismo desenlace con la lista vacía que con la lista intacta. Los dos se afinaron hasta que cada
uno prueba **su** camino y sólo el suyo. Es una forma más del catálogo: **un recorrido que pasa por
un camino que no es el que dice probar no prueba nada**, y sólo se ve saboteando.

### Lo que queda, dicho

Una especie sin foto: `Panaeux kerathurus` (langostino). No es «no hay imagen»: WoRMS publica el
nombre aceptado como `Penaeus (Melicertus) kerathurus`, con el subgénero entre paréntesis, y el
`P225` de Wikidata no escribe así, de modo que ningún ítem declara esa forma exacta ni la búsqueda de
texto llega. Cerrarlo obligaría al módulo de fotos a caminar la lista de sinónimos de WoRMS —o sea, a
ampliarle la superficie de fuentes—, y eso es una decisión de diseño que no se toma de pasada.
