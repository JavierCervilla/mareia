/**
 * La ficha de especie **tal y como se publica**: contra el `dist/`, las 86 páginas, y contra los
 * datasets de los que sale.
 *
 * Un test sobre la función que compone la ficha demuestra la función. Lo que le cuesta algo a quien
 * lee es lo que llega **al HTML**, y entre una cosa y otra hay una plantilla que puede olvidarse de
 * pintar una nota al pie o dejar una fila en blanco sin que ninguna función se entere. Los cuatro
 * gates de este carril se miden aquí:
 *
 * - **F1 · la nota viaja con la cifra, también aquí.** Es el importante. La ficha es una **tercera**
 *   superficie para la misma cifra legal: T-19 construyó un gate para que la nota fuera pegada en
 *   las 153 páginas de puerto, el catálogo de T-20 la reintrodujo como defecto y hubo que arreglarlo
 *   tras un pase adversario. Ésta **nace con el gate puesto**, y el gate exige el **texto entero**
 *   de la nota —no la marca— **en el bloque de su cifra**, no en cualquier sitio de la página.
 * - **F2 · ninguna foto sin autor y licencia visibles junto a ella**, en su misma `<figure>` y nunca
 *   en un pie global: en la muestra de 12 ficheros del plan hay **seis licencias distintas**, así
 *   que un pie único sería falso para cinco de ellas. Desde la enmienda del 2026-08-31, el autor
 *   puede faltar **sólo** si la foto declara `atribucionRequerida: false` —y entonces la figura
 *   tiene que decir que Commons no registra autor, no callarlo—; con `true` y sin autor, rojo. Y
 *   una foto **prestada de otra especie** tiene que publicar su rótulo dentro de la misma figura:
 *   la imagen de otro animal sin decir de cuál es peor que no publicar ninguna.
 * - **F3 · ningún hueco mudo**: las nueve filas de la retícula se publican en las 86 fichas, en su
 *   orden, y **todo campo vacío publica su motivo**. Es la regla que hace útil un pokédex: un campo
 *   vacío es visible y dice «esto no lo sabemos».
 * - **F4 · nada de puntuar**, medido **sobre el artefacto y no sobre la intención**: ni barras, ni
 *   estrellas, ni rareza, ni dificultad, ni ordenación por «mejores».
 *
 * **Se mide una página por caso, no una página.** En T-19 el trinquete miraba una sola página y se
 * escapó un desbordamiento en 80 puertos: los gates de aquí barren las 86 y, además, hay pruebas
 * nombradas para los casos que se leen distinto —una ficha con nota al pie, una de género, una
 * canaria con nombre local, una sin él, una con foto y una sin—.
 *
 * Sin `dist/` se salta en vez de dar un rojo falso: CI construye antes de testear (job `web`).
 */

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AQUI_NO_SE_PUNTUA_NADA,
  CAMPOS_DE_LA_FICHA,
  DOMINIO_PUBLICO_SIN_CONDICIONES,
  fotoDeLaPrimeraEspecieDeLaFila,
  fotoDeUnaEspecieDelGenero,
  FUERA_DEL_ANEXO_III,
  LA_FOTO_NO_IDENTIFICA,
  PRESTAMO_LA_PRIMERA_DE_LA_FILA,
  PRESTAMO_UNA_DEL_GENERO,
  SIN_DATASET_DE_FOTOS,
} from "@mareia/module-species";
import { NO_AUTORIZA_A_PESCAR } from "@mareia/module-protected-areas";

import { DATA_DIR } from "./datos/deps.ts";
import { cargarCatalogoDeEspecies } from "./modulos/especies/catalogo.ts";
import { cargarFotos } from "./modulos/especies/fotos.ts";
import { rutaFichaDeEspecie } from "./rutas.ts";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIST = join(AQUI, "..", "dist");
const PORTADA = join(DIST, "index.html");
const CATALOGO = join(DIST, "pesca", "especies", "index.html");
const HOJA = join(AQUI, "estilos", "ficha-especie.css");
const HAY_BUILD = existsSync(PORTADA);
const SIN_BUILD = "no hay apps/web/dist: corre antes `pnpm --filter web build`";

/** Lo que el navegador leería: sin marcado y con las entidades resueltas. */
function textoDe(fragmento: string): string {
  return fragmento
    .replace(/<[^>]*>/gu, " ")
    .replace(/&#(\d+);/gu, (_, codigo: string) => String.fromCodePoint(Number(codigo)))
    .replace(/&#39;/gu, "'")
    .replace(/&quot;/gu, '"')
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * El rótulo que la ficha tiene que publicar de una foto prestada, o `undefined` si el tipo de
 * préstamo no es ninguno de los que la página sabe explicar.
 *
 * Se escribe aquí y no se importa ya resuelto a propósito: el gate mide **lo que llega al HTML**
 * contra lo que el dataset dice que debería llegar, y si preguntase por el rótulo a la misma
 * función que lo compone estaría comprobando que una función es igual a sí misma.
 */
function rotuloDelPrestamo(tipo: string, nombre: string, nombreBoe: string): string | undefined {
  if (tipo === PRESTAMO_UNA_DEL_GENERO) return fotoDeUnaEspecieDelGenero(nombre, nombreBoe);
  if (tipo === PRESTAMO_LA_PRIMERA_DE_LA_FILA) {
    return fotoDeLaPrimeraEspecieDeLaFila(nombre, nombreBoe);
  }
  return undefined;
}

/** El HTML de la ficha de una especie, por su clave. */
function fichaDe(clave: string): string {
  return readFileSync(join(DIST, rutaFichaDeEspecie(clave), "index.html"), "utf8");
}

/**
 * La sección de un campo de la retícula, con su marcado.
 *
 * Se acota por `data-campo` y no por el rótulo: el rótulo es texto que puede cambiar en un commit
 * de redacción, y el identificador es el contrato entre la plantilla y este gate.
 */
function campoDe(html: string, id: string): string | undefined {
  const marca = html.indexOf(`data-campo="${id}"`);
  if (marca === -1) return undefined;
  const abre = html.lastIndexOf("<section", marca);
  const cierra = html.indexOf("</section>", marca);
  return abre === -1 || cierra === -1 ? undefined : html.slice(abre, cierra);
}

/** Los bloques `<li>` de un campo: uno por caladero. */
function bloquesDeCaladero(campo: string): readonly string[] {
  return [...campo.matchAll(/<li class="ficha__caladero">([\s\S]*?)<\/li>/gu)].map(
    (bloque) => bloque[1] ?? "",
  );
}

/** Los bloques de una talla dentro de un caladero: la cifra, el literal del BOE y **sus notas**. */
function bloquesDeTalla(caladero: string): readonly string[] {
  return [...caladero.matchAll(/<div class="ficha__talla">([\s\S]*?)<\/div>/gu)].map(
    (bloque) => bloque[1] ?? "",
  );
}

/** El literal de las notas de cada anexo, leído del derivado de la norma **sin intermediarios**. */
function notasDeLaNorma(): Map<string, Map<string, string>> {
  const norma = JSON.parse(readFileSync(`${DATA_DIR}/normativa/tallas-minimas.json`, "utf8")) as {
    caladeros: readonly {
      id: string;
      notas: readonly { marca: string; texto: string }[];
    }[];
  };
  return new Map(
    norma.caladeros.map((caladero) => [
      caladero.id,
      new Map(caladero.notas.map((nota) => [nota.marca, nota.texto])),
    ]),
  );
}

// =================================================================================================
// EL GATE F1 · la nota viaja con la cifra, también aquí
// =================================================================================================
//
// **Nace con la página y no después de un pase adversario**, que es la diferencia con T-20. Dos
// cosas lo hacen medir de verdad, y las dos son la lección de las dos superficies anteriores:
//
// - **El texto entero, no la marca.** Es lo que convierte 36 en 44, y un gate que se conformara con
//   el asterisco aprobaría exactamente el defecto que persigue.
// - **En el bloque de la cifra**, no en la página ni en la fila: quien copia una talla se lleva lo
//   que hay pegado a ella, y un pie al final de la página no viaja ni lo oye quien recorre la ficha
//   con un lector de pantalla. Por eso se busca dentro del `<div class="ficha__talla">` de esa
//   cifra, identificado por el literal que el BOE imprime.
//
// El texto de las notas se lee de `normativa/v1` **por su propia cuenta**: si el gate las pidiera
// por donde las pide la página, un fallo en esa resolución se confirmaría a sí mismo.

test("F1 · toda cifra legal de una ficha publica, en el bloque de su cifra, la nota ENTERA", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const catalogo = await cargarCatalogoDeEspecies();
  const notas = notasDeLaNorma();
  const mudas: string[] = [];
  let comprobadas = 0;
  for (const especie of catalogo.especies) {
    const campo = campoDe(fichaDe(especie.clave), "tallas") ?? "";
    const bloques = bloquesDeCaladero(campo);
    for (const caladero of especie.caladeros) {
      const suBloque =
        bloques.find((candidato) => textoDe(candidato).includes(caladero.nombre)) ?? "";
      const tallas = bloquesDeTalla(suBloque);
      for (const talla of caladero.tallas) {
        if (talla.notas.length === 0) continue;
        // El bloque de ESTA cifra, identificado por el literal que el BOE imprime en su celda.
        const bloque =
          tallas.find((candidato) =>
            textoDe(candidato).includes(`el BOE imprime «${talla.textoOriginal}»`),
          ) ?? "";
        for (const marca of talla.notas.map((nota) => nota.marca)) {
          const texto = notas.get(caladero.id)?.get(marca);
          assert.ok(
            texto !== undefined,
            `${especie.nombreBoe} · ${caladero.nombre}: la marca ${marca} no existe en el anexo`,
          );
          comprobadas += 1;
          if (!textoDe(bloque).includes(texto)) {
            mudas.push(
              `${especie.nombreBoe} · ${caladero.nombre} · «${talla.textoOriginal}» → falta ` +
                `«${texto.slice(0, 70)}…» en el bloque de su cifra`,
            );
          }
        }
      }
    }
  }
  assert.deepEqual(
    mudas,
    [],
    "cifras legales publicadas en una ficha sin la excepción que la norma les pone en el mismo " +
      "bloque. La página de puerto y el catálogo del mismo `dist/` sí la publican, así que el " +
      "sitio se contradice consigo mismo sobre una cifra que se cita en una inspección",
  );
  // Nueve tallas del dataset llevan nota y cada una vive en una ficha distinta. Si el número baja,
  // alguien ha dejado de pintar una nota; si sube, la norma ha cambiado y hay que mirarlo.
  assert.equal(comprobadas, 9, "no se han comprobado las nueve cifras con excepción del dataset");
  t.diagnostic(`${comprobadas} cifras con excepción, todas con su nota entera en su bloque`);
});

test("F1 · la lubina publica 36 cm y, en el mismo bloque, los 44 de las divisiones 8a y 8b", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  // El caso concreto, escrito a mano porque es el que se cita: es la nota de mayor diferencia del
  // Anexo I. Un gate que sólo recorre el dataset se queda en verde el día que el dataset pierda la
  // nota; éste dice qué tiene que leerse en la página.
  const campo = campoDe(fichaDe("dicentrarchus-labrax-7ff4d6"), "tallas") ?? "";
  const cantabrico =
    bloquesDeCaladero(campo).find((bloque) => textoDe(bloque).includes("Cantábrico")) ?? "";
  const bloque =
    bloquesDeTalla(cantabrico).find((candidato) => textoDe(candidato).includes("36")) ?? "";
  const leido = textoDe(bloque);
  assert.match(leido, /36\s*cm/u, "la ficha de la lubina no publica sus 36 cm");
  assert.match(leido, /divisiones 8a y 8b/u, "la excepción no está en el bloque de la cifra");
  assert.match(leido, /44 centímetros/u, "la excepción no dice cuál es la otra cifra");
});

test("F1 · ninguna marca impresa en una ficha se queda sin el pie al que llama", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const catalogo = await cargarCatalogoDeEspecies();
  const notas = notasDeLaNorma();
  const huerfanas: string[] = [];
  let impresas = 0;
  for (const especie of catalogo.especies) {
    const leido = textoDe(fichaDe(especie.clave));
    for (const caladero of especie.caladeros) {
      for (const talla of caladero.tallas) {
        for (const marca of talla.notas.map((nota) => nota.marca)) {
          // Sólo cuenta la marca que la página IMPRIME, dentro del literal citado de la celda. Una
          // llamada sin pie es la propia página avisando de que ahí falta algo y no diciendo qué.
          if (!talla.textoOriginal.includes(marca)) continue;
          if (!leido.includes(`el BOE imprime «${talla.textoOriginal}»`)) continue;
          impresas += 1;
          const texto = notas.get(caladero.id)?.get(marca) ?? "";
          if (texto === "" || !leido.includes(texto)) {
            huerfanas.push(`${especie.nombreBoe} · ${caladero.nombre} · ${marca}`);
          }
        }
      }
    }
  }
  assert.deepEqual(huerfanas, [], "marcas de nota impresas sin ningún pie que las explique");
  assert.ok(impresas > 0, "ninguna ficha imprime una marca: el gate no está mirando nada");
  t.diagnostic(`${impresas} marcas impresas en fichas, todas con su pie`);
});

// =================================================================================================
// EL GATE F2 · ninguna foto sin autor y licencia junto a ella
// =================================================================================================

test("F2 · toda foto publicada lleva su autor y su licencia en su misma figura", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const fotos = await cargarFotos();
  if (fotos.tipo === "sin_dataset") {
    t.skip("data/especies/fotos.json todavía no está en el build: lo mide el otro caso de F2");
    return;
  }
  const catalogo = await cargarCatalogoDeEspecies();
  const desnudas: string[] = [];
  let comprobadas = 0;
  let prestadas = 0;
  for (const especie of catalogo.especies) {
    const html = fichaDe(especie.clave);
    const figuras = [...html.matchAll(/<figure class="ficha__figura">([\s\S]*?)<\/figure>/gu)].map(
      (figura) => figura[1] ?? "",
    );
    const esperada = fotos.porClave.get(especie.clave);
    if (esperada === undefined || esperada.tipo === "hueco") {
      // Sin foto en el dataset no puede haber imagen en la página: una foto que no sale de la
      // ingesta es una foto sin procedencia.
      if (/<img\b/u.test(html)) desnudas.push(`${especie.nombreBoe}: publica imagen sin dataset`);
      continue;
    }
    assert.equal(figuras.length, 1, `${especie.nombreBoe}: debería publicar una figura y una sola`);
    const figura = figuras[0] ?? "";
    const leido = textoDe(figura);
    comprobadas += 1;
    // AUTOR Y LICENCIA, los dos, dentro de la figura. No «en la página»: un pie global sería falso
    // —hay seis licencias distintas en la muestra de 12 ficheros del plan— y además no viaja con la
    // imagen que alguien copia.
    //
    // El autor es condicional desde la enmienda del 2026-08-31, y las dos ramas se miden. Con
    // atribución exigida, el nombre tiene que estar. Sin ella, lo que tiene que estar es la frase
    // que dice que Commons no registra ninguno: una figura que se limitara a no poner crédito
    // parecería una foto nuestra, que es la tercera forma de no acreditar a nadie.
    const autor = esperada.valor.autor;
    if (autor === undefined) {
      if (esperada.valor.atribucionRequerida) {
        desnudas.push(
          `${especie.nombreBoe}: publica una foto sin autor que declara exigir atribución`,
        );
      }
      // **Literales, y no `creditoSinAutor(...)`.** Comprobar la página contra la misma función que
      // la escribe sólo puede demostrar que el código es igual a sí mismo: hallazgo A-T23-2 del pase
      // adversario, reproducido vaciando esa función —la página se quedó en «Foto · Public domain»,
      // sin decir una palabra de autoría, y este gate siguió verde porque su expectativa se vació
      // con ella—. Es el defecto de E4 en T-20 en otro sitio. La duplicación de la frase aquí es el
      // precio de que el gate sea independiente, y es el mismo trato que hace E6 al recomputar la
      // consulta en vez de leerla.
      for (const exigido of ["Sin autor acreditado", "no registra quién hizo esta foto"]) {
        if (!leido.includes(exigido)) {
          desnudas.push(
            `${especie.nombreBoe}: la figura no dice que su fuente no registra autor (falta ` +
              `«${exigido}»)`,
          );
        }
      }
    } else if (!leido.includes(autor)) {
      desnudas.push(`${especie.nombreBoe}: la figura no publica el autor`);
    }
    if (!leido.includes(esperada.valor.licencia)) {
      desnudas.push(`${especie.nombreBoe}: la figura no publica la licencia`);
    }
    // DE QUÉ ANIMAL ES LA FOTO cuando no es del taxón de la fila. Se exige el rótulo entero —no
    // sólo el nombre de la especie— porque el nombre suelto no explica por qué está ahí, y lo que
    // hace legítimo el préstamo es que la elección la haya hecho la norma y se diga.
    const prestada = esperada.valor.prestadaDe;
    if (prestada !== undefined) {
      prestadas += 1;
      const rotulo = rotuloDelPrestamo(prestada.tipo, prestada.nombre, prestada.nombreBoe);
      if (rotulo === undefined || !leido.includes(textoDe(rotulo))) {
        desnudas.push(`${especie.nombreBoe}: publica una foto de otra especie sin decir de cuál`);
      }
      // Y el `alt` nombra el taxón de la foto, no el de la fila: es la única frase que tiene quien
      // no puede ver la imagen, y decirle que es de otro animal sería mentirle sólo a él.
      if (!figura.includes(`alt="Fotografía que ${esperada.valor.identificadaPor.fuente}`)) {
        desnudas.push(`${especie.nombreBoe}: la figura no dice en el alt quién asocia la imagen`);
      }
      if (!figura.includes(prestada.nombre)) {
        desnudas.push(`${especie.nombreBoe}: el alt de una foto prestada nombra el taxón de la fila`);
      }
    }
    // Y la imagen que se publica es la del dataset, no otra.
    if (!figura.includes(`src="${esperada.valor.url}"`)) {
      desnudas.push(`${especie.nombreBoe}: la imagen no es la del dataset`);
    }
    // La identificación no es nuestra y se dice: publicar la foto sin eso convierte una decisión
    // editorial de Wikidata en una afirmación nuestra sobre qué animal es ése.
    if (!leido.includes(esperada.valor.identificadaPor.entidad)) {
      desnudas.push(`${especie.nombreBoe}: la figura no dice quién identificó la foto`);
    }
    if (!leido.includes(textoDe(LA_FOTO_NO_IDENTIFICA))) {
      desnudas.push(`${especie.nombreBoe}: la figura no avisa de que una foto no identifica`);
    }
    // NINGÚN CRÉDITO QUE NO LLEVE A NINGUNA PARTE. La página del fichero es obligatoria en toda
    // foto: es donde se comprueba el crédito sin fiarse de esta página, y es lo único que ofrece
    // una foto de dominio público EN LUGAR de la URL de condiciones que no tiene.
    if (!figura.includes(`href="${esperada.valor.descripcion}"`)) {
      desnudas.push(`${especie.nombreBoe}: la figura no enlaza la página del fichero`);
    }
    // Y la licencia, por la rama que le toque: enlazada a su texto cuando tiene condiciones, dicha
    // como estado cuando no las tiene. Nunca callada, y nunca un enlace a la nada.
    const licenciaUrl = esperada.valor.licenciaUrl;
    if (licenciaUrl === undefined) {
      if (!leido.includes(textoDe(DOMINIO_PUBLICO_SIN_CONDICIONES))) {
        desnudas.push(`${especie.nombreBoe}: la figura no dice que no hay condiciones que enlazar`);
      }
    } else if (!figura.includes(`href="${licenciaUrl}"`)) {
      desnudas.push(`${especie.nombreBoe}: la figura no enlaza el texto de la licencia`);
    }
  }
  assert.deepEqual(desnudas, [], "fotos publicadas sin su crédito pegado a ellas");
  assert.ok(comprobadas > 0, "ninguna foto medida: el gate no está mirando nada");
  t.diagnostic(
    `${comprobadas} fotos publicadas con su crédito en la figura, ${prestadas} de ellas de otra ` +
      "especie y rotuladas",
  );
});

test("F2 · sin dataset de fotos, ninguna ficha publica imagen, y las 86 dicen por qué", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const fotos = await cargarFotos();
  if (fotos.tipo !== "sin_dataset") {
    t.skip("data/especies/fotos.json ya está en el build: lo mide el otro caso de F2");
    return;
  }
  const catalogo = await cargarCatalogoDeEspecies();
  const rotas: string[] = [];
  for (const especie of catalogo.especies) {
    const html = fichaDe(especie.clave);
    // Una imagen sin dataset es una imagen sin autor y sin licencia por construcción.
    if (/<img\b/u.test(html)) rotas.push(`${especie.nombreBoe}: publica una imagen sin dataset`);
    // Y el hueco no es mudo: dice que aún no se ha preguntado, no que la especie no tenga foto.
    if (!textoDe(html).includes(textoDe(SIN_DATASET_DE_FOTOS))) {
      rotas.push(`${especie.nombreBoe}: el hueco de la foto no publica su motivo`);
    }
  }
  assert.deepEqual(rotas, []);
  t.diagnostic(`${catalogo.especies.length} fichas sin imagen, todas con el motivo publicado`);
});

// =================================================================================================
// EL GATE F3 · ningún hueco mudo
// =================================================================================================

test("F3 · las 86 fichas publican los nueve campos de la retícula, en su orden", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const catalogo = await cargarCatalogoDeEspecies();
  const esperados = CAMPOS_DE_LA_FICHA.map((campo) => campo.id);
  for (const especie of catalogo.especies) {
    const html = fichaDe(especie.clave);
    const publicados = [...html.matchAll(/data-campo="([a-z-]+)"/gu)].map((campo) => campo[1]);
    // El orden importa tanto como la presencia: una retícula que cambia de orden entre fichas deja
    // de ser una retícula, y entonces un hueco ya no se ve por comparación con las demás.
    assert.deepEqual(publicados, esperados, `${especie.nombreBoe}: la retícula no es la de siempre`);
  }
  t.diagnostic(`${catalogo.especies.length} fichas con los ${esperados.length} campos en su orden`);
});

test("F3 · ningún campo de ninguna ficha se publica vacío: o trae dato o trae su motivo", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const catalogo = await cargarCatalogoDeEspecies();
  const mudos: string[] = [];
  let comprobados = 0;
  for (const especie of catalogo.especies) {
    const html = fichaDe(especie.clave);
    for (const campo of CAMPOS_DE_LA_FICHA) {
      const seccion = campoDe(html, campo.id);
      if (seccion === undefined) {
        mudos.push(`${especie.nombreBoe} · ${campo.id}: la sección no se publica`);
        continue;
      }
      comprobados += 1;
      // El VALOR, sin el rótulo: una sección que sólo trae su rótulo es exactamente el hueco en
      // blanco que la retícula existe para impedir, y con el rótulo dentro pasaría en verde. Se
      // quita el `<h2>` en vez de acotar el `<div>` del valor porque ese div tiene hijos —el bloque
      // de cada talla— y una expresión no ávida se pararía en el primer cierre.
      const leido = textoDe(seccion.replace(/<h2[\s\S]*?<\/h2>/u, ""));
      if (leido.length < 3) {
        mudos.push(`${especie.nombreBoe} · ${campo.id}: el campo se publica vacío`);
      }
    }
    // Y todo hueco trae un motivo escrito, no un guion ni un «—».
    for (const trozo of html.matchAll(/<p class="ficha__hueco">([\s\S]*?)<\/p>/gu)) {
      const motivo = textoDe(trozo[1] ?? "");
      if (motivo.length < 20) {
        mudos.push(`${especie.nombreBoe}: un hueco sin motivo de verdad («${motivo}»)`);
      }
    }
  }
  assert.deepEqual(
    mudos,
    [],
    "campos de la retícula publicados en blanco. Un hueco en blanco no se distingue de un fallo " +
      "nuestro; uno rotulado dice qué no sabemos, que es información",
  );
  assert.equal(comprobados, catalogo.especies.length * CAMPOS_DE_LA_FICHA.length);
  t.diagnostic(`${comprobados} campos comprobados en ${catalogo.especies.length} fichas`);
});

test("F3 · el nombre local canario reparte los tres casos y ninguno queda mudo", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const catalogo = await cargarCatalogoDeEspecies();
  // Los tres casos se cuentan del dataset y no se teclean: la norma da el nombre, la norma deja la
  // celda vacía (y el dataset dice por qué), o la especie no está en el anexo que lo escribe.
  let conNombre = 0;
  let celdaVacia = 0;
  let fueraDelAnexo = 0;
  for (const especie of catalogo.especies) {
    const campo = campoDe(fichaDe(especie.clave), "nombre-local-canario") ?? "";
    const leido = textoDe(campo);
    const esHueco = campo.includes('class="ficha__hueco"');
    if (!esHueco) {
      conNombre += 1;
      continue;
    }
    if (leido.includes(textoDe(FUERA_DEL_ANEXO_III))) fueraDelAnexo += 1;
    else celdaVacia += 1;
    assert.ok(leido.length > 40, `${especie.nombreBoe}: hueco de nombre local sin motivo`);
  }
  // Medido contra `data/normativa/tallas-minimas.json`: el Anexo III tiene 31 filas y 28 traen
  // nombre local; las otras 55 especies del catálogo no están en ese anexo.
  const enElAnexoIII = catalogo.especies.filter((especie) =>
    especie.caladeros.some((caladero) => caladero.id === "canario"),
  ).length;
  assert.equal(enElAnexoIII, 31, "el Anexo III ya no regula 31 especies: mira el dataset");
  assert.equal(conNombre, 28, "ya no son 28 las especies con nombre local canario");
  assert.equal(celdaVacia, 3, "ya no son 3 las filas del Anexo III con la celda vacía");
  assert.equal(fueraDelAnexo, catalogo.especies.length - enElAnexoIII);
  t.diagnostic(
    `${conNombre} con nombre local de ${enElAnexoIII} del Anexo III · ${celdaVacia} con la celda ` +
      `vacía · ${fueraDelAnexo} fuera del anexo`,
  );
});

test("F3 · una ficha de género dice que la talla alcanza al género entero, y una de especie no", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  // `Sepia spp`: la norma regula el género entero, y eso es un hecho jurídico que la ficha rotula.
  const genero = textoDe(campoDe(fichaDe("sepia-spp-2f3b90"), "rango") ?? "");
  assert.match(genero, /género, no especie/u, "la ficha de un género no rotula su alcance");
  assert.match(genero, /regulando el género entero/u, "la ficha de un género no glosa su alcance");
  // `Dicentrarchus labrax` es una especie: la fila responde, y **no** arrastra la glosa de los
  // géneros, que hablaría de un alcance que esta ficha no tiene.
  const especie = textoDe(campoDe(fichaDe("dicentrarchus-labrax-7ff4d6"), "rango") ?? "");
  assert.match(especie, /La norma nombra una especie/u, "la fila del rango se publica vacía");
  assert.ok(!especie.includes("regulando el género entero"), "una especie arrastra la glosa de género");
});

test("F3 · la única especie sin taxón publica su motivo en las dos filas que dependen de él", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  // `Lophius piscatorius, L. Budegassa`: dos especies en una celda del BOE. Ni se consulta a WoRMS
  // ni hay taxón del que colgar un rango, y las dos filas lo dicen en vez de quedarse en blanco.
  const html = fichaDe("lophius-piscatorius-l-budegassa-bec159");
  const taxon = textoDe(campoDe(html, "taxon") ?? "");
  const rango = textoDe(campoDe(html, "rango") ?? "");
  assert.match(taxon, /la celda nombra dos especies dentro de una sola fila/u);
  assert.match(rango, /Sin registro en WoRMS no hay rango que publicar/u);
  // Y a OBIS tampoco se le preguntó, que no es lo mismo que no tener registros.
  assert.match(textoDe(campoDe(html, "presencia") ?? ""), /A OBIS no se le ha preguntado/u);
});

// =================================================================================================
// EL GATE F4 · nada de puntuar, medido sobre el artefacto
// =================================================================================================
//
// **Mira el artefacto, no la intención.** Que el brief prohíba la gamificación del dato no impide
// que una barra entre en un commit de estilo; lo que lo impide es que el `dist/` y la hoja se midan.
//
// La página **declara** que aquí no se puntúa nada, y esa declaración nombra por fuerza lo que no
// hay («ni rareza, ni dificultad, ni puntuación…»). Para que el gate no se ponga rojo contra su
// propia promesa —ni, peor, para que nadie esconda una puntuación dentro de un aviso— las dos
// constantes de aviso se **retiran del texto** antes de buscar el vocabulario, y se comprueban
// aparte y literales.

/** Vocabulario de puntuación: si aparece en una ficha, la ficha está puntuando algo. */
const VOCABULARIO_DE_PUNTUAR = [
  "rareza",
  "dificultad",
  "puntuación",
  "puntuacion",
  "puntos",
  "mejor cebo",
  "temporada ideal",
  "ranking",
  "las mejores",
  "mejores especies",
  "más buscada",
  "nivel de",
  "★",
  "☆",
  "⭐",
];

/** Marcado con el que se dibuja una puntuación. Ninguno tiene sitio en una ficha de especie. */
const MARCADO_DE_PUNTUAR = ["<progress", "<meter", 'role="progressbar"', "aria-valuenow", "<canvas"];

test("F4 · ninguna ficha puntúa nada: ni barras, ni estrellas, ni rareza, ni dificultad", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const catalogo = await cargarCatalogoDeEspecies();
  const puntuadas: string[] = [];
  for (const especie of catalogo.especies) {
    const html = fichaDe(especie.clave);
    for (const marcado of MARCADO_DE_PUNTUAR) {
      if (html.includes(marcado)) puntuadas.push(`${especie.nombreBoe}: usa ${marcado}`);
    }
    // Los dos avisos son literales del código y se retiran antes de buscar: nombran lo que la ficha
    // NO hace, y comprobarlos aparte cierra la puerta a esconder una puntuación dentro de uno.
    const leido = textoDe(html)
      .replace(textoDe(AQUI_NO_SE_PUNTUA_NADA), "")
      .replace(textoDe(NO_AUTORIZA_A_PESCAR), "")
      .toLowerCase();
    for (const palabra of VOCABULARIO_DE_PUNTUAR) {
      if (leido.includes(palabra)) puntuadas.push(`${especie.nombreBoe}: publica «${palabra}»`);
    }
    // Una lista numerada en una ficha de especie es un ranking. La única del portal son las migas.
    const ordenadas = [...html.matchAll(/<ol\b[^>]*>/gu)].map((lista) => lista[0]);
    assert.deepEqual(
      ordenadas.filter((lista) => !lista.includes('class="migas"')),
      [],
      `${especie.nombreBoe}: publica una lista ordenada, que se lee como una clasificación`,
    );
    // Y los dos avisos están, enteros: son la promesa que el resto de este gate protege.
    assert.ok(
      textoDe(html).includes(textoDe(AQUI_NO_SE_PUNTUA_NADA)),
      `${especie.nombreBoe}: no publica que aquí no se puntúa nada`,
    );
    assert.ok(
      textoDe(html).includes(textoDe(NO_AUTORIZA_A_PESCAR)),
      `${especie.nombreBoe}: no publica que esto no autoriza a pescar`,
    );
  }
  assert.deepEqual(puntuadas, [], "fichas que le ponen al animal una magnitud que nadie ha medido");
  t.diagnostic(`${catalogo.especies.length} fichas sin ninguna puntuación`);
});

test("F4 · cero juice: la hoja de la ficha no anima, no destaca y no colorea ninguna cifra", (t) => {
  const hoja = readFileSync(HOJA, "utf8");
  // Una talla mínima no parpadea, no cuenta hacia arriba y no tiene halo. El adorno sobre una cifra
  // con consecuencia jurídica consigue que se le crea más de lo que merece.
  for (const prohibido of [
    "@keyframes",
    "animation",
    "transition",
    "box-shadow",
    "border-radius",
    "linear-gradient",
    "radial-gradient",
  ]) {
    assert.ok(!hoja.includes(prohibido), `la hoja de la ficha usa ${prohibido}`);
  }
  // La mancha de terracota, que el brief reserva al coeficiente y a los avisos, sólo puede caer en
  // el aviso. Nunca sobre una cifra ni sobre un nombre.
  const conTerracota = [...hoja.matchAll(/^\.([\w-]+)[^{]*\{[^}]*--m-terra[^}]*\}/gmu)].map(
    (coincidencia) => coincidencia[1],
  );
  assert.deepEqual(conTerracota, ["ficha__aviso"]);
  // `tabular-nums` SÓLO donde hay una magnitud: alinear como número una frase o un recuento de
  // esfuerzo de muestreo le presta una precisión que no tiene.
  const conCifras = [...hoja.matchAll(/^\.([\w-]+)[^{]*\{[^}]*font-variant-numeric[^}]*\}/gmu)].map(
    (coincidencia) => coincidencia[1],
  );
  assert.deepEqual(conCifras, ["ficha__cifra"]);
  t.diagnostic(`hoja de ficha-especie.css: ${hoja.length} bytes`);
});

// =================================================================================================
// Lo que la página promete de sí misma
// =================================================================================================

test("las fichas no traen JavaScript: sólo el JSON-LD, que son datos y no código", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const catalogo = await cargarCatalogoDeEspecies();
  for (const especie of catalogo.especies) {
    const html = fichaDe(especie.clave);
    const scripts = [...html.matchAll(/<script\b([^>]*)>/gu)].map((etiqueta) => etiqueta[1] ?? "");
    assert.deepEqual(
      scripts.filter((atributos) => !atributos.includes('type="application/ld+json"')),
      [],
      `${especie.nombreBoe}: la ficha trae JavaScript de cliente`,
    );
    assert.ok(!/\son[a-z]+=/iu.test(html), `${especie.nombreBoe}: la ficha trae un manejador en línea`);
  }
});

test("el catálogo enlaza a las 86 fichas y cada ficha vuelve al catálogo", async (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  const indice = readFileSync(CATALOGO, "utf8");
  const catalogo = await cargarCatalogoDeEspecies();
  for (const especie of catalogo.especies) {
    const ruta = rutaFichaDeEspecie(especie.clave);
    assert.ok(indice.includes(`href="${ruta}"`), `${especie.nombreBoe}: el catálogo no la enlaza`);
    // Y el enlace lleva el nombre de la norma como texto: quien lo oye con un lector de pantalla
    // oye a dónde va, y el gate E1 lo sigue encontrando literal en la fila.
    assert.ok(
      indice.includes(`<a href="${ruta}">${especie.nombreBoe}</a>`),
      `${especie.nombreBoe}: el enlace no se rotula con el nombre de la norma`,
    );
    const html = fichaDe(especie.clave);
    assert.ok(html.includes('href="/pesca/especies/"'), `${especie.nombreBoe}: no vuelve al catálogo`);
  }
  t.diagnostic(`${catalogo.especies.length} fichas enlazadas desde el catálogo y de vuelta`);
});

test("las dos grafías del atún rojo son dos fichas distintas, y cada una enlaza a la otra", (t) => {
  if (!HAY_BUILD) {
    t.skip(SIN_BUILD);
    return;
  }
  // El BOE escribe `Thunnus thynnus` en los Anexos I y II y `Thunnus Thynnus` en el III: son dos
  // nombres de la norma y por tanto dos fichas. Quien busca el atún rojo por el binomio bien escrito
  // y no ve Canarias concluye que allí no hay talla mínima; la hay, en la otra ficha, y son 6,4 kg.
  const minuscula = fichaDe("thunnus-thynnus-4b2118");
  const mayuscula = fichaDe("thunnus-thynnus-4cc84f");
  assert.ok(textoDe(minuscula).includes("Thunnus thynnus"));
  assert.ok(textoDe(mayuscula).includes("Thunnus Thynnus"));
  assert.ok(minuscula.includes(`href="${rutaFichaDeEspecie("thunnus-thynnus-4cc84f")}"`));
  assert.ok(mayuscula.includes(`href="${rutaFichaDeEspecie("thunnus-thynnus-4b2118")}"`));
  // Y la talla canaria está donde el BOE la escribe: en la ficha de la T mayúscula.
  assert.match(textoDe(mayuscula), /6,4\s*kg/u, "la ficha del Anexo III no publica su talla en kilos");
});
