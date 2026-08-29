/**
 * La política offline sale del **registry de módulos**, no de una lista escrita a mano.
 *
 * Lo que se afirma aquí es la propiedad que sostiene el contrato `AppModule` (T-06): **dar de baja
 * un módulo es borrar su línea**, y su política offline se va con él sin que nadie tenga que
 * acordarse de tocar el service worker. Y la otra mitad: un favorito guarda lo que el usuario pidió
 * y nada más.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { AppModule } from "@mareia/module-contract";

import { activeModules } from "../modules.config.ts";
import {
  assetsDeModulos,
  politicasDeModulos,
  urlsDeFavorito,
  urlsDeOlvido,
} from "./precacheo.ts";

const VIGO = { slug: "vigo", ruta: "/mareas/galicia/pontevedra/vigo/" };

function moduloDummy(cambios: Partial<AppModule> = {}): AppModule {
  return {
    id: "fishing",
    version: "0.0.0-dummy",
    attributions: [{ name: "Dummy", url: "https://example.invalid", license: "CC0-1.0" }],
    ...cambios,
  };
}

test("sin módulos activos no hay ninguna política: el worker no enruta nada de nadie", () => {
  assert.deepEqual(politicasDeModulos([]), []);
});

test("un módulo sin `offline` no aparece: no declarar no es declarar «cachéalo todo»", () => {
  assert.deepEqual(politicasDeModulos([moduloDummy()]), []);
});

test("la política de un módulo llega al worker tal y como la declara su contrato", () => {
  const politicas = politicasDeModulos([
    moduloDummy({
      id: "weather",
      offline: { strategy: "network-first", routes: ["/v1/modules/weather/weather"] },
    }),
  ]);

  assert.deepEqual(politicas, [
    {
      id: "weather",
      estrategia: "network-first",
      rutas: ["/v1/modules/weather/weather"],
      assets: [],
      maxAgeSeconds: null,
    },
  ]);
});

test("el registry real declara la política de meteo, que es el único dato que caduca", () => {
  const politicas = politicasDeModulos(activeModules);
  const meteo = politicas.find((politica) => politica.id === "weather");

  assert.ok(meteo, "el módulo meteo tiene que declarar su política offline");
  assert.equal(meteo.estrategia, "network-first", "con red, la meteo se pide a la red");
  assert.deepEqual([...meteo.rutas].sort(), [
    "/v1/modules/weather/bulletin",
    "/v1/modules/weather/weather",
  ]);
  assert.equal(
    politicas.find((politica) => politica.id === "fishing"),
    undefined,
    "pesca se calcula en build y viaja en el HTML: no tiene nada que precachear",
  );
});

test("un favorito guarda su página, sus constantes y los assets de SU página; nada más", () => {
  const urls = urlsDeFavorito(VIGO, ["/_astro/hoja.abc.css", "/_astro/isla.def.js"]);

  assert.deepEqual(urls, [
    "/mareas/galicia/pontevedra/vigo/",
    "/offline/estaciones/vigo.json",
    "/_astro/hoja.abc.css",
    "/_astro/isla.def.js",
  ]);
});

test("los assets que declare un módulo entran en el favorito sin tocar la PWA", () => {
  const politicas = politicasDeModulos([
    moduloDummy({
      id: "navigation",
      offline: { strategy: "cache-first", assets: ["/cartas/leyenda.svg"] },
    }),
  ]);

  assert.deepEqual(assetsDeModulos(politicas), ["/cartas/leyenda.svg"]);
  assert.ok(
    urlsDeFavorito(VIGO, ["/_astro/hoja.abc.css"], assetsDeModulos(politicas)).includes(
      "/cartas/leyenda.svg",
    ),
  );
});

test("no se guarda dos veces el mismo asset aunque lo pidan dos sitios", () => {
  const urls = urlsDeFavorito(VIGO, ["/_astro/hoja.abc.css", "/_astro/hoja.abc.css"], [
    "/_astro/hoja.abc.css",
  ]);
  assert.equal(new Set(urls).size, urls.length);
  assert.equal(urls.length, 3);
});

test("olvidar un puerto borra lo suyo y no los assets, que los comparten los demás favoritos", () => {
  assert.deepEqual(urlsDeOlvido(VIGO), [
    "/mareas/galicia/pontevedra/vigo/",
    "/offline/estaciones/vigo.json",
  ]);
});
