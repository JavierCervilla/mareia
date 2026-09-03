# T-22-A · Las observaciones del día: las 5 reglas derivadas, sin el bloque de FishBase

**Trayectoria**: `cmtlgs2ci001umruy58eclf58` · hija de E-MAREIA · **Rama**: `claude/T-22-A-observaciones`
**Spec**: `Contexto_Base_SRE/01_Espec_y_Contratos/design_modulo_especies_y_zonas.md` §4.

## Por qué esto se puede hacer hoy, y por qué es sólo una parte

T-22 estaba en la cola como **bloqueada por FishBase** (necesita red, que esta sesión no tiene, y la
decisión **Q2** del humano sobre CC-BY-NC). Al releer la spec, la dependencia declarada es más fina de
lo que yo había dicho:

> «T-19 (**reglas 1–5 solo necesitan el dominio**; el bloque citado necesita T-20)»

Las cinco reglas derivadas, el tipo `Observacion`, los gates **T1/T2/T3** y el **censo publicado** no
tocan FishBase. Se entregan. **Lo que queda fuera, con su nombre**: la rama `citada` de `Procedencia`
—hábitat, profundidad, talla máxima, ritmo de actividad—, que es donde vive la decisión Q2.

**Y la rama `citada` no se declara «para más adelante».** Un tipo con una rama que nadie construye es
un camino sin ejercitar: es exactamente lo que T-29 acaba de enseñar («no se añade por si acaso»).
Cuando entre FishBase, añadir la rama son cuatro líneas y **su test**.

## Tres asunciones y dos tradeoffs (antes del primer `file_write`)

**Asunciones**
1. **El texto de una regla es función pura de sus magnitudes**, no de todo el contexto del día. Es
   una restricción que me impongo yo, no la pide la spec, y es la que hace posible **T3**: si el
   texto sólo depende de lo que se publica en la página, el gate puede recomputarlo. Si dependiera
   del contexto entero, T3 tendría que reconstruir el día completo desde el `dist/`.
2. **Que una regla no dispare es información honrada**, no un fallo. La spec lo dice explícitamente:
   el censo exige que las reglas estén *declaradas y probadas*, no que disparen.
3. **La superficie es la de `fishing`**, que ya es «actividad», y no un módulo nuevo. El rótulo vive
   en `textos.ts`, que existe precisamente por esto.

**Tradeoffs**
1. **Las magnitudes viajan al HTML** (`data-entradas`) para que T3 pueda recomputar. Cuesta bytes en
   cada página de puerto y expone los números redondeados. A cambio, el gate comprueba **que el texto
   es la salida de la regla que dice ser**, en vez de que exista un atributo. Se paga.
2. **Cinco reglas y ni una sexta.** La spec dice «no hay una sexta que se sostenga». Se respeta: la
   tentación de añadir una que «casi» se deriva es exactamente el slop que este tipo existe para
   impedir.

## Q5 sigue siendo tuya, y el documento se contradice

El nombre de la superficie es la pregunta **Q5**. Y el propio design doc no se pone de acuerdo
consigo mismo: la tabla del plan (§8) la llama **«Observaciones del día»** y la prosa (§4.4) propone
**«Lo que sale del cálculo»**. Sigo con la de la tabla —es la que nombra el plan y lee como una
sección de almanaque—, **en una sola constante** (`ROTULO_OBSERVACIONES`), para que cambiarla sea una
línea y no una búsqueda. Q5 queda abierta.

## Entregables

1. **Tipos** — `MagnitudCalculada`, `Procedencia` (sólo rama `derivada`), `Observacion`, `ReglaId`
   como unión cerrada. **Una frase sin procedencia no compila** (T1).
2. **Las cinco reglas**, funciones puras: `coincidencia-solunar-marea`, `periodo-en-luz`,
   `rango-del-dia`, `franja-de-nivel-bajo`, `iluminacion-lunar`.
3. **T2 · censo de reglas** — por cada miembro de `ReglaId`: golden test con entradas y salida
   fijadas, entrada en `docs/recomendaciones.md` con su derivación, y **al menos una
   `MagnitudCalculada` real** entre sus entradas. Falta una de las tres → rojo.
4. **T3 · trinquete de recomputación** sobre `dist/` — por cada nodo bajo `[data-observaciones]`,
   recomputar el texto ejecutando la regla de su `data-regla` con las entradas de esa página y exigir
   igualdad.
5. **Censo publicado** — `reglas_declaradas` y `reglas_con_golden` en la página de metodología, y el
   test exige que sean iguales. **Es lo que impide que T1–T3 se satisfagan callando**: con cero
   observaciones los tres pasan.
6. **La superficie** en la página de puerto, con su rótulo en una constante.

## La frontera del slop, que es el punto de todo esto

Las reglas enuncian **el hecho**, nunca **el beneficio**. Se publica «el periodo mayor de 13:40 cae
dentro de las dos horas siguientes a la bajamar»; **no** se publica «buen momento para pescar». Nada
de cebos, aparejos, técnicas, spots, pronóstico de captura, ni ninguna frase con «recomendamos», «lo
mejor es» o «ideal para».

## Definition of Done

`pnpm lint` · `pnpm typecheck` · `pnpm test` · **`pnpm test:e2e` entero** · CI en verde ·
**pase adversario** (el PR toca UI: el check lo exige, y en T-30 fue quien encontró los dos defectos).
`CHANGELOG` y `ROADMAP` con `assert` antes y después.
