# Informe adversario — las observaciones del día (T-22-A)

- **Trayectoria:** T-22-A · **PR:** #31 (`claude/T-22-A-observaciones`) · **Fecha:** 2026-09-02
- **Superficie atacada:** el gate **T3** (`apps/web/src/observaciones-construido.test.ts`), el censo
  **T2** (`packages/modules/fishing/src/__tests__/observaciones.test.ts`), las cinco reglas y la
  sección publicada, sobre el sitio **construido**.
- **Entorno:** local y efímero — `pnpm build` + `node --test` sobre `apps/web/dist/`. Sin cloud.
- **Ejecutor:** el orquestador **a mano** (el rol `qa-adversario` sigue caído por cupo). Se dice
  porque un informe que no diga quién lo firmó vale menos.
- **Reproducciones:** los propios gates, con el `dist/` manipulado. Los recorridos que encontraron el
  fallo **se quedan dentro** como trinquete.

## Promesa atacada

> «Ninguna frase se publica en la superficie de observaciones sin que la regla que dice haberla
> producido la produzca de verdad.»

No se ataca el razonamiento del diff: se ataca **esa frase**.

## Clases atacadas

| Clase | Hipótesis (entrada concreta) | Resultado |
|---|---|---|
| **A11** · gate atado a la forma | El patrón de T3 exigía el orden `class`, `data-regla`, `data-entradas`. ¿Y si se reordenan? | 🔴 **roto** → **A-T22A-1** |
| **A8** · alcance del oráculo | T3 recorre `mareas/*/*/*/`. ¿Publica observaciones alguna otra familia? | 🟢 aguantó — **153 publican, 153 cubiertas** |
| **A2** · escape por omisión | Un nodo con `data-regla` y **sin** `data-entradas`: nada que recomputar | 🟢 aguantó — `leerEntradas` levanta con `null` |
| **A6** · input hostil al lector | `data-entradas` de otra regla; un campo `string` donde va `number` | 🟢 aguantó — `EntradasIlegiblesError`, probado en el package |
| **A5** · límites | Día sin pleamares · curva plana · sin orto/ocaso · franja de menos de 30 min | 🟢 aguantó — las reglas devuelven `null`, y eso se publica como «hoy ninguna regla encuentra nada» |
| **A3** · instrumento ciego | ¿Puede T3 estar verde por no medir a nadie? | 🟡 **parcial** — el umbral `> 100` no cubría la medición parcial; ver A-T22A-1 |
| **A9** · el gate lee lo que vigila | ¿Recomputa T3 con el mismo objeto que publicó, en vez de con el HTML? | 🟢 aguantó — el JSON viaja por el atributo y se re-parsea |
| **A1** · la frontera del slop | ¿Puede una regla acabar prometiendo un beneficio? | 🟢 aguantó — test sobre el texto producido, con diez palabras vetadas |

## Hallazgo

### A-T22A-1 · Reordenar tres atributos deja publicar «se pesca de miedo» con T3 en verde

**Reproducción.** En `dist/mareas/andalucia/cadiz/cadiz/index.html`, sobre el punto de
`rango-del-dia`: se reordenan sus atributos —`data-regla`, `data-entradas`, `class`, todos presentes
y correctos— y se sustituye el texto por **«Hoy la marea sube un montón y se pesca de miedo»**. La
suite entera de `web` sigue en **312 pass, 0 fail**.

**Por qué es grave y no cosmético.** La frase falsificada es *exactamente* lo que esta trayectoria
existe para impedir: una **promesa de beneficio** en la superficie que el tipo, el censo y el
trinquete blindan. Y no hacía falta tocar ni la procedencia ni las entradas: bastó con **cambiar el
orden del marcado**, que es lo que hace cualquier refactor de plantilla.

**El mecanismo, que es el hallazgo.** El patrón de T3 definía su universo por la **forma** del
marcado. Un nodo que no casa no es un nodo que falla: es un nodo **invisible**, y un gate no denuncia
lo que no ve. Es el tercer caso de la misma familia en cuatro trayectorias — el `filaDe` de **T-27**
que exigía `data-especie` como primer atributo, y el `.portada__enlace` de **T-30** que ataba el
arreglo al nombre de una instancia.

**Y el canario tampoco lo cazó**, que es la mitad interesante. T3 nació con cobertura… pero contra un
**umbral** (`> 100`). Con 764 nodos medidos de 765, pasaba holgadamente. *Un umbral sólo caza que el
instrumento se quede a cero; no caza que mida a casi todos.*

**Arreglo, en dos piezas y ninguna sobra.**

1. El `<li>` se localiza **por su atributo, en cualquier orden**, y los dos `data-` se leen del tag.
2. **El canario deja de ser un umbral y pasa a comparar contra los sujetos**: los nodos se cuentan
   aparte, con otro patrón (`data-regla="` sobre el HTML crudo), y T3 exige
   `medidos === sujetos`. Contar los sujetos con el mismo patrón que se vigila no cuenta nada.

La pieza 1 sola habría cerrado *este* ataque y dejado abierto el siguiente; la pieza 2 es la que
convierte «el patrón casa» en una propiedad comprobada. Verificado: con el ataque todavía en el
`dist/`, T3 pasa a **rojo**.

## No reproducidos (dichos, no escondidos)

- **La superficie mide sólo páginas de puerto.** Hoy es exacto —153 de 153—, pero si mañana otra
  familia publicase observaciones, el `globSync` de T3 no llegaría. No se generaliza ahora porque no
  hay una segunda familia: sería un camino sin ejercitar (T-29). Queda dicho aquí.
- **El censo publica un número, no dos.** Es una desviación consciente de la spec, argumentada en el
  componente y en el CHANGELOG: no hay página de metodología (A-3 de T-09) y `reglas_con_golden` es
  un hecho de los tests que producción no puede derivar. La propiedad se conserva encadenando con T2.
- **Q5 abierta**: el nombre de la superficie lo decide el humano; va en una constante.

## Veredicto

**Un hallazgo, reproducido en rojo y arreglado**, con su recorrido dentro como trinquete.

Lo que confirma este pase es la misma lección que T-30 dejó escrita, y que **volvió a costar aquí**:
todo el rigor se puso en **cómo** mide T3 —recomputa de verdad, valida las entradas, no lee el token
que vigila— y el agujero estaba en **a quién** mide. La pregunta que lo destapa no es «¿mide bien?»
sino **«¿mide a todos?»**, y la respuesta no puede ser un umbral.
