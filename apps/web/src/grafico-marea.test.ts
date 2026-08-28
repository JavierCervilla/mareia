import test from "node:test";
import assert from "node:assert/strict";

import { alturaEn, trazarCurvaMarea } from "./grafico-marea.ts";
import type {
  EntradaCurva,
  ExtremoCurva,
  MuestraCurva,
  VentanaDestacada,
} from "./grafico-marea.ts";

const MINUTO = 60_000;
const DIA = 1_440 * MINUTO;
/** Medianoche del 28-08-2026 en hora peninsular (UTC+2), el día que usan los ejemplos. */
const INICIO = Date.parse("2026-08-27T22:00:00Z");

/**
 * Un día de marea semidiurna sintético: dos ciclos de coseno muestreados cada 10 min, con sus
 * extremos exactos. Es la forma del dato que entrega `getTides` —muestras + extremos por separado—
 * y no una curva ya resuelta: es justo la costura que este módulo tiene que coser.
 */
function diaSintetico(pasoMinutos = 10): EntradaCurva {
  const periodo = 12.42 * 60 * MINUTO;
  const media = 2.5;
  const amplitud = 2;
  const desfase = 3 * 60 * MINUTO;
  const altura = (t: number): number =>
    media + amplitud * Math.cos((2 * Math.PI * (t - INICIO - desfase)) / periodo);

  const muestras: MuestraCurva[] = [];
  for (let t = INICIO; t <= INICIO + DIA; t += pasoMinutos * MINUTO) {
    muestras.push({ timeUtcMs: t, height_m: altura(t) });
  }

  const extremos: ExtremoCurva[] = [];
  for (let vuelta = 0; ; vuelta += 1) {
    const t = INICIO + desfase + (vuelta * periodo) / 2;
    if (t > INICIO + DIA) break;
    extremos.push({
      timeUtcMs: t,
      height_m: altura(t),
      kind: vuelta % 2 === 0 ? "high" : "low",
    });
  }

  return { muestras, extremos, inicioUtcMs: INICIO, finUtcMs: INICIO + DIA };
}

interface Punto {
  readonly x: number;
  readonly y: number;
}

function puntosDelPath(path: string): readonly Punto[] {
  return path
    .replace(/^M/, "")
    .split("L")
    .map((par) => {
      const [x, y] = par.split(",");
      return { x: Number(x), y: Number(y) };
    });
}

test("la curva cubre el día completo de borde a borde", () => {
  const curva = trazarCurvaMarea(diaSintetico());
  const puntos = puntosDelPath(curva.path);

  assert.equal(puntos[0]?.x, 0);
  assert.equal(puntos.at(-1)?.x, curva.ancho);
});

test("el trazo tiene un punto por muestra y uno por extremo, sin duplicar instantes", () => {
  const dia = diaSintetico();
  const curva = trazarCurvaMarea(dia);
  const instantes = new Set([
    ...dia.muestras.map((muestra) => muestra.timeUtcMs),
    ...dia.extremos.map((extremo) => extremo.timeUtcMs),
  ]);

  assert.equal(puntosDelPath(curva.path).length, instantes.size);
});

test("cada extremo cae dentro del lienzo y respeta el orden vertical del dato", () => {
  const dia = diaSintetico();
  const curva = trazarCurvaMarea(dia);

  assert.equal(curva.extremos.length, dia.extremos.length);
  for (const marca of curva.extremos) {
    assert.ok(marca.x >= 0 && marca.x <= curva.ancho, `x fuera del lienzo: ${marca.x}`);
    assert.ok(marca.y >= 0 && marca.y <= curva.alto, `y fuera del lienzo: ${marca.y}`);
    // El eje SVG crece hacia abajo: la pleamar queda por encima del nivel medio y la bajamar debajo.
    const encima = marca.y < curva.nivelMedioY;
    assert.equal(encima, marca.kind === "high", `el extremo ${marca.kind} está del lado erróneo`);
  }
});

test("el círculo de cada extremo cae sobre el trazo que dibuja el SVG", () => {
  const curva = trazarCurvaMarea(diaSintetico());
  const trazo = puntosDelPath(curva.path);

  for (const marca of curva.extremos) {
    const encima = trazo.some(
      (punto) => Math.abs(punto.x - marca.x) < 0.05 && Math.abs(punto.y - marca.y) < 0.05,
    );
    assert.ok(encima, `el extremo en x=${marca.x} no es un punto del trazo`);
  }
});

test("las marcas del eje van del principio al final del día", () => {
  const curva = trazarCurvaMarea(diaSintetico());

  assert.equal(curva.horas[0]?.timeUtcMs, INICIO);
  assert.equal(curva.horas.at(-1)?.timeUtcMs, INICIO + DIA);
  assert.equal(curva.horas[0]?.x, 0);
  assert.equal(curva.horas.at(-1)?.x, curva.ancho);
});

test("alturaEn interpola entre muestras y se aplana fuera del rango", () => {
  const dia = diaSintetico();
  const primera = dia.muestras[0];
  const segunda = dia.muestras[1];
  assert.ok(primera && segunda);

  const medio = (primera.timeUtcMs + segunda.timeUtcMs) / 2;
  assert.ok(
    Math.abs(alturaEn(dia.muestras, medio) - (primera.height_m + segunda.height_m) / 2) < 1e-9,
  );
  assert.equal(alturaEn(dia.muestras, INICIO - DIA), primera.height_m);
  assert.equal(alturaEn(dia.muestras, INICIO + 2 * DIA), dia.muestras.at(-1)?.height_m);
});

test("la altura nunca se sale del rango de la curva del día", () => {
  const dia = diaSintetico();
  const alturas = dia.muestras.map((muestra) => muestra.height_m);
  const minimo = Math.min(...alturas);
  const maximo = Math.max(...alturas);

  for (let t = INICIO; t <= INICIO + DIA; t += 5 * MINUTO) {
    const altura = alturaEn(dia.muestras, t);
    assert.ok(altura >= minimo - 1e-9 && altura <= maximo + 1e-9, `fuera de rango en ${t}`);
  }
});

test("una curva sin puntos suficientes o desordenada rompe el build en vez de mentir", () => {
  const dia = diaSintetico();
  const primera = dia.muestras[0];
  const segunda = dia.muestras[1];
  assert.ok(primera && segunda);

  assert.throws(() => trazarCurvaMarea({ ...dia, muestras: [primera] }), /al menos dos muestras/);
  assert.throws(
    () => trazarCurvaMarea({ ...dia, muestras: [segunda, primera, ...dia.muestras.slice(2)] }),
    /orden temporal estricto/,
  );
  assert.throws(
    () => trazarCurvaMarea({ ...dia, extremos: [...dia.extremos].reverse() }),
    /orden temporal estricto/,
  );
  assert.throws(
    () => trazarCurvaMarea({ ...dia, finUtcMs: dia.inicioUtcMs }),
    /invertida o es vacía/,
  );
});

/**
 * Bandas: el overlay que el módulo de pesca (T-10) pinta bajo la curva. El gráfico no sabe de qué
 * son; lo que sí es suyo es que ninguna se salga del lienzo.
 */
const ANCHO_LIENZO = 620;

/** Una ventana cualquiera, con los instantes en horas desde el comienzo del día del ejemplo. */
function ventana(desdeHoras: number, hastaHoras: number, id = "v"): VentanaDestacada {
  return {
    id,
    inicioUtcMs: INICIO + desdeHoras * 60 * MINUTO,
    finUtcMs: INICIO + hastaHoras * 60 * MINUTO,
    enfasis: "fuerte",
    etiqueta: `de ${desdeHoras} a ${hastaHoras}`,
  };
}

function cerca(valor: number, esperado: number, tolerancia = 0.11): boolean {
  return Math.abs(valor - esperado) <= tolerancia;
}

test("una ventana dentro del día ocupa su fracción exacta del lienzo", () => {
  const curva = trazarCurvaMarea({ ...diaSintetico(), ventanas: [ventana(11, 13)] });
  const banda = curva.bandas[0];

  assert.equal(curva.bandas.length, 1);
  assert.ok(cerca(banda?.x ?? -1, (ANCHO_LIENZO * 11) / 24), `x fuera de sitio: ${banda?.x}`);
  assert.ok(cerca(banda?.ancho ?? -1, (ANCHO_LIENZO * 2) / 24), `ancho mal: ${banda?.ancho}`);
  assert.equal(banda?.etiqueta, "de 11 a 13", "la etiqueta viaja intacta al lienzo");
});

/**
 * El caso que busca el pase adversario: un periodo pertenece al día en el que cae su fenómeno, así
 * que su ventana puede empezar el día anterior o acabar el siguiente. Se recorta en el borde.
 */
test("una ventana que desborda el día civil se recorta, no se sale del lienzo", () => {
  const curva = trazarCurvaMarea({
    ...diaSintetico(),
    ventanas: [ventana(-1, 1, "antes"), ventana(23.5, 26, "despues")],
  });

  assert.deepEqual(curva.bandas.map((banda) => banda.id), ["antes", "despues"]);
  for (const banda of curva.bandas) {
    assert.ok(banda.x >= 0, `${banda.id} empieza fuera del lienzo (${banda.x})`);
    assert.ok(
      banda.x + banda.ancho <= ANCHO_LIENZO,
      `${banda.id} se sale por la derecha (${banda.x + banda.ancho})`,
    );
  }
  assert.ok(cerca(curva.bandas[0]?.ancho ?? -1, ANCHO_LIENZO / 24), "la parte de ayer no cuenta");
  assert.ok(cerca(curva.bandas[1]?.ancho ?? -1, ANCHO_LIENZO / 48), "ni la de mañana");
});

test("una ventana de otro día no se dibuja en vez de colapsar en una raya", () => {
  const curva = trazarCurvaMarea({ ...diaSintetico(), ventanas: [ventana(25, 27), ventana(-3, -1)] });

  assert.deepEqual(curva.bandas, []);
});

test("una ventana invertida rompe el build en vez de pintar un ancho negativo", () => {
  assert.throws(
    () => trazarCurvaMarea({ ...diaSintetico(), ventanas: [ventana(13, 11, "imposible")] }),
    /imposible/,
  );
});

test("sin módulos que aporten ventanas, el gráfico es el de siempre", () => {
  assert.deepEqual(trazarCurvaMarea(diaSintetico()).bandas, []);
});
