/**
 * Lo que de verdad se publica: el `dist/`.
 *
 * Estos tests no miran componentes ni funciones, miran el **HTML construido**, que es el artefacto
 * que ve un usuario. Es el único sitio donde se comprueba de una vez que el wiring de build, los
 * casos de uso, el formato y el renderizado están de acuerdo: si el número que calcula el dominio
 * no llega a la tabla —o llega redondeado de otra forma, o en otra zona horaria—, aquí se ve.
 *
 * El día que se compara **se lee del propio HTML** y no se recalcula: sin `BUILD_DATE` el build usa
 * el día UTC del reloj, y un build a las 23:59 con los tests a las 00:01 compararía dos días
 * distintos. La página declara qué día publica; se le cree a ella.
 *
 * Sin `dist/` los tests se saltan en vez de dar un rojo falso: CI construye antes de testear
 * (`pnpm --filter web build` y luego `pnpm test`, en ese orden, job `web`).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { activeModules } from "./modules.config.ts";
import { scriptsDeCoreEn } from "./scripts-de-core.ts";
import { cargarCatalogo, cargarPuertos, puertosDeRegion } from "./datos/catalogo.ts";
import { cargarDatosDePuerto } from "./datos/pagina-puerto.ts";
import { diasDelMes } from "./datos/fecha-build.ts";
import { hora, metros } from "./formato.ts";
import { cargarCatalogoDeEspecies } from "./modulos/especies/catalogo.ts";
import {
  RUTA_ESPECIES,
  RUTA_MAREAS,
  rutaFichaDeEspecie,
  rutaProvincia,
  rutaPuerto,
  rutaRegion,
} from "./rutas.ts";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PORTADA = join(DIST, "index.html");
const HAY_BUILD = existsSync(PORTADA);
const SIN_BUILD = "no hay apps/web/dist: corre antes `pnpm --filter web build`";

/** El HTML construido de una ruta del sitio (`/mareas/…/` → `dist/mareas/…/index.html`). */
function paginaDe(ruta: string): string {
  return readFileSync(join(DIST, ruta, "index.html"), "utf8");
}

/**
 * La entrada de un puerto en un índice construido, tal cual salió al HTML: del `<li>` que abre
 * hasta el `</li>` que cierra. Se localiza por su enlace, que es único en la página.
 *
 * Sirve para las tres listas de puertos del portal —portada, región y provincia—, que desde el
 * arreglo de T-14B publican la misma señal con el mismo componente.
 */
function entradaDelIndice(html: string, ruta: string): string | undefined {
  const enlace = html.indexOf(`href="${ruta}"`);
  if (enlace === -1) {
    return undefined;
  }
  const inicio = html.lastIndexOf("<li", enlace);
  const fin = html.indexOf("</li>", enlace);
  return inicio === -1 || fin === -1 ? undefined : html.slice(inicio, fin);
}

function fechaDelBuild(): string {
  const fecha = /<time datetime="(\d{4}-\d{2}-\d{2})"/.exec(readFileSync(PORTADA, "utf8"))?.[1];
  assert.ok(fecha, "la portada construida no declara la fecha de sus datos");
  return fecha;
}

/** Todas las rutas que el sitio debería haber construido, derivadas del catálogo. */
async function rutasEsperadas(): Promise<readonly string[]> {
  const regiones = await cargarCatalogo();
  return [
    "/",
    RUTA_MAREAS,
    // El catálogo de especies (T-20). Es una página del portal como los índices geográficos: si no
    // estuviera aquí, el gate del sitemap dejaría de exigir que se publique y una página real del
    // sitio podría quedarse fuera del XML sin que nadie se enterase.
    RUTA_ESPECIES,
    // Y sus 86 fichas (T-23), por lo mismo: el gate exige que el sitemap liste todas las páginas
    // construidas «y ninguna más», así que una familia entera de páginas fuera de esta lista sería
    // una familia entera que puede dejar de publicarse sin que nadie se entere.
    ...(await cargarCatalogoDeEspecies()).especies.map((especie) =>
      rutaFichaDeEspecie(especie.clave),
    ),
    ...regiones.map((region) => rutaRegion(region.slug)),
    ...regiones.flatMap((region) =>
      region.provincias.map((provincia) => rutaProvincia(region.slug, provincia.slug)),
    ),
    ...regiones.flatMap((region) => puertosDeRegion(region).map(rutaPuerto)),
  ];
}

test("el build genera una página por puerto y por escalón de la jerarquía", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const puertos = await cargarPuertos();
  assert.ok(puertos.length >= 120, `el catálogo se ha encogido a ${puertos.length} puertos`);

  const faltan = (await rutasEsperadas()).filter(
    (ruta) => !existsSync(join(DIST, ruta, "index.html")),
  );
  assert.deepEqual(faltan, [], "hay rutas del catálogo sin página construida");
});

/**
 * El test que exige la trayectoria: lo que se lee en el HTML de Vigo es lo que calcula el dominio.
 *
 * Vigo es grade B con marea semidiurna clara —cuatro extremos al día y ~4 m de carrera—, así que un
 * error de formato, de zona horaria o de redondeo se ve a simple vista en el diff del assert.
 */
test("el HTML de Vigo trae los extremos del día que calculan los casos de uso", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const fechaIso = fechaDelBuild();
  const datos = await cargarDatosDePuerto("vigo", fechaIso);
  const html = paginaDe(rutaPuerto(datos.port));

  assert.ok(datos.dia.eventos.length >= 2, "un día de Vigo tiene al menos dos extremos");

  // Se acota a la tabla del DÍA antes de leer filas: las mismas horas y alturas aparecen luego en
  // la tabla del mes, y un patrón suelto sobre la página entera casaría con la fila equivocada
  // (comprobado con una sonda: cambiar una hora en el HTML no ponía el test en rojo).
  const tabla = /<table class="tabla-mareas">([\s\S]*?)<\/table>/.exec(html)?.[1];
  assert.ok(tabla, "no encuentro la tabla de mareas del día en el HTML construido");

  const filas = [...tabla.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((fila) =>
    [...(fila[1] ?? "").matchAll(/<t[hd][^>]*>([^<]*)<\/t[hd]>/g)]
      .map((celda) => celda[1] ?? "")
      .join(" "),
  );
  const esperadas = datos.dia.eventos.map((evento) => {
    const nombre = evento.kind === "high" ? "pleamar" : "bajamar";
    return `${nombre} ${hora(evento.timeUtcMs, datos.port.timezone)} ${metros(evento.height_m)}`;
  });

  assert.deepEqual(filas, esperadas, "la tabla del día no dice lo que calculan los casos de uso");
});

test("la tabla mensual de Vigo trae todos los días del mes con su coeficiente", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const fechaIso = fechaDelBuild();
  const datos = await cargarDatosDePuerto("vigo", fechaIso);
  const html = paginaDe(rutaPuerto(datos.port));

  // Acotado a la tabla mensual: la cabecera de la página también lleva un `<time datetime>` con el
  // día del build, y sin acotar ese día pasaría el test aunque su fila no existiera.
  const tabla = /<table class="tabla-mes">([\s\S]*?)<\/table>/.exec(html)?.[1];
  assert.ok(tabla, "no encuentro la tabla mensual en el HTML construido");

  const dias = diasDelMes(fechaIso);
  assert.equal(datos.mes.dias.length, dias.length);
  for (const dateIso of dias) {
    assert.ok(
      tabla.includes(`<time datetime="${dateIso}">`),
      `la tabla mensual no tiene la fila del ${dateIso}`,
    );
  }
  // Cada día del mes tiene uno o dos coeficientes: el día lunar dura 24 h 50 min.
  for (const dia of datos.mes.dias) {
    assert.ok(
      dia.coeficientes.length >= 1 && dia.coeficientes.length <= 3,
      `${dia.dateIso}: ${dia.coeficientes.length} coeficientes`,
    );
  }
});

/**
 * Los dos avisos de la cabecera salen exactamente donde toca, ni uno más ni uno menos, y cada uno
 * por su motivo: el micromareal donde la **carrera de marea medida** es de centímetros, y el de
 * estación sin observación donde el QC no tuvo mareógrafo con el que validar.
 *
 * De más, sería ruido que resta credibilidad al aviso donde sí importa; de menos, sería publicar
 * una tabla con pinta de exacta en el único sitio donde no lo es. Y confundirlos —que es lo que
 * hacía el criterio viejo, `grade C` sin p95— le colgaba a Cádiz el cartel de «aquí la marea es de
 * centímetros» encima de su tabla de 2,90 m (hallazgo A-8 del pase adversario de T-09).
 */
test("cada aviso de la cabecera aparece solo en los puertos que le tocan", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const fechaIso = fechaDelBuild();
  const conAviso: string[] = [];
  const esperados: string[] = [];
  const conAvisoEstimado: string[] = [];
  const esperadosEstimados: string[] = [];
  for (const puerto of await cargarPuertos()) {
    const datos = await cargarDatosDePuerto(puerto.slug, fechaIso);
    const html = paginaDe(rutaPuerto(puerto));
    if (datos.micromareal) esperados.push(puerto.slug);
    if (html.includes("aviso-micromareal")) conAviso.push(puerto.slug);
    if (datos.estimado) esperadosEstimados.push(puerto.slug);
    if (html.includes("aviso-estimado")) conAvisoEstimado.push(puerto.slug);
  }

  assert.deepEqual(conAviso.sort(), esperados.sort());
  // Con 12 puertos la lista de micromareales se podía congelar entera; con 150 se congelan los del
  // piloto, que son los que atan las constantes de T-04, y el resto lo sostiene la igualdad de
  // arriba: el aviso sale exactamente donde el dato dice, ni uno más ni uno menos.
  for (const slug of ["cabo-de-palos", "la-manga-del-mar-menor", "palma-de-mallorca"]) {
    assert.ok(
      esperados.includes(slug),
      `${slug} ha dejado de ser micromareal: revisa las constantes de T-04`,
    );
  }

  assert.deepEqual(conAvisoEstimado.sort(), esperadosEstimados.sort());
  assert.ok(
    esperadosEstimados.includes("cadiz"),
    "Cádiz tiene mareógrafo en la dársena pero ninguna observación con la que validar: sigue "
      + "siendo estimado mientras el QC no consiga serie del IOC",
  );
  assert.ok(
    !esperadosEstimados.includes("vigo"),
    "Vigo tiene mareógrafo propio y observación: si sale estimado, el criterio se ha roto",
  );
});

/**
 * Que el aviso y la nota de calidad de la misma página no se contradigan.
 *
 * El aviso de puerto estimado heredó su prosa del criterio viejo (`rmse_m === null`) y afirmaba
 * para **todos** los estimados que «no publicamos ni el error medio frente a la observación ni el
 * error de hora de la pleamar: no los hemos medido». Con el criterio nuevo (`estimated`) eso dejó
 * de ser equivalente: Garachico y San Sebastián de la Gomera tienen mareógrafo del IOC en la
 * dársena y constantes prestadas de veinte kilómetros, así que su error **sí** está medido y la
 * sección de transparencia lo publica veinte líneas más abajo, en la misma página. Negar un número
 * propio es el reverso exacto del pecado que T-13 vino a corregir, y lo encontró una lectura
 * humana; a partir de aquí lo encuentra el CI.
 */
test("ninguna página niega un error que ella misma publica", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const NIEGA = "no publicamos ni el error medio frente a la observación";
  const AFIRMA = "sí hemos podido comparar la predicción con un mareógrafo de este puerto";
  const fechaIso = fechaDelBuild();
  const contradicciones: string[] = [];
  for (const puerto of await cargarPuertos()) {
    const { station } = await cargarDatosDePuerto(puerto.slug, fechaIso);
    const html = textoDe(paginaDe(rutaPuerto(puerto)));
    const medido = station.quality.rmse_m !== null;
    if (medido && html.includes(NIEGA)) {
      contradicciones.push(
        `${puerto.slug}: niega el error medido y publica ${station.quality.rmse_m} m`,
      );
    }
    if (station.quality.estimated && medido && !html.includes(AFIRMA)) {
      contradicciones.push(`${puerto.slug}: estimado con error medido y no lo dice`);
    }
    if (station.quality.estimated && !medido && !html.includes(NIEGA)) {
      contradicciones.push(`${puerto.slug}: estimado sin medir y no lo dice`);
    }
  }
  assert.deepEqual(contradicciones, []);
});

test("el sitemap lista todas las páginas construidas y ninguna más", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const xml = readFileSync(join(DIST, "sitemap.xml"), "utf8");
  const rutas = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (encontrado) => new URL(encontrado[1] ?? "").pathname,
  );

  assert.deepEqual([...rutas].sort(), [...(await rutasEsperadas())].sort());
  assert.match(xml, new RegExp(`<lastmod>${fechaDelBuild()}</lastmod>`));
});

test("cada página de puerto declara canónica y JSON-LD parseable", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  for (const puerto of await cargarPuertos()) {
    const ruta = rutaPuerto(puerto);
    const html = paginaDe(ruta);
    const canonica = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
    assert.ok(canonica, `${puerto.slug}: sin canónica`);
    assert.equal(new URL(canonica).pathname, ruta);

    const bruto = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1];
    assert.ok(bruto, `${puerto.slug}: sin JSON-LD`);
    const grafo = JSON.parse(bruto) as { "@graph": readonly { "@type": string }[] };
    assert.deepEqual(
      grafo["@graph"].map((nodo) => nodo["@type"]),
      ["Place", "BreadcrumbList"],
    );
  }
});

// --- La sección meteo en el HTML publicado (T-11) ------------------------------------------------
// Lo que se comprueba aquí es la mitad estructural de ADR-01: que el dato que caduca **no está
// dentro del HTML**. Si algún día alguien decide hornear la meteo en build, estos tests se ponen
// rojos, que es exactamente lo que tienen que hacer.

test("cada página de puerto trae la sección meteo anclada a su puerto y a su zona horaria", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  for (const puerto of await cargarPuertos()) {
    const html = paginaDe(rutaPuerto(puerto));
    assert.match(html, /<section id="meteo" class="bloque"/u, `${puerto.slug}: sin sección meteo`);
    assert.match(
      html,
      new RegExp(`data-meteo-puerto="${puerto.slug}" data-meteo-zona="${puerto.timezone}"`, "u"),
      `${puerto.slug}: la isla no sabe de qué puerto ni en qué hora habla`,
    );
  }
});

/**
 * El trinquete de ADR-01, y por eso está escrito como LISTA BLANCA.
 *
 * La decisión de servir la meteo por isla en vez de hornearla en build se justifica en que un HTML
 * horneado no puede sellar su propio dato: el que dice «consultado hace 4 minutos» lo sigue
 * diciendo veinte horas después. Esa garantía vale lo que valga este test.
 *
 * La primera versión perseguía unidades (`km/h`, `hPa`, `°C`) y **no mordía**: una inyección con
 * altura de ola, dirección, periodo y el sello congelado dentro pasaba en verde. Perseguir
 * magnitudes una a una es una carrera que se pierde en cuanto alguien añade una unidad nueva.
 *
 * Así que se invierte: el `#meteo` del HTML construido tiene que decir EXACTAMENTE estas frases y
 * ninguna más. Es deliberadamente frágil — tocar el texto de la sección obliga a actualizar esta
 * constante — y esa fragilidad es el precio de que un dato horneado no pueda colarse jamás.
 *
 * Pero una lista blanca acotada a la sección **es más estrecha** que la lista negra que sustituye,
 * y eso sería cambiar de sitio el agujero en vez de taparlo: un resumen del mar junto al título, o
 * una `<meta name="description">` con «hoy, mar rizada, 1,68 m», quedaría fuera del perímetro. Por
 * eso el trinquete son **tres** afirmaciones y no una: la sección dice exactamente esto (texto),
 * la sección no esconde datos en atributos (un `title=` es un tooltip que se lee, y el propio
 * recorrido de esta trayectoria exige que el sello esté VISIBLE y no en un `title` ni en un
 * `aria-label`), y **el resto del HTML** tampoco trae magnitudes.
 */
const TEXTO_ESTATICO_DE_METEO = [
  "Estado del mar y del cielo en {PUERTO}",
  "El estado del mar todavía no ha llegado",
  "Esta sección no viaja dentro de la página: se pide al servidor al abrirla, porque la meteo",
  "caduca en horas y esta página se construye una vez al día. Si sigues leyendo esto, o la",
  "petición no ha terminado o tu navegador no ejecuta JavaScript. El resto de la página —mareas,",
  "curva, sol y luna— no lo necesita y ya está completa.",
  "Fuentes de esta sección",
  "Open-Meteo · CC-BY-4.0",
  "AEMET — Agencia Estatal de Meteorología · Uso condicionado al reconocimiento de AEMET como",
  "autora de los datos",
  "Predicción de modelo numérico y boletín oficial, para saber con qué se va a encontrar quien",
  "llegue a la orilla. No apto para navegación.",
].join(" ");

/**
 * Texto visible de un fragmento de HTML, con las entidades deshechas y los espacios normalizados.
 *
 * Las entidades importan desde T-13: el catálogo pasó de doce puertos a toda la costa y con ella
 * llegaron los apóstrofos (`Canet d'En Berenguer`, `l'Ampolla`, `l'Escala`). Astro los escapa —bien
 * escapados, que es lo que exige el gate A-4—, así que comparar el texto sin deshacerlos hacía
 * fallar este gate por la ortografía de un topónimo en vez de por un dato horneado.
 */
function textoDe(html: string): string {
  return html
    .replaceAll(/<[^>]+>/gu, " ")
    .replaceAll(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)))
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll(/\s+/gu, " ")
    .trim();
}

/**
 * Magnitudes que solo puede escribir la sección meteo. Se mantiene la lista negra —heredada de la
 * primera versión de este gate— para el HTML de FUERA de `#meteo`: ahí no cabe una lista blanca
 * (el resto de la página cambia a diario), y renunciar a ella sería perder cobertura que ya
 * teníamos.
 */
const MAGNITUDES_DE_METEO =
  /\d[\d,]*\s*(km\/h|hPa|°C|kt|nudos)\b|\bfetchedAt\b|\bageSeconds\b|Índice UV|Mar de fondo|Mar de viento|Temperatura del agua|consultado hace|Dato de hace/u;

/**
 * Los atributos de un fragmento de HTML, leídos **etiqueta a etiqueta** y con el nombre entero.
 *
 * Se parsea así —primero la etiqueta, después sus atributos— y no con un barrido de la sección
 * entera porque un barrido tiene que exigir comillas para no confundir el texto con atributos, y
 * ahí se colaban tres de las cuatro puertas del hallazgo H-4 del pase adversario: HTML5 permite el
 * valor **sin comillas** (`data-ola=1,68m`) y el nombre admite `_` y `:` (`data_ola=`, `x:ola=`),
 * que la lista `[a-zA-Z0-9-]` no veía. El nombre es aquí «todo menos espacio, `=`, `/`, `>` y
 * comillas», que es exactamente lo que dice la especificación, así que el gate ya no depende de la
 * FORMA del atributo: cualquier cosa que el navegador lea con `getAttribute()` pasa por la tabla.
 *
 * Un atributo booleano (`hidden`, `data-meteo-bloques`) no tiene valor y entra con la cadena vacía:
 * también hay que declararlo, porque su sola presencia es información.
 */
function atributosDe(html: string): readonly (readonly [string, string])[] {
  const etiquetas = html.matchAll(/<[a-zA-Z][^\s/>]*((?:"[^"]*"|'[^']*'|[^>"'])*)>/gu);
  return [...etiquetas].flatMap((etiqueta) =>
    [...(etiqueta[1] ?? "").matchAll(/([^\s=/>"']+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>]+))?/gu)].map(
      (atributo) =>
        [atributo[1] ?? "", (atributo[2] ?? "").replace(/^["']|["']$/gu, "")] as const,
    ),
  );
}

/**
 * Atributos de la sección que no son los esperados — cada uno es un sitio donde esconder un dato.
 *
 * La clave está en **no tirar el nombre del atributo**. Una primera versión se quedaba solo con el
 * valor y tenía que adivinar «esto parece una clase CSS» por su forma; con eso, cualquier prosa en
 * minúsculas pasaba —y el boletín de AEMET es exactamente eso: prosa en minúsculas—, así que un
 * `title="mar rizada o marejada viento del noroeste"` se colaba entero. Aquí se permite **por
 * nombre**: `class` solo admite tokens del vocabulario de esta sección, `src` solo el bundle de la
 * isla, y cualquier atributo que no esté en la tabla es un hallazgo, se llame como se llame.
 */
function atributosInesperados(seccion: string, slug: string, zona: string): readonly string[] {
  const claseValida = (valor: string): boolean =>
    valor
      .split(/\s+/u)
      .every((token) => /^(meteo|bloque|etiqueta)(__[a-z-]+)?(--[a-z-]+)?$/u.test(token));

  const esperado: Record<string, (valor: string) => boolean> = {
    class: claseValida,
    id: (valor) => valor === "meteo" || valor === "titulo-meteo",
    // Lo pone `SeccionesDeModulos` desde T-10 (hallazgo A-13): la sección se llama como su título.
    "aria-labelledby": (valor) => valor === "titulo-meteo",
    "aria-busy": (valor) => valor === "false",
    type: (valor) => valor === "module",
    "data-meteo-puerto": (valor) => valor === slug,
    "data-meteo-zona": (valor) => valor === zona,
    // El origen del API viaja al HTML como atributo (`api.ts`): vacío = mismo origen que la página.
    "data-meteo-api": (valor) => valor === "" || URL.canParse(valor),
    // Los anclajes de la isla y el `hidden` del contenedor de bloques son atributos booleanos.
    "data-meteo-aviso": (valor) => valor === "",
    "data-meteo-bloques": (valor) => valor === "",
    "data-meteo-anuncio": (valor) => valor === "",
    hidden: (valor) => valor === "",
    // La región viva que anuncia el cambio de estado a un lector de pantalla (H-7).
    role: (valor) => valor === "status",
    "aria-live": (valor) => valor === "polite",
    href: (valor) => valor === "https://open-meteo.com/" || valor === "https://www.aemet.es/es/nota_legal",
    src: (valor) => /^\/_astro\/Meteo\.astro[\w.]*\.js$/u.test(valor),
  };

  // Nombres con dígitos (`data-ola1`), con `_` o con `:`, y valores con comillas, con comillas
  // simples o SIN comillas: todos entran en el barrido. Si no, bastaba renombrar el atributo —o
  // quitarle las comillas al valor— para saltarse el gate.
  return atributosDe(seccion)
    .filter(([nombre, valor]) => !(esperado[nombre]?.(valor) ?? false))
    .map(([nombre, valor]) => `${nombre}="${valor}"`);
}

/**
 * Comentarios HTML dentro de la sección. Es el cuarto agujero de H-4 y va aparte porque no es un
 * atributo ni texto visible: `textoDe` borra un comentario igual que borra una etiqueta, así que
 * `<!-- ola 1,68 m -->` no dejaba rastro que comparar con la lista blanca. Y es el sitio clásico
 * donde un framework deja su carga de hidratación, que es exactamente lo que ADR-01 prohíbe.
 */
function comentariosDe(html: string): readonly string[] {
  return [...html.matchAll(/<!--[\s\S]*?-->/gu)].map((encontrado) => encontrado[0]);
}

test("el HTML construido no lleva NI UNA magnitud meteorológica dentro (ADR-01)", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  for (const puerto of await cargarPuertos()) {
    const html = paginaDe(rutaPuerto(puerto));
    const secciones = [...html.matchAll(/<section id="meteo"[\s\S]*?<\/section>/gu)].map(
      (encontrado) => encontrado[0],
    );
    // Una y solo una: con dos, la primera podría estar limpia y la segunda traer el dato horneado.
    assert.equal(secciones.length, 1, `${puerto.slug}: se esperaba una sección meteo, no ${secciones.length}`);
    const seccion = secciones[0] ?? "";

    assert.equal(
      textoDe(seccion),
      TEXTO_ESTATICO_DE_METEO.replace("{PUERTO}", puerto.name),
      `${puerto.slug}: la sección meteo del HTML dice algo que no es su texto estático — si es un
       dato, se horneó en build y va a envejecer sin poder decir cuánto`,
    );

    // Un `title=` es un tooltip que se lee y un `aria-label` lo lee un lector de pantalla: mirar
    // solo el texto dejaría esa superficie sin vigilar, justo la que el recorrido e2e exige.
    assert.deepEqual(
      atributosInesperados(seccion, puerto.slug, puerto.timezone),
      [],
      `${puerto.slug}: la sección meteo esconde algo en un atributo`,
    );

    // Y ni un comentario: lo que no se ve en el texto ni en un atributo se esconde aquí.
    assert.deepEqual(
      comentariosDe(seccion),
      [],
      `${puerto.slug}: la sección meteo lleva un comentario HTML, que es donde cabe una carga de
       hidratación con la meteo dentro`,
    );

    // Y el perímetro: fuera de la sección tampoco puede haber magnitudes. Sin esto, la lista
    // blanca sería MENOS cobertura que la lista negra a la que sustituye.
    assert.doesNotMatch(
      html.replace(seccion, ""),
      MAGNITUDES_DE_METEO,
      `${puerto.slug}: hay meteo horneada FUERA de la sección`,
    );
  }
});

test("sin JavaScript, la sección meteo explica el hueco en vez de quedarse muda", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const html = paginaDe(rutaPuerto((await cargarPuertos())[0]!));

  assert.match(html, /El estado del mar todavía no ha llegado/u);
  assert.match(html, /o tu navegador no ejecuta JavaScript/u);
  // Y las atribuciones no dependen de que la petición salga: son HTML estático.
  assert.match(html, /<a href="https:\/\/open-meteo\.com\/">Open-Meteo<\/a> · CC-BY-4\.0/u);
  assert.match(html, /AEMET — Agencia Estatal de Meteorología<\/a> · Uso condicionado/u);
});

/**
 * RE-APUNTADO en T-12, no relajado.
 *
 * Hasta T-11 la página de puerto servía exactamente dos `<script>`: el JSON-LD (que son datos) y la
 * isla meteo. La PWA añade **uno** —el de `src/pwa/cliente/montar.ts`, declarado en
 * `src/scripts-de-core.ts`—, así que lo que se comprueba ya no es un número escrito a mano sino
 * que cada script servido tenga un dueño declarado: o es dato, o es la isla de un módulo del
 * registry, o es un script de core del registro. Lo que no cambia ni un ápice: los índices
 * geográficos siguen en **cero** JavaScript.
 */
test("cada JavaScript de una página de puerto tiene dueño declarado; los índices siguen en cero", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const html = paginaDe(rutaPuerto((await cargarPuertos())[0]!));
  const scripts = [...html.matchAll(/<script[^>]*>/gu)].map((encontrado) => encontrado[0]);
  const islas = activeModules
    .flatMap((modulo) => modulo.pageSections ?? [])
    .filter((seccion) => seccion.renderMode === "island").length;

  assert.equal(
    scripts.length,
    1 + islas + scriptsDeCoreEn(true),
    `scripts inesperados en la página: ${scripts.join(" ")}`,
  );
  assert.match(scripts[0] ?? "", /type="application\/ld\+json"/u, "el JSON-LD son datos, no código");
  assert.match(scripts[1] ?? "", /src="\/_astro\/Meteo\.astro[^"]*\.js"/u, "la isla del módulo meteo");
  assert.match(scripts[2] ?? "", /src="\/_astro\/index\.astro[^"]*\.js"/u, "el script de core de la PWA");

  // Los índices geográficos no tienen módulos ni PWA: siguen con cero JavaScript.
  assert.equal([...paginaDe(RUTA_MAREAS).matchAll(/<script[^>]*src=/gu)].length, 0);
  assert.equal(scriptsDeCoreEn(false), 0, "un script de core en los índices rompería su cero-JS");
});

/**
 * **El gate de T-14B por el lado de la portada.**
 *
 * La forma de fallar de esto no es «no aparece la calidad»: es que aparezca en 148 de los 153 y
 * nadie lo note. Por eso la lista se **recalcula desde el catálogo** en cada corrida —nada de una
 * constante que haya que acordarse de subir cuando entre un puerto nuevo— y el rojo **nombra el
 * puerto**: «esperaba 153, había 148» obliga a investigar; «la-manga-del-mar-menor: la entrada no
 * dice “estimada”» ya ha hecho el trabajo.
 *
 * Y mira el HTML de `dist/`, que es el artefacto que se sirve, no la función que lo genera: entre
 * una y otro está el renderizado, que es donde una condición mal escrita deja la señal fuera de
 * unas cuantas entradas sin que ningún test de componente se entere.
 */
test("la portada dice de TODOS los puertos si su marea está medida o estimada", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const html = readFileSync(PORTADA, "utf8");
  const fallos: string[] = [];
  for (const puerto of await cargarPuertos()) {
    const entrada = entradaDelIndice(html, rutaPuerto(puerto));
    if (entrada === undefined) {
      fallos.push(`${puerto.slug}: no tiene entrada en la portada`);
      continue;
    }
    const palabra = puerto.quality.estimated ? "estimada" : "medida";
    if (!entrada.includes(`<span class="indice__calidad">${palabra}</span>`)) {
      fallos.push(`${puerto.slug}: su entrada de la portada no dice «${palabra}»`);
    }
    // Sin el `data-estimado` la señal se lee pero el filtro no alcanza a la entrada: quedaría
    // visible en «Solo los medidos» siendo estimada, que es peor que no filtrar.
    if (!entrada.includes(`data-estimado="${String(puerto.quality.estimated)}"`)) {
      fallos.push(`${puerto.slug}: su entrada no lleva data-estimado, el filtro no la alcanza`);
    }
  }
  assert.deepEqual(fallos, [], "puertos sin la calidad publicada en la portada");
});

/**
 * **El gate del arreglo de H-1: las otras dos listas de puertos del portal.**
 *
 * El pase adversario de T-14B midió que la señal existía en **una sola página del sitio**: la
 * portada. Las otras dos familias de listas —las 12 de región y las 24 de provincia, que son la
 * ruta que la propia portada llama canónica— presentaban los 153 puertos planos, así que el último
 * clic antes de la ficha se daba a ciegas (en Pontevedra, Vigo y Baiona idénticos).
 *
 * Se comprueba puerto a puerto y en las **dos** páginas donde aparece cada uno, con el rojo
 * nombrando el puerto y la página: la forma de fallar de esto no es que la señal desaparezca, es
 * que se quede fuera de una familia de páginas —o de una provincia— y nadie lo note.
 *
 * No se exige aquí el `data-estimado`: en estas páginas no hay filtro al que sirva de asidero (ver
 * `design-brief.md` §7 quater), y gatear un atributo que no gobierna nada sería gatear la forma en
 * vez de la promesa. Lo que se exige es la **palabra**, que es lo que se lee al elegir.
 */
test("los índices de región y de provincia dicen de TODOS los puertos si su marea está medida", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const fallos: string[] = [];
  for (const region of await cargarCatalogo()) {
    const paginas = new Map([[rutaRegion(region.slug), paginaDe(rutaRegion(region.slug))]]);
    for (const provincia of region.provincias) {
      const ruta = rutaProvincia(region.slug, provincia.slug);
      paginas.set(ruta, paginaDe(ruta));
    }
    for (const provincia of region.provincias) {
      for (const puerto of provincia.puertos) {
        const palabra = puerto.quality.estimated ? "estimada" : "medida";
        for (const ruta of [rutaRegion(region.slug), rutaProvincia(region.slug, provincia.slug)]) {
          const entrada = entradaDelIndice(paginas.get(ruta) ?? "", rutaPuerto(puerto));
          if (entrada === undefined) {
            fallos.push(`${puerto.slug}: no tiene entrada en ${ruta}`);
          } else if (!entrada.includes(`<span class="indice__calidad">${palabra}</span>`)) {
            fallos.push(`${puerto.slug}: su entrada de ${ruta} no dice «${palabra}»`);
          }
        }
      }
    }
  }
  assert.deepEqual(fallos, [], "puertos que se siguen eligiendo a ciegas en los índices geográficos");
});

/**
 * Las cuentas del filtro y las de cada región salen del catálogo, no de la memoria de nadie.
 *
 * Son las dos cifras que se pueden quedar viejas sin que se rompa nada visible: la del filtro
 * («Solo los medidos 33») porque es texto, y las de la región (`data-medidos`, `data-estimados`)
 * porque solo se notan cuando valen cero — es lo que hace desaparecer el rótulo de una región que
 * se ha quedado sin puertos al filtrar. Un cero de menos deja un encabezado sobre una lista vacía;
 * un cero de más esconde una región entera.
 */
test("las cuentas del filtro de calidad de la portada las manda el catálogo", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const html = readFileSync(PORTADA, "utf8");
  const regiones = await cargarCatalogo();
  const puertos = regiones.flatMap(puertosDeRegion);
  const estimados = puertos.filter((puerto) => puerto.quality.estimated).length;

  const cuentas = [...html.matchAll(/<span class="filtro__cuenta">(\d+)<\/span>/gu)].map(
    (encontrado) => Number(encontrado[1]),
  );
  assert.deepEqual(
    cuentas,
    [puertos.length, puertos.length - estimados, estimados],
    "las opciones del filtro (todos · medidos · estimados) no cuentan lo que hay en el catálogo",
  );

  const desajustes: string[] = [];
  for (const region of regiones) {
    const suyos = puertosDeRegion(region);
    const suyosEstimados = suyos.filter((puerto) => puerto.quality.estimated).length;
    const seccion = new RegExp(
      `<section class="grupo" aria-labelledby="region-${region.slug}" ` +
        `data-estimados="(\\d+)" data-medidos="(\\d+)"`,
      "u",
    ).exec(html);
    if (seccion === null) {
      desajustes.push(`${region.slug}: su bloque no publica las cuentas de calidad`);
      continue;
    }
    if (Number(seccion[1]) !== suyosEstimados) {
      desajustes.push(`${region.slug}: dice ${seccion[1]} estimados y tiene ${suyosEstimados}`);
    }
    if (Number(seccion[2]) !== suyos.length - suyosEstimados) {
      desajustes.push(
        `${region.slug}: dice ${seccion[2]} medidos y tiene ${suyos.length - suyosEstimados}`,
      );
    }
  }
  assert.deepEqual(desajustes, [], "las cuentas por región no cuadran con el catálogo");
});
