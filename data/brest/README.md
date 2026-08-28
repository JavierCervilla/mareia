# data/brest

`constituents.json` son las constantes armónicas de **Brest (Francia)** en el mismo schema
`station/v1` que el resto del dataset, generadas por el mismo pipeline.

Vive aparte de `data/stations/` porque no es un puerto del catálogo de Mareia: es la **referencia
del coeficiente de mareas** (T-04). El coeficiente francés se define sobre la amplitud de la marea
en Brest, con unidad `U = 3,05 m`, así que necesita sus constantes aunque nadie consulte nunca la
página de Brest.

Licencia y advertencias: las mismas que el resto del dataset, en
[`../stations/README.md`](../stations/README.md). Las constantes de Brest provienen de un mareógrafo
**REFMAR/SHOM publicado como CC-BY 4.0**.
