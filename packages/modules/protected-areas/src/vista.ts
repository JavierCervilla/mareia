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
 */

import { DENTRO_DEL_AREA, glosaDeTipo } from "./textos.ts";
import type { AreaProtegida, TipoDeArea } from "./tipos.ts";

/** Qué de cerca está el área, ya escrito. */
export interface ProximidadEscrita {
  /** La cota: «a menos de 9 km». Siempre en kilómetros enteros y siempre con la desigualdad. */
  readonly texto: string;
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

/** La proximidad de un área, con el «dentro» dicho aparte y no disuelto en la distancia. */
export function proximidadDeArea(area: AreaProtegida): ProximidadEscrita {
  return {
    texto: distanciaEscrita(area.distanciaAproxKm),
    dentro: area.dentro,
    explicacion: area.dentro ? DENTRO_DEL_AREA : null,
  };
}

/**
 * Las filas de la sección, en el orden en que vienen (de la más cercana a la más lejana).
 *
 * Levanta en los dos casos en que publicar sería peor que romper: un dato desordenado —que haría
 * leer la lista como si la primera fuese la más cercana cuando no lo es— y dos áreas con el mismo
 * código, que dejarían dos filas con la misma clave y una advertencia duplicada o perdida.
 */
export function filasDeAreas(areas: readonly AreaProtegida[]): readonly FilaDeArea[] {
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
      proximidad: proximidadDeArea(area),
    };
  });
}
