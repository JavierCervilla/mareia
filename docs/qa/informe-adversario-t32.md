# Informe adversario — P6 contra la fuente entera (T-32)

- **Trayectoria:** T-32 · **PR:** #34 (`claude/T-32-p6-fuente-entera`) · **Fecha:** 2026-09-10
- **Superficie atacada:** el camino nuevo de P6 (`areas.fuente_entera`, `areas.exigir_alcance_total`,
  `rampe.materializar`), el paso de CI y el mensaje del ✓.
- **Entorno:** local, con red real a MITECO. Sin cloud.
- **Ejecutor:** el orquestador a mano.
- **Reproducciones:** los propios gates, con la fuente y el artefacto manipulados.

## Promesa atacada

> «P6 cubre lo que dice cubrir, y cuando se le pide la fuente entera o la cubre o es rojo.»

## Clases atacadas

| Clase | Hipótesis (entrada concreta) | Resultado |
|---|---|---|
| **A3** · degradación silenciosa | La descarga falla → ¿cae al recorte y sigue en verde? | 🟢 aguantó — `AlcanceInsuficienteError`, probado en rojo con el `materializar` saboteado |
| **A8** · alcance | Fuente que baja bien pero **mutilada** (la mitad de las áreas de cada fichero) | 🟢 aguantó — «cubre 156 de 348 relaciones (192 sin cubrir, 43 de 86 áreas)» |
| **A12** · el artefacto encoge para caber | Recortar el **dataset** a las 14 relaciones que cubre el fixture: entonces `cubiertas == publicadas` es **cierto** | 🟢 aguantó, **pero no por donde parecía** — ver abajo |
| **A9** · el gate cuenta con lo que vigila | ¿Salen las dos cifras del alcance del mismo recorrido? | 🟢 aguantó — cubiertas de la fuente, publicadas del artefacto; hay test que lo fija |
| **A11** · umbral disfrazado de igualdad | Cambiar `!=` por `< 10` en la comprobación | 🟢 aguantó — probado en rojo, el test lo caza |

## El ataque que enseñó algo, aunque no fuese hallazgo

**A12 · recortar el artefacto para que el recorte lo cubra entero.** Si el dataset se queda con sólo
las 14 relaciones de las 7 áreas del fixture, `exigir_alcance_total` **pasa**: `cubiertas == publicadas`
es literalmente cierto. Visto en aislamiento parece un agujero de libro — el gate declarando cobertura
total sobre un artefacto al que le faltan 334 relaciones.

**No lo es, y conviene saber por qué**: `exigir_alcance_total` no es el gate, es la **precondición de
alcance**. El gate es `errores_de_reconstruccion`, que con la fuente entera deriva las 348 relaciones
que *deberían* estar y denuncia una a una las que el dataset no publica. Con el artefacto mutilado da
**rojo inmediato** y nombra cada ausencia con su distancia.

Y el dato que lo convierte en argumento a favor de esta trayectoria: **con el recorte, esa misma
mutilación da 0 fallos**. El recorte no puede echar de menos lo que nunca vio.

Queda escrito aquí porque el reparto de responsabilidades entre las dos funciones no es obvio leyendo
sólo una, y alguien que mañana toque `exigir_alcance_total` pensando que es el gate podría
«arreglarla» de una forma que rompa el reparto.

## No reproducidos (dichos, no escondidos)

- **El código y el derivado desviados a la vez.** P6 reconstruye con el código de hoy, así que un
  `utm.py` desviado *y* su derivado commiteados juntos le cuadrarían. Lo atan las anclas de
  `tests/test_utm_reproyeccion.py`, fijadas a 1e-9 grados. No es nuevo de T-32: es la limitación que
  P6 ya declaraba, y sigue igual de cierta con la fuente entera.
- **MITECO sirviendo una fuente adulterada.** Si la fuente miente, P6 la cree. Fuera de alcance sin
  una firma o un hash publicado por el origen, que MITECO no da.
- **El coste de CI.** 12 MB y ~4 s por ejecución, medidos. No se atacó porque no es una promesa.

## Veredicto

**Sin hallazgos.** Cinco clases atacadas, las cinco aguantaron, y una de ellas —A12— enseñó dónde
está de verdad la línea entre la precondición y el gate, que es lo que se documenta arriba.

Lo que sostiene el resultado no es la suerte: los dos modos de fallo que este cambio podía introducir
—caer al recorte en silencio, y comparar contra un umbral en vez de contra los sujetos— **están
probados en rojo** con su sabotaje, y viven en `tests/test_rampe_areas.py`.
