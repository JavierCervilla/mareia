/**
 * **Ningún módulo del sitio construye una magnitud con un espacio que pueda romperse.**
 *
 * Medido en producción el 2026-08-31: a 360 px, **25 de las 31 filas** de la tabla del mes partían la
 * altura de su unidad —`3,33` arriba y `m` abajo— y a 390 px ninguna. Es el **ancho** el que decide,
 * así que esto no se ve leyendo el código ni el HTML: sólo midiendo, o poniendo este gate. Una cifra
 * y su unidad son **un solo dato**: «3,33» sin su «m» no dice nada, y peor, dice cosas distintas
 * según lo que el lector suponga.
 *
 * **Por qué mira el código y no el `dist/`.** Un gate sobre el HTML sería mejor —el artefacto es lo
 * que lee la gente— pero **nacería en rojo 1.453 veces**, y no por lo que arregla esta trayectoria:
 * el `dist/` publica hoy **1.218** «a 42,2 km de la dársena» que escribe el pipeline en Python,
 * **153** de la frase de Brest y **82 del literal del Real Decreto** («80 cm o 10 kg de peso»), que
 * se publica **verbatim** y no se toca ni para pegarle un espacio. Un gate que nace en rojo se
 * ignora; y uno que para nacer verde exigiera reescribir una cita legal estaría midiendo lo que no
 * debe.
 *
 * Así que **el alcance va dicho en vez de fingido**: esto cubre lo que formatea el TypeScript del
 * sitio, que es lo que T-26 arregló. Las **1.371** magnitudes que escribe el pipeline quedan
 * **medidas y anotadas** —hoy no se parten porque su frase tiene sitio— y son trabajo de otra
 * trayectoria, no un descuido callado.
 *
 * **Una limitación, dicha**: el detector no distingue una cadena que se publica de una que sólo vive
 * en un `Error`. La primera vez que enrojeció fue por el mensaje de una excepción de
 * `areas-protegidas.ts`, que no llega a ninguna página. Se pegó igual: enseñarle a distinguir el
 * destino de cada cadena lo volvería frágil, y el coste del falso positivo es **un carácter**.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

/** Las unidades que el sitio escribe detrás de una cifra. */
const UNIDADES = String.raw`km/h|hPa|°C|kB|km|cm|nm|m|s|%`;

/**
 * Una interpolación seguida de un espacio y una unidad: `` `${numero(x)} m` ``.
 *
 * Se busca el cierre de la interpolación y no «dígito espacio unidad» porque en el código la cifra
 * casi nunca es un literal: es el resultado de una función. Buscar el dígito encontraría sólo los
 * pocos casos escritos a mano y dejaría pasar justo los que importan.
 */
const MAGNITUD_SUELTA = new RegExp(String.raw`\} (${UNIDADES})(?![\w/])`, "u");

function ficherosDeCodigo(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) return ficherosDeCodigo(ruta);
    if (!entrada.name.endsWith(".ts") || entrada.name.endsWith(".test.ts")) return [];
    return [ruta];
  });
}

test("ningún módulo construye una magnitud con un espacio que pueda romperse", () => {
  const raiz = import.meta.dirname;
  const sueltas: string[] = [];
  for (const fichero of ficherosDeCodigo(raiz)) {
    for (const [indice, linea] of readFileSync(fichero, "utf8").split("\n").entries()) {
      if (MAGNITUD_SUELTA.test(linea)) {
        sueltas.push(`${fichero.slice(raiz.length + 1)}:${indice + 1} → ${linea.trim()}`);
      }
    }
  }
  assert.deepEqual(
    sueltas,
    [],
    "usa `conUnidad(cifra, unidad)` de formato.ts: una cifra y su unidad son un solo dato y no " +
      "deben poder quedar en líneas distintas",
  );
});

/**
 * **Sensibilidad**: que el detector vea de verdad la forma que persigue.
 *
 * Un gate que nadie ha visto fallar es una conjetura, y éste nace en verde — así que sin esto no
 * habría manera de saber si mide algo. Se le dan las dos formas que tiene que separar.
 */
test("el detector ve la magnitud suelta y no confunde la pegada", () => {
  assert.ok(
    MAGNITUD_SUELTA.test("  return `${numero(valor, 1)} km/h`;"),
    "el detector no ve una magnitud escrita con espacio normal: no está midiendo nada",
  );
  assert.ok(
    !MAGNITUD_SUELTA.test("  return `${numero(valor, 1)}\u00a0km/h`;"),
    "el detector denuncia una magnitud ya pegada",
  );
  assert.ok(
    !MAGNITUD_SUELTA.test("  const texto = `${nombre} sube con la marea`;"),
    "el detector denuncia una palabra que empieza por una letra de unidad",
  );
});
