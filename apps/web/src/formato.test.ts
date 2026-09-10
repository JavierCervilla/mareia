/**
 * **T-34 · el formato del error, con las cifras escritas a mano.**
 *
 * Este fichero existe por una razón concreta y vale la pena dejarla dicha: el gate del `dist/`
 * (`error-en-listas-construido.test.ts`) deriva lo que espera **llamando a `errorDeLaPrediccion`**,
 * que es lo correcto —así no fija un formato paralelo que se desincronice— pero deja un hueco
 * exacto: si la función devolviera basura, los dos lados dirían la misma basura y el gate seguiría
 * verde. Aquí las cadenas están **escritas a mano**, que es la única forma de que alguien afirme el
 * formato en vez de reflejarlo.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { errorDeLaPrediccion } from "./formato.ts";

/** El espacio que pega la cifra a su unidad. Se escribe como escape: invisible en el fuente, no. */
const PEGADO = "\u00a0";

test("T-34 · el error se publica en centímetros redondeados, con su signo y su unidad pegada", () => {
  // Los dos extremos reales del catálogo: el mejor puerto medido y el peor.
  assert.equal(errorDeLaPrediccion(0.0359), `±4${PEGADO}cm`); // San Sebastián de la Gomera
  assert.equal(errorDeLaPrediccion(1.3424), `±134${PEGADO}cm`); // Puerto del Rosario

  // Redondeo al centímetro, no truncado: 5,5 cm sube.
  assert.equal(errorDeLaPrediccion(0.055), `±6${PEGADO}cm`);
  assert.equal(errorDeLaPrediccion(0.054), `±5${PEGADO}cm`);
});

test("T-34 · el espacio entre cifra y unidad no se puede romper", () => {
  // Si esto fuera un espacio normal, «±134 cm» podría partirse al final de una fila estrecha y
  // publicar un «±134» huérfano, que en un índice de mareas se lee como cualquier otra cosa.
  assert.ok(!errorDeLaPrediccion(1.3424).includes(" "), "el separador es un espacio normal");
  assert.ok(errorDeLaPrediccion(1.3424).includes(PEGADO), "falta el espacio pegado");
});

test("T-34 · un error de cero se publica como cero, y no se confunde con no tener medida", () => {
  // La distinción la sostiene el componente con `undefined`, pero si esta función devolviera algo
  // vacío para 0 la sostendría a medias. Un puerto con error inmedible **tiene** medida.
  assert.equal(errorDeLaPrediccion(0), `±0${PEGADO}cm`);
});
