# Fixture del catálogo de especies (`especies/v1`)

`catalogo.json` **no es el dataset**. El dataset lo produce el pipeline (`data/especies/catalogo.json`,
carril A de T-20, con `sources/worms.py` y `sources/obis.py`); esto es un fichero con **la misma
forma** que existe para que la interfaz y sus gates se pudieran escribir y medir antes de que el
dataset estuviera, y para que los tests del lector no dependan del dataset de producción — el mismo
criterio con el que la meteo tiene sus fixtures capturados en `src/modulos/meteo/fixtures/`.

## Qué es real y qué no

| Parte | De dónde sale |
|---|---|
| Los 86 nombres del BOE, los caladeros que regulan cada uno, la talla y su literal | **Reales**: se leen de `data/normativa/tallas-minimas.json`, el derivado del RD 560/1995 que publicó T-19 |
| Los 10 nombres aceptados distintos y las 7 grafías que no resuelven | **Reales**: son los medidos contra WoRMS y publicados en `docs/trayectorias/T-20-plan.md` |
| Los `AphiaID` | **Sintéticos y NEGATIVOS** (`-1`, `-2`, …). WoRMS no tiene identificadores negativos: es imposible confundir uno de éstos con un dato |
| Las cifras de OBIS (registros, conjuntos de datos, años) | **Sintéticas**, derivadas de un hash del nombre y el caladero |
| Las cajas envolventes | **Sintéticas**: rectángulos plausibles por caladero |

## Por qué el fichero de `data/especies/` no se commitea desde este carril

Porque entonces el sitio se podría construir con estas cifras. Sin él, `cargarCatalogoDeEspecies`
**levanta** y el build se rompe nombrando el fichero que falta: un fixture no puede llegar a
producción por descuido. Para construir en local antes de que el carril A aterrice:

```sh
mkdir -p data/especies && cp apps/web/src/modulos/especies/fixtures/catalogo.json data/especies/
```
