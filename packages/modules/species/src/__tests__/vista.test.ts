/**
 * El criterio con el que se escribe una fila del catálogo, medido sin construir el sitio.
 *
 * Los tres primeros bloques son las tres reglas que el módulo existe para hacer cumplir: el nombre
 * del BOE no se sustituye nunca, ninguna presencia se escribe como un número suelto y un género no
 * se convierte en especie. Los gates del `dist/` (E1 y E4, en `apps/web/src/especies-construido.test.ts`)
 * miden lo mismo sobre el artefacto; éstos miden que la función no tenga la rama.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  presenciaEscrita,
  SESGO_JUNTO_A_LA_CIFRA,
  SIN_REGISTROS,
} from "../textos.ts";
import type {
  CatalogoDeEspecies,
  EspecieDelCatalogo,
  EspecieEnCaladero,
  PresenciaObis,
} from "../tipos.ts";
import {
  anclaDeCaladero,
  CatalogoIncompleto,
  censoDelCatalogo,
  filasDeEspecies,
} from "../vista.ts";

/** El formato del sitio, prestado: coma decimal, como en la página. */
const FORMATO = {
  numero: (valor: number, decimales: number): string =>
    valor.toFixed(decimales).replace(".", ","),
};

function enCaladero(parcial: Partial<EspecieEnCaladero> = {}): EspecieEnCaladero {
  return {
    id: "mediterraneo",
    nombre: "Mediterráneo",
    nombreComun: "Lisa",
    medida: null,
    talla: { tipo: "longitud_cm", cm: 16 },
    textoOriginal: "16",
    presencia: { registros: 412, datasets: 3, desde: 2003, hasta: 2019 },
    ...parcial,
  };
}

function especie(parcial: Partial<EspecieDelCatalogo> = {}): EspecieDelCatalogo {
  return {
    nombreBoe: "Sparus auratus",
    clave: "sparus-auratus",
    worms: {
      aphiaId: 151523,
      nombre: "Sparus auratus",
      estado: "misspelling",
      rango: "especie",
      url: "https://www.marinespecies.org/aphia.php?p=taxdetails&id=151523",
      aceptado: { aphiaId: 151523, nombre: "Sparus aurata" },
      origen: "worms",
      comoSeLlego: null,
    },
    sinResolver: null,
    caladeros: [enCaladero()],
    ...parcial,
  };
}

function catalogo(especies: readonly EspecieDelCatalogo[]): CatalogoDeEspecies {
  return {
    schema: "especies/v1",
    fuentes: {
      worms: {
        nombre: "WoRMS",
        url: "https://www.marinespecies.org/",
        licencia: "CC-BY-4.0",
        consultadoEn: "2026-08-30",
      },
      obis: {
        nombre: "OBIS",
        url: "https://obis.org/",
        licencia: "CC-BY-4.0",
        consultadoEn: "2026-08-30",
      },
    },
    criterio: {
      cajas: [{ caladero: "mediterraneo", latMin: 35.1, latMax: 42.5, lonMin: -5.6, lonMax: 4.6 }],
    },
    especies,
  };
}

// =================================================================================================
// E1 · nadie sustituye al BOE
// =================================================================================================

test("el nombre de la norma viaja en la fila aunque el aceptado sea otro", () => {
  const [fila] = filasDeEspecies(catalogo([especie()]), FORMATO);
  assert.equal(fila?.nombreBoe, "Sparus auratus");
  assert.equal(fila?.taxon.tipo, "resuelto");
  // Los dos nombres, y en campos distintos: no hay ninguna forma de que el aceptado ocupe el sitio
  // del legal, porque no comparten campo.
  if (fila?.taxon.tipo !== "resuelto") return;
  assert.equal(fila.taxon.aceptado?.nombre, "Sparus aurata");
  assert.match(fila.taxon.texto, /remite a Sparus aurata/u);
  // El estado va en las palabras de WoRMS, entrecomillado: es una cita, no una etiqueta nuestra.
  assert.match(fila.taxon.texto, /«misspelling»/u);
});

test("cuando WoRMS acepta el nombre de la norma, la celda lo DICE en vez de quedarse vacía", () => {
  const sinCambio = especie({
    worms: {
      aphiaId: 126822,
      nombre: "Pollachius pollachius",
      estado: "accepted",
      rango: "especie",
      url: "https://www.marinespecies.org/aphia.php?p=taxdetails&id=126822",
      aceptado: null,
      origen: "worms",
      comoSeLlego: null,
    },
  });
  const [fila] = filasDeEspecies(catalogo([sinCambio]), FORMATO);
  if (fila?.taxon.tipo !== "resuelto") throw new Error("debería resolver");
  assert.equal(fila.taxon.aceptado, null);
  assert.equal(fila.taxon.texto, "WoRMS acepta el nombre de la norma.");
  // El identificador que se publica y el enlace apuntan al MISMO registro.
  assert.equal(fila.taxon.ficha.aphiaId, 126822);
  assert.match(fila.taxon.ficha.url, /id=126822$/u);
});

test("una especie que no resuelve publica su motivo, no un hueco", () => {
  const errata = especie({
    nombreBoe: "Cáncer pagurus",
    clave: "cancer-pagurus",
    worms: null,
    sinResolver: "WoRMS no encuentra este nombre: la norma escribe «Cáncer» con tilde.",
  });
  const [fila] = filasDeEspecies(catalogo([errata]), FORMATO);
  assert.equal(fila?.nombreBoe, "Cáncer pagurus");
  assert.equal(fila?.taxon.tipo, "sin_resolver");
  if (fila?.taxon.tipo !== "sin_resolver") return;
  assert.match(fila.taxon.motivo, /no encuentra este nombre/u);
});

test("una ausencia MUDA no se publica: levanta nombrando la especie", () => {
  const muda = especie({ worms: null, sinResolver: null });
  assert.throws(() => filasDeEspecies(catalogo([muda]), FORMATO), (error: unknown) => {
    assert.ok(error instanceof CatalogoIncompleto);
    assert.match(error.message, /Sparus auratus/u);
    return true;
  });
});

// =================================================================================================
// E2 visto desde la interfaz · el mapeo tiene dueño
// =================================================================================================

test("una correspondencia NUESTRA se publica firmada y con su motivo", () => {
  const genero = especie({
    nombreBoe: "Sepia spp",
    clave: "sepia-spp",
    worms: {
      aphiaId: 138477,
      nombre: "Sepia",
      estado: "accepted",
      rango: "genero",
      url: "https://www.marinespecies.org/aphia.php?p=taxdetails&id=138477",
      aceptado: null,
      origen: "nuestro",
      comoSeLlego: "la norma escribe «Sepia spp», que no es un binomio; se resuelve el género",
    },
  });
  const [fila] = filasDeEspecies(catalogo([genero]), FORMATO);
  if (fila?.taxon.tipo !== "resuelto") throw new Error("debería resolver");
  assert.match(fila.taxon.correspondencia ?? "", /^Correspondencia nuestra, no de WoRMS: /u);
});

test("un mapeo NUESTRO sin motivo no se publica: se lee como si lo firmase WoRMS", () => {
  const huerfano = especie({
    worms: { ...especie().worms!, origen: "nuestro", comoSeLlego: null },
  });
  assert.throws(
    () => filasDeEspecies(catalogo([huerfano]), FORMATO),
    /marca la correspondencia como nuestra y no dice cuál es/u,
  );
});

// =================================================================================================
// E3 · el género no se convierte en especie
// =================================================================================================

test("las filas de género se rotulan como género, y las de especie no se rotulan", () => {
  const genero = especie({
    nombreBoe: "Mullus spp",
    clave: "mullus-spp",
    worms: {
      aphiaId: 125917,
      nombre: "Mullus",
      estado: "accepted",
      rango: "genero",
      url: "https://www.marinespecies.org/aphia.php?p=taxdetails&id=125917",
      aceptado: null,
      origen: "nuestro",
      comoSeLlego: "se resuelve el género que la norma regula",
    },
  });
  const filas = filasDeEspecies(catalogo([genero, especie()]), FORMATO);
  assert.equal(filas.find((fila) => fila.clave === "mullus-spp")?.rango, "género, no especie");
  // Y la de especie NO se rotula: 71 rótulos «especie» serían ruido que le quitaría fuerza a los 15
  // que cambian lo que la fila significa.
  assert.equal(filas.find((fila) => fila.clave === "sparus-auratus")?.rango, null);
});

// =================================================================================================
// E4 · la presencia no se lee como abundancia
// =================================================================================================

test("toda presencia se escribe con el sesgo DENTRO de la misma frase", () => {
  const presencia: PresenciaObis = { registros: 12, datasets: 3, desde: 2014, hasta: 2025 };
  assert.equal(
    presenciaEscrita(presencia),
    `12 registros de 3 conjuntos de datos, entre 2014 y 2025 · ${SESGO_JUNTO_A_LA_CIFRA}`,
  );
  // El caso que da nombre al gate: la dorada gallega. No hay forma de obtener el «12» solo.
  assert.ok(presenciaEscrita(presencia).includes("esfuerzo de muestreo, no abundancia"));
});

test("los singulares y el año único se escriben bien: un «1 registros» resta credibilidad", () => {
  assert.match(
    presenciaEscrita({ registros: 1, datasets: 1, desde: 2019, hasta: 2019 }),
    /^1 registro de 1 conjunto de datos, en 2019 · /u,
  );
});

test("sin rango de años se omite el rango, no se inventa un final abierto", () => {
  assert.equal(
    presenciaEscrita({ registros: 40, datasets: 2, desde: null, hasta: null }),
    `40 registros de 2 conjuntos de datos · ${SESGO_JUNTO_A_LA_CIFRA}`,
  );
});

test("sin registros se publica el motivo, y NO un cero que se leería como ausencia medida", () => {
  const sinRegistro = especie({ caladeros: [enCaladero({ presencia: null })] });
  const [fila] = filasDeEspecies(catalogo([sinRegistro]), FORMATO);
  assert.equal(fila?.caladeros[0]?.presencia, SIN_REGISTROS);
  assert.equal(fila?.caladeros[0]?.hayCifra, false);
  assert.match(SIN_REGISTROS, /nadie lo ha anotado/u);
});

// =================================================================================================
// La talla se toma prestada de `regulations`, no se vuelve a escribir
// =================================================================================================

test("la talla se escribe igual que en la página de puerto, con la coma del sitio", () => {
  const conDecimal = especie({
    caladeros: [enCaladero({ talla: { tipo: "longitud_cm", cm: 3.7 }, textoOriginal: "3,7" })],
  });
  const [fila] = filasDeEspecies(catalogo([conDecimal]), FORMATO);
  assert.equal(fila?.caladeros[0]?.tallas[0]?.talla.texto, "3,7\u00a0cm");
  assert.equal(fila?.caladeros[0]?.tallas[0]?.talla.hayCifra, true);
  assert.equal(fila?.caladeros[0]?.tallas[0]?.literal, "3,7");
});

test("una talla que la norma no fija se escribe como frase y no como cifra", () => {
  const sinTalla = especie({
    caladeros: [
      enCaladero({ talla: { tipo: "por_determinar", segunNota: "(*)" }, textoOriginal: "(*)" }),
    ],
  });
  const [fila] = filasDeEspecies(catalogo([sinTalla]), FORMATO);
  assert.equal(fila?.caladeros[0]?.tallas[0]?.talla.hayCifra, false);
});

// =================================================================================================
// Las cuentas y el orden
// =================================================================================================

test("una especie a la que no regula ningún caladero no se publica", () => {
  assert.throws(
    () => filasDeEspecies(catalogo([especie({ caladeros: [] })]), FORMATO),
    /no la regula ningún caladero/u,
  );
});

test("la cigala publica QUÉ mide cada una de sus dos cifras del mismo anexo", () => {
  // El BOE le dedica dos filas en el mismo caladero —2 cm de cefalotórax y 7 cm de longitud
  // total—, y sin la medida las dos cifras se leen como una contradicción. Medido en el derivado
  // del BOE: son cuatro filas, la cigala en el Cantábrico y en el Mediterráneo.
  const cigala = especie({
    nombreBoe: "Nephrops norvegicus",
    clave: "nephrops-norvegicus",
    caladeros: [
      enCaladero({
        nombreComun: "Cigala",
        medida: "Longitud cefalotórax",
        talla: { tipo: "longitud_cm", cm: 2 },
        textoOriginal: "2",
      }),
      enCaladero({
        nombreComun: "Cigala",
        medida: "Longitud total",
        talla: { tipo: "longitud_cm", cm: 7 },
        textoOriginal: "7",
      }),
    ],
  });
  const [fila] = filasDeEspecies(catalogo([cigala]), FORMATO);
  // Las dos tallas cuelgan del MISMO caladero, que es lo que son: dos medidas del mismo anexo.
  assert.equal(fila?.caladeros.length, 1);
  assert.deepEqual(
    fila?.caladeros[0]?.tallas.map((talla) => [talla.medida, talla.talla.texto]),
    // El espacio entre la cifra y la unidad es DURO (U+00A0), como en la tabla de tallas: una talla
    // legal partida entre dos líneas se lee mal y se cita peor. Se escribe aquí explícito para que
    // nadie lo «arregle» a un espacio normal sin enterarse.
    [
      ["Longitud cefalotórax", "2\u00a0cm"],
      ["Longitud total", "7\u00a0cm"],
    ],
  );
  // Y el caladero sale UNA vez en el asidero del filtro: `data-caladeros` es un conjunto.
  assert.deepEqual(fila?.idsDeCaladero, ["mediterraneo"]);
  // Y cuenta como UNA especie en su caladero, no como dos filas: si contara filas, la opción del
  // filtro diría un número y el enlace de la página de puerto diría otro.
  assert.equal(censoDelCatalogo(catalogo([cigala])).caladeros[0]?.especies, 1);
});

test("las filas se ordenan por el nombre del BOE y la tilde no manda a nadie al final", () => {
  const filas = filasDeEspecies(
    catalogo([
      especie({ nombreBoe: "Diplodus spp", clave: "diplodus-spp" }),
      especie({ nombreBoe: "Cáncer pagurus", clave: "cancer-pagurus" }),
      especie({ nombreBoe: "Boops boops", clave: "boops-boops" }),
    ]),
    FORMATO,
  );
  assert.deepEqual(
    filas.map((fila) => fila.nombreBoe),
    ["Boops boops", "Cáncer pagurus", "Diplodus spp"],
  );
});

test("el censo se cuenta del catálogo que se está pintando, no de un campo del dataset", () => {
  const censo = censoDelCatalogo(
    catalogo([
      especie(),
      especie({
        nombreBoe: "Sepia spp",
        clave: "sepia-spp",
        worms: {
          aphiaId: 138477,
          nombre: "Sepia",
          estado: "accepted",
          rango: "genero",
          url: "https://www.marinespecies.org/aphia.php?p=taxdetails&id=138477",
          aceptado: null,
          origen: "nuestro",
          comoSeLlego: "se resuelve el género",
        },
        caladeros: [enCaladero(), enCaladero({ id: "canario", nombre: "Canario" })],
      }),
      especie({ nombreBoe: "Cáncer pagurus", clave: "c-p", worms: null, sinResolver: "con tilde" }),
    ]),
  );
  assert.equal(censo.especies, 3);
  // Resolver preguntando el nombre de la norma y resolver porque nosotros decidimos a qué apunta no
  // es lo mismo, y por eso se cuentan aparte: mezclarlas publicaría como respuesta de la fuente lo
  // que en parte es decisión nuestra.
  assert.equal(censo.resueltasTalCual, 1);
  assert.equal(censo.porCorrespondenciaNuestra, 1);
  assert.equal(censo.sinResolver, 1);
  assert.equal(censo.conAceptadoDistinto, 1);
  assert.equal(censo.deGenero, 1);
  assert.deepEqual(
    censo.caladeros.map((caladero) => [caladero.id, caladero.especies]),
    [
      ["mediterraneo", 3],
      ["canario", 1],
    ],
  );
});

test("el ancla del filtro la nombra el módulo, para que el enlace del puerto no se desincronice", () => {
  assert.equal(anclaDeCaladero("mediterraneo"), "cal-mediterraneo");
});
