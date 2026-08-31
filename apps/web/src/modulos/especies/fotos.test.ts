/**
 * El lector de `fotos/v1` contra el contrato **enmendado**: `licenciaUrl` es condicional.
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
  licencia: "Public domain",
  licenciaCodigo: "pd",
  identificadaPor: { fuente: "Wikidata", entidad: "Q643373", propiedad: "P18" },
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
