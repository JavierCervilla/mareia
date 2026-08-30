/**
 * A12 · **El derivado se commitea y nada lo vuelve a derivar. Un error de 255 metros en una
 * constante del elipsoide produce un fichero que la escalera entera da por bueno, y cinco puertos
 * cambian de bando en la única frase que dice de qué lado del borde están.**
 *
 * Este ataque no planta una mentira: **reproduce una equivocación**. Se copió `data/pipeline` a un
 * árbol de usar y tirar, se cambió el semieje mayor del GRS80 de `6_378_137.0` a `6_378_392.1`
 * —255,1 m, un 0,004 %, el tamaño de una errata— y se volvió a correr la ingesta contra el ZIP de
 * RAMPE ya descargado. Lo que salió:
 *
 * * `utm.errores_de_reproyeccion()` (**gate P1**) devuelve **cero fallos**. Sus cinco capas siguen
 *   verdes: el arco de meridiano compara la serie contra una cuadratura que usa **el mismo**
 *   semieje y la discrepancia se cancela; las invariantes de UTM y la escala de la serie son
 *   independientes de la escala; el punto publicado por Snyder corre sobre **Clarke 1866**, que este
 *   error no toca; y las dos anclas geográficas tienen una tolerancia de **25 km**, que se traga un
 *   desvío de 255 m sin pestañear. `run.py check` sigue imprimiendo *«✓ P1 · la inversa de Krüger
 *   cae donde debe»*.
 * * El derivado sale con **las mismas 348 relaciones**, los **mismos 143/153** puertos y los
 *   **mismos 10** sin ninguna, y con `entranSoloPorElBorde` = 6, que es lo que mira P5.
 * * **191 de las 348 relaciones cambian de distancia** y **cinco cambian de `dentro`**.
 *
 * Con ese fichero commiteado y el código del repositorio intacto —que es exactamente lo que pasa si
 * la ingesta se corre una vez en un entorno con una constante mal copiada— se midieron las órdenes
 * de CI: `pnpm --filter web build` **0** · `pnpm test` **0** · `python run.py check` **0** ·
 * `pytest tests -q` **1851 passed** · `ruff check .` **0**.
 *
 * Lo que cambia en la página es la frase más fuerte que la sección sabe decir:
 *
 * | puerto | área | publicado | con el elipsoide desviado |
 * |---|---|---|---|
 * | Níjar | Reserva marina del Cabo de Gata-Níjar | *cae dentro* | (se calla) |
 * | Elantxobe | Espacio marino de la Ría de Mundaka-Cabo de Ogoño | *cae dentro* | (se calla) |
 * | Ciutadella de Menorca | Espacio marino del norte y oeste de Menorca | *cae dentro* | (se calla) |
 * | Cabo de Palos | Espacio marino de Tabarca-Cabo de Palos | (nada) | ***cae dentro*** |
 * | O Grove | Corredor migratorio galaico-cantábrico occidental | (nada) | ***cae dentro*** |
 *
 * El recorrido no rehace la ingesta —el ZIP de RAMPE son 12 MB que no se versionan y CI no baja—:
 * aplica **los cinco vuelcos medidos** sobre el derivado publicado, que es la parte del cambio que
 * se lee en la página, y comprueba si algo se pone rojo. No se pone.
 *
 * (Que un `dentro` **inventado** no lo cace nadie ya estaba visto. Lo que este recorrido añade es de
 * dónde sale: no hace falta que nadie mienta, basta con que la ingesta corra una vez con una
 * constante mal copiada, porque el artefacto es lo que se commitea y ningún gate sabe si salió de
 * la fuente.)
 */

import { rmSync } from "node:fs";

import { expect, test } from "../../fixtures/qa-bundle";

import {
  areaDe,
  construirConDataDir,
  dataDirEfimero,
  derivadoPublicado,
  paginaDePuerto,
  puertoDe,
  seccionDeAreas,
  textoDe,
} from "./utiles-areas";

/** Los cinco `dentro` que vuelcan con el semieje del GRS80 desviado 255,1 m. Medidos, no elegidos. */
const VUELCOS = [
  { slug: "nijar", codigo: "555552486", publicado: true },
  { slug: "elantxobe", codigo: "ES0000490", publicado: true },
  { slug: "ciutadella-de-menorca", codigo: "ES0000521", publicado: true },
  { slug: "cabo-de-palos", codigo: "ES0000508", publicado: false },
  { slug: "o-grove", codigo: "ES0000554", publicado: false },
] as const;

/** La frase que la sección escribe cuando el puerto cae dentro del área. */
const DENTRO = "cae dentro de esta área";

test("A12 · un derivado salido de una reproyección desviada tiene que poner algo en rojo", async ({
  qa,
}) => {
  // HALLAZGO ABIERTO. El `test.fail()` mantiene CI en verde mientras el defecto vive; el día que
  // algo ate el derivado a la fuente —o el `dentro` a algo que no sea él mismo—, Playwright dirá
  // «expected to fail, but passed» y este recorrido se quedará como gate permanente.
  test.fail();

  qa.step("de partida: los cinco `dentro` publicados son los que dice el derivado de hoy");
  const publicado = derivadoPublicado();
  for (const vuelco of VUELCOS) {
    expect(
      areaDe(puertoDe(publicado, vuelco.slug), vuelco.codigo).dentro,
      `INCONCLUSO: ${vuelco.slug}/${vuelco.codigo} ya no publica lo que se midió`,
    ).toBe(vuelco.publicado);
  }

  qa.step("aplicar los cinco vuelcos que produce el elipsoide desviado");
  const datos = dataDirEfimero((derivado) => {
    for (const vuelco of VUELCOS) {
      areaDe(puertoDe(derivado, vuelco.slug), vuelco.codigo).dentro = !vuelco.publicado;
    }
  });

  try {
    qa.step("construir el sitio con ese derivado");
    const construccion = construirConDataDir(datos);
    // Si el build fallara, el hallazgo no existiría: sería un fail-safe. No falla.
    expect(construccion.codigo, `el build dice:\n${construccion.salida}`).toBe(0);

    qa.step("Níjar deja de decir que el puerto cae dentro de la reserva marina, y nadie chista");
    const nijar = paginaDePuerto(construccion.destino, "nijar");
    expect(nijar, "el build no publicó la página de Níjar").not.toBeNull();
    expect(
      textoDe(seccionDeAreas(nijar ?? "")),
      "Níjar ha dejado de decir que está dentro de la Reserva marina del Cabo de Gata-Níjar",
    ).toContain(DENTRO);

    qa.step("y Cabo de Palos empieza a decirlo sin estarlo");
    const palos = paginaDePuerto(construccion.destino, "cabo-de-palos");
    expect(
      textoDe(seccionDeAreas(palos ?? "")),
      "Cabo de Palos afirma caer dentro de un espacio en el que no cae",
    ).not.toContain(DENTRO);
    rmSync(construccion.destino, { recursive: true, force: true });
  } finally {
    rmSync(datos, { recursive: true, force: true });
  }
});
