import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { AppModule } from "@mareia/module-contract";
import { METEO_SECTION_COMPONENT, WEATHER_UI_MODULE } from "@mareia/module-weather/ui";

import { activeModules, sectionsForPort } from "./modules.config.ts";

const CORUNA = { slug: "a-coruna" };
const SRC = dirname(fileURLToPath(import.meta.url));

/** Los ficheros de una carpeta del `src` de la web, recursivamente. */
function ficherosDe(carpeta: string): readonly string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(carpeta, entrada.name);
    return entrada.isDirectory() ? ficherosDe(ruta) : [ruta];
  });
}

/**
 * Módulo dummy: existe **solo en este test**. Demuestra que dar de alta un módulo en el portal es
 * añadirlo al array `activeModules` y nada más, sin que ningún dummy llegue a producción.
 */
const DUMMY: AppModule = {
  id: "fishing",
  version: "9.9.9-dummy",
  attributions: [{ name: "Dummy", url: "https://example.invalid", license: "CC0-1.0" }],
  pageSections: [
    { id: "wind", order: 40, renderMode: "island", component: "dummy/Wind" },
    { id: "forecast", order: 10, renderMode: "static", component: "dummy/Forecast" },
  ],
};

test("el registry de producción publica el módulo meteo y su sección", () => {
  assert.deepEqual(
    activeModules.map((modulo) => modulo.id),
    ["weather"],
  );
  assert.deepEqual(
    sectionsForPort(CORUNA).map((seccion) => [seccion.id, seccion.component, seccion.renderMode]),
    [["meteo", METEO_SECTION_COMPONENT, "island"]],
  );
});

/**
 * El requisito que T-11 hereda de T-10: **dar de baja un módulo es borrar su línea del registry**,
 * no operar la plantilla. Se comprueba por los dos lados que pueden romperlo.
 */
test("con el registry vacío la página no pide ninguna sección: la baja es una línea", () => {
  assert.deepEqual(sectionsForPort(CORUNA, []), []);
});

test("nadie fuera del mapa de renderizadores conoce el componente de la sección meteo", () => {
  // Si una página o el layout importara `Meteo.astro` directamente, borrar la línea del registry
  // dejaría de bastar: el build seguiría arrastrando la sección —y su JavaScript— por otra vía.
  const sospechosos = ["pages", "layouts", "componentes"].flatMap((carpeta) =>
    ficherosDe(join(SRC, carpeta)),
  );
  const culpables = sospechosos.filter(
    (fichero) =>
      !fichero.endsWith("Meteo.astro") && readFileSync(fichero, "utf8").includes("Meteo.astro"),
  );

  assert.deepEqual(
    culpables.map((fichero) => fichero.slice(SRC.length + 1)),
    [],
    "el único sitio que puede nombrar el componente de una sección es src/secciones.ts",
  );
});

test("el módulo declara la misma sección para la API y para la web", () => {
  // `createWeatherModule` (la vista con servidor) y `WEATHER_UI_MODULE` (la vista sin él) comparten
  // `WEATHER_PAGE_SECTIONS`: la sección no puede contarse de dos maneras según quién pregunte.
  assert.deepEqual(WEATHER_UI_MODULE.pageSections, sectionsForPort(CORUNA));
  assert.equal(WEATHER_UI_MODULE.api, undefined, "la web no monta la parte servidor del módulo");
  assert.ok(WEATHER_UI_MODULE.attributions.length >= 2, "sin atribuciones no se publica el módulo");
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
