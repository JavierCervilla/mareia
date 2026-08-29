/**
 * **A12 · la promesa vs lo entregado** — pase adversario de T-14B, sobre el `null`.
 *
 * La promesa atacada: *un `null` significa «no se pudo medir», no «cero»*. El `null` viajaba bien
 * —el verificador comprobó que está **presente** en el cuerpo de `/v1/ports`, con `in` y no con
 * `!== undefined`—, así que el ataque fue un paso más allá: un `null` presente pero **explicado con
 * el motivo equivocado** dice algo falso con más autoridad que un hueco, porque el hueco al menos
 * no afirma nada.
 *
 * Lo que el contrato publicaba de `hw_time_err_p95_min` (`apps/api/README.md`): «`null` = la
 * observación existe pero **no tiene pleamares identificables**». Lo que la ficha de esos mismos
 * puertos decía en la fila de esa misma métrica: «no hay observación de este puerto con la que
 * medirlo». Dos superficies del mismo portal, hechos contrarios sobre el mismo `null`, y el motivo
 * documentado cierto en 13 de 131.
 *
 * **CORREGIDO** (H-2): el contrato separa los dos motivos en una tabla, cada uno con la frase con
 * la que la ficha lo cuenta y con **su cifra**.
 *
 * **TRINQUETE — y aquí está lo que este recorrido tiene de distinto.** Esta confusión ya se había
 * arreglado una vez (A-11 del pase de T-09, `9c6cf5a`) y volvió en cuanto el dato estrenó una
 * superficie nueva, porque lo único gateado era que el campo **estuviera**. Así que este gate no
 * comprueba presencia: ata el **significado** por los dos extremos.
 *
 *  1. Lee de la tabla del contrato **los dos casos con sus cifras** y las recalcula desde el
 *     dataset. Si alguien reescribe una frase, o el catálogo crece sin que el contrato se entere,
 *     sale en rojo.
 *  2. Clasifica las 153 **fichas construidas** por lo que dicen sus dos filas de calidad y exige
 *     que el reparto sea el mismo, puerto a puerto: las dos superficies publicadas no pueden
 *     explicar el mismo `null` con motivos distintos sin que esto se ponga en rojo con el slug.
 *
 * El tercer extremo —que la clasificación del cuerpo HTTP servido cuadre con un campo del dataset
 * que no viaja por el API, `metrics.samples`— lo ata el gate hermano de
 * `apps/api/src/http/core_test.ts`, que es donde se puede hablar HTTP.
 *
 * Se mira a los **artefactos publicados** (el README que se sirve como contrato y el HTML de
 * `dist/`), no a la función que los genera, y con el motor de JavaScript apagado.
 */

import { globSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "../../fixtures/qa-bundle";
import { cerrarLaSalidaAInternet } from "./utiles.ts";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const DIST = join(RAIZ, "apps", "web", "dist");
const CONTRATO = join(RAIZ, "apps", "api", "README.md");

/** Lo que la ficha dice cuando no hay observación ninguna con la que medir nada. */
const FRASE_SIN_OBSERVACION = "no hay observación de este puerto con la que medirlo";
/** Lo que la ficha dice cuando la observación existe y lo que falta son las pleamares. */
const FRASE_MICROMAREAL = "sin pleamares medibles en la observación";

/** Los tres casos, con el nombre con el que los nombra la tabla del contrato. */
const SIN_OBSERVACION = "sin observación";
const MICROMAREAL = "micromareal medido";
const MEDIDO = "medido con pleamares";

const FILA =
  /<p class="datos__fila"><span>([^<]+)<\/span><span class="datos__valor">(.*?)<\/span><\/p>/gsu;
const RMSE = "Error cuadrático medio frente a la observación";
const P95 = "Error de hora de la pleamar (p95)";

/**
 * Una fila de la tabla de casos del contrato: qué dice que significa y a cuántos puertos les pasa.
 *
 * La fila que se parsea tiene esta forma:
 * `| **sin observación** | null | null | No hay observación… | **118** de **153** |`
 */
interface CasoPublicado {
  readonly significado: string;
  readonly puertos: number;
  readonly total: number;
}

const FILA_DEL_CONTRATO =
  /^\|\s*\*\*([^*|]+)\*\*\s*\|[^|]*\|[^|]*\|([^|]*)\|\s*\*\*(\d+)\*\* de \*\*(\d+)\*\*\s*\|$/gmu;

function casosDelContrato(): Map<string, CasoPublicado> {
  const contrato = readFileSync(CONTRATO, "utf8");
  const casos = new Map<string, CasoPublicado>();
  for (const fila of contrato.matchAll(FILA_DEL_CONTRATO)) {
    casos.set((fila[1] ?? "").trim(), {
      significado: (fila[2] ?? "").trim(),
      puertos: Number(fila[3]),
      total: Number(fila[4]),
    });
  }
  return casos;
}

interface PuertoDelCatalogo {
  readonly slug: string;
  readonly stationFile: string;
}

/** Cada puerto del dataset en su caso, con los dos `null` leídos del JSON de su estación. */
function casosDelDataset(): Map<string, string> {
  const { ports } = JSON.parse(readFileSync(join(RAIZ, "data", "geo", "ports.json"), "utf8")) as {
    ports: readonly PuertoDelCatalogo[];
  };
  return new Map(
    ports.map((puerto) => {
      const { quality } = JSON.parse(
        readFileSync(join(RAIZ, "data", "stations", puerto.stationFile), "utf8"),
      ) as { quality: { rmse_m: number | null; hw_time_err_p95_min: number | null } };
      if (quality.rmse_m === null) return [puerto.slug, SIN_OBSERVACION];
      return [puerto.slug, quality.hw_time_err_p95_min === null ? MICROMAREAL : MEDIDO];
    }),
  );
}

/** Las filas de la tabla «Calidad y procedencia del dato» de una ficha construida. */
function filasDeCalidad(html: string): Map<string, string> {
  const filas = new Map<string, string>();
  for (const fila of html.matchAll(FILA)) {
    filas.set(fila[1] ?? "", (fila[2] ?? "").replace(/<[^>]+>/gu, ""));
  }
  return filas;
}

/** En qué caso cae una ficha **por lo que ella dice**, no por lo que el dataset sabe. */
function casoQueCuentaLaFicha(html: string): string {
  const filas = filasDeCalidad(html);
  const rmse = filas.get(RMSE) ?? "";
  const p95 = filas.get(P95) ?? "";
  if (rmse.includes(FRASE_SIN_OBSERVACION) && p95.includes(FRASE_SIN_OBSERVACION)) {
    return SIN_OBSERVACION;
  }
  if (p95.includes(FRASE_MICROMAREAL)) return MICROMAREAL;
  if (p95.includes(" min")) return MEDIDO;
  return `ilegible (rmse: «${rmse}», p95: «${p95}»)`;
}

/** `mareas/<region>/<provincia>/<puerto>/index.html` → `<puerto>`. */
function slugDeLaFicha(ficha: string): string {
  return ficha.split("/")[3] ?? ficha;
}

test.use({ javaScriptEnabled: false });

test("A12 · el mismo `null` no se explica con dos motivos contrarios en dos superficies", async ({
  page,
  qa,
}) => {
  qa.step("leer de la tabla del contrato los dos motivos del null y sus cifras");
  const publicados = casosDelContrato();
  const sinObservacion = publicados.get(SIN_OBSERVACION);
  const micromareal = publicados.get(MICROMAREAL);
  expect(
    [sinObservacion, micromareal].every((caso) => caso !== undefined),
    `el contrato ya no documenta los dos casos del null de «${P95}» con su cifra; casos leídos ` +
      `de apps/api/README.md: ${[...publicados.keys()].join(", ")}`,
  ).toBe(true);

  qa.step("exigir que cada caso se explique con la frase con la que la ficha lo cuenta");
  expect(
    sinObservacion?.significado,
    "el contrato explica el null «sin observación» con otras palabras que la ficha del puerto",
  ).toContain(FRASE_SIN_OBSERVACION);
  expect(
    micromareal?.significado,
    "el contrato explica el null micromareal con otras palabras que la ficha del puerto",
  ).toContain(FRASE_MICROMAREAL);

  qa.step("recalcular las cifras desde el dataset: el contrato no se cree a sí mismo");
  const delDataset = casosDelDataset();
  const cuenta = (caso: string): number =>
    [...delDataset.values()].filter((suyo) => suyo === caso).length;
  expect(
    [sinObservacion?.puertos, micromareal?.puertos, sinObservacion?.total],
    `las cifras de la tabla del contrato no son las del dataset: sin observación ` +
      `${cuenta(SIN_OBSERVACION)}, micromareales ${cuenta(MICROMAREAL)}, ` +
      `catálogo ${delDataset.size}`,
  ).toEqual([cuenta(SIN_OBSERVACION), cuenta(MICROMAREAL), delDataset.size]);

  qa.step("clasificar las fichas construidas por lo que dicen ellas y compararlo puerto a puerto");
  const fichas = globSync("mareas/*/*/*/index.html", { cwd: DIST });
  expect(fichas.length, "no hay dist/ al día: corre antes `pnpm --filter web build`").toBe(
    delDataset.size,
  );
  const contradicciones = fichas.flatMap((ficha) => {
    const slug = slugDeLaFicha(ficha);
    const dice = casoQueCuentaLaFicha(readFileSync(join(DIST, ficha), "utf8"));
    const esperado = delDataset.get(slug);
    return dice === esperado
      ? []
      : [`${slug}: su ficha cuenta «${dice}» y el contrato lo publica como «${esperado}»`];
  });
  expect(
    contradicciones,
    `fichas que explican su null con un motivo distinto del que publica el contrato de /v1/ports ` +
      `(${contradicciones.length} de ${fichas.length})`,
  ).toEqual([]);

  qa.step("abrir una ficha de cada caso y leerle la celda con sus palabras, en el navegador");
  await cerrarLaSalidaAInternet(page);
  for (const [caso, frase] of [
    [SIN_OBSERVACION, FRASE_SIN_OBSERVACION],
    [MICROMAREAL, FRASE_MICROMAREAL],
  ] as const) {
    const muestra = fichas.find((ficha) => delDataset.get(slugDeLaFicha(ficha)) === caso);
    expect(
      muestra,
      `el catálogo no tiene un solo puerto del caso «${caso}» que el contrato documenta`,
    ).toBeDefined();
    await page.goto(`/${(muestra ?? "").replace(/index\.html$/u, "")}`);
    const celda = page.locator(".datos__fila", { hasText: P95 }).locator(".datos__valor").first();
    qa.step(`«${P95}» en ${muestra}: ${await celda.innerText()}`);
    await expect(celda, `la ficha de un puerto «${caso}» no lo dice como el contrato`).toHaveText(
      frase,
    );
  }
});
