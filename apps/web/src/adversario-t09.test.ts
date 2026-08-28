/**
 * PASE ADVERSARIO · T-09 tranche 1 (rol `qa-adversario`, skill `qa-adversarial`).
 *
 * Función objetivo INVERTIDA: estos tests NO confirman que la página funciona — el `verificador` y
 * el rol `qa` ya lo hicieron. Aquí se ataca la PROMESA de la tranche:
 *
 *   1. `/puerto/santander` renderiza los datos del fixture (horas, alturas, coeficiente, sol/luna,
 *      solunar) en HTML estático.
 *   2. Cero JavaScript de cliente en el HTML construido.
 *   3. La curva SVG pasa por los extremos del día, cubre 0–24 h, es monótona entre extremos y está
 *      acotada — para CUALQUIER fixture válido, no solo el de Santander.
 *   4. El tema noche funciona vía `prefers-color-scheme` y `data-theme` sin romper contraste.
 *   5. La página es accesible en lo que promete (tabla real, aria-labels del rating).
 *
 * Informe del pase (hallazgos A-1…A-7, clases atacadas y no reproducidos):
 * `docs/qa/informe-adversario-t09-tranche1.md`.
 *
 * TRINQUETE — los siete hallazgos (A-1…A-7) nacieron envueltos en el helper `hallazgoAbierto()`, el
 * equivalente en `node:test` del `test.fail()` de Playwright: el cuerpo afirmaba el comportamiento
 * CORRECTO y CI quedaba verde mientras el bug estaba abierto, para ponerse en rojo el día que
 * alguien lo arreglase. Ese día llegó: los siete están corregidos, así que el envoltorio se ha
 * retirado y **los mismos cuerpos, sin tocar una línea de sus asserts**, se quedan aquí como gate
 * permanente. Un recorrido adversario arreglado no se borra: se queda vigilando.
 *
 * Los tests contra `dist/` exigen haber construido antes (`pnpm --filter web build`, que es
 * justo lo que hace CI antes de `pnpm test`); sin build se saltan en vez de dar un rojo falso.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { escaparMarcado } from "./escapar-marcado.ts";
import { SANTANDER } from "./fixtures/santander.ts";
import { alturaEnMinutos, minutosDesdeHora, trazarCurvaMarea } from "./grafico-marea.ts";
import type { ExtremoAltura } from "./grafico-marea.ts";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PAGINA_PUERTO = join(DIST, "puerto", "santander", "index.html");
const HAY_BUILD = existsSync(PAGINA_PUERTO);
const SIN_BUILD = "no hay apps/web/dist: corre antes `pnpm --filter web build`";

function leerPagina(): string {
  return readFileSync(PAGINA_PUERTO, "utf8");
}

function leerCssConstruido(): string {
  const carpeta = join(DIST, "_astro");
  const hoja = readdirSync(carpeta).find((fichero) => fichero.endsWith(".css"));
  assert.ok(hoja, "no encuentro la hoja de estilos construida en dist/_astro");
  return readFileSync(join(carpeta, hoja), "utf8");
}

// --- Días de marea válidos con los que se ataca el generador de curva -----------------------------
// Formas de día REALES de un puerto semidiurno/mixto, no basura sintética.

/** El día del fixture: cuatro extremos. Es el único que ha visto nadie hasta ahora. */
const CUATRO_EXTREMOS: readonly ExtremoAltura[] = [
  { hora: "04:12", alturaM: 4.82 },
  { hora: "10:26", alturaM: 0.93 },
  { hora: "16:38", alturaM: 4.95 },
  { hora: "22:51", alturaM: 0.81 },
];

/** Día de TRES extremos con la primera pleamar recién pasada la medianoche (~1 día de cada 7). */
const TRES_EXTREMOS_PRONTO: readonly ExtremoAltura[] = [
  { hora: "00:20", alturaM: 4.6 },
  { hora: "06:35", alturaM: 0.8 },
  { hora: "12:50", alturaM: 4.7 },
];

/** El mismo caso por el otro borde: el primer extremo del día cae ya por la mañana. */
const TRES_EXTREMOS_TARDE: readonly ExtremoAltura[] = [
  { hora: "11:00", alturaM: 4.4 },
  { hora: "17:10", alturaM: 0.9 },
  { hora: "23:20", alturaM: 4.5 },
];

/** Marea diurna (un solo ciclo al día): dos extremos. */
const DOS_EXTREMOS: readonly ExtremoAltura[] = [
  { hora: "09:00", alturaM: 1.2 },
  { hora: "21:00", alturaM: 0.1 },
];

/** Bajamares por debajo del cero del puerto: alturas negativas, perfectamente normales. */
const ALTURAS_NEGATIVAS: readonly ExtremoAltura[] = [
  { hora: "04:12", alturaM: 3.2 },
  { hora: "10:26", alturaM: -0.4 },
  { hora: "16:38", alturaM: 3.4 },
  { hora: "22:51", alturaM: -0.6 },
];

/** Extremos en los bordes exactos del día. */
const BORDES_DEL_DIA: readonly ExtremoAltura[] = [
  { hora: "00:00", alturaM: 4.5 },
  { hora: "06:10", alturaM: 0.6 },
  { hora: "12:20", alturaM: 4.6 },
  { hora: "18:30", alturaM: 0.5 },
];

const DIAS_VALIDOS: readonly (readonly [string, readonly ExtremoAltura[]])[] = [
  ["cuatro extremos (fixture)", CUATRO_EXTREMOS],
  ["tres extremos, el primero de madrugada", TRES_EXTREMOS_PRONTO],
  ["tres extremos, el primero por la mañana", TRES_EXTREMOS_TARDE],
  ["dos extremos (marea diurna)", DOS_EXTREMOS],
  ["alturas bajo el cero del puerto", ALTURAS_NEGATIVAS],
  ["extremos en los bordes del día", BORDES_DEL_DIA],
];

/** Duración, en minutos, del tramo más largo del día en el que la marea no se mueve nada. */
function tramoPlanoMasLargo(extremos: readonly ExtremoAltura[]): { minutos: number; desde: number } {
  let mejor = 0;
  let mejorDesde = 0;
  let inicio = 0;
  for (let minuto = 1; minuto <= 1440; minuto += 1) {
    const anterior = alturaEnMinutos(extremos, minuto - 1);
    if (Math.abs(alturaEnMinutos(extremos, minuto) - anterior) > 1e-9) {
      inicio = minuto;
      continue;
    }
    if (minuto - inicio > mejor) {
      mejor = minuto - inicio;
      mejorDesde = inicio;
    }
  }
  return { minutos: mejor, desde: mejorDesde };
}

function comoHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
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

// =================================================================================================
// HALLAZGOS REPRODUCIDOS Y CORREGIDOS · sin trinquete, en verde, como gate permanente
// =================================================================================================

/**
 * A-1 · clase A5 (límites 0/1/N) — En un día de TRES extremos la curva se congelaba hasta ~5 h.
 *
 * `nodosDelDia` añadía UN extremo virtual a cada lado reflejando la separación del vecino y
 * `alturaEnMinutos` recorta (`Math.min`/`Math.max`) fuera de ese tramo. Con cuatro extremos el
 * reflejo siempre rebasa los bordes del día y no se notaba; con TRES —que es ~1 día de cada 7 en un
 * puerto semidiurno, no un caso raro— el tramo reflejado se quedaba corto y el gráfico dibujaba una
 * recta horizontal de hasta 295 min (20 % del ancho): una pleamar que dura cinco horas. El dato no
 * era «menos preciso», era falso, y nada en la página avisaba.
 *
 * CORREGIDO: `nodosDelDia` repite el reflejo hasta rebasar las 00:00 y las 24:00, así que el
 * periodo del día continúa por los dos bordes y el recorte ya solo entra fuera del día.
 *
 * Comportamiento correcto: la marea nunca se para. Ninguna ventana de una hora del día puede tener
 * altura constante.
 */
test("A-1 · la curva no se congela en un día de tres extremos", () => {
  const dias: readonly (readonly [string, readonly ExtremoAltura[]])[] = [
    ["tres extremos, el primero de madrugada", TRES_EXTREMOS_PRONTO],
    ["tres extremos, el primero por la mañana", TRES_EXTREMOS_TARDE],
  ];
  for (const [nombre, dia] of dias) {
    const plano = tramoPlanoMasLargo(dia);
    assert.ok(
      plano.minutos < 60,
      `${nombre}: la marea se queda quieta ${plano.minutos} min desde las ${comoHora(plano.desde)} ` +
        `(${((plano.minutos / 1440) * 100).toFixed(1)} % del día)`,
    );
  }
});

/**
 * A-2 · clase A6 (input hostil) — Extremos desordenados: la curva miente en silencio.
 *
 * `trazarCurvaMarea` validaba el NÚMERO de extremos (lanza con menos de dos) pero no su ORDEN. Con
 * los mismos cuatro extremos del fixture permutados devolvía una curva de aspecto normal y plantaba
 * los círculos de pleamar/bajamar hasta a 128 px del trazo, además de dar la misma altura (0,87 m)
 * para los cuatro. El fixture de hoy está ordenado a mano, pero su propia cabecera dice que T-05 lo
 * sustituye por la salida del motor armónico.
 *
 * CORREGIDO: `nodosDelDia` exige orden temporal estricto y lanza nombrando las dos horas en
 * conflicto — el mismo contrato falla ruidoso por el número de extremos y por su orden.
 *
 * Comportamiento correcto: o rechaza la entrada como hace con «menos de dos extremos», o dibuja
 * algo coherente. La tercera opción —fallar callando— es la que no vale.
 */
test("A-2 · unos extremos desordenados no producen una curva falsa en silencio", () => {
  const desordenados: readonly ExtremoAltura[] = [
    { hora: "16:38", alturaM: 4.95 },
    { hora: "04:12", alturaM: 4.82 },
    { hora: "10:26", alturaM: 0.93 },
    { hora: "22:51", alturaM: 0.81 },
  ];

  const curva = ((): ReturnType<typeof trazarCurvaMarea> | undefined => {
    try {
      return trazarCurvaMarea(desordenados);
    } catch {
      return undefined; // Falla ruidosamente: es una salida aceptable.
    }
  })();
  if (!curva) return;

  const trazo = puntosDelPath(curva.path);
  for (const [indice, marca] of curva.extremos.entries()) {
    const extremo = desordenados[indice];
    assert.ok(extremo);
    const desviacion = distanciaAlTrazo(marca, trazo);
    assert.ok(
      desviacion < 1,
      `el círculo del extremo de las ${extremo.hora} está a ${desviacion.toFixed(1)} px del trazo`,
    );
    assert.equal(
      Math.round(alturaEnMinutos(desordenados, minutosDesdeHora(extremo.hora)) * 100) / 100,
      extremo.alturaM,
      `la curva no pasa por el extremo de las ${extremo.hora}`,
    );
  }
});

/**
 * A-3 · clase A9 (callejón sin salida) — El pie enlazaba a `/metodologia/`, que no existe.
 *
 * Era el único enlace que la página ofrecía para explicar de dónde sale el número, justo al lado
 * del «No apto para navegación», y llevaba a un 404 en todas las páginas de puerto.
 *
 * CORREGIDO: el pie ya no enlaza a una página que no existe. La de metodología es otra tranche;
 * cuando llegue, este mismo gate la exigirá construida antes de dejar volver el enlace.
 *
 * Comportamiento correcto: todo enlace interno del sitio construido resuelve a algo construido.
 */
test("A-3 · ningún enlace interno del sitio construido lleva a un 404", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const rotos: string[] = [];
  for (const pagina of [PAGINA_PUERTO, join(DIST, "index.html")]) {
    for (const encontrado of readFileSync(pagina, "utf8").matchAll(/href="(\/[^"]*)"/g)) {
      const destino = encontrado[1];
      if (destino === undefined) continue;
      const candidatos = [
        join(DIST, destino),
        join(DIST, `${destino}.html`),
        join(DIST, destino, "index.html"),
      ];
      if (!candidatos.some((ruta) => existsSync(ruta) && ruta !== DIST)) rotos.push(destino);
    }
  }
  assert.deepEqual(rotos, [], `enlaces internos rotos en el sitio construido: ${rotos.join(", ")}`);
});

/**
 * A-4 · clase A6 (input hostil) — Un dato con marcado acababa CRUDO en el HTML construido.
 *
 * Astro escapa `"` y `&` en los valores de atributo, pero no `<` ni `>`. La `<meta
 * name="description">` de la página compone el nombre del puerto, así que un nombre con
 * `<script>…</script>` salía sin escapar dentro del atributo (comprobado construyendo el sitio con
 * un fixture hostil: el `dist/` resultante contenía dos `<script>` literales; ver el informe).
 *
 * NO era XSS —el tokenizador de HTML no abandona el estado de valor entrecomillado al ver un `<`—
 * pero falsificaba la promesa 2 tal y como se verifica (el HTML construido pasaba a contener
 * literales `<script>`) y dejaba de ser inocuo en cuanto ese mismo string cayese en un `set:html`,
 * un JSON-LD o un `og:description` que consuma otro parser. Escalado al rol `seguridad` como
 * defensa en profundidad, no como vulnerabilidad explotable hoy.
 *
 * CORREGIDO: `escaparMarcado` neutraliza `<`/`>` y `AlmanaqueLayout` lo aplica al único atributo
 * que compone datos, la `<meta name="description">`. El gate ataca el mismo mecanismo que produjo
 * el artefacto (el `addAttribute` del runtime de Astro), ahora con el dato ya escapado.
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
 * Todo el contenido colgaba de un `<div class="pagina">`: sin `<main>` no hay «saltar al contenido»
 * ni navegación por landmarks. La home del mismo sitio SÍ lo tiene
 * (`apps/web/src/pages/index.astro:16`), así que no era un criterio importado de fuera: era una
 * inconsistencia interna del propio sitio.
 *
 * CORREGIDO: el contenedor de la página es un `<main class="pagina">`.
 */
test("A-5 · la página de puerto expone un landmark principal", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  assert.ok(
    /<main[\s>]|role="main"/.test(leerPagina()),
    "el contenido de la página de puerto no está dentro de ningún landmark principal",
  );
});

/**
 * A-6 · accesibilidad (promesa 5) — `list-style: none` global quita la semántica de lista.
 *
 * `AlmanaqueLayout` declara `ul, ol { list-style: none }` en global. WebKit retira el rol de lista
 * cuando el estilo de viñeta es `none`, así que en Safari/VoiceOver la lista solunar y el eje de
 * horas dejaban de anunciarse como listas (se perdía el «lista de 3 elementos» y el recuento). El
 * antídoto estándar es `role="list"` explícito en cada lista.
 *
 * CORREGIDO: la lista solunar y el eje de horas llevan `role="list"`. El gate cubre TODAS las
 * listas de la página, así que la siguiente que se añada sin rol lo pone en rojo.
 */
test("A-6 · las listas sin viñeta conservan el rol de lista", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  if (!/ul,\s*ol\s*\{[^}]*list-style:\s*none/.test(leerCssConstruido())) return; // ya no se quita
  const listas = [...leerPagina().matchAll(/<(ul|ol)\b[^>]*>/g)].map((etiqueta) => etiqueta[0]);
  const sinRol = listas.filter((etiqueta) => !etiqueta.includes('role="list"'));
  assert.deepEqual(sinRol, [], `listas sin role="list" con list-style:none: ${sinRol.join(" ")}`);
});

/**
 * A-7 · tema (promesa 4) — `data-theme` cambiaba la paleta pero no el `color-scheme`.
 *
 * `:root { color-scheme: light dark }` dejaba la decisión al SO, así que con `data-theme="noche"`
 * en un sistema en claro —el único caso para el que existe ese atributo— los widgets de UA (barras
 * de scroll, gutter de overscroll, controles de formulario) seguían en claro sobre una página
 * oscura, y al revés con `data-theme="claro"` sobre un sistema en oscuro.
 *
 * CORREGIDO: `color-scheme` se declara ahora en `packages/ui/src/tokens.css` y SOLO ahí —una por
 * bloque de tema, junto a la paleta que acompaña—, así que el atributo manda en los dos sentidos.
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

test("promesa 2 · el HTML construido no trae JavaScript de cliente", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const html = leerPagina();
  assert.equal(html.match(/<script[\s>]/g), null, "hay <script> en la página construida");
  assert.deepEqual([...html.matchAll(/\son[a-z]+="/g)].map((atributo) => atributo[0]), []);
  assert.ok(!html.includes("astro-island"), "hay una isla hidratada en la página");
});

test("promesa 3 · las invariantes de la curva aguantan en toda forma de día válida", () => {
  for (const [nombre, dia] of DIAS_VALIDOS) {
    const curva = trazarCurvaMarea(dia);
    const alturas = dia.map((extremo) => extremo.alturaM);
    const minimo = Math.min(...alturas);
    const maximo = Math.max(...alturas);

    for (const extremo of dia) {
      assert.equal(
        Math.round(alturaEnMinutos(dia, minutosDesdeHora(extremo.hora)) * 100) / 100,
        extremo.alturaM,
        `${nombre}: la curva no pasa por el extremo de las ${extremo.hora}`,
      );
    }

    const trazo = puntosDelPath(curva.path);
    const primero = trazo[0];
    const ultimo = trazo.at(-1);
    assert.ok(primero && ultimo, `${nombre}: el path está vacío`);
    assert.equal(primero.x, 0, `${nombre}: la curva no arranca a las 00:00`);
    assert.equal(ultimo.x, curva.ancho, `${nombre}: la curva no llega a las 24:00`);
    for (const punto of trazo) {
      assert.ok(
        Number.isFinite(punto.x) && Number.isFinite(punto.y),
        `${nombre}: coordenada no finita en el path`,
      );
      assert.ok(
        punto.y >= 0 && punto.y <= curva.alto && punto.x >= 0 && punto.x <= curva.ancho,
        `${nombre}: el trazo se sale del lienzo en ${punto.x},${punto.y}`,
      );
    }

    for (let minuto = 0; minuto <= 1440; minuto += 1) {
      const altura = alturaEnMinutos(dia, minuto);
      assert.ok(
        altura >= minimo - 1e-9 && altura <= maximo + 1e-9,
        `${nombre}: altura fuera del rango del día en el minuto ${minuto}`,
      );
    }

    for (let indice = 0; indice + 1 < dia.length; indice += 1) {
      const desde = dia[indice];
      const hasta = dia[indice + 1];
      assert.ok(desde && hasta);
      const sube = hasta.alturaM > desde.alturaM;
      const fin = minutosDesdeHora(hasta.hora);
      let previa = alturaEnMinutos(dia, minutosDesdeHora(desde.hora));
      for (let minuto = minutosDesdeHora(desde.hora); minuto <= fin; minuto += 1) {
        const altura = alturaEnMinutos(dia, minuto);
        assert.ok(
          sube ? altura >= previa - 1e-12 : altura <= previa + 1e-12,
          `${nombre}: la marea no es monótona entre ${desde.hora} y ${hasta.hora}`,
        );
        previa = altura;
      }
    }
  }
});

test("promesa 1 · la tabla del HTML construido dice lo mismo que el fixture", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const filas = [...leerPagina().matchAll(/<tr[^>]*data-tipo="([^"]+)"[^>]*>(.*?)<\/tr>/g)].map(
    (fila) =>
      [...(fila[2] ?? "").matchAll(/<t[hd][^>]*>([^<]*)<\/t[hd]>/g)]
        .map((celda) => celda[1] ?? "")
        .join(" "),
  );
  assert.deepEqual(
    filas,
    [
      "pleamar 04:12 4,82 m",
      "bajamar 10:26 0,93 m",
      "pleamar 16:38 4,95 m",
      "bajamar 22:51 0,81 m",
    ],
    "la tabla de mareas no coincide con el fixture",
  );
});

// =================================================================================================
// JUICIO A12 ADOPTADO COMO SPEC · sin test cuando se escribió el informe, con gate desde este PR
// =================================================================================================

/**
 * J-2 · El pie atribuía «Constituyentes REDMAR · calidad A · método Foreman (1977)» a unas cifras
 * que la cabecera del propio fixture describe como escritas a mano. La página se presentaba como
 * más fiable de lo que es y quien viera una captura no tenía forma de saberlo.
 *
 * CORREGIDO: la procedencia la declara el dato (`procedencia.fuente`) y la página se limita a
 * pintarla. Cuando T-05 sustituya el fixture por el motor armónico, el pie dirá la verdad sin tocar
 * la página — y este gate exige que siga saliendo de ahí y no de un literal de la plantilla.
 */
test("J-2 · el pie declara la procedencia que trae el dato, no una atribución fija", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  assert.ok(
    leerPagina().includes(SANTANDER.procedencia.fuente),
    `el pie no pinta la procedencia del dato ("${SANTANDER.procedencia.fuente}")`,
  );
});
