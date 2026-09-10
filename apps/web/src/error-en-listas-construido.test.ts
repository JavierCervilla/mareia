/**
 * **T-34 · el error medido, en las tres listas**, sobre el `dist/` construido.
 *
 * La promesa de la trayectoria, en una línea: *donde alguien elige puerto, si su predicción está
 * medida, se ve **cuánto** se equivoca*. Eso son dos afirmaciones y este gate hace las dos, porque
 * media promesa se cumple sola:
 *
 * 1. **todo** puerto con `rmse_m` publica su cifra —la exacta, no «una cifra»— en las tres listas;
 * 2. **ninguno** sin medida publica una. Un «±0 cm» o un guion en los 118 sin observaciones se
 *    leería como una predicción perfecta o como una mala, y lo que pasa es que no hay ninguna.
 *
 * Se cuenta **contra el dataset**, no contra un número escrito aquí: el día que entren estaciones
 * nuevas el gate las exige sin que nadie lo edite. Ese fue el hallazgo A-T14B H-3 y su lección
 * (T-32): un trinquete con la cifra a mano deja de mirar en cuanto el catálogo crece.
 *
 * Lleva sus **dos canarios** —un instrumento miente de dos maneras, no viendo nada y viéndolo todo
 * (T-28)—: que los sujetos son los del catálogo contados por otro camino, y que entre ellos hay de
 * los dos tipos, medidos y sin medir. Sin el segundo, un catálogo que un día se quedara sin
 * ninguna medida haría pasar este gate en verde sin publicar una sola cifra.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { errorDeLaPrediccion } from "./formato.ts";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..", "..");
const DIST = join(AQUI, "..", "dist");

interface PuertoDelCatalogo {
  readonly name: string;
  readonly province: { readonly slug: string };
  readonly region: { readonly slug: string };
  readonly stationFile: string;
}

interface Sujeto {
  readonly nombre: string;
  readonly region: string;
  readonly provincia: string;
  /** La cifra que ese puerto debe publicar, o `null` si no hay medida que publicar. */
  readonly cifra: string | null;
}

function sujetos(): readonly Sujeto[] {
  const { ports } = JSON.parse(
    readFileSync(join(RAIZ, "data", "geo", "ports.json"), "utf8"),
  ) as { ports: readonly PuertoDelCatalogo[] };
  return ports.map((puerto) => {
    const { quality } = JSON.parse(
      readFileSync(join(RAIZ, "data", "stations", puerto.stationFile), "utf8"),
    ) as { quality: { rmse_m: number | null } };
    return {
      nombre: puerto.name,
      region: puerto.region.slug,
      provincia: puerto.province.slug,
      // La misma función que usa la superficie. Si aquí se escribiera el formato a mano, el gate
      // mediría *su* idea del formato y no la que se publica.
      cifra: quality.rmse_m === null ? null : errorDeLaPrediccion(quality.rmse_m),
    };
  });
}

/**
 * Las entradas de una lista construida, con lo que cada una dice de su error.
 *
 * El patrón **no fija el orden de los atributos ni la presencia de los demás `<span>`**: ése fue
 * el ataque que entró en T-22-A —reordenar tres atributos dejó publicar una frase falsa con la
 * suite en verde— y la forma de no repetirlo es no volver a atarse a la plantilla.
 */
function entradasDe(pagina: string): ReadonlyMap<string, string | null> {
  const html = readFileSync(join(DIST, pagina), "utf8");
  const filas = html.matchAll(/<li\b[^>]*\bclass="[^"]*\bindice__entrada\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gu);
  const publicadas = new Map<string, string | null>();
  for (const fila of filas) {
    const cuerpo = fila[1] ?? "";
    const nombre = /<span[^>]*\bclass="[^"]*\bindice__nombre\b[^"]*"[^>]*>([\s\S]*?)<\/span>/u.exec(
      cuerpo,
    );
    if (nombre === null) continue;
    const error = /<span[^>]*\bclass="[^"]*\bindice__error\b[^"]*"[^>]*>([\s\S]*?)<\/span>/u.exec(
      cuerpo,
    );
    publicadas.set(texto(nombre[1] ?? ""), error === null ? null : texto(error[1] ?? ""));
  }
  return publicadas;
}

/**
 * El texto de un `<span>`, con las entidades deshechas.
 *
 * Las numéricas se deshacen **todas por su código**, no una lista de las que hoy aparecen. Esa
 * lista ya se quedó corta una vez en este mismo fichero: Astro escapa el apóstrofo, y con cuatro
 * puertos catalanes y valencianos —`l'Ametlla de Mar`, `l'Ampolla`, `Vandellòs i l'Hospitalet de
 * l'Infant` y `Canet d'En Berenguer`— el gate se puso rojo diciendo que no aparecían en la página.
 * Un decodificador incompleto no falla donde le falta: falla acusando a lo que mide.
 *
 * El `&nbsp;` se deshace al **nbsp de verdad** (`\u00a0`) y no a un espacio normal, porque el
 * espacio pegado entre cifra y unidad es justo lo que `centimetros()` promete y lo que el gate de
 * unidades pegadas vigila: cambiarlo aquí sería medir otra cadena.
 */
function texto(bruto: string): string {
  return bruto
    .replaceAll(/<[^>]*>/gu, "")
    .replaceAll(/&#(\d+);/gu, (_, codigo: string) => String.fromCodePoint(Number(codigo)))
    .replaceAll(/&#x([0-9a-f]+);/giu, (_, cod: string) => String.fromCodePoint(parseInt(cod, 16)))
    .replaceAll("&nbsp;", "\u00a0")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    // `&amp;` el último: deshacerlo antes convertiría un `&amp;#39;` literal del dato en un
    // apóstrofo que nadie escribió.
    .replaceAll("&amp;", "&")
    .trim();
}

/** Las tres listas donde se elige puerto, y qué puertos le tocan a cada una. */
function listas(catalogo: readonly Sujeto[]): readonly {
  pagina: string;
  esperados: readonly Sujeto[];
}[] {
  const regiones = [...new Set(catalogo.map((puerto) => puerto.region))].sort();
  const provincias = [
    ...new Map(
      catalogo.map((puerto) => [`${puerto.region}/${puerto.provincia}`, puerto] as const),
    ).values(),
  ].sort((a, b) => a.provincia.localeCompare(b.provincia));
  return [
    { pagina: "index.html", esperados: catalogo },
    ...regiones.map((region) => ({
      pagina: join("mareas", region, "index.html"),
      esperados: catalogo.filter((puerto) => puerto.region === region),
    })),
    ...provincias.map(({ region, provincia }) => ({
      pagina: join("mareas", region, provincia, "index.html"),
      esperados: catalogo.filter(
        (puerto) => puerto.region === region && puerto.provincia === provincia,
      ),
    })),
  ];
}

test("T-34 · todo puerto medido publica su error, y ninguno sin medir publica uno", () => {
  const catalogo = sujetos();
  const discrepancias: string[] = [];
  let comprobados = 0;

  for (const { pagina, esperados } of listas(catalogo)) {
    const publicadas = entradasDe(pagina);
    for (const puerto of esperados) {
      const publicada = publicadas.get(puerto.nombre);
      if (publicada === undefined) {
        discrepancias.push(`${puerto.nombre}: no aparece en ${pagina}`);
        continue;
      }
      comprobados += 1;
      if (publicada !== puerto.cifra) {
        discrepancias.push(
          `${puerto.nombre} (${pagina}): publica ${publicada ?? "nada"}, ` +
            `y su medida dice ${puerto.cifra ?? "que no hay"}`,
        );
      }
    }
  }

  assert.deepEqual(
    discrepancias.slice(0, 5),
    [],
    `${discrepancias.length} entradas cuyo error publicado no es el medido`,
  );

  // Canario 1 — que el gate ha mirado a todos: cada puerto aparece en su portada, en su región y
  // en su provincia, tres veces, contadas desde el catálogo y no desde lo publicado.
  assert.equal(
    comprobados,
    catalogo.length * 3,
    "el gate no ha visto a los 153 puertos en las tres listas: alguna lista se le escapó",
  );

  // Canario 2 — que hay de los dos tipos. Un catálogo entero sin medidas pasaría el assert de
  // arriba sin que se publicara una sola cifra, y eso no es la promesa.
  const medidos = catalogo.filter((puerto) => puerto.cifra !== null).length;
  assert.ok(medidos > 0, "ningún puerto del catálogo tiene medida: el gate no afirma nada");
  assert.ok(
    medidos < catalogo.length,
    "todos los puertos tienen medida: la mitad «ninguno sin medir publica una» no se está probando",
  );
});
