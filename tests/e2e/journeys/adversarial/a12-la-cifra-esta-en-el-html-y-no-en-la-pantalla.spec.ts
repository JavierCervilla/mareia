/**
 * **A12 · los gates de T-34 comprueban lo que la lista DICE; hacía falta uno que mirara si se VE.**
 *
 * Lo que T-34 dejó vigilando la promesa eran cuatro cosas, y las cuatro leen texto:
 * `error-en-listas-construido.test.ts` (lee el HTML del `dist/`), `formato.test.ts` (cadenas a
 * mano), `calidad-portada.spec.ts` y `a12-picker-sin-calidad.spec.ts` (leen `textContent`, que un
 * elemento devuelve igual esté pintado o no). Ninguno preguntaba si la cifra ocupa un solo píxel.
 *
 * Y la superficie que T-34 añadió es, precisamente, **una regla CSS nueva** —`.indice__error`, en
 * `estilos/indices.css`— a una hoja donde el propio portal ya esconde entradas con `display: none`
 * (el filtro por calidad de la portada). Un `display: none` puesto *para que algo quepa en el
 * móvil* es, textualmente, la avería para la que este repositorio ya escribió **G6** en la tabla de
 * especies: *«ninguno de ellos vería un `display: none`. Todos leen el HTML; ninguno mira lo que se
 * pinta»*. La lista de puertos heredó la superficie de T-34 y no heredó G6.
 *
 * Medido en el pase, con **una línea** añadida a la hoja construida —
 * `@media (max-width:700px){.indice__error{display:none}}`, o sea sólo en el teléfono—: las 35
 * cifras seguían escritas en el HTML de la portada, **0 se veían** a 412 px, y los 318 tests de la
 * web salían **verdes**.
 *
 * **ARREGLADO (T-34): nace G7**, en `journeys/legibilidad-movil.spec.ts` — «lo que la lista dice,
 * la pantalla lo enseña», sobre las **cuatro** clases de lista (portada, 404, región y provincia) ×
 * **tres anchos** × **los dos** `<span>` de los que depende elegir puerto. Se comprobó en rojo con
 * este mismo sabotaje: nombra los puertos cuya cifra está escrita y no pintada.
 *
 * **Y este recorrido se queda de trinquete, pero con el método que su propia versión anterior
 * pedía.** Aquella decía: *«el día que exista ese gate, éste tendrá que servirse su propia copia
 * del `dist/` en su propio puerto en vez de tocar la compartida»*. Ese día es hoy, así que eso hace
 * — la hoja que sabotea es la de un espejo efímero en `/tmp`, servido en su propio puerto, y el
 * `dist/` que leen los demás workers no se toca. Mutar el árbol con la suite corriendo es el error
 * que costó cuatro rojos inventados en T-32; no se hereda por comodidad.
 *
 * Lo que afirma, entonces, no es ya el hallazgo (cerrado) sino **que la técnica de G7 muerde**: con
 * la cifra escondida por CSS, la medición de visibilidad la encuentra. Es el canario de G7 — un
 * gate cuyo instrumento nadie ha probado en rojo es una afirmación, no un gate.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { appendFileSync, cpSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "../../fixtures/qa-bundle";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const DIST = join(RAIZ, "apps", "web", "dist");
/** Un puerto propio, fuera del 4321 del arnés: la copia saboteada no comparte servidor con nadie. */
const PUERTO = 4399;
const REGRESION = "@media (max-width:700px){.indice__error{display:none}}";

/** La hoja construida donde vive `.indice__error`, dentro de un `dist/` cualquiera. */
function hojaDeIndices(raiz: string): string {
  const astro = join(raiz, "_astro");
  const hojas = readdirSync(astro)
    .filter((f) => f.endsWith(".css"))
    .filter((f) => readFileSync(join(astro, f), "utf8").includes("indice__error"));
  expect(hojas, "INCONCLUSO: `.indice__error` no está en una sola hoja del `dist/`").toHaveLength(1);
  return join(astro, hojas[0] ?? "");
}

async function esperarAlServidor(url: string): Promise<void> {
  for (let intento = 0; intento < 100; intento += 1) {
    try {
      const respuesta = await fetch(url);
      if (respuesta.ok) return;
    } catch {
      /* todavía no escucha */
    }
    await new Promise((listo) => setTimeout(listo, 100));
  }
  throw new Error(`INCONCLUSO: el espejo no llegó a servir en ${url}`);
}

test("A12 · una cifra escondida por CSS —escrita y no pintada— tiene que poner algo en rojo", async ({
  page,
  qa,
}) => {
  test.setTimeout(120_000);

  qa.step("copiar el `dist/` a un espejo efímero: el árbol compartido no se toca");
  const espejo = join(mkdtempSync(join(tmpdir(), "a-t34-pantalla-")), "dist");
  cpSync(DIST, espejo, { recursive: true });

  qa.step("esconder la cifra sólo en el teléfono, en la hoja del espejo");
  appendFileSync(hojaDeIndices(espejo), REGRESION);

  let servidor: ChildProcess | undefined;
  try {
    servidor = spawn(
      process.execPath,
      ["--experimental-strip-types", join(RAIZ, "tests", "e2e", "servidor-estatico.ts")],
      {
        env: { ...process.env, RAIZ_ESTATICA: espejo, PUERTO_ESTATICO: String(PUERTO) },
        stdio: "ignore",
      },
    );
    const base = `http://127.0.0.1:${PUERTO}`;
    await esperarAlServidor(`${base}/`);

    qa.step("abrir la portada del espejo a 360 px y contar escritas contra pintadas");
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    await page.evaluate("document.fonts.ready");

    const medida = await page.evaluate<{ escritas: number; ocultas: string[] }>(`(() => {
      const nodos = [...document.querySelectorAll("li.indice__entrada .indice__error")];
      return {
        escritas: nodos.length,
        ocultas: nodos
          .filter((n) => !n.checkVisibility({
            contentVisibilityAuto: true,
            opacityProperty: true,
            visibilityProperty: true,
          }))
          .map((n) => (n.textContent ?? "").trim()),
      };
    })()`);

    // La premisa, en la aserción: si el espejo dejara de publicar cifras, lo de abajo pasaría en
    // verde por no encontrar nada que esconder, que es la primera forma de mentir de un
    // instrumento (T-28).
    expect(
      medida.escritas,
      "INCONCLUSO: el espejo no publica ninguna cifra, así que no hay nada que esconder",
    ).toBeGreaterThan(0);

    expect(
      medida.ocultas.length,
      `las ${medida.escritas} cifras siguen escritas en el HTML y la medición de visibilidad no ` +
        "encuentra ninguna escondida: el instrumento de G7 no muerde",
    ).toBe(medida.escritas);
  } finally {
    servidor?.kill();
  }
});
