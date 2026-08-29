/**
 * PASE ADVERSARIO · T-13 (rol `qa-adversario`, skill `qa-adversarial`).
 *
 * Función objetivo INVERTIDA: estos tests NO confirman que el catálogo funciona — el `verificador`
 * y el rol `qa` ya lo hicieron. Aquí se ataca la PROMESA de la trayectoria:
 *
 *   **Un puerto no publica una precisión que no tiene.** 153 puertos, 120 de ellos diciendo en su
 *   propia página que su marea es una estimación y no una medida.
 *
 * Informe del pase, con las clases atacadas, los números y los no reproducidos:
 * `docs/qa/informe-adversario-t13.md`. Bundles: `docs/qa/bundles/t13-adversario/`.
 *
 * TRINQUETE — los hallazgos abiertos van envueltos en `hallazgoAbierto()`, el `test.fail()` de la
 * skill traducido a `node --test` que estrenó el pase de T-09: el cuerpo afirma **lo que la app debería hacer**, no el
 * síntoma, así que hoy falla y CI sigue verde; el día que alguien lo arregle, el mismo test se pone
 * en rojo pidiendo que se le quite el envoltorio, y a partir de ahí es gate permanente. Ninguna
 * aserción se ha escrito «al revés» para que pase.
 *
 * ESTADO — **A-17, A-18 y A-19 están corregidos y sus recorridos se han quedado como gate
 * permanente**: se les ha quitado el envoltorio y ahora vigilan de verdad, que es todo el sentido
 * del trinquete. **A-20 sigue abierto** con el suyo puesto: su arreglo —contrastar las coordenadas
 * del mareógrafo declarado contra lo que el propio dataset dice de él— está escalado al rol
 * `seguridad` en una trayectoria aparte, y hasta entonces el hallazgo se queda documentado en rojo
 * de mentira, no borrado.
 *
 * Contexto asimétrico: se ha leído la promesa (`docs/trayectorias/T-13-plan.md`, el schema de
 * estación, `contratos_validacion`), el dataset publicado y el `dist/` construido. El código se ha
 * leído para **dirigir** los ataques —de dónde sale la curva, qué mide cada gate—, nunca para
 * juzgarlo. Ni el diff ni su justificación se han abierto.
 */

import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { prepareStation } from "@mareia/domain-core";

/**
 * **El instrumento del gate A-1, el de verdad, no una copia.**
 *
 * A-17 mide *lo que el gate alcanza a ver* sobre una curva falsificada, así que tiene que llamar al
 * mismo cuerpo que corre en producción del gate. Cuando este fichero medía con una copia local, la
 * copia no se enteraba de lo que le pasara al original: se podía estrechar el detector a una sola
 * meseta —el defecto exacto que A-17 dice vigilar— y A-17 seguía verde. Por eso el detector se
 * extrajo a `curva-congelada.ts` y lo importan los dos ficheros: el trinquete de abajo sólo
 * trinquetea si no hay dos cuerpos que puedan divergir.
 */
import {
  PASO_DE_PUBLICACION_M,
  congelacionesDeLaCurva,
  excursionRealEnLaMeseta,
  tramoPlanoMasLargo,
} from "./curva-congelada.ts";
import { deps } from "./datos/deps.ts";
import { cargarDatosDePuerto } from "./datos/pagina-puerto.ts";
import { alturaEn, trazarCurvaMarea } from "./grafico-marea.ts";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PAGINA_SANTANDER = join(DIST, "mareas", "cantabria", "cantabria", "santander", "index.html");
const HAY_BUILD = existsSync(PAGINA_SANTANDER);
const SIN_BUILD = "no hay apps/web/dist: corre antes `pnpm --filter web build`";
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "data");

const MINUTO = 60_000;

/** Se lanza cuando el ataque necesita el `dist/` y no lo hay: se salta, no se confunde con el bug. */
class SinBuild extends Error {}

/**
 * El **trinquete**, con el mismo nombre y la misma tabla de verdad que estrenó el pase de T-09.
 *
 * `test.fail()` es de Playwright y aquí el arnés es `node --test`. `{ todo: true }` no sirve: un
 * `todo` que empieza a pasar se reporta como `ok … # TODO` y nadie se entera, con lo que el
 * trinquete funcionaría sólo en la dirección de no molestar y perdería la que vale. Con este
 * envoltorio: el cuerpo afirma **el comportamiento correcto**, CI se queda verde mientras el
 * hallazgo esté abierto —imprimiendo el motivo como diagnóstico en cada ejecución— y se pone
 * **rojo el día que alguien lo arregle**, pidiendo que se retire para que el ataque quede como gate
 * permanente.
 *
 * Una diferencia deliberada con la versión de T-10, que es el caveat que documenta la skill («se
 * conforma con que el cuerpo falle por cualquier motivo, así que un test podrido se pudre sin
 * avisar»): aquí sólo se traga un `AssertionError`. Si el cuerpo revienta por un `TypeError`, un
 * fichero que ya no está o un import que cambió de forma, el error **se relanza** y el test se pone
 * rojo, que es lo que hay que hacer cuando el instrumento se ha roto en vez del código.
 */
function hallazgoAbierto(nombre: string, cuerpo: () => Promise<void>): void {
  test(`${nombre} · TRINQUETE (hallazgo abierto)`, async (t: TestContext) => {
    let motivo: string | undefined;
    try {
      await cuerpo();
    } catch (error) {
      if (error instanceof SinBuild) {
        t.skip(error.message);
        return;
      }
      if (!(error instanceof assert.AssertionError)) throw error;
      motivo = error.message;
    }
    assert.ok(
      motivo !== undefined,
      `«${nombre}» YA NO FALLA: si el hallazgo está corregido, quita el trinquete ` +
        "(`hallazgoAbierto` → `test`) y deja el cuerpo como gate permanente.",
    );
    t.diagnostic(`${nombre} sigue abierto — ${motivo.replace(/\s+/gu, " ").slice(0, 320)}`);
  });
}

interface Muestra {
  readonly timeUtcMs: number;
  readonly height_m: number;
}

/** El día que publica el `dist/`, leído del propio HTML; sin build, el día UTC del reloj. */
function fechaDeHoy(): string {
  if (!HAY_BUILD) return new Date().toISOString().slice(0, 10);
  const fecha = /<time datetime="(\d{4}-\d{2}-\d{2})"/.exec(readFileSync(PAGINA_SANTANDER, "utf8"))?.[1];
  assert.ok(fecha, "la página construida no declara la fecha de sus datos");
  return fecha;
}

/** La curva del día tal y como la pinta la página, más su estación preparada. */
async function diaDe(slug: string, fechaIso: string): Promise<{
  muestras: readonly Muestra[];
  extremos: readonly { timeUtcMs: number; height_m: number; kind: "high" | "low" }[];
  inicioUtcMs: number;
  finUtcMs: number;
  estacion: ReturnType<typeof prepareStation>;
}> {
  const { dia } = await cargarDatosDePuerto(slug, fechaIso);
  const puerto = (await deps.ports.list()).find((candidato) => candidato.slug === slug);
  assert.ok(puerto, `${slug} no está en el catálogo`);
  return {
    muestras: dia.muestras.map((m) => ({ timeUtcMs: m.timeUtcMs, height_m: m.height_m })),
    extremos: dia.eventos.map((e) => ({ timeUtcMs: e.timeUtcMs, height_m: e.height_m, kind: e.kind })),
    inicioUtcMs: dia.inicioUtcMs,
    finUtcMs: dia.finUtcMs,
    estacion: prepareStation(await deps.stations.load(puerto.stationFile)),
  };
}

/**
 * Dónde colocar una congelación para que haga el máximo daño **sin** llegar a ser la meseta más
 * larga del día: en el tramo de más pendiente, que es donde la marea corre.
 *
 * La longitud es la de la meseta natural menos un paso de muestreo. Es la elección más
 * conservadora posible: cualquier ventana más larga sería la nueva meseta más larga y el gate la
 * vería, así que este ataque se queda deliberadamente **por debajo** de su radar.
 */
function congelacionMasDanina(
  muestras: readonly Muestra[],
  estacion: ReturnType<typeof prepareStation>,
  duracionMin: number,
): { readonly desdeUtcMs: number; readonly hastaUtcMs: number; readonly movimientoM: number } | undefined {
  let mejor: { desdeUtcMs: number; hastaUtcMs: number; movimientoM: number } | undefined;
  const finDelDia = muestras[muestras.length - 1]?.timeUtcMs ?? 0;
  for (const muestra of muestras) {
    const hastaUtcMs = muestra.timeUtcMs + duracionMin * MINUTO;
    if (hastaUtcMs > finDelDia) break;
    const tramo = { desdeUtcMs: muestra.timeUtcMs, hastaUtcMs };
    const movimientoM = excursionRealEnLaMeseta(muestras, estacion, tramo);
    if (mejor === undefined || movimientoM > mejor.movimientoM) {
      mejor = { ...tramo, movimientoM };
    }
  }
  return mejor;
}

/** La misma serie con un tramo congelado al nivel que tenía al empezar. */
function congelar(
  muestras: readonly Muestra[],
  tramo: { readonly desdeUtcMs: number; readonly hastaUtcMs: number },
): readonly Muestra[] {
  const nivel = alturaEn(muestras, tramo.desdeUtcMs);
  return muestras.map((m) =>
    m.timeUtcMs >= tramo.desdeUtcMs && m.timeUtcMs <= tramo.hastaUtcMs ? { ...m, height_m: nivel } : m,
  );
}

interface Ataque {
  readonly slug: string;
  readonly nombre: string;
  readonly mesetaNaturalMin: number;
  readonly congelacionMin: number;
  /** Marea real que la congelación se traga, en milímetros: el daño del fraude. */
  readonly movimientoSuprimidoMm: number;
  /**
   * Lo que el gate A-1 **denuncia** sobre la curva ya falsificada, en milímetros: la peor
   * congelación que reporta su detector. Cero = no reporta ninguna y el fraude le pasó por debajo.
   */
  readonly loQueVeElGateMm: number;
}

/**
 * Recorre el catálogo inyectando en cada puerto **la congelación más dañina que sigue siendo más
 * corta que su meseta natural** —la que se esconde detrás de ella— y anota, junto al daño, lo que el
 * gate A-1 alcanza a ver sobre la curva ya falsificada, preguntándoselo a su propio detector.
 *
 * La duración es la de la meseta natural menos un paso de muestreo: la elección más conservadora
 * posible, porque cualquier ventana más larga sería la nueva meseta más larga del día y el
 * instrumento viejo también la habría visto. El ataque se queda deliberadamente por debajo de aquel
 * radar.
 */
async function ataquesDeCongelacion(fechaIso: string): Promise<readonly Ataque[]> {
  const ataques: Ataque[] = [];
  for (const puerto of await deps.ports.list()) {
    const dia = await diaDe(puerto.slug, fechaIso);
    const natural = tramoPlanoMasLargo(dia);
    if (natural.minutos === 0) continue;
    const primera = dia.muestras[0]?.timeUtcMs ?? 0;
    const segunda = dia.muestras[1]?.timeUtcMs ?? 0;
    const pasoMin = (segunda - primera) / MINUTO;
    const duracionMin = natural.minutos - pasoMin;
    if (duracionMin < pasoMin) continue;

    const fraude = congelacionMasDanina(dia.muestras, dia.estacion, duracionMin);
    if (fraude === undefined || fraude.movimientoM <= PASO_DE_PUBLICACION_M) continue;

    const congelada = congelar(dia.muestras, fraude);
    // Lo que ve el gate es literalmente lo que el gate denuncia: se le pasa la curva ya falsificada
    // al detector de `curva-congelada.ts` —el mismo que corre en A-1— y se anota la peor congelación
    // que reporta. Si no reporta ninguna, son 0 mm: el fraude le ha pasado por debajo.
    const loQueVeElGate = congelacionesDeLaCurva(
      { muestras: congelada, inicioUtcMs: dia.inicioUtcMs, finUtcMs: dia.finUtcMs },
      dia.estacion,
    ).reduce((peor, congelacion) => Math.max(peor, congelacion.movimientoM), 0);
    ataques.push({
      slug: puerto.slug,
      nombre: puerto.name,
      mesetaNaturalMin: natural.minutos,
      congelacionMin: duracionMin,
      movimientoSuprimidoMm: fraude.movimientoM * 1000,
      loQueVeElGateMm: loQueVeElGate * 1000,
    });
  }
  return ataques.sort((a, b) => b.movimientoSuprimidoMm - a.movimientoSuprimidoMm);
}

// =================================================================================================
// A-17 · clase A5 (límites 0/1/N) — el gate de curva congelada sólo miraba UNA meseta por día
// =================================================================================================

/**
 * **La premisa del ataque, y va en verde a propósito.**
 *
 * Antes de acusar al gate de no ver un fraude hay que demostrar que el fraude **existe en el
 * artefacto**: que la curva falsificada se dibuja de verdad plana en el SVG que la página publica,
 * y no es un espejismo de la aritmética. Este test lo comprueba sobre el `<path>` que sale de
 * `trazarCurvaMarea`, que es literalmente el que va al HTML, y sobre el `dist/` construido.
 *
 * Si algún día esta premisa deja de cumplirse, el gate de abajo hay que releerlo entero: pasaría a
 * estar en verde por no tener nada que atacar, que es la manera silenciosa de perder un gate. Por
 * eso la premisa exige que el fraude **exista** y el gate exige que **se vea**: son las dos mitades.
 */
test("A-17 premisa · la congelación inyectada se dibuja plana en la curva publicada", async () => {
  const fechaIso = fechaDeHoy();
  const ataques = await ataquesDeCongelacion(fechaIso);
  assert.ok(ataques.length > 0, "sin ningún fraude que construir no hay nada que atacar: relee el hallazgo");

  const testigo = ataques[0];
  assert.ok(testigo);
  const dia = await diaDe(testigo.slug, fechaIso);
  const natural = tramoPlanoMasLargo(dia);
  const fraude = congelacionMasDanina(dia.muestras, dia.estacion, testigo.congelacionMin);
  assert.ok(fraude);
  const congelada = congelar(dia.muestras, fraude);

  const curva = trazarCurvaMarea({
    muestras: congelada,
    extremos: dia.extremos,
    inicioUtcMs: dia.inicioUtcMs,
    finUtcMs: dia.finUtcMs,
  });
  const alturasDelTrazo = curva.path
    .replace(/^M/, "")
    .split("L")
    .map((par) => Number(par.split(",")[1]));
  let planoMasLargoEnPantalla = 1;
  let corrido = 1;
  for (let i = 1; i < alturasDelTrazo.length; i += 1) {
    corrido = alturasDelTrazo[i] === alturasDelTrazo[i - 1] ? corrido + 1 : 1;
    planoMasLargoEnPantalla = Math.max(planoMasLargoEnPantalla, corrido);
  }

  // El fraude se ve en pantalla: una recta de varios puntos consecutivos a la misma altura.
  assert.ok(
    planoMasLargoEnPantalla >= 4,
    `la curva falsificada de ${testigo.nombre} sólo encadena ${planoMasLargoEnPantalla} puntos ` +
      "iguales: el fraude no llegaría al SVG y este ataque no valdría",
  );
  // Y suprime movimiento real muy por encima de lo que el redondeo puede excusar.
  assert.ok(
    testigo.movimientoSuprimidoMm > 10 * PASO_DE_PUBLICACION_M * 1000,
    `sólo suprime ${testigo.movimientoSuprimidoMm.toFixed(2)} mm`,
  );
  // Y es MÁS CORTA que la meseta natural del día, que es lo que la esconde.
  assert.ok(
    testigo.congelacionMin < natural.minutos,
    `la congelación (${testigo.congelacionMin} min) no es más corta que la meseta natural ` +
      `(${natural.minutos} min): entonces el gate la vería y el ataque no es el que se describe`,
  );
});

/**
 * A-17 · **CORREGIDO, y el recorrido se queda como gate permanente** — clase A5 (límites 0/1/N).
 *
 * El gate A-1 de T-09 («la curva no se congela en ningún puerto del catálogo») preguntaba por la
 * meseta **más larga** del día y sólo medía dentro de ésa. Por construcción, cualquier congelación
 * más corta que la meseta natural del puerto le era invisible, por mucha marea que se tragara: la
 * meseta natural hacía de escondite.
 *
 * No era una conjetura sobre un caso raro. Con el catálogo de T-13, la mayoría del Mediterráneo
 * tiene mesetas naturales de decenas o cientos de minutos —son puertos cuya carrera del día es de
 * milímetros y la curva se publica al milímetro—, así que el escondite existía en más de un tercio
 * del catálogo.
 *
 * Medido el 2026-08-29 sobre los 153 puertos: **103 tienen meseta natural** y en **65** cabía una
 * congelación real invisible. El peor caso era el grupo de Valencia (Valencia, Alboraya, Silla y
 * Sueca): meseta natural de **200 min** que escondía una congelación de **190 min** con
 * **62,06 mm** de movimiento real suprimido — sesenta y dos veces el paso de publicación.
 *
 * CORREGIDO en `curva-congelada.ts`: el detector recorre **todas** las mesetas del día
 * (`tramosPlanos`) en vez de preguntar por la máxima. No se ha tocado el umbral —sigue siendo el
 * paso de publicación— ni se ha cambiado dónde se mide: lo que ha cambiado es **cuántas veces se
 * mide**, que era la pregunta mal hecha (su respuesta dependía del tamaño del catálogo).
 *
 * Lo que este gate vigila a partir de ahora: que a **ningún** puerto del catálogo se le pueda
 * esconder una congelación detrás de su meseta natural.
 *
 * **Y lo vigila del detector de verdad.** Este ataque llama a `congelacionesDeLaCurva`, el mismo
 * cuerpo que corre en el gate A-1 de `adversario-t09.test.ts`: `loQueVeElGateMm` no es una
 * reproducción de lo que el gate haría, es lo que el gate denuncia. La primera versión de este
 * fichero medía con una copia local del instrumento y por eso no trinqueteaba: estrechar el
 * detector real a una sola meseta dejaba a A-17 en verde, ciego a los 65 puertos que dice vigilar
 * (lo reprodujo el `verificador` sobre el commit e682097 y por eso lo rechazó).
 *
 * Comprobado con el defecto puesto otra vez, ahora sobre el módulo compartido
 * (`tramosPlanos` → `return [tramoPlanoMasLargo(dia)]`): **A-17 se pone en rojo con los 65 puertos**
 * y el gate A-1 sigue verde, que es exactamente el agujero que este ataque existe para tapar.
 */
test("A-17 · ninguna congelación real de la curva se le escapa al detector", async () => {
  const ataques = await ataquesDeCongelacion(fechaDeHoy());
  assert.ok(ataques.length > 0, "sin ningún fraude que construir este gate no mide nada");
  const invisibles = ataques.filter((ataque) => ataque.loQueVeElGateMm <= PASO_DE_PUBLICACION_M * 1000);
  assert.deepEqual(
    invisibles.map(
      (c) =>
        `${c.nombre}: congelación de ${c.congelacionMin} min invisible tras una meseta natural de ` +
        `${c.mesetaNaturalMin} min · suprime ${c.movimientoSuprimidoMm.toFixed(2)} mm reales y el ` +
        `gate sólo ve ${c.loQueVeElGateMm.toFixed(2)} mm`,
    ),
    [],
  );
});

// =================================================================================================
// A-18 · clase A12 (la promesa vs lo entregado) — la prueba de sensibilidad del gate dependía del día
// =================================================================================================

/**
 * A-18 · **CORREGIDO, y el recorrido se queda como gate permanente** — clase A12.
 *
 * `A-1 bis` es la pieza que sostiene todo el gate A-1: es el test que demuestra que **el gate sabe
 * fallar**, reconstruyendo la avería original (una pleamar congelada cinco horas en Vigo) y
 * exigiendo que se vea. Sin él, A-1 es una conjetura.
 *
 * Ese instrumento construía la meseta como ±150 min alrededor de **la primera pleamar del día**, y
 * después exigía que durase al menos cuatro horas. Cuando la primera pleamar de Vigo cae cerca de la
 * medianoche, la ventana se recorta contra el borde del día y la meseta no llega a las cuatro
 * horas: el test se ponía rojo **sin que nada estuviera averiado**.
 *
 * El sitio no tiene «hoy»: publica el día en que se construyó (`FECHA_DE_BUILD`), y CI construye
 * sin `BUILD_DATE`, así que el día que se mide es el día en que corre el pipeline. Medido sobre los
 * 365 días de 2026: **33 días (9,0 %)** daban una meseta de menos de cuatro horas — la peor,
 * **150 min** (2026-02-27, 2026-03-28, 2026-05-25, 2026-10-20, 2026-11-20 y 2026-12-20). Era el rojo
 * con el que me encontré al llegar a este worktree, con un `dist/` del 2026-03-29 (220 min).
 *
 * CORREGIDO **cambiando de ventana, no de umbral**: `pleamarConSitio` (en `adversario-t09.test.ts`)
 * elige la pleamar del día con más sitio a los dos lados en vez de la primera. La constante de las
 * cuatro horas no se ha tocado, que es exactamente lo que un gate frágil invita a hacer.
 *
 * Lo que este gate vigila a partir de ahora, con las dos mitades:
 *
 *   1. **Que el escenario se construya los 365 días del año**, incluidos los 33 en los que la
 *      primera pleamar no daba de sí. Se recorre el año entero, no un día de muestra: el calendario
 *      es justo la variable que rompía.
 *   2. **Que la elección de ventana siga siendo necesaria** — se comprueba que el instrumento viejo,
 *      la primera pleamar del día, seguiría fallando en algún día del año. Sin esta mitad, alguien
 *      podría volver a la primera pleamar y este gate se quedaría verde en 332 días de cada 365.
 */
test("A-18 · la prueba de sensibilidad del gate A-1 no depende del día en que corra CI", async () => {
  const SEMIANCHO_MIN = 150;
  const MINIMO_EXIGIDO_MIN = 4 * 60;
  const flojos: string[] = [];
  const flojosConLaPrimeraPleamar: string[] = [];
  const cursor = new Date(Date.UTC(2026, 0, 1));
  for (let indice = 0; indice < 365; indice += 1) {
    const fechaIso = cursor.toISOString().slice(0, 10);
    const dia = await diaDe("vigo", fechaIso);
    const margen = (instante: number): number =>
      Math.min(instante - dia.inicioUtcMs, dia.finUtcMs - instante);
    const pleamares = dia.extremos.filter((extremo) => extremo.kind === "high");
    // La misma elección que hace `pleamarConSitio`: la pleamar con más día a los dos lados.
    const conSitio = [...pleamares]
      .filter((extremo) => margen(extremo.timeUtcMs) >= SEMIANCHO_MIN * MINUTO)
      .sort((a, b) => margen(b.timeUtcMs) - margen(a.timeUtcMs))[0];
    const mesetaDe = (pleamar: { timeUtcMs: number }): number =>
      tramoPlanoMasLargo({
        muestras: congelar(dia.muestras, {
          desdeUtcMs: pleamar.timeUtcMs - SEMIANCHO_MIN * MINUTO,
          hastaUtcMs: pleamar.timeUtcMs + SEMIANCHO_MIN * MINUTO,
        }),
        inicioUtcMs: dia.inicioUtcMs,
        finUtcMs: dia.finUtcMs,
      }).minutos;

    if (conSitio === undefined) {
      flojos.push(`${fechaIso}: ninguna pleamar del día tiene ${SEMIANCHO_MIN} min a cada lado`);
    } else {
      const minutos = mesetaDe(conSitio);
      if (minutos < MINIMO_EXIGIDO_MIN) flojos.push(`${fechaIso}: la meseta inyectada dura ${minutos} min`);
    }

    const primera = pleamares[0];
    if (primera === undefined || mesetaDe(primera) < MINIMO_EXIGIDO_MIN) {
      flojosConLaPrimeraPleamar.push(fechaIso);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  assert.deepEqual(flojos, []);
  assert.ok(
    flojosConLaPrimeraPleamar.length > 0,
    "con la primera pleamar del día el escenario ya no falla ningún día del año: o el catálogo ha " +
      "cambiado, o elegir la ventana ha dejado de hacer falta y este gate ya no mide nada",
  );
});

// =================================================================================================
// A-19 · clase A6 (input hostil) — la cifra que justifica la estimación iba en formato inglés
// =================================================================================================

/** Todas las páginas HTML construidas bajo un directorio. */
function paginasHtml(directorio: string): readonly string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) return paginasHtml(ruta);
    return entrada.name.endsWith(".html") ? [ruta] : [];
  });
}

/** Lo que la página enseña de verdad: sin scripts y sin marcado, que es donde se lee una cifra. */
function textoVisible(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
}

/** Las versiones de licencia («CC BY 4.0», «AGPL-3.0»), que no son la medida de nada. */
const VERSIONES_DE_LICENCIA = /^(3|4)\.0$/;

/**
 * El único punto de millares que el sitio escribe de verdad: la distancia a la Luna, que sale de
 * `kilometros()` (`formato.ts`, el único formato del sitio con separador de millar) y se publica en
 * su propia fila del bloque de Luna, rotulada «Distancia» y con la unidad detrás.
 *
 * La excepción se ata al SITIO, no a la forma: son 153 ocurrencias, una por página de puerto, y
 * fuera de ahí un punto entre dígitos no es un millar sino una regresión. Ver el porqué, con los
 * 352 contraejemplos medidos, en la cabecera de A-19.
 */
const DISTANCIA_A_LA_LUNA = /(?<=Distancia\s+)\d{1,3}\.\d{3}(?=\s+km)/g;

/**
 * Una cifra española publicada que, escrita con el punto inglés, sería **indistinguible de un
 * millar** como string: la clase entera de medidas que la excepción por forma exoneraba.
 */
const CIFRA_CON_FORMA_DE_MILLAR = /(?<![\d.,])[1-9]\d{0,2},\d{3}(?![\d.,])/g;

/**
 * Las cifras que una página publica con el decimal en punto, leídas del texto visible.
 *
 * Es una función y no el cuerpo del test porque la prueba de sensibilidad de más abajo la llama con
 * una página falsificada a mano: un gate que nadie ha visto fallar es una conjetura.
 */
function cifrasConDecimalIngles(html: string): readonly string[] {
  const visible = textoVisible(html);
  const millares = new Set<number>();
  for (const millar of visible.matchAll(DISTANCIA_A_LA_LUNA)) millares.add(millar.index);
  const ofensas: string[] = [];
  for (const encontrado of visible.matchAll(/\d+\.\d+/g)) {
    if (VERSIONES_DE_LICENCIA.test(encontrado[0]) || millares.has(encontrado.index)) continue;
    ofensas.push(encontrado[0]);
  }
  return ofensas;
}

/**
 * A-19 · **CORREGIDO, y el recorrido se queda como gate permanente** — clase A6.
 *
 * La frase que T-13 existe para publicar —«las constantes armónicas son las del mareógrafo `X`, a
 * 24.8 km de la dársena»— la escribía el pipeline con `f"{km:.1f}"`, que es formato inglés, y la
 * página la pintaba **tal cual**. En la misma página, todo lo demás va en español: «0,18 m»,
 * «39,442° N», «3,05 m». Lo mismo le pasaba al motivo del grade: «RMSE normalizado 0.221 > 0.15».
 *
 * No es cosmética menor: es la cifra sobre la que descansa la promesa de la trayectoria, y un
 * lector español lee «24.8» como veinticuatro mil ochocientos si el resto de la página le ha
 * enseñado que el punto separa millares — que es justo lo que hace dos líneas más abajo, donde la
 * distancia a la Luna se publica como «381.367 km».
 *
 * Medido en el `dist/` del 2026-08-29: **130 de las 153 páginas** de puerto, **283 ocurrencias**.
 *
 * CORREGIDO **donde el número se convierte en texto** —`_cifra()` en
 * `data/pipeline/mareia_pipeline/grade.py`— y no con un reemplazo en la plantilla, que sobre una
 * frase ya escrita sería tocar prosa a ciegas. Las 170 frases del dataset ya committeado se
 * migraron re-derivándolas con el `grade.py` parcheado y comprobando que cada una reproducía la
 * committeada carácter a carácter salvo el separador.
 *
 * Lo que este gate vigila a partir de ahora: **ninguna página publica un decimal con punto**, y lo
 * mira en el **HTML publicado**, no en la función que lo genera — el sujeto es el artefacto que lee
 * la gente. Del recuento se excluyen las versiones de licencia, que no son medidas, y el separador
 * de millares español.
 *
 * **Y la excepción de los millares es CONTEXTUAL, no de forma** (ride-along del rechazo de A-17: la
 * misma lección, un instrumento que funciona por la forma del dato y no por su significado se rompe
 * cuando el catálogo cambia). Escrita por la forma —`^[1-9]\d{0,2}\.\d{3}$`— exoneraba a
 * cualquier cifra que se pareciese a un millar, y por la forma un millar y una medida **son el
 * mismo string**. Medido en el `dist/` del 2026-08-29: el sitio publica **352 cifras españolas**
 * que, si volvieran al formato inglés, la excepción por forma habría dado por buenas — 279
 * coordenadas («36,745° N» → «36.745»), 72 alturas en metros («nivel medio 1,945 m») y el RMSE
 * normalizado de Tarragona, **2,902**, que es exactamente la cifra sobre la que descansa la promesa
 * de la trayectoria. Millares de verdad no hay más que uno, la distancia a la Luna, y sólo lo
 * escribe `kilometros()` de `formato.ts` en su propia fila rotulada: **153 ocurrencias, una por
 * página de puerto, todas «Distancia N km»**.
 *
 * Así que la excepción se ata al sitio y no a la forma (`DISTANCIA_A_LA_LUNA`). El tradeoff, dicho:
 * si mañana se renombra ese rótulo, el gate enrojece sin que haya avería. Se acepta a propósito —un
 * rojo que obliga a releer cuesta menos que una excepción que exonera medidas—, y el sensibilidad
 * de abajo comprueba que la excepción sigue sin tragarse ninguna.
 */
test("A-19 · ninguna página publica una cifra con el decimal en formato inglés", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const ofensas: string[] = [];
  for (const pagina of paginasHtml(DIST)) {
    for (const cifra of cifrasConDecimalIngles(readFileSync(pagina, "utf8"))) {
      ofensas.push(`${pagina.slice(DIST.length + 1)}: «${cifra}»`);
    }
  }
  assert.deepEqual(ofensas, []);
});

/**
 * A-19 sensibilidad · **que la excepción de millares no exonere una medida**, que es la única forma
 * de que este gate se pierda una regresión sin decir nada.
 *
 * El escenario no se inventa: se coge cada cifra española que el sitio publica **hoy** y que tiene
 * la forma de un millar —«2,902» del RMSE de Tarragona, «1,945 m» de un nivel medio, «36,745° N» de
 * una coordenada—, se le devuelve el punto que A-19 vino a quitar y se exige que el detector la
 * denuncie. Con la excepción por forma, las 352 pasaban en verde.
 *
 * La premisa (que haya alguna cifra así que atacar) va en la misma aserción a propósito: el día que
 * el catálogo no publique ninguna, este test dejaría de medir en silencio, y eso hay que verlo.
 */
test("A-19 sensibilidad · una medida en formato inglés no se salva por parecerse a un millar", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const candidatas: string[] = [];
  const exoneradas: string[] = [];
  for (const pagina of paginasHtml(DIST)) {
    const html = readFileSync(pagina, "utf8");
    const visible = textoVisible(html);
    for (const medida of new Set([...visible.matchAll(CIFRA_CON_FORMA_DE_MILLAR)].map((m) => m[0]))) {
      const enIngles = medida.replace(",", ".");
      candidatas.push(enIngles);
      if (!cifrasConDecimalIngles(html.replaceAll(medida, enIngles)).includes(enIngles)) {
        exoneradas.push(`${pagina.slice(DIST.length + 1)}: «${medida}» → «${enIngles}»`);
      }
    }
  }
  assert.ok(
    candidatas.length > 0,
    "ninguna cifra publicada tiene ya la forma de un millar: o el catálogo ha cambiado, o esta " +
      "prueba de sensibilidad ha dejado de medir nada",
  );
  assert.deepEqual(exoneradas, []);
});

// =================================================================================================
// A-20 · clase A12 — la procedencia del error medido sigue siendo autodeclarada
// =================================================================================================

/**
 * A-20 · **HALLAZGO ABIERTO** — clase A12 (la promesa vs lo entregado).
 *
 * El fraude que T-05 cometió y T-13 vino a cerrar era publicar el RMSE de Cartagena como si fuera
 * el de Cabo de Palos. El invariante que lo cierra —«ningún puerto publica una precisión que no
 * tiene», `packages/adapters/src/__tests__/dataset.test.ts`— **recomputa** la distancia al
 * mareógrafo en vez de creerse la declarada, con este motivo escrito al lado: «si sólo se
 * comprobara el número declarado, para colar un RMSE ajeno bastaría con escribir al lado una
 * distancia pequeña».
 *
 * Pero la recomputación usa las coordenadas del mareógrafo **que escribe el mismo productor del
 * RMSE**, y no las contrasta con nada. El fraude no ha desaparecido: ha subido un nivel. Ahora hace
 * falta escribir una distancia pequeña **y** un par de coordenadas, que son otras cuatro cifras del
 * mismo fichero.
 *
 * Y el artefacto publicado tiene con qué desmentirlo sin salir a la red: el propio dataset dice que
 * el mareógrafo `carg1` está en 37,570 N −0,980 E, porque lo publica Cartagena. Un Cabo de Palos
 * que declare `carg1` a 700 m de su dársena se está contradiciendo con otro fichero del mismo
 * dataset, y nadie lo mira.
 *
 * Reproducción: se construye ese fichero falsificado en memoria —el RMSE real de Cartagena
 * (0,0506 m) publicado por Cabo de Palos bajo el código `carg1`, con las coordenadas reescritas a
 * 0,709 km de la dársena— y se le pasa el invariante tal y como está escrito hoy. Pasa en verde,
 * con el mareógrafo declarado a **26,6 km** de donde el propio dataset dice que está.
 *
 * Comportamiento correcto que afirma el test: **el invariante rechaza el fichero falsificado**.
 *
 * ESCALADO al rol `seguridad` como integridad de procedencia del dato publicado (no es A7: no hay
 * frontera de autorización, el portal es estático y anónimo).
 */
hallazgoAbierto("A-20 · un puerto no puede publicar el error de otro reescribiendo las coordenadas del mareógrafo", async () => {
  const RADIO_DE_LA_DARSENA_KM = 5;
  const leerEstacion = (fichero: string): Record<string, unknown> =>
    JSON.parse(readFileSync(join(DATA_DIR, "stations", fichero), "utf8")) as Record<string, unknown>;

  const distanciaKm = (latA: number, lonA: number, latB: number, lonB: number): number => {
    const RADIO_TIERRA_KM = 6371.0088;
    const rad = (grados: number): number => (grados * Math.PI) / 180;
    const dLat = rad(latB - latA);
    const dLon = rad(lonB - lonA);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(latA)) * Math.cos(rad(latB)) * Math.sin(dLon / 2) ** 2;
    return 2 * RADIO_TIERRA_KM * Math.asin(Math.sqrt(a));
  };

  const puerto = (await deps.ports.list()).find((candidato) => candidato.slug === "cabo-de-palos");
  assert.ok(puerto, "Cabo de Palos tiene que seguir en el catálogo: es el puerto del fraude de T-05");
  const cartagena = leerEstacion("es-mu-cartagena.json") as {
    quality: { rmse_m: number; metrics: Record<string, unknown> };
  };
  const original = leerEstacion("es-mu-cabo-de-palos.json") as {
    quality: { rmse_m: number | null; metrics: Record<string, unknown> };
  };

  // La falsificación: coordenadas del mareógrafo reescritas a la dársena de Cabo de Palos.
  const latFalsa = puerto.lat + 0.005;
  const lonFalsa = puerto.lon + 0.005;
  const declarada = Number(distanciaKm(puerto.lat, puerto.lon, latFalsa, lonFalsa).toFixed(3));
  const metrics = {
    ...original.quality.metrics,
    rmse_m: cartagena.quality.rmse_m,
    observation_source: cartagena.quality.metrics["observation_source"],
    observation_code: cartagena.quality.metrics["observation_code"],
    observation_lat: latFalsa,
    observation_lon: lonFalsa,
    observation_distance_km: declarada,
  };
  const rmseFalsificado = cartagena.quality.rmse_m;

  // El invariante de `dataset.test.ts`, tal y como está escrito hoy, sobre el fichero falsificado.
  const incoherencias: string[] = [];
  const distancia = metrics["observation_distance_km"];
  if (typeof distancia !== "number") {
    incoherencias.push("publica RMSE sin decir a qué distancia se midió");
  } else if (distancia > RADIO_DE_LA_DARSENA_KM) {
    incoherencias.push(`publica como suyo un error medido a ${distancia} km de su dársena`);
  } else {
    const lat = metrics["observation_lat"];
    const lon = metrics["observation_lon"];
    if (typeof lat !== "number" || typeof lon !== "number") {
      incoherencias.push("declara una distancia de medida sin decir desde dónde");
    } else if (Math.abs(distanciaKm(puerto.lat, puerto.lon, lat, lon) - distancia) > 0.01) {
      incoherencias.push("dice haber medido a una distancia que sus coordenadas no dan");
    }
  }
  if (metrics["observation_source"] === null) incoherencias.push("publica RMSE sin decir contra qué se midió");

  // La premisa: el RMSE colado es de verdad ajeno y de verdad lejano, según el propio dataset.
  assert.equal(rmseFalsificado, 0.0506, "el RMSE de Cartagena ha cambiado: relee el hallazgo");
  const dondeEstaDeVerdad = distanciaKm(
    latFalsa,
    lonFalsa,
    cartagena.quality.metrics["observation_lat"] as number,
    cartagena.quality.metrics["observation_lon"] as number,
  );
  assert.ok(
    dondeEstaDeVerdad > 20,
    `el mareógrafo declarado y el real están a ${dondeEstaDeVerdad.toFixed(1)} km: si se acercan, ` +
      "el ejemplo ha dejado de serlo",
  );

  assert.notDeepEqual(
    incoherencias,
    [],
    `el invariante acepta un RMSE de ${rmseFalsificado} m medido con el mareógrafo ` +
      `${String(metrics["observation_code"])}, que el propio dataset sitúa a ` +
      `${dondeEstaDeVerdad.toFixed(1)} km de las coordenadas declaradas aquí`,
  );
});
