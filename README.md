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
- **Datos abiertos** — el dataset de constituyentes armónicos por puerto se publica bajo CC-BY 4.0
  (con las atribuciones de sus fuentes de origen) y la API es de libre consulta.
- **Transparencia como feature** — página de metodología, informes de validación públicos y
  `source` + `grade` de calidad visibles en cada dato.
- **Cálculo propio** — motor de predicción armónica propio (Foreman 1977) sobre constantes públicas
  (REDMAR, TICON-4, FES2022); astronomía y solunar calculados en local con Astronomy Engine.

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

- Constituyentes armónicos: [Puertos del Estado / REDMAR](https://portus.puertos.es/) ·
  [TICON-4 (DGFI-TUM, CC-BY 4.0)](https://www.seanoe.org/data/00980/109129/) ·
  [FES2022 (AVISO/CNES)](https://www.aviso.altimetry.fr/en/data/products/auxiliary-products/global-tide-fes.html)
- Meteorología: [Open-Meteo (CC-BY 4.0)](https://open-meteo.com/) ·
  [AEMET OpenData](https://opendata.aemet.es/) · [NOAA NDBC](https://www.ndbc.noaa.gov/)
- Astronomía: [Astronomy Engine (MIT)](https://github.com/cosinekitty/astronomy)

## Licencia

Código: [AGPL-3.0](LICENSE) · Dataset derivado (`data/stations`): licencia **declarada por
estación** en cada JSON — CC-BY 4.0 en su mayoría; algunas estaciones (p. ej. Bilbao y Huelva)
llevan **CC-BY-NC 4.0** heredada de su fuente (GESLA). Mareia es un proyecto no comercial, por lo
que el uso es conforme en todos los casos; los reutilizadores del dataset deben respetar la licencia
de cada estación (ver `data/stations/README.md`).
