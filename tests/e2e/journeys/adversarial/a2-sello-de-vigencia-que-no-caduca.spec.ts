/**
 * A2 · **El sello de vigencia envejece y la página no se entera: la sección se publica igual con
 * una comprobación de hoy que con una de hace siete años.**
 *
 * La promesa de T-19, palabra por palabra: la talla que se publica es *«la que está en vigor hoy»*.
 * Lo único que sostiene ese «hoy» es el gate diario G2 (`.github/workflows/normativa-vigencia.yml`),
 * que le pregunta al BOE si el RD 560/1995 sigue vivo y, **solo si pudo preguntar y salió bien**,
 * escribe `fuente.verificadoEn` en el dataset. El gate tiene tres colores a propósito, y el tercero
 * —ámbar, «no se ha podido preguntar»— **no rompe el despliegue**, por diseño. Lo que el propio
 * workflow dice que pasa entonces, dos veces:
 *
 * > «`verificadoEn` **no se toca**, el sello envejece y la página **degrada sola**.»
 * > «No se ha podido consultar el BOE. verificadoEn NO se ha tocado: el sello envejece y la sección
 * >  de normativa **degradará sola**. Esto NO rompe el despliegue a propósito.»
 *
 * No degrada. No hay nada que degrade: la sección imprime `verificadoEn` con `fechaLarga` y no lo
 * compara con nada. Medido en este pase: construyendo el sitio con `verificadoEn` puesto a
 * **2019-04-07** —siete años y cuatro meses de rancio— la sección publicada de Vigo es **idéntica
 * byte a byte** a la del sello de hoy salvo la propia cadena de la fecha. Sigue el mismo rótulo
 * («Vigencia comprobada contra el BOE el …»), la misma entradilla afirmando que *«por debajo de
 * estas medidas la pieza no se puede desembarcar ni retener»* y el mismo aviso de sin-red, que
 * además atribuye la posible antigüedad a **otra causa** (haber guardado una copia sin cobertura),
 * de modo que un lector con red no tiene ni esa pista.
 *
 * O sea que la rama ámbar de G2 —la que existe para que un mal día del BOE no tumbe el
 * despliegue— puede durar meses sin que ni la página ni ningún gate digan una palabra, y el portal
 * sigue publicando cifras legales con el aspecto de estar verificadas. Ninguno de los gates
 * deterministas del repo mira la edad del sello: `run.py check` (0), 1759 pytest, los tests de Node
 * y `pnpm lint` quedaron **todos en verde** con el sello de 2019; el único que lo mira comprueba su
 * formato, `assert.match(fuente.verificadoEn, /^\d{4}-\d{2}-\d{2}$/u)`.
 *
 * **Método.** No se toca el árbol de trabajo: se construye el sitio contra un `data/` efímero
 * (`MAREIA_DATA_DIR`) con el sello atrasado y se compara la sección resultante con la que ya está
 * publicada en `dist/`. La aserción es del **comportamiento correcto y no del síntoma**: da igual
 * cómo se resuelva —rotularlo, ocultar la cifra, decir cuántos días hace—, lo que no puede es
 * publicar exactamente lo mismo.
 */

import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "../../fixtures/qa-bundle";

import { RAIZ } from "./utiles";
import {
  construirConDataDir,
  dataDirEfimero,
  paginaDePuerto,
  seccionDeTallas,
  textoDe,
} from "./utiles-normativa";

/** Construir el sitio entero lleva ~25 s, y este ataque necesita uno. */
test.setTimeout(600_000);

/** Puerto sobre el que se lee la sección. Anexo I, y es el que ya usan los recorridos de T-11. */
const RUTA_VIGO = join("mareas", "galicia", "pontevedra", "vigo");

/** Sello atrasado. Siete años: nadie puede defender que eso siga siendo «comprobado». */
const SELLO_RANCIO = "2019-04-07";

/** La sección publicada hoy, la del `dist/` que CI construye antes de correr los recorridos. */
function seccionPublicada(): string {
  const fichero = join(RAIZ, "apps", "web", "dist", RUTA_VIGO, "index.html");
  if (!existsSync(fichero)) {
    throw new Error(`no hay dist: corre antes \`pnpm --filter web build\` (${fichero})`);
  }
  return seccionDeTallas(readFileSync(fichero, "utf8"));
}

/** El texto de la sección sin ninguna fecha larga: lo que queda cuando se quita el sello. */
function sinFechas(seccion: string): string {
  return textoDe(seccion).replace(/\w+, \d{1,2} de \w+ de \d{4}/gu, "«fecha»");
}

test("A2 · una vigencia comprobada por última vez en 2019 tiene que leerse distinta", async ({
  qa,
}) => {
  // TRINQUETE · Hallazgo ARREGLADO (bundle 98297c6c420d). La cura vive en
  // `packages/modules/regulations/src/vigencia.ts`: dos umbrales con nombre —7 días y 60— y tres
  // estados, que la sección publica en `data-vigencia` y acompaña de un aviso que sólo existe
  // cuando hay algo que decir. Este recorrido se queda como gate permanente: no se borra.

  qa.step("la sección tal y como se publica hoy, con el sello recién escrito por G2");
  const publicada = seccionPublicada();
  expect(publicada, "INCONCLUSO: el dist/ no trae la sección de tallas").not.toBe("");

  const datos = dataDirEfimero((normativa) => {
    normativa.fuente.verificadoEn = SELLO_RANCIO;
  });
  let dist = "";
  try {
    qa.step(`construir el sitio con verificadoEn = ${SELLO_RANCIO} (la rama ámbar de G2, meses)`);
    const construccion = construirConDataDir(datos);
    dist = construccion.destino;
    expect(construccion.codigo, `INCONCLUSO: el build falló · ${construccion.salida}`).toBe(0);

    const html = paginaDePuerto(dist, RUTA_VIGO);
    expect(html, "INCONCLUSO: ese build no publicó la página de Vigo").not.toBeNull();
    const rancia = seccionDeTallas(html ?? "");

    qa.step("comprobar que el sello atrasado llegó DE VERDAD a la página");
    // Sin esto la sonda mide su propio parche: si el build hubiese ignorado el dataset efímero, un
    // «no cambia nada» no diría nada.
    expect(textoDe(rancia), "INCONCLUSO: el sello atrasado no llegó al HTML").toContain(
      "7 de abril de 2019",
    );

    qa.step("comparar lo publicado con el sello de hoy y con el de hace siete años");
    // El comportamiento CORRECTO: con la vigencia sin comprobar desde 2019, la sección tiene que
    // decir algo que no dice cuando se comprobó hoy. Da igual el qué. Hoy no dice nada: las dos
    // versiones son la misma página con otra fecha dentro.
    expect(
      sinFechas(rancia),
      "la sección publica lo mismo con la vigencia comprobada hoy que con la de 2019: la rama " +
        "ámbar de G2 no tiene ninguna consecuencia visible, y el workflow promete que «la sección " +
        "degradará sola»",
    ).not.toBe(sinFechas(publicada));
  } finally {
    rmSync(datos, { recursive: true, force: true });
    if (dist !== "") rmSync(dist, { recursive: true, force: true });
  }
});
