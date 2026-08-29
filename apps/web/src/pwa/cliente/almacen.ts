/**
 * Los favoritos, en IndexedDB. **Cero cuentas y cero servidor**: es la decisión del Design Doc y no
 * una simplificación — Mareia no sabe quién eres y no va a empezar a saberlo para guardarte un
 * puerto.
 *
 * Aquí vive el **registro** del favorito y su copia de las constantes armónicas. Los bytes de la
 * página (HTML, CSS, las islas) los guarda el service worker en la Cache API, que es su sitio. La
 * duplicación es deliberada y cuesta unos pocos kB por puerto: el **cálculo** de otro día no puede
 * depender de que el worker esté activo —hay navegadores que lo bloquean en privado, y en la
 * primera visita todavía no lo está—, así que las constantes viven donde la página las lee sola.
 *
 * Todo lo de este fichero **degrada en vez de romper**: si IndexedDB no está disponible (modo
 * privado de Firefox, almacenamiento denegado), se devuelve «no hay nada» y quien llama lo dice.
 * Un almanaque que no puede guardar favoritos sigue siendo un almanaque; uno que revienta al
 * abrirse, no.
 */

import type { EstacionOffline } from "../estacion-offline.ts";

const NOMBRE_BD = "mareia";
const VERSION_BD = 1;
const ALMACEN = "favoritos";

/** Un puerto guardado a mano por quien lee. */
export interface Favorito {
  readonly slug: string;
  /** Reloj del navegador al guardarlo. Es lo que se enseña: «guardado el …». */
  readonly guardadoEnMs: number;
  /** Bytes del JSON de constantes tal y como llegó. **Medido**, no estimado. */
  readonly bytes: number;
  readonly estacion: EstacionOffline;
}

/** Abre (o crea) la base. `undefined` si este navegador no deja. */
async function abrir(): Promise<IDBDatabase | undefined> {
  if (!("indexedDB" in globalThis)) {
    return undefined;
  }
  return new Promise((resolver) => {
    let peticion: IDBOpenDBRequest;
    try {
      peticion = indexedDB.open(NOMBRE_BD, VERSION_BD);
    } catch {
      resolver(undefined);
      return;
    }
    peticion.addEventListener("upgradeneeded", () => {
      if (!peticion.result.objectStoreNames.contains(ALMACEN)) {
        peticion.result.createObjectStore(ALMACEN, { keyPath: "slug" });
      }
    });
    peticion.addEventListener("success", () => {
      resolver(peticion.result);
    });
    peticion.addEventListener("error", () => {
      resolver(undefined);
    });
    peticion.addEventListener("blocked", () => {
      resolver(undefined);
    });
  });
}

/** Envuelve una petición de IndexedDB en una promesa que **no lanza**: o el valor, o `undefined`. */
async function resultado<T>(peticion: IDBRequest<T>): Promise<T | undefined> {
  return new Promise((resolver) => {
    peticion.addEventListener("success", () => {
      resolver(peticion.result);
    });
    peticion.addEventListener("error", () => {
      resolver(undefined);
    });
  });
}

/** Corre una operación sobre el almacén y cierra la base pase lo que pase. */
async function conAlmacen<T>(
  modo: IDBTransactionMode,
  operacion: (almacen: IDBObjectStore) => Promise<T>,
  siNoHay: T,
): Promise<T> {
  const bd = await abrir();
  if (bd === undefined) {
    return siNoHay;
  }
  try {
    return await operacion(bd.transaction(ALMACEN, modo).objectStore(ALMACEN));
  } catch {
    return siNoHay;
  } finally {
    bd.close();
  }
}

/** Si la petición terminó bien. Se mira el evento y no el valor: `delete` resuelve con `undefined`. */
async function seCompleto(peticion: IDBRequest): Promise<boolean> {
  return new Promise((resolver) => {
    peticion.addEventListener("success", () => {
      resolver(true);
    });
    peticion.addEventListener("error", () => {
      resolver(false);
    });
  });
}

/** Guarda (o reemplaza) un favorito. Devuelve si se pudo. */
export async function guardarFavorito(favorito: Favorito): Promise<boolean> {
  return conAlmacen("readwrite", async (almacen) => seCompleto(almacen.put(favorito)), false);
}

/** El favorito de un puerto, o `undefined` si no está guardado. */
export async function leerFavorito(slug: string): Promise<Favorito | undefined> {
  return conAlmacen(
    "readonly",
    async (almacen) => {
      const guardado = await resultado<unknown>(almacen.get(slug));
      return esFavorito(guardado) ? guardado : undefined;
    },
    undefined,
  );
}

/** Todos los favoritos guardados. Lista vacía si no hay ninguno o si no se puede leer. */
export async function listarFavoritos(): Promise<readonly Favorito[]> {
  return conAlmacen(
    "readonly",
    async (almacen) => {
      const todos = await resultado<unknown[]>(almacen.getAll());
      return (todos ?? []).filter(esFavorito);
    },
    [],
  );
}

/** Borra el favorito de un puerto. Devuelve si se pudo. */
export async function olvidarFavorito(slug: string): Promise<boolean> {
  return conAlmacen("readwrite", async (almacen) => seCompleto(almacen.delete(slug)), false);
}

/**
 * Comprueba que lo que salió de la base es un favorito.
 *
 * Lo escribió una versión anterior de esta página, o nadie. Fiarse sin mirar es cómo un almacén
 * local acaba dando horas de marea calculadas con un objeto a medias.
 */
function esFavorito(valor: unknown): valor is Favorito {
  if (typeof valor !== "object" || valor === null) {
    return false;
  }
  const registro = valor as Record<string, unknown>;
  return (
    typeof registro["slug"] === "string" &&
    typeof registro["guardadoEnMs"] === "number" &&
    typeof registro["bytes"] === "number" &&
    typeof registro["estacion"] === "object" &&
    registro["estacion"] !== null
  );
}
