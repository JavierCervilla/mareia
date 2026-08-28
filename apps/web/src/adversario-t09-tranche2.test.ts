/**
 * PASE ADVERSARIO · T-09, tranche 2 (rol `qa-adversario`, skill `qa-adversarial`).
 *
 * Función objetivo INVERTIDA: aquí no se confirma que la página funciona —el `verificador` y el rol
 * `qa` ya lo hicieron, y la tranche 1 ya dejó sus siete gates—. Aquí se ataca la PROMESA nueva de
 * la trayectoria, la de las 32 páginas calculadas con los casos de uso:
 *
 *   «Cualquiera que abra la página de su puerto ve las mareas, el coeficiente y el sol/luna
 *    correctos de hoy, ENTIENDE CUÁNDO EL DATO ES FLOJO, y la página funciona a pleno sol, en
 *    móvil, sin JS y al imprimirla.»
 *
 * Los hallazgos de esta tranche no son de formato ni de layout: son **frases que la página afirma y
 * que sus propios datos desmienten**. Un almanaque que se equivoca de hora pierde una salida; un
 * almanaque que explica mal por qué falta un dato pierde la única cosa que vende (transparencia).
 *
 * Informe: `docs/qa/informe-adversario-t09-tranche2.md` (hallazgos A-8…A-12, clases atacadas,
 * no reproducidos y bundles).
 *
 * TRINQUETE — `test.fail()` es de Playwright y aquí el arnés es `node --test`; el equivalente es
 * `hallazgoAbierto()`, con la misma tabla de verdad: el cuerpo afirma **el comportamiento
 * correcto**, CI se queda verde mientras el bug esté abierto (con el motivo impreso como
 * diagnóstico en cada ejecución) y se pone **rojo el día que alguien lo arregle**, pidiendo que se
 * retire el trinquete para que el ataque quede como gate permanente. Mismo caveat: se conforma con
 * que el cuerpo falle por cualquier motivo, así que cada assert es específico y el motivo se
 * imprime en cada run.
 */

import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getAstro } from "@mareia/usecases";

import { cargarPuertos } from "./datos/catalogo.ts";
import { cargarDatosDePuerto } from "./datos/pagina-puerto.ts";
import { deps } from "./datos/deps.ts";
import { efemerideDeHorizonte } from "./cielo.ts";
import { rutaPuerto } from "./rutas.ts";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PORTADA = join(DIST, "index.html");
const HAY_BUILD = existsSync(PORTADA);
const SIN_BUILD = "no hay apps/web/dist: corre antes `pnpm --filter web build`";

/** Día de referencia cuando no hay `dist/` del que leer la fecha publicada. */
const FECHA_POR_DEFECTO = "2026-08-28";

/** Carrera de marea, en metros, por debajo de la cual «de centímetros» es una descripción honesta. */
const CARRERA_MICROMAREAL_M = 0.5;

function paginaDe(ruta: string): string {
  return readFileSync(join(DIST, ruta, "index.html"), "utf8");
}

function fechaDelBuild(): string {
  if (!HAY_BUILD) return FECHA_POR_DEFECTO;
  const fecha = /<time datetime="(\d{4}-\d{2}-\d{2})"/.exec(readFileSync(PORTADA, "utf8"))?.[1];
  return fecha ?? FECHA_POR_DEFECTO;
}

/** Un test que no se puede juzgar en este entorno (falta el `dist/`): ni pasa ni falla, se salta. */
class SinDatos extends Error {}

function exigirBuild(): void {
  if (!HAY_BUILD) throw new SinDatos(SIN_BUILD);
}

/**
 * TRINQUETE. Envuelve un cuerpo que afirma el comportamiento CORRECTO de un hallazgo **abierto**.
 *
 * | Estado del bug | Resultado del run | CI |
 * |---|---|---|
 * | abierto  | el cuerpo falla → se imprime el motivo como diagnóstico | 🟢 |
 * | arreglado| el cuerpo pasa → este test **falla** pidiendo retirar el trinquete | 🔴 |
 * | arreglado y trinquete retirado | el cuerpo pasa | 🟢 gate permanente |
 */
function hallazgoAbierto(nombre: string, cuerpo: () => Promise<void> | void): void {
  test(`${nombre} · TRINQUETE (hallazgo abierto)`, async (t: TestContext) => {
    let motivo: string | undefined;
    try {
      await cuerpo();
    } catch (error) {
      if (error instanceof SinDatos) {
        t.skip(error.message);
        return;
      }
      motivo = error instanceof Error ? error.message : String(error);
    }
    assert.ok(
      motivo !== undefined,
      `«${nombre}» YA NO FALLA: si el hallazgo está corregido, quita el trinquete ` +
        "(`hallazgoAbierto` → `test`) y deja el cuerpo como gate permanente.",
    );
    t.diagnostic(`${nombre} sigue abierto — ${motivo}`);
  });
}

// =================================================================================================
// A-8 · clase A12 (la promesa vs lo entregado) · la página llama «de centímetros» a una marea de 3 m
// =================================================================================================

/**
 * El aviso destacado de la cabecera afirma que «la marea astronómica es de centímetros» y que «el
 * nivel del agua lo decide sobre todo el residuo meteorológico». Eso lo decide `micromareal`, que
 * es `grade === "C" && hw_time_err_p95_min === null` — y ese `null` significa dos cosas distintas
 * en el QC de T-05: «hay observación pero no tiene pleamares identificables» (Mar Menor, Palma) y
 * «no hay observación con la que medir nada» (Cádiz). El aviso trata las dos igual.
 *
 * Comportamiento correcto: un aviso que describe la carrera de marea del puerto solo aparece donde
 * la carrera de marea lo justifica.
 */
async function elAvisoDeCentimetrosSoloSaleDondeLaCarreraEsDeCentimetros(): Promise<void> {
  const fechaIso = fechaDelBuild();
  const mentiras: string[] = [];
  for (const puerto of await cargarPuertos()) {
    const datos = await cargarDatosDePuerto(puerto.slug, fechaIso);
    if (!datos.micromareal) continue;
    const alturas = datos.dia.muestras.map((muestra) => muestra.height_m);
    const carrera = Math.max(...alturas) - Math.min(...alturas);
    if (carrera >= CARRERA_MICROMAREAL_M) {
      mentiras.push(`${puerto.name}: aviso «de centímetros» con ${carrera.toFixed(2)} m de carrera`);
    }
    // Y lo mismo contra el artefacto que ve el usuario, no solo contra el flag.
    if (HAY_BUILD) {
      const html = paginaDe(rutaPuerto(puerto));
      assert.ok(
        html.includes("aviso-micromareal"),
        `${puerto.name}: el flag micromareal no llegó al HTML`,
      );
    }
  }
  assert.equal(mentiras.length, 0, `avisos micromareales falsos: ${mentiras.join(" · ")}`);
}

// =================================================================================================
// A-9 · clase A5 (límites 0/1/N) · la fila «Sale» de la Luna anuncia el ocaso
// =================================================================================================

/**
 * Una vez cada ~29 días el orto (o el ocaso) de la Luna cae fuera del día civil y `getAstro`
 * devuelve `no-event`. `cielo.ts` compone entonces la frase de ausencia a partir de la RAZÓN
 * (`always-above` → «no se pone», `always-below` → «no sale») y no de la fila que la va a mostrar,
 * así que la fila «Sale» puede acabar anunciando un ocaso y viceversa.
 *
 * Comportamiento correcto: la frase que ocupa el hueco de una efeméride habla de ESA efeméride.
 */
const DIAS_SIN_EFEMERIDE_DE_LUNA = [
  { fecha: "2026-08-05", que: "rise" },
  { fecha: "2026-04-05", que: "rise" },
  { fecha: "2026-08-19", que: "set" },
  { fecha: "2026-04-19", que: "set" },
] as const;

async function laFilaDeLaLunaHablaDeSuPropiaEfemeride(): Promise<void> {
  const confusiones: string[] = [];
  for (const { fecha, que } of DIAS_SIN_EFEMERIDE_DE_LUNA) {
    const astro = await getAstro(deps, { slug: "santander", date: fecha });
    const busqueda = que === "rise" ? astro.moon.rise : astro.moon.set;
    const efemeride = efemerideDeHorizonte(busqueda, astro.timezone, "moon");
    if (efemeride.ausencia === undefined) continue;
    const habla = efemeride.ausencia.includes("no sale") ? "rise" : "set";
    if (habla !== que) {
      const fila = que === "rise" ? "Sale" : "Se pone";
      confusiones.push(`${fecha} · fila «${fila}» dice: ${efemeride.ausencia}`);
    }
  }
  assert.equal(
    confusiones.length,
    0,
    `filas de la Luna que anuncian la efeméride contraria: ${confusiones.join(" | ")}`,
  );
}

// =================================================================================================
// A-10 · clase A5 · «todo el día bajo el horizonte» junto a la hora de su ocaso
// =================================================================================================

/**
 * La misma ausencia trae además una afirmación astronómica: «hoy está todo el día bajo (o sobre) el
 * horizonte». En la costa española (35°–44° N) eso NO ocurre nunca: la Luna nunca es circumpolar
 * por debajo del paralelo ~61°. La página la publica igual, y las dos filas siguientes del mismo
 * bloque la desmienten con la hora del ocaso y con un paso superior de +23,5°.
 *
 * Comportamiento correcto: si la página afirma que la Luna no cruzó el horizonte en todo el día, el
 * resto del bloque tiene que ser coherente con esa afirmación — o no se hace la afirmación.
 */
async function laLunaNoEstaBajoElHorizonteYSobreElAlaVez(): Promise<void> {
  const contradicciones: string[] = [];
  for (const { fecha, que } of DIAS_SIN_EFEMERIDE_DE_LUNA) {
    const astro = await getAstro(deps, { slug: "santander", date: fecha });
    const busqueda = que === "rise" ? astro.moon.rise : astro.moon.set;
    const efemeride = efemerideDeHorizonte(busqueda, astro.timezone, "moon");
    if (efemeride.ausencia === undefined) continue;
    const altura = astro.moon.upperTransit.altitude_deg;

    if (efemeride.ausencia.includes("bajo el horizonte") && altura > 0) {
      contradicciones.push(
        `${fecha}: «todo el día bajo el horizonte» con paso superior a ${altura.toFixed(1)}°`,
      );
    }
    if (efemeride.ausencia.includes("sobre el horizonte")) {
      const seOculta = astro.moon.set.outcome !== "no-event" || astro.moon.rise.outcome !== "no-event";
      if (seOculta) {
        contradicciones.push(
          `${fecha}: «todo el día sobre el horizonte» y la misma página publica su orto/ocaso`,
        );
      }
    }
  }
  assert.equal(
    contradicciones.length,
    0,
    `el bloque de la Luna se contradice a sí mismo: ${contradicciones.join(" | ")}`,
  );
}

// =================================================================================================
// A-11 · clase A12 · la nota de calidad atribuye a «la observación» lo que nunca se observó
// =================================================================================================

/**
 * La sección «Calidad y procedencia del dato» resuelve `hw_time_err_p95_min === null` con una única
 * frase: «sin pleamares medibles en la observación». En Cádiz el dataset dice que **no hay
 * observación** (`rmse_m: null`, `validated_against: "contraste cruzado entre fuentes (sin
 * observaciones)"`, `metrics.samples: 0`), así que la página afirma en una fila que hubo una
 * observación sin pleamares medibles y en la siguiente que no hubo observación ninguna.
 *
 * Comportamiento correcto: cuando no hay observación, la nota no habla de «la observación» — que es
 * exactamente lo que la propia sección promete («los `null` significan "no se pudo medir" y no "no
 * pasa nada"»).
 */
const FRASE_SIN_PLEAMARES = "sin pleamares medibles en la observación";

async function laNotaDeCalidadNoInventaUnaObservacion(): Promise<void> {
  exigirBuild();
  const fechaIso = fechaDelBuild();
  const inventadas: string[] = [];
  for (const puerto of await cargarPuertos()) {
    const { station } = await cargarDatosDePuerto(puerto.slug, fechaIso);
    const calidad = station.quality;
    if (calidad.hw_time_err_p95_min !== null) continue;
    const sinObservacion = calidad.rmse_m === null;
    if (!sinObservacion) continue;
    if (paginaDe(rutaPuerto(puerto)).includes(FRASE_SIN_PLEAMARES)) {
      inventadas.push(
        `${puerto.name}: «${FRASE_SIN_PLEAMARES}» con rmse null y validado contra ` +
          `«${calidad.validated_against ?? "nada"}»`,
      );
    }
  }
  assert.equal(
    inventadas.length,
    0,
    `notas de calidad que hablan de una observación inexistente: ${inventadas.join(" · ")}`,
  );
}

// =================================================================================================
// A-12 · clase A9 (callejón sin salida) · el sitio construido no trae página de 404
// =================================================================================================

/**
 * Las URL del portal son jerárquicas y profundas (`/mareas/<región>/<provincia>/<puerto>/`) y el
 * `dist/` son 32 directorios con su `index.html`: cualquier tramo mal escrito, cualquier enlace
 * viejo compartido por WhatsApp y cualquier slug que cambie al ampliar el catálogo (T-13) cae en el
 * 404 crudo del servidor, sin cabecera, sin buscador y sin una sola vía de vuelta a Mareia.
 *
 * Comportamiento correcto: un sitio estático que quiere que la gente llegue a la página de su
 * puerto construye también la página de «no encontrado», que es la única que puede devolverlo.
 */
function elSitioConstruidoTienePaginaDeNoEncontrado(): void {
  exigirBuild();
  const pagina = join(DIST, "404.html");
  assert.ok(
    existsSync(pagina),
    "el sitio construido no trae 404.html: quien llega a una URL que no existe se queda fuera",
  );
  const html = readFileSync(pagina, "utf8");
  assert.match(html, /href="\/(mareas\/)?"/, "la página de 404 no ofrece la vuelta al portal");
}

hallazgoAbierto(
  "A-8 · el aviso «de centímetros» solo sale donde la carrera es de centímetros",
  elAvisoDeCentimetrosSoloSaleDondeLaCarreraEsDeCentimetros,
);
hallazgoAbierto(
  "A-9 · la fila de la Luna habla de su propia efeméride",
  laFilaDeLaLunaHablaDeSuPropiaEfemeride,
);
hallazgoAbierto(
  "A-10 · la Luna no está bajo el horizonte y sobre él a la vez",
  laLunaNoEstaBajoElHorizonteYSobreElAlaVez,
);
hallazgoAbierto(
  "A-11 · la nota de calidad no inventa una observación",
  laNotaDeCalidadNoInventaUnaObservacion,
);
hallazgoAbierto(
  "A-12 · el sitio construido tiene página de «no encontrado»",
  elSitioConstruidoTienePaginaDeNoEncontrado,
);
