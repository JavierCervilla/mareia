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

import { cargarCatalogo, cargarPuertos, puertosDeRegion } from "./datos/catalogo.ts";
import { cargarDatosDePuerto } from "./datos/pagina-puerto.ts";
import { diasDelMes } from "./datos/fecha-build.ts";
import { hora, metros } from "./formato.ts";
import { RUTA_MAREAS, rutaProvincia, rutaPuerto, rutaRegion } from "./rutas.ts";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PORTADA = join(DIST, "index.html");
const HAY_BUILD = existsSync(PORTADA);
const SIN_BUILD = "no hay apps/web/dist: corre antes `pnpm --filter web build`";

/** El HTML construido de una ruta del sitio (`/mareas/…/` → `dist/mareas/…/index.html`). */
function paginaDe(ruta: string): string {
  return readFileSync(join(DIST, ruta, "index.html"), "utf8");
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

test("el único JavaScript de una página de puerto es la isla meteo: el core sigue sin JS", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const html = paginaDe(rutaPuerto((await cargarPuertos())[0]!));
  const scripts = [...html.matchAll(/<script[^>]*>/gu)].map((encontrado) => encontrado[0]);

  assert.equal(scripts.length, 2, `scripts inesperados en la página: ${scripts.join(" ")}`);
  assert.match(scripts[0] ?? "", /type="application\/ld\+json"/u, "el JSON-LD son datos, no código");
  assert.match(scripts[1] ?? "", /src="\/_astro\/Meteo\.astro[^"]*\.js"/u);

  // Los índices geográficos no tienen módulos: siguen con cero JavaScript.
  assert.equal([...paginaDe(RUTA_MAREAS).matchAll(/<script[^>]*src=/gu)].length, 0);
});
