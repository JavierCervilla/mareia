/**
 * La frontera entre el disco y el catálogo: qué se rechaza al leer `especies/v1` y por qué.
 *
 * Se mide contra el **fixture** (`fixtures/catalogo.json`) y no contra el dataset de producción, por
 * lo mismo que la meteo: un test que lee el derivado real se pone rojo cuando cambia la fuente, que
 * es justo cuando hace falta que siga siendo verde para poder mirar el diff. El fixture tiene la
 * misma forma y el mismo tamaño —86 especies, las mismas que el BOE regula—, y dice en su README
 * qué parte suya es real y cuál sintética.
 *
 * Lo que estos tests defienden no es el formato: es que **una fila a medias no llegue a la página**.
 * Cada `throws` de aquí es una manera concreta de publicar algo que no sabemos.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { censoDelCatalogo } from "@mareia/module-species";

import { leerCatalogo } from "./catalogo.ts";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "catalogo.json");

/** El fixture recién parseado, para poder mutarlo sin que una prueba contamine a la siguiente. */
function crudo(): Record<string, unknown> {
  return JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, unknown>;
}

/** Las especies del fixture, tipadas como lo que son al cruzar la frontera: `any`-menos. */
function especies(documento: Record<string, unknown>): Record<string, unknown>[] {
  return documento["especies"] as Record<string, unknown>[];
}

test("el fixture se lee entero y trae las 86 especies que el BOE regula", () => {
  const catalogo = leerCatalogo(crudo());
  assert.equal(catalogo.schema, "especies/v1");
  assert.equal(catalogo.especies.length, 86);
  const censo = censoDelCatalogo(catalogo);
  // Las cifras del plan de T-20, medidas contra WoRMS: 64 resuelven con el nombre de la norma, 15
  // son un género que se resuelve con una correspondencia nuestra y 7 son grafías del propio BOE
  // que no resuelven. 64 + 15 + 7 = 86.
  assert.equal(censo.resueltasTalCual, 64);
  assert.equal(censo.porCorrespondenciaNuestra, 15);
  assert.equal(censo.sinResolver, 7);
  assert.equal(censo.conAceptadoDistinto, 10);
  assert.equal(censo.deGenero, 15);
  assert.equal(censo.caladeros.length, 3);
});

test("otro schema no se interpreta: se rechaza", () => {
  const documento = { ...crudo(), schema: "especies/v2" };
  assert.throws(() => leerCatalogo(documento), /\$\.schema debería ser "especies\/v1"/u);
});

test("dos especies con la misma clave son dos filas indistinguibles: rojo", () => {
  // No es hipotético: la norma escribe «Thunnus thynnus» en los anexos I y II y «Thunnus Thynnus»
  // en el III, y cualquier slug en minúsculas los colapsa. Sin esta comprobación, el gate E1
  // encuentra siempre la primera fila y la segunda podría publicarse a medias en verde.
  const documento = crudo();
  const [primera, segunda] = especies(documento);
  assert.ok(primera !== undefined && segunda !== undefined);
  segunda["clave"] = primera["clave"];
  assert.throws(() => leerCatalogo(documento), /repite la clave/u);
});

test("una especie sin taxón y sin motivo no se publica", () => {
  const documento = crudo();
  const primera = especies(documento)[0];
  assert.ok(primera !== undefined);
  primera["worms"] = null;
  primera["sinResolver"] = null;
  assert.throws(() => leerCatalogo(documento), /no trae taxón de WoRMS y tampoco el motivo/u);
});

test("una especie que dice no resolver y trae el registro que lo desmiente, tampoco", () => {
  const documento = crudo();
  const primera = especies(documento)[0];
  assert.ok(primera !== undefined);
  primera["sinResolver"] = "no resuelve";
  assert.throws(() => leerCatalogo(documento), /a la vez un motivo de que no resuelve/u);
});

test("una especie a la que no regula ningún caladero no sale de la norma: rojo", () => {
  const documento = crudo();
  const primera = especies(documento)[0];
  assert.ok(primera !== undefined);
  primera["caladeros"] = [];
  assert.throws(() => leerCatalogo(documento), /no la regula ningún caladero/u);
});

test("un CERO registros no se lee: sin registros, la presencia es una ausencia con motivo", () => {
  // Un `0` publicado como cifra se lee como «aquí no hay esa especie», que es exactamente lo que
  // OBIS no puede afirmar: lo que mide es si alguien fue a mirar y lo anotó.
  const documento = crudo();
  const caladeros = especies(documento)[0]?.["caladeros"] as Record<string, unknown>[];
  const primero = caladeros[0];
  assert.ok(primero !== undefined);
  primero["presencia"] = { registros: 0, datasets: 1, desde: 2014, hasta: 2020 };
  assert.throws(() => leerCatalogo(documento), /debería ser un entero mayor que cero/u);
});

test("un rango taxonómico que no es especie ni género no se publica", () => {
  const documento = crudo();
  const worms = especies(documento)[0]?.["worms"] as Record<string, unknown>;
  worms["rango"] = "subespecie";
  assert.throws(() => leerCatalogo(documento), /solo puede ser especie o genero/u);
});

test("sin las cajas envolventes, ninguna cifra de presencia se puede interpretar: rojo", () => {
  const documento = crudo();
  documento["criterio"] = { cajas: [] };
  assert.throws(() => leerCatalogo(documento), /sin la caja con la que se consultó OBIS/u);
});
