/**
 * Cómo se escribe una distancia y un tipo, que es donde esta sección puede mentir sin que se note.
 *
 * Los dos criterios que se miden aquí y no en la plantilla: que la distancia salga siempre como
 * **cota entera** —nunca como la décima del derivado, que se leería como una medida— y que ninguna
 * sigla llegue a la página sin glosa.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { glosaDeTipo, ningunaCerca, tituloDeLaSeccion } from "../textos.ts";
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
  // 8,7 medidos al vértice: la real es menor, así que «a menos de 9» es verdad. «Unos 9 km» sería
  // una medida que no tenemos y «8,7 km» una precisión que el método no da.
  assert.equal(distanciaEscrita(8.7), "a menos de 9 km");
  assert.equal(distanciaEscrita(19.1), "a menos de 20 km");
  assert.equal(distanciaEscrita(29.8), "a menos de 30 km");
  // Un entero exacto no se infla: 12,0 km al vértice siguen siendo menos de 12 hasta el borde.
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
  const dentro = proximidadDeArea(area({ distanciaAproxKm: 0, dentro: true }));
  assert.equal(dentro.dentro, true);
  assert.equal(dentro.texto, "a menos de 1 km");
  assert.match(dentro.explicacion ?? "", /cae dentro de esta área/u);
  // Y lo que NO dice: qué implica. Eso está en la declaración oficial del espacio y no aquí.
  assert.match(dentro.explicacion ?? "", /declaración oficial/u);

  const fuera = proximidadDeArea(area({ distanciaAproxKm: 3.2 }));
  assert.equal(fuera.dentro, false);
  assert.equal(fuera.explicacion, null, "sin «dentro» no hay nada de más que decir");
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
  const filas = filasDeAreas([
    area({ codigo: "A", distanciaAproxKm: 1.2 }),
    area({ codigo: "B", distanciaAproxKm: 8.7, tipo: "RESERVA MARINA" }),
    area({ codigo: "C", distanciaAproxKm: 19.1 }),
  ]);
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
    () => filasDeAreas([area({ codigo: "A", distanciaAproxKm: 9 }), area({ codigo: "B", distanciaAproxKm: 2 })]),
    /desordenadas/u,
  );
  assert.throws(
    () => filasDeAreas([area({ codigo: "A" }), area({ codigo: "A", distanciaAproxKm: 4 })]),
    /viene dos veces/u,
  );
});

test("el radio se publica redondeado hacia ABAJO: dice hasta dónde se miró, y eso es una cota inferior", () => {
  assert.equal(tituloDeLaSeccion(30), "Áreas marinas protegidas a menos de 30 km");
  assert.equal(ningunaCerca(30), "Ninguna a menos de 30 km de este puerto.");
  // Con un criterio de 30,5 km, «31» prometería un kilómetro que nadie recorrió.
  assert.equal(tituloDeLaSeccion(30.5), "Áreas marinas protegidas a menos de 30 km");
});
