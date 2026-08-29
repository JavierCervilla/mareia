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

test("el registry de producción publica el módulo de pesca y su sección", () => {
  assert.deepEqual(activeModules.map((modulo) => modulo.id), ["fishing"]);
  assert.deepEqual(sectionsForPort(CORUNA).map((seccion) => seccion.id), ["actividad-solunar"]);
});

/**
 * La propiedad que hace enchufable el contrato de T-06, y la que hay que poder demostrar antes de
 * meter un módulo con UI: **dar de baja es borrar una línea**. Con el registry vacío la página no
 * pide ninguna sección, no pide ninguna ventana para el gráfico (`modulos/ventanas.test.ts`) y
 * vuelve a ser la de T-09.
 *
 * Que ninguna sección se quede sin renderizador no se comprueba aquí porque el mapa de
 * renderizadores importa componentes `.astro` y esto corre en `node`: lo comprueba el propio build,
 * que rompe nombrando la sección huérfana (`SeccionesDeModulos`), y CI construye antes de testear.
 */
test("dar de baja un módulo es borrar su línea del registry", () => {
  assert.deepEqual(sectionsForPort(CORUNA, []), []);
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
