/**
 * A6 · **La regla dura de la trayectoria («la presencia no es abundancia») la sostienen dos
 * constantes del código y una cadena de texto libre del JSON. Por esa tercera entra una afirmación
 * sobre el mar que nadie ha comprobado, con toda la escalera en verde.**
 *
 * El módulo lo dice en su propia cabecera, y es la lección que se pagó en T-21:
 *
 * > «**Y por eso ninguna de las dos frases duras viaja en el dataset** … Aquí la frase que impide
 * > leer 12 registros como doce doradas (`SESGO_JUNTO_A_LA_CIFRA`) y la que dice que la caja
 * > envolvente no es la costa (`LA_CAJA_NO_ES_LA_COSTA`) son **constantes del código**.»
 * > (`packages/modules/species/src/textos.ts`)
 *
 * Las dos lo son, y bien: el gate E4 las busca literales en el `dist/` y el gate del pipeline exige
 * que el `sesgo` del dataset sea `obis.SESGO` byte a byte. Pero la columna de presencia tiene
 * **tres** salidas, no dos, y la tercera —la que se escribe cuando no hay cifra porque no se llegó a
 * preguntar a OBIS— es `presenciaAusente`, una cadena del JSON que la vista imprime **tal cual**:
 *
 * ```ts
 * presencia: caladero.presencia === null ? (caladero.presenciaAusente ?? SIN_REGISTROS) : …
 * ```
 *
 * Lo que la vigila es sólo que **exista**: `errores_de_presencia` comprueba `.strip()` no vacío y
 * nada más. Y E4 no la ve, porque su patrón es `\d+ registros?` y una frase sin cifra no lo dispara.
 *
 * **El ataque.** Se cambia esa única cadena —hoy dice, correctamente, «sin taxón resuelto no se
 * pregunta a OBIS: un cero de una búsqueda que no puede acertar se lee como ausencia de la especie,
 * y eso sería mentir sobre el mar»— por una afirmación de ausencia:
 *
 * > «Sin registros: OBIS confirma que la especie no está presente en este caladero.»
 *
 * Es exactamente lo que la trayectoria existe para impedir, dicho en la columna que existe para
 * impedirlo, y sobre la única fila del catálogo a la que **no se le preguntó nada** a OBIS. Y sale
 * publicado con los gates del pipeline en verde y el build en verde.
 *
 * Es el mismo hallazgo H-1 de T-21 en otro campo: allí el aviso que sostenía la promesa era texto
 * libre del JSON y un aviso plantado de los mismos bytes se publicó en 153 páginas con toda la
 * escalera verde. La cura de aquella vez se aplicó a dos de las tres frases de esta columna.
 *
 * **Qué se afirma aquí (el comportamiento correcto):** la columna de presencia no publica una
 * afirmación sobre lo que hay o no hay en el mar que venga del dato, sea cual sea el dato. El día
 * que la frase del silencio salga del código —o que un gate la contraste contra una lista cerrada de
 * motivos—, este cuerpo pasa solo.
 *
 * **Método.** Cero mutaciones del árbol de trabajo: el catálogo con la frase plantada se escribe en
 * un `data/` efímero y se le pasa al build por donde el propio sitio ya acepta que se le pase
 * (`MAREIA_DATA_DIR`), con `astro build --outDir` escribiendo fuera del repositorio. Antes de atacar
 * se corren los gates del pipeline sobre el catálogo **publicado** y se exige verde: si no corren,
 * el ataque es inconcluso y no un hallazgo.
 */

import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "../../fixtures/qa-bundle";

import {
  catalogoPublicado,
  construirConDataDir,
  dataDirEfimero,
  gatesDelPipeline,
  textoDe,
} from "./utiles-especies";

test.setTimeout(300_000);

/** La afirmación plantada. No lleva ninguna cifra: E4 sólo mira donde hay un número. */
const AFIRMACION_PLANTADA =
  "Sin registros: OBIS confirma que la especie no está presente en este caladero.";

test("A6 · ninguna frase de la columna de presencia afirma qué hay en el mar", async ({ qa }) => {
  // TRINQUETE · hallazgo ABIERTO: se espera que falle, así que `pnpm test:e2e` sigue en verde.
  // El día que alguien lo arregle, Playwright avisará de que «pasó lo que se esperaba que fallara»
  // → se quita esta línea y el ataque queda como gate permanente.
  test.fail();

  qa.step("comprobar que los gates del pipeline están verdes sobre el catálogo publicado");
  const limpio = dataDirEfimero(() => {});
  let sucio = "";
  const construidos: string[] = [];
  try {
    expect(
      gatesDelPipeline(limpio),
      "los gates del pipeline ya ven problemas sin atacar nada: el ataque sería inconcluso",
    ).toEqual([]);

    qa.step("plantar una afirmación de ausencia en la única frase de presencia que sale del JSON");
    const catalogo = catalogoPublicado();
    const conAusencia = catalogo.especies.filter((especie) =>
      especie.caladeros.some((caladero) => (caladero.presenciaAusente ?? "").length > 0),
    );
    expect(
      conAusencia.length,
      "ninguna fila publica `presenciaAusente`: el ataque no tiene por dónde entrar",
    ).toBeGreaterThan(0);
    sucio = dataDirEfimero((crudo) => {
      const especies = crudo["especies"] as Record<string, unknown>[];
      for (const especie of especies) {
        for (const caladero of especie["caladeros"] as Record<string, unknown>[]) {
          if (caladero["presencia"] === null && typeof caladero["presenciaAusente"] === "string") {
            caladero["presenciaAusente"] = AFIRMACION_PLANTADA;
          }
        }
      }
    });

    qa.step("los gates del pipeline, sobre el catálogo con la frase plantada");
    const problemas = gatesDelPipeline(sucio);

    qa.step("construir el sitio con ese catálogo y leer la página del catálogo");
    const construccion = construirConDataDir(sucio);
    construidos.push(construccion.destino);
    expect(construccion.codigo, `el build falló:\n${construccion.salida.slice(-800)}`).toBe(0);
    const publicado = textoDe(
      readFileSync(join(construccion.destino, "pesca", "especies", "index.html"), "utf8"),
    );

    // El comportamiento CORRECTO: la afirmación no llega a la página. Da igual por cuál de las dos
    // puertas se cierre —que el dato no pueda decirla, o que un gate la pare—; lo que no vale es
    // que salga publicada, que es lo que pasa hoy. Los gates que la vieron viajan en el mensaje
    // para que el bundle deje escrito con qué escalera se publicó.
    expect(
      publicado.includes(AFIRMACION_PLANTADA),
      `«${AFIRMACION_PLANTADA}» se publica en la columna de presencia del catálogo. Gates del ` +
        `pipeline que lo vieron: ${problemas.length === 0 ? "ninguno" : problemas.join(" · ")}. ` +
        "Build: 0.",
    ).toBe(false);
  } finally {
    for (const destino of [limpio, sucio, ...construidos]) {
      if (destino !== "") rmSync(destino, { recursive: true, force: true });
    }
  }
});
