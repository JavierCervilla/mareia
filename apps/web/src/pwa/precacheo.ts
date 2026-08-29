/**
 * Qué guarda la PWA y con qué estrategia, **derivado del registry de módulos** y no escrito a mano.
 *
 * El contrato `AppModule` (T-06) declara `offline?: PrecachePolicy` justo para esto: cada módulo
 * dice qué rutas suyas quiere que sobrevivan sin red y con qué estrategia, y el service worker se
 * limita a obedecer. La consecuencia buscada es la de siempre en este proyecto: **dar de baja un
 * módulo es borrar su línea del registry**, y su política offline se va con él sin que nadie tenga
 * que acordarse de tocar el worker.
 *
 * Este fichero es TypeScript puro —sin DOM, sin red— y se testea en Node. Lo consumen dos sitios:
 * el endpoint que genera `/sw.js` (que inyecta la tabla resultante en el worker) y la página, que
 * necesita saber qué URL manda guardar cuando alguien marca un favorito.
 *
 * **El registry NO se importa aquí**, y eso es una medida y no una manía: `modules.config.ts`
 * arrastra los dos módulos activos y, con ellos, el cálculo solunar y el motor de mareas. Una sola
 * línea de `import` para un valor por defecto metía **79 kB** de dominio en el bundle que baja
 * cualquiera que abra una página de puerto. Los módulos los pasa quien los tiene: el endpoint del
 * worker (que corre en build) y el componente de la sección (que también).
 */

import type { AppModule, PrecachePolicy } from "@mareia/module-contract";

import { RUTA_PORTADA, rutaEstacionOffline } from "./protocolo.ts";

/**
 * Una política ya resuelta, en la forma en que la consume el worker: identidad del módulo (para
 * poder diagnosticar de quién es una regla), estrategia y las rutas a las que se aplica.
 *
 * Las rutas son **prefijos de camino**, no URL completas: el endpoint de meteo se pide con
 * `?port=vigo`, así que casar por igualdad no serviría de nada.
 */
export interface PoliticaResuelta {
  readonly id: string;
  readonly estrategia: PrecachePolicy["strategy"];
  readonly rutas: readonly string[];
  readonly assets: readonly string[];
  /** Edad máxima aceptable de la copia guardada, en segundos; `null` si el módulo no la declara. */
  readonly maxAgeSeconds: number | null;
}

/**
 * Las políticas de los módulos activos, en el orden del registry.
 *
 * Un módulo sin `offline` no aparece: no declarar política no es declarar «cachéalo todo», es
 * declarar que ese módulo no tiene nada que guardar. `fishing`, por ejemplo, se calcula en build y
 * viaja dentro del HTML: su sección funciona sin red porque **ya está en la página**.
 */
export function politicasDeModulos(modulos: readonly AppModule[]): readonly PoliticaResuelta[] {
  return modulos.flatMap((modulo) =>
    modulo.offline === undefined
      ? []
      : [
          {
            id: modulo.id,
            estrategia: modulo.offline.strategy,
            rutas: modulo.offline.routes ?? [],
            assets: modulo.offline.assets ?? [],
            maxAgeSeconds: modulo.offline.maxAgeSeconds ?? null,
          },
        ],
  );
}

/** Un puerto, visto por la PWA: lo mínimo para poder guardarlo y **volver a él** sin red. */
export interface PuertoGuardable {
  readonly slug: string;
  readonly ruta: string;
  /**
   * Las páginas que hay que atravesar para llegar a este puerto desde la portada: `/`, `/mareas/`,
   * su región y su provincia.
   *
   * No es adorno de navegación: la portada es el `start_url` del manifiesto, o sea **la única puerta
   * de entrada de la app instalada**, y sin ella el icono de la pantalla de inicio abre el error de
   * red del navegador con el almanaque intacto al lado (hallazgo adversario H-3). Guardar solo la
   * portada tampoco bastaba: desde ahí no se llega al puerto, porque la portada indexa regiones y no
   * puertos. Lo que se guarda es **el camino**, que es lo que de verdad se pidió al guardar el
   * puerto. Son cuatro HTML pequeños y se miden en el CHANGELOG.
   */
  readonly camino: readonly string[];
}

/**
 * Las URL que hay que guardar para que un puerto se abra y se pueda calcular sin red.
 *
 * Son tres familias y ninguna sobra:
 *
 *  1. **su página**, que es el HTML del día que se publicó;
 *  2. **sus constantes armónicas** (`/offline/estaciones/<slug>.json`), que es lo que permite
 *     calcular *otro* día y no solo releer el que se guardó;
 *  3. **los assets con hash que esa página usa** (CSS y las islas), que los aporta quien llama
 *     leyéndolos del propio documento: la página sabe exactamente de qué build es y qué ficheros
 *     necesita, y así esta capa no tiene que adivinar el hash de nada.
 *
 * Los `assets` que declare un módulo en su `PrecachePolicy` se añaden aquí: son suyos y el core no
 * los conoce.
 *
 * **Solo mismo origen.** La hoja de tipografías de Google no se guarda a propósito: guardarla
 * obligaría a meter una respuesta opaca en la caché (no se puede comprobar si llegó bien) y el
 * design brief ya previó el respaldo —Georgia— precisamente para que la métrica de la tabla no
 * cambie cuando la fuente no está. Sin red se lee en Georgia, y se lee igual de bien.
 */
export function urlsDeFavorito(
  puerto: PuertoGuardable,
  assetsDeLaPagina: readonly string[],
  assetsDeModulos: readonly string[] = [],
): readonly string[] {
  return unicas([
    puerto.ruta,
    rutaEstacionOffline(puerto.slug),
    ...caminoHastaElPuerto(puerto),
    ...assetsDeLaPagina,
    ...assetsDeModulos,
  ]);
}

/**
 * El camino desde la puerta de la app instalada hasta el puerto, sin repetir y empezando por la
 * portada aunque nadie la declare: si `start_url` no se guarda, la app instalada no abre.
 */
function caminoHastaElPuerto(puerto: PuertoGuardable): readonly string[] {
  return unicas([RUTA_PORTADA, ...puerto.camino]);
}

/** Los assets propios que declaran los módulos activos en su `PrecachePolicy`. */
export function assetsDeModulos(politicas: readonly PoliticaResuelta[]): readonly string[] {
  return unicas(politicas.flatMap((politica) => politica.assets));
}

/**
 * Lo que se borra al olvidar un puerto: lo suyo y solo lo suyo.
 *
 * **El camino no se borra**, y es deliberado: la portada y los índices los comparten todos los
 * favoritos, y borrarlos al olvidar uno dejaría a los demás sin puerta de entrada. Si no queda
 * ninguno, se van con la poda como cualquier otro fichero huérfano.
 */
export function urlsDeOlvido(puerto: PuertoGuardable): readonly string[] {
  return [puerto.ruta, rutaEstacionOffline(puerto.slug)];
}

/** Sin repetidos y conservando el orden: dos secciones pueden pedir el mismo asset. */
function unicas(urls: readonly string[]): readonly string[] {
  return [...new Set(urls)];
}
