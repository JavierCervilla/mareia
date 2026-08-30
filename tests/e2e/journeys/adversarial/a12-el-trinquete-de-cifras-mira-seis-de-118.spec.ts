/**
 * A12 · **El trinquete que vigila que se publique la redacción en vigor mira 6 de las 118 cifras, y
 * solo en 1 de los 3 caladeros.**
 *
 * G3 existe por un defecto medido de la fuente: un bloque del texto consolidado del BOE **apila
 * varias redacciones** y solo la última rige, así que un parser que leyera la equivocada publicaría
 * tallas derogadas. La cura fue un trinquete sobre el dataset publicado con las seis especies
 * canarias que movió el RD 936/2025 (`TRINQUETE_CANARIO`, en `data/pipeline/.../normativa.py`).
 *
 * Los tres bloques apilan tres redacciones cada uno —comprobado en las propias fixtures del
 * pipeline: `ani`, `anii` y `aniii` traen `BOE-A-1995-8639`, una intermedia y `BOE-A-2025-22024`—.
 * El trinquete cubre uno. Y dentro de ese uno cubre 6 de sus 31 especies: la fila de al lado no la
 * mira nadie.
 *
 * Medido en este pase, plantando **una cifra distinta** en una especie de cada caladero (Merluza
 * del Anexo I, 27 → 7 cm, 47 puertos; Salmonete del Anexo II, 11 → 3 cm, 80 puertos; Vieja colorada
 * del Anexo III, 22 → 5 cm, 26 puertos — la última en la misma tabla que G3 vigila, dos filas por
 * debajo de una de las seis que sí mira):
 *
 * | Gate | Resultado |
 * |---|---|
 * | `python run.py check` (G1 + G3 + caladeros) | verde, 0 |
 * | `python -m pytest tests` del pipeline | verde, 1759 pasan |
 * | `pnpm -r test` (557 tests, incluidos los del `dist/`) | verde |
 * | `pnpm lint` | verde, 0 |
 * | `pnpm --filter web build` | verde, 0 |
 *
 * Y la página publica lo plantado con toda la ceremonia de autoridad de la sección: `Merluza ·
 * Merluccius merluccius · 7 cm` en Vigo y `Vieja colorada · 5 cm` en Telde, bajo el enlace ELI, el
 * sello «Vigencia comprobada contra el BOE el …» y el aviso de que solo el BOE es auténtico.
 *
 * Lo que este recorrido afirma no es que haya que congelar 118 números a mano: es que **hoy no hay
 * ningún gate que compare lo publicado con la fuente**, y que el único que compara algo mira el 5 %
 * de las cifras. El trinquete de G3 protege la clase de fallo que lo motivó únicamente en el tercio
 * del dataset donde se detectó, que es el mismo patrón que ya se cazó dos veces en esta trayectoria
 * (el recorrido A5 que solo miraba Vigo y no vio desbordarse los 80 puertos mediterráneos).
 *
 * **Método.** Cero mutaciones del árbol de trabajo: el dataset con la cifra plantada se escribe en
 * un `data/` efímero y se le pasan a los gates por donde ellos ya aceptan que se les pase
 * (`normativa.cargar(<ruta>)` para los de Python, `MAREIA_DATA_DIR` para los de la web). Antes de
 * cada ataque se corren los mismos gates sobre el dataset **publicado** y se exige que salgan
 * verdes: si no corren, el ataque es inconcluso y no un hallazgo.
 */

import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "../../fixtures/qa-bundle";

import { RAIZ } from "./utiles";
import { DATASET, dataDirEfimero, especieDe } from "./utiles-normativa";

test.setTimeout(300_000);

/** El intérprete del pipeline: el del venv del contenedor, o el del sistema en CI. */
function python(): string {
  const venv = join(RAIZ, "data", "pipeline", ".venv", "bin", "python");
  return existsSync(venv) ? venv : "python3";
}

/**
 * G1 + G3 sobre un dataset dado, que es exactamente lo que llama `run.py check` en
 * `_check_normativa`. Devuelve los errores que el gate ve.
 */
function gatesDelPipeline(dataset: string): string[] {
  const programa = [
    "import sys, json",
    "from pathlib import Path",
    "from mareia_pipeline import normativa",
    "d = normativa.cargar(Path(sys.argv[1]))",
    "print(json.dumps(normativa.errores_de_procedencia(d) + normativa.errores_de_trinquete(d)))",
  ].join("\n");
  const salida = execFileSync(python(), ["-c", programa, dataset], {
    cwd: join(RAIZ, "data", "pipeline"),
    encoding: "utf8",
    stdio: "pipe",
  });
  return JSON.parse(salida.trim().split("\n").at(-1) ?? "[]") as string[];
}

/** El gate de contenido de la web sobre el dataset de un `data/` dado. Devuelve su código. */
function gateDeLaWeb(dataDir: string): number {
  try {
    execFileSync(
      "node",
      ["--experimental-strip-types", "--test", "apps/web/src/modulos/normativa.test.ts"],
      { cwd: RAIZ, env: { ...process.env, MAREIA_DATA_DIR: dataDir }, stdio: "pipe" },
    );
    return 0;
  } catch (fallo) {
    return (fallo as { status?: number }).status ?? 1;
  }
}

/** Una cifra plantada: qué especie, de qué caladero, y con cuántos puertos detrás. */
const PLANTADAS = [
  { caladero: "cantabrico-noroeste-y-golfo-de-cadiz", especie: "Merluza", cm: 7, puertos: 47 },
  { caladero: "mediterraneo", especie: "Salmonete", cm: 3, puertos: 80 },
  { caladero: "canario", especie: "Vieja colorada", cm: 5, puertos: 26 },
  // El caso extremo, y el que más se lee mal: una talla mínima de CERO no es una cifra rara, es
  // «no hay mínimo». `magnitud()` solo exige que sea un número finito, así que 0 —y −11— pasan la
  // lectura defensiva y se pintan como cifra, con `tabular-nums` y todo.
  { caladero: "mediterraneo", especie: "Sardina", cm: 0, puertos: 80 },
] as const;

for (const plantada of PLANTADAS) {
  test(`A12 · cambiar la talla de ${plantada.especie} (${plantada.puertos} puertos) tiene que poner algún gate en rojo`, async ({
    qa,
  }) => {
    // TRINQUETE · Hallazgo ABIERTO (bundles fd2f39c2240e · b99b1319c77b · 8c682eb6ac5d ·
    // 96f82e9917f8, uno por especie). Quítalo el día en que cambiar una cifra publicada ponga algo en rojo.
    test.fail();

    qa.step("los gates tienen que estar vivos: verdes sobre el dataset publicado");
    // Si esto no sale verde, un rojo posterior no probaría nada y un verde tampoco.
    expect(gatesDelPipeline(DATASET), "INCONCLUSO: G1/G3 no salen verdes sobre lo publicado").toEqual(
      [],
    );

    const datos = dataDirEfimero((normativa) => {
      const especie = especieDe(normativa, plantada.caladero, plantada.especie);
      especie.talla = { tipo: "longitud_cm", cm: plantada.cm };
      especie.textoOriginal = String(plantada.cm);
    });

    try {
      qa.step(`plantar ${plantada.especie} = ${plantada.cm} cm en ${plantada.caladero}`);
      const dataset = join(datos, "normativa", "tallas-minimas.json");

      qa.step("correr G1 + G3, los mismos que corre `run.py check`");
      const errores = gatesDelPipeline(dataset);

      qa.step("correr el gate de contenido de la web sobre ese mismo dataset");
      const codigoWeb = gateDeLaWeb(datos);

      // El comportamiento CORRECTO: una cifra legal que no es la de la norma no llega a publicarse
      // sin que nada se ponga rojo. Da igual quién la cace.
      const cazado = errores.length > 0 || codigoWeb !== 0;
      expect(
        cazado,
        `${plantada.especie} se publica a ${plantada.cm} cm en ${plantada.puertos} puertos y ` +
          `ningún gate lo ve (G1/G3 sin errores, gate de la web con código ${codigoWeb})`,
      ).toBe(true);
    } finally {
      rmSync(datos, { recursive: true, force: true });
    }
  });
}
