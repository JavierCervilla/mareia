/**
 * El módulo `species`: el catálogo de las especies que el BOE regula, visto desde la página de
 * puerto.
 *
 * Cumple el contrato `AppModule` de `@mareia/module-contract`, así que darlo de alta es añadirlo al
 * array de `apps/web/src/modules.config.ts` y darlo de baja es **borrar esa línea**.
 *
 * **Es un módulo propio y no una sección de `regulations`**, y esa decisión está en el diff del
 * contrato: la unión `ModuleId` se amplió por **tercera** vez a propósito (ver su TSDoc). El motivo
 * es el mismo que separó a `protected-areas` de las otras dos, y aquí es todavía más nítido: lo que
 * este módulo publica **no sale del BOE**. Sale de WoRMS y de OBIS, que son dos fuentes
 * internacionales con licencias propias —una de ellas, la de WoRMS, con una condición que nos
 * prohíbe redistribuir su base entera—, y colgarlo de `regulations` metería esas dos licencias en la
 * lista de atribuciones de la norma española. La lista de `/v1/modules` existe para poder leer
 * separado de dónde viene cada cosa, y aquí vienen de sitios distintos: la talla, del BOE; el nombre
 * aceptado, de WoRMS; los registros, de OBIS.
 *
 * No tiene parte servidor (`api`): el catálogo se lee del derivado commiteado en build y viaja
 * dentro del HTML. Un endpoint sería un segundo camino al mismo fichero.
 *
 * **No declara `isEnabledForPort`**: los 153 puertos tienen caladero y los tres caladeros tienen
 * especies, así que la sección aplica en todos.
 */

import type { AppModule, Attribution, PageSection } from "@mareia/module-contract";

/** Versión del módulo, publicada en `/v1/modules`. Va a la par con su `package.json`. */
export const SPECIES_MODULE_VERSION = "0.1.0";

/**
 * Clave lógica de la sección. El contrato identifica los componentes por **cadena** para no depender
 * de ningún framework de UI; la constante existe para que el módulo y el mapa de renderizadores de
 * la superficie (`apps/web/src/secciones.ts`) no escriban la misma cadena por separado y se
 * desincronicen en el primer renombrado.
 */
export const SECCION_CATALOGO_DE_ESPECIES = "@mareia/module-species/sections/Especies";

/** Ancla de la sección en la página (`#especies`). */
export const ID_SECCION_ESPECIES = "especies";

/**
 * Atribuciones de las dos fuentes, **con la condición de WoRMS dicha en la propia licencia**.
 *
 * WoRMS es CC-BY y eso permite mucho, pero sus condiciones de uso prohíben expresamente
 * redistribuir la base de datos entera o partes sustanciales de ella. Lo que aquí se publica es una
 * **extracción curada** —86 nombres, su `AphiaID`, su estado y el nombre aceptado— y no un espejo:
 * la diferencia no es de tamaño, es de naturaleza, y por eso se escribe en el campo de licencia y
 * no en un comentario. Un día alguien querrá «cachear WoRMS entero para no depender de la red» y
 * esta línea es lo que le hará leer las condiciones antes.
 *
 * OBIS va con su atribución y su licencia propias: son dos fuentes distintas, con dos organismos
 * distintos detrás, y mezclarlas en una sola entrada haría imposible dar de baja una sin la otra.
 */
export const ATRIBUCIONES_SPECIES: readonly [Attribution, ...Attribution[]] = [
  {
    name: "WoRMS Editorial Board · World Register of Marine Species",
    url: "https://www.marinespecies.org/",
    license:
      "CC-BY-4.0 — extracción curada con atribución; sus condiciones de uso NO permiten " +
      "redistribuir la base de datos entera ni partes sustanciales de ella",
  },
  {
    name: "OBIS · Ocean Biodiversity Information System (COI-UNESCO)",
    url: "https://obis.org/",
    license: "CC-BY-4.0 — registros de presencia agregados por caladero, no la base de registros",
  },
];

/**
 * La sección que el módulo aporta a la página de puerto: **un enlace al catálogo filtrado por el
 * caladero de este puerto, y no una segunda tabla de tallas**.
 *
 * Es la decisión de forma de la trayectoria. La tabla de tallas ya la pone `regulations`, sale del
 * BOE y lleva sus notas pegadas a cada cifra; repetirla aquí con otra composición serían **dos
 * superficies del mismo dato**, y dos superficies del mismo dato se desincronizan —basta con que
 * una corrección entre por una y no por la otra— hasta acabar publicando dos cifras legales
 * distintas para la misma especie en la misma página. Lo que el catálogo añade —el taxón aceptado,
 * el rango, la presencia registrada— **no depende del puerto**, así que vive en una página y no en
 * las 153.
 *
 * `renderMode: "static"` porque esto es dato de build y además es un enlace: no hay nada que
 * hidratar.
 *
 * **`order: 35`, la última de las secciones de módulo, y el hueco tiene motivo.** Las contextuales
 * —solunar y meteo— empatan a 20; `regulations` va a 30 porque una talla es *consultable*; las
 * áreas protegidas van a 12 porque son una *advertencia* y llegan tarde si se leen después de lo que
 * califican. Esta va **detrás de las tallas**, y no puede ir en otro sitio: es un enlace que dice
 * «esto que acabas de leer, en más ancho». Puesta delante de la tabla, ofrecería irse a otra página
 * a quien todavía no ha visto lo que ya tiene aquí horneado y sin red. Se elige 35 y no 31 para
 * dejar sitio entre las dos: un futuro módulo que ampliara la propia tabla de tallas —vedas por
 * comunidad autónoma, por ejemplo— tendría que poder colocarse entre la norma y su catálogo sin
 * renumerar a nadie.
 */
export const SECCION_ESPECIES: PageSection = {
  id: ID_SECCION_ESPECIES,
  order: 35,
  renderMode: "static",
  component: SECCION_CATALOGO_DE_ESPECIES,
};

/**
 * **Este módulo no declara `offline`, y eso es una afirmación y no un olvido.**
 *
 * `politicasDeModulos` lo dice con todas las letras: «un módulo sin `offline` no aparece; no
 * declarar política no es declarar cachéalo todo, es declarar que ese módulo no tiene nada que
 * guardar». Aquí es literalmente cierto: lo que la sección aporta a la página de puerto es un
 * párrafo y un enlace, y el párrafo ya viaja dentro del HTML del puerto, que la caja de favoritos
 * guarda **cuando el lector marca ese puerto**. Lo que hay al otro lado del enlace —`/pesca/especies/`—
 * **no se guarda**: un favorito guarda la página del puerto, sus constantes, el camino hasta ella y
 * sus assets, y el catálogo no está en esa lista.
 *
 * Declarar `cache-first` con `routes: ["/pesca/especies/"]` habría sido lo cómodo y habría sido
 * falso por dos motivos a la vez: las rutas de una `PrecachePolicy` fijan **la estrategia** del
 * worker y no lo que se precachea (`urlsDeUnFavorito` no las mira), así que la política prometería
 * servir sin red algo que nunca llega a la caché. En T-19 una frase que afirmaba lo que el precacheo
 * no hacía se publicó en 153 páginas y hubo que corregirla (hallazgo H-4 del pase adversario). Así
 * que aquí no se declara nada y la sección **dice lo contrario en la página**: `SIN_RED_NO_ABRE`.
 */

/** El módulo, listo para el registry. Sin dependencias que inyectar: no lee nada del entorno. */
export const speciesModule: AppModule = {
  id: "species",
  version: SPECIES_MODULE_VERSION,
  attributions: ATRIBUCIONES_SPECIES,
  pageSections: [SECCION_ESPECIES],
};
