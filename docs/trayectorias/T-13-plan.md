# T-13 — stations-full-spain

**Objetivo**: pasar de **12 puertos piloto a ~200–300** de toda la costa española, cada uno con
grade ≥ B **o marcado como estimado**. Es la trayectoria que convierte una demo en un portal, y la
que más fácil se hace mal: publicar 300 páginas con la misma pinta de exactitud que las 12 medidas
sería exactamente el fraude que este proyecto existe para no cometer.

## La regla que gobierna todo lo demás
**Un puerto no publica una precisión que no tiene.** El pipeline de T-05 ya sabe medir (RMSE contra
observación, error de hora p95, distancia al mareógrafo) y ya sabe decir «no medible» en vez de
inventarse un número. Escalar significa escalar **eso**, no solo la lista de puertos.

## Entregables

1. **Ampliación del pipeline** (`data/pipeline/`) a ~200–300 puertos de la costa peninsular,
   Baleares, Canarias, Ceuta y Melilla. Fuentes: las mismas de T-05 (IOC, `openwatersio/tide-database`,
   REDMAR donde se pueda). **Cada estación conserva su licencia**: el dataset no es CC-BY uniforme y
   eso ya está declarado estación por estación — no lo uniformices al escalar.
2. **Grade honesto a escala**, con los umbrales de T-05 (A ≤ 5 km del mareógrafo, B ≤ 30 km) y el
   flag **`estimado`** para el puerto que toma prestadas constantes de otro sitio sin validación
   propia. Un puerto estimado **lo dice en su página**, no solo en el JSON.
3. **Regenerar el dataset con los 42 constituyentes** — T-04 añadió cinco (EP2, MA2, MB2, MKS2,
   2MS6) y el dataset sigue truncado a 37 desde entonces, con la deuda anotada en su CHANGELOG.
   Esta es la trayectoria donde se paga. **Mide el efecto**: el QC de T-05 predijo que sube Vigo y
   Santander a grade A; comprueba si es verdad en vez de citarlo.
4. **Informe QC a escala**: el de 12 puertos se lee; el de 300 hay que poder **navegarlo y
   agregarlo**. Reparto de grades, peores puertos, cobertura por región, y qué se descartó y por qué.
5. **Las páginas se generan solas**: `getStaticPaths` ya sale de `data/geo/ports.json`, así que el
   sitio debería pasar de 33 a ~300 páginas sin tocar la web. **Compruébalo y mide el build**: si
   tarda demasiado o el `dist/` se dispara, dilo con cifras — es dato para T-15 y para T-12.
6. **Tests que escalan**: los invariantes de T-07 (ni estaciones huérfanas ni referencias muertas)
   tienen que seguir valiendo con 300; el golden de Vigo sigue siendo golden.

## No-objetivos
Puertos fuera de España (fase 2), rediseño de la página, y el rebuild diario (T-15).

## Riesgos que el implementador debe mirar de frente
- **El coste de descarga y el tiempo de pipeline** se multiplican por 25. Hay caché en el pipeline:
  úsala y mide.
- **Publicar un puerto sin validar como si estuviera validado** es el fallo grave de esta
  trayectoria. Si dudas entre marcar `estimado` o no, márcalo.
- **El build de 300 páginas** puede empujar el CI fuera de su presupuesto de tiempo. Mídelo.

## DoD extra (doctrina T-161)
Checkbox T-13 en ROADMAP.md + entrada CHANGELOG.md con **cifras medidas** (reparto de grades, número
final de puertos, tiempo de build, peso del `dist/`). Sin `[skip-traj]`. No toca UI: si el diff no
lleva `.astro` ni CSS, el pase adversario no aplica — pero si acabas tocando la página, sí.
