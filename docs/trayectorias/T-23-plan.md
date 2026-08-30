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
        "autor": "…", "licencia": "CC BY-SA 4.0", "licenciaUrl": "https://…",
        "identificadaPor": { "fuente": "Wikidata", "entidad": "Q217129", "propiedad": "P18" } } },
     "sinFoto": { "<clave>": { "motivo": "el taxón no tiene P18 en Wikidata" } } }
   ```
   **`sinFoto` es obligatorio y explícito**: una especie ausente del mapa es un hueco mudo, y el
   hueco tiene que llevar motivo. Es la lección de los 10 puertos sin área de T-21.
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
   - **F2 · ninguna foto sin autor y licencia** visibles junto a ella.
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

## Definition of Done
Suite verde con **el comando de CI**, F1-F4 probados en rojo, ROADMAP y CHANGELOG en el PR, pase de
`verificador` y de **`qa-adversario`**, CI en verde. Y la condición de siempre: **el ledger sin
hallazgos que hagan mentir a la página**, no el color de CI.
