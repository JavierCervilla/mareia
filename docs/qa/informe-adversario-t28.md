# Informe adversario · T-28 — la letra pequeña y el contraste

**Fecha**: 2026-09-01 · **Rama**: `claude/T-28-letra-contraste` · **PR** #28
**Quién**: el orquestador. `qa-adversario` sigue caído por el cupo semanal de la cuenta. La
independencia de este pase viene de invertir la función objetivo y de atacar el `dist/` construido, no
de que lo mirase otro. Dicho, como en T-23, T-26 y T-27.

## Promesa

> Ningún texto del portal se publica por debajo del contraste que la WCAG pide para leerlo, y ninguna
> letra baja de 12 px. **Y el gate que lo vigila no puede mentir en silencio**: si su instrumento deja
> de medir, lo dice.

## Clases atacadas

| Clase | Qué se intentó |
|---|---|
| A9 · la afirmación no comprobable | Romper el instrumento por **las dos** vías conocidas y comprobar que el gate lo denuncia en vez de ponerse verde. |
| A3 · el gate que no mira donde debe | Bajar un color que **sólo existe en la paleta oscura** y ver si alguien se entera. |
| A8 · el dato que se degrada en silencio | Rebajar de verdad `--m-sub` y comprobar que el rojo nombra el elemento, su ratio y su tamaño. |
| A6 · input hostil | Subir el token del rótulo ensancha cajas con `letter-spacing`: comprobar que no reaparecen palabras partidas ni desbordamiento. |

## Hallazgos

### A-T28-1 · G4 sólo miraba la mitad de lo que el sitio publica

El portal tiene **dos paletas** —clara y oscura, por `prefers-color-scheme`— con **tokens distintos**.
G4 nació midiendo únicamente la clara.

Reproducido bajando `--m-ink` del bloque oscuro hasta casi el color de su fondo: **el gate pasó 6 de
6**. Un usuario en modo oscuro habría leído tinta sobre tinta y ningún test lo habría notado.

Lo que hace este hallazgo distinto de una avería: **la paleta oscura está bien hoy** —medida, mínimo
**5,68:1**, cero por debajo de AA—. No había defecto que arreglar; había un **agujero en el gate**, que
es peor, porque un gate incompleto da la misma tranquilidad que uno completo.

**Arreglo**: G4 mide los **dos** esquemas (`emulateMedia({ colorScheme })`) — 3 páginas × 2 anchos × 2
temas = **12 casos**, los 12 en verde. Con el mismo sabotaje puesto, ahora enrojece nombrando
«h1.portada__titulo → 1.32:1 a 46px».

## No reproducidos

1. **El instrumento que no ve nada.** Sustituido el resolvedor por un parser de `rgb(...)` —lo que
   este Chromium **no** devuelve, porque serializa `oklch(...)`—, el canario de cobertura enrojece:
   «sólo se resolvió el color de **0 de 487** elementos». Sin él, el gate habría dicho «ningún
   problema».
2. **El instrumento que lo ve todo.** Quitado el `clearRect` entre resoluciones, un fondo transparente
   devuelve el último color pintado y todo da **1,00:1**; el gate enrojece nombrándolos. Es la mentira
   inversa y también está cubierta.
3. **Un contraste realmente malo.** Rebajado `--m-sub` de verdad, el rojo nombra elemento, ratio y
   tamaño: «p.marca__fecha → **1.26:1 a 12px**». La primera vez que se intentó, **el sabotaje no llegó
   a aplicarse** —la cadena no casaba con el token real— y el gate pasó: se detectó porque el `grep`
   de control devolvió `0`, y se repitió bien. Un sabotaje que no se aplica es un gate que no se ha
   probado.
4. **El ensanchado del rótulo.** Subir `--m-text-eyebrow` de 11 a 12 px ensancha cajas con
   `letter-spacing`, así que se volvió a medir: **0 palabras partidas** y **0 desbordamientos** en las
   9 combinaciones (3 páginas × 320/360/390 px).

## Lo que este pase deja en el trinquete

G4 en los dos temas (12 casos) y sus dos canarios. Y una lección para el digest:

> **Un gate incompleto tranquiliza igual que uno completo.** G4 medía el contraste de verdad, con sus
> dos canarios contra un instrumento roto… y era ciego a la mitad de la paleta. La pregunta que lo
> destapa no es «¿mide bien?» sino **«¿sobre qué universo mide?»** — y se responde buscando los ejes
> que el sitio declara y el gate no recorre: aquí, `prefers-color-scheme`; en otro sitio será el
> idioma, la impresión o el estado de sesión.
