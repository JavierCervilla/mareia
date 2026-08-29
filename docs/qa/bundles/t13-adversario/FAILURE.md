# Failure bundle — pase adversario T-13

- **runId:** `t13-adversario` · **Fecha:** 2026-08-29
- **Arnés:** `node --experimental-strip-types --test apps/web/src/adversario-t13.test.ts`
- **Entorno:** local y efímero, sin red. `pnpm --filter web build` (sin `BUILD_DATE` → día UTC
  **2026-08-29**, 192 páginas, 15,4 s) + dataset committeado en `data/`. Sin cloud: ni el diff, ni el
  DOM, ni el código han salido del contenedor.
- **Cómo nació:** el fichero se corrió **sin** el trinquete (copia con `hallazgoAbierto` → `test`),
  que es donde está la evidencia — el envoltorio no escribe nada cuando el fallo era el esperado.
  Salida TAP recortada a los bloques de fallo en `run-sin-test-fail.tap`.
- **Veredicto del run sin trinquete:** `# pass 1 · # fail 4` (la premisa en verde, los cuatro
  hallazgos en rojo).

```
ok   1 - A-17 premisa · la congelación inyectada se dibuja plana en la curva publicada
not  2 - A-17 · ninguna congelación real de la curva se le escapa al detector
not  3 - A-18 · la prueba de sensibilidad del gate A-1 no depende del día en que corra CI
not  4 - A-19 · ninguna página publica una cifra con el decimal en formato inglés
not  5 - A-20 · un puerto no puede publicar el error de otro reescribiendo las coordenadas del mareógrafo
```

---

## A-17 · el detector de curva congelada sólo mira la meseta más larga del día

**Qué se hizo, en orden**

| # | qué |
|---|---|
| 1 | Para cada uno de los 153 puertos, medir su **meseta natural** del día publicado (2026-08-29) con el mismo instrumento del gate A-1: el tramo más largo en que la curva no se mueve. |
| 2 | Inyectar una congelación de **un paso de muestreo menos** que esa meseta, colocada donde más marea real se traga (ventana deslizante sobre los instantes de muestreo publicados). |
| 3 | Comprobar en la premisa que la curva falsificada **se dibuja plana de verdad** en el `<path>` del SVG (≥ 4 puntos consecutivos a la misma altura) y suprime > 10 mm reales. |
| 4 | Pasarle al fraude el gate A-1 tal y como está escrito: `tramoPlanoMasLargo` + excursión dentro de esa meseta. |

**El error**

```
Expected values to be strictly deep-equal:
+ actual - expected

+ [
+   'Alboraya: congelación de 190 min invisible tras una meseta natural de 200 min · suprime 62.06 mm reales',
+   'Silla: congelación de 190 min invisible tras una meseta natural de 200 min · suprime 62.06 mm reales',
+   'Sueca: congelación de 190 min invisible tras una meseta natural de 200 min · suprime 62.06 mm reales',
+   'Valencia: congelación de 190 min invisible tras una meseta natural de 200 min · suprime 62.06 mm reales',
+   'Calafell: congelación de 30 min invisible tras una meseta natural de 40 min · suprime 20.47 mm reales',
+   ... 60 más
+ ]
- []
```

**Medido:** 153 puertos · **103 con meseta natural** · **65 admiten una congelación real invisible**
(42,5 % del catálogo). Peor caso, el grupo del golfo de Valencia (Valencia, Alboraya, Silla y
Sueca): meseta natural de **200 min** que esconde una congelación de **190 min** con **62,06 mm** de
movimiento real suprimido — **62 veces** el paso de publicación de 1 mm que el propio gate usa de
umbral.

---

## A-18 · la prueba de sensibilidad del gate A-1 se pone roja por el calendario

**Qué se hizo:** reconstruir, para los 365 días de 2026, la meseta que `A-1 bis` construye (±150 min
alrededor de la primera pleamar de Vigo) y comprobar su propia precondición (`≥ 4 h`).

**El error**

```
Expected values to be strictly deep-equal:
+ actual - expected

+ [
+   '2026-01-14: la meseta inyectada dura 180 min',
+   '2026-01-29: la meseta inyectada dura 160 min',
+   '2026-02-27: la meseta inyectada dura 150 min',
+   '2026-03-29: la meseta inyectada dura 220 min',
+   ... 29 más
+ ]
- []
```

**Medido:** **33 de 365 días (9,0 %)**. Mínimo **150 min** (2026-02-27, 03-28, 05-25, 10-20, 11-20 y
12-20). No es teórico: es el rojo con el que me encontré al llegar al worktree, con un `dist/` del
**2026-03-29** (220 min) — `pnpm test` daba `# pass 115 · # fail 1` y el único fallo era
`A-1 bis · una pleamar congelada de cinco horas no se le escapa al gate`, con
`error: 'la meseta inyectada debería durar horas y dura 220 min'`. Reconstruible a voluntad:
`BUILD_DATE=2026-03-29 pnpm --filter web build && pnpm --filter web test`.

---

## A-19 · la cifra que justifica la estimación va en formato inglés

**Qué se hizo:** recorrer las 192 páginas del `dist/`, quitar `<script>` y etiquetas, y buscar
decimales con punto, descontando el separador de millares español (`381.367 km` de distancia a la
Luna) y las versiones de licencia (`4.0`, `3.0`).

**El error**

```
+ [
+   'mareas/andalucia/almeria/adra/index.html: «44.9»',
+   'mareas/andalucia/almeria/carboneras/index.html: «0.15»',
+   'mareas/andalucia/almeria/garrucha/index.html: «24.6»',
+   ... y así hasta 283
+ ]
- []
```

**Medido:** **130 de 153 páginas de puerto**, **283 ocurrencias**. Dos fuentes:

- el motivo de la estimación — «las constantes armónicas son las del mareógrafo `carg1`, a **24.8**
  km de la dársena» —, que se publica **dos veces por página** (aviso + nota de calidad);
- el motivo del grade — «no alcanza B: RMSE normalizado **0.221** > **0.15**».

En la misma página: «0,18 m», «39,442° N», «3,05 m» y «381.367 km».

---

## A-20 · la procedencia del error medido sigue siendo autodeclarada

**Qué se hizo:** construir en memoria el fraude de T-05 en su versión de hoy — Cabo de Palos
publicando el RMSE real de Cartagena (0,0506 m) bajo el código de mareógrafo `carg1`, con
`observation_lat/lon` reescritas a 0,709 km de su dársena y la distancia declarada recomputada para
que cuadre — y pasarle el invariante «ningún puerto publica una precisión que no tiene» tal y como
está escrito hoy.

**El error**

```
error: 'el invariante acepta un RMSE de 0.0506 m medido con el mareógrafo carg1,
        que el propio dataset sitúa a 26.6 km de las coordenadas declaradas aquí'
operator: 'notDeepStrictEqual'
```

**Medido:** cero incoherencias detectadas sobre un fichero que declara el mareógrafo `carg1` a
**26,6 km** de donde el propio dataset dice que está — porque Cartagena publica ese mismo `carg1` en
37,570 N −0,980 E. El desmentido está en el artefacto publicado y nadie lo mira: hoy los 32 códigos
de mareógrafo del dataset son consistentes entre sí, pero eso no lo comprueba ningún gate.
