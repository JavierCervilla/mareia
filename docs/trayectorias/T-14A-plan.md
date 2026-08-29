# T-14A — la licencia del dataset dice la verdad

**Por qué existe**: el proyecto se presenta diciendo que todo lo que publica trae «su fuente, su
licencia y el código que lo calcula». Medido hoy sobre las 153 estaciones, el `README.md` publica
**dos afirmaciones falsas** sobre precisamente eso.

Esto no es una errata de documentación. En un portal cuya promesa es que nada se publica sin poder
sostenerlo, la carta de presentación es el primer sitio donde esa promesa se comprueba — y ahora
mismo no se sostiene. Y la primera de las dos **traslada una restricción a quien se fíe**: la gracia
del proyecto es que cualquiera pueda descargarse el dataset y correr su propia instancia, y quien lo
haga leyendo «CC-BY 4.0» hereda una obligación que no sabe que tiene.

## Las dos mentiras, medidas

**1. La licencia del dataset.** `README.md:18` dice que el dataset de constituyentes «se publica bajo
CC-BY 4.0». Contando la licencia de la **fuente primaria** de cada estación, que es la que gobierna
el dato publicado:

| Licencia de la fuente primaria | Estaciones |
|---|---|
| `cc-by-nc-4.0` | **104** |
| `cc-by-4.0` | 49 |

El **68 %** no es CC-BY. Y `README.md:51-53` lo cuenta al revés: dice «CC-BY 4.0 en su mayoría;
**algunas** estaciones (p. ej. Bilbao y Huelva) llevan CC-BY-NC». La mayoría es NC, y «algunas» son
dos tercios. El fichero acierta en el mecanismo —la licencia va declarada por estación en cada
JSON— y miente en el reparto.

**2. Las fuentes de constituyentes.** `README.md:23` y `README.md:41-43` atribuyen los constituyentes
a **REDMAR, TICON-4 y FES2022**. Medido sobre las 153 estaciones:

| Fuente | Primaria | Fallback | Atribución |
|---|---|---|---|
| TICON-4 | **153** | 381 | 153 |
| REDMAR | **0** | 0 | 0 |
| FES2022 | **0** | 0 | 0 |

**TICON-4 es la única fuente de constituyentes del proyecto.** Atribuir dos que no se usan no es
generosidad: es ruido que hace más difícil comprobar de dónde sale el dato, y en el caso de REDMAR
señala a una fuente cuya licencia **prohíbe** lo que aquí se hace.

## Y una mina con la mecha puesta

`data/pipeline/mareia_pipeline/reconcile.py:38`:
```python
_DATASET_RANK = {"redmar": 0, "noaa": 1, "ticon": 2}
```
REDMAR tiene **prioridad máxima** de fuente. Sus condiciones (Puertos del Estado, banco de datos,
18-11-2024) dicen: *«solo autoriza el uso de los datos para el propósito específico de la descarga,
y, en ningún caso, se permite la transferencia de los datos a terceros»*. No es una cláusula «no
comercial» —esas ya las tenemos y son compatibles con publicar— sino **no redistribución**: uso
propio sí, publicar no.

Hoy no hay ninguna estación con datos de REDMAR, así que no hay incidente. Lo que hay es que **el
día que aparezca una vía de ingesta, el pipeline la elegiría antes que ninguna otra y publicaría lo
que no puede publicar, sin que nada lo pare.** Un orden de preferencia no es sitio para decidir qué
se puede redistribuir.

## Entregables

1. **`README.md` dice lo que se mide**: reparto real de licencias (49 / 104) con la cifra, no con un
   «en su mayoría»; y la lista de fuentes de constituyentes reducida a la que se usa. Las fuentes
   que se evaluaron y se descartaron, si se quieren nombrar, van con su motivo — no en la línea de
   atribución, que es una afirmación de procedencia.
2. **El filtro de licencia va DELANTE de la prioridad de fuente** en `reconcile.py`: una fuente cuya
   licencia no permita redistribuir queda **excluida** de la elección, con independencia de su rango.
   El rango decide entre las que se pueden publicar; nunca al revés.
3. **Un gate que lo sostenga**, y aquí está el entregable de verdad. Con la lección de esta épica
   delante: *un gate que solo prohíbe se satisface callando*, y *el gate debe vigilar el artefacto
   publicado, no la declaración*. El recorrido tiene que:
   - **recomputar** el reparto de licencias desde los JSON reales y exigir que la cifra del README
     coincida (no que «exista una cifra»);
   - **recomputar** el conjunto de fuentes realmente usadas y exigir que la lista de atribución del
     README sea exactamente ese conjunto — ni de más (atribuir lo que no se usa) ni de menos
     (usar lo que no se atribuye, que es la falta grave de las dos);
   - poner en **rojo** cualquier intento de que una fuente sin permiso de redistribución gane la
     elección en `reconcile.py`, comprobado **inyectando** una.

## Asunciones

1. La licencia que gobierna el dato publicado es la de la **fuente primaria** de cada estación; los
   `fallback` no publicados no la cambian. (Si algún día un fallback entra en el dato, el gate del
   punto 3 tiene que verlo — por eso recomputa en vez de leer un campo resumen.)
2. Nadie depende hoy del texto del README como dato maquinal; cambiarlo no rompe a nadie.
3. `cc-by-nc-4.0` es compatible con publicar el dataset (uso no comercial), y por eso el arreglo es
   **decir la verdad**, no purgar las 104 estaciones. Purgar dejaría el catálogo en 49 puertos para
   salvar una línea del README.

## Tradeoffs

- **Decir el reparto vs. anunciar una licencia única**: se pierde el titular limpio «dataset CC-BY».
  A cambio, quien reutilice sabe qué hereda. Un titular que obliga a leer la letra pequeña para no
  incumplir no es un titular, es una trampa.
- **Excluir por licencia vs. avisar**: excluir puede dejar un puerto sin la mejor fuente disponible y
  bajarle el grade. Se acepta: un grade peor y verdadero ya es la doctrina del proyecto, y publicar
  un dato que no se puede redistribuir no tiene arreglo posterior.

## Verificación

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pytest`, `ruff`, `run.py check`, y **los tres gates del
punto 3 comprobados mordiendo**: cambiar la cifra del README, añadir una atribución que no se usa,
quitar una que sí, e inyectar una fuente sin permiso de redistribución. Cada uno tiene que salir en
rojo nombrando lo que encontró.
