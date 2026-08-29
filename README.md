# 🌊 Mareia

**Portal OpenSource de mareas, actividad solunar y meteorología marina.**

Mareia es una web PWA estilo tabla de mareas "todo en 1": para cada puerto muestra la tabla de
pleamares y bajamares, el gráfico de altura de marea, el coeficiente de mareas, salida y puesta de sol
y luna, los periodos solunares de actividad de peces y la previsión meteorológica marina — calculado
todo con **fuentes abiertas y métodos publicados**, y con **transparencia total**: cada dato enlaza su
fuente, su licencia y el código que lo calcula.

> ⚠️ **No apto para navegación.** Las predicciones de Mareia se calculan a partir de fuentes abiertas
> con métodos publicados y pueden diferir de las tablas oficiales. Para navegación consulte las
> publicaciones oficiales de su autoridad hidrográfica.

## Principios

- **100% OpenSource y no comercial** — AGPL-3.0. Nadie puede cerrar un fork del portal.
- **Datos abiertos** — el dataset de constituyentes armónicos por puerto **no tiene una licencia
  única**: cada puerto hereda la de su mareógrafo de origen y la declara en su propio JSON (el
  reparto medido, en [Licencia](#licencia)). La API es de libre consulta.
- **Transparencia como feature** — página de metodología, informes de validación públicos y
  `source` + `grade` de calidad visibles en cada dato.
- **Cálculo propio** — motor de predicción armónica propio (Foreman 1977) sobre constantes públicas
  (TICON-4, la única fuente de constantes del dataset); astronomía y solunar calculados en local con
  Astronomy Engine.

## Arquitectura (monorepo)

| Ruta | Qué es |
|---|---|
| `apps/web` | Frontend Astro (SSG por puerto, PWA) |
| `apps/api` | API Deno + Express (clean architecture) |
| `packages/domain-core` | Dominio puro: motor de mareas, astronomía, solunar, coeficiente |
| `packages/usecases` | Casos de uso + puertos (interfaces) |
| `packages/module-contract` | Contrato `AppModule` que hace enchufables los módulos |
| `packages/modules/*` | Módulos: `fishing` (solunar), `weather` (meteo marina) |
| `packages/adapters` | Adapters: stations JSON, caché KV, Open-Meteo, AEMET |
| `data/pipeline` | Pipeline Python offline: armónicos → JSON canónico por puerto |
| `data/stations` | Dataset canónico de constituyentes por puerto (licencia por estación) |

## Atribuciones de datos

Las fuentes del **dataset derivado** son exactamente estas, ni una más ni una menos. No es una
promesa: el gate `data/pipeline/tests/test_readme_dice_lo_que_se_mide.py` recomputa el conjunto
desde los JSON publicados en cada CI y se pone en rojo si sobra una fuente (atribuir lo que no se
usa) o si falta (usar un dato sin decir de dónde sale, que es la falta grave de las dos).

<!-- gate:fuentes-del-dataset -->
<!-- El gate compara los nombres entre `backticks` de esta tabla con el conjunto de
     `source.attribution[].name` de los JSON publicados. Dentro de este bloque los backticks son
     sólo para eso: cualquier otro nombre entrecomillado así se lee como una atribución. -->
| Fuente | Nombre con el que la acredita cada JSON | Qué aporta | Licencia |
|---|---|---|---|
| [TICON-4 · DGFI-TUM](https://www.seanoe.org/data/00980/109129/) | `TICON-4` | las constantes armónicas de todos los puertos | la de cada estación (reparto en [Licencia](#licencia)) |
| [openwatersio/tide-database](https://github.com/openwatersio/tide-database) | `openwatersio/tide-database` | agregación y normalización de esas constantes | MIT el código; los datos, su licencia de origen |
| [GeoNames](https://www.geonames.org/) | `GeoNames` | nombre del municipio y coordenadas de la dársena | CC-BY 4.0 |
<!-- /gate:fuentes-del-dataset -->

- Meteorología: [Open-Meteo (CC-BY 4.0)](https://open-meteo.com/) ·
  [AEMET OpenData](https://opendata.aemet.es/) · [NOAA NDBC](https://www.ndbc.noaa.gov/)
- Astronomía: [Astronomy Engine (MIT)](https://github.com/cosinekitty/astronomy)

**Evaluadas y no usadas.** Se nombran aquí, con su motivo, y no en la tabla de arriba: una
atribución es una afirmación de procedencia, y acreditar una fuente de la que no sale ni un dato
hace más difícil comprobar de dónde sale el que sí.

- **REDMAR / Puertos del Estado** — no hay vía automatizable de descarga de constantes armónicas
  (ver el informe QC de `data/pipeline/reports/`). Y aunque la hubiera: sus condiciones de uso
  («en ningún caso se permite la transferencia de los datos a terceros») no autorizan republicar el
  dato, así que el filtro de licencia de `reconcile.py` la dejaría fuera de la elección.
- **FES2022 (AVISO/CNES)** — requiere credenciales AVISO/CNES, que son una acción humana registrada
  aparte. Ninguna estación del dataset usa sus datos.

## Licencia

Código: [AGPL-3.0](LICENSE).

Dataset derivado (`data/stations`): **no hay una licencia única**. Cada puerto hereda la de su
mareógrafo de origen y la declara en su propio JSON (`source.primary.license` y
`source.attribution[].license`). Contado sobre los puertos publicados:

<!-- gate:reparto-de-licencias -->
| Licencia de la fuente primaria | Puertos |
|---|---|
| `cc-by-nc-4.0` | 104 |
| `cc-by-4.0` | 49 |
<!-- /gate:reparto-de-licencias -->

Es decir: la mayoría de los puertos van con `cc-by-nc-4.0`, heredada de los mareógrafos que llegan
vía CMEMS/GESLA. Mareia es un proyecto no comercial, así que su propio uso es conforme; **quien
reutilice el dataset hereda esa restricción en la mayor parte del catálogo**, y por eso lo que hay
que mirar es la licencia puerto a puerto (ver `data/stations/README.md`) y no un titular. Las cifras
de la tabla no se escriben a mano: las recomputa el mismo gate desde los JSON, y si el reparto
cambia y la tabla no, CI se pone en rojo.
