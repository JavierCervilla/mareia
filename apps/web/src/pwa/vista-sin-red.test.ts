/**
 * Los cinco estados de la sección «sin cobertura», uno por uno.
 *
 * Como en `modulos/meteo/vista.test.ts`, lo que se afirma no es un código interno sino **la frase
 * que lee un humano**: un estado que sale a la pantalla con el mismo texto que otro sería verde
 * aquí y mentira en la playa. Y lo que más se vigila es la pareja que más fácil sería confundir:
 * «no lo has guardado» y «no hay red», que son dos cosas distintas y se arreglan de forma distinta.
 */

import assert from "node:assert/strict";
import { PEGADO } from "../formato.ts";
import test from "node:test";

import { kilobytes, vistaSinRed } from "./vista-sin-red.ts";
import type { EntradaSinRed } from "./vista-sin-red.ts";

const AHORA = Date.parse("2026-08-29T12:00:00Z");
const HACE_DOS_HORAS = AHORA - 2 * 3_600_000;

function entrada(cambios: Partial<EntradaSinRed> = {}): EntradaSinRed {
  return {
    copia: undefined,
    paginaGuardada: cambios.copia !== undefined,
    conexion: true,
    sePuedeGuardar: true,
    ahoraMs: AHORA,
    nombre: "Vigo",
    fechaDeBuild: "2026-08-29",
    ventana: { desde: 2025, hasta: 2027 },
    ...cambios,
  };
}

/** Todo lo que un lector vería del sello, junto. */
function texto(vista: ReturnType<typeof vistaSinRed>): string {
  return `${vista.sello.titular} ${vista.sello.detalle ?? ""}`;
}

const COPIA = { guardadoEnMs: HACE_DOS_HORAS, bytes: 3_412 };

test("estado 1 · sin soporte para guardar, se dice y no se ofrece un botón que no haría nada", () => {
  const vista = vistaSinRed(entrada({ sePuedeGuardar: false }));

  assert.equal(vista.accion, undefined);
  assert.match(texto(vista), /no puede guardar/u);
  assert.match(texto(vista), /se sigue leyendo entera/u, "la página no depende de esto");
});

test("estado 2 · con red y sin guardar, se ofrece guardar y se dice qué se gana", () => {
  const vista = vistaSinRed(entrada());

  assert.deepEqual(vista.accion, {
    verbo: "guardar",
    etiqueta: "Guardar Vigo para usarlo sin red",
  });
  assert.match(texto(vista), /no está guardado en este dispositivo/u);
  assert.match(texto(vista), /entre 2025 y 2027/u, "se dice hasta dónde alcanza el cálculo");
  assert.match(texto(vista), /no sale de este navegador/u, "cero cuentas y cero servidor");
});

test("estado 3 · sin red y sin guardar NO se ofrece guardar: no se puede, y se explica", () => {
  const vista = vistaSinRed(entrada({ conexion: false }));

  assert.equal(vista.accion, undefined, "un botón que va a fallar no es una acción, es una trampa");
  assert.match(texto(vista), /Sin conexión/u);
  assert.match(texto(vista), /puede no estar la próxima vez/u);
  assert.match(texto(vista), /Cuando vuelva la red/u);
});

test("estado 4 · guardado y con red: la edad de la copia va delante y el peso se dice medido", () => {
  const vista = vistaSinRed(entrada({ copia: COPIA }));

  assert.deepEqual(vista.accion, { verbo: "olvidar", etiqueta: "Dejar de guardar Vigo" });
  assert.match(vista.sello.titular, /Guardado en este dispositivo hace 2 h/u);
  assert.match(texto(vista), /3,4\skB/u);
});

test("estado 5 · guardado y sin red: esto es la copia, de cuándo es, y qué depende de la red", () => {
  const vista = vistaSinRed(entrada({ copia: COPIA, conexion: false }));

  assert.match(vista.sello.titular, /Sin conexión: estás leyendo la copia guardada hace 2 h/u);
  assert.match(texto(vista), /no dependen de la conexión/u);
  assert.match(texto(vista), /El estado del mar sí depende/u);
  assert.match(texto(vista), /se calcula aquí mismo/u);
});

test("«sin guardar» y «sin red» no se leen igual: son dos situaciones y dos arreglos distintos", () => {
  const sinGuardar = texto(vistaSinRed(entrada()));
  const sinRed = texto(vistaSinRed(entrada({ copia: COPIA, conexion: false })));

  assert.notEqual(sinGuardar, sinRed);
  assert.doesNotMatch(sinGuardar, /Sin conexión/u);
  assert.doesNotMatch(sinRed, /no está guardado/u);
});

// =================================================================================================
// Los dos estados que trajo el pase adversario (H-1): los dos almacenes se separan solos.
//
// El sello se componía **solo** con IndexedDB y prometía los bytes de la Cache API. Un `addAll` que
// falla por un fichero que ya no está, el barrido de un cambio de esquema o un desalojo del
// navegador bastan para separarlos, y entonces la pantalla decía «Guardado en este dispositivo… La
// página se guarda con su hoja de estilos» sobre una caché vacía. Quien lo leía se iba a la playa
// creyendo que llevaba el almanaque encima.
// =================================================================================================

test("estado 6 · si el registro dice guardado y los bytes no están, se dice y no se promete offline", () => {
  const vista = vistaSinRed(entrada({ copia: COPIA, paginaGuardada: false }));

  assert.doesNotMatch(
    vista.sello.titular,
    /Guardado en este dispositivo/u,
    "no se puede prometer una copia que no está",
  );
  assert.match(vista.sello.titular, /ya no está en este dispositivo/u);
  // Las constantes sí siguen: se dice qué se puede hacer todavía y qué no.
  assert.match(texto(vista), /3,4\skB/u);
  assert.match(texto(vista), /lo que no está es la página/u);
  assert.deepEqual(vista.accion, { verbo: "guardar", etiqueta: "Volver a guardar Vigo" });
});

test("estado 7 · si los bytes están y el registro no, no se da por perdida una copia que sigue entera", () => {
  const vista = vistaSinRed(entrada({ copia: undefined, paginaGuardada: true }));

  assert.match(vista.sello.titular, /^Guardado en este dispositivo/u);
  assert.match(texto(vista), /se abrirá sin cobertura/u);
  assert.match(texto(vista), /calcular otro día/u, "lo que se ha perdido también se dice");
  assert.deepEqual(vista.accion, { verbo: "guardar", etiqueta: "Completar el guardado de Vigo" });
});

test("sin red, ninguno de los dos estados rotos ofrece una acción que no se podría completar", () => {
  assert.equal(vistaSinRed(entrada({ copia: COPIA, paginaGuardada: false, conexion: false })).accion, undefined);
  assert.equal(vistaSinRed(entrada({ copia: undefined, paginaGuardada: true, conexion: false })).accion, undefined);
});

/**
 * H-4 · sin cobertura no se ofrece la acción destructiva.
 *
 * Es el único botón de la sección, está pegado al sello que se lee justo para comprobar la copia, y
 * su efecto es irrecuperable en ese contexto: la propia página dice, dos estados más arriba, que
 * «cuando vuelva la red podrás guardar Vigo desde aquí».
 */
test("estado 5 · sin red no se ofrece dejar de guardar, y se explica por qué", () => {
  const vista = vistaSinRed(entrada({ copia: COPIA, conexion: false }));

  assert.equal(vista.accion, undefined, "un toque no puede destruir la copia que se está leyendo");
  assert.match(texto(vista), /Para dejar de guardarlo hace falta cobertura/u);
});

test("con red sí se ofrece dejar de guardar: entonces se puede rehacer", () => {
  assert.deepEqual(vistaSinRed(entrada({ copia: COPIA })).accion, {
    verbo: "olvidar",
    etiqueta: "Dejar de guardar Vigo",
  });
});

test("los siete estados dan siete textos distintos: ninguno se puede confundir con otro", () => {
  const textos = [
    texto(vistaSinRed(entrada({ sePuedeGuardar: false }))),
    texto(vistaSinRed(entrada())),
    texto(vistaSinRed(entrada({ conexion: false }))),
    texto(vistaSinRed(entrada({ copia: COPIA }))),
    texto(vistaSinRed(entrada({ copia: COPIA, conexion: false }))),
    texto(vistaSinRed(entrada({ copia: COPIA, paginaGuardada: false }))),
    texto(vistaSinRed(entrada({ copia: undefined, paginaGuardada: true }))),
  ];
  assert.equal(new Set(textos).size, textos.length);
});

/**
 * El invariante que el pase adversario afirma en el navegador, aquí sin navegador y en las ocho
 * combinaciones: **el sello afirma que hay una copia utilizable si y solo si la hay**.
 *
 * Se busca la afirmación en las dos formas en que la sección la escribe —«Guardado en este
 * dispositivo…» con cobertura y «estás leyendo la copia guardada…» sin ella—, porque sin red lo
 * primero que hay que decir es que no hay red, no que hay copia.
 */
const AFIRMA_QUE_HAY_COPIA = /Guardado en este dispositivo|estás leyendo la copia guardada/u;

test("el sello afirma que hay copia si y solo si la página está en la caché del worker", () => {
  for (const paginaGuardada of [true, false]) {
    for (const copia of [COPIA, undefined]) {
      for (const conexion of [true, false]) {
        const vista = vistaSinRed(entrada({ copia, paginaGuardada, conexion }));
        assert.equal(
          AFIRMA_QUE_HAY_COPIA.test(vista.sello.titular),
          paginaGuardada,
          `copia=${copia === undefined ? "no" : "sí"} caché=${paginaGuardada} red=${conexion}: «${vista.sello.titular}»`,
        );
      }
    }
  }
});

test("el tono del sello acompaña al texto, y sin red siempre avisa", () => {
  assert.equal(vistaSinRed(entrada({ copia: COPIA })).sello.clase, "fresco");
  assert.equal(vistaSinRed(entrada({ copia: COPIA, conexion: false })).sello.clase, "caducado");
  assert.equal(vistaSinRed(entrada({ conexion: false })).sello.clase, "caducado");
  assert.equal(vistaSinRed(entrada()).sello.clase, "sin-dato");
});

/**
 * El peso se escribe en kB de mil y con la unidad completa. Mezclar kB y KiB —o escribir «KB» y que
 * cada cual decida— convierte una medida en una impresión, que es justo lo que no puede ser una
 * cifra que se publica al lado de «ocupa».
 */
test("el peso se publica en kB del SI, con la unidad escrita y sin ambigüedad", () => {
  assert.equal(kilobytes(3_412), `3,4${PEGADO}kB`);
  assert.equal(kilobytes(1_000), `1,0${PEGADO}kB`);
  assert.equal(kilobytes(0), `0,0${PEGADO}kB`);
  assert.doesNotMatch(kilobytes(3_412), /KiB|KB/u);
});
