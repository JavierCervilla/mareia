/**
 * El módulo `protected-areas`: las áreas marinas protegidas que un puerto tiene cerca.
 *
 * Cumple el contrato `AppModule` de `@mareia/module-contract`, así que darlo de alta es añadirlo al
 * array de `apps/web/src/modules.config.ts` y darlo de baja es **borrar esa línea**.
 *
 * **Es un módulo propio y no una sección de `fishing` ni de `regulations`**, y esa decisión está en
 * el diff del contrato: la unión `ModuleId` se amplió por segunda vez a propósito (ver su TSDoc).
 * Con una sola identidad, la lista de fuentes de `/v1/modules` mezclaría la licencia real del BOE
 * con el **hueco de licencia** de RAMPE, que es exactamente lo que hay que poder leer separado.
 *
 * No tiene parte servidor (`api`): la lista se lee del derivado commiteado en build y viaja dentro
 * del HTML. Un endpoint sería un segundo camino al mismo fichero.
 *
 * **No declara `isEnabledForPort`**, y aquí eso es la mitad del producto: los 153 puertos del
 * catálogo tienen sección, incluidos los **10 que no tienen ninguna área a menos de 30 km**, que la
 * publican diciéndolo. Un filtro que escondiera la sección en esos 10 convertiría una respuesta en
 * un silencio, y un silencio no se distingue de «esto no lo hemos hecho».
 */

import type { AppModule, Attribution, PageSection, PrecachePolicy } from "@mareia/module-contract";

/** Versión del módulo, publicada en `/v1/modules`. Va a la par con su `package.json`. */
export const PROTECTED_AREAS_MODULE_VERSION = "0.1.0";

/**
 * Clave lógica de la sección. El contrato identifica los componentes por **cadena** para no
 * depender de ningún framework de UI; la constante existe para que el módulo y el mapa de
 * renderizadores de la superficie (`apps/web/src/secciones.ts`) no escriban la misma cadena por
 * separado y se desincronicen en el primer renombrado.
 */
export const SECCION_AREAS_PROTEGIDAS =
  "@mareia/module-protected-areas/sections/AreasProtegidas";

/** Ancla de la sección en la página (`#areas-protegidas`). */
export const ID_SECCION_AREAS = "areas-protegidas";

/**
 * Atribución de la fuente, con **el hueco de licencia dicho tal cual**.
 *
 * `license` no es una etiqueta SPDX y no puede serlo: la página de descarga de RAMPE **no declara
 * licencia ni condiciones de uso** (verificado el 2026-08-30, ver `data/geo/README.md`). Escribir
 * ahí «CC-BY-4.0» porque otras fuentes del MITECO la llevan sería inventarse los términos de uso de
 * una fuente oficial, y escribir «desconocida» a secas escondería que el hueco es **de origen** y
 * no nuestro. Es el único hueco de licencia del portal y se publica con esas palabras.
 *
 * La consecuencia práctica es la que da forma al módulo entero: se publican **hechos derivados**
 * —nombre oficial, figura, código, distancia aproximada— y **ninguna geometría**, que es justo lo
 * que una licencia no declarada no permite redistribuir.
 *
 * El aviso de que esto no autoriza a pescar **no** se copia aquí: viaja firmado dentro del dataset
 * (`fuente.aviso`) y la sección lo imprime desde ahí. Dos ejemplares del mismo aviso acabarían
 * diciendo cosas distintas.
 */
export const ATRIBUCIONES_PROTECTED_AREAS: readonly [Attribution, ...Attribution[]] = [
  {
    name:
      "Ministerio para la Transición Ecológica y el Reto Demográfico · RAMPE 2025, Red de Áreas " +
      "Marinas Protegidas de España",
    url: "https://www.miteco.gob.es/es/biodiversidad/temas/biodiversidad-marina/espacios-marinos-protegidos/rampe.html",
    license: "MITECO · RAMPE 2025 — condiciones de uso no declaradas en origen",
  },
];

/**
 * La sección que el módulo aporta a la página de puerto.
 *
 * `renderMode: "static"` porque esto es **dato de build**: un espacio protegido no envejece en
 * horas —se declara o se amplía por norma, que llega por otro camino: una ingesta nueva y un
 * rebuild—, así que hidratarlo costaría JavaScript para no enterarse de nada nuevo.
 *
 * **`order: 12` la coloca la primera de las secciones de módulo, y esto es la decisión de diseño de
 * la trayectoria.** Las contextuales —actividad solunar y meteo— empatan a 20 y las tallas mínimas
 * van a 30 porque son consultables. Ésta baja de 20 porque **no es una consulta: es una
 * advertencia**, y en la jerarquía del design brief (§1) las advertencias están fuera de los tres
 * niveles. Quien mira una talla la mira porque ya tiene la pieza en la mano; quien tiene delante una
 * reserva marina necesita saberlo **antes** de decidir nada, y una advertencia colocada detrás de lo
 * que califica llega tarde. El hueco por debajo de 20 estaba reservado desde T-19 —«los órdenes por
 * debajo de 10 siguen libres para un módulo que algún día tenga que avisar de algo por encima del
 * dato»— y éste es ese módulo. Se coloca en 12 y no en 5 porque debajo sigue haciendo falta sitio:
 * un aviso más duro que éste —uno que dependiera del día, no del sitio— tendría que poder ponerse
 * delante sin renumerar a nadie.
 *
 * **Y hasta dónde llega ese 12, dicho para que nadie lo suponga de más**: `order` ordena las
 * secciones **de módulo** entre sí, y nada más. Los bloques del core —tabla del día, gráfico,
 * coeficiente, sol y luna— los coloca la página y van antes, así que esto **no es un banner** como
 * el «No apto para navegación»: es lo primero que se lee **después** del dato de marea. Subirla por
 * encima de la tabla exigiría tocar la plantilla de la página, que es justo lo que el contrato de
 * módulos existe para no tener que hacer, y no se hace aquí.
 */
export const SECCION_AREAS: PageSection = {
  id: ID_SECCION_AREAS,
  order: 12,
  renderMode: "static",
  component: SECCION_AREAS_PROTEGIDAS,
};

/**
 * Política offline: **`cache-first`**, o sea que la copia guardada se sirve sin preguntar a la red.
 *
 * Es barato y es útil justo donde el portal se usa. **Medido sobre el `dist/`** —lo que ocupa la
 * página con la sección menos lo que ocupa sin ella—: entre 1.955 B (Valencia, sin ninguna área) y
 * 4.925 B (Guía de Isora, seis áreas y el máximo del catálogo), o sea **entre 599 y 1.186 B
 * comprimidos**. Agaete, que hasta la revisión de T-21 figuraba aquí como el máximo, es la quinta
 * página más gorda con 4.684 B: el máximo se comprueba ahora sobre las 153 y no se teclea. Y el entorno que manda en el
 * design brief es un teléfono en la orilla y a menudo sin cobertura, que es exactamente cuando
 * alguien necesita saber si tiene una reserva marina delante.
 *
 * **Quién guarda la copia no es este módulo**: es la caja de favoritos del core, que guarda la
 * página de un puerto **cuando el lector lo marca**. Sin marcarlo no hay copia y sin red no hay
 * lista, sino el error de red del navegador. Decirlo aquí no es una cautela de más: en T-19 la
 * sección hermana publicó en las 153 páginas una frase que afirmaba lo contrario y el pase
 * adversario la midió falsa por defecto (hallazgo H-4). Por eso `AVISO_SIN_RED` empieza por su
 * condición —«Si guardas este puerto…»— y no por la promesa.
 *
 * `routes` y `assets` van **vacíos, y eso es exacto**: la lista se hornea dentro del HTML de la
 * página, que la PWA ya guarda al marcar el puerto, y el módulo no tiene ninguna URL propia que
 * precachear. Lo que esta política declara no es una lista de ficheros: es la postura —servir lo
 * guardado sin preguntar a la red—, y por eso está escrita aquí, donde `/v1/modules` y `/sw.js` la
 * publican. `maxAgeSeconds` no se declara porque el worker solo lo aplica a las rutas que casan y
 * no hay ninguna: un umbral que no caduca nada sería una promesa falsa.
 */
export const OFFLINE_PROTECTED_AREAS: PrecachePolicy = {
  strategy: "cache-first",
};

/** El módulo, listo para el registry. Sin dependencias que inyectar: no lee nada del entorno. */
export const protectedAreasModule: AppModule = {
  id: "protected-areas",
  version: PROTECTED_AREAS_MODULE_VERSION,
  attributions: ATRIBUCIONES_PROTECTED_AREAS,
  pageSections: [SECCION_AREAS],
  offline: OFFLINE_PROTECTED_AREAS,
};
