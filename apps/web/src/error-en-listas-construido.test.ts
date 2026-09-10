/**
 * **T-34 · el error medido, en todas las listas de puertos**, sobre el `dist/` construido.
 *
 * La promesa: *donde alguien elige puerto, si su predicción está medida se ve **cuánto** se
 * equivoca; y si no lo está, no se ve ninguna cifra que pueda confundirse con una medida*.
 *
 * **Este gate se reescribió entero tras el pase adversario de T-34**, que le entró por las dos
 * junturas de su primera versión. Vale la pena dejar las dos escritas, porque son la misma clase de
 * error visto desde dos lados:
 *
 * 1. **Censaba las páginas desde el catálogo** (1 portada + 12 regiones + 24 provincias = 37) y su
 *    canario contaba «he mirado las listas que yo mismo enumeré», que es una tautología. Existe una
 *    **cuarta** clase de lista —`404.html`, que un hosting estático sirve ante cualquier URL que no
 *    exista y que publica los 153 puertos— y el gate **no podía verla nunca**. Es exactamente la
 *    forma de A-T14B H-1 y de A-T30-2 una superficie más abajo: *un censo escrito a mano no alcanza
 *    la instancia que nadie recordó*. Ahora el censo **se lee del `dist/`**: cualquier página que
 *    publique entradas de puerto o la juzga este gate o lo pone en rojo por no saber juzgarla.
 * 2. **Iteraba lo esperado y le preguntaba a un `Map`**, así que sólo miraba las filas que ya sabía
 *    que debían estar. Una fila **de más** (un puerto de otra provincia, con cifra inventada) y una
 *    fila **duplicada** (dos «Mahón», la falsa delante) pasaban en verde: `set` se queda con la
 *    última y el lector ve la primera. Rompía justo la mitad que el gate se propuso sostener
 *    —«**ninguno** sin medida publica una cifra»— comprobando «ninguno *de los que yo esperaba*».
 *    Ahora se juzga **cada fila publicada**, esté o no en lo esperado.
 *
 * Las filas se emparejan **por su `href`**, no por su nombre: la ruta la construye el catálogo y es
 * única, mientras que el nombre lo escribe la página. Así una fila con el nombre falsificado tampoco
 * se cuela.
 *
 * Todo se cuenta **contra el dataset**, nunca contra un número escrito aquí: el día que entren
 * estaciones nuevas el gate las exige sin que nadie lo edite.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { errorDeLaPrediccion } from "./formato.ts";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..", "..");
const DIST = join(AQUI, "..", "dist");

interface PuertoDelCatalogo {
  readonly slug: string;
  readonly name: string;
  readonly province: { readonly slug: string };
  readonly region: { readonly slug: string };
  readonly stationFile: string;
}

interface Puerto {
  readonly ruta: string;
  readonly nombre: string;
  readonly region: string;
  readonly provincia: string;
  /** La cifra que debe publicar, o `null` si no hay medida que publicar. */
  readonly cifra: string | null;
}

function catalogo(): readonly Puerto[] {
  const { ports } = JSON.parse(
    readFileSync(join(RAIZ, "data", "geo", "ports.json"), "utf8"),
  ) as { ports: readonly PuertoDelCatalogo[] };
  return ports.map((puerto) => {
    const { quality } = JSON.parse(
      readFileSync(join(RAIZ, "data", "stations", puerto.stationFile), "utf8"),
    ) as { quality: { rmse_m: number | null } };
    return {
      ruta: `/mareas/${puerto.region.slug}/${puerto.province.slug}/${puerto.slug}/`,
      nombre: puerto.name,
      region: puerto.region.slug,
      provincia: puerto.province.slug,
      // La misma función que usa la superficie. Escribir aquí el formato a mano mediría *esta* idea
      // del formato y no la publicada; quien afirma el formato es `formato.test.ts`, con las
      // cadenas escritas a mano, porque este gate por sí solo se autovalidaría.
      cifra: quality.rmse_m === null ? null : errorDeLaPrediccion(quality.rmse_m),
    };
  });
}

interface Fila {
  readonly href: string;
  readonly nombre: string;
  readonly error: string | null;
}

/** Todas las páginas del `dist/`, que es el censo que no se puede olvidar de una. */
function paginas(): readonly string[] {
  const encontradas: string[] = [];
  const recorrer = (carpeta: string): void => {
    for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
      const ruta = join(carpeta, entrada.name);
      if (entrada.isDirectory()) recorrer(ruta);
      else if (entrada.name.endsWith(".html")) encontradas.push(relative(DIST, ruta));
    }
  };
  recorrer(DIST);
  return encontradas.sort();
}

/**
 * Las entradas de índice de una página.
 *
 * El patrón **no fija el orden de los atributos ni la presencia de los demás `<span>`**: ése fue el
 * ataque que entró en T-22-A —reordenar tres atributos dejó publicar una frase falsa con la suite
 * en verde— y la forma de no repetirlo es no volver a atarse a la plantilla.
 */
function filasDe(pagina: string): readonly Fila[] {
  const html = readFileSync(join(DIST, pagina), "utf8");
  const filas: Fila[] = [];
  for (const [, cuerpo] of html.matchAll(
    /<li\b[^>]*\bclass="[^"]*\bindice__entrada\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gu,
  )) {
    const cuerpoFila = cuerpo ?? "";
    const href = /<a\b[^>]*\bhref="([^"]*)"/u.exec(cuerpoFila);
    const nombre = /<span[^>]*\bclass="[^"]*\bindice__nombre\b[^"]*"[^>]*>([\s\S]*?)<\/span>/u.exec(
      cuerpoFila,
    );
    if (href === null || nombre === null) continue;
    const error = /<span[^>]*\bclass="[^"]*\bindice__error\b[^"]*"[^>]*>([\s\S]*?)<\/span>/u.exec(
      cuerpoFila,
    );
    filas.push({
      href: texto(href[1] ?? ""),
      nombre: texto(nombre[1] ?? ""),
      error: error === null ? null : texto(error[1] ?? ""),
    });
  }
  return filas;
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
 * El `&nbsp;` se deshace al **nbsp de verdad** (` `) y no a un espacio normal, porque el
 * espacio pegado entre cifra y unidad es justo lo que `centimetros()` promete y lo que el gate de
 * unidades pegadas vigila: cambiarlo aquí sería medir otra cadena.
 */
function texto(bruto: string): string {
  return bruto
    .replaceAll(/<[^>]*>/gu, "")
    .replaceAll(/&#(\d+);/gu, (_, codigo: string) => String.fromCodePoint(Number(codigo)))
    .replaceAll(/&#x([0-9a-f]+);/giu, (_, cod: string) => String.fromCodePoint(parseInt(cod, 16)))
    .replaceAll("&nbsp;", " ")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    // `&amp;` el último: deshacerlo antes convertiría un `&amp;#39;` literal del dato en un
    // apóstrofo que nadie escribió.
    .replaceAll("&amp;", "&")
    .trim();
}

/**
 * Qué puertos le tocan a una página, **o `null` si no sabemos juzgarla**.
 *
 * Ese `null` es la pieza que el pase adversario obligó a añadir, y es lo contrario de un censo: no
 * dice qué páginas mirar, dice qué páginas sé mirar. Cualquier otra que publique puertos se declara
 * en rojo, que es lo que habría cazado el `404.html` el día que nació.
 */
function esperadosDe(pagina: string, puertos: readonly Puerto[]): readonly Puerto[] | null {
  const tramos = pagina.split(sep);
  // La portada y el 404: las dos listan el catálogo entero.
  if (pagina === "index.html" || pagina === "404.html") return puertos;
  if (tramos[0] !== "mareas" || tramos.at(-1) !== "index.html") return null;
  if (tramos.length === 3) {
    const region = tramos[1];
    return puertos.filter((puerto) => puerto.region === region);
  }
  if (tramos.length === 4) {
    const [, region, provincia] = tramos;
    return puertos.filter(
      (puerto) => puerto.region === region && puerto.provincia === provincia,
    );
  }
  return null;
}

test("T-34 · toda fila de puerto publicada, en cualquier página, dice el error que su medida dice", () => {
  const puertos = catalogo();
  const porRuta = new Map(puertos.map((puerto) => [puerto.ruta, puerto]));
  const discrepancias: string[] = [];
  const sinCenso: string[] = [];
  let filasJuzgadas = 0;
  let paginasDeCatalogo = 0;

  for (const pagina of paginas()) {
    const filas = filasDe(pagina).filter((fila) => porRuta.has(fila.href));
    if (filas.length === 0) continue;

    // 1) Ninguna página publica puertos que este gate no sepa juzgar (la lección del `404.html`).
    const esperados = esperadosDe(pagina, puertos);
    if (esperados === null) {
      sinCenso.push(`${pagina} (${filas.length} puertos)`);
      continue;
    }
    paginasDeCatalogo += 1;

    // 2) Cada fila PUBLICADA dice lo que su medida dice — esté o no entre las esperadas. Aquí se
    //    cazan la fila de más y la fila con la cifra cambiada.
    const vistas = new Set<string>();
    for (const fila of filas) {
      filasJuzgadas += 1;
      const puerto = porRuta.get(fila.href);
      if (puerto === undefined) continue; // filtrado arriba; el guard es para el tipo
      if (fila.error !== puerto.cifra) {
        discrepancias.push(
          `${puerto.nombre} (${pagina}): publica ${fila.error ?? "nada"}, ` +
            `y su medida dice ${puerto.cifra ?? "que no hay"}`,
        );
      }
      if (fila.nombre !== puerto.nombre) {
        discrepancias.push(
          `${pagina}: la fila de ${puerto.ruta} se llama «${fila.nombre}» y el catálogo la llama «${puerto.nombre}»`,
        );
      }
      // 3) Ni dos veces el mismo puerto: con dos filas, la que se lee y la que se comprueba pueden
      //    no ser la misma.
      if (vistas.has(fila.href)) {
        discrepancias.push(`${pagina}: ${puerto.nombre} aparece más de una vez`);
      }
      vistas.add(fila.href);
    }

    // 4) Y no falta ninguno de los que le tocan.
    for (const puerto of esperados) {
      if (!vistas.has(puerto.ruta)) {
        discrepancias.push(`${puerto.nombre}: no aparece en ${pagina}`);
      }
    }
  }

  assert.deepEqual(
    sinCenso,
    [],
    "hay páginas que publican puertos y este gate no sabe juzgarlas — o se censan o dejan de publicarlos",
  );
  assert.deepEqual(
    discrepancias.slice(0, 5),
    [],
    `${discrepancias.length} filas cuyo error publicado no es el medido`,
  );

  // Canario 1 — que el gate ha mirado de verdad. Las cuatro clases de lista: portada, 404, 12
  // regiones y 24 provincias; y cada puerto aparece en la portada, en el 404, en su región y en su
  // provincia. Contado desde el catálogo y desde el `dist/`, que son dos caminos distintos.
  const regiones = new Set(puertos.map((puerto) => puerto.region)).size;
  const provincias = new Set(puertos.map((puerto) => `${puerto.region}/${puerto.provincia}`)).size;
  assert.equal(
    paginasDeCatalogo,
    2 + regiones + provincias,
    "el número de listas de puertos del dist/ no cuadra con las que el catálogo produce",
  );
  assert.equal(
    filasJuzgadas,
    puertos.length * 4,
    "el gate no ha juzgado a los 153 puertos en sus cuatro listas",
  );

  // Canario 2 — que hay de los dos tipos. Un catálogo entero sin medidas pasaría todo lo de arriba
  // sin que se publicara una sola cifra, y eso no es la promesa.
  const medidos = puertos.filter((puerto) => puerto.cifra !== null).length;
  assert.ok(medidos > 0, "ningún puerto del catálogo tiene medida: el gate no afirma nada");
  assert.ok(
    medidos < puertos.length,
    "todos los puertos tienen medida: la mitad «ninguno sin medir publica una» no se está probando",
  );
});

/**
 * **Canario de J-1 del pase adversario**, y conviene decir qué es y qué no es.
 *
 * `errorDeLaPrediccion` redondea al centímetro, así que todo RMSE en `[0, 0.005)` publica `±0 cm`
 * en un puerto rotulado «medida» — que se lee como *predicción perfecta*. Hoy **no pasa**: el mejor
 * del catálogo es 0,0359 m (`±4 cm`). Y no se inventa aquí un umbral ni una frase especial para un
 * caso que no existe: eso sería diseñar contra una hipótesis.
 *
 * Lo que sí se hace es **no dejar que entre en silencio**. El día que una estación nueva caiga en
 * ese intervalo, esto se pone rojo y obliga a decidir entonces —con el caso delante— en vez de
 * publicar «±0 cm» sin que nadie se entere.
 */
test("T-34 · ningún puerto medido publica «±0 cm», que se leería como predicción perfecta", () => {
  const enCero = catalogo()
    .filter((puerto) => puerto.cifra !== null && /^±0\s*cm$/u.test(puerto.cifra))
    .map((puerto) => puerto.nombre);
  assert.deepEqual(
    enCero,
    [],
    "un puerto con medida redondea a ±0 cm: hay que decidir qué publicar antes de publicarlo",
  );
});
