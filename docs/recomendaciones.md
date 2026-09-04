# Las observaciones del día: de dónde sale cada frase

Esta página existe porque el censo de reglas (**T2**) la exige: **una regla sin su derivación escrita
aquí pone el test en rojo**. No es documentación de cortesía — es parte del gate.

## Qué es esto, y qué no

La superficie publica **observaciones**, no consejos. Cada frase la produce una función pura a partir
de números que salen del cálculo del día, y **cada frase viaja con la regla que la generó y con sus
entradas**, de modo que el trinquete **T3** puede recomputarla desde la página construida y exigir
que coincida. Una frase escrita a mano no puede coincidir con la salida de una función que no la
genera.

**La frontera es esta**: las reglas enuncian **el hecho**, nunca **el beneficio**.

- Se publica: «el periodo mayor de 09:40 queda a 15 min de la bajamar de 09:25».
- **No** se publica: «buen momento para pescar».

Y explícitamente **no se genera**: cebos y carnadas · aparejos y montajes · técnicas · «mejores horas
para pescar X» · spots · pronóstico de captura · consejos de seguridad · ninguna frase con
«recomendamos», «lo mejor es» o «ideal para». Hay un test que lo comprueba sobre el texto producido,
no sobre la intención.

## Que una regla no dispare es información

Ninguna regla se fuerza a decir algo. Un día sin coincidencia solunar y sin franja baja publica menos
observaciones, y eso es un dato del día. Lo que **no** puede pasar es que el silencio salga gratis:
por eso la página de metodología publica el **censo** —cuántas reglas hay declaradas y cuántas tienen
golden— y el test exige que los dos números sean iguales. Con cero observaciones, un gate que sólo
prohibiera estaría en verde.

## Las cinco reglas

### `coincidencia-solunar-marea`

**Qué dice.** La coincidencia más ajustada del día entre el pico de un periodo solunar y un extremo
de marea, cuando caen a menos de **2 h** una de otro.

**Derivación.** Para cada par (periodo, extremo) se toma `|pico − extremo|`. Se descartan los pares
por encima de la ventana de 2 h y se publica **el menor**. Se publica uno y no todos: enumerar seis
coincidencias es ruido, y la que informa es la más cerrada.

**Magnitud publicada.** `separacion_min` (min).

**Lo que no afirma.** Que la coincidencia signifique nada. La teoría solunar (Knight, 1926) no tiene
resultado contrastado, y eso ya lo dice `AVISO_SIN_RESPALDO` en la misma página. Aquí sólo se mide la
distancia entre dos instantes que el sitio ya calcula por separado.

### `periodo-en-luz`

**Qué dice.** Cuántos de los periodos solunares del día caen entre el orto y el ocaso del Sol.

**Derivación.** Se cuentan los periodos cuyo pico está en `[orto, ocaso]`. **Publica también el
cero**: «ninguno de los 4 periodos cae entre el orto y el ocaso» es un hecho del día. No dispara si
no hay periodos o si no hay orto y ocaso —latitudes altas—, porque entonces no hay nada que contar.

**Magnitudes publicadas.** `periodos_en_luz`, `periodos_del_dia` (recuentos, adimensionales).

### `rango-del-dia`

**Qué dice.** Cuánto recorre la marea entre la menor bajamar y la mayor pleamar del día, con el
coeficiente si el puerto lo tiene.

**Derivación.** `amplitud = max(pleamares) − min(bajamares)`. El coeficiente es el de T-04 y se
**omite la cláusula entera** si el puerto no tiene marea semidiurna: un coeficiente no definido no se
publica como cero ni como raya.

**Magnitudes publicadas.** `amplitud_m` (m) y, cuando existe, `coeficiente` (adimensional).

### `franja-de-nivel-bajo`

**Qué dice.** La franja continua más larga del día con el nivel por debajo del quinto inferior del
rango, con su umbral y sus horas.

**Derivación.** Sobre la curva **ya calculada** (aquí no se predice nada): se toma
`umbral = min + 0,20 × (max − min)` **de ese día**, se buscan los tramos continuos con
`altura ≤ umbral` y se publica el más largo. No dispara si el tramo dura menos de **30 min**: media
hora suelta no es una franja.

**Por qué el umbral es una fracción del rango y no una altura fija.** Una altura fija no significa lo
mismo en Cádiz (rango ~3 m) que en Barcelona (~0,2 m): dejaría la franja siempre vacía o siempre
entera, que son las dos maneras de no decir nada. Referido al rango del propio día, el umbral es «el
quinto inferior de la marea de hoy» en cualquier puerto.

**Magnitudes publicadas.** `umbral_m` (m), `horas_bajo_umbral` (h).

**Para qué sirve, sin prometer nada.** El design-brief §1 dice que el uso real del sitio es el
marisqueo y la pesca a pie. Esta regla publica **cuándo hay poco agua**, que es un hecho de la curva.
No dice que se pesque mejor entonces.

### `iluminacion-lunar`

**Qué dice.** La fase de la Luna, el porcentaje de disco iluminado y su edad.

**Derivación.** Directa de la efeméride del mediodía civil que ya calcula `domain-core`
(Astronomy Engine). La fase se traduce con un `switch` **sin `default`**: si el dominio añadiera una
novena fase, el módulo dejaría de compilar en vez de publicar su nombre en inglés.

**Magnitudes publicadas.** `fraccion_iluminada` (%), `edad_lunar_dias` (adimensional).

## El golden, y por qué su día es corto y a mano

El día de referencia de los tests está escrito **valor a valor** y no generado con una fórmula. La
primera versión usaba un coseno de 12 h 25 min: era más realista y **no servía como golden**, porque
comprobar a mano si el resultado era correcto exigía resolver un `acos`, y un valor esperado que no se
puede verificar sólo certifica que el código sigue haciendo lo que hacía. Encima producía dos franjas
bajas casi iguales, y cuál ganaba lo decidía el paso de muestreo.
