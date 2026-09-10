/**
 * Lo compartido por las reproducciones adversarias de **T-34** (el error medido en las listas).
 *
 * Dos piezas, y las dos tienen una razón adversaria:
 *
 * 1. `catalogoConError()` — el catálogo con **la cifra que cada puerto debería publicar**, y esa
 *    cifra se compone **aquí, a mano**, en vez de importar `errorDeLaPrediccion()` de la web. El
 *    gate de T-34 (`apps/web/src/error-en-listas-construido.test.ts`) la deriva llamando a la
 *    función que vigila, que es cómodo y correcto para no fijar un formato paralelo, pero deja el
 *    hueco que su propio hermano `formato.test.ts` documenta: si la función devolviera basura, los
 *    dos lados dirían la misma basura. Un ataque que importara la misma función heredaría el hueco
 *    entero. Aquí la regla («centímetros redondeados, con el `±` delante y el espacio pegado»)
 *    está escrita, no reflejada.
 * 2. `gateDeT34()` — correr el gate del `dist/` desde un árbol cualquiera y devolver su código, que
 *    es como se mide si un sabotaje lo pone rojo o no.
 *
 * No trae asserts, por la misma razón que `utiles.ts`: un helper que afirma esconde el ataque.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { RAIZ } from "./utiles.ts";

/** El espacio que pega la cifra a su unidad (U+00A0). Escrito como escape: invisible en el fuente, no. */
export const PEGADO = "\u00a0";

interface PuertoDelCatalogo {
  readonly slug: string;
  readonly name: string;
  readonly province: { readonly slug: string; readonly name: string };
  readonly region: { readonly slug: string };
  readonly stationFile: string;
}

/** Un puerto del dataset y lo que las listas tienen que decir de él. */
export interface PuertoConError {
  readonly nombre: string;
  readonly region: string;
  readonly provincia: string;
  /** La cifra que debe publicar, o `null` si no hay medida y por tanto no debe publicar ninguna. */
  readonly cifra: string | null;
  /** La palabra de calidad que T-14B ya publicaba de él. */
  readonly palabra: "medida" | "estimada";
}

/**
 * El error de una predicción tal y como la promesa de T-34 lo enuncia: en centímetros enteros, con
 * el signo delante y la unidad pegada. **Escrito aquí**, no importado de la web.
 */
function cifraEsperada(rmseEnMetros: number): string {
  return `±${Math.round(rmseEnMetros * 100)}${PEGADO}cm`;
}

/** El catálogo entero, leído del dataset y no de lo publicado. */
export function catalogoConError(): readonly PuertoConError[] {
  const { ports } = JSON.parse(readFileSync(join(RAIZ, "data", "geo", "ports.json"), "utf8")) as {
    ports: readonly PuertoDelCatalogo[];
  };
  return ports.map((puerto) => {
    const { quality } = JSON.parse(
      readFileSync(join(RAIZ, "data", "stations", puerto.stationFile), "utf8"),
    ) as { quality: { rmse_m: number | null; estimated: boolean } };
    return {
      nombre: puerto.name,
      region: puerto.region.slug,
      provincia: puerto.province.slug,
      cifra: quality.rmse_m === null ? null : cifraEsperada(quality.rmse_m),
      palabra: quality.estimated ? ("estimada" as const) : ("medida" as const),
    };
  });
}

/**
 * Corre el gate del `dist/` de T-34 desde el árbol `cwd` y devuelve su código de salida.
 *
 * `0` es «el gate no ve nada raro». Cualquier otro es «el gate lo caza». Un ataque que deje esto
 * en `0` es un ataque que la suite no vería llegar.
 */
export function gateDeT34(cwd: string): number {
  try {
    execFileSync(
      "node",
      ["--experimental-strip-types", "--test", "apps/web/src/error-en-listas-construido.test.ts"],
      { cwd, stdio: "pipe" },
    );
    return 0;
  } catch (fallo) {
    return (fallo as { status?: number }).status ?? 1;
  }
}
