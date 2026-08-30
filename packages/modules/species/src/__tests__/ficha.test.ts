/**
 * La retícula fija de la ficha de especie, medida sin construir el sitio.
 *
 * Los gates del `dist/` (F1-F4, en `apps/web/src/ficha-especie-construido.test.ts`) miden lo mismo
 * sobre el artefacto, que es donde importa. Éstos miden que la **función no tenga la rama**: que no
 * exista el camino de código que devuelve un campo sin valor y sin motivo, ni el que publica una
 * foto sin autor, ni el que se calla una clave que el dataset no menciona.
 *
 * Aquí vive además el único caso que el gate del `dist/` todavía no puede medir —**una ficha con
 * foto**—, porque `data/especies/fotos.json` lo publica el otro carril de T-23 y aún no está en el
 * repositorio. La composición del crédito se prueba con la forma del contrato congelado, que es
 * exactamente contra lo que se escribió el lector.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type {
  DatosDeLaFicha,
  EspaciosDelCaladero,
  FotoDeCommons,
  FotosDeLaFicha,
  Rellenado,
} from "../ficha.ts";
import { fichasDeEspecies } from "../ficha.ts";
import { FUERA_DEL_ANEXO_III, LA_NORMA_NOMBRA_UNA_ESPECIE, RANGO_SIN_TAXON } from "../textos.ts";
import type {
  CatalogoDeEspecies,
  EspecieDelCatalogo,
  EspecieEnCaladero,
  TallaDelAnexo,
} from "../tipos.ts";
import { CatalogoIncompleto } from "../vista.ts";

/** El formato del sitio, prestado: coma decimal, como en la página. */
const FORMATO = {
  numero: (valor: number, decimales: number): string => valor.toFixed(decimales).replace(".", ","),
};

const ESPACIOS: EspaciosDelCaladero = {
  nombre: "Mediterráneo",
  puertos: 80,
  conEspacio: 73,
  espacios: 36,
  radioKm: 30,
};

function conTalla(parcial: Partial<TallaDelAnexo> = {}): TallaDelAnexo {
  return {
    medida: null,
    talla: { tipo: "longitud_cm", cm: 16 },
    textoOriginal: "16",
    notas: [],
    ...parcial,
  };
}

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
    criterio: { cajas: [] },
    especies,
    sinNombreCientifico: [],
  };
}

/** Los cruces que presta la superficie, con lo mínimo para que las 86 filas tengan respuesta. */
function datos(
  especies: readonly EspecieDelCatalogo[],
  parcial: Partial<DatosDeLaFicha> = {},
): DatosDeLaFicha {
  return {
    nombreLocalCanario: new Map(
      especies.map((una): [string, Rellenado<string>] => [
        una.clave,
        { tipo: "hueco", motivo: FUERA_DEL_ANEXO_III },
      ]),
    ),
    espaciosPorCaladero: new Map([["mediterraneo", ESPACIOS]]),
    fotos: { tipo: "sin_dataset" },
    ...parcial,
  };
}

const FOTO: FotoDeCommons = {
  fichero: "File:Sparus aurata.jpg",
  url: "https://upload.wikimedia.org/wikipedia/commons/1/1a/Sparus_aurata.jpg",
  descripcion: "https://commons.wikimedia.org/wiki/File:Sparus_aurata.jpg",
  autor: "Roberto Pillon",
  licencia: "CC BY-SA 3.0",
  licenciaUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  identificadaPor: { fuente: "Wikidata", entidad: "Q26718", propiedad: "P18" },
};

function conFoto(clave: string, foto: FotoDeCommons = FOTO): FotosDeLaFicha {
  return {
    tipo: "ingerido",
    consultadoEn: "2026-08-30",
    porClave: new Map([[clave, { tipo: "dato", valor: foto }]]),
  };
}

// =================================================================================================
// F3 · ningún hueco mudo
// =================================================================================================

test("la fila del rango responde también cuando la norma nombra una especie", () => {
  const especies = [especie()];
  const [ficha] = fichasDeEspecies(catalogo(especies), datos(especies), FORMATO);
  // En la tabla del catálogo esta fila calla —un «especie» repetido 68 veces sería ruido—; en una
  // retícula fija, callar es dejar la fila en blanco, que es el defecto que la retícula impide.
  assert.deepEqual(ficha?.rango, { tipo: "dato", valor: LA_NORMA_NOMBRA_UNA_ESPECIE });
  // Y no arrastra la glosa de los géneros: hablaría de un alcance que esta ficha no tiene.
  assert.equal(ficha?.notaDelRango, null);
});

test("una fila de género rotula su alcance y arrastra la glosa que lo explica", () => {
  const especies = [
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
        comoSeLlego: "«spp» abrevia «species pluralis»: la norma regula el género entero",
      },
    }),
  ];
  const [ficha] = fichasDeEspecies(catalogo(especies), datos(especies), FORMATO);
  assert.deepEqual(ficha?.rango, { tipo: "dato", valor: "género, no especie" });
  assert.match(ficha?.notaDelRango ?? "", /regulando el género entero/u);
});

test("sin registro de WoRMS la fila del rango publica su motivo, no un hueco", () => {
  const especies = [
    especie({
      nombreBoe: "Lophius piscatorius, L. Budegassa",
      clave: "lophius",
      worms: null,
      sinResolver: "la celda nombra dos especies dentro de una sola fila",
    }),
  ];
  const [ficha] = fichasDeEspecies(catalogo(especies), datos(especies), FORMATO);
  assert.deepEqual(ficha?.rango, { tipo: "hueco", motivo: RANGO_SIN_TAXON });
  assert.equal(ficha?.taxon.tipo, "sin_resolver");
});

test("una especie sin nombre local canario publica por qué, y no una celda vacía", () => {
  const especies = [especie()];
  const [ficha] = fichasDeEspecies(catalogo(especies), datos(especies), FORMATO);
  assert.equal(ficha?.nombreLocalCanario.tipo, "hueco");
  if (ficha?.nombreLocalCanario.tipo !== "hueco") return;
  assert.match(ficha.nombreLocalCanario.motivo, /sólo lo escribe el Anexo III/u);
});

test("levanta si un cruce no trae respuesta para una especie: eso publicaría un hueco mudo", () => {
  const especies = [especie()];
  assert.throws(
    () =>
      fichasDeEspecies(
        catalogo(especies),
        { ...datos(especies), nombreLocalCanario: new Map() },
        FORMATO,
      ),
    CatalogoIncompleto,
  );
});

test("levanta si un caladero del catálogo no está en el derivado de espacios protegidos", () => {
  const especies = [especie()];
  assert.throws(
    () =>
      fichasDeEspecies(
        catalogo(especies),
        { ...datos(especies), espaciosPorCaladero: new Map() },
        FORMATO,
      ),
    CatalogoIncompleto,
  );
});

// =================================================================================================
// F1 · la nota viaja con la cifra
// =================================================================================================

test("la nota de una talla llega ENTERA al bloque de su cifra, no la marca sola", () => {
  const especies = [
    especie({
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
                    "Exploración del Mar, en las que la talla mínima es de 44 centímetros.",
                },
              ],
            }),
          ],
        }),
      ],
    }),
  ];
  const [ficha] = fichasDeEspecies(catalogo(especies), datos(especies), FORMATO);
  const talla = ficha?.caladeros[0]?.tallas[0];
  assert.equal(talla?.talla.texto, "36 cm");
  // El texto entero, que es lo que convierte 36 en 44: una marca sola sería una promesa de nota.
  assert.match(talla?.notas[0] ?? "", /44 centímetros/u);
  assert.match(talla?.notas[0] ?? "", /^\(\*\*\*\) /u);
});

// =================================================================================================
// F2 · ninguna foto sin autor y licencia
// =================================================================================================

test("la foto lleva autor y licencia en la misma frase, y dice quién la identificó", () => {
  const especies = [especie()];
  const [ficha] = fichasDeEspecies(
    catalogo(especies),
    datos(especies, { fotos: conFoto("sparus-auratus") }),
    FORMATO,
  );
  assert.equal(ficha?.foto.tipo, "dato");
  if (ficha?.foto.tipo !== "dato") return;
  // Autor y licencia van JUNTOS en la misma frase: en la muestra de 12 ficheros del plan hay seis
  // licencias distintas, así que un pie global de la página sería falso para cinco de ellas.
  assert.equal(ficha.foto.valor.credito, "Foto de Roberto Pillon · CC BY-SA 3.0");
  assert.equal(ficha.foto.valor.rotuloDeLaLicencia, "Texto de la licencia CC BY-SA 3.0");
  assert.equal(ficha.foto.valor.licenciaUrl, FOTO.licenciaUrl);
  // Y la identificación es de Wikidata, no nuestra: publicarla sin decirlo convertiría una decisión
  // editorial ajena en una afirmación nuestra sobre qué animal es ése.
  assert.match(ficha.foto.valor.identificacion, /Wikidata \(Q26718, propiedad P18\)/u);
  assert.match(ficha.foto.valor.alternativo, /Wikidata asocia al taxón «Sparus auratus»/u);
});

test("una especie que el dataset de fotos no menciona hace levantar, no publica un hueco mudo", () => {
  const especies = [especie()];
  assert.throws(
    () =>
      fichasDeEspecies(
        catalogo(especies),
        datos(especies, { fotos: conFoto("otra-clave") }),
        FORMATO,
      ),
    CatalogoIncompleto,
  );
});

test("sin dataset de fotos el hueco dice que aún no se ha preguntado, no que no haya foto", () => {
  const especies = [especie()];
  const [ficha] = fichasDeEspecies(catalogo(especies), datos(especies), FORMATO);
  assert.equal(ficha?.foto.tipo, "hueco");
  if (ficha?.foto.tipo !== "hueco") return;
  assert.match(ficha.foto.motivo, /aún no se ha preguntado/u);
  assert.ok(!/no tiene foto\./u.test(ficha.foto.motivo));
});

// =================================================================================================
// Los espacios protegidos: un recuento de puertos, nunca una afirmación sobre la especie
// =================================================================================================

test("los espacios se cuentan por caladero y la frase habla de puertos, no de la especie", () => {
  const especies = [especie()];
  const [ficha] = fichasDeEspecies(catalogo(especies), datos(especies), FORMATO);
  const frase = ficha?.espacios[0] ?? "";
  assert.match(frase, /De los 80 puertos del caladero Mediterráneo/u);
  assert.match(frase, /73 tienen algún espacio protegido a menos de 30 km/u);
  assert.match(frase, /36 espacios distintos/u);
  // Ninguna forma de leer que la especie esté protegida: el sujeto de la frase son los puertos.
  assert.ok(!/esta especie está protegida/u.test(frase));
});

// =================================================================================================
// Las dos grafías del BOE son dos fichas, y cada una sabe de la otra
// =================================================================================================

test("dos filas del mismo taxón se cruzan por clave, para poder enlazarse", () => {
  const especies = [
    especie({ nombreBoe: "Thunnus thynnus", clave: "thunnus-thynnus-a" }),
    especie({ nombreBoe: "Thunnus Thynnus", clave: "thunnus-thynnus-b" }),
  ];
  const fichas = fichasDeEspecies(catalogo(especies), datos(especies), FORMATO);
  const [una, otra] = fichas;
  assert.equal(fichas.length, 2, "las dos grafías de la norma son dos fichas y no se fusionan");
  assert.deepEqual(una?.clavesHermanas, ["thunnus-thynnus-b"]);
  assert.deepEqual(otra?.clavesHermanas, ["thunnus-thynnus-a"]);
  assert.match(una?.tambienEn ?? "", /«Thunnus Thynnus»/u);
});
