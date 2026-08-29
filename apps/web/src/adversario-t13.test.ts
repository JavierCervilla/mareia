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

import { heightAt, prepareStation } from "@mareia/domain-core";

import { deps } from "./datos/deps.ts";
import { cargarDatosDePuerto } from "./datos/pagina-puerto.ts";
import { alturaEn, trazarCurvaMarea } from "./grafico-marea.ts";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PAGINA_SANTANDER = join(DIST, "mareas", "cantabria", "cantabria", "santander", "index.html");
const HAY_BUILD = existsSync(PAGINA_SANTANDER);
const SIN_BUILD = "no hay apps/web/dist: corre antes `pnpm --filter web build`";
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "data");

const MINUTO = 60_000;

/**
 * Paso de publicación de las alturas, en metros. `toHeight` redondea a 3 decimales: dos muestras
 * que difieran menos que esto se publican iguales y ninguna curva puede enseñar un movimiento más
 * pequeño. Es el mismo umbral que usa el gate A-1 de T-09, y se copia aquí a propósito —no se
 * importa— porque el sentido de este fichero es medir **desde fuera** lo que aquel gate mide desde
 * dentro.
 */
const PASO_DE_PUBLICACION_M = 0.001;

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

interface Tramo {
  readonly minutos: number;
  readonly desdeUtcMs: number;
  readonly hastaUtcMs: number;
}

/** El día que publica el `dist/`, leído del propio HTML; sin build, el día UTC del reloj. */
function fechaDeHoy(): string {
  if (!HAY_BUILD) return new Date().toISOString().slice(0, 10);
  const fecha = /<time datetime="(\d{4}-\d{2}-\d{2})"/.exec(readFileSync(PAGINA_SANTANDER, "utf8"))?.[1];
  assert.ok(fecha, "la página construida no declara la fecha de sus datos");
  return fecha;
}

/**
 * El tramo **más largo** del día en el que la curva publicada no se mueve nada.
 *
 * Copia literal del instrumento que usa el gate A-1 (`adversario-t09.test.ts`). Está aquí para
 * poder atacarlo, no para reemplazarlo: si allí cambia, este fichero se pone en rojo y hay que
 * releerlo, que es exactamente lo que se quiere de un ataque congelado en la suite.
 */
function tramoPlanoMasLargo(muestras: readonly Muestra[], inicioUtcMs: number, finUtcMs: number): Tramo {
  let mejor: Tramo = { minutos: 0, desdeUtcMs: inicioUtcMs, hastaUtcMs: inicioUtcMs };
  let inicio = inicioUtcMs;
  for (let instante = inicioUtcMs + MINUTO; instante <= finUtcMs; instante += MINUTO) {
    if (Math.abs(alturaEn(muestras, instante) - alturaEn(muestras, instante - MINUTO)) > 1e-9) {
      inicio = instante;
      continue;
    }
    if (instante - inicio > mejor.minutos * MINUTO) {
      mejor = { minutos: (instante - inicio) / MINUTO, desdeUtcMs: inicio, hastaUtcMs: instante };
    }
  }
  return mejor;
}

/** Cuánto se movió la marea de verdad en los instantes de muestreo que caen dentro del tramo. */
function excursionRealEnElTramo(
  muestras: readonly Muestra[],
  estacion: ReturnType<typeof prepareStation>,
  tramo: { readonly desdeUtcMs: number; readonly hastaUtcMs: number },
): number {
  const alturas = muestras
    .filter((m) => m.timeUtcMs >= tramo.desdeUtcMs && m.timeUtcMs <= tramo.hastaUtcMs)
    .map((m) => heightAt(estacion, m.timeUtcMs));
  return alturas.length === 0 ? 0 : Math.max(...alturas) - Math.min(...alturas);
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
    const movimientoM = excursionRealEnElTramo(muestras, estacion, tramo);
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

interface Ceguera {
  readonly slug: string;
  readonly nombre: string;
  readonly mesetaNaturalMin: number;
  readonly congelacionMin: number;
  readonly movimientoSuprimidoMm: number;
}

/**
 * Recorre el catálogo inyectando en cada puerto la congelación más dañina que sigue siendo más
 * corta que su meseta natural, y devuelve aquellos en los que el gate A-1 **no la ve**.
 */
async function puertosConCongelacionInvisible(fechaIso: string): Promise<readonly Ceguera[]> {
  const ciegos: Ceguera[] = [];
  for (const puerto of await deps.ports.list()) {
    const dia = await diaDe(puerto.slug, fechaIso);
    const natural = tramoPlanoMasLargo(dia.muestras, dia.inicioUtcMs, dia.finUtcMs);
    if (natural.minutos === 0) continue;
    const primera = dia.muestras[0]?.timeUtcMs ?? 0;
    const segunda = dia.muestras[1]?.timeUtcMs ?? 0;
    const pasoMin = (segunda - primera) / MINUTO;
    const duracionMin = natural.minutos - pasoMin;
    if (duracionMin < pasoMin) continue;

    const fraude = congelacionMasDanina(dia.muestras, dia.estacion, duracionMin);
    if (fraude === undefined || fraude.movimientoM <= PASO_DE_PUBLICACION_M) continue;

    const congelada = congelar(dia.muestras, fraude);
    const vista = tramoPlanoMasLargo(congelada, dia.inicioUtcMs, dia.finUtcMs);
    const loQueVeElGate = excursionRealEnElTramo(congelada, dia.estacion, vista);
    if (loQueVeElGate <= PASO_DE_PUBLICACION_M) {
      ciegos.push({
        slug: puerto.slug,
        nombre: puerto.name,
        mesetaNaturalMin: natural.minutos,
        congelacionMin: duracionMin,
        movimientoSuprimidoMm: fraude.movimientoM * 1000,
      });
    }
  }
  return ciegos.sort((a, b) => b.movimientoSuprimidoMm - a.movimientoSuprimidoMm);
}

// =================================================================================================
// A-17 · clase A5 (límites 0/1/N) — el gate de curva congelada sólo mira UNA meseta por día
// =================================================================================================

/**
 * **La premisa del ataque, y va en verde a propósito.**
 *
 * Antes de acusar al gate de no ver un fraude hay que demostrar que el fraude **existe en el
 * artefacto**: que la curva falsificada se dibuja de verdad plana en el SVG que la página publica,
 * y no es un espejismo de la aritmética. Este test lo comprueba sobre el `<path>` que sale de
 * `trazarCurvaMarea`, que es literalmente el que va al HTML, y sobre el `dist/` construido.
 *
 * Si algún día esta premisa deja de cumplirse, el hallazgo de abajo hay que releerlo entero: su
 * trinquete se conforma con que el cuerpo falle, y no distingue «el gate está ciego» de «el ataque
 * ya no construye un fraude».
 */
test("A-17 premisa · la congelación inyectada se dibuja plana en la curva publicada", async () => {
  const fechaIso = fechaDeHoy();
  const ciegos = await puertosConCongelacionInvisible(fechaIso);
  assert.ok(ciegos.length > 0, "sin ningún puerto ciego no hay nada que reproducir: relee el hallazgo");

  const testigo = ciegos[0];
  assert.ok(testigo);
  const dia = await diaDe(testigo.slug, fechaIso);
  const natural = tramoPlanoMasLargo(dia.muestras, dia.inicioUtcMs, dia.finUtcMs);
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
 * A-17 · **HALLAZGO ABIERTO** — clase A5 (límites 0/1/N).
 *
 * El gate A-1 de T-09 («la curva no se congela en ningún puerto del catálogo») pregunta por la
 * meseta **más larga** del día y sólo mide dentro de ésa. Por construcción, cualquier congelación
 * más corta que la meseta natural del puerto le es invisible, por mucha marea que se trague: la
 * meseta natural actúa de escondite.
 *
 * No es una conjetura sobre un caso raro. Con el catálogo de T-13, la mayoría del Mediterráneo
 * tiene mesetas naturales de decenas o cientos de minutos —son puertos cuya carrera del día es de
 * milímetros y la curva se publica al milímetro—, así que el escondite existe en más de un tercio
 * del catálogo.
 *
 * Medido el 2026-08-29 sobre los 153 puertos: **103 tienen meseta natural** y en **65** cabe una
 * congelación real invisible. El peor caso es el grupo de Valencia (Valencia, Alboraya, Silla y
 * Sueca): meseta natural de **200 min** que esconde una congelación de **190 min** con
 * **62,06 mm** de movimiento real suprimido — sesenta y dos veces el paso de publicación.
 *
 * Comportamiento correcto que afirma el test: **ningún puerto admite una congelación invisible**.
 * Cuando el detector deje de mirar sólo la meseta más larga, esto pasará a verde solo.
 */
hallazgoAbierto("A-17 · ninguna congelación real de la curva se le escapa al detector", async () => {
  const ciegos = await puertosConCongelacionInvisible(fechaDeHoy());
  assert.deepEqual(
    ciegos.map(
      (c) =>
        `${c.nombre}: congelación de ${c.congelacionMin} min invisible tras una meseta natural de ` +
        `${c.mesetaNaturalMin} min · suprime ${c.movimientoSuprimidoMm.toFixed(2)} mm reales`,
    ),
    [],
  );
});

// =================================================================================================
// A-18 · clase A12 (la promesa vs lo entregado) — la prueba de sensibilidad del gate depende del día
// =================================================================================================

/**
 * A-18 · **HALLAZGO ABIERTO** — clase A12.
 *
 * `A-1 bis` es la pieza que sostiene todo el gate A-1: es el test que demuestra que **el gate sabe
 * fallar**, reconstruyendo la avería original (una pleamar congelada cinco horas en Vigo) y
 * exigiendo que se vea. Sin él, A-1 es una conjetura.
 *
 * Ese instrumento construye la meseta como ±150 min alrededor de **la primera pleamar del día**, y
 * después exige que dure al menos cuatro horas. Cuando la primera pleamar de Vigo cae cerca de la
 * medianoche, la ventana se recorta contra el borde del día y la meseta no llega a las cuatro
 * horas: el test se pone rojo **sin que nada esté averiado**.
 *
 * El sitio no tiene «hoy»: publica el día en que se construyó (`FECHA_DE_BUILD`), y CI construye
 * sin `BUILD_DATE`, así que el día que se mide es el día en que corre el pipeline. Medido sobre los
 * 365 días de 2026: **33 días (9,0 %)** dan una meseta de menos de cuatro horas — la peor,
 * **150 min** (2026-02-27, 2026-03-28, 2026-05-25, 2026-10-20, 2026-11-20 y 2026-12-20). Es el rojo
 * con el que me encontré al llegar a este worktree, con un `dist/` del 2026-03-29 (220 min).
 *
 * Un gate que se pone rojo por el calendario invita exactamente a lo que este repositorio prohíbe:
 * bajar la constante hasta que el día malo pase. Comportamiento correcto que afirma el test: **el
 * instrumento de sensibilidad construye una meseta suficiente todos los días del año**.
 */
hallazgoAbierto("A-18 · la prueba de sensibilidad del gate A-1 no depende del día en que corra CI", async () => {
  const SEMIANCHO_MIN = 150;
  const MINIMO_EXIGIDO_MIN = 4 * 60;
  const flojos: string[] = [];
  const cursor = new Date(Date.UTC(2026, 0, 1));
  for (let indice = 0; indice < 365; indice += 1) {
    const fechaIso = cursor.toISOString().slice(0, 10);
    const dia = await diaDe("vigo", fechaIso);
    const pleamar = dia.extremos.find((extremo) => extremo.kind === "high");
    if (pleamar === undefined) {
      flojos.push(`${fechaIso}: el día no trae ninguna pleamar`);
    } else {
      const congelada = congelar(dia.muestras, {
        desdeUtcMs: pleamar.timeUtcMs - SEMIANCHO_MIN * MINUTO,
        hastaUtcMs: pleamar.timeUtcMs + SEMIANCHO_MIN * MINUTO,
      });
      const meseta = tramoPlanoMasLargo(congelada, dia.inicioUtcMs, dia.finUtcMs);
      if (meseta.minutos < MINIMO_EXIGIDO_MIN) {
        flojos.push(`${fechaIso}: la meseta inyectada dura ${meseta.minutos} min`);
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  assert.deepEqual(flojos, []);
});

// =================================================================================================
// A-19 · clase A6 (input hostil) — la cifra que justifica la estimación va en formato inglés
// =================================================================================================

/**
 * A-19 · **HALLAZGO ABIERTO** — clase A6.
 *
 * La frase que T-13 existe para publicar —«las constantes armónicas son las del mareógrafo `X`, a
 * 24.8 km de la dársena»— la escribe el pipeline con `f"{km:.1f}"`, que es formato inglés, y la
 * página la pinta **tal cual**. En la misma página, todo lo demás va en español: «0,18 m»,
 * «39,442° N», «3,05 m». Lo mismo le pasa al motivo del grade: «RMSE normalizado 0.221 > 0.15».
 *
 * No es cosmética menor: es la cifra sobre la que descansa la promesa de la trayectoria, y un
 * lector español lee «24.8» como veinticuatro mil ochocientos si el resto de la página le ha
 * enseñado que el punto separa millares — que es justo lo que hace dos líneas más abajo, donde la
 * distancia a la Luna se publica como «381.367 km».
 *
 * Medido en el `dist/` del 2026-08-29: **130 de las 153 páginas** de puerto, **283 ocurrencias**.
 *
 * Comportamiento correcto que afirma el test: **ninguna página publica un decimal con punto**. Se
 * excluye del recuento el separador de millares español (punto seguido de exactamente tres cifras)
 * y las versiones de licencia, que no son medidas.
 */
hallazgoAbierto("A-19 · ninguna página publica una cifra con el decimal en formato inglés", async () => {
  if (!HAY_BUILD) throw new SinBuild(SIN_BUILD);

  const paginas = (function recorrer(directorio: string): readonly string[] {
    return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
      const ruta = join(directorio, entrada.name);
      if (entrada.isDirectory()) return recorrer(ruta);
      return entrada.name.endsWith(".html") ? [ruta] : [];
    });
  })(DIST);

  const VERSIONES_DE_LICENCIA = /^(3|4)\.0$/;
  const SEPARADOR_DE_MILLARES = /^\d{1,3}\.\d{3}$/;
  const ofensas: string[] = [];
  for (const pagina of paginas) {
    const visible = readFileSync(pagina, "utf8")
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<[^>]+>/g, " ");
    for (const encontrado of visible.matchAll(/\d+\.\d+/g)) {
      const cifra = encontrado[0];
      if (VERSIONES_DE_LICENCIA.test(cifra) || SEPARADOR_DE_MILLARES.test(cifra)) continue;
      ofensas.push(`${pagina.slice(DIST.length + 1)}: «${cifra}»`);
    }
  }
  assert.deepEqual(ofensas, []);
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
