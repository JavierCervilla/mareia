/**
 * Cómo se escribe un área protegida en la página. Todo el criterio de presentación de la sección,
 * sin Astro: funciones puras que un `node --test` puede juzgar sin construir el sitio.
 *
 * Las dos reglas que este archivo existe para hacer cumplir:
 *
 * 1. **La distancia se publica como cota entera, nunca como la décima del dataset.** El derivado
 *    mide al borde del área y redondea la décima hacia arriba; un `8,7` en la página se lee como
 *    una medida y no lo es —el método tiene un error acotado pero no nulo—. `distanciaEscrita` lo
 *    convierte en «a menos de 9 km»: una afirmación que los dos redondeos empujan hacia el lado que
 *    conviene en una advertencia. Y el caso `dentro` no se disfraza de distancia corta: es un hecho
 *    distinto y se dice con sus palabras.
 * 2. **El orden es el del dato, que es el de proximidad, y aquí no se reordena.** Ni por figura, ni
 *    por «rareza», ni por nada que se parezca a destacar lo interesante: esto es una advertencia y
 *    la única jerarquía defendible es lo que tienes más cerca. Si el dato llegara desordenado,
 *    `filasDeAreas` **levanta** en vez de ordenarlo en silencio, porque ordenarlo taparía un fallo
 *    del pipeline que nadie volvería a ver.
 * 3. **Ninguna fila puede contradecir el título de su propia sección.** Por eso `filasDeAreas`
 *    recibe el `radioKm` que el título publica: una cota mayor que el radio levanta, y el caso en
 *    que el puerto cae dentro del área no publica cota ninguna. Es la corrección del hallazgo H-3
 *    del pase adversario, que sacó «a menos de 480 km» debajo de un rótulo que promete 30.
 */

import { DENTRO_DEL_AREA, glosaDeTipo, kmDelRadio } from "./textos.ts";
import type { AreaProtegida, TipoDeArea } from "./tipos.ts";

/** Qué de cerca está el área, ya escrito. */
export interface ProximidadEscrita {
  /**
   * La cota: «a menos de 9 km». Siempre en kilómetros enteros y siempre con la desigualdad.
   *
   * **`null` cuando el puerto cae dentro del área**, que es la corrección del hallazgo H-3: ahí la
   * distancia al borde no dice lo lejos que está el área sino lo metido que está el puerto, y bajo
   * un título que promete un radio se lee como su contrario. Ver `proximidadDeArea`.
   */
  readonly texto: string | null;
  /** `true` si el puerto cae dentro del área. Lo consume la plantilla para marcarlo aparte. */
  readonly dentro: boolean;
  /** Lo que hay que decir de más cuando cae dentro; `null` cuando no. */
  readonly explicacion: string | null;
}

/** Una fila de la lista publicada, con todo lo que hay que pintar ya resuelto. */
export interface FilaDeArea {
  /** Identificador estable de la fila (`data-area`, y clave de render): el código de la fuente. */
  readonly clave: string;
  /** Nombre oficial, sin tocar. */
  readonly nombre: string;
  /** La sigla tal y como la escribe la fuente. */
  readonly tipo: TipoDeArea;
  /** La sigla desarrollada, o `null` si no es una sigla (ver `glosaDeTipo`). */
  readonly glosa: string | null;
  /** El `SITE_CODE` de RAMPE, que es con lo que se busca el espacio en la fuente. */
  readonly codigo: string;
  readonly proximidad: ProximidadEscrita;
}

/**
 * La distancia, escrita como lo que es: una cota superior en kilómetros enteros.
 *
 * `Math.ceil` y no `Math.round` porque el redondeo al par más cercano rompería la afirmación: con
 * 8,7 km al borde, «a menos de 9» es verdad y «unos 9» es una medida que no tenemos.
 * El mínimo es 1 km porque «a menos de 0 km» no es una frase. Hoy el derivado no publica ninguna
 * relación a 0,0 —desde T-21 la décima se redondea hacia arriba, así que lo más cerca que se
 * publica es 0,1—, pero la guarda se queda: la función es total, y un puerto exactamente sobre el
 * límite de un área daría 0,0. Las 59 relaciones por debajo del kilómetro se publican todas igual,
 * «a menos de 1 km», que es lo único que se puede afirmar de ellas.
 *
 * Levanta si el número no se puede leer o es negativo: un `NaN` que llegase aquí publicaría «a
 * menos de NaN km» en la página de un puerto real, y una distancia negativa significaría que el
 * derivado está roto.
 */
export function distanciaEscrita(distanciaAproxKm: number): string {
  if (!Number.isFinite(distanciaAproxKm) || distanciaAproxKm < 0) {
    throw new Error(
      `distancia a un área protegida ilegible: ${JSON.stringify(distanciaAproxKm)}. Sin distancia ` +
        `no se publica el área: media advertencia es peor que ninguna.`,
    );
  }
  return `a menos de ${Math.max(1, Math.ceil(distanciaAproxKm))} km`;
}

/**
 * La proximidad de un área, con el «dentro» dicho aparte y no disuelto en la distancia.
 *
 * **Ninguna fila puede publicar una cota que contradiga el título de la sección**, y esto es la
 * corrección del hallazgo H-3. El título dice «Áreas marinas protegidas a menos de N km» con el
 * mismo `radioKm` que llega aquí; el adversario puso una fila de Alicante a 480 km con
 * `dentro: true` y la página publicó *«Reserva marina de la Isla de Tabarca · a menos de 480 km ·
 * El punto de este puerto cae dentro de esta área»* bajo el rótulo de 30 km, con toda la escalera
 * en verde: del lado del pipeline `dentro` apagaba la única comprobación numérica que ataba la
 * distancia al radio, y del lado de la web no había segunda opinión.
 *
 * Se separan los dos casos porque son dos preguntas distintas:
 *
 * * **El puerto cae dentro** → no se publica cota, sólo el hecho. Es el caso legítimo que documenta
 *   `criterio.dentro` —el puerto muy metido en un área muy grande, cuyo borde queda más allá del
 *   radio—, y ahí la distancia al borde mide lo metido que está el puerto, no lo lejos que está el
 *   área: escribirla bajo un título que promete un radio la convierte en su contrario. Hoy las 10
 *   relaciones con `dentro` están todas a 0,1 km o menos, así que la cota que se deja de publicar
 *   decía «a menos de 1 km» y no añadía nada al hecho que la sustituye.
 * * **El puerto está fuera** → la cota, y **levanta** si pasa del radio. No es una comprobación de
 *   más sobre el gate del pipeline: es la que no se puede apagar. Publicar «a menos de 480 km»
 *   debajo de «a menos de 30 km» es media advertencia, y media advertencia es peor que ninguna;
 *   romper el build es fail-safe, porque producción sigue sirviendo lo anterior.
 */
export function proximidadDeArea(area: AreaProtegida, radioKm: number): ProximidadEscrita {
  if (area.dentro) {
    return { texto: null, dentro: true, explicacion: DENTRO_DEL_AREA };
  }
  const texto = distanciaEscrita(area.distanciaAproxKm);
  const cota = Math.max(1, Math.ceil(area.distanciaAproxKm));
  if (cota > kmDelRadio(radioKm)) {
    throw new Error(
      `${area.codigo} se publicaría «${texto}» bajo un título que promete a menos de ` +
        `${kmDelRadio(radioKm)} km, y el puerto no cae dentro del área: la fila contradiría al ` +
        `rótulo que la encabeza.`,
    );
  }
  return { texto, dentro: false, explicacion: null };
}

/**
 * Las filas de la sección, en el orden en que vienen (de la más cercana a la más lejana).
 *
 * Levanta en los dos casos en que publicar sería peor que romper: un dato desordenado —que haría
 * leer la lista como si la primera fuese la más cercana cuando no lo es— y dos áreas con el mismo
 * código, que dejarían dos filas con la misma clave y una advertencia duplicada o perdida.
 */
export function filasDeAreas(
  areas: readonly AreaProtegida[],
  radioKm: number,
): readonly FilaDeArea[] {
  const vistos = new Set<string>();
  let anterior = Number.NEGATIVE_INFINITY;
  return areas.map((area) => {
    if (area.distanciaAproxKm < anterior) {
      throw new Error(
        `las áreas de un puerto llegan desordenadas (${anterior} antes que ` +
          `${area.distanciaAproxKm}): la sección publica por proximidad y no reordena, porque ` +
          `ordenarlas aquí taparía el fallo del derivado.`,
      );
    }
    anterior = area.distanciaAproxKm;
    if (vistos.has(area.codigo)) {
      throw new Error(`el área ${area.codigo} viene dos veces en el mismo puerto`);
    }
    vistos.add(area.codigo);
    return {
      clave: area.codigo,
      nombre: area.nombre,
      tipo: area.tipo,
      glosa: glosaDeTipo(area.tipo),
      codigo: area.codigo,
      proximidad: proximidadDeArea(area, radioKm),
    };
  });
}
