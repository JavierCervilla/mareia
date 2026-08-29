/**
 * Los cinco estados de la sección «sin cobertura», uno por uno.
 *
 * Como en `modulos/meteo/vista.test.ts`, lo que se afirma no es un código interno sino **la frase
 * que lee un humano**: un estado que sale a la pantalla con el mismo texto que otro sería verde
 * aquí y mentira en la playa. Y lo que más se vigila es la pareja que más fácil sería confundir:
 * «no lo has guardado» y «no hay red», que son dos cosas distintas y se arreglan de forma distinta.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { kilobytes, vistaSinRed } from "./vista-sin-red.ts";
import type { EntradaSinRed } from "./vista-sin-red.ts";

const AHORA = Date.parse("2026-08-29T12:00:00Z");
const HACE_DOS_HORAS = AHORA - 2 * 3_600_000;

function entrada(cambios: Partial<EntradaSinRed> = {}): EntradaSinRed {
  return {
    copia: undefined,
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
  assert.match(texto(vista), /3,4 kB/u);
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

test("los cinco estados dan cinco textos distintos: ninguno se puede confundir con otro", () => {
  const textos = [
    texto(vistaSinRed(entrada({ sePuedeGuardar: false }))),
    texto(vistaSinRed(entrada())),
    texto(vistaSinRed(entrada({ conexion: false }))),
    texto(vistaSinRed(entrada({ copia: COPIA }))),
    texto(vistaSinRed(entrada({ copia: COPIA, conexion: false }))),
  ];
  assert.equal(new Set(textos).size, textos.length);
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
  assert.equal(kilobytes(3_412), "3,4 kB");
  assert.equal(kilobytes(1_000), "1,0 kB");
  assert.equal(kilobytes(0), "0,0 kB");
  assert.doesNotMatch(kilobytes(3_412), /KiB|KB/u);
});
