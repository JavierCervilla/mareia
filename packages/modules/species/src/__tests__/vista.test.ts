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
  NO_SE_PREGUNTO_A_OBIS,
  presenciaEscrita,
  SESGO_JUNTO_A_LA_CIFRA,
  SIN_REGISTROS,
} from "../textos.ts";
import type {
  CatalogoDeEspecies,
  EspecieDelCatalogo,
  EspecieEnCaladero,
  PresenciaObis,
  TallaDelAnexo,
} from "../tipos.ts";
import {
  anclaDeCaladero,
  CatalogoIncompleto,
  censoDelCatalogo,
  filasDeEspecies,
  filasSinBinomio,
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
    tallas: [conTalla()],
    presencia: { registros: 412, datasets: 3, desde: 2003, hasta: 2019 },
    seLePreguntoAObis: true,
    ...parcial,
  };
}

function conTalla(parcial: Partial<TallaDelAnexo> = {}): TallaDelAnexo {
  return {
    medida: null,
    talla: { tipo: "longitud_cm", cm: 16 },
    textoOriginal: "16",
    notas: [],
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
      cajas: [
        {
          caladero: "mediterraneo",
          nombre: "Alborán y Levante",
          latMin: 35.1,
          latMax: 42.5,
          lonMin: -5.6,
          lonMax: 4.6,
        },
      ],
    },
    especies,
    sinNombreCientifico: [],
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
      origen: "mareia",
      comoSeLlego: "la norma escribe «Sepia spp», que no es un binomio; se resuelve el género",
    },
  });
  const [fila] = filasDeEspecies(catalogo([genero]), FORMATO);
  if (fila?.taxon.tipo !== "resuelto") throw new Error("debería resolver");
  assert.match(fila.taxon.correspondencia ?? "", /^Correspondencia nuestra, no de WoRMS: /u);
});

test("a un nombre que WoRMS nunca vio no se le atribuye que WoRMS lo acepte", () => {
  // El tercer estado de la columna, el que faltaba (H-2 del pase adversario de T-20). `Sepia spp`
  // no existe en ninguna nomenclatura: lo que se consultó fue «sepia», y decir que WoRMS acepta el
  // nombre de la norma sobre él es atribuirle a la fuente una frase que no ha dicho —y contradecir
  // dos líneas más abajo, en la misma celda, la correspondencia que firmamos nosotros—.
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
      origen: "mareia",
      comoSeLlego: "la norma escribe «Sepia spp», que no es un binomio; se resuelve el género",
    },
  });
  const [fila] = filasDeEspecies(catalogo([genero]), FORMATO);
  if (fila?.taxon.tipo !== "resuelto") throw new Error("debería resolver");
  assert.ok(!fila.taxon.texto.includes("WoRMS acepta el nombre de la norma"));
  assert.match(fila.taxon.texto, /A WoRMS no se le preguntó este nombre/u);
  // Y la fila publica el nombre del registro al que manda a comprobarla: un AphiaID sin el nombre
  // al que apunta obliga a salir del sitio, que es lo que esta columna existe para evitar.
  assert.match(fila.taxon.texto, /es Sepia,/u);
  assert.equal(fila.taxon.ficha.nombre, "Sepia");
});

test("cuando además remite a otro nombre, las dos cosas se dicen en la misma frase", () => {
  // Es una sola fila del catálogo, `Panaeux kerathurus`: ni se le preguntó el nombre de la norma ni
  // el registro que se encontró es el aceptado hoy. Contarlo en dos frases dejaría al lector
  // emparejando cuál se refiere a cuál.
  const errata = especie({
    nombreBoe: "Panaeux kerathurus",
    clave: "panaeux-kerathurus",
    worms: {
      aphiaId: 246388,
      nombre: "Penaeus kerathurus",
      estado: "superseded combination",
      rango: "especie",
      url: "https://www.marinespecies.org/aphia.php?p=taxdetails&id=246388",
      aceptado: { aphiaId: 107703, nombre: "Penaeus (Melicertus) kerathurus" },
      origen: "mareia",
      comoSeLlego: "la norma imprime «Panaeux»; el género es «Penaeus»",
    },
  });
  const [fila] = filasDeEspecies(catalogo([errata]), FORMATO);
  if (fila?.taxon.tipo !== "resuelto") throw new Error("debería resolver");
  assert.match(fila.taxon.texto, /A WoRMS no se le preguntó este nombre/u);
  assert.match(fila.taxon.texto, /remite a Penaeus \(Melicertus\) kerathurus\.$/u);
});

// =================================================================================================
// H-1 · la nota viaja pegada a la cifra
// =================================================================================================

test("una cifra con excepción se publica CON la excepción, entera y en su misma talla", () => {
  // La regla de T-19 —«la nota viaja pegada a la cifra y se pinta con ella, siempre»— aplicada a la
  // superficie nueva: la lubina son 36 cm salvo en las divisiones 8a y 8b del CIEM, donde son 44, y
  // el catálogo publicaba el 36 con la llamada «(***)» y ningún pie en toda la página.
  const lubina = especie({
    nombreBoe: "Dicentrarchus labrax",
    clave: "dicentrarchus-labrax",
    caladeros: [
      enCaladero({
        tallas: [
          conTalla({
            talla: { tipo: "longitud_cm", cm: 36 },
            textoOriginal: "36 (***)",
            notas: [
              {
                marca: "(***)",
                texto:
                  "Excepto en las divisiones 8a y 8b del Consejo Internacional para la " +
                  "Exploración del Mar, tanto para la pesca profesional como para la pesca " +
                  "recreativa, en las que la talla mínima es de 44 centímetros.",
              },
            ],
          }),
        ],
      }),
    ],
  });
  const [fila] = filasDeEspecies(catalogo([lubina]), FORMATO);
  const talla = fila?.caladeros[0]?.tallas[0];
  assert.equal(talla?.talla.texto, "36\u00a0cm");
  // El texto ENTERO, no la marca: un resumen sería una tercera cifra que la norma no dice.
  assert.equal(talla?.notas.length, 1);
  assert.match(talla?.notas[0] ?? "", /^\(\*\*\*\) Excepto en las divisiones 8a y 8b/u);
  assert.match(talla?.notas[0] ?? "", /44 centímetros\.$/u);
});

test("una talla sin llamada no se inventa ninguna nota", () => {
  const [fila] = filasDeEspecies(catalogo([especie()]), FORMATO);
  assert.deepEqual(fila?.caladeros[0]?.tallas[0]?.notas, []);
});

// =================================================================================================
// H-3 · dos grafías del BOE, un solo taxón
// =================================================================================================

test("dos filas que publican el mismo AphiaID se nombran la una a la otra", () => {
  // El BOE escribe `Thunnus thynnus` en los Anexos I y II y `Thunnus Thynnus` en el III: dos filas,
  // porque son dos nombres de la norma y el de la norma es el que tiene consecuencia legal. Sin el
  // cruce, quien busca el atún rojo por el binomio bien escrito ve una fila con dos caladeros y
  // concluye que en Canarias no tiene talla mínima. La tiene: 6,4 kg, en la fila de al lado.
  const worms = {
    aphiaId: 127029,
    nombre: "Thunnus thynnus",
    estado: "accepted",
    rango: "especie" as const,
    url: "https://www.marinespecies.org/aphia.php?p=taxdetails&id=127029",
    aceptado: null,
    origen: "worms" as const,
    comoSeLlego: null,
  };
  const filas = filasDeEspecies(
    catalogo([
      especie({ nombreBoe: "Thunnus thynnus", clave: "thunnus-thynnus-aaa", worms }),
      especie({ nombreBoe: "Thunnus Thynnus", clave: "thunnus-thynnus-bbb", worms }),
    ]),
    FORMATO,
  );
  const minuscula = filas.find((fila) => fila.clave === "thunnus-thynnus-aaa");
  const mayuscula = filas.find((fila) => fila.clave === "thunnus-thynnus-bbb");
  assert.match(minuscula?.tambienEn ?? "", /«Thunnus Thynnus»/u);
  assert.match(mayuscula?.tambienEn ?? "", /«Thunnus thynnus»/u);
});

test("una fila sin hermana no dice que la tenga", () => {
  const [fila] = filasDeEspecies(catalogo([especie()]), FORMATO);
  assert.equal(fila?.tambienEn, null);
});

// =================================================================================================
// H-4 · la fila del BOE que no se puede publicar como especie
// =================================================================================================

test("una fila del BOE sin binomio se publica con su talla y su motivo, no se calla", () => {
  // «Cigalas (colas)», Anexo I, 3,7 cm: la norma no escribe ahí ningún latín y aquí no se le
  // inventa uno. Lo que no vale es dejarla fuera en silencio, que es lo que pasaba: son tres
  // medidas del mismo animal en el mismo anexo y el catálogo publicaba dos.
  const documento = {
    ...catalogo([especie()]),
    sinNombreCientifico: [
      {
        caladero: "mediterraneo",
        nombreComun: "Cigalas (colas)",
        motivo: "la norma escribe «Cigalas (colas)» y ahí no hay ningún nombre latino",
        talla: { tipo: "longitud_cm" as const, cm: 3.7 },
        textoOriginal: "3,7",
      },
    ],
  };
  const [fila] = filasSinBinomio(documento, FORMATO);
  assert.equal(fila?.nombreComun, "Cigalas (colas)");
  assert.equal(fila?.talla.texto, "3,7\u00a0cm");
  assert.equal(fila?.literal, "3,7");
  assert.match(fila?.motivo ?? "", /no hay ningún nombre latino/u);
  // El caladero se escribe con SU nombre, resuelto contra las especies del catálogo: el dataset
  // guarda aquí el identificador y teclearlo sería una segunda copia de ese nombre.
  assert.equal(fila?.caladero, "Caladero Mediterráneo");
});

test("sin filas fuera del catálogo no se publica ningún bloque vacío", () => {
  assert.deepEqual(filasSinBinomio(catalogo([especie()]), FORMATO), []);
});

test("un mapeo NUESTRO sin motivo no se publica: se lee como si lo firmase WoRMS", () => {
  const huerfano = especie({
    worms: { ...especie().worms!, origen: "mareia", comoSeLlego: null },
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
      origen: "mareia",
      comoSeLlego: "se resuelve el género que la norma regula",
    },
  });
  const filas = filasDeEspecies(catalogo([genero, especie()]), FORMATO);
  assert.equal(filas.find((fila) => fila.clave === "mullus-spp")?.rango, "género, no especie");
  // Y la de especie NO se rotula: 68 rótulos «especie» serían ruido que le quitaría fuerza a los 17
  // que cambian lo que la fila significa.
  assert.equal(filas.find((fila) => fila.clave === "sparus-auratus")?.rango, null);
});

test("la familia y la subespecie también se rotulan: lo que cambia es a qué alcanza la talla", () => {
  // Los dos rangos que el dataset trae y que una unión de dos valores habría tenido que aplastar
  // contra «especie»: `Palinuridae` es una familia entera y `Trisopterus minutus capelanus` es una
  // subespecie. Son una fila cada uno y son justo las que más falta hace no aplastar.
  const familia = especie({
    nombreBoe: "Palinuridae",
    clave: "palinuridae-ab12cd",
    worms: { ...especie().worms!, rango: "familia", aceptado: null },
  });
  const subespecie = especie({
    nombreBoe: "Trisopterus minutus capelanus",
    clave: "trisopterus-minutus-capelanus-ef34ab",
    worms: { ...especie().worms!, rango: "subespecie", aceptado: null },
  });
  const filas = filasDeEspecies(catalogo([familia, subespecie]), FORMATO);
  assert.deepEqual(
    filas.map((fila) => fila.rango),
    ["familia, no especie", "subespecie, no especie"],
  );
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

test("no haber preguntado a OBIS no se publica como «nadie lo ha anotado»", () => {
  // Los dos silencios no son el mismo y la fila no puede confundirlos. Cuando el nombre no resuelve
  // en WoRMS no hay taxón por el que preguntar, así que **no se pregunta**: decir que nadie lo ha
  // anotado en OBIS sería afirmar de la fuente algo que no hemos comprobado. Es una fila real,
  // `Lophius piscatorius, L. Budegassa`, la celda que nombra dos especies.
  const noSePregunto = especie({
    worms: null,
    sinResolver: "la celda nombra dos especies dentro de una sola fila",
    caladeros: [
      enCaladero({ presencia: null, seLePreguntoAObis: false }),
    ],
  });
  const [fila] = filasDeEspecies(catalogo([noSePregunto]), FORMATO);
  // La frase sale del CÓDIGO y no del dato: por el campo de texto libre del que salía antes entraba
  // una afirmación sobre lo que hay en el mar con toda la escalera en verde (H-5 del pase de T-20).
  assert.equal(fila?.caladeros[0]?.presencia, NO_SE_PREGUNTO_A_OBIS);
  assert.match(NO_SE_PREGUNTO_A_OBIS, /no hay consulta/u);
  assert.equal(fila?.caladeros[0]?.hayCifra, false);
  // Y no se publica NINGUNA de las dos frases de más: ni la cifra ni la de cero registros.
  assert.ok(!(fila?.caladeros[0]?.presencia ?? "").includes(SIN_REGISTROS));
});

test("la talla se escribe igual que en la página de puerto, con la coma del sitio", () => {
  const conDecimal = especie({
    caladeros: [
      enCaladero({ tallas: [conTalla({ talla: { tipo: "longitud_cm", cm: 3.7 }, textoOriginal: "3,7" })] }),
    ],
  });
  const [fila] = filasDeEspecies(catalogo([conDecimal]), FORMATO);
  assert.equal(fila?.caladeros[0]?.tallas[0]?.talla.texto, "3,7\u00a0cm");
  assert.equal(fila?.caladeros[0]?.tallas[0]?.talla.hayCifra, true);
  assert.equal(fila?.caladeros[0]?.tallas[0]?.literal, "3,7");
});

test("una talla que la norma no fija se escribe como frase y no como cifra", () => {
  const sinTalla = especie({
    caladeros: [
      enCaladero({
        tallas: [conTalla({ talla: { tipo: "por_determinar", segunNota: "(*)" }, textoOriginal: "(*)" })],
      }),
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
        tallas: [
          conTalla({
            medida: "Longitud cefalotórax",
            talla: { tipo: "longitud_cm", cm: 2 },
            textoOriginal: "2",
          }),
          conTalla({
            medida: "Longitud total",
            talla: { tipo: "longitud_cm", cm: 7 },
            textoOriginal: "7",
          }),
        ],
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
          origen: "mareia",
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
