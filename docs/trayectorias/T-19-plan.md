# T-19 — Tallas mínimas por caladero, dichas como las dice la norma

**Trayectoria**: `cmtf7d1kl003rez0czwb055iq` · hija de la épica del módulo de especies
(`cmtejril4009ilkc2cc0pvlsg`) · **Proyecto**: Mareia (`cmtc83g5n000pvv7zga2az24g`)

**Por qué existe**: es el corte más pequeño de la épica de pesca que ya da valor y se suelta solo.
Una fuente (RD 560/1995, texto consolidado del BOE), tres anexos, cero geometría, cero fotos, cero
pokédex. En la página de cualquier puerto: «Tallas mínimas del caladero *X*», con la fecha del texto
consolidado, la fecha de nuestra última verificación y el enlace ELI.

Y trae de serie la maquinaria que el resto de la épica reutiliza: el nivel de dato con señal de
cambio, los gates de vigencia, el mapeo puerto→caladero y la ampliación del ADR-01.

---

## Lo que cambió al medir la fuente, antes de escribir una línea

El design doc de la épica dio por hecho que un **bloque** del BOE consolidado es **una tabla**. No lo
es, y esa suposición, llevada a código, publica cifras derogadas. Medido hoy contra
`BOE-A-1995-8639`:

### 1. Cada bloque de anexo trae TRES versiones históricas apiladas

```
ani   → vigencia 19950409 (54 filas) · 20230721 (54) · 20251102 (55)
anii  → vigencia 19950409 (39 filas) · 20060120 (36) · 20251102 (37)
aniii → vigencia 19950409 (29 filas) · 20151130 (31) · 20251102 (32)
```

El texto consolidado **conserva la redacción de cada versión** dentro del mismo bloque, cada una
envuelta en `<version id_norma fecha_publicacion fecha_vigencia>`. Solo la última está en vigor.

**Qué publicaría un parser que lea todos los `<tr>` del bloque**, comparando la primera versión con
la vigente en el caladero canario:

| Especie | 1995 (derogada) | Vigente 2025 | Dirección del error |
|---|---|---|---|
| Aligote (*Pagellus acarne*) | 12 | **20** | **te multan** |
| Cabrilla (*Serranus cabrilla*) | 15 | **19** | **te multan** |
| Cachucho (*Dentex macrophtalmus*) | 18 | **22** | **te multan** |
| Chopa (*Spondyliosoma cantharus*) | 19 | **23** | **te multan** |
| Serrano imperial (*Serranus atricauda*) | 15 | **20** | **te multan** |
| Pargo (*Pagrus pagrus*) | 33 | 28 | conservador |

**Cinco de seis errores caen del lado que le cuesta una sanción al usuario.** Esta es la razón de ser
del gate G3 y del primer requisito del parser: **seleccionar la versión en vigor por
`fecha_vigencia`, no leer el bloque**.

### 2. La columna «Talla (en cm)» no contiene solo tallas en cm

Censo sobre las tres versiones **en vigor**, contado sobre el dataset construido (53 del Anexo I +
34 del II + 31 del III = **118 tallas publicadas**):

| Clase | Ejemplos medidos | Cuántas |
|---|---|---|
| Longitud en cm, entera | `36` (lubina), `20` (aligote) | 97 |
| **Longitud en cm, decimal** | `3,7` (colas de cigala), `2,5` (almeja, chirla), `8,5` (cefalotórax de bogavante) | 4 |
| **Peso, no longitud** | `6,4 kg` (atún rojo), `3,2 kg` (patudo, rabil), `1 kg` (pulpo) | 9 |
| **«Talla por determinar»** | `(*)` en anguila, buey, calamar, faneca, jibias, rape | 6 |
| **Disyunción longitud-o-peso** | `80 cm o 10 kg de peso` (atún rojo, Anexo II) | 1 |
| **Ilegible en origen** | `1 1` en la boga del Anexo I | 1 |

**17 de las 118 no son una longitud en cm** (9 + 6 + 1 + 1); con las cuatro decimales, **21 no son
un entero de centímetros**. Y tres tallas más llevan una cifra que una nota excepciona (`12 (**)`,
`36 (***)`, `120 (*)`) — ver §3.

Aparte, dos especies del Anexo I y II vienen **partidas en varias filas**: la fila cabecera
(`Cigala (entera) …:`, `Bogavante …:`) no lleva cifra y la llevan sus filas hijas. No se publican
como especie sin talla: van como filas hijas rotuladas con su medida.

`talla: number` es, por tanto, un tipo **falso**. Se modela como unión discriminada y **cada celda
conserva su texto literal**.

Sobre `1 1`: el BOE dice `1 1` donde casi con seguridad quiso decir `11`. **No se arregla.** Corregir
una cifra legal por inferencia es exactamente lo que este proyecto no hace. Se publica como
`sin_dato_legible` con el literal a la vista y el enlace al texto auténtico.

### 3. Las notas no son adorno tipográfico: cambian el número para nuestros puertos

Leídas las notas de las versiones en vigor:

- **`(*)` del Anexo I = «Talla por determinar».** Seis especies no tienen talla mínima fijada. Eso es
  un dato, y se publica diciendo *por qué* falta —lo dice la norma— en vez de omitir la fila.
- **`(***)` del Anexo I**: la lubina son 36 cm **«excepto en las divisiones 8a y 8b del CIEM … en las
  que la talla mínima es de 44 centímetros»**. Las divisiones 8a/8b son el golfo de Vizcaya: es decir,
  **los puertos cantábricos de este portal**. Publicar «36» a secas en Bilbao o Santander se equivoca
  en 8 cm, otra vez del lado que multa.
- **`(**)` del Anexo I**: el boquerón son 12 cm salvo en la división IX a) —el golfo de Cádiz y el
  Atlántico ibérico—, donde son 10.
- **`(*)` del Anexo II**: la talla del pulpo **no se aplica en aguas interiores de Illes Balears**.
  Tenemos 17 puertos baleares.

**Decisión de alcance, y es la que mantiene T-19 pequeña**: resolver la nota por puerto exige saber
en qué división CIEM cae cada puerto, y eso es geometría — justo lo que esta trayectoria no hace.
Así que **la nota viaja pegada a la cifra y se renderiza junto a ella, siempre**. Nunca se muestra un
número al que le aplica una nota sin la nota. Resolverla por puerto queda anotado como trabajo
futuro con nombre propio, no como deuda anónima.

---

## Think Before Coding

### Tres asunciones

1. **El BOE seguirá envolviendo cada redacción en `<version fecha_vigencia>`.** Verificado hoy en los
   tres bloques. Si desapareciera, el parser **no adivina**: falla en rojo y la sección degrada, que
   es la misma política que ya rige `estimado` y el sello de antigüedad de la meteo.
2. **`fecha_actualizacion` del bloque (`20251101`) es señal de cambio suficiente** para el gate
   diario. No requiere descargar ni diferenciar el texto para saber que hay que mirar.
3. **El caladero de un puerto es estable** y se cura una vez. No es un dato que envejezca en horas:
   cambia si cambia la norma, y de eso ya avisa el gate G2.

### Dos tradeoffs

- **Publicar el literal frente a normalizar.** Normalizar todo a un número da una tabla bonita y
  miente en 21 de las 118. Se paga: la UI tiene que saber pintar cinco formas distintas de talla, y
  el tipo es una unión, no un `number`. **Se acepta el coste**: es el mismo criterio con el que
  `rmse_m` se publica como cota superior en vez de como «precisión».
- **Nota adjunta frente a nota resuelta.** Adjuntar la nota deja al lector una excepción que
  resolver; resolverla exige geometría y trae un error nuevo (asignar mal una división CIEM da un
  número seguro y falso). **Se acepta**: una excepción visible es honrada; un número seguro y
  equivocado no.

---

## Entregables

### 1. Ingesta — `data/pipeline/mareia_pipeline/sources/boe.py`

- Descarga `metadatos`, `texto/indice` y los bloques `ani`/`anii`/`aniii` (`Accept: application/xml`;
  con `application/json` el BOE responde 400).
- **Selecciona la versión en vigor**: la de mayor `fecha_vigencia` que no sea futura. Si el bloque no
  trae ninguna `<version>`, **aborta**; no cae hacia atrás a «leer el bloque entero».
- Comprueba en `metadatos` que `estatus_derogacion = N` y `vigencia_agotada = N`. Si no, aborta.
- Clasifica cada celda de talla en la unión discriminada, conservando **siempre** `textoOriginal`.
- Extrae las notas de la versión en vigor y las liga a las especies que las referencian.

### 2. Dataset — `data/normativa/tallas-minimas.json` (`schema: "normativa/v1"`)

```jsonc
{
  "schema": "normativa/v1",
  "fuente": {
    "norma": "Real Decreto 560/1995, de 7 de abril",
    "identificador": "BOE-A-1995-8639",
    "eli": "https://www.boe.es/eli/es/rd/1995/04/07/560",
    "licencia": "Reutilización de la legislación (art. 13 Ley 37/2007 / RD 1495/2011)",
    "aviso": "Solo el texto publicado en el BOE tiene carácter auténtico.",
    "verificadoEn": "2026-08-30"          // lo escribe el gate G2, no la mano
  },
  "caladeros": [{
    "id": "cantabrico-noroeste-y-golfo-de-cadiz",
    "anexo": "ANEXO I",
    "bloque": "ani",
    "fechaVigencia": "2025-11-02",
    "normaModificadora": "BOE-A-2025-22024",
    "notas": [{ "marca": "(***)", "texto": "Excepto en las divisiones 8a y 8b …" }],
    "especies": [{
      "nombreComun": "Lubina",
      "nombreCientifico": "Dicentrarchus labrax",
      "talla": { "tipo": "longitud_cm", "cm": 36 },
      "textoOriginal": "36 (***)",
      "notas": ["(***)"]
    }]
  }]
}
```

`talla` es una unión cerrada: `longitud_cm` · `peso_kg` · `longitud_o_peso` · `por_determinar` ·
`sin_dato_legible`. Sin `default`, sin `any`, sin `null` mudo — cada ausencia dice su motivo, que es
la doctrina de `grade` aplicada a otro dominio.

### 3. `data/geo/ports.json` — campo `caladero`, curado puerto a puerto

Los 153 puertos. Por provincia salen todos menos el Estrecho, que se cura y **se documenta**:

| Puerto | lon | Caladero | Por qué |
|---|---|---|---|
| Barbate, Conil, Chiclana, Cádiz, Rota, Chipiona, Sanlúcar | −5,93 … −6,43 | golfo de Cádiz | al oeste de Punta Marroquí |
| **Tarifa** | −5,606 | golfo de Cádiz | está **sobre** el límite; se resuelve al Atlántico y se dice que es el caso frontera |
| Algeciras, La Línea, San Roque | −5,44 … −5,27 | mediterráneo | al este de Punta Marroquí |
| Ceuta, Melilla | | mediterráneo | |
| Sevilla | −5,99, 80 km río arriba | golfo de Cádiz | puerto fluvial del Guadalquivir, tramo mareal |

### 4. Módulo `regulations`

`ModuleId` pasa a `"fishing" | "weather" | "navigation" | "regulations"`. Ampliar la unión cerrada es
una decisión consciente, que es para lo que está cerrada (§7.3.8 del design doc: **no** se mete en
`fishing` «para no tocar el contrato»).

- `pageSections`: una, `static` — es dato de build, no envejece en horas.
- `attributions`: BOE, con su licencia real y el aviso de autenticidad.
- `offline`: `cache-first`. **Se muestra sin red, con aviso duro** de que la vigencia no se ha podido
  comprobar y puede estar derogada — decisión del humano, frente a la recomendación del arquitecto de
  ocultarla.

### 5. Los tres gates

| Gate | Qué mide | Cuándo falla |
|---|---|---|
| **G1 · procedencia** | Toda cifra publicada traza a `(bloque, fechaVigencia, eli)`. Obliga a **declarar** la procedencia, no solo prohíbe su ausencia: una celda sin origen no compila. | Falta cualquiera de los tres |
| **G2 · vigencia** | Job diario, antes del rebuild: re-consulta el BOE y compara `fecha_actualizacion` del bloque, `estatus_derogacion` y `vigencia_agotada`. Si cuadra, **escribe `verificadoEn`**. | La fuente cambió o está derogada → CI rojo + acción crítica. **No se pudo consultar** (red) → amarillo, `verificadoEn` **no se toca** y la página degrada sola. Esa distinción es la que evita que una caída del BOE rompa el deploy |
| **G3 · versión en vigor** | Trinquete sobre el hallazgo de arriba: fija las **seis** especies canarias a su valor de 2025 y **falla si el dataset trae el de 1995**. Mide el **artefacto publicado**, no la función del parser | Cualquier cifra derogada llega al dataset |

G3 se escribe contra el JSON construido, no contra `boe.py`. Un trinquete que mide una copia del
instrumento deja de morder en cuanto el instrumento cambia — lección pagada en T-13.

### 6. Documentación

- `docs/adr/ADR-03-cifra-legal-en-pagina-estatica.md` — hermano del ADR-01, para el dato que no
  caduca en horas pero **sí se deroga**, y cuyo error tiene coste jurídico.
- `data/normativa/README.md` con licencia y aviso de autenticidad, siguiendo `data/stations/README.md`.
- `ROADMAP.md` + `CHANGELOG.md` **en este mismo PR** (doctrina T-161).

---

## Lo que esta trayectoria NO hace

1. **No resuelve las notas por puerto** (exige división CIEM = geometría). Van adjuntas y visibles.
2. **No corrige `1 1`.** Se publica ilegible antes que inventado.
3. **No publica vedas ni cupos.** No hay fuente estructurada; el art. 5 del RD 347/2011 solo habilita
   al Ministerio a fijarlos por orden.
4. **No publica zonas de pesca.** No existe la fuente.
5. **No toca normativa autonómica.** Es T-24 y va la última.
6. **No mete la normativa en el service worker más allá de la política declarada del módulo.**

## Definition of Done

Suite completa en verde (lint anti-slop, typecheck, tests TS + Python, build de la web, deno
check/test), los cuatro gates de CI, `security-gate`, pase del **verificador**, pase de **qa** y pase
de **qa-adversario** con su trinquete incorporado; ROADMAP y CHANGELOG en el PR; `verificadoEn`
escrito por G2 y no a mano; dashboard y vault al día.
