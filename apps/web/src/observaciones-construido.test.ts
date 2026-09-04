/**
 * **T3 · el trinquete de recomputación**, sobre el `dist/` construido.
 *
 * Los gates de este repo que miran el HTML suelen comprobar que **haya** un atributo. Éste no: por
 * cada observación publicada **vuelve a ejecutar la función pura de su `data-regla`** con las
 * entradas de esa misma página y exige que el texto salga **idéntico**. La diferencia importa —es la
 * lección de T-20 y de T-27—: un gate que comprueba la presencia de `data-regla` lo satisface
 * cualquiera escribiendo el atributo a mano junto a una frase inventada. Éste no, porque una frase
 * escrita a mano no coincide con la salida de una función que no la generó.
 *
 * Y lleva sus **dos canarios**, que es lo que T-28 dejó por escrito: un instrumento tiene dos formas
 * de mentir —no ver nada y verlo todo— y un umbral solo no cubre ninguna.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";

import { REGLAS_DECLARADAS, reglaPorId } from "@mareia/module-fishing";

import { hora, numero } from "./formato.ts";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIST = join(AQUI, "..", "dist");

/** El mismo formato que usa la superficie. Si fuera otro, esto mediría otra página. */
const FORMATO = { numero, hora };

/** Las entidades que Astro mete en un atributo. Se deshacen todas o el JSON no parsea. */
function desescapar(atributo: string): string {
  return atributo
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&#39;", "'");
}

interface Publicada {
  readonly pagina: string;
  readonly reglaId: string;
  readonly entradas: unknown;
  readonly texto: string;
}

/**
 * **Este patrón lo reescribió un ataque que entró.**
 *
 * La primera versión exigía el orden exacto de los atributos —`class`, luego `data-regla`, luego
 * `data-entradas`—. El pase adversario **reordenó los tres y falsificó el texto** («hoy la marea
 * sube un montón y se pesca de miedo», una promesa de beneficio, que es justo lo que esta
 * trayectoria existe para impedir) y **T3 se quedó en verde**: la regex dejó de casar y el nodo
 * pasó a ser invisible para el gate. Es el mismo mecanismo que el `filaDe` de T-27 y que el
 * `.portada__enlace` de T-30: **un gate atado a la FORMA del marcado vigila el marcado, no el dato.**
 *
 * Ahora el `<li>` se localiza por su atributo, en cualquier orden, y los dos `data-` se leen del
 * propio tag. Pero el patrón por sí solo no basta: lo que cierra el agujero es el canario de
 * cobertura de abajo, que **cuenta los sujetos aparte** en vez de fiarse de un umbral.
 */
const PUNTO = /<li\b([^>]*\bdata-regla="[^"]*"[^>]*)>([\s\S]*?)<\/li>/g;
const ATRIBUTO = (tag: string, nombre: string): string =>
  new RegExp(`\\b${nombre}="([^"]*)"`).exec(tag)?.[1] ?? "";

/**
 * Cuántos nodos de observación hay **de verdad**, contados sin pasar por el patrón de arriba.
 *
 * Es la mitad que importa del canario: si el patrón deja de casar —por un refactor de la plantilla o
 * porque alguien reordena a mano—, esto sigue contando los sujetos y la diferencia salta. Contar los
 * sujetos con el mismo patrón que se quiere vigilar es no contar nada.
 */
function sujetosPublicados(): number {
  let total = 0;
  for (const pagina of globSync("mareas/*/*/*/index.html", { cwd: DIST })) {
    total += (readFileSync(join(DIST, pagina), "utf-8").match(/data-regla="/g) ?? []).length;
  }
  return total;
}

function observacionesPublicadas(): readonly Publicada[] {
  const paginas = globSync("mareas/*/*/*/index.html", { cwd: DIST });
  const publicadas: Publicada[] = [];
  for (const pagina of paginas) {
    const html = readFileSync(join(DIST, pagina), "utf-8");
    for (const encontrada of html.matchAll(PUNTO)) {
      const tag = encontrada[1] ?? "";
      publicadas.push({
        pagina,
        reglaId: ATRIBUTO(tag, "data-regla"),
        entradas: JSON.parse(desescapar(ATRIBUTO(tag, "data-entradas") || "null")),
        texto: (encontrada[2] ?? "").trim(),
      });
    }
  }
  return publicadas;
}

test("T3 · cada observación publicada es la salida de la regla que dice ser", () => {
  const publicadas = observacionesPublicadas();

  // CANARIO 1 · cobertura, **contra los sujetos y no contra un umbral**.
  //
  // La primera versión pedía `> 100`, y con eso el ataque que reordenó los atributos de UN nodo
  // dejaba 764 medidos de 765 y pasaba holgadamente. Un umbral sólo caza que el gate se quede a
  // cero; la pregunta buena es «¿mides a todos los que hay?» (lección de T-28). Los sujetos se
  // cuentan aparte, con otro patrón, porque contarlos con el mismo no cuenta nada.
  const sujetos = sujetosPublicados();
  assert.ok(sujetos > 100, `sólo ${sujetos} nodos de observación en el dist/: no hay qué medir`);
  assert.equal(
    publicadas.length,
    sujetos,
    `el patrón de T3 encuentra ${publicadas.length} observaciones y en el dist/ hay ${sujetos}: ` +
      "las que no casan son invisibles para el gate y pueden publicar lo que quieran",
  );

  const discrepantes: string[] = [];
  for (const publicada of publicadas) {
    const regla = reglaPorId(publicada.reglaId);
    if (regla === undefined) {
      discrepantes.push(`${publicada.pagina}: regla «${publicada.reglaId}» no existe`);
      continue;
    }
    const recomputado = regla.recomputar(publicada.entradas, FORMATO);
    if (recomputado !== publicada.texto) {
      discrepantes.push(
        `${publicada.pagina} · ${publicada.reglaId}\n    publica:   «${publicada.texto}»\n` +
          `    recomputa: «${recomputado}»`,
      );
    }
  }
  assert.deepEqual(
    discrepantes.slice(0, 5),
    [],
    `${discrepantes.length} observaciones publican un texto que su propia regla no produce`,
  );
});

test("T3 · canario de sensibilidad: un texto cambiado NO pasaría", () => {
  const publicadas = observacionesPublicadas();
  const muestra = publicadas[0];
  assert.ok(muestra, "sin observaciones que usar de muestra");
  const regla = reglaPorId(muestra.reglaId);
  const recomputado = regla?.recomputar(muestra.entradas, FORMATO);
  // Si esto fuese igual al texto alterado, la comparación de arriba no estaría comparando nada.
  assert.notEqual(
    recomputado,
    `${muestra.texto} (y además pica bien)`,
    "la comparación de T3 da por bueno un texto que le han añadido cosas: no está comparando",
  );
  assert.equal(recomputado, muestra.texto, "y sobre el texto real sí coincide");
});

test("T3 · toda regla publicada está entre las declaradas", () => {
  const publicadas = observacionesPublicadas();
  const desconocidas = [
    ...new Set(
      publicadas
        .map((p) => p.reglaId)
        .filter((id) => !(REGLAS_DECLARADAS as readonly string[]).includes(id)),
    ),
  ];
  assert.deepEqual(desconocidas, [], "reglas publicadas que nadie declaró");
});

/**
 * El censo publicado.
 *
 * Es lo que impide que T1 y T3 se satisfagan **callando**: con cero observaciones los dos pasan, y
 * el sitio no publicaría nada sin que ningún gate se quejase. La página publica cuántas reglas hay
 * declaradas; que cada una de ellas tenga golden, apartado en `docs/recomendaciones.md` y una
 * magnitud real lo exige **T2** en el package. Encadenados, el número publicado no puede ser
 * decorativo.
 */
test("censo · la página publica tantas reglas declaradas como hay", () => {
  const paginas = globSync("mareas/*/*/*/index.html", { cwd: DIST });
  assert.ok(paginas.length > 100, `sólo ${paginas.length} páginas de puerto en el dist/`);
  const sinCenso: string[] = [];
  for (const pagina of paginas) {
    const html = readFileSync(join(DIST, pagina), "utf-8");
    const censo = /data-reglas-declaradas="(\d+)"/.exec(html);
    if (censo === null) {
      sinCenso.push(`${pagina}: sin censo`);
      continue;
    }
    if (Number(censo[1]) !== REGLAS_DECLARADAS.length) {
      sinCenso.push(`${pagina}: publica ${censo[1]} y hay ${REGLAS_DECLARADAS.length}`);
    }
  }
  assert.deepEqual(sinCenso.slice(0, 5), [], `${sinCenso.length} páginas con el censo mal`);
});
