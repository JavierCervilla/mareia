import test from "node:test";
import assert from "node:assert/strict";

import type { AppModule, PortRef } from "./contract.ts";
import { selectPageSections } from "./sections.ts";

const CORUNA: PortRef = { slug: "a-coruna" };

/**
 * Módulos dummy: existen **solo aquí**. El alta/baja real de un módulo es editar el array
 * `activeModules` de `apps/api/src/modules.config.ts` y `apps/web/src/modules.config.ts`; estos
 * fixtures demuestran que el registry no necesita más que eso.
 */
function dummyModule(overrides: Partial<AppModule> = {}): AppModule {
  return {
    id: "fishing",
    version: "0.0.0-dummy",
    attributions: [{ name: "Dummy", url: "https://example.invalid", license: "CC0-1.0" }],
    ...overrides,
  };
}

test("sin módulos activos no hay secciones (el core compila y funciona vacío)", () => {
  assert.deepEqual(selectPageSections([], CORUNA), []);
});

test("mezcla las secciones de varios módulos ordenadas por `order`", () => {
  const fishing = dummyModule({
    pageSections: [{ id: "solunar", order: 30, renderMode: "static", component: "a" }],
  });
  const weather = dummyModule({
    id: "weather",
    pageSections: [
      { id: "forecast", order: 10, renderMode: "island", component: "b" },
      { id: "wind", order: 40, renderMode: "island", component: "c" },
    ],
  });

  assert.deepEqual(
    selectPageSections([fishing, weather], CORUNA).map((section) => section.id),
    ["forecast", "solunar", "wind"],
  );
});

test("excluye los módulos que no aplican al puerto", () => {
  const navigation = dummyModule({
    id: "navigation",
    pageSections: [{ id: "chart", order: 1, renderMode: "island", component: "d" }],
    isEnabledForPort: (port) => port.slug === "vigo",
  });

  assert.deepEqual(selectPageSections([navigation], CORUNA), []);
  assert.deepEqual(
    selectPageSections([navigation], { slug: "vigo" }).map((section) => section.id),
    ["chart"],
  );
});

test("un módulo solo-API (sin `pageSections`) no aporta secciones ni rompe", () => {
  assert.deepEqual(selectPageSections([dummyModule()], CORUNA), []);
});

test("ante `order` empatado conserva el orden del registry (SSG reproducible)", () => {
  const first = dummyModule({
    pageSections: [{ id: "primera", order: 10, renderMode: "static", component: "a" }],
  });
  const second = dummyModule({
    id: "weather",
    pageSections: [{ id: "segunda", order: 10, renderMode: "static", component: "b" }],
  });

  assert.deepEqual(
    selectPageSections([first, second], CORUNA).map((section) => section.id),
    ["primera", "segunda"],
  );
});

test("un módulo sin atribuciones no compila (contrato de transparencia)", () => {
  const sinAtribuciones = {
    id: "fishing",
    version: "0.0.0-dummy",
    // @ts-expect-error -- `attributions` es una tupla no vacía: [] es un error de tipo, y este test
    // se rompe (ts-expect-error sin error) si alguien relaja el contrato.
    attributions: [],
  } satisfies AppModule;

  assert.equal(sinAtribuciones.id, "fishing");
});
