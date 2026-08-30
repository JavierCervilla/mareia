/**
 * La frontera entre el disco y el catálogo: qué se rechaza al leer `especies/v1`, qué se traduce y
 * por qué.
 *
 * Se mide **contra el dataset publicado** (`data/especies/catalogo.json`) y no contra un fixture con
 * su forma. Hubo uno mientras los dos carriles de T-20 iban en paralelo y el dataset todavía no
 * existía; ahora existe, está commiteado y **ya lo leen los gates E1 y E4** desde
 * `especies-construido.test.ts`, así que un segundo fichero con la misma forma sólo sería una copia
 * de la que hay que acordarse cada vez que el pipeline cambie algo. Un derivado commiteado tampoco
 * cambia bajo los pies como cambia una API: cambia en un PR, y entonces lo que interesa es
 * precisamente que estos tests se pongan rojos y haya que mirar el diff.
 *
 * Lo que aquí se defiende no es el formato: es que **una fila a medias no llegue a la página**. Cada
 * `throws` es una manera concreta de publicar algo que no sabemos. Y desde que los dos carriles se
 * juntaron se defiende además la **traducción**: este fichero es el adaptador entre la forma que
 * publica el pipeline y la que consume el módulo, y una traducción equivocada no levanta ninguna
 * excepción — sencillamente publica otra cosa.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { censoDelCatalogo, SIN_REGISTROS } from "@mareia/module-species";

import { DATA_DIR } from "../../datos/deps.ts";
import { leerCatalogo } from "./catalogo.ts";

const DATASET = `${DATA_DIR}/especies/catalogo.json`;

/** El dataset recién parseado, para poder mutarlo sin que una prueba contamine a la siguiente. */
function crudo(): Record<string, unknown> {
  return JSON.parse(readFileSync(DATASET, "utf8")) as Record<string, unknown>;
}

/** Las especies del dataset, tipadas como lo que son al cruzar la frontera: `any`-menos. */
function especies(documento: Record<string, unknown>): Record<string, unknown>[] {
  return documento["especies"] as Record<string, unknown>[];
}

/** La primera especie del documento, que es con la que se hacen los sabotajes de forma. */
function primera(documento: Record<string, unknown>): Record<string, unknown> {
  const especie = especies(documento)[0];
  assert.ok(especie !== undefined, "el dataset no trae ninguna especie");
  return especie;
}

// =================================================================================================
// El dataset entero, y las cifras que salen de él
// =================================================================================================

test("el dataset se lee entero y trae las 86 especies que el BOE regula", () => {
  const catalogo = leerCatalogo(crudo());
  assert.equal(catalogo.schema, "especies/v1");
  assert.equal(catalogo.especies.length, 86);
  const censo = censoDelCatalogo(catalogo);
  // Las cifras medidas contra WoRMS, recontadas sobre el artefacto: 64 nombres del BOE resuelven
  // preguntándolos tal cual, 21 resuelven por una correspondencia nuestra —las 15 filas de género
  // más las 6 erratas de la norma que sí se mapean— y 1 no resuelve, la celda que nombra dos
  // especies. 64 + 21 + 1 = 86.
  assert.equal(censo.resueltasTalCual, 64);
  assert.equal(censo.porCorrespondenciaNuestra, 21);
  assert.equal(censo.sinResolver, 1);
  assert.equal(censo.conAceptadoDistinto, 11);
  assert.equal(censo.deGenero, 15);
  assert.equal(censo.caladeros.length, 3);
});

test("otro schema no se interpreta: se rechaza", () => {
  const documento = { ...crudo(), schema: "especies/v2" };
  assert.throws(() => leerCatalogo(documento), /\$\.schema debería ser "especies\/v1"/u);
});

// =================================================================================================
// La clave · dos filas de la norma no acaban en una
// =================================================================================================

test("dos especies con la misma clave son dos filas indistinguibles: rojo", () => {
  // No es hipotético: la norma escribe «Thunnus thynnus» en los anexos I y II y «Thunnus Thynnus»
  // en el III, y cualquier slug en minúsculas los colapsa. Sin esta comprobación, el gate E1
  // encuentra siempre la primera fila y la segunda podría publicarse a medias en verde.
  const documento = crudo();
  const [una, otra] = especies(documento);
  assert.ok(una !== undefined && otra !== undefined);
  otra["clave"] = una["clave"];
  assert.throws(() => leerCatalogo(documento), /repite la clave/u);
});

test("las dos grafías del atún llegan como dos filas con dos claves", () => {
  const catalogo = leerCatalogo(crudo());
  const claves = catalogo.especies
    .filter((especie) => especie.nombreBoe.toLowerCase() === "thunnus thynnus")
    .map((especie) => especie.clave);
  assert.equal(claves.length, 2);
  assert.notEqual(claves[0], claves[1]);
  // Y ninguna clave del catálogo se confunde con otra ni comparándolas en minúsculas, que es lo que
  // hace un selector de atributo con `i` o un sistema de ficheros descuidado.
  const todas = catalogo.especies.map((especie) => especie.clave.toLowerCase());
  assert.equal(new Set(todas).size, todas.length);
});

// =================================================================================================
// Lo que no se publica a medias
// =================================================================================================

test("una especie sin taxón y sin motivo no se publica", () => {
  const documento = crudo();
  primera(documento)["taxon"] = { resuelto: false };
  assert.throws(() => leerCatalogo(documento), /no trae taxón de WoRMS y tampoco el motivo/u);
});

test("una especie que dice no resolver y trae el registro que lo desmiente, tampoco", () => {
  const documento = crudo();
  const especie = primera(documento);
  const taxon = especie["taxon"] as Record<string, unknown>;
  especie["taxon"] = { ...taxon, resuelto: false, motivo: "no resuelve" };
  assert.throws(() => leerCatalogo(documento), /trae el AphiaID .* lo desmiente/u);
});

test("una especie a la que no regula ningún caladero no sale de la norma: rojo", () => {
  const documento = crudo();
  primera(documento)["caladeros"] = [];
  assert.throws(() => leerCatalogo(documento), /no la regula ningún caladero/u);
});

test("un caladero sin ninguna talla no tiene nada que hacer en la fila: rojo", () => {
  // El catálogo son exactamente las especies a las que la norma les fija una talla, así que un
  // caladero que aparece sin ninguna es un caladero que no regula esa especie.
  const documento = crudo();
  const caladeros = primera(documento)["caladeros"] as Record<string, unknown>[];
  caladeros[0]!["tallas"] = [];
  assert.throws(() => leerCatalogo(documento), /un caladero está en la fila porque le fija/u);
});

test("un rango taxonómico que el dataset no usa no se publica", () => {
  // La unión son los cuatro rangos medidos —especie, género, familia y subespecie— y no un texto
  // libre: si un día llegara «orden», la fila publicaría un alcance que nadie ha comprobado.
  const documento = crudo();
  const taxon = primera(documento)["taxon"] as Record<string, unknown>;
  taxon["rango"] = "orden";
  assert.throws(() => leerCatalogo(documento), /solo puede ser especie o genero/u);
});

test("sin los rectángulos de OBIS, ninguna cifra de presencia se puede interpretar: rojo", () => {
  const documento = crudo();
  documento["recortes"] = {};
  assert.throws(() => leerCatalogo(documento), /sin el rectángulo con el que se consultó OBIS/u);
});

// =================================================================================================
// La traducción · lo que decide el adaptador
// =================================================================================================

test("un CERO registros no se publica como cifra: llega como la ausencia que es", () => {
  // El dataset publica los recuentos tal y como los devolvió OBIS, ceros incluidos. Un `0`
  // publicado como número se lee como «aquí no hay esa especie», que es justo lo que OBIS no puede
  // afirmar: lo que mide es si alguien fue a mirar y lo anotó.
  const catalogo = leerCatalogo(crudo());
  const centollo = catalogo.especies.find((especie) => especie.nombreBoe === "Maja squinado");
  const cantabrico = centollo?.caladeros.find(
    (caladero) => caladero.id === "cantabrico-noroeste-y-golfo-de-cadiz",
  );
  assert.equal(cantabrico?.presencia, null);
  assert.equal(cantabrico?.presenciaAusente, null, "sí se preguntó: la respuesta fue cero");
  const ceros = catalogo.especies.flatMap((especie) =>
    especie.caladeros.filter(
      (caladero) => caladero.presencia === null && caladero.presenciaAusente === null,
    ),
  );
  assert.equal(ceros.length, 9);
  assert.match(SIN_REGISTROS, /nadie lo ha anotado/u);
});

test("no haber preguntado a OBIS viaja aparte del cero, porque no es lo mismo", () => {
  // `Lophius piscatorius, L. Budegassa` nombra dos especies en una celda y no se le pregunta a
  // WoRMS, así que tampoco hay taxón por el que preguntarle a OBIS. Publicar «nadie lo ha anotado
  // ahí» sería afirmar de la fuente algo que no hemos comprobado.
  const catalogo = leerCatalogo(crudo());
  const rape = catalogo.especies.find(
    (especie) => especie.nombreBoe === "Lophius piscatorius, L. Budegassa",
  );
  assert.equal(rape?.worms, null);
  assert.match(rape?.sinResolver ?? "", /dos especies/u);
  assert.equal(rape?.caladeros[0]?.presencia, null);
  assert.match(rape?.caladeros[0]?.presenciaAusente ?? "", /no se pregunta a OBIS/u);
});

test("una cifra que se contradice a sí misma sí se rechaza: registros de 0 conjuntos de datos", () => {
  const documento = crudo();
  const caladeros = primera(documento)["caladeros"] as Record<string, unknown>[];
  const presencia = caladeros[0]!["presencia"] as Record<string, unknown>;
  presencia["datasets"] = 0;
  assert.throws(() => leerCatalogo(documento), /debería ser un entero mayor que cero/u);
});

test("la firma de una correspondencia nuestra llega SIN traducir, como la escribe el dataset", () => {
  // El adaptador renombra campos y no reescribe valores: `mareia` es quien firma ese mapeo, y
  // convertirlo en un «nuestro» más cómodo publicaría una firma que no ha estampado nadie.
  const catalogo = leerCatalogo(crudo());
  const errata = catalogo.especies.find((especie) => especie.nombreBoe === "Cáncer pagurus");
  assert.equal(errata?.worms?.origen, "mareia");
  assert.match(errata?.worms?.comoSeLlego ?? "", /el latín no lleva la tilde/u);
  const literal = catalogo.especies.find((especie) => especie.nombreBoe === "Boops boops");
  assert.equal(literal?.worms?.origen, "worms");
  assert.equal(literal?.worms?.comoSeLlego, null, "el nombre de la norma resolvió tal cual");
});

test("el nombre aceptado sólo viaja cuando DIFIERE del de la norma", () => {
  // El dataset publica el aceptado siempre que WoRMS lo dé, también en las 74 filas en que es el
  // mismo binomio. Repetirlo en la página perdería las 11 que de verdad difieren entre 74 celdas
  // idénticas, así que el adaptador lo deja en `null` cuando coincide.
  const catalogo = leerCatalogo(crudo());
  const distinto = catalogo.especies.find((especie) => especie.nombreBoe === "Solea vulgaris");
  assert.equal(distinto?.worms?.aceptado?.nombre, "Solea solea");
  const mismo = catalogo.especies.find((especie) => especie.nombreBoe === "Boops boops");
  assert.equal(mismo?.worms?.nombre, "Boops boops");
  assert.equal(mismo?.worms?.aceptado, null);
  assert.equal(catalogo.especies.filter((especie) => especie.worms?.aceptado != null).length, 11);
});

test("las tallas cuelgan de su caladero y la presencia es UNA, como en el dataset", () => {
  // La cigala tiene dos tallas en el mismo anexo —2 cm de cefalotórax y 7 de longitud total— y un
  // solo recuento de OBIS. Con una entrada por talla, ese recuento se publicaría dos veces en la
  // misma fila, que es una invitación a sumarlos.
  const catalogo = leerCatalogo(crudo());
  const cigala = catalogo.especies.find((especie) => especie.nombreBoe === "Nephrops norvegicus");
  const cantabrico = cigala?.caladeros.find(
    (caladero) => caladero.id === "cantabrico-noroeste-y-golfo-de-cadiz",
  );
  assert.deepEqual(
    cantabrico?.tallas.map((talla) => [talla.medida, talla.talla]),
    [
      ["Longitud cefalotórax", { tipo: "longitud_cm", cm: 2 }],
      ["Longitud total", { tipo: "longitud_cm", cm: 7 }],
    ],
  );
  assert.equal(cigala?.caladeros.filter((caladero) => caladero.id === cantabrico?.id).length, 1);
});

test("los rectángulos se aplanan con su caladero dentro, y hay caladeros con varios", () => {
  // El caladero cantábrico-noroeste-golfo de Cádiz se consulta con tres rectángulos: uno solo que
  // fuera del Cantábrico a Cádiz se tragaría el mar de Alborán, que es de otro caladero.
  const { criterio } = leerCatalogo(crudo());
  const delCantabrico = criterio.cajas.filter(
    (caja) => caja.caladero === "cantabrico-noroeste-y-golfo-de-cadiz",
  );
  assert.deepEqual(
    delCantabrico.map((caja) => caja.nombre),
    ["Cantábrico", "Noroeste (fachada atlántica gallega)", "Golfo de Cádiz"],
  );
  assert.equal(criterio.cajas.length, 6);
});
