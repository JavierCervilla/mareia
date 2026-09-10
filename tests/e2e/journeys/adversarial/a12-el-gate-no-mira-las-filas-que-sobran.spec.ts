/**
 * **A12 · el trinquete de T-34 cuenta las filas que espera y no mira las que sobran.**
 *
 * El gate del `dist/` (`apps/web/src/error-en-listas-construido.test.ts`) hace, por cada una de las
 * 37 páginas de lista, esto:
 *
 * 1. lee las entradas de la página a un `Map<nombre, cifra>` con `publicadas.set(...)`;
 * 2. **itera los puertos que el catálogo dice que van en esa página** y le pide su cifra al `Map`.
 *
 * De ahí salen dos huecos, y los dos dejan publicar una cifra que nadie compara con el dataset:
 *
 * * **La fila que sobra.** Un puerto que no está entre los esperados de esa página no se consulta
 *   nunca. Una entrada de Baiona —de las 118 sin medida, y encima de otra provincia— plantada en la
 *   lista de Illes Balears con un `±3 cm` inventado se publica entera: el gate sólo pregunta por
 *   los 17 puertos baleares, y ninguno se llama Baiona.
 * * **La fila duplicada.** El `Map` se llena con `set`, así que **gana la última**. Dos entradas
 *   con el mismo nombre y la falsa delante dejan al gate leyendo la buena mientras el lector, que
 *   lee de arriba abajo, ve la falsa. No hace falta que el catálogo tenga nombres repetidos —no los
 *   tiene: 153 nombres distintos, comprobado— basta con que una página los repita.
 *
 * Los dos rompen la mitad de la promesa que el propio gate se propuso sostener: *«**ninguno** sin
 * medida publica una [cifra]. Un «±0 cm» o un guion en los 118 sin observaciones se leería como una
 * predicción perfecta»*. El gate afirma «ninguno» y comprueba «ninguno **de los que yo esperaba
 * aquí**», que no es lo mismo. Es la lección de A-T23-2 en otra forma: un gate que deriva del
 * catálogo **a quién** preguntar no se entera de quién más está contestando.
 *
 * El assert pide el comportamiento correcto —una cifra inventada en una de las tres listas pone
 * algo en rojo, da igual quién la cace— y no el síntoma, así que el día que el gate mire también
 * las filas que no esperaba, este recorrido pasa solo.
 *
 * **Método.** Cero mutaciones del árbol de trabajo: el `dist/` saboteado se escribe en un **espejo
 * efímero** en `/tmp` (los dos ficheros que el gate importa, un enlace simbólico al `data/` real y
 * una copia del `dist/`), y el gate se corre allí con su propio `cwd`. Antes de cada ataque se
 * corre el gate sobre el espejo intacto y se exige **verde**, y después se le cambia la cifra a una
 * fila legítima y se exige **rojo**: sin esas dos medidas, un verde no distinguiría «el gate no lo
 * ve» de «el gate no ha corrido».
 */

import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "../../fixtures/qa-bundle";

import { gateDeT34, PEGADO } from "./utiles-error-en-listas.ts";
import { RAIZ } from "./utiles.ts";

/** La lista atacada: la de la provincia de Illes Balears, 17 puertos y 6 de ellos medidos. */
const PAGINA = join("mareas", "illes-balears", "illes-balears", "index.html");

/** El puerto medido cuya fila se duplica, y cuya cifra se toca para comprobar que el gate vive. */
const MEDIDO = {
  nombre: "Mahón",
  ruta: "/mareas/illes-balears/illes-balears/mahon/",
  cifra: `±4${PEGADO}cm`,
} as const;

/**
 * Una entrada de índice **byte a byte como la construye `Indice.astro`** en una página de
 * provincia. Que sea idéntica no es coquetería: es lo que hace que el ataque no dependa de que el
 * patrón del gate sea laxo con los atributos, y lo que permite usar la misma función para localizar
 * la fila legítima y para plantar la falsa.
 */
function filaDeIndice(nombre: string, ruta: string, cifra: string): string {
  return (
    `<li class="indice__entrada" data-estimado="false">` +
    `<a class="indice__enlace" href="${ruta}">` +
    `<span class="indice__nombre">${nombre}</span>` +
    `<span class="indice__meta">Europe/Madrid · <span class="indice__calidad">medida</span>` +
    ` · <span class="indice__error">${cifra}</span></span></a></li>`
  );
}

/** La fila legítima del puerto medido, tal cual está hoy en el `dist/`. */
const FILA_BUENA = filaDeIndice(MEDIDO.nombre, MEDIDO.ruta, MEDIDO.cifra);

/**
 * Un espejo efímero del árbol con lo justo para correr el gate: los dos ficheros que importa, el
 * `data/` real enlazado (se lee, nunca se escribe) y una copia del `dist/` que sí se sabotea.
 */
function espejoDelDist(): string {
  const espejo = mkdtempSync(join(tmpdir(), "a-t34-espejo-"));
  mkdirSync(join(espejo, "apps", "web", "src"), { recursive: true });
  symlinkSync(join(RAIZ, "data"), join(espejo, "data"));
  for (const fichero of ["error-en-listas-construido.test.ts", "formato.ts"]) {
    cpSync(join(RAIZ, "apps", "web", "src", fichero), join(espejo, "apps", "web", "src", fichero));
  }
  cpSync(join(RAIZ, "apps", "web", "dist"), join(espejo, "apps", "web", "dist"), {
    recursive: true,
  });
  return espejo;
}

const ATAQUES = [
  {
    nombre: "una fila de un puerto que no toca en esta lista, con una cifra inventada",
    plantada: filaDeIndice("Baiona", "/mareas/galicia/pontevedra/baiona/", `±3${PEGADO}cm`),
    dano: "Baiona (sin medida, y de otra provincia) publica «±3 cm» en la lista de Illes Balears",
  },
  {
    nombre: "una segunda fila del mismo puerto, con otra cifra y por delante de la buena",
    plantada: filaDeIndice(MEDIDO.nombre, MEDIDO.ruta, `±99${PEGADO}cm`),
    dano: `${MEDIDO.nombre} publica «±99 cm» arriba y «±4 cm» abajo; el lector ve la primera`,
  },
] as const;

for (const ataque of ATAQUES) {
  test(`A12 · plantar ${ataque.nombre} tiene que poner algo en rojo`, async ({ qa }) => {
    // ARREGLADO (T-34). El gate ya no itera lo esperado preguntándole a un `Map`: juzga **cada fila
    // publicada** —emparejada por su `href`, que lo construye el catálogo y es único— y además
    // rechaza que un puerto salga dos veces en la misma página. El `test.fail()` se ha retirado y
    // los dos ataques se quedan de **trinquete permanente**.
    // Cada medida copia el `dist/` entero y arranca un `node --test`: sobra tiempo, pero el reloj
    // por defecto se queda corto y un gate que caduca es un rojo que no habla del sitio.
    test.setTimeout(180_000);

    const espejo = espejoDelDist();
    const pagina = join(espejo, "apps", "web", "dist", PAGINA);
    const original = readFileSync(pagina, "utf8");
    try {
      qa.step("el gate tiene que estar vivo: verde sobre el `dist/` publicado");
      expect(gateDeT34(espejo), "INCONCLUSO: el gate no sale verde sobre lo publicado").toBe(0);

      qa.step("y tiene que ver algo: cambiarle la cifra a una fila legítima lo pone rojo");
      expect(
        original.includes(FILA_BUENA),
        "INCONCLUSO: la fila de referencia ya no está escrita así en el `dist/`",
      ).toBe(true);
      const conLaCifraCambiada = filaDeIndice(MEDIDO.nombre, MEDIDO.ruta, `±99${PEGADO}cm`);
      writeFileSync(pagina, original.replace(FILA_BUENA, conLaCifraCambiada));
      expect(
        gateDeT34(espejo),
        "INCONCLUSO: el gate no enrojece ni cambiándole la cifra a un puerto que sí espera",
      ).not.toBe(0);

      qa.step(`plantar en ${PAGINA}: ${ataque.dano}`);
      writeFileSync(pagina, original.replace(FILA_BUENA, ataque.plantada + FILA_BUENA));

      qa.step("volver a correr el gate del `dist/` sobre la página saboteada");
      const codigo = gateDeT34(espejo);

      expect(
        codigo !== 0,
        `${ataque.dano}, y el trinquete de T-34 sale verde (código ${codigo}): una de las tres ` +
          "listas publica una cifra que ningún gate compara con el dataset",
      ).toBe(true);
    } finally {
      rmSync(espejo, { recursive: true, force: true });
    }
  });
}
