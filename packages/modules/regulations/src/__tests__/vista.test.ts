/**
 * Cómo se escribe cada clase de talla, y qué pasa cuando una cifra se quedaría sin su nota.
 *
 * Los casos son los **medidos en el dataset** —no inventados—: la lubina con su `(***)`, el pulpo
 * del Anexo II con su `(*)`, el atún rojo en kilos, el del Anexo II en «cm o kg», la cigala partida
 * en dos filas y la boga con su `1 1`. Que las cinco clases estén de verdad en el fichero publicado
 * lo comprueba el gate de `apps/web/src/modulos/normativa.test.ts`, que lee el JSON real; aquí se
 * juzga el criterio, con fixtures que caben en la pantalla.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { Caladero, EspecieConTalla } from "../tipos.ts";
import { claveDeFila, filasDeTallas, textoDeTalla } from "../vista.ts";
import { resolucionDeNota, SIN_TALLA_FIJADA, TALLA_ILEGIBLE } from "../textos.ts";

/** El formato del sitio: coma decimal, como `apps/web/src/formato.ts`. */
const FORMATO = { numero: (valor: number, decimales: number) => valor.toFixed(decimales).replace(".", ",") };

/**
 * El puerto desde el que se lee, para las excepciones que dependen de la comunidad autónoma.
 *
 * Galicia y no Balears en los casos generales: la resolución de la excepción balear tiene sus
 * propios recorridos abajo, y un fixture que la disparase de fondo escondería en cuál se está
 * midiendo.
 */
const EN_GALICIA = { slug: "galicia", nombre: "Galicia" };

const PROCEDENCIA = {
  bloque: "ani",
  fechaVigencia: "2025-11-02",
  eli: "https://www.boe.es/eli/es/rd/1995/04/07/560",
};

const NOTA_LUBINA =
  "Excepto en las divisiones 8a y 8b del Consejo Internacional para la Exploración del Mar, tanto " +
  "para la pesca profesional como para la pesca recreativa, en las que la talla mínima es de 44 " +
  "centímetros.";

function especie(parcial: Partial<EspecieConTalla>): EspecieConTalla {
  return {
    nombreComun: "Abadejo",
    nombreCientifico: "Pollachius pollachius",
    talla: { tipo: "longitud_cm", cm: 30 },
    textoOriginal: "30",
    notas: [],
    procedencia: PROCEDENCIA,
    ...parcial,
  };
}

function caladero(especies: readonly EspecieConTalla[], notas: Caladero["notas"] = []): Caladero {
  return {
    id: "cantabrico-noroeste-y-golfo-de-cadiz",
    nombre: "Cantábrico y noroeste y golfo de Cádiz",
    titulo: "Tallas mínimas autorizadas para los caladeros del Cantábrico y noroeste y del golfo de Cádiz",
    anexo: "ANEXO I",
    bloque: "ani",
    fechaVigencia: "2025-11-02",
    fechaActualizacionBloque: "2025-11-01",
    normaModificadora: "BOE-A-2025-22024",
    notas,
    especies,
  };
}

// =================================================================================================
// Las cinco clases de talla, cada una escrita como lo que es
// =================================================================================================

test("longitud en cm: entera sin decimales de adorno, decimal con los suyos", () => {
  // El separador entre cifra y unidad es un espacio DURO (U+00A0), no uno normal: una talla legal
  // partida entre dos líneas se lee mal y se cita peor. Pegarlas aquí es lo que permite que la celda
  // no lleve `white-space: nowrap`, y sin ese `nowrap` la disyunción del atún rojo deja de imponerle
  // a la tabla un ancho que desbordaba la página en los 80 puertos mediterráneos.
  assert.deepEqual(textoDeTalla({ tipo: "longitud_cm", cm: 36 }, FORMATO), {
    texto: "36\u00a0cm",
    hayCifra: true,
    explicacion: null,
  });
  // Las colas de cigala: `3,7`. Con los decimales fijados a cero esto diría «4 cm», que es media
  // talla de más sobre una cifra legal.
  assert.equal(textoDeTalla({ tipo: "longitud_cm", cm: 3.7 }, FORMATO).texto, "3,7\u00a0cm");
  assert.equal(textoDeTalla({ tipo: "longitud_cm", cm: 8.5 }, FORMATO).texto, "8,5\u00a0cm");
});

test("peso: se dice que son kilos y que son de peso, porque la columna del BOE dice «en cm»", () => {
  assert.equal(textoDeTalla({ tipo: "peso_kg", kg: 6.4 }, FORMATO).texto, "6,4\u00a0kg de peso");
  assert.equal(textoDeTalla({ tipo: "peso_kg", kg: 1 }, FORMATO).texto, "1\u00a0kg de peso");
});

test("longitud o peso: las dos, y con la disyunción de la norma", () => {
  assert.equal(
    textoDeTalla({ tipo: "longitud_o_peso", cm: 80, kg: 10 }, FORMATO).texto,
    "80\u00a0cm o 10\u00a0kg de peso",
  );
});

test("talla por determinar: se dice que la norma no la fija, no se deja el hueco", () => {
  const escrita = textoDeTalla({ tipo: "por_determinar", segunNota: "(*)" }, FORMATO);
  assert.equal(escrita.texto, SIN_TALLA_FIJADA);
  assert.equal(escrita.hayCifra, false, "no es una cifra y no se alinea como tal");
});

test("sin dato legible: se dice que no hay talla legible y por qué, sin corregir el literal", () => {
  const motivo = "la norma imprime «1 1», que no se lee como una talla en cm ni como un peso";
  const escrita = textoDeTalla({ tipo: "sin_dato_legible", motivo }, FORMATO);
  assert.equal(escrita.texto, TALLA_ILEGIBLE);
  assert.equal(escrita.hayCifra, false);
  assert.equal(escrita.explicacion, motivo, "el motivo se publica: la ausencia dice por qué lo es");
});

test("la boga llega a la fila con su literal «1 1» intacto: nadie lo arregla a «11»", () => {
  const [fila] = filasDeTallas(
    caladero([
      especie({
        nombreComun: "Boga",
        nombreCientifico: "Boops boops",
        talla: { tipo: "sin_dato_legible", motivo: "la norma imprime «1 1»" },
        textoOriginal: "1 1",
      }),
    ]),
    FORMATO,
    EN_GALICIA,
  );
  assert.equal(fila?.literal, "1 1");
  assert.equal(fila?.talla.texto, TALLA_ILEGIBLE);
});

// =================================================================================================
// Ninguna cifra sin su nota
// =================================================================================================

test("la nota llega a la fila con su TEXTO, no solo con la marca", () => {
  const [fila] = filasDeTallas(
    caladero(
      [
        especie({
          nombreComun: "Lubina",
          nombreCientifico: "Dicentrarchus labrax",
          talla: { tipo: "longitud_cm", cm: 36 },
          textoOriginal: "36 (***)",
          notas: ["(***)"],
        }),
      ],
      [{ marca: "(***)", texto: NOTA_LUBINA }],
    ),
    FORMATO,
    EN_GALICIA,
  );
  // Una marca sola obligaría a bajar al pie a buscarla. Son 8 cm de diferencia, y del lado que
  // multa. Y esta nota **no se resuelve**: habla de divisiones del CIEM, que es geometría marina
  // que este portal no calcula (ver `excepciones.ts`).
  assert.deepEqual(fila?.notas, [
    { marca: "(***)", texto: NOTA_LUBINA, resolucion: { tipo: "sin_resolver" } },
  ]);
});

test("una marca sin nota en el anexo LEVANTA: no se publica una cifra con una estrella muda", () => {
  assert.throws(
    () =>
      filasDeTallas(
        caladero([
          especie({
            nombreComun: "Lubina",
            talla: { tipo: "longitud_cm", cm: 36 },
            textoOriginal: "36 (***)",
            notas: ["(***)"],
          }),
        ]),
        FORMATO,
        EN_GALICIA,
      ),
    /Lubina: la marca \(\*\*\*\) no tiene nota/u,
  );
});

test("una talla «por determinar» que no arrastra su nota LEVANTA: diría que no hay sin decir por qué", () => {
  assert.throws(
    () =>
      filasDeTallas(
        caladero(
          [
            especie({
              nombreComun: "Anguila",
              talla: { tipo: "por_determinar", segunNota: "(*)" },
              textoOriginal: "(*)",
              notas: [],
            }),
          ],
          [{ marca: "(*)", texto: "Talla por determinar." }],
        ),
        FORMATO,
        EN_GALICIA,
      ),
    /Anguila: la talla está «por determinar» según \(\*\)/u,
  );
});

// =================================================================================================
// Nombres: los que la norma da y los que no
// =================================================================================================

test("cuando la norma no da el binomio, viaja el motivo y no un hueco", () => {
  const motivo = "la norma escribe «Cigalas (colas)» y ahí no hay ningún nombre latino";
  // Se construye entera y no con el `especie()` de arriba: lo que se prueba es la AUSENCIA del
  // campo, y un `nombreCientifico: undefined` sobre la base no la produce (ni el tipo lo admite,
  // con `exactOptionalPropertyTypes`).
  const cigalaColas: EspecieConTalla = {
    nombreComun: "Cigalas (colas)",
    nombreCientificoAusente: motivo,
    talla: { tipo: "longitud_cm", cm: 3.7 },
    textoOriginal: "3,7",
    notas: [],
    procedencia: PROCEDENCIA,
  };
  const [fila] = filasDeTallas(caladero([cigalaColas]), FORMATO, EN_GALICIA);
  assert.deepEqual(fila?.cientifico, { tipo: "ausente", motivo });
});

test("una fila sin binomio y sin motivo LEVANTA: la ausencia muda no se publica", () => {
  const muda: EspecieConTalla = {
    nombreComun: "Fantasma",
    talla: { tipo: "longitud_cm", cm: 10 },
    textoOriginal: "10",
    notas: [],
    procedencia: PROCEDENCIA,
  };
  assert.throws(
    () => filasDeTallas(caladero([muda]), FORMATO, EN_GALICIA),
    /Fantasma: no trae nombre científico ni el motivo/u,
  );
});

test("el nombre local canario solo aparece donde la norma lo da; en los otros anexos es null", () => {
  const [conLocal, sinLocal] = filasDeTallas(
    caladero([
      especie({ nombreComun: "Aligote", nombreLocalCanario: "Besuguito aligote" }),
      especie({ nombreComun: "Abadejo" }),
    ]),
    FORMATO,
    EN_GALICIA,
  );
  assert.deepEqual(conLocal?.local, { tipo: "nombre", valor: "Besuguito aligote" });
  assert.equal(sinLocal?.local, null);
});

// =================================================================================================
// Filas hijas y orden
// =================================================================================================

test("la cigala partida en dos medidas da dos filas con clave distinta y su rótulo", () => {
  const filas = filasDeTallas(
    caladero([
      especie({
        nombreComun: "Cigala (entera)",
        nombreCientifico: "Nephrops norvegicus",
        medida: "Longitud cefalotórax",
        talla: { tipo: "longitud_cm", cm: 2 },
        textoOriginal: "2",
      }),
      especie({
        nombreComun: "Cigala (entera)",
        nombreCientifico: "Nephrops norvegicus",
        medida: "Longitud total",
        talla: { tipo: "longitud_cm", cm: 7 },
        textoOriginal: "7",
      }),
    ]),
    FORMATO,
    EN_GALICIA,
  );
  assert.deepEqual(
    filas.map((fila) => [fila.clave, fila.medida, fila.talla.texto]),
    [
      ["cigala-entera-longitud-cefalotorax", "Longitud cefalotórax", "2\u00a0cm"],
      ["cigala-entera-longitud-total", "Longitud total", "7\u00a0cm"],
    ],
  );
});

test("el orden es el del BOE: la tabla no se reordena por talla ni por «mejores especies»", () => {
  const nombres = ["Abadejo", "Acedia", "Aguja"];
  const filas = filasDeTallas(
    caladero(
      nombres.map((nombreComun, indice) =>
        especie({ nombreComun, talla: { tipo: "longitud_cm", cm: 30 - indice } }),
      ),
    ),
    FORMATO,
    EN_GALICIA,
  );
  assert.deepEqual(
    filas.map((fila) => fila.nombreComun),
    nombres,
  );
});

test("la clave de una fila sin medida es su nombre, sin acentos ni paréntesis", () => {
  assert.equal(claveDeFila(especie({ nombreComun: "Atún rojo" })), "atun-rojo");
  assert.equal(claveDeFila(especie({ nombreComun: "Palometa negra o japuta" })), "palometa-negra-o-japuta");
});


// =================================================================================================
// La excepción que SÍ se puede resolver: la comunidad autónoma
// =================================================================================================

/** La nota `(*)` del Anexo II, literal del BOE. */
const NOTA_PULPO =
  "La talla del pulpo (Octopus vulgaris) recogida en la presente tabla no es de aplicación en las " +
  "aguas interiores y la plataforma continental de la Comunidad Autónoma de las Illes Balears.";

const EN_BALEARS = { slug: "illes-balears", nombre: "Illes Balears" };

/** El pulpo del Anexo II, con su nota, leído desde donde se le diga. */
function pulpoDesde(comunidad: { slug: string; nombre: string }) {
  const [fila] = filasDeTallas(
    caladero(
      [
        especie({
          nombreComun: "Pulpo",
          nombreCientifico: "Octopus vulgaris",
          talla: { tipo: "peso_kg", kg: 1 },
          textoOriginal: "1 kg",
          notas: ["(*)"],
        }),
      ],
      [{ marca: "(*)", texto: NOTA_PULPO }],
    ),
    FORMATO,
    comunidad,
  );
  return fila;
}

test("en un puerto balear la nota del pulpo se resuelve: ahí esa talla no rige", () => {
  // El hallazgo H-5. El criterio de esta nota es ADMINISTRATIVO —la comunidad autónoma— y el portal
  // ya sabe la de cada puerto: es con lo que construye la URL en la que está el lector.
  assert.deepEqual(pulpoDesde(EN_BALEARS)?.notas, [
    {
      marca: "(*)",
      texto: NOTA_PULPO,
      resolucion: { tipo: "no_aplica_aqui", comunidad: "Illes Balears" },
    },
  ]);
  // Y la nota entera sigue estando: resolver es AÑADIR. Si la regla se equivocase, lo que queda a
  // la vista es el literal del BOE.
  assert.match(pulpoDesde(EN_BALEARS)?.notas[0]?.texto ?? "", /no es de aplicación/u);
});

test("y en un puerto peninsular también se resuelve, diciendo que allí sí rige", () => {
  // Las dos ramas, no solo la que excepciona: publicar «aquí no aplica» en Palma y NADA en Valencia
  // le dejaría a quien lee en Valencia el mismo trabajo de antes.
  assert.deepEqual(pulpoDesde({ slug: "comunitat-valenciana", nombre: "Comunitat Valenciana" })?.notas[0]?.resolucion, {
    tipo: "aplica_aqui",
    comunidad: "Illes Balears",
  });
});

test("una nota que solo MENCIONA la comunidad no se resuelve: la regla describe a la nota, no al topónimo", () => {
  // El fallo que esta forma de regla evita: una nota futura que fijara en Balears una talla
  // distinta —en vez de excepcionarla— se publicaría con un «aquí no se aplica» que sería falso.
  const [fila] = filasDeTallas(
    caladero(
      [especie({ nombreComun: "Pulpo", talla: { tipo: "peso_kg", kg: 1 }, textoOriginal: "1 kg", notas: ["(*)"] })],
      [{ marca: "(*)", texto: "En la Comunidad Autónoma de las Illes Balears la talla es de 1,5 kg." }],
    ),
    FORMATO,
    EN_BALEARS,
  );
  assert.deepEqual(fila?.notas[0]?.resolucion, { tipo: "sin_resolver" });
});

test("las tres resoluciones se escriben distinto, y la que no se puede resolver no escribe nada", () => {
  assert.equal(resolucionDeNota({ tipo: "sin_resolver" }), null);
  assert.match(
    resolucionDeNota({ tipo: "no_aplica_aqui", comunidad: "Illes Balears" }) ?? "",
    /^En este puerto no se aplica: está en Illes Balears\.$/u,
  );
  assert.match(
    resolucionDeNota({ tipo: "aplica_aqui", comunidad: "Illes Balears" }) ?? "",
    /^En este puerto sí se aplica: la excepción es solo para Illes Balears\.$/u,
  );
});
