# Especificación de Widgets — PWA + Capacitor

**Versión:** 1.0
**Estado:** Borrador
**Ámbito:** Widgets de pantalla de inicio para iOS (WidgetKit) y Android (Glance), alimentados por
la PWA de Mareia empaquetada con Capacitor.

---

## 0. Contexto Mareia

Mareia es una web PWA (Astro SSG + API Deno); **hoy no existe shell Capacitor**. Esta spec fija el
contrato y el diseño de los widgets *antes* de esa implementación, para que el shell nazca con los
widgets contados. Encaje con el resto del sistema:

- **El dato del widget es el de la app**: la tabla de mareas del día del puerto favorito (eventos
  pleamar/bajamar, coeficiente, sol/luna). Todo es **determinista y precalculable**: el mismo
  almanaque que T-12 precachea para el modo offline sirve para generar el payload del widget sin
  red. El widget nunca llama al API.
- **Puerto favorito**: el widget muestra **un** puerto (el favorito activo de la app). Multi-puerto
  o selección por widget queda fuera de v1 (sería «widget configurable», ver §11).
- **Transparencia**: si el puerto es micromareal o su estación es de calidad estimada, el payload ya
  trae los textos con esa cautela (los escribe la web app; el widget no decide).

### Decisiones abiertas (cerrar al arrancar la implementación)

| Decisión | Estado |
|---|---|
| Bundle id de la app Capacitor (y de él, el App Group iOS) | Pendiente — abajo se usa `group.app.mareia.widgets` como placeholder |
| Esquema de deeplink | Propuesto `mareia://` (p. ej. `mareia://port/vigo`), mapeado a las rutas SSG `/galicia/pontevedra/vigo` en el listener |
| Validación del payload | El monorepo **no usa zod**; v1 valida a mano con errores ruidosos (estilo contract-tests del API). Adoptar zod sería decisión explícita aparte |

---

## 1. Principios de diseño

1. **Widgets «tontos»:** los widgets nativos solo leen datos y los pintan. Toda la lógica de negocio
   (motor de mareas, coeficiente, solunar) vive en la capa web (TypeScript).
2. **Fuente única de verdad:** la web app es la única que escribe el estado del widget.
3. **Contrato de datos versionado:** app y widgets se comunican solo mediante un JSON con esquema
   definido y versionado.
4. **Degradación elegante:** un widget sin datos o con datos corruptos nunca crashea; muestra un
   estado vacío definido.
5. **Paridad visual, no idéntica:** iOS y Android respetan sus guías nativas (SwiftUI / Material),
   pero comparten jerarquía de información, colores de marca y tono.

---

## 2. Arquitectura

```
┌─────────────────────────────┐
│   PWA Mareia (TypeScript)   │
│   - Motor mareas/almanaque  │
│   - Genera WidgetPayload    │
└──────────────┬──────────────┘
               │ WidgetsBridgePlugin.setItem()
               ▼
┌─────────────────────────────┐
│  Almacenamiento compartido  │
│  iOS: App Group UserDefaults│
│  Android: SharedPreferences │
└──────┬───────────────┬──────┘
       ▼               ▼
┌────────────┐   ┌────────────┐
│ WidgetKit  │   │  Glance    │
│ (SwiftUI)  │   │  (Kotlin)  │
└────────────┘   └────────────┘
```

- **Clave de almacenamiento:** `widget_payload_v1`
- **App Group (iOS):** `group.app.mareia.widgets` *(placeholder; fijar con el bundle id)*
- **Refresco:** tras cada escritura, la web invoca `reloadAllTimelines()` (iOS) y un broadcast de
  actualización (Android).

---

## 3. Contrato de datos (WidgetPayload)

Todo widget consume exclusivamente este JSON:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-08-28T10:30:00Z",
  "expiresAt": "2026-08-29T00:00:00+02:00",
  "theme": {
    "accent": "#4F46E5",
    "mode": "auto"
  },
  "widgets": {
    "summary": {
      "title": "Vigo · coef. 87",
      "primaryValue": "16:42",
      "primaryLabel": "pleamar · 3,4 m",
      "items": [
        { "id": "e1", "text": "BM 10:12 · 0,8 m", "deeplink": "mareia://port/vigo" },
        { "id": "e2", "text": "PM 16:42 · 3,4 m", "deeplink": "mareia://port/vigo" },
        { "id": "e3", "text": "BM 22:31 · 0,9 m", "deeplink": "mareia://port/vigo" }
      ]
    }
  }
}
```

En Mareia, `primaryValue`/`primaryLabel` llevan el **siguiente evento de marea** del puerto
favorito, el `title` lleva puerto + coeficiente del día, y `items` los eventos del día civil del
puerto (los mismos que la tabla del día, con la misma zona horaria: días civiles del puerto, no
ventanas UTC). `expiresAt` es la **medianoche local del puerto**: los eventos de mañana son otro
payload, no una prórroga.

### Reglas del contrato

| Regla | Detalle |
|---|---|
| Versionado | `schemaVersion` entero. Los widgets ignoran versiones mayores a las que conocen y muestran estado vacío. |
| Expiración | Si `now > expiresAt`, el widget muestra el estado «datos desactualizados». |
| Tamaño máximo | El payload no supera **50 KB** (límite práctico de UserDefaults/SharedPreferences). |
| Textos | Ya localizados y formateados por la web app (incluida la coma decimal). Los widgets no traducen ni formatean. |
| Deeplinks | Todo elemento tocable lleva un `deeplink` con esquema `mareia://`. |
| Nulos | Campos ausentes = usar valor por defecto, nunca crashear. |

---

## 4. Tamaños y layouts soportados

### iOS (WidgetKit)

| Familia | Contenido |
|---|---|
| `systemSmall` | `primaryValue` + `primaryLabel` + icono |
| `systemMedium` | Lo anterior + hasta 3 `items` |
| `systemLarge` | Título + hasta 6 `items` |
| `accessoryCircular` (lock screen) | Solo `primaryValue` |

### Android (Glance)

| Tamaño (celdas) | Contenido |
|---|---|
| 2×1 | `primaryValue` + `primaryLabel` |
| 4×1 | Lo anterior + icono y título |
| 4×2 | Título + hasta 4 `items` |

**Regla general:** la jerarquía es siempre `primaryValue` → `primaryLabel` → `items`. Al reducir
tamaño se recorta desde abajo.

---

## 5. Estados obligatorios

Cada widget implementa estos 4 estados:

1. **Normal:** datos válidos y vigentes.
2. **Vacío:** no hay payload (primera instalación). Mostrar logo + «Abre la app para configurar».
3. **Desactualizado:** payload expirado. Mostrar los datos con opacidad reducida + etiqueta
   «Actualizado hace X».
4. **Error:** JSON corrupto o versión desconocida. Igual que vacío. **Nunca** mostrar mensajes
   técnicos.

---

## 6. Actualización de datos

| Mecanismo | Plataforma | Cadencia |
|---|---|---|
| Escritura desde la app (foreground) | Ambas | Inmediata tras cada cambio relevante (cambiar de puerto favorito, abrir la app en un día nuevo) |
| Timeline programado | iOS | Cada 30 min (respetar presupuesto de WidgetKit) |
| WorkManager periódico | Android | Cada 30 min |
| Push silencioso → Background task | Ambas (opcional, fase 2) | Bajo demanda |

En Mareia el refresco periódico no trae datos nuevos de red: **regenera el payload desde el
almanaque precacheado** (el «siguiente evento» avanza y el payload del día siguiente se emite al
cruzar la medianoche local). Sin red y sin app abierta, el peor caso es el estado «desactualizado»
de §5, nunca datos inventados.

La web app expone una única función:

```ts
// widget-service.ts — único punto de escritura
export async function publishWidgetPayload(payload: WidgetPayload): Promise<void>
```

Prohibido escribir el payload desde cualquier otro módulo.

---

## 7. Interacción

- **Tap en el widget completo:** abre la app en la pantalla principal (`mareia://home`).
- **Tap en un item:** abre su `deeplink` (la página del puerto).
- **Sin acciones destructivas** desde el widget en v1.
- Los deeplinks se manejan en la web con `App.addListener('appUrlOpen', ...)` de Capacitor,
  mapeando `mareia://port/<slug>` a la ruta SSG del puerto.

---

## 8. Estilo visual

- **Tipografía:** sistema nativo (SF Pro / Roboto). No incrustar fuentes web.
- **Color de acento:** tomado de `theme.accent` del payload; fallback `#4F46E5`. La web lo rellena
  con el token de acento del design system de la app (tema claro/oscuro ya resuelto en OKLCH).
- **Modo oscuro:** obligatorio. `theme.mode: "auto"` sigue al sistema.
- **Márgenes:** usar los estándares de cada plataforma (`ContainerRelativeShape` en iOS,
  `GlanceModifier.padding(12.dp)` en Android).
- **Sin imágenes remotas en v1** (complican el ciclo de vida del widget). Solo assets empaquetados.

---

## 9. Estructura del repositorio

Adaptada al monorepo (la capa web vive en `apps/web`; el shell Capacitor nacerá como app propia):

```
apps/web/src/widgets/
  widget-service.ts        # publishWidgetPayload()
  widget-payload.ts        # Tipos + validación a mano (ver §0, decisiones abiertas)
  widget-payload.schema.json
apps/mobile/               # shell Capacitor (futuro)
  ios/App/SummaryWidget/   # Widget Extension (SwiftUI)
  android/app/src/main/java/.../widget/  # GlanceAppWidget
```

---

## 10. Criterios de aceptación (checklist QA)

- [ ] Widget muestra estado vacío en instalación limpia.
- [ ] Widget refleja cambios < 5 s tras cambiar el puerto favorito con la app abierta.
- [ ] Payload expirado muestra estado desactualizado, no datos «frescos».
- [ ] JSON corrupto no crashea el widget (probar escribiendo basura en la clave).
- [ ] Deeplinks abren la página del puerto correcta con la app cerrada, en background y abierta.
- [ ] Modo oscuro correcto en ambas plataformas.
- [ ] Todos los tamaños declarados renderizan sin cortes de texto.
- [ ] `schemaVersion` desconocida → estado vacío.
- [ ] El payload de un puerto micromareal lleva los textos con la cautela de calidad (grade/`null`)
      que ya publica el API — el widget no la inventa ni la omite.
- [ ] Al cruzar la medianoche local del puerto, el siguiente refresco emite el día nuevo.

---

## 11. Fuera de alcance (v1)

- Widgets interactivos (botones con acciones in-widget).
- Imágenes remotas.
- Widgets configurables por el usuario (intents/parámetros; incluye elegir puerto por widget).
- Live Activities (iOS) — candidato para v2 (cuenta atrás a la pleamar).
- Gráfico de curva de marea dibujado en el widget (v1 es solo texto + icono; la curva exigiría
  renderizar imagen en la web y pasarla como asset, ver «sin imágenes remotas»).
