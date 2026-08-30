import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { AppModule } from "@mareia/module-contract";
import { SECCION_AREAS_PROTEGIDAS } from "@mareia/module-protected-areas";
import { SECCION_TALLAS_MINIMAS } from "@mareia/module-regulations";
import { SECCION_CATALOGO_DE_ESPECIES } from "@mareia/module-species";
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

test("el registry de producción publica los cinco módulos y sus secciones, en orden", () => {
  // Los cinco, y en el orden que fija `order`: la unión es lo que rompía el merge de T-10 con
  // T-11, así que se afirma aquí en vez de dejar que cada trayectoria compruebe solo la suya.
  assert.deepEqual(
    activeModules.map((modulo) => modulo.id),
    ["fishing", "weather", "regulations", "protected-areas", "species"],
  );
  // El orden es el de `order` y cuenta una decisión de diseño entera: las áreas protegidas van a
  // 12 —las primeras, porque son una advertencia y no una consulta—,
  // solunar y meteo empatan a 20 (contextual), las tallas van a 30 porque son consultables y el
  // catálogo de especies va a 35, el último, porque es un enlace que amplía lo que se acaba de
  // leer y puesto delante ofrecería irse de la página antes de enseñar la tabla. Ver los TSDoc de
  // `SECCION_AREAS`, `SECCION_TALLAS` y `SECCION_ESPECIES`.
  assert.deepEqual(
    sectionsForPort(CORUNA).map((seccion) => [seccion.id, seccion.renderMode]),
    [
      ["areas-protegidas", "static"],
      ["actividad-solunar", "static"],
      ["meteo", "island"],
      ["tallas-minimas", "static"],
      ["especies", "static"],
    ],
  );
  assert.equal(
    sectionsForPort(CORUNA).find((seccion) => seccion.id === "especies")?.component,
    SECCION_CATALOGO_DE_ESPECIES,
  );
  assert.equal(
    sectionsForPort(CORUNA).find((seccion) => seccion.id === "areas-protegidas")?.component,
    SECCION_AREAS_PROTEGIDAS,
  );
  assert.equal(
    sectionsForPort(CORUNA).find((seccion) => seccion.id === "tallas-minimas")?.component,
    SECCION_TALLAS_MINIMAS,
  );
  assert.deepEqual(
    sectionsForPort(CORUNA).filter((seccion) => seccion.id === "meteo"),
    [...(WEATHER_UI_MODULE.pageSections ?? [])],
  );
  assert.equal(
    sectionsForPort(CORUNA).find((seccion) => seccion.id === "meteo")?.component,
    METEO_SECTION_COMPONENT,
  );
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

test("el módulo meteo declara la misma sección para la API y para la web", () => {
  // `createWeatherModule` (la vista con servidor) y `WEATHER_UI_MODULE` (la vista sin él) comparten
  // `WEATHER_PAGE_SECTIONS`: la sección no puede contarse de dos maneras según quién pregunte.
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
