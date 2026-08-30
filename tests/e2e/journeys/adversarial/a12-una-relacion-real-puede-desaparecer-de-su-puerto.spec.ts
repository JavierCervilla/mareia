/**
 * A12 · **La promesa dice «TODAS las áreas cuyo borde está a menos de 30 km». Lo único que lo
 * sostiene es un total: 348. Y el total se conserva moviendo una relación de un puerto a otro.**
 *
 * El derivado se **commitea** y CI **no lo vuelve a derivar de la fuente**: `run.py areas-protegidas`
 * necesita red y el job `data-pipeline` no la usa a propósito. Así que todo lo que mira el fichero
 * mira **coherencia interna**:
 *
 * * `errores_de_cobertura` recalcula el resumen **desde el contenido** (`resumen_de(puertos)`) y lo
 *   compara con el publicado. Un fichero al que le falte una relación y traiga el resumen al día es,
 *   para este gate, un fichero coherente.
 * * `errores_de_divergencia` compara `comparativa.relacionesPorBorde` con `resumen.relaciones`. Las
 *   dos cifras son 348 antes y después de mover una fila de sitio.
 * * En la web, `apps/web/src/areas-protegidas-construido.test.ts` compara lo publicado en el HTML
 *   con **el mismo derivado que generó el HTML** —es autorreferencial— y sólo tiene dos números
 *   propios: `assert.equal(comprobadas, 348)` y la lista de los diez puertos sin áreas.
 *
 * Este ataque respeta los dos números. Le quita a **el Vendrell** la *Reserva marina de Masía
 * Blanca* —su fila más cercana, a 0,1 km, y la única RESERVA MARINA que tiene— y le da a
 * **Carboneras** esa misma reserva «a menos de 28 km», cuando está a unos 700 km de allí. El total
 * sigue siendo 348, los diez vacíos siguen siendo diez, y las dos páginas mienten en direcciones
 * opuestas: una calla una reserva que tiene al lado y la otra inventa una que no existe.
 *
 * **Medido con las órdenes que corre CI**, con el fichero mutado en su sitio:
 * `pnpm --filter web build` 0 · `pnpm test` 0 · `python run.py check` 0 · `pytest` 1851 passed ·
 * `ruff check .` 0.
 *
 * Nada de esto necesita mala fe: es el modo de fallo de un artefacto que se edita a mano, se
 * commitea, y del que ningún gate sabe si sale de la fuente.
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

/** La reserva marina que el Vendrell tiene a 0,1 km, y que este ataque le quita. */
const RESERVA = { codigo: "555552489", nombre: "Reserva marina de Masía Blanca" } as const;

test("A12 · quitarle a un puerto la reserva marina que tiene al lado tiene que poner algo en rojo", async ({
  qa,
}) => {
  // HALLAZGO ABIERTO. El `test.fail()` mantiene CI en verde mientras el defecto vive; el día que
  // algo ate las relaciones de cada puerto a algo que no sea el total, Playwright dirá «expected to
  // fail, but passed» y este recorrido se quedará como gate permanente.
  test.fail();

  qa.step("de partida: el Vendrell publica la reserva a 0,1 km y Carboneras no la publica");
  const publicado = derivadoPublicado();
  const vendrell = puertoDe(publicado, "el-vendrell");
  expect(areaDe(vendrell, RESERVA.codigo).distanciaAproxKm, "INCONCLUSO: ha cambiado el dato").toBe(
    0.1,
  );
  expect(
    puertoDe(publicado, "carboneras").areas.map((area) => area.codigo),
    "INCONCLUSO: Carboneras ya publicaba esta reserva",
  ).not.toContain(RESERVA.codigo);
  expect(publicado.resumen.relaciones).toBe(348);

  qa.step("mover la relación: fuera de el Vendrell, dentro de Carboneras, y el total no se entera");
  const datos = dataDirEfimero((derivado) => {
    const origen = puertoDe(derivado, "el-vendrell");
    const fuera = areaDe(origen, RESERVA.codigo);
    origen.areas = origen.areas.filter((area) => area.codigo !== RESERVA.codigo);
    const destino = puertoDe(derivado, "carboneras");
    destino.areas = [...destino.areas, { ...fuera, distanciaAproxKm: 28.0, dentro: false }].sort(
      (a, b) => a.distanciaAproxKm - b.distanciaAproxKm,
    );
    // El resumen se recalcula solo en el gate, así que basta con dejarlo coherente: es justo lo que
    // hace que el fichero pase por bueno.
    derivado.resumen = {
      ...derivado.resumen,
      relaciones: derivado.puertos.reduce((suma, puerto) => suma + puerto.areas.length, 0),
    };
  });

  try {
    qa.step("construir el sitio con el derivado movido");
    const construccion = construirConDataDir(datos);
    expect(construccion.codigo, `el build dice:\n${construccion.salida}`).toBe(0);

    qa.step("la página de el Vendrell ya no nombra la reserva que tiene a 100 metros");
    const html = paginaDePuerto(construccion.destino, "el-vendrell");
    expect(html, "el build no publicó la página de el Vendrell").not.toBeNull();
    const leido = textoDe(seccionDeAreas(html ?? ""));
    expect(
      leido,
      "el Vendrell ha dejado de publicar una reserva marina real y ningún gate lo ha visto",
    ).toContain(RESERVA.nombre);

    qa.step("y Carboneras publica esa reserva como si la tuviera a 28 km");
    const otra = paginaDePuerto(construccion.destino, "carboneras");
    expect(textoDe(seccionDeAreas(otra ?? "")), "Carboneras publica un área inventada").not.toContain(
      RESERVA.nombre,
    );
    rmSync(construccion.destino, { recursive: true, force: true });
  } finally {
    rmSync(datos, { recursive: true, force: true });
  }
});
