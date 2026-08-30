/**
 * A4 · **`dentro: true` apaga la única comprobación numérica que ata una distancia publicada al
 * radio del criterio, y la página acaba diciendo «a menos de 480 km» bajo un título que promete 30.**
 *
 * En `data/pipeline/mareia_pipeline/areas.py`, `errores_de_cobertura` sí mira que ninguna distancia
 * pase del radio declarado. Pero lo mira así:
 *
 * ```python
 * if isinstance(distancia, int | float) and distancia > radio and not area.get("dentro"):
 * ```
 *
 * El `and not area.get("dentro")` está para el caso legítimo del puerto muy metido en un área muy
 * grande, cuyo borde queda más allá del radio (lo dice `criterio.dentro`). El efecto colateral es
 * que **`dentro` es el interruptor de la comprobación**: en cuanto vale `true`, la distancia deja de
 * tener techo y puede ser cualquier número finito y positivo.
 *
 * Del lado de la web no hay segunda opinión: `magnitud()` sólo exige un número finito,
 * `distanciaEscrita()` sólo exige que no sea negativo, y el test del sitio construido comprueba que
 * la página diga `distanciaEscrita(area.distanciaAproxKm)` —es decir, compara el HTML con el mismo
 * dato que lo generó—.
 *
 * Resultado medido en Alicante, poniendo la tercera fila a 480 km con `dentro: true`:
 *
 * > **Áreas marinas protegidas a menos de 30 km**
 * > … Reserva marina de la Isla de Tabarca · RESERVA MARINA · **a menos de 480 km** ·
 * > *El punto de este puerto cae dentro de esta área.*
 *
 * Las dos frases se contradicen entre ellas y las dos contradicen al título. **Con las órdenes de
 * CI en verde**: `pnpm --filter web build` 0 · `pnpm test` 0 · `python run.py check` 0 ·
 * `pytest` 1851 passed · `ruff check .` 0.
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

/** La reserva marina que Alicante tiene a 19,2 km y que este ataque manda a 480. */
const AREA = "555552484";

test("A4 · una distancia publicada no puede pasar del radio que promete el título de la sección", async ({
  qa,
}) => {
  // HALLAZGO ABIERTO. El `test.fail()` mantiene CI en verde mientras el defecto vive.
  test.fail();

  qa.step("de partida: el criterio son 30 km y esa área está a 19,2");
  const publicado = derivadoPublicado();
  expect(publicado.criterio.radioKm, "INCONCLUSO: ha cambiado el radio").toBe(30);
  expect(areaDe(puertoDe(publicado, "alicante"), AREA).distanciaAproxKm).toBe(19.2);

  qa.step("mandar esa área a 480 km y marcarla como «dentro»");
  const datos = dataDirEfimero((derivado) => {
    const area = areaDe(puertoDe(derivado, "alicante"), AREA);
    area.distanciaAproxKm = 480.0;
    area.dentro = true;
  });

  try {
    qa.step("construir y leer la sección de Alicante");
    const construccion = construirConDataDir(datos);
    expect(construccion.codigo, `el build dice:\n${construccion.salida}`).toBe(0);
    const html = paginaDePuerto(construccion.destino, "alicante");
    expect(html, "el build no publicó la página de Alicante").not.toBeNull();
    const seccion = seccionDeAreas(html ?? "");
    const leido = textoDe(seccion);

    qa.step("el título sigue prometiendo 30 km");
    expect(leido, "INCONCLUSO: el título ya no promete un radio").toContain(
      "Áreas marinas protegidas a menos de 30 km",
    );

    // Aquí está el hallazgo. La aserción es la que sostiene la promesa: bajo un título que dice
    // «a menos de 30 km» no puede aparecer una cota mayor que 30.
    const cotas = [...leido.matchAll(/a menos de (\d+) km/gu)].map((m) => Number(m[1]));
    expect(cotas.length, "la sección no publica ninguna cota").toBeGreaterThan(0);
    expect(
      Math.max(...cotas),
      `la sección publica una cota fuera del radio: ${JSON.stringify(cotas)}`,
    ).toBeLessThanOrEqual(30);
    rmSync(construccion.destino, { recursive: true, force: true });
  } finally {
    rmSync(datos, { recursive: true, force: true });
  }
});
