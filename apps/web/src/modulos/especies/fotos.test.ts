/**
 * El lector de `fotos/v1` contra el contrato **enmendado**: `licenciaUrl` y `autor` son
 * condicionales, y las dos condiciones las declara la fuente en un campo que se publica.
 *
 * Este fichero existe por la enmienda del 2026-08-30. El contrato original exigía `licenciaUrl` en
 * toda foto, y eso dejó sin publicar 15 especies cuya única imagen es de **dominio público** —que
 * por definición no tiene condiciones, así que no hay URL de condiciones que enlazar—. La regla
 * nueva tiene dos mitades y las dos se comprueban aquí, porque una sin la otra no vale nada:
 *
 * 1. **Cuando la licencia tiene condiciones, `licenciaUrl` sigue siendo obligatoria y URL.** La
 *    excepción es del allowlist de dominio público y de nadie más: «sin URL» no es un pase libre.
 * 2. **Cuando no las tiene, `licenciaUrl` tiene que estar AUSENTE.** Ni `""`, ni `null`, ni
 *    presente. La ausencia obligatoria es a propósito: si en esa rama se admitiera una URL, sería
 *    el sitio exacto donde esconder una rota, porque nadie va a comprobar el enlace de una foto
 *    «que total, es de dominio público».
 *
 * Y `licenciaCodigo` es obligatorio **siempre**: es lo que hace que la excepción se pueda
 * comprobar en el artefacto en vez de confiarse. Sin él, quien lee el JSON no puede distinguir
 * «dominio público, no hay condiciones» de «se nos perdió la URL».
 *
 * La enmienda del 2026-08-31 repite el patrón con el crédito, y por eso vive en este mismo fichero:
 * `autor` puede faltar **sólo** cuando la foto declara `atribucionRequerida: false`, que es lo que
 * Commons publica de los dos ficheros de la NOAA que estaban detrás de los huecos del bacalao y de
 * las lisas. `atribucionRequerida` es obligatorio en toda foto y **booleano de verdad**, porque
 * `"false"` es un valor verdadero en JavaScript y la excepción no puede depender de eso. Y
 * `prestadaDe` —de qué otra especie es la foto, cuando la fila no puede ilustrarse con su taxón—
 * sólo se lee con un `tipo` que la ficha sepa rotular: una foto prestada muda es la imagen de otro
 * animal publicada bajo el nombre de éste.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { FotosMalFormadas, leerFotos } from "./fotos.ts";

/** Una foto con condiciones, tal como la publica la ingesta. */
const CON_CONDICIONES = {
  fichero: "File:Dicentrarchus labrax LoroParqueTenerife seabass IMG 4959.JPG",
  url: "https://upload.wikimedia.org/wikipedia/commons/5/5f/x.JPG",
  descripcion: "https://commons.wikimedia.org/wiki/File:x.JPG",
  autor: "Bjoertvedt",
  atribucionRequerida: true,
  licencia: "CC BY-SA 4.0",
  licenciaCodigo: "cc-by-sa-4.0",
  licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0",
  identificadaPor: { fuente: "Wikidata", entidad: "Q217129", propiedad: "P18" },
};

/** Una foto de dominio público: mismo crédito, **sin** URL de condiciones. */
const DOMINIO_PUBLICO = {
  fichero: "File:Belone belone1.jpg",
  url: "https://upload.wikimedia.org/wikipedia/commons/d/d2/Belone_belone1.jpg",
  descripcion: "https://commons.wikimedia.org/wiki/File:Belone_belone1.jpg",
  autor: "Krüger",
  atribucionRequerida: false,
  licencia: "Public domain",
  licenciaCodigo: "pd",
  identificadaPor: { fuente: "Wikidata", entidad: "Q643373", propiedad: "P18" },
};

/** Una foto que su fuente declara libre de atribución y de la que **no registra autor**. */
const SIN_AUTOR = {
  fichero: "File:Atlantic cod.jpg",
  url: "https://upload.wikimedia.org/wikipedia/commons/a/a3/Atlantic_cod.jpg",
  descripcion: "https://commons.wikimedia.org/wiki/File:Atlantic_cod.jpg",
  atribucionRequerida: false,
  licencia: "Public domain",
  licenciaCodigo: "pd",
  identificadaPor: { fuente: "Wikidata", entidad: "Q199788", propiedad: "P18" },
};

/**
 * El mismo objeto **sin uno de sus campos**: así se sabotea un contrato sin tocar nada más.
 *
 * Va en una función y no en un destructuring con variable tirada porque una variable que se asigna
 * para no usarla es justo lo que el linter anti-slop está para no dejar pasar.
 */
function sinElCampo(entrada: object, campo: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(entrada).filter(([nombre]) => nombre !== campo));
}

function documento(fotos: Record<string, unknown>): unknown {
  return { schema: "fotos/v1", consultadoEn: "2026-08-30", fotos, sinFoto: {} };
}

function leer(fotos: Record<string, unknown>) {
  return leerFotos(documento(fotos));
}

test("una foto de dominio público se lee sin URL de condiciones", () => {
  const leido = leerFotos(documento({ "belone-belone-ad6f1d": DOMINIO_PUBLICO }));
  assert.equal(leido.tipo, "ingerido");
  const entrada = leido.tipo === "ingerido" ? leido.porClave.get("belone-belone-ad6f1d") : undefined;
  assert.equal(entrada?.tipo, "dato");
  const foto = entrada?.tipo === "dato" ? entrada.valor : undefined;
  assert.equal(foto?.licenciaCodigo, "pd");
  assert.equal(foto?.licenciaUrl, undefined);
  // El autor y la licencia siguen siendo obligatorios: la promesa de F2 no se toca.
  assert.equal(foto?.autor, "Krüger");
  assert.equal(foto?.licencia, "Public domain");
});

test("una licencia con condiciones sigue necesitando su URL", () => {
  assert.throws(() => leer({ x: sinElCampo(CON_CONDICIONES, "licenciaUrl") }), FotosMalFormadas);
});

test("una URL de licencia vacía no cuela por ninguna de las dos ramas", () => {
  // Con condiciones: la cadena vacía es la forma en que un enlace desaparece sin que nada enrojezca.
  assert.throws(() => leer({ x: { ...CON_CONDICIONES, licenciaUrl: "" } }), FotosMalFormadas);
  // Dominio público: el campo tiene que estar AUSENTE, y `""` es estar presente.
  assert.throws(() => leer({ x: { ...DOMINIO_PUBLICO, licenciaUrl: "" } }), FotosMalFormadas);
});

test("el dominio público no puede traer URL de condiciones ni aunque sea válida", () => {
  assert.throws(
    () =>
      leer({
        x: { ...DOMINIO_PUBLICO, licenciaUrl: "https://creativecommons.org/publicdomain/mark/1.0/" },
      }),
    FotosMalFormadas,
  );
});

test("una foto sin «licenciaCodigo» no se lee: sin él la excepción no es comprobable", () => {
  assert.throws(() => leer({ x: sinElCampo(CON_CONDICIONES, "licenciaCodigo") }), FotosMalFormadas);
});

test("una foto cuya fuente no exige atribuir se lee sin autor", () => {
  const leido = leerFotos(documento({ "gadus-morhua-b06a04": SIN_AUTOR }));
  assert.equal(leido.tipo, "ingerido");
  const entrada = leido.tipo === "ingerido" ? leido.porClave.get("gadus-morhua-b06a04") : undefined;
  const foto = entrada?.tipo === "dato" ? entrada.valor : undefined;
  assert.equal(foto?.autor, undefined);
  assert.equal(foto?.atribucionRequerida, false);
});

test("una foto que exige atribuir y no dice de quién es no se lee", () => {
  // Es `File:Monkfish.jpg`: `cc-by-sa-3.0`, `AttributionRequired=true` y sin `Artist`. Publicarla
  // sin nombrar a nadie sería incumplir su licencia, no un descuido de forma.
  assert.throws(() => leer({ x: sinElCampo(CON_CONDICIONES, "autor") }), FotosMalFormadas);
});

test("un autor vacío no cuela por ninguna de las dos ramas de la atribución", () => {
  // Con atribución exigida: `autor: ""` pinta «Foto de  · CC BY-SA 4.0», que no atribuye a nadie.
  assert.throws(() => leer({ x: { ...CON_CONDICIONES, autor: "  " } }), FotosMalFormadas);
  // Y sin exigirla tampoco: si el campo está, tiene que decir algo.
  assert.throws(() => leer({ x: { ...SIN_AUTOR, autor: "" } }), FotosMalFormadas);
});

test("una foto sin «atribucionRequerida» no se lee: sin él la excepción no es comprobable", () => {
  assert.throws(() => leer({ x: sinElCampo(CON_CONDICIONES, "atribucionRequerida") }), FotosMalFormadas);
});

test("«atribucionRequerida» tiene que ser booleano, no la cadena «false»", () => {
  // `"false"` es un valor verdadero en JavaScript: admitir la cadena convertiría la condición en su
  // contraria justo donde decide si una foto se publica con crédito o sin él.
  assert.throws(
    () => leer({ x: { ...SIN_AUTOR, atribucionRequerida: "false" } }),
    FotosMalFormadas,
  );
});

test("una foto prestada se lee con de qué especie es y en qué fila la nombra la norma", () => {
  const prestada = {
    ...CON_CONDICIONES,
    prestadaDe: {
      tipo: "una_del_genero",
      nombre: "Lophius piscatorius",
      nombreBoe: "Lophius piscatorius, L. Budegassa",
    },
  };
  const leido = leerFotos(documento({ "lophius-spp-05f70d": prestada }));
  const entrada = leido.tipo === "ingerido" ? leido.porClave.get("lophius-spp-05f70d") : undefined;
  const foto = entrada?.tipo === "dato" ? entrada.valor : undefined;
  assert.equal(foto?.prestadaDe?.nombre, "Lophius piscatorius");
  assert.equal(foto?.prestadaDe?.nombreBoe, "Lophius piscatorius, L. Budegassa");
});

test("un préstamo de un tipo que la ficha no sabe rotular no se lee", () => {
  assert.throws(
    () =>
      leer({
        x: {
          ...CON_CONDICIONES,
          prestadaDe: { tipo: "la_que_mas_bonita", nombre: "X y", nombreBoe: "X y" },
        },
      }),
    FotosMalFormadas,
  );
});

test("un préstamo sin la fila del BOE que nombra la especie no se lee", () => {
  // Sin ella, «la elige la norma» es una afirmación nuestra sobre un texto que nadie puede ir a
  // comprobar, y entonces la elección la estaríamos haciendo nosotros.
  assert.throws(
    () =>
      leer({
        x: {
          ...CON_CONDICIONES,
          prestadaDe: { tipo: "una_del_genero", nombre: "Lophius piscatorius" },
        },
      }),
    FotosMalFormadas,
  );
});
