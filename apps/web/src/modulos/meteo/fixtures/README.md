# Fixtures de la sección meteo

Lo que hay aquí **no está escrito a mano**: son las respuestas del módulo `weather` real (T-08)
montado en Express, capturadas el **2026-08-28** para **Vigo** (celda 42,2 / −8,7). El estado `ok`
salió contra Open-Meteo de verdad; los estados degradados salieron del mismo módulo forzando la
degradación por su mecanismo real (reloj adelantado, `fetch` que rechaza, caché vacía), no editando
el JSON después.

Importa el matiz: un fixture escrito a mano prueba que la UI sabe pintar *lo que su autor creía que
devuelve el backend*. Uno capturado prueba que sabe pintar lo que el backend **devuelve**. Aquí, por
ejemplo, la mar de viento de Vigo venía a `0` y no a `null` — un cero medido, que no puede pintarse
como un hueco; y el modelo de oleaje devuelve `null` en toda la celda de tierra adentro, que es la
otra ausencia y se dice de otra manera.

**En los tests no hay red**: estos ficheros son la única entrada de `vista.test.ts` y del recorrido
Playwright, que sirve estos mismos bytes desde `page.route`.

| Fichero | Qué estado congela | Cómo se produjo |
|---|---|---|
| `weather-ok.json` | `ok` fresco, las dos fuentes | petición real a Open-Meteo (marine + forecast) |
| `weather-stale.json` | `ok` con `stale: true`, 11 400 s de edad | la misma caché, `fetch` caído y el reloj +3 h 10 min |
| `weather-no-disponible.json` | `unavailable` en las dos fuentes | `fetch` caído y caché vacía |
| `weather-parcial.json` | `partial`: mar servido, atmósfera caída | `fetch` que solo deja pasar la Marine API |
| `weather-huecos.json` | `ok` con **huecos reales del modelo** (`null`) | petición real a una celda de tierra adentro (42,2 / −7,5), donde el modelo de oleaje no publica |
| `bulletin-sin-clave.json` | boletín `unavailable`, credencial `missing` | el módulo sin `AEMET_API_KEY`: es literalmente lo que sirve esta instancia hoy |
| `bulletin-clave-caducada.json` | boletín `unavailable`, credencial `expired` | JWT con `exp` en el pasado + AEMET devolviendo 401 |
| `bulletin-ok.json` | boletín `ok` con su documento | doble de AEMET (ver abajo) |

## La excepción honesta: `bulletin-ok.json`

Es el **único** fixture que no viene de la fuente real, y no por comodidad: el catálogo de AEMET
Open Data solo se consulta con una API key y este repositorio no tiene ninguna (ver el TODO de
`packages/modules/weather/src/aemet.ts`). Su documento imita la forma que documenta AEMET —incluido
el detalle de servirlo en **ISO-8859-15**, que es lo que obliga al adaptador a decodificar a mano
para que «Cádiz» no se convierta en «CÃ¡diz»—, pero el esquema **sigue sin verificar**, igual que el
`verified: false` de las zonas.

Por eso la UI que lee este documento es tolerante con la forma y explícita con el fracaso: si el
documento no trae ninguno de los campos conocidos, la sección lo dice en vez de enseñar un trozo
adivinado. El día que haya credencial, se recaptura de verdad y ese test cambia de fixture sin tocar
código.

## Recapturar

Los fixtures se congelan a propósito (un test que sale a la red no es determinista y no corre en
CI). Para renovarlos hay que montar el módulo con `createWeatherModule`, un `fetch` real para el
estado `ok` y los dobles descritos en la tabla para los demás, y volcar las respuestas de
`/v1/modules/weather/weather?port=vigo` y `/v1/modules/weather/bulletin?port=vigo`. Al hacerlo hay
que revisar los valores que `vista.test.ts` afirma literalmente (1,68 m, 9,4 km/h…): son parte de la
captura, no constantes del código.
