/**
 * La forma del dataset `areas-protegidas/v1` (`data/geo/areas-protegidas.json`), escrita en tipos.
 *
 * Es el **contrato de lectura** entre el pipeline que lo construye (T-21, carril A) y esta
 * interfaz. Vive en el módulo y no en la web por lo mismo que `regulations`: quien tiene que saber
 * qué es un área marina protegida es el módulo; la web solo sabe abrir un JSON y dárselo
 * (`apps/web/src/modulos/areas-protegidas.ts`).
 *
 * La pieza que manda sobre todo lo demás es `TipoDeArea`: son **siglas administrativas** y la
 * sección tiene que glosarlas, así que modelarlas como `string` dejaría que una sigla nueva llegase
 * a la página sin glosa —o, peor, con una inventada—. Es una unión cerrada de cinco valores, los
 * cinco que publica RAMPE 2025, y `vista.ts` la recorre con un `switch` cerrado con `never`.
 *
 * Lo que este dataset **no** trae, y no es un olvido: geometría. Ni un vértice, ni un polígono, ni
 * una caja envolvente. Es la consecuencia de que la fuente no declare condiciones de uso (ver
 * `data/geo/README.md`): se publican hechos derivados, no lo que una licencia no declarada no nos
 * deja redistribuir. Si algún día apareciera geometría en el fichero, no habría dónde escribirla
 * aquí.
 */

/**
 * La figura de protección con la que RAMPE clasifica cada espacio, tal y como la escribe la fuente.
 *
 * Cinco valores porque cinco son los que trae RAMPE 2025 (42 ZEPA, 32 ZEC, 10 reservas marinas, 1
 * ZEC/AMP y 1 AMP). **No es una etiqueta libre**: la sección las glosa una a una y un sexto valor
 * no compilará hasta que alguien escriba qué significa, que es exactamente lo que no se puede
 * improvisar sobre una sigla administrativa.
 */
export type TipoDeArea = "ZEPA" | "ZEC" | "RESERVA MARINA" | "ZEC/AMP" | "AMP";

/** Un área marina protegida vista desde un puerto: qué es, cómo se llama y cuánto la tiene cerca. */
export interface AreaProtegida {
  /** Nombre oficial del espacio, tal y como lo escribe la fuente. No se abrevia ni se retoca. */
  readonly nombre: string;
  /** La figura de protección. Es una sigla, y la sección la glosa. */
  readonly tipo: TipoDeArea;
  /** `SITE_CODE` de RAMPE. Es lo que permite buscar el espacio en la fuente sin fiarse del nombre. */
  readonly codigo: string;
  /**
   * Distancia al **borde** del área, en kilómetros y con una décima redondeada hacia arriba.
   *
   * **Es aproximada**: el pipeline la mide punto a segmento sobre una esfera y no sobre el
   * elipsoide (hasta 0,37 %, o sea 110 m a 30 km) y toma cada arista como arco de círculo máximo. No se publica tal cual (ver
   * `distanciaEscrita` en `vista.ts`): un `8,7` en la página se lee como una medida, y esto no lo
   * es. Hasta la primera versión de T-21 esto era la distancia al vértice más cercano, que aleja y
   * que **perdía seis áreas reales** de las 348 porque RAMPE tiene aristas de hasta 159,6 km.
   */
  readonly distanciaAproxKm: number;
  /**
   * `true` si el punto del puerto cae **dentro** del polígono del área, huecos excluidos.
   *
   * Responde lo que ninguna distancia responde: de qué lado del borde está el puerto. Es un hecho
   * distinto y más fuerte que una distancia, y la sección lo dice con esas palabras.
   */
  readonly dentro: boolean;
}

/** Lo que el derivado publica de un puerto: sus áreas cercanas o, si no hay, por qué no hay. */
export interface AreasDelPuerto {
  /** Slug del puerto en el catálogo. */
  readonly slug: string;
  /** Las áreas a menos del radio del criterio, **de la más cercana a la más lejana**. */
  readonly areas: readonly AreaProtegida[];
  /**
   * Por qué esta lista está vacía, cuando lo está; `null` cuando hay áreas.
   *
   * Los 10 puertos sin ninguna **no faltan del fichero**: traen su motivo, y la sección lo publica.
   * Una sección que desaparece se lee como «no hay nada que saber»; ésta dice lo que sabemos y
   * **hasta dónde hemos mirado**.
   */
  readonly motivo: string | null;
}

/** El censo de la fuente, tal y como el pipeline lo midió el día de la ingesta. */
export interface CensoDeLaFuente {
  /** Áreas en RAMPE 2025. */
  readonly areas: number;
  /** Vértices que trae la fuente y que **no** se publican. */
  readonly verticesEnOrigen: number;
  /** Cuántas áreas de cada figura. */
  readonly porTipo: Readonly<Record<string, number>>;
}

/**
 * La fuente, su licencia y su aviso.
 *
 * `licencia` no es una etiqueta SPDX y no puede serlo: la página de descarga de RAMPE **no declara
 * ninguna**. Lo que viaja es el hueco, dicho con todas las letras.
 */
export interface FuenteDeAreas {
  readonly nombre: string;
  readonly organismo: string;
  readonly url: string;
  readonly paginaUrl: string;
  /** «MITECO · RAMPE 2025 — condiciones de uso no declaradas en origen». */
  readonly licencia: string;
  /** El aviso que manda sobre todo lo demás: esto dice dónde NO se puede, nunca dónde sí. */
  readonly aviso: string;
  /** Día de la ingesta (`YYYY-MM-DD`). */
  readonly descargadoEn: string;
  readonly censo: CensoDeLaFuente;
}

/** Con qué criterio se cruzaron puertos y áreas, dicho por el propio dataset. */
export interface CriterioDeAreas {
  /** Radio de búsqueda en kilómetros. Es lo que la sección publica como «hasta dónde miramos». */
  readonly radioKm: number;
  /** Qué mide exactamente `distanciaAproxKm`, escrito por el pipeline. */
  readonly distancia: string;
  /** Qué significa `dentro`. */
  readonly dentro: string;
  /** Que aquí no hay geometría de ninguna clase. */
  readonly sinGeometria: string;
}

/** El recuento del propio derivado: el pipeline lo recalcula desde el contenido, no se teclea. */
export interface ResumenDeAreas {
  readonly puertos: number;
  readonly conArea: number;
  readonly sinArea: number;
  readonly relaciones: number;
}

/** El dataset entero. */
export interface AreasProtegidas {
  readonly schema: string;
  readonly fuente: FuenteDeAreas;
  readonly criterio: CriterioDeAreas;
  readonly resumen: ResumenDeAreas;
  readonly puertos: readonly AreasDelPuerto[];
}
