/**
 * A12 · **El trinquete de ADR-01 tiene cuatro puertas abiertas: se puede hornear meteo en el HTML
 * sin que el gate se entere.**
 *
 * ADR-01 dice que el dato que caduca no viaja dentro de la página, y su garantía —lo dice el propio
 * test— *«vale lo que valga este test»*: el de `apps/web/src/sitio-construido.test.ts`, «el HTML
 * construido no lleva NI UNA magnitud meteorológica dentro». Ese gate ya se endureció tres veces
 * (lista blanca de texto dentro de `#meteo`, vigilancia de atributos **por nombre**, lista negra
 * fuera de la sección). Las tres puertas que cerró siguen cerradas: comprobado en este mismo pase
 * con prosa como nombre de clase, atributo con dígito y valor entre comillas simples — las tres
 * ponen el gate en rojo.
 *
 * Pero el barrido de atributos es una expresión regular, `/\s([a-zA-Z0-9-]+)=("[^"]*"|'[^']*')/`, y
 * el texto se extrae borrando `<[^>]+>`. De ahí salen cuatro cargas que llegan **al HTML publicado**
 * y no ponen el gate en rojo:
 *
 * | Carga | Por qué pasa |
 * |---|---|
 * | `data-ola=1,68m` | HTML permite el valor **sin comillas**; la regex exige comillas. |
 * | `data_ola="1,68 m"` | el nombre lleva `_`, que no está en `[a-zA-Z0-9-]`. |
 * | `x:ola="1,68 m …"` | el nombre lleva `:`, tampoco. |
 * | `<!-- ola 1,68 m -->` | un comentario se borra como si fuera una etiqueta: no queda texto. |
 *
 * Las tres primeras son atributos legales de HTML5 y legibles con `getAttribute`; la cuarta es el
 * sitio clásico donde un framework deja su carga de hidratación. No hace falta mala fe: basta con
 * que alguien decida «dejo el último dato en el HTML por si el API tarda».
 *
 * **Método.** No se toca ni una línea de producción: se inyecta la carga en el **artefacto
 * publicado** (`dist/`), que es lo que el gate lee, se comprueba que la carga **está de verdad** en
 * el HTML publicado —una sonda que no comprueba eso mide su propio parche, y falla en verde— y se
 * corre el gate tal cual. Se restaura siempre. La página elegida no la usa ningún otro recorrido.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "../../fixtures/qa-bundle";

import { RAIZ } from "./utiles";

/** Página del `dist/` sobre la que se inyecta. Ningún otro recorrido la abre. */
const PAGINA_DEL_DIST = join(
  RAIZ,
  "apps",
  "web",
  "dist",
  "mareas",
  "region-de-murcia",
  "murcia",
  "la-manga-del-mar-menor",
  "index.html",
);

/** El ancla dentro de `#meteo` donde se inyecta cada carga. */
const ANCLA = '<div class="meteo__bloques" data-meteo-bloques hidden>';

const CARGAS = [
  {
    clase: "atributo con el valor sin comillas",
    inyectado: `<div class="meteo__bloques" data-ola=1,68m data-meteo-bloques hidden>`,
    marca: "data-ola=1,68m",
  },
  {
    clase: "nombre de atributo con guion bajo",
    inyectado: `<div class="meteo__bloques" data_ola="1,68 m" data-meteo-bloques hidden>`,
    marca: 'data_ola="1,68 m"',
  },
  {
    clase: "nombre de atributo con dos puntos",
    inyectado: `<div class="meteo__bloques" x:ola="1,68 m · viento 9,4 km/h" data-meteo-bloques hidden>`,
    marca: "x:ola=",
  },
  {
    clase: "comentario HTML (donde un framework deja su carga de hidratación)",
    inyectado: `<!-- meteo horneada: ola 1,68 m · viento 9,4 km/h · 1021,5 hPa -->${ANCLA}`,
    marca: "meteo horneada: ola 1,68 m",
  },
] as const;

/** Corre el gate de ADR-01 tal como lo corre CI. Devuelve el código de salida. */
function correrElGate(): number {
  try {
    execFileSync(
      "node",
      [
        "--experimental-strip-types",
        "--test",
        "--test-name-pattern=NI UNA magnitud",
        "apps/web/src/sitio-construido.test.ts",
      ],
      { cwd: RAIZ, stdio: "pipe" },
    );
    return 0;
  } catch (fallo) {
    return (fallo as { status?: number }).status ?? 1;
  }
}

/** La sección `#meteo` del HTML publicado, para comprobar que la carga llegó **dentro**. */
function seccionMeteoDe(html: string): string {
  return /<section id="meteo"[\s\S]*?<\/section>/u.exec(html)?.[0] ?? "";
}

for (const carga of CARGAS) {
  test(`A12 · el gate de ADR-01 tiene que ver una magnitud escondida en ${carga.clase}`, async ({
    qa,
  }) => {
    const original = readFileSync(PAGINA_DEL_DIST, "utf8");
    expect(original, "el ancla de inyección ya no existe en el dist").toContain(ANCLA);

    try {
      qa.step(`inyectar la carga en el dist/: ${carga.clase}`);
      writeFileSync(PAGINA_DEL_DIST, original.replace(ANCLA, carga.inyectado), "utf8");

      // Sin esto la sonda mide su propio parche: si la carga no llegó al HTML publicado, un gate en
      // verde no dice nada y se leería como «no hay agujero», que es el error peligroso.
      qa.step("comprobar que la carga está DE VERDAD en el HTML publicado, dentro de #meteo");
      const publicado = readFileSync(PAGINA_DEL_DIST, "utf8");
      expect(
        seccionMeteoDe(publicado),
        "INCONCLUSO: la carga no llegó a la sección #meteo del dist/",
      ).toContain(carga.marca);

      qa.step("correr el gate de ADR-01 tal cual lo corre CI");
      const codigo = correrElGate();

      // El comportamiento CORRECTO: el gate se pone en rojo. Hoy sale en verde con una altura de
      // ola, una velocidad de viento y una presión dentro del HTML que se publica.
      expect(
        codigo,
        "el gate de ADR-01 da por bueno un HTML con meteo horneada dentro de #meteo",
      ).not.toBe(0);
    } finally {
      writeFileSync(PAGINA_DEL_DIST, original, "utf8");
    }
  });
}
