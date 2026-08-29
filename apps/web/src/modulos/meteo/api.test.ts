import assert from "node:assert/strict";
import test from "node:test";

import { VARIABLE_API, baseDelApi } from "./api.ts";

test("sin API_BASE_URL la isla pide al mismo origen que sirve la página", () => {
  assert.equal(baseDelApi({}), "");
  assert.equal(baseDelApi({ [VARIABLE_API]: "" }), "");
  assert.equal(baseDelApi({ [VARIABLE_API]: "   " }), "");
});

test("la barra final sobra: dos formas de escribir el mismo origen dan la misma base", () => {
  assert.equal(baseDelApi({ [VARIABLE_API]: "https://api.mareia.es" }), "https://api.mareia.es");
  assert.equal(baseDelApi({ [VARIABLE_API]: "https://api.mareia.es/" }), "https://api.mareia.es");
  assert.equal(baseDelApi({ [VARIABLE_API]: "https://api.mareia.es///" }), "https://api.mareia.es");
});

test("un origen mal escrito rompe el build en vez de dejar la sección muda en 12 páginas", () => {
  assert.throws(() => baseDelApi({ [VARIABLE_API]: "api.mareia.es" }), RangeError);
  assert.throws(() => baseDelApi({ [VARIABLE_API]: "/v1" }), RangeError);
});
