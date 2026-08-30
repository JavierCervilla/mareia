/**
 * A10 · **Una fila mal anotada del BOE impide publicar las 153 tablas de marea.**
 *
 * La sección de tallas mínimas es, por decisión escrita del propio módulo, lo **consultable** de la
 * página: `order: 30`, la última, «se viene a esta página a por la marea, y quien mira la talla la
 * mira porque ya tiene la pieza en la mano». Y el contrato de módulos promete que un módulo se
 * quita borrando su línea, sin que el sitio se entere.
 *
 * Pero el módulo no falla como se ausenta. `filasDeTallas` **levanta** —a propósito, y el motivo
 * está bien argumentado: una marca de nota que no lleva a ninguna parte se lee como una cifra
 * anotada y no lo está— y esa excepción sale en medio del render de una página de puerto, o sea
 * dentro del build de Astro. Ahí no hay degradación posible: el build entero se aborta.
 *
 * Medido en este pase, poniéndole al «Salmonete» del Anexo II una marca `(**)` que ese anexo no
 * publica (el Anexo II solo tiene la `(*)` del pulpo):
 *
 * * `pnpm --filter web build` sale con **código 1** en la primera página mediterránea que toca por
 *   orden alfabético (`/mareas/andalucia/almeria/adra/`);
 * * `apps/web/dist/` se queda con **2 de las 191 páginas**: la construcción anterior se ha borrado
 *   y la nueva no llega. Un despliegue que no mirase el código de salida publicaría dos páginas.
 * * y con él caen la portada, el sitemap, el `sw.js` y las **153 tablas de marea**, que son a lo que
 *   viene la gente, por una fila de una tabla de la sección que va la última.
 *
 * El defecto no es que se levante: es **dónde**. El dataset que dispara esto no es código nuestro
 * —lo escribe un pipeline que lee el BOE, y hay un job programado que reescribe y commitea ese
 * fichero (`normativa-vigencia.yml`, con `[skip ci]`)—, así que el disparador vive fuera de la
 * revisión de nadie.
 *
 * **Método.** Sin tocar el árbol de trabajo: `data/` efímero con la marca colgando
 * (`MAREIA_DATA_DIR`) y `astro build --outDir` a un directorio de usar y tirar. La aserción es la
 * del comportamiento correcto: el almanaque se publica. Da igual cómo —sin la sección, con la
 * sección diciendo que no puede pintarse, con el puerto entero fuera—, pero la marea de Vigo no
 * puede depender de una nota del anexo mediterráneo.
 */

import { rmSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "../../fixtures/qa-bundle";

import { construirConDataDir, dataDirEfimero, especieDe, paginaDePuerto } from "./utiles-normativa";

/** Construir el sitio entero lleva ~25 s, y este ataque necesita uno (que además falla). */
test.setTimeout(600_000);

/** Una página por caladero: ninguna de las tres tiene que ver con la fila que se estropea. */
const PAGINAS = {
  "Vigo (Anexo I)": join("mareas", "galicia", "pontevedra", "vigo"),
  "Valencia (Anexo II)": join("mareas", "comunitat-valenciana", "valencia", "valencia"),
  "Telde (Anexo III)": join("mareas", "canarias", "las-palmas", "telde"),
} as const;

test("A10 · una marca de nota colgando en el Anexo II no puede dejar sin publicar la marea", async ({
  qa,
}) => {
  // TRINQUETE · **TRADEOFF ACEPTADO Y DOCUMENTADO** (bundle 141d616fcbbf), no un hallazgo
  // pendiente: ver `docs/adr/ADR-03-cifra-legal-en-pagina-estatica.md`, «El tradeoff que más caro
  // sale». Fallar el build es fail-safe —no se despliega y producción sigue sirviendo lo
  // anterior—, y el disparador de este ataque lo caza `run.py check` (G1 y G4) antes de construir.
  // Lo que se acepta es el radio de explosión de la clase de fallo que se les escape a los gates.
  // El `test.fail()` se queda: es la medida permanente de ese tradeoff, así que el día que alguien
  // cambie la decisión Playwright dirá «expected to fail, but passed» y obligará a volver al ADR.
  test.fail();

  qa.step("una fila del Anexo II queda apuntando a una nota que ese anexo no publica");
  const datos = dataDirEfimero((normativa) => {
    especieDe(normativa, "mediterraneo", "Salmonete").notas = ["(**)"];
  });

  let dist = "";
  try {
    qa.step("construir el sitio con ese dataset");
    const construccion = construirConDataDir(datos);
    dist = construccion.destino;

    // Sin esto la sonda mide su propio parche: si el build hubiese ignorado el dataset efímero,
    // el verde no diría nada.
    qa.step("comprobar que la que se rompe es DE VERDAD la fila que se tocó");
    expect(construccion.salida, "INCONCLUSO: el build no se quejó del Salmonete").toContain(
      "Salmonete",
    );

    qa.step("comprobar qué se ha publicado");
    const perdidas = Object.entries(PAGINAS)
      .filter(([, ruta]) => paginaDePuerto(dist, ruta) === null)
      .map(([nombre]) => nombre);

    // El comportamiento CORRECTO: el almanaque se publica igual. La sección de tallas es la última
    // de la página y es consultable; la marea es a lo que se viene.
    expect(
      perdidas,
      `una fila de la tabla de tallas del Anexo II deja sin publicar ${perdidas.length} de las 3 ` +
        `páginas de puerto medidas (build código ${construccion.codigo})`,
    ).toEqual([]);
  } finally {
    rmSync(datos, { recursive: true, force: true });
    if (dist !== "") rmSync(dist, { recursive: true, force: true });
  }
});
