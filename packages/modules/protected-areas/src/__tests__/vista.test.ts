/**
 * Cómo se escribe una distancia y un tipo, que es donde esta sección puede mentir sin que se note.
 *
 * Los dos criterios que se miden aquí y no en la plantilla: que la distancia salga siempre como
 * **cota entera** —nunca como la décima del derivado, que se leería como una medida— y que ninguna
 * sigla llegue a la página sin glosa.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  glosaDeTipo,
  hastaDondeSeHaMirado,
  ningunaCerca,
  NO_AUTORIZA_A_PESCAR,
  tituloDeLaSeccion,
} from "../textos.ts";
import type { AreaProtegida, TipoDeArea } from "../tipos.ts";
import { distanciaEscrita, filasDeAreas, proximidadDeArea } from "../vista.ts";

function area(parcial: Partial<AreaProtegida> = {}): AreaProtegida {
  return {
    nombre: "Espacio marino de Tabarca",
    tipo: "ZEPA",
    codigo: "ES0000214",
    distanciaAproxKm: 1.2,
    dentro: false,
    ...parcial,
  };
}

test("la distancia se publica como cota entera hacia ARRIBA, no como la décima del dato", () => {
  // 8,7 al borde, ya redondeados hacia arriba en el dato: «a menos de 9» es verdad. «Unos 9 km»
  // sería una medida que no tenemos y «8,7 km» una precisión que el método no da.
  assert.equal(distanciaEscrita(8.7), "a menos de 9 km");
  assert.equal(distanciaEscrita(19.1), "a menos de 20 km");
  assert.equal(distanciaEscrita(29.8), "a menos de 30 km");
  // Un entero exacto no se infla: 12,0 km al borde son «a menos de 12», no «a menos de 13».
  assert.equal(distanciaEscrita(12), "a menos de 12 km");
});

test("por debajo del kilómetro todas dicen lo mismo, que es lo único afirmable", () => {
  assert.equal(distanciaEscrita(0), "a menos de 1 km");
  assert.equal(distanciaEscrita(0.1), "a menos de 1 km");
  assert.equal(distanciaEscrita(0.9), "a menos de 1 km");
  assert.equal(distanciaEscrita(1), "a menos de 1 km");
});

test("una distancia ilegible o negativa levanta: no se publica media advertencia", () => {
  // Un `NaN` que llegara a la plantilla publicaría «a menos de NaN km» en la página de un puerto.
  assert.throws(() => distanciaEscrita(Number.NaN), /ilegible/u);
  assert.throws(() => distanciaEscrita(Number.POSITIVE_INFINITY), /ilegible/u);
  assert.throws(() => distanciaEscrita(-1), /ilegible/u);
});

test("«dentro» es un hecho distinto y se dice con sus palabras, no como una distancia corta", () => {
  const dentro = proximidadDeArea(area({ distanciaAproxKm: 0, dentro: true }), 30);
  assert.equal(dentro.dentro, true);
  assert.match(dentro.explicacion ?? "", /cae dentro de esta área/u);
  // Y lo que NO dice: qué implica. Eso está en la declaración oficial del espacio y no aquí.
  assert.match(dentro.explicacion ?? "", /declaración oficial/u);

  const fuera = proximidadDeArea(area({ distanciaAproxKm: 3.2 }), 30);
  assert.equal(fuera.dentro, false);
  assert.equal(fuera.texto, "a menos de 4 km");
  assert.equal(fuera.explicacion, null, "sin «dentro» no hay nada de más que decir");
});

// =================================================================================================
// H-3 · ninguna fila puede contradecir el título de su propia sección
// =================================================================================================

test("cuando el puerto cae dentro NO se publica cota: la del borde contradiría al título", () => {
  // El caso legítimo que documenta `criterio.dentro`: puerto muy metido en un área muy grande,
  // cuyo borde queda más allá del radio. La distancia mide entonces lo metido que está el puerto,
  // no lo lejos que está el área, y bajo «a menos de 30 km» se lee como su contrario.
  const muyDentro = proximidadDeArea(area({ distanciaAproxKm: 480, dentro: true }), 30);
  assert.equal(muyDentro.texto, null, "una fila «dentro» no publica cota");
  assert.match(muyDentro.explicacion ?? "", /cae dentro de esta área/u);
  // Y también en el caso de hoy, en el que las 10 relaciones con `dentro` están a 0,1 km o menos:
  // la cota que se deja de publicar decía «a menos de 1 km» y no añadía nada al hecho.
  assert.equal(proximidadDeArea(area({ distanciaAproxKm: 0.1, dentro: true }), 30).texto, null);
});

test("una cota mayor que el radio LEVANTA: media advertencia es peor que ninguna", () => {
  // Es lo que el pase adversario publicó en Alicante —«a menos de 480 km» bajo un rótulo de 30—
  // con `dentro: true`, que en el pipeline apagaba la única comprobación numérica del radio. Aquí
  // no hay interruptor: fuera del área, la cota no puede pasar del radio que el título promete.
  assert.throws(
    () => proximidadDeArea(area({ distanciaAproxKm: 480 }), 30),
    /contradiría al rótulo/u,
  );
  // Justo en el borde del radio sí se publica: 29,8 km al borde son «a menos de 30 km».
  assert.equal(proximidadDeArea(area({ distanciaAproxKm: 29.8 }), 30).texto, "a menos de 30 km");
  // Y el que se pasa por un kilómetro tampoco cuela: el gate no tiene margen de cortesía.
  assert.throws(() => proximidadDeArea(area({ distanciaAproxKm: 30.1 }), 30), /contradiría/u);
  // El radio manda, no la constante: con un criterio de 50 km la misma fila se publica.
  assert.equal(proximidadDeArea(area({ distanciaAproxKm: 30.1 }), 50).texto, "a menos de 31 km");
});

test("y la fila fuera de radio levanta también al componer la lista entera", () => {
  // Que la comprobación viva en `proximidadDeArea` no basta: lo que la plantilla llama es
  // `filasDeAreas`, así que el camino que de verdad se recorre es éste.
  assert.throws(
    () => filasDeAreas([area({ codigo: "A", distanciaAproxKm: 480 })], 30),
    /contradiría al rótulo/u,
  );
});

// =================================================================================================
// H-1 · la regla dura es nuestra y no del dato
// =================================================================================================

test("la regla dura y el «hasta dónde hemos mirado» son constantes del módulo", () => {
  // No se comprueba que «suene bien»: se comprueba que existan como texto del código, porque el
  // hallazgo H-1 fue justo que no existían —llegaban de dos campos de texto libre del derivado— y
  // que lo único que los miraba eran ocho expresiones regulares en un test de la web.
  assert.match(NO_AUTORIZA_A_PESCAR, /no autoriza a pescar/u);
  assert.match(NO_AUTORIZA_A_PESCAR, /dónde NO se puede, nunca dónde sí/u);
  assert.equal(
    hastaDondeSeHaMirado(30),
    "ninguna área marina protegida de RAMPE 2025 tiene su borde a menos de 30 km de este puerto, " +
      "y el puerto tampoco cae dentro de ninguna. No mirar más lejos es una decisión nuestra, no " +
      "una ausencia de la fuente.",
  );
  // El radio no se teclea dentro de la frase: si el criterio cambia, la frase cambia con él.
  assert.match(hastaDondeSeHaMirado(12), /a menos de 12 km/u);
});

test("las cinco figuras de la fuente tienen glosa, y una sexta no compilaría", () => {
  assert.equal(glosaDeTipo("ZEPA"), "Zona de Especial Protección para las Aves");
  assert.equal(glosaDeTipo("ZEC"), "Zona Especial de Conservación");
  assert.equal(glosaDeTipo("AMP"), "Área Marina Protegida");
  assert.match(glosaDeTipo("ZEC/AMP") ?? "", /y Área Marina Protegida a la vez/u);
  // La única sin glosa, a propósito: la fuente ya la escribe en palabras y repetirla es ruido.
  assert.equal(glosaDeTipo("RESERVA MARINA"), null);
  // Ninguna glosa se mete a decir qué se puede hacer dentro: eso sería redactar derecho.
  for (const tipo of ["ZEPA", "ZEC", "AMP", "ZEC/AMP"] as const satisfies readonly TipoDeArea[]) {
    assert.ok(!/prohib|permit|pesca|veda/iu.test(glosaDeTipo(tipo) ?? ""), tipo);
  }
});

test("las filas se publican en el orden en que llegan: proximidad, y aquí no se reordena", () => {
  const filas = filasDeAreas(
    [
      area({ codigo: "A", distanciaAproxKm: 1.2 }),
      area({ codigo: "B", distanciaAproxKm: 8.7, tipo: "RESERVA MARINA" }),
      area({ codigo: "C", distanciaAproxKm: 19.1 }),
    ],
    30,
  );
  assert.deepEqual(
    filas.map((fila) => [fila.clave, fila.proximidad.texto]),
    [
      ["A", "a menos de 2 km"],
      ["B", "a menos de 9 km"],
      ["C", "a menos de 20 km"],
    ],
  );
  // La reserva marina no sube ni baja por ser «más interesante»: sigue en su sitio por distancia.
  assert.equal(filas[1]?.tipo, "RESERVA MARINA");
  assert.equal(filas[1]?.glosa, null);
});

test("un dato desordenado o con códigos repetidos levanta, no se arregla en silencio", () => {
  assert.throws(
    () =>
      filasDeAreas(
        [area({ codigo: "A", distanciaAproxKm: 9 }), area({ codigo: "B", distanciaAproxKm: 2 })],
        30,
      ),
    /desordenadas/u,
  );
  assert.throws(
    () => filasDeAreas([area({ codigo: "A" }), area({ codigo: "A", distanciaAproxKm: 4 })], 30),
    /viene dos veces/u,
  );
});

test("el radio se publica redondeado hacia ABAJO: dice hasta dónde se miró, y eso es una cota inferior", () => {
  assert.equal(tituloDeLaSeccion(30), "Áreas marinas protegidas a menos de 30 km");
  assert.equal(ningunaCerca(30), "Ninguna a menos de 30 km de este puerto.");
  // Con un criterio de 30,5 km, «31» prometería un kilómetro que nadie recorrió.
  assert.equal(tituloDeLaSeccion(30.5), "Áreas marinas protegidas a menos de 30 km");
});
