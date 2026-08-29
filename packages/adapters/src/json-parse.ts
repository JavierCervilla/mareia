/**
 * Lectura defensiva de los JSON del dataset.
 *
 * Los ficheros de `data/` son nuestros y están validados contra su schema en CI, pero al cruzar la
 * frontera del proceso vuelven a ser `unknown`. Estos ayudantes convierten esa incertidumbre en un
 * error **con el fichero y el campo que falló** en vez de en un `any` que se propaga hasta explotar
 * tres capas más arriba con un `undefined is not a function`.
 */

/** Un fichero del dataset no tiene la forma esperada. El mensaje señala fichero y campo. */
export class DatasetFormatError extends Error {
  readonly filePath: string;

  constructor(filePath: string, detail: string) {
    super(`Dataset con formato inesperado en ${filePath}: ${detail}`);
    this.name = "DatasetFormatError";
    this.filePath = filePath;
  }
}

/** Contexto de lectura: el fichero del que se está leyendo, para poder nombrarlo en los errores. */
export class JsonReader {
  readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  fail(detail: string): never {
    throw new DatasetFormatError(this.filePath, detail);
  }

  parse(text: string): Record<string, unknown> {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch (cause) {
      this.fail(`no es JSON válido (${cause instanceof Error ? cause.message : "error desconocido"})`);
    }
    return this.record(value, "$");
  }

  record(value: unknown, path: string): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      this.fail(`${path} debería ser un objeto`);
    }
    return value as Record<string, unknown>;
  }

  child(source: Record<string, unknown>, key: string, path: string): Record<string, unknown> {
    return this.record(source[key], `${path}.${key}`);
  }

  array(source: Record<string, unknown>, key: string, path: string): readonly unknown[] {
    const value = source[key];
    if (!Array.isArray(value)) {
      this.fail(`${path}.${key} debería ser un array`);
    }
    return value;
  }

  string(source: Record<string, unknown>, key: string, path: string): string {
    const value = source[key];
    if (typeof value !== "string" || value === "") {
      this.fail(`${path}.${key} debería ser una cadena no vacía`);
    }
    return value;
  }

  number(source: Record<string, unknown>, key: string, path: string): number {
    const value = source[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      this.fail(`${path}.${key} debería ser un número finito`);
    }
    return value;
  }

  /** Campo que el dataset publica como número **o como `null` con significado** (ver `quality`). */
  nullableNumber(source: Record<string, unknown>, key: string, path: string): number | null {
    const value = source[key];
    if (value === null || value === undefined) {
      return null;
    }
    return this.number(source, key, path);
  }

  /**
   * Campo booleano **obligatorio**: ni ausente ni `null` valen.
   *
   * No tiene versión tolerante a propósito. El único booleano del contrato es `quality.estimated`,
   * y un `undefined` colándose como «falso» convertiría un puerto sin medir en un puerto medido,
   * que es justo el fallo que ese campo existe para impedir.
   */
  flag(source: Record<string, unknown>, key: string, path: string): boolean {
    const value = source[key];
    if (typeof value !== "boolean") {
      this.fail(`${path}.${key} debería ser un booleano`);
    }
    return value;
  }

  /** Campo textual opcional: ausente y `null` se publican igual, como `null`. */
  nullableString(source: Record<string, unknown>, key: string, path: string): string | null {
    const value = source[key];
    if (value === null || value === undefined) {
      return null;
    }
    return this.string(source, key, path);
  }
}
