/**
 * **A12 · la promesa vs lo entregado** — pase adversario de T-14B, sobre el `null`.
 *
 * La promesa que se ataca: *un `null` significa «no se pudo medir», no «cero»*. El `null` viaja
 * bien —el verificador comprobó que está **presente** en el cuerpo de `/v1/ports`, con `in` y no
 * con `!== undefined`— y hasta ahí la trayectoria cumple. El ataque va un paso más allá: un `null`
 * presente pero **explicado con el motivo equivocado** dice algo falso con más autoridad que un
 * hueco, porque el hueco al menos no afirma nada.
 *
 * Lo que publica el contrato del API (`apps/api/README.md`, la tabla de `quality` que estrena
 * T-14B):
 *
 * > `hw_time_err_p95_min` … `null` = **la observación existe** pero no tiene pleamares
 * > identificables (marea de centímetros con residuo meteorológico por encima).
 *
 * Lo que publica la **ficha de esos mismos puertos**, en la fila de esa misma métrica:
 *
 * > Error de hora de la pleamar (p95) — *no hay observación de este puerto con la que medirlo*
 *
 * No son matices distintos del mismo hecho: son hechos contrarios. En 118 de los 153 puertos no hay
 * observación ninguna (su fila de RMSE lo dice con las mismas palabras), así que el motivo que
 * documenta el API —«hay observación, pero la marea es de centímetros»— es falso justo en el 77 %
 * del catálogo. Quien lea el contrato y filtre por `hw_time_err_p95_min === null` creyendo que
 * recoge puertos micromareales medidos, recoge sobre todo puertos **sin medir**.
 *
 * **Dónde mira este ataque.** A los dos artefactos publicados, no a la función que los genera: el
 * README que se sirve como contrato y el HTML de `dist/` de las 153 fichas. El cuerpo HTTP se
 * comprobó aparte contra el API real (`deno task start` + `curl /v1/ports`): 131 puertos con
 * `hw_time_err_p95_min: null`, de los cuales 118 con `rmse_m: null` también — las mismas 118.
 *
 * El assert afirma **el comportamiento correcto** (que las dos superficies no expliquen el mismo
 * `null` con motivos contrarios), no el síntoma.
 */

import { globSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "../../fixtures/qa-bundle";
import { cerrarLaSalidaAInternet } from "./utiles.ts";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const DIST = join(RAIZ, "apps", "web", "dist");
const CONTRATO = join(RAIZ, "apps", "api", "README.md");

/** Lo que el contrato del API afirma hoy del `null` de la p95. Si se reescribe, este test lo dice. */
const MOTIVO_DOCUMENTADO = "`null` = la observación existe pero **no tiene pleamares identificables**";
/** Lo que la ficha del puerto dice de esa misma celda cuando no hay con qué medir. */
const MOTIVO_DE_LA_FICHA = "no hay observación de este puerto con la que medirlo";

const FILA = /<p class="datos__fila"><span>([^<]+)<\/span><span class="datos__valor">(.*?)<\/span><\/p>/gsu;
const RMSE = "Error cuadrático medio frente a la observación";
const P95 = "Error de hora de la pleamar (p95)";

/** Las filas de la tabla «Calidad y procedencia del dato» de una ficha construida. */
function filasDeCalidad(html: string): Map<string, string> {
  const filas = new Map<string, string>();
  for (const fila of html.matchAll(FILA)) {
    filas.set(fila[1] ?? "", (fila[2] ?? "").replace(/<[^>]+>/gu, ""));
  }
  return filas;
}

test.use({ javaScriptEnabled: false });

test("A12 · el mismo `null` no se explica con dos motivos contrarios en dos superficies", async ({
  page,
  qa,
}) => {
  test.fail(); // hallazgo ABIERTO (ledger 2026-08-29).

  qa.step("leer del contrato del API qué dice que significa el null de hw_time_err_p95_min");
  const contrato = readFileSync(CONTRATO, "utf8");
  expect(
    contrato,
    "el contrato ya no dice lo que este ataque reproduce: reléelo antes de tocar el assert",
  ).toContain(MOTIVO_DOCUMENTADO);

  qa.step("recorrer las 153 fichas construidas y quedarse con las que niegan tener observación");
  const fichas = globSync("mareas/*/*/*/index.html", { cwd: DIST });
  const sinObservacion = fichas.filter((ficha) => {
    const filas = filasDeCalidad(readFileSync(join(DIST, ficha), "utf8"));
    return (
      (filas.get(RMSE) ?? "").includes(MOTIVO_DE_LA_FICHA) &&
      (filas.get(P95) ?? "").includes(MOTIVO_DE_LA_FICHA)
    );
  });

  qa.step("abrir una de ellas en el navegador y leerle la celda con sus palabras");
  await cerrarLaSalidaAInternet(page);
  const muestra = sinObservacion[0] ?? fichas[0] ?? "";
  await page.goto(`/${muestra.replace(/index\.html$/u, "")}`);
  const celda = page
    .locator(".datos__fila", { hasText: P95 })
    .locator(".datos__valor")
    .first();
  qa.step(`«${P95}» en ${muestra}: ${await celda.innerText()}`);
  await expect(celda).toHaveText(MOTIVO_DE_LA_FICHA);

  expect(
    sinObservacion.length,
    `puertos cuya ficha dice que NO hay observación mientras el contrato de /v1/ports afirma que ` +
      `su hw_time_err_p95_min es null porque «la observación existe»: ${sinObservacion.length} de ` +
      `${fichas.length}. Muestra: ${sinObservacion.slice(0, 3).join(" | ")}`,
  ).toBe(0);
});
