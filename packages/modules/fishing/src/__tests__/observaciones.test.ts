/**
 * **T2 · el censo de reglas**, y los golden de las cinco.
 *
 * El censo es la respuesta a un fallo concreto que la spec anticipa (§4.2): *un gate que sólo
 * prohíbe se satisface callando*. Con cero observaciones publicadas, T1 (tipos) y T3 (recomputación)
 * pasan los dos, porque no hay nada mal escrito — no hay nada. Por eso aquí no se comprueba que las
 * reglas **disparen**: se comprueba que estén **declaradas y probadas**, que es lo que se puede
 * exigir sin mentir. Que una regla no dispare un día concreto es información honrada.
 *
 * Por cada miembro de `ReglaId` se exigen las tres cosas de la spec:
 *   (a) un golden con entradas y salida fijadas,
 *   (b) una entrada en `docs/recomendaciones.md` que escriba su derivación,
 *   (c) al menos una `MagnitudCalculada` real entre sus entradas.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ContextoDelDia, FormatoDeObservaciones, ReglaId } from "../index.ts";
import {
  EntradasIlegiblesError,
  observacionesDelDia,
  REGLAS,
  REGLAS_DECLARADAS,
  reglaPorId,
  reglasImplementadas,
} from "../index.ts";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..", "..", "..", "..");

/**
 * El formato que presta la superficie, aquí en su versión mínima y **determinista**.
 *
 * `hora` no usa `Intl` a propósito: un golden que dependa de la base de datos de zonas horarias del
 * runtime deja de ser golden el día que esa base cambie. Lo que se fija aquí es que el texto sale de
 * sus entradas; que la hora sea la de Madrid lo comprueba el `dist/` construido.
 */
const FORMATO: FormatoDeObservaciones = {
  numero: (valor, decimales) => valor.toFixed(decimales).replace(".", ","),
  hora: (timeUtcMs) => {
    const d = new Date(timeUtcMs);
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  },
};

const T = (iso: string): number => Date.parse(iso);

/**
 * El día de referencia. **Explícito y no generado por una fórmula**, a propósito.
 *
 * La primera versión construía la curva con un coseno de 12 h 25 min. Era más realista y **no servía
 * como golden**: para saber si «3,0 h de 07:50 a 10:50» era correcto había que resolver un `acos`, y
 * un golden cuyo valor esperado no se puede comprobar de cabeza sólo certifica que el código sigue
 * haciendo lo que hacía. Encima dejaba **dos franjas bajas casi iguales** y la ganadora la decidía el
 * muestreo, no el cálculo.
 *
 * Con valores puestos a mano la derivación se sigue con los dedos, y está escrita en
 * `docs/recomendaciones.md`. Que la curva sea corta no le quita nada: lo que se fija aquí es la
 * traducción de entradas a texto, no la predicción, que ya tiene sus tests en `domain-core`.
 */
function diaDeReferencia(): ContextoDelDia {
  return {
    zonaHoraria: "Europe/Madrid",
    coeficiente: 78,
    extremos: [
      { clase: "pleamar", instanteUtcMs: T("2026-03-15T03:10:00Z"), altura_m: 3.2 },
      { clase: "bajamar", instanteUtcMs: T("2026-03-15T09:25:00Z"), altura_m: 0.4 },
      { clase: "pleamar", instanteUtcMs: T("2026-03-15T15:35:00Z"), altura_m: 3.27 },
      { clase: "bajamar", instanteUtcMs: T("2026-03-15T21:50:00Z"), altura_m: 0.42 },
    ],
    // Ocho muestras cada 30 min. min 0,4 - max 2,4 - rango 2,0 -> umbral 0,4 + 0,2 x 2,0 = 0,80.
    // Por debajo o igual: 09:00 (0,6), 09:30 (0,4) y 10:00 (0,5) -> franja 09:00 a 10:00 = 1,0 h.
    curva: [
      { instanteUtcMs: T("2026-03-15T08:00:00Z"), altura_m: 2.0 },
      { instanteUtcMs: T("2026-03-15T08:30:00Z"), altura_m: 1.2 },
      { instanteUtcMs: T("2026-03-15T09:00:00Z"), altura_m: 0.6 },
      { instanteUtcMs: T("2026-03-15T09:30:00Z"), altura_m: 0.4 },
      { instanteUtcMs: T("2026-03-15T10:00:00Z"), altura_m: 0.5 },
      { instanteUtcMs: T("2026-03-15T10:30:00Z"), altura_m: 0.9 },
      { instanteUtcMs: T("2026-03-15T11:00:00Z"), altura_m: 1.6 },
      { instanteUtcMs: T("2026-03-15T11:30:00Z"), altura_m: 2.4 },
    ],
    solunar: {
      // Separacion de cada periodo a su extremo mas cercano: 15, 55, 30 y 45 min. **Sin empate**: la
      // primera version ponia el tercero a las 22:05, que empataba a 15 min con el primero, y
      // entonces el golden dependia del orden del array en vez de del calculo.
      periodos: [
        { clase: "mayor", picoUtcMs: T("2026-03-15T09:40:00Z") },
        { clase: "menor", picoUtcMs: T("2026-03-15T04:05:00Z") },
        { clase: "mayor", picoUtcMs: T("2026-03-15T22:20:00Z") },
        { clase: "menor", picoUtcMs: T("2026-03-15T16:20:00Z") },
      ],
      fraccionIluminada: 0.73,
      edadLunarDias: 9.8,
      faseLunar: "waxing-gibbous",
      ortoSolarUtcMs: T("2026-03-15T06:40:00Z"),
      ocasoSolarUtcMs: T("2026-03-15T18:20:00Z"),
    },
  };
}

// --- (a) Los goldens: entradas fijas, salida fijada ---------------------------------------------

/**
 * Los cinco textos esperados, **derivados a mano** de las entradas del fixture y no pegados de la
 * salida del codigo: un golden que copia lo que el codigo produce sólo certifica que no ha cambiado.
 *
 * El espacio entre cifra y unidad va como `\u00a0` **escapado**: escribirlo como caracter deja el
 * fuente con un espacio invisible que nadie ve al revisar y que un editor puede normalizar a un
 * espacio normal — y entonces el golden pasaria a exigir lo contrario de lo que el sitio publica.
 */
const NB = "\u00a0";

const GOLDEN: Readonly<Record<ReglaId, string>> = {
  // 09:40 esta a 15 min de la bajamar de 09:25, la separacion mas corta del dia.
  "coincidencia-solunar-marea": `El periodo mayor de 09:40 queda a 15${NB}min de la bajamar de 09:25.`,
  // Entre el orto (06:40) y el ocaso (18:20) caen 09:40 y 16:20; fuera, 04:05 y 22:20.
  "periodo-en-luz": "2 de los 4 periodos solunares del día caen entre el orto y el ocaso del Sol.",
  // Mayor pleamar 3,27 - menor bajamar 0,40 = 2,87.
  "rango-del-dia":
    `La marea recorre 2,87${NB}m entre la bajamar de 0,40${NB}m y la pleamar de 3,27${NB}m; ` +
    "el coeficiente del día es 78.",
  // Umbral 0,80; por debajo o igual de 09:00 a 10:00.
  "franja-de-nivel-bajo":
    `El nivel se mantiene por debajo de 0,80${NB}m durante 1,0${NB}h, de 09:00 a 10:00.`,
  "iluminacion-lunar":
    `La Luna está gibosa creciente, con el 73${NB}% del disco iluminado y 9,8${NB}días de edad.`,
};

test("golden · cada regla produce exactamente su texto con las entradas del día de referencia", () => {
  const dia = diaDeReferencia();
  for (const regla of REGLAS) {
    const observacion = regla.observar(dia, FORMATO);
    assert.notEqual(
      observacion,
      null,
      `la regla «${regla.id}» no dispara con el día de referencia, así que su golden no prueba nada: ` +
        "el día de referencia tiene que ejercitar las cinco",
    );
    assert.equal(observacion?.texto, GOLDEN[regla.id], `texto de «${regla.id}»`);
  }
});

/**
 * **Este test lo pidió un sabotaje que no mordió.**
 *
 * Al probar el golden ensanchando `VENTANA_COINCIDENCIA_MS` de 2 h a 12 h, la suite siguió verde. No
 * fallaba el sabotaje: fallaba el fixture. Sus cuatro separaciones son de 15 a 55 min, todas dentro
 * de la ventana, así que la constante podía valer lo que fuera y **ningún test se enteraba**. La
 * ventana es la mitad de la regla —lo que decide que NO haya coincidencia— y no tenía quien la
 * mirase.
 */
test("la ventana de 2 h se ejercita: fuera de ella la regla NO dispara", () => {
  const dia = diaDeReferencia();
  const lejano: ContextoDelDia = {
    ...dia,
    // Un único periodo, a 3 h 5 min de la bajamar más cercana (09:25): fuera de la ventana.
    solunar: {
      ...dia.solunar,
      periodos: [{ clase: "mayor", picoUtcMs: T("2026-03-15T12:30:00Z") }],
    },
    // Y sin más extremos que ese, para que ningún otro par se cuele dentro de la ventana.
    extremos: [{ clase: "bajamar", instanteUtcMs: T("2026-03-15T09:25:00Z"), altura_m: 0.4 }],
  };
  const regla = reglaPorId("coincidencia-solunar-marea");
  assert.equal(
    regla?.observar(lejano, FORMATO),
    null,
    "con el periodo a 3 h del extremo la regla dispara igual: la ventana no está limitando nada",
  );
});

test("dentro de la ventana, el mismo día sí dispara: el caso negativo no es un falso negativo", () => {
  const dia = diaDeReferencia();
  const cerca: ContextoDelDia = {
    ...dia,
    solunar: {
      ...dia.solunar,
      // 1 h 55 min de la bajamar: dentro de la ventana por poco.
      periodos: [{ clase: "mayor", picoUtcMs: T("2026-03-15T11:20:00Z") }],
    },
    extremos: [{ clase: "bajamar", instanteUtcMs: T("2026-03-15T09:25:00Z"), altura_m: 0.4 }],
  };
  const regla = reglaPorId("coincidencia-solunar-marea");
  assert.notEqual(
    regla?.observar(cerca, FORMATO),
    null,
    "a 1 h 55 min tampoco dispara: entonces el test de arriba pasa por el motivo equivocado",
  );
});

// --- T2 · el censo -------------------------------------------------------------------------------

test("T2 · lo declarado y lo implementado son exactamente lo mismo", () => {
  assert.deepEqual(
    [...reglasImplementadas()].sort(),
    [...REGLAS_DECLARADAS].sort(),
    "una regla declarada en el tipo y ausente de REGLAS (o al revés) publica un censo que miente",
  );
});

test("T2 · cada regla declarada tiene su golden", () => {
  const sinGolden = REGLAS_DECLARADAS.filter((id) => !(id in GOLDEN));
  assert.deepEqual(sinGolden, [], "reglas declaradas sin golden");
});

test("T2 · cada regla declarada escribe su derivación en docs/recomendaciones.md", () => {
  const doc = readFileSync(join(RAIZ, "docs", "recomendaciones.md"), "utf-8");
  const sinDoc = REGLAS_DECLARADAS.filter((id) => !doc.includes(`### \`${id}\``));
  assert.deepEqual(
    sinDoc,
    [],
    "reglas sin su apartado en docs/recomendaciones.md: una regla cuya derivación no está escrita " +
      "es un número que nadie puede auditar",
  );
});

test("T2 · cada regla aporta al menos una MagnitudCalculada real", () => {
  const dia = diaDeReferencia();
  for (const regla of REGLAS) {
    const observacion = regla.observar(dia, FORMATO);
    const magnitudes = observacion?.procedencia.magnitudes ?? [];
    assert.ok(
      magnitudes.length > 0,
      `«${regla.id}» dispara sin magnitudes: una observación derivada sin cálculo detrás es una ` +
        "frase escrita a mano con otro nombre",
    );
    for (const magnitud of magnitudes) {
      assert.ok(Number.isFinite(magnitud.valor), `«${regla.id}» → ${magnitud.clave} no es finito`);
      assert.match(magnitud.clave, /^[a-z][a-z0-9_]*$/, `clave «${magnitud.clave}» mal formada`);
    }
  }
});

// --- La frontera del slop, comprobada y no confiada ----------------------------------------------

test("ninguna observación promete un beneficio: enuncian el hecho", () => {
  const dia = diaDeReferencia();
  const prohibidas = [
    "recomendamos",
    "lo mejor es",
    "ideal para",
    "buen momento",
    "mejor hora",
    "picará",
    "garantiza",
    "cebo",
    "aparejo",
    "señuelo",
  ];
  for (const observacion of observacionesDelDia(dia, FORMATO)) {
    const texto = observacion.texto.toLowerCase();
    for (const prohibida of prohibidas) {
      assert.ok(
        !texto.includes(prohibida),
        `«${observacion.procedencia.reglaId}» promete en vez de enunciar: contiene «${prohibida}» ` +
          `en «${observacion.texto}»`,
      );
    }
  }
});

// --- Lo que hace fiable a T3: las entradas se validan, no se creen ------------------------------

test("recomputar desde las entradas publicadas da el mismo texto", () => {
  const dia = diaDeReferencia();
  for (const observacion of observacionesDelDia(dia, FORMATO)) {
    const regla = reglaPorId(observacion.procedencia.reglaId);
    assert.ok(regla, `sin regla para «${observacion.procedencia.reglaId}»`);
    // El viaje por JSON es el que hace T3: lo que llega del HTML no es el objeto original.
    const crudo: unknown = JSON.parse(JSON.stringify(observacion.procedencia.entradas));
    assert.equal(regla?.recomputar(crudo, FORMATO), observacion.texto);
  }
});

test("unas entradas que no son de su regla LEVANTAN, no producen otro texto", () => {
  for (const regla of REGLAS) {
    assert.throws(
      () => regla.recomputar({ cualquier: "cosa" }, FORMATO),
      EntradasIlegiblesError,
      `«${regla.id}» acepta entradas ajenas: entonces T3 compararía dos cosas igual de inventadas`,
    );
  }
});

test("un campo del tipo equivocado LEVANTA aunque el campo exista", () => {
  const dia = diaDeReferencia();
  const observacion = observacionesDelDia(dia, FORMATO)[0];
  assert.ok(observacion);
  const regla = reglaPorId(observacion.procedencia.reglaId);
  const roto = {
    ...(observacion.procedencia.entradas as Record<string, unknown>),
    separacion_min: "quince",
  };
  assert.throws(() => regla?.recomputar(roto, FORMATO), EntradasIlegiblesError);
});
