/**
 * A12 · **La regla dura de T-21 —«en ningún caso, ni por omisión, se puede leer que se pueda
 * pescar»— se publica desde dos campos de texto LIBRE del derivado, y ningún gate mira lo que
 * dicen.**
 *
 * La sección imprime dos frases que no salen del módulo sino del dato:
 *
 * 1. `fuente.aviso`, en `<strong>`, **antes** de la lista y en las **153** páginas. Es la regla
 *    dura: va ahí precisamente porque califica todo lo que hay debajo.
 * 2. `puertos[].motivo`, en las **10** páginas que no listan ninguna área, que son las que más
 *    riesgo tienen de leerse como un permiso por omisión.
 *
 * Lo que comprueba el repositorio sobre esos dos campos:
 *
 * * `data/pipeline/mareia_pipeline/areas.py` → `errores_de_cobertura`: que `fuente.aviso` sea
 *   **truthy** y que un puerto sin áreas traiga **algún** motivo. Nada sobre su contenido.
 * * `apps/web/src/modulos/areas-protegidas.ts` → `texto()`: cadena **no vacía**. Nada más.
 * * `apps/web/src/areas-protegidas-construido.test.ts`: un `assert.match(fuente.aviso,
 *   /no autoriza a pescar/u)` y una lista de **ocho** expresiones regulares de «suena a permiso».
 *
 * O sea: el filtro real de la regla dura son ocho regex y una subcadena. Este ataque escribe un
 * aviso que **contiene** la subcadena exigida y que **añade** un permiso detrás, y un motivo que
 * dice que en ese puerto no hay nada que consultar. Ninguna de las ocho regex los toca.
 *
 * **Medido sobre el árbol de trabajo, con el fichero mutado en su sitio y las órdenes que corre CI**
 * (ver `.github/workflows/ci.yml`), con los dos textos ajustados para que no muevan el peso en
 * bytes de la sección más grande ni de la más pequeña —lo único que se puso rojo en el primer
 * intento fue `assert.equal(mayor.bytes, 4925)`, que cuenta bytes y no lee nada—:
 *
 * | orden | salida |
 * |---|---|
 * | `pnpm --filter web build` | 0 |
 * | `pnpm test` | 0 |
 * | `python run.py check` | 0 |
 * | `python -m pytest tests -q` | 1851 passed |
 * | `ruff check .` | 0 |
 *
 * La aserción de cada cuerpo es del comportamiento, no del síntoma: la sección **no puede** publicar
 * como suya una frase que nadie ha comprobado. O algo se pone rojo, o la regla dura de la
 * trayectoria depende de que quien toque el JSON tenga buena fe.
 */

import { rmSync } from "node:fs";

import { expect, test } from "../../fixtures/qa-bundle";

import {
  construirConDataDir,
  dataDirEfimero,
  derivadoPublicado,
  paginaDePuerto,
  puertoDe,
  seccionDeAreas,
  textoDe,
} from "./utiles-areas";

/**
 * El aviso plantado. Tres propiedades, y las tres importan:
 *
 * * contiene `no autoriza a pescar`, que es lo único que el gate de la web mira;
 * * ninguna de las ocho regex de «suena a permiso» lo toca (no dice «puedes pescar», ni «pesca
 *   libre», ni «zona libre», ni «sin restricciones»…): dice **«no hay veda»**, que en la boca de
 *   quien va a faenar significa exactamente lo mismo;
 * * ocupa **186 bytes**, los mismos que el aviso publicado, para que no mueva el peso de la sección.
 */
const AVISO_PLANTADO =
  "Solo la declaración oficial de cada espacio define sus límites y su régimen. Que no haya un " +
  "área protegida cerca no autoriza a pescar sin licencia; con ella, en el resto no hay veda.";

/**
 * El motivo plantado para Valencia, uno de los 10 puertos sin ninguna área. Es **más largo** que el
 * publicado a propósito: así la sección de Valencia deja de ser la más pequeña del sitio y el
 * `assert.equal(menor.bytes, 1955)` —que es un recuento, no una lectura— sigue en verde.
 */
const MOTIVO_PLANTADO =
  "ninguna área marina protegida de RAMPE 2025 tiene su borde a menos de 30 km de este puerto, y " +
  "el puerto tampoco cae dentro de ninguna, así que por este concepto no hay ninguna limitación " +
  "que consultar antes de salir de este puerto.";

/** Lo que ninguna página puede acabar diciendo, venga de donde venga el texto. */
const SUENA_A_PERMISO = [/no hay veda/iu, /no hay ninguna limitación/iu];

test("A12 · el aviso de la fuente se publica en las 153 páginas sin que nadie lea lo que dice", async ({
  qa,
}) => {
  // HALLAZGO ABIERTO. El `test.fail()` está para que CI no se quede en rojo mientras el defecto
  // vive; el día que algo compruebe lo que dice el aviso, Playwright dirá «expected to fail, but
  // passed» y habrá que quitarlo. El recorrido se queda entonces como gate permanente.
  test.fail();

  qa.step("el derivado publicado trae el aviso bueno: si no, un rojo posterior no probaría nada");
  const publicado = derivadoPublicado();
  expect(publicado.fuente.aviso, "INCONCLUSO: el derivado ya no trae el aviso").toContain(
    "no autoriza a pescar",
  );

  qa.step("plantar un aviso que conserva la subcadena exigida y le añade un permiso detrás");
  const datos = dataDirEfimero((derivado) => {
    derivado.fuente.aviso = AVISO_PLANTADO;
  });

  try {
    qa.step("construir el sitio con ese derivado");
    const construccion = construirConDataDir(datos);
    expect(construccion.codigo, `el build dice:\n${construccion.salida}`).toBe(0);

    qa.step("leer la sección en un puerto con áreas y en uno de los diez que no tienen ninguna");
    for (const slug of ["vigo", "valencia"]) {
      const html = paginaDePuerto(construccion.destino, slug);
      expect(html, `${slug}: el build no publicó la página`).not.toBeNull();
      const leido = textoDe(seccionDeAreas(html ?? ""));

      // Aquí está el hallazgo: la frase plantada se publica tal cual, en negrita y antes de la
      // lista, con la autoridad de la fuente. La aserción es la que tendría que sostener la
      // promesa de la trayectoria, no la que describe el fallo.
      for (const patron of SUENA_A_PERMISO) {
        expect(leido, `${slug}: la sección publica un permiso plantado en el dato`).not.toMatch(
          patron,
        );
      }
    }
    rmSync(construccion.destino, { recursive: true, force: true });
  } finally {
    rmSync(datos, { recursive: true, force: true });
  }
});

test("A12 · y en los 10 puertos sin áreas el motivo es texto libre: sólo se exige que no esté vacío", async ({
  qa,
}) => {
  // HALLAZGO ABIERTO. Mismo trinquete que el cuerpo de arriba.
  test.fail();

  qa.step("Valencia es uno de los diez puertos que no listan ninguna área");
  const publicado = derivadoPublicado();
  const valencia = puertoDe(publicado, "valencia");
  expect(valencia.areas, "INCONCLUSO: Valencia ha dejado de ser un puerto sin áreas").toHaveLength(
    0,
  );
  expect(valencia.motivo).not.toBeNull();

  qa.step("plantar un motivo que dice que ahí no hay nada que consultar");
  const datos = dataDirEfimero((derivado) => {
    puertoDe(derivado, "valencia").motivo = MOTIVO_PLANTADO;
  });

  try {
    qa.step("construir y leer la página de Valencia");
    const construccion = construirConDataDir(datos);
    expect(construccion.codigo, `el build dice:\n${construccion.salida}`).toBe(0);
    const html = paginaDePuerto(construccion.destino, "valencia");
    expect(html, "el build no publicó la página de Valencia").not.toBeNull();
    const leido = textoDe(seccionDeAreas(html ?? ""));

    qa.step("la página sigue diciendo «Ninguna a menos de 30 km», y ahora también el permiso");
    expect(leido, "INCONCLUSO: la página vacía ha dejado de decir lo que dice").toContain(
      "Ninguna a menos de 30 km de este puerto.",
    );
    // La sección de un puerto sin áreas es la que más riesgo tiene de leerse como un permiso por
    // omisión, y es justo la que publica un texto que nadie ha leído.
    expect(
      leido,
      "el motivo del dato convierte «no hay áreas» en «no hay nada que consultar»",
    ).not.toMatch(/no hay ninguna limitación/iu);
    rmSync(construccion.destino, { recursive: true, force: true });
  } finally {
    rmSync(datos, { recursive: true, force: true });
  }
});
