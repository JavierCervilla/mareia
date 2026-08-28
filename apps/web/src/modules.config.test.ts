import test from "node:test";
import assert from "node:assert/strict";

import type { AppModule } from "@mareia/module-contract";

import { activeModules, sectionsForPort } from "./modules.config.ts";

const CORUNA = { slug: "a-coruna" };

/**
 * Módulo dummy: existe **solo en este test**. Demuestra que dar de alta un módulo en el portal es
 * añadirlo al array `activeModules` y nada más, sin que ningún dummy llegue a producción.
 */
const DUMMY: AppModule = {
  id: "weather",
  version: "9.9.9-dummy",
  attributions: [{ name: "Dummy", url: "https://example.invalid", license: "CC0-1.0" }],
  pageSections: [
    { id: "wind", order: 40, renderMode: "island", component: "dummy/Wind" },
    { id: "forecast", order: 10, renderMode: "static", component: "dummy/Forecast" },
  ],
};

test("el registry de producción arranca vacío y la página no pide ninguna sección", () => {
  assert.deepEqual(activeModules, []);
  assert.deepEqual(sectionsForPort(CORUNA), []);
});

test("dar de alta un módulo = añadirlo al registry: sus secciones salen ordenadas", () => {
  assert.deepEqual(
    sectionsForPort(CORUNA, [DUMMY]).map((section) => section.id),
    ["forecast", "wind"],
  );
});

test("un módulo que no aplica al puerto no aporta secciones", () => {
  const soloVigo: AppModule = { ...DUMMY, isEnabledForPort: (port) => port.slug === "vigo" };

  assert.deepEqual(sectionsForPort(CORUNA, [soloVigo]), []);
  assert.deepEqual(sectionsForPort({ slug: "vigo" }, [soloVigo]).length, 2);
});
