/**
 * La normativa **tal y como está publicada en `data/normativa/tallas-minimas.json`**, no contra un
 * fixture.
 *
 * Un fixture aquí no serviría: lo que puede romperse es el acuerdo entre el dataset que construye
 * el pipeline (carril A) y la interfaz que lo pinta (carril B). Un test con datos de juguete pasa
 * en verde el día que el pipeline cambia un nombre de campo y la página empieza a publicar huecos.
 *
 * Se mide, y las cifras se afirman: si el censo cambia, esto se pone rojo y alguien tiene que ir a
 * mirar por qué —que es exactamente lo que hay que hacer cuando cambia una norma.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { filasDeTallas, textoDeTalla } from "@mareia/module-regulations";
import type { Talla } from "@mareia/module-regulations";

import { cargarPuertos } from "../datos/catalogo.ts";
import { cargarTablaDeTallas, FORMATO_DE_TALLAS } from "./normativa.ts";
import type { ContextoDeSeccion } from "./contexto.ts";

/** Un contexto de sección como el que compone la página de puerto, para pedir la tabla por slug. */
function contexto(slug: string): ContextoDeSeccion {
  return { slug, nombre: slug, fechaIso: "2026-08-30", timezone: "Europe/Madrid" };
}

/** Un puerto de cada caladero, para no repetir slugs a lo largo del fichero. */
const BILBAO = contexto("bilbao"); // Anexo I  · cantábrico-noroeste-y-golfo-de-cádiz
const VALENCIA = contexto("valencia"); // Anexo II · mediterráneo
const TELDE = contexto("telde"); // Anexo III · canario

// =================================================================================================
// El censo del dataset publicado
// =================================================================================================

test("los tres caladeros publican 118 tallas: 53 del Anexo I, 34 del II y 31 del III", async () => {
  const porCaladero = await Promise.all(
    [BILBAO, VALENCIA, TELDE].map(async (puerto) => (await cargarTablaDeTallas(puerto)).caladero),
  );
  assert.deepEqual(
    porCaladero.map((caladero) => [caladero.id, caladero.anexo, caladero.especies.length]),
    [
      ["cantabrico-noroeste-y-golfo-de-cadiz", "ANEXO I", 53],
      ["mediterraneo", "ANEXO II", 34],
      ["canario", "ANEXO III", 31],
    ],
  );
  assert.equal(
    porCaladero.reduce((total, caladero) => total + caladero.especies.length, 0),
    118,
  );
});

test("las cinco clases de talla están todas en el fichero publicado, y en las cantidades medidas", async () => {
  // Si alguna clase dejara de aparecer, la rama que la pinta se quedaría sin cobertura sin que
  // ningún test se pusiera rojo: el `switch` seguiría compilando y nadie pasaría por ella.
  const cuenta = new Map<Talla["tipo"], number>();
  for (const puerto of [BILBAO, VALENCIA, TELDE]) {
    const { caladero } = await cargarTablaDeTallas(puerto);
    for (const especie of caladero.especies) {
      cuenta.set(especie.talla.tipo, (cuenta.get(especie.talla.tipo) ?? 0) + 1);
    }
  }
  assert.deepEqual(Object.fromEntries(cuenta), {
    longitud_cm: 101,
    peso_kg: 9,
    por_determinar: 6,
    sin_dato_legible: 1,
    longitud_o_peso: 1,
  });
});

test("cada cifra declara su procedencia y coincide con la del caladero (gate G1, visto desde la web)", async () => {
  for (const puerto of [BILBAO, VALENCIA, TELDE]) {
    const { caladero } = await cargarTablaDeTallas(puerto);
    for (const especie of caladero.especies) {
      assert.equal(especie.procedencia.bloque, caladero.bloque, especie.nombreComun);
      assert.equal(especie.procedencia.fechaVigencia, caladero.fechaVigencia, especie.nombreComun);
      assert.ok(especie.procedencia.eli.startsWith("https://www.boe.es/eli/"), especie.nombreComun);
      assert.ok(especie.textoOriginal.length > 0, `${especie.nombreComun} sin literal del BOE`);
    }
  }
});

// =================================================================================================
// EL GATE: ninguna de las 9 especies con nota se pinta sin su nota
// =================================================================================================

/**
 * Las nueve, contadas sobre el dataset: las seis «talla por determinar» del Anexo I con su `(*)`,
 * el boquerón con su `(**)`, la lubina con su `(***)` y el pulpo del Anexo II con su `(*)`.
 *
 * El número está escrito y no calculado a partir del propio dataset **a propósito**: si el pipeline
 * dejara de ligar una nota, un test que contase «las que tienen nota» seguiría en verde contando
 * una menos. Lo que hay que detectar es justo esa pérdida.
 */
const ESPECIES_CON_NOTA = 9;

test("las 9 especies con nota del dataset llegan a la fila con el TEXTO de su nota, no con la marca sola", async () => {
  let conNota = 0;
  for (const puerto of [BILBAO, VALENCIA, TELDE]) {
    const { caladero } = await cargarTablaDeTallas(puerto);
    const filas = filasDeTallas(caladero, FORMATO_DE_TALLAS);
    for (const [indice, especie] of caladero.especies.entries()) {
      if (especie.notas.length === 0) continue;
      conNota += 1;
      const fila = filas[indice];
      assert.ok(fila !== undefined, `${especie.nombreComun}: sin fila`);
      assert.deepEqual(
        fila.notas.map((nota) => nota.marca),
        [...especie.notas],
        `${especie.nombreComun}: las marcas de la fila no son las de la especie`,
      );
      for (const nota of fila.notas) {
        // Lo que se exige es el TEXTO. Una fila que solo llevara la marca pasaría un test de
        // «tiene nota» y publicaría la cifra igual de desnuda.
        assert.ok(
          nota.texto.length > 20,
          `${especie.nombreComun}: la nota ${nota.marca} llega vacía o truncada`,
        );
      }
    }
  }
  assert.equal(
    conNota,
    ESPECIES_CON_NOTA,
    "el dataset ha dejado de ligar alguna nota (o ha ligado una de más)",
  );
});

test("las tres notas que cambian la cifra para puertos de este portal dicen el número de la excepción", async () => {
  const { caladero: anexoI } = await cargarTablaDeTallas(BILBAO);
  const { caladero: anexoII } = await cargarTablaDeTallas(VALENCIA);
  const filasI = filasDeTallas(anexoI, FORMATO_DE_TALLAS);
  const filasII = filasDeTallas(anexoII, FORMATO_DE_TALLAS);

  // Lubina: 36 cm salvo en las divisiones 8a/8b del CIEM —el golfo de Vizcaya, o sea los puertos
  // cantábricos de este portal—, donde son 44. Ocho centímetros, del lado que multa.
  const lubina = filasI.find((fila) => fila.clave === "lubina");
  assert.equal(lubina?.talla.texto, "36\u00a0cm");
  assert.match(lubina?.notas[0]?.texto ?? "", /44 cent[ií]metros/u);
  assert.match(lubina?.notas[0]?.texto ?? "", /8a y 8b/u);

  // Boquerón: 12 cm salvo en la división IX a) —golfo de Cádiz y Atlántico ibérico—, donde son 10.
  const boqueron = filasI.find((fila) => fila.clave === "boqueron");
  assert.equal(boqueron?.talla.texto, "12\u00a0cm");
  assert.match(boqueron?.notas[0]?.texto ?? "", /10 cent[ií]metros/u);

  // Pulpo del Anexo II: la talla no se aplica en aguas interiores de Illes Balears, y ahí hay 17
  // puertos del catálogo.
  const pulpo = filasII.find((fila) => fila.clave === "pulpo");
  assert.equal(pulpo?.talla.texto, "1\u00a0kg de peso");
  assert.match(pulpo?.notas[0]?.texto ?? "", /Balears/u);
});

test("la boga se publica ilegible y con su literal: nadie ha «arreglado» el 1 1 a 11", async () => {
  const { caladero } = await cargarTablaDeTallas(BILBAO);
  const boga = filasDeTallas(caladero, FORMATO_DE_TALLAS).find((fila) => fila.clave === "boga");
  assert.equal(boga?.literal, "1 1");
  assert.equal(boga?.talla.hayCifra, false, "un `1 1` pintado como cifra sería una talla inventada");
  assert.match(boga?.talla.explicacion ?? "", /no se lee como una talla/u);
});

test("las seis «talla por determinar» dicen que la norma no la fija, y por qué", async () => {
  const { caladero } = await cargarTablaDeTallas(BILBAO);
  const filas = filasDeTallas(caladero, FORMATO_DE_TALLAS);
  const porDeterminar = filas.filter((fila) => fila.talla.texto === "La norma no fija talla");
  assert.equal(porDeterminar.length, 6);
  for (const fila of porDeterminar) {
    assert.equal(fila.talla.hayCifra, false);
    assert.deepEqual(
      fila.notas.map((nota) => nota.texto),
      ["Talla por determinar."],
      `${fila.nombreComun}: sin la nota que dice por qué no hay talla`,
    );
  }
});

// =================================================================================================
// El puente puerto → caladero
// =================================================================================================

test("los 153 puertos del catálogo resuelven su caladero: 47 · 80 · 26", async () => {
  const puertos = await cargarPuertos();
  assert.equal(puertos.length, 153);
  const cuenta = new Map<string, number>();
  for (const puerto of puertos) {
    // Levanta si el puerto no declara caladero o declara uno que la norma no publica: los dos
    // casos publicarían la tabla de otro mar, que se lee igual de bien que la correcta.
    const { caladero } = await cargarTablaDeTallas(contexto(puerto.slug));
    cuenta.set(caladero.id, (cuenta.get(caladero.id) ?? 0) + 1);
  }
  assert.deepEqual(Object.fromEntries(cuenta), {
    "cantabrico-noroeste-y-golfo-de-cadiz": 47,
    mediterraneo: 80,
    canario: 26,
  });
});

test("un puerto que no está en el catálogo levanta nombrándose, en vez de caer a un caladero", async () => {
  await assert.rejects(
    () => cargarTablaDeTallas(contexto("puerto-que-no-existe")),
    /puerto-que-no-existe no declara caladero/u,
  );
});

// =================================================================================================
// El sello que escribe el gate G2
// =================================================================================================

test("la fuente trae licencia, aviso de autenticidad y la fecha en que se comprobó la vigencia", async () => {
  const { fuente } = await cargarTablaDeTallas(BILBAO);
  assert.equal(fuente.identificador, "BOE-A-1995-8639");
  assert.equal(fuente.eli, "https://www.boe.es/eli/es/rd/1995/04/07/560");
  assert.match(fuente.licencia, /Ley 37\/2007/u);
  assert.match(fuente.aviso, /solo el texto publicado en el BOE/iu);
  // `verificadoEn` lo escribe G2 y nadie más. Aquí solo se exige que exista y sea una fecha: la
  // página la imprime tal cual, y sin ella el sello se leería como si fuese de hoy.
  assert.match(fuente.verificadoEn, /^\d{4}-\d{2}-\d{2}$/u);
});

// =================================================================================================
// El portero del dataset
// =================================================================================================

test("una clase de talla que no está en la unión no se pinta «como se pueda»: revienta", () => {
  const inventada = { tipo: "longitud_en_pulgadas", pulgadas: 14 } as unknown as Talla;
  assert.throws(() => textoDeTalla(inventada, FORMATO_DE_TALLAS), /no contemplada/u);
});
