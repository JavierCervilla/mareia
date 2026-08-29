/**
 * PASE ADVERSARIO · T-09 (rol `qa-adversario`, skill `qa-adversarial`).
 *
 * Función objetivo INVERTIDA: estos tests NO confirman que la página funciona — el `verificador` y
 * el rol `qa` ya lo hicieron. Aquí se ataca la PROMESA de la trayectoria:
 *
 *   1. La página de un puerto renderiza en HTML estático los datos que calculan los casos de uso.
 *   2. Cero JavaScript de cliente en el HTML construido.
 *   3. La curva SVG pasa por los extremos del día, cubre el día entero y está acotada — para
 *      CUALQUIER puerto del catálogo, no solo para el que se miró al desarrollar.
 *   4. El tema noche funciona vía `prefers-color-scheme` y `data-theme` sin romper contraste.
 *   5. La página es accesible en lo que promete (tabla real, landmarks, listas con rol).
 *
 * Informe del pase de la tranche 1 (hallazgos A-1…A-7, clases atacadas y no reproducidos):
 * `docs/qa/informe-adversario-t09-tranche1.md`.
 *
 * TRINQUETE — los siete hallazgos (A-1…A-7) están corregidos y sus recorridos **se quedan como gate
 * permanente**: un recorrido adversario arreglado no se borra, se queda vigilando. Lo que sí ha
 * cambiado con esta trayectoria es el sujeto: la página de fixture (`/puerto/santander`) ya no
 * existe, y en su lugar hay 12 páginas reales bajo `/mareas/<región>/<provincia>/<puerto>/`
 * calculadas con los casos de uso. Cada gate se ha **re-apuntado**, no relajado; donde el
 * mecanismo del fallo desapareció con el fixture (la interpolación coseno de A-1, el orden de los
 * extremos de A-2) el gate ataca el mecanismo NUEVO que ocupa su sitio, y donde no cambió nada
 * (A-4…A-7) el cuerpo del test es el mismo.
 *
 * Los tests contra `dist/` exigen haber construido antes (`pnpm --filter web build`, que es
 * justo lo que hace CI antes de `pnpm test`); sin build se saltan en vez de dar un rojo falso.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { heightAt, prepareStation } from "@mareia/domain-core";

import { activeModules } from "./modules.config.ts";
import { scriptsDeCoreEn } from "./scripts-de-core.ts";
import { cargarPuertos } from "./datos/catalogo.ts";
import { cargarDatosDePuerto } from "./datos/pagina-puerto.ts";
import { deps } from "./datos/deps.ts";
import { escaparMarcado } from "./escapar-marcado.ts";
import { alturaEn, trazarCurvaMarea } from "./grafico-marea.ts";
import { rutaPuerto } from "./rutas.ts";
import type { EntradaCurva } from "./grafico-marea.ts";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PAGINA_PUERTO = join(DIST, "mareas", "cantabria", "cantabria", "santander", "index.html");
const HAY_BUILD = existsSync(PAGINA_PUERTO);
const SIN_BUILD = "no hay apps/web/dist: corre antes `pnpm --filter web build`";

const MINUTO = 60_000;

function leerPagina(): string {
  return readFileSync(PAGINA_PUERTO, "utf8");
}

/** Todas las páginas construidas del sitio. */
function paginasConstruidas(directorio: string = DIST): readonly string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) return paginasConstruidas(ruta);
    return entrada.name.endsWith(".html") ? [ruta] : [];
  });
}

function leerCssConstruido(): string {
  const carpeta = join(DIST, "_astro");
  const hoja = readdirSync(carpeta).find((fichero) => fichero.endsWith(".css"));
  assert.ok(hoja, "no encuentro la hoja de estilos construida en dist/_astro");
  return readFileSync(join(carpeta, hoja), "utf8");
}

/**
 * El día que publica el `dist/`, leído del propio HTML.
 *
 * No se recalcula con `FECHA_DE_BUILD`: sin `BUILD_DATE` el build usa el día UTC del reloj, y un
 * build a las 23:59 con los tests a las 00:01 compararía dos días distintos. La página dice qué día
 * publica; se le cree a ella.
 */
function fechaDelBuild(): string {
  const fecha = /<time datetime="(\d{4}-\d{2}-\d{2})"/.exec(leerPagina())?.[1];
  assert.ok(fecha, "la página construida no declara la fecha de sus datos");
  return fecha;
}

/** La curva y los extremos de un puerto, tal y como los pinta la página. */
async function curvaDe(slug: string, fechaIso: string): Promise<EntradaCurva> {
  const { dia } = await cargarDatosDePuerto(slug, fechaIso);
  return {
    muestras: dia.muestras.map((muestra) => ({
      timeUtcMs: muestra.timeUtcMs,
      height_m: muestra.height_m,
    })),
    extremos: dia.eventos.map((evento) => ({
      timeUtcMs: evento.timeUtcMs,
      height_m: evento.height_m,
      kind: evento.kind,
    })),
    inicioUtcMs: dia.inicioUtcMs,
    finUtcMs: dia.finUtcMs,
  };
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

/** Distancia vertical de un punto a la polilínea que se dibuja de verdad en el SVG. */
function distanciaAlTrazo(punto: Punto, trazo: readonly Punto[]): number {
  let mejor = Number.POSITIVE_INFINITY;
  for (let indice = 0; indice + 1 < trazo.length; indice += 1) {
    const desde = trazo[indice];
    const hasta = trazo[indice + 1];
    if (!desde || !hasta) continue;
    if (punto.x < Math.min(desde.x, hasta.x) || punto.x > Math.max(desde.x, hasta.x)) continue;
    const tramo = hasta.x - desde.x;
    const fraccion = tramo === 0 ? 0 : (punto.x - desde.x) / tramo;
    mejor = Math.min(mejor, Math.abs(desde.y + fraccion * (hasta.y - desde.y) - punto.y));
  }
  return mejor;
}

/** El tramo más largo del día en el que la curva **publicada** no se mueve nada. */
function tramoPlanoMasLargo(dia: EntradaCurva): {
  minutos: number;
  desdeUtcMs: number;
  hastaUtcMs: number;
} {
  let mejor = { minutos: 0, desdeUtcMs: dia.inicioUtcMs, hastaUtcMs: dia.inicioUtcMs };
  let inicio = dia.inicioUtcMs;
  for (let instante = dia.inicioUtcMs + MINUTO; instante <= dia.finUtcMs; instante += MINUTO) {
    const anterior = alturaEn(dia.muestras, instante - MINUTO);
    if (Math.abs(alturaEn(dia.muestras, instante) - anterior) > 1e-9) {
      inicio = instante;
      continue;
    }
    if (instante - inicio > mejor.minutos * MINUTO) {
      mejor = { minutos: (instante - inicio) / MINUTO, desdeUtcMs: inicio, hastaUtcMs: instante };
    }
  }
  return mejor;
}

// =================================================================================================
// HALLAZGOS REPRODUCIDOS Y CORREGIDOS · sin trinquete, en verde, como gate permanente
// =================================================================================================

/**
 * A-1 · clase A5 (límites 0/1/N) — En un día de TRES extremos la curva se congelaba hasta ~5 h.
 *
 * La causa original era la reconstrucción: con solo cuatro horas y cuatro alturas, la curva se
 * interpolaba con una media coseno y unos extremos virtuales reflejados que en los días de tres
 * extremos —~1 de cada 7— se quedaban cortos y dibujaban una pleamar de cinco horas. El dato no era
 * «menos preciso», era falso, y nada en la página avisaba.
 *
 * CORREGIDO Y SUPERADO: la página ya no reconstruye nada. Dibuja la curva **predicha** por el motor
 * armónico (`sampleCurve`, 145 puntos del día) con los extremos insertados.
 *
 * **Re-apuntado en T-13, y sin ningún número elegido.** Al escalar a 153 puertos, la versión
 * anterior de este gate —«ninguna meseta de más de una hora»— se puso en rojo en 17 puertos y
 * ninguno era la avería: son puertos cuya carrera del día es de milímetros a centímetros, y la
 * curva se publica al **milímetro** (`toHeight`, 3 decimales), así que muestras contiguas empatan
 * en el último dígito. El primer intento de arreglo cambió una constante por otras dos igual de
 * arbitrarias, y las dos estaban mal: el corte de carrera dejaba fuera mesetas de 80 min con
 * 0,178 m de carrera, y el tope del 60 % del día dejaba pasar una congelación real de catorce
 * horas.
 *
 * Lo que se comprueba ahora no es cuánto dura la meseta, sino **si la marea se movió durante ella**
 * más de lo que la publicación puede enseñar. El umbral no se elige: **es el paso de publicación**.
 *
 * **Y se mide dentro del tramo, no en sus puntas.** El segundo intento preguntaba la altura real en
 * los dos extremos de la meseta, y eso es exactamente la magnitud que la avería original pone a
 * cero: una meseta **centrada en un extremo** —«dibujaba una pleamar de cinco horas», que es lo que
 * le dio nombre a A-1— tiene los dos bordes a la misma altura pase lo que pase en medio. Medido
 * sobre los 153 puertos congelando la curva a propósito, aquel instrumento dejaba pasar en verde
 * mesetas de **670 min en Gijón** (0,49 mm en los bordes, 3 283,7 mm de movimiento real dentro) y
 * de 610 min en Vigo y en Huelva, y las admitía en **133 de los 153 puertos**: para el caso que le
 * da nombre al hallazgo era más débil que la regla de una hora que sustituía.
 *
 * La sonda mira ahora **los instantes de muestreo publicados que caen dentro del tramo**, que son
 * los que la página de verdad podría haber dibujado distintos y no dibujó. No se mira la curva
 * continua minuto a minuto a propósito: entre dos muestras separadas diez minutos la marea puede
 * abombarse sobre un extremo hasta 2,4 mm y eso **no es representable** en el artefacto, así que
 * exigirlo sería pedirle a la publicación una resolución que no tiene.
 *
 * Medido sobre 153 puertos × 15 días (2 295 días-puerto, **9 941 mesetas**): la excursión real
 * máxima en los instantes de muestreo de una meseta legítima es de **0,995 mm**, justo por debajo
 * del milímetro que el redondeo permite. La meseta más larga son 380 min, en Calvià, con 6 mm de
 * carrera en todo el día.
 */

/**
 * Paso de publicación de las alturas, en metros: `toHeight` redondea a 3 decimales. Dos muestras
 * que difieran menos que esto se publican iguales, y ninguna curva puede enseñar un movimiento más
 * pequeño por mucho que la marea se mueva.
 */
const PASO_DE_PUBLICACION_M = 0.001;

/**
 * Cuánto se movió la marea **de verdad** mientras la curva publicada estaba quieta, medido en los
 * instantes de muestreo que caen dentro del tramo plano (los dos extremos incluidos).
 *
 * Es una función aparte y no un trozo del test porque el test de sensibilidad de más abajo la
 * llama con una curva congelada a mano: un gate que nadie ha visto fallar es una conjetura.
 */
function excursionRealEnLaMeseta(
  muestras: readonly { timeUtcMs: number; height_m: number }[],
  estacion: ReturnType<typeof prepareStation>,
  plano: { desdeUtcMs: number; hastaUtcMs: number },
): number {
  const alturas = muestras
    .filter(
      (muestra) =>
        muestra.timeUtcMs >= plano.desdeUtcMs && muestra.timeUtcMs <= plano.hastaUtcMs,
    )
    .map((muestra) => heightAt(estacion, muestra.timeUtcMs));
  return alturas.length === 0 ? 0 : Math.max(...alturas) - Math.min(...alturas);
}

test("A-1 · la curva no se congela en ningún puerto del catálogo", async () => {
  const fechaIso = HAY_BUILD ? fechaDelBuild() : new Date().toISOString().slice(0, 10);
  const congelados: string[] = [];
  for (const puerto of await deps.ports.list()) {
    const dia = await curvaDe(puerto.slug, fechaIso);
    const plano = tramoPlanoMasLargo(dia);
    if (plano.minutos === 0) continue;
    const estacion = prepareStation(await deps.stations.load(puerto.stationFile));
    const movimiento = excursionRealEnLaMeseta(dia.muestras, estacion, plano);
    if (movimiento > PASO_DE_PUBLICACION_M) {
      congelados.push(
        `${puerto.name}: la curva se queda quieta ${plano.minutos} min desde ` +
          `${new Date(plano.desdeUtcMs).toISOString()} mientras la marea se mueve ` +
          `${(movimiento * 1000).toFixed(1)} mm`,
      );
    }
  }
  assert.deepEqual(congelados, []);
});

/**
 * A-1 bis · **que el gate sepa fallar**, y precisamente en el caso que le da nombre al hallazgo.
 *
 * La avería original no era una meseta cualquiera: era una meseta que **se tragaba una pleamar**.
 * El instrumento anterior —medir en las dos puntas del tramo— daba cero justo ahí, y por eso este
 * test existe: reconstruye esa avería sobre un puerto de marea real, congelando la curva publicada
 * durante cinco horas centradas en su pleamar, y exige que el gate la vea. Si alguien vuelve a
 * apuntar la sonda a los bordes, este test se pone rojo antes de que la avería llegue a la página.
 */
test("A-1 bis · una pleamar congelada de cinco horas no se le escapa al gate", async () => {
  const fechaIso = HAY_BUILD ? fechaDelBuild() : new Date().toISOString().slice(0, 10);
  const puerto = (await deps.ports.list()).find((candidato) => candidato.slug === "vigo");
  assert.ok(puerto, "Vigo tiene que seguir en el catálogo: es el puerto de marea real de referencia");
  const dia = await curvaDe(puerto.slug, fechaIso);
  const estacion = prepareStation(await deps.stations.load(puerto.stationFile));

  const pleamar = dia.extremos.find((extremo) => extremo.kind === "high");
  assert.ok(pleamar, "el día de Vigo tiene que traer al menos una pleamar");
  const desdeUtcMs = pleamar.timeUtcMs - 150 * MINUTO;
  const hastaUtcMs = pleamar.timeUtcMs + 150 * MINUTO;

  // La curva de la avería: cinco horas planas a la altura de la pleamar, como la dibujaba la
  // reconstrucción de T-09 en los días de tres extremos.
  const congelada = dia.muestras.map((muestra) =>
    muestra.timeUtcMs >= desdeUtcMs && muestra.timeUtcMs <= hastaUtcMs
      ? { ...muestra, height_m: pleamar.height_m }
      : muestra,
  );
  const plano = tramoPlanoMasLargo({ ...dia, muestras: congelada });
  assert.ok(
    plano.minutos >= 4 * 60,
    `la meseta inyectada debería durar horas y dura ${plano.minutos} min`,
  );

  const enLasPuntas = Math.abs(
    heightAt(estacion, plano.hastaUtcMs) - heightAt(estacion, plano.desdeUtcMs),
  );
  const dentro = excursionRealEnLaMeseta(congelada, estacion, plano);
  assert.ok(
    dentro > PASO_DE_PUBLICACION_M,
    `el gate no ve la pleamar congelada: sólo ${(dentro * 1000).toFixed(1)} mm`,
  );
  // Y la razón por la que hizo falta cambiar de sonda: en las puntas, la misma avería casi no se ve.
  assert.ok(
    enLasPuntas < dentro / 10,
    `medida en las puntas la avería da ${(enLasPuntas * 1000).toFixed(1)} mm frente a los ` +
      `${(dentro * 1000).toFixed(1)} mm de dentro: si se parecen, el ejemplo ha dejado de serlo`,
  );
});

/**
 * A-2 · clase A6 (input hostil) — Extremos desordenados: la curva miente en silencio.
 *
 * `trazarCurvaMarea` validaba el NÚMERO de extremos pero no su ORDEN: con los mismos extremos
 * permutados devolvía una curva de aspecto normal y plantaba los círculos hasta a 128 px del trazo.
 *
 * CORREGIDO: el contrato falla ruidoso por el orden igual que por el número, y ahora comprueba las
 * DOS series que recibe (la curva muestreada y los extremos), que son dos oportunidades de llegar
 * desordenado en vez de una.
 *
 * Comportamiento correcto: o rechaza la entrada, o dibuja algo coherente. La tercera opción
 * —fallar callando— es la que no vale.
 */
test("A-2 · una curva desordenada no se dibuja en silencio", async () => {
  const fechaIso = HAY_BUILD ? fechaDelBuild() : new Date().toISOString().slice(0, 10);
  const dia = await curvaDe("santander", fechaIso);
  const desordenada: EntradaCurva = { ...dia, extremos: [...dia.extremos].reverse() };

  const curva = ((): ReturnType<typeof trazarCurvaMarea> | undefined => {
    try {
      return trazarCurvaMarea(desordenada);
    } catch {
      return undefined; // Falla ruidosamente: es una salida aceptable.
    }
  })();
  if (!curva) return;

  const trazo = puntosDelPath(curva.path);
  for (const marca of curva.extremos) {
    const desviacion = distanciaAlTrazo(marca, trazo);
    assert.ok(desviacion < 1, `un círculo de extremo está a ${desviacion.toFixed(1)} px del trazo`);
  }
});

/**
 * A-3 · clase A9 (callejón sin salida) — El pie enlazaba a `/metodologia/`, que no existe.
 *
 * Era el único enlace que la página ofrecía para explicar de dónde sale el número, justo al lado
 * del «No apto para navegación», y llevaba a un 404 en todas las páginas de puerto.
 *
 * CORREGIDO: el pie ya no enlaza a una página que no existe. Y el gate crece con el sitio: ahora
 * recorre **todas** las páginas construidas (32: portada, índices y puertos), que es donde vive el
 * riesgo real de esta trayectoria — una jerarquía de URL en la que un tramo no exista.
 *
 * Comportamiento correcto: todo enlace interno del sitio construido resuelve a algo construido.
 */
test("A-3 · ningún enlace interno del sitio construido lleva a un 404", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const rotos: string[] = [];
  for (const pagina of paginasConstruidas()) {
    for (const encontrado of readFileSync(pagina, "utf8").matchAll(/href="(\/[^"#]*)/g)) {
      const destino = encontrado[1];
      if (destino === undefined || destino === "") continue;
      const candidatos = [
        join(DIST, destino),
        join(DIST, `${destino}.html`),
        join(DIST, destino, "index.html"),
      ];
      if (!candidatos.some((ruta) => existsSync(ruta) && ruta !== DIST)) {
        rotos.push(`${relative(DIST, pagina)} → ${destino}`);
      }
    }
  }
  assert.deepEqual(rotos, [], `enlaces internos rotos en el sitio construido: ${rotos.join(", ")}`);
});

/**
 * A-4 · clase A6 (input hostil) — Un dato con marcado acababa CRUDO en el HTML construido.
 *
 * Astro escapa `"` y `&` en los valores de atributo, pero no `<` ni `>`. La `<meta
 * name="description">` de la página compone el nombre del puerto, así que un nombre con
 * `<script>…</script>` salía sin escapar dentro del atributo.
 *
 * NO era XSS —el tokenizador de HTML no abandona el estado de valor entrecomillado al ver un `<`—
 * pero falsificaba la promesa 2 tal y como se verifica y dejaba de ser inocuo en cuanto ese mismo
 * string cayese en un `set:html`, un JSON-LD o un `og:description` que consuma otro parser.
 *
 * CORREGIDO: `escaparMarcado` neutraliza `<`/`>` y `AlmanaqueLayout` lo aplica al único atributo
 * que compone datos. El gate ataca el mismo mecanismo que produjo el artefacto (el `addAttribute`
 * del runtime de Astro), ahora con el dato ya escapado.
 *
 * Comportamiento correcto: nada que venga del dato puede introducir marcado en el HTML construido.
 */
test("A-4 · un dato con marcado no viaja crudo a un atributo del HTML", async () => {
  const runtime: { addAttribute(valor: unknown, clave: string): unknown } = await import(
    "astro/runtime/server/index.js"
  );
  const renderizado = String(
    runtime.addAttribute(escaparMarcado("<script>alert(1)</script>"), "content"),
  );
  assert.ok(
    !renderizado.includes("<script>"),
    `el atributo sale con marcado crudo: ${renderizado.trim()}`,
  );
});

/**
 * A-5 · accesibilidad (promesa 5) — La página de puerto no tenía landmark principal.
 *
 * Todo el contenido colgaba de un `<div>`: sin `<main>` no hay «saltar al contenido» ni navegación
 * por landmarks.
 *
 * CORREGIDO: el contenedor lo pone el layout, así que lo tienen TODAS las páginas del sitio y no
 * solo la que se miró. El gate lo comprueba en todas.
 */
test("A-5 · todas las páginas construidas exponen un landmark principal", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const sinMain = paginasConstruidas().filter(
    (pagina) => !/<main[\s>]|role="main"/.test(readFileSync(pagina, "utf8")),
  );
  assert.deepEqual(
    sinMain.map((pagina) => relative(DIST, pagina)),
    [],
    "hay páginas cuyo contenido no está dentro de ningún landmark principal",
  );
});

/**
 * A-6 · accesibilidad (promesa 5) — `list-style: none` global quita la semántica de lista.
 *
 * WebKit retira el rol de lista cuando el estilo de viñeta es `none`, así que en Safari/VoiceOver
 * las listas dejaban de anunciarse como listas (se perdía el «lista de 3 elementos»). El antídoto
 * estándar es `role="list"` explícito en cada lista.
 *
 * CORREGIDO: todas las listas lo llevan. El gate cubre TODAS las listas de TODAS las páginas, así
 * que la siguiente que se añada sin rol lo pone en rojo.
 */
test("A-6 · las listas sin viñeta conservan el rol de lista", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  if (!/ul,\s*ol\s*\{[^}]*list-style:\s*none/.test(leerCssConstruido())) return; // ya no se quita
  const sinRol: string[] = [];
  for (const pagina of paginasConstruidas()) {
    for (const etiqueta of readFileSync(pagina, "utf8").matchAll(/<(ul|ol)\b[^>]*>/g)) {
      if (!etiqueta[0].includes('role="list"')) {
        sinRol.push(`${relative(DIST, pagina)}: ${etiqueta[0]}`);
      }
    }
  }
  assert.deepEqual(sinRol, [], `listas sin role="list" con list-style:none: ${sinRol.join(" ")}`);
});

/**
 * A-7 · tema (promesa 4) — `data-theme` cambiaba la paleta pero no el `color-scheme`.
 *
 * `:root { color-scheme: light dark }` dejaba la decisión al SO, así que con `data-theme="noche"`
 * en un sistema en claro —el único caso para el que existe ese atributo— los widgets de UA seguían
 * en claro sobre una página oscura, y al revés con `data-theme="claro"` sobre un sistema oscuro.
 *
 * CORREGIDO: `color-scheme` se declara en `packages/ui/src/tokens.css` y SOLO ahí, una vez por
 * bloque de tema, junto a la paleta que acompaña.
 */
test("A-7 · el tema forzado por data-theme ajusta también el color-scheme", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const bloque = /\[data-theme=["']?noche["']?\]\s*\{[^}]*\}/.exec(leerCssConstruido());
  assert.ok(bloque, "no encuentro la regla :root[data-theme=noche] en el CSS construido");
  assert.ok(
    (bloque[0] ?? "").includes("color-scheme"),
    "la regla de data-theme=noche no fija color-scheme: la UA sigue pintando sus widgets en claro",
  );
});

// =================================================================================================
// LO QUE AGUANTÓ · sin trinquete, en verde, como gate permanente
// =================================================================================================

/**
 * Promesa 2 · cero JavaScript de cliente **en el core**.
 *
 * RE-APUNTADO en T-11, no relajado. Hasta T-10 el gate exigía cero `<script>` ejecutable en todo el
 * sitio, y era la formulación correcta mientras la única fuente de la página era la astronomía: un
 * dato que se calcula meses antes no necesita hidratarse. La meteo del módulo `weather` sí caduca, y
 * hornearla en build la haría envejecer dentro del HTML sin poder decir cuánto (`docs/adr/ADR-01`).
 * El design brief ya reservaba esa puerta y solo esa: «si una sección necesita hidratación, es una
 * isla de módulo y entra por el contrato `AppModule`».
 *
 * Así que la promesa que se vigila ahora es más estrecha y más comprobable que «cero scripts»: el
 * JavaScript que se sirve tiene que estar **declarado**. Ni uno más, ni inline, ni manejadores en
 * atributos, ni hidratación de framework. Una isla que se cuele sin declararse —o un `client:load`
 * en una página del core— sigue poniendo esto en rojo, y el argumento de que la página se lee sin
 * cobertura sigue en pie para todo lo que no esté declarado.
 *
 * RE-APUNTADO OTRA VEZ EN T-12, y por segunda vez sin relajarlo. La PWA (guardar el puerto,
 * registrar el service worker, calcular un día sin red) **no es de ningún módulo**: es del core, y
 * no hay forma de hacerla sin JavaScript. En vez de ampliar la excepción a ojo, se le da al gate la
 * otra mitad de la lista: `src/scripts-de-core.ts`, un registro que dice qué scripts de core existen,
 * por qué no pueden ser HTML y en qué páginas se sirven. La cuenta sigue siendo exacta y el resto
 * del sitio —portada e índices— sigue teniendo que estar en CERO, que es lo que este test comprueba
 * página a página. Un script nuevo sin declarar en ninguno de los dos registros sigue en rojo.
 */
test("promesa 2 · todo el JavaScript del sitio está declarado: islas del registry y scripts de core", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const islasDeclaradas = activeModules
    .flatMap((modulo) => modulo.pageSections ?? [])
    .filter((seccion) => seccion.renderMode === "island").length;
  const paginasDePuerto = new Set(
    (await cargarPuertos()).map((puerto) => join(DIST, rutaPuerto(puerto), "index.html")),
  );

  for (const pagina of paginasConstruidas()) {
    const html = readFileSync(pagina, "utf8");
    const nombre = relative(DIST, pagina);
    const ejecutables = [...html.matchAll(/<script[^>]*>/g)]
      .map((etiqueta) => etiqueta[0])
      .filter((etiqueta) => !etiqueta.includes('type="application/ld+json"'));

    // Solo las páginas de puerto llevan secciones de módulo y PWA; el resto del sitio en cero.
    const esDePuerto = paginasDePuerto.has(pagina);
    const permitidos = (esDePuerto ? islasDeclaradas : 0) + scriptsDeCoreEn(esDePuerto);
    assert.equal(
      ejecutables.length,
      permitidos,
      `${nombre}: se sirven ${ejecutables.length} scripts y solo hay ${permitidos} declarados ` +
        `(islas del registry + src/scripts-de-core.ts)`,
    );
    for (const etiqueta of ejecutables) {
      // Con `src`: el código va en un fichero cacheable y auditable, no incrustado en 12 páginas.
      assert.match(etiqueta, /^<script type="module" src="\/_astro\/[^"]+\.js">$/u, nombre);
    }
    assert.deepEqual([...html.matchAll(/\son[a-z]+="/g)].map((atributo) => atributo[0]), [], nombre);
    assert.ok(!html.includes("astro-island"), `${nombre}: hay una isla hidratada en la página`);
  }
});

test("promesa 3 · las invariantes de la curva aguantan en los doce puertos", async () => {
  const fechaIso = HAY_BUILD ? fechaDelBuild() : new Date().toISOString().slice(0, 10);
  for (const puerto of await cargarPuertos()) {
    const dia = await curvaDe(puerto.slug, fechaIso);
    const curva = trazarCurvaMarea(dia);
    const alturas = dia.muestras.map((muestra) => muestra.height_m);
    const minimo = Math.min(...alturas);
    const maximo = Math.max(...alturas);

    const trazo = puntosDelPath(curva.path);
    const primero = trazo[0];
    const ultimo = trazo.at(-1);
    assert.ok(primero && ultimo, `${puerto.name}: el path está vacío`);
    assert.equal(primero.x, 0, `${puerto.name}: la curva no arranca al principio del día`);
    assert.equal(ultimo.x, curva.ancho, `${puerto.name}: la curva no llega al final del día`);
    for (const punto of trazo) {
      assert.ok(
        Number.isFinite(punto.x) && Number.isFinite(punto.y),
        `${puerto.name}: coordenada no finita en el path`,
      );
      assert.ok(
        punto.y >= 0 && punto.y <= curva.alto && punto.x >= 0 && punto.x <= curva.ancho,
        `${puerto.name}: el trazo se sale del lienzo en ${punto.x},${punto.y}`,
      );
    }

    // Cada extremo del día es un punto del trazo, no una marca flotando cerca.
    for (const marca of curva.extremos) {
      assert.ok(
        distanciaAlTrazo(marca, trazo) < 0.2,
        `${puerto.name}: el círculo del extremo en x=${marca.x} no cae sobre el trazo`,
      );
    }

    for (let instante = dia.inicioUtcMs; instante <= dia.finUtcMs; instante += 5 * MINUTO) {
      const altura = alturaEn(dia.muestras, instante);
      assert.ok(
        altura >= minimo - 1e-9 && altura <= maximo + 1e-9,
        `${puerto.name}: altura fuera del rango del día`,
      );
    }
  }
});

/**
 * Promesa 1 · lo que se lee en el HTML es lo que calcularon los casos de uso.
 *
 * En la tranche 1 esta promesa se comprobaba contra un fixture escrito a mano; ahora se comprueba
 * contra el dominio, que es lo que la trayectoria prometía. Si alguien cambia el formato de la
 * tabla, el redondeo o la zona horaria, esto se pone rojo.
 */
test("promesa 1 · la tabla del HTML construido dice lo que dicen los casos de uso", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const datos = await cargarDatosDePuerto("santander", fechaDelBuild());
  const filas = [...leerPagina().matchAll(/<tr[^>]*data-tipo="([^"]+)"[^>]*>(.*?)<\/tr>/g)].map(
    (fila) =>
      [...(fila[2] ?? "").matchAll(/<t[hd][^>]*>([^<]*)<\/t[hd]>/g)]
        .map((celda) => celda[1] ?? "")
        .join(" "),
  );
  const esperadas = datos.dia.eventos.map((evento) => {
    const hora = new Intl.DateTimeFormat("es-ES", {
      timeZone: datos.port.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(evento.timeUtcMs));
    const nombre = evento.kind === "high" ? "pleamar" : "bajamar";
    return `${nombre} ${hora} ${evento.height_m.toFixed(2).replace(".", ",")} m`;
  });

  assert.deepEqual(filas, esperadas, "la tabla de mareas no coincide con los casos de uso");
});

// =================================================================================================
// JUICIO A12 ADOPTADO COMO SPEC · sin test cuando se escribió el informe, con gate desde entonces
// =================================================================================================

/**
 * J-2 · El pie atribuía «Constituyentes REDMAR · calidad A · método Foreman (1977)» a unas cifras
 * que la cabecera del propio fixture describía como escritas a mano. La página se presentaba como
 * más fiable de lo que era y quien viera una captura no tenía forma de saberlo.
 *
 * CORREGIDO: la procedencia la declara el dato y la página se limita a pintarla. Ahora que el
 * fixture es el dataset real, el gate exige que las atribuciones del HTML sean **las de la estación
 * de ese puerto** —que cambian de licencia entre puertos (CC-BY vs CC-BY-NC)— y no un literal de la
 * plantilla que sería falso en la mitad de las páginas.
 */
test("J-2 · el pie declara las atribuciones que trae el dataset de ese puerto", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const html = leerPagina();
  const { station } = await cargarDatosDePuerto("santander", fechaDelBuild());
  assert.ok(station.attributions.length > 0, "la estación no declara atribuciones");
  for (const fuente of station.attributions) {
    assert.ok(html.includes(fuente.name), `el pie no pinta la fuente "${fuente.name}"`);
    assert.ok(html.includes(fuente.license), `el pie no pinta la licencia "${fuente.license}"`);
  }
});
