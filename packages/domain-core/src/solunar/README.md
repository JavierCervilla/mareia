# solunar/ — periodos de actividad

Las ventanas que la teoría solunar de John Alden Knight (1926) asocia a los cuatro fenómenos
lunares del día, con un rating de actividad para el día entero.

Es TypeScript **puro sobre la interfaz `AstronomyGateway`**: no importa el motor de efemérides, no
lee el reloj y no toca el entorno. Por eso los tests pueden fijar la geometría al milisegundo con
una efeméride falsa.

| Tipo | Ancla | Duración |
|---|---|---|
| Mayor (`major`) | Tránsito superior de la Luna | 2 h centradas en el tránsito |
| Mayor (`major`) | Tránsito inferior de la Luna | 2 h centradas en el tránsito |
| Menor (`minor`) | Orto de la Luna | 1 h 30 min centradas en el orto |
| Menor (`minor`) | Ocaso de la Luna | 1 h 30 min centradas en el ocaso |

## A qué día pertenece un periodo

**Un periodo pertenece al día civil en el que cae su fenómeno**, no a todos los días que toca su
ventana. La ventana **sí** puede desbordar la medianoche (hasta una hora por cada lado) y se
devuelve tal cual, para que la UI la pinte cruzando el borde.

Es lo que hace que los días **particionen** los periodos. Con el criterio alternativo —«todo
periodo que interseque el día»— un mismo tránsito aparecería en dos días seguidos y un día podría
tener 3 mayores: medido sobre 2026 en Madrid y Las Palmas, pasaría el 9 % de los días.

De ahí salen los números que sí se cumplen siempre, y que están en los tests:

- **1 o 2 mayores.** Los dos tránsitos distan 12 h 25 min, así que al menos uno cae en cualquier
  día civil; y como el día lunar dura 24 h 50 min, a veces uno de los dos se salta el día.
- **0, 1 o 2 menores.** Por lo mismo, el orto o el ocaso de la Luna pueden faltar un día. En
  latitudes polares pueden faltar los dos.
- **Entre 1 y 4 periodos** en total.

## Zonas horarias

Todo el cálculo es en UTC. La zona IANA solo se usa para saber dónde empieza y acaba el día civil,
y eso vive entero en `civil-day.ts` (con sus casos de 23 y 25 horas). La propiedad que lo fija: los
mismos fenómenos salen desde `Europe/Madrid`, `UTC` o `Pacific/Auckland`; lo único que cambia es en
qué día caen.

(Los instantes no coinciden al milisegundo entre zonas —la búsqueda de raíces arranca en un
instante distinto y converge a unas décimas de segundo del mismo cruce—, así que el test compara
con un segundo de tolerancia. Las efemérides se publican al minuto.)

## Rating

`score` es un entero en [0, 100] con etiqueta `baja`/`media`/`alta`/`muy-alta`. **La escala es una
convención declarada, no una medida**: no existe un patrón oro de «cuánto pica hoy». Lo que se hace
es fijar la fórmula, escribir los umbrales y devolver el desglose (`moonScore`, `solarBonus`,
`daysFromSyzygy`, `solarOverlapCount`), para que el número sea auditable y se pueda discrepar de la
convención sin dudar de la aritmética. La fórmula completa, con su derivación y sus constantes,
está en el TSDoc de `rating.ts`.

Dos reglas que conviene no perder de vista:

- **100 y 0 solo se alcanzan por exactitud de la fórmula**, nunca por redondeo: un 99,6 se muestra
  como 99. Un «hoy es día perfecto» redondeado sería una mentira barata.
- **Los umbrales no son inventados**: el rango alcanzable es [30, 100] y las cuatro etiquetas son
  sus cuatro cuartos iguales (48, 65, 83). Sobre 2 años × 2 sitios ninguna queda vacía.

## Verificación

- **Exactos** con efeméride falsa: geometría de las ventanas, borde de la ventana de solape solar,
  día sin orto de Luna, fenómeno vecino que no cuenta.
- **Golden**: los mayores caen sobre los tránsitos publicados por el USNO (±3 min) y los menores
  sobre sus ortos y ocasos (±2 min), reutilizando los fixtures de `astronomy/`.
- **Propiedades** sobre 2026 en Madrid y Las Palmas: recuentos, orden, anclas dentro del día,
  rating en rango, partición sin repetidos e invariancia a la zona horaria.
