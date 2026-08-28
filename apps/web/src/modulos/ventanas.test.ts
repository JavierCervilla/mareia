/**
 * El camino que va del registry de módulos a las bandas del gráfico, sin construir el sitio.
 *
 * Lo que se defiende aquí es la **baja de un módulo**: si mañana se borra la línea de `fishing` en
 * `modules.config.ts`, la página no recibe secciones, no pide ventanas y el gráfico vuelve a ser el
 * de antes. Es la propiedad que hace enchufable el contrato de T-06, y la única forma de que un
 * módulo con UI no se convierta en cirugía.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SECCION_ACTIVIDAD, SECCION_ACTIVIDAD_SOLUNAR } from "@mareia/module-fishing";

import type { ContextoDeSeccion } from "./contexto.ts";
import { VENTANAS_DE_SECCION, ventanasDeSecciones } from "./ventanas.ts";

const VIGO: ContextoDeSeccion = {
  slug: "vigo",
  fechaIso: "2026-08-28",
  timezone: "Europe/Madrid",
};

test("sin secciones no hay ventanas: dar de baja el módulo apaga el overlay", async () => {
  assert.deepEqual(await ventanasDeSecciones([], VIGO), []);
});

test("una sección que no aporta ventanas no rompe el gráfico", async () => {
  const soloTexto = { ...SECCION_ACTIVIDAD, component: "modulo/SinGrafico" };

  assert.deepEqual(await ventanasDeSecciones([soloTexto], VIGO), []);
});

test("la sección de actividad aporta las ventanas del día del puerto", async () => {
  assert.ok(VENTANAS_DE_SECCION[SECCION_ACTIVIDAD_SOLUNAR], "sección sin proveedor registrado");

  const ventanas = await ventanasDeSecciones([SECCION_ACTIVIDAD], VIGO);

  assert.ok(ventanas.length >= 1 && ventanas.length <= 4, `un día civil trae 1-4 periodos, no ${ventanas.length}`);
  assert.equal(new Set(ventanas.map((ventana) => ventana.id)).size, ventanas.length);
  for (const ventana of ventanas) {
    assert.ok(ventana.finUtcMs > ventana.inicioUtcMs, `${ventana.id} acaba antes de empezar`);
    assert.match(ventana.etiqueta, /periodo (mayor|menor) de \d{2}:\d{2}/);
  }
});
