# ADR-01 — Cómo entra un dato que caduca en una página estática

- **Trayectoria**: T-11 (`module-weather-ui`)
- **Estado**: aceptada
- **Fecha**: 2026-08-28
- **Decide**: cómo llega a la página de puerto el estado del mar y del cielo, que caduca en horas,
  cuando el core del portal es SSG y cero JavaScript de cliente.

## Contexto

La página de puerto se genera **en build** (`output: "static"`) y hoy no carga ni un byte de
JavaScript: las mareas, la curva y las efemérides son astronomía, se calculan meses antes y no
envejecen. El módulo `weather` (T-08) rompe esa propiedad por primera vez: sus tres fuentes tienen
TTL de 30 min (atmósfera), 1 h (mar) y 6 h (boletín), y el backend ya expresa tres escalones de
degradación en su contrato de respuesta (`fetchedAt`, `ageSeconds`, `stale`, `unavailable` con
`reason`).

El sitio se reconstruye una vez al día (T-15). Las dos opciones sobre la mesa:

1. **Inyección en build** — pedir la meteo al generar el HTML y hornearla dentro. Mantiene el cero
   JS del core.
2. **Isla hidratada** — el HTML sale sin meteo y un script la pide al API desde el navegador.
   Cuesta JavaScript de cliente.

## Decisión

**Isla hidratada**, con una condición que es la mitad de la decisión: **el HTML construido no
contiene ni un solo dato meteorológico**. Lo que se publica en `dist/` es el cuarto estado —«el
estado del mar se pide al abrir la página y todavía no ha llegado»— y el script lo sustituye por
el dato cuando el API responde.

Y el sello de antigüedad se calcula **en el cliente**, no en el servidor:

```
edad = ageSeconds (lo que dijo el backend al responder) + (ahora − instante en que llegó la respuesta)
```

Se suma el transcurrido medido con el reloj del navegador **como diferencia**, no como instante
absoluto: así un reloj del cliente desajustado en horas no falsea la antigüedad (solo se le pide
medir un intervalo corto, que es lo único que un reloj torcido mide bien).

## Por qué, y qué se pierde

El argumento decisivo no es la frescura, es que **la inyección en build no puede sellar su propio
dato**. Un HTML que dice «consultado hace 4 minutos» sigue diciéndolo veinte horas después: el
sello es texto congelado y miente por construcción. Se podría imprimir solo el instante absoluto
(«consultado a las 15:12»), que nunca miente, pero entonces la página no puede distinguir `ok` de
`stale` —eso depende de *ahora*— y le carga al lector el trabajo de restar. Un dato de hace tres
horas presentado como fresco es peor que no publicarlo, y esa frase es el corazón de T-11.

A cambio se aceptan tres costes, todos acotados:

- **JavaScript en la página.** Se acota a la isla del módulo: **9,3 KB (3,7 KB comprimidos)**
  —medido sobre el bundle construido— que solo pintan la sección meteo. La tabla de mareas, la curva, el coeficiente y las efemérides siguen siendo HTML
  puro y **se leen igual con JavaScript desactivado**. Es exactamente el hueco que el design brief
  ya dejó abierto (§3: «si una sección necesita hidratación, es una isla de módulo (T-10/T-11) y
  entra por el contrato `AppModule`») y el que el contrato nombra `renderMode: "island"`.
- **Sin red, no hay meteo.** El lector en la playa sin cobertura ve el estado «no ha llegado» con
  su motivo, no un dato viejo. Es honesto pero es peor servicio que el de la inyección en build,
  que al menos habría dejado algo. El precache offline del módulo es T-12 y es donde se recupera.
- **La sección depende del API en tiempo de lectura**, no solo en tiempo de build: si el API cae,
  la sección lo dice mientras el resto de la página sigue en pie.

Lo que **no** se acepta como coste, y por eso está en la decisión: que la página degrade a un
hueco mudo. Sin JavaScript, sin red o con el API caído, la sección **escribe por qué no hay dato**.

## Consecuencias comprobables

- El HTML de `dist/` no contiene ninguna magnitud meteorológica: es verificable con un test sobre
  el sitio construido (`sitio-construido.test.ts`), y es lo que hace imposible que envejezca.
- Los cuatro estados (`ok`, `stale` con su antigüedad en la cara, `unavailable` con el motivo del
  backend, y «carga sin datos») tienen cada uno un test de vista y un recorrido Playwright con el
  API mockeado.
- El core sigue sin JavaScript: si mañana se borra la línea del módulo en
  `apps/web/src/modules.config.ts`, la página vuelve a ser cero JS y sigue construyendo.
