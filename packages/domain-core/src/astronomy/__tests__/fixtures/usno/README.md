# Oráculo externo — U.S. Naval Observatory (USNO)

Ficheros **verbatim** tal y como los devolvió la API pública del *Astronomical Applications
Department* del USNO el **2026-08-28** (`"apiversion": "4.0.1"`). No se ha tocado ni una cifra:
toda la adaptación (parseo de horas, coincidencia de nombres de evento) vive en
`../../fixtures.ts`, a la vista y auditable. **Los tests no salen a la red**: la efeméride tiene
que ser determinista y reproducible en CI.

Se regeneran con `./download.sh` (commiteado al lado, con las URLs exactas). Se ejecuta a mano.

## Sitios

| Directorio | Sitio | Coordenadas | Por qué está |
|---|---|---|---|
| `oneday/madrid` | Madrid | 40,4168 N; 3,7038 O | Latitud media peninsular: estaciones marcadas, días de 9 h en diciembre y 15 h en junio |
| `oneday/las-palmas` | Las Palmas de Gran Canaria | 28,1235 N; 15,4363 O | Latitud subtropical y huso distinto: la diferencia con Madrid separa un error de efeméride de un error de huso |

## Procedencia exacta

Sol y Luna para un día (orto, ocaso, tránsito superior, crepúsculo civil, fase e iluminación):

```
https://aa.usno.navy.mil/api/rstt/oneday?date=<YYYY-MM-DD>&coords=<lat>,<lon>&tz=0
```

Cuartos lunares del año:

```
https://aa.usno.navy.mil/api/moon/phases/year?year=2026
```

Fechas descargadas (2026): 01-20, 03-20, 05-05, 06-21, 08-12, 09-23, 11-11, 12-21 — repartidas por
el año para cubrir solsticios, equinoccios y las cuatro fases lunares (hay una luna nueva exacta el
12 de agosto y días con la Luna casi llena, casi nueva y en cuarto).

## Unidades, husos y trampas

- **`tz=0`**, así que **todas las horas de los ficheros son UTC** y el «día» que enumera el USNO es
  el día UTC. Eso es exactamente el contrato del dominio (epoch ms UTC) y evita la trampa clásica:
  pedir el día local y comparar contra un motor que trabaja en UTC.
- **Las horas vienen redondeadas al minuto** (`"time": "06:27"`). Eso ya consume ±30 s de la
  tolerancia del test; por eso ±2 min es una tolerancia estricta, no generosa.
- **`fracillum` viene como porcentaje entero con `%`** (`"14%"`), no como fracción.
- **`moondata` no lista el tránsito inferior**: la API solo publica `Rise`, `Upper Transit` y
  `Set`. El tránsito inferior se verifica por propiedades (12 h sidéreas del superior, altura
  mínima, acimut en el meridiano) en `properties.test.ts`, no contra este oráculo.
- **Un día puede no tener alguno de los eventos lunares** (el día lunar dura 24 h 50 min): p. ej.
  Madrid el 2026-06-21 no tiene ocaso de Luna dentro del día UTC. El adaptador compara solo los
  eventos que la fuente publica.
- **`curphase`** es una etiqueta del USNO para el día entero («Waxing Crescent»); **no** es
  comparable con el `name` de `MoonIllumination`, que nombra un instante. No se usa como oráculo.

## Alcance como oráculo

El USNO calcula con sus propias efemérides (basadas en las de JPL) e independientemente de
`astronomy-engine`. Lo que verifica el test no es la física, sino que **nuestra envoltura —husos,
convención de horizonte, dirección de búsqueda, conversión de instantes— coincide con una fuente
oficial e independiente**. Un error de signo en la longitud o de un día en la fecha se vería al
instante; un error de milisegundos en la efeméride, no, y tampoco importa para pescar.
