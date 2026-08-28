/**
 * Los dos únicos fallos que un caso de uso considera «culpa del llamante». El adaptador HTTP los
 * traduce a 404 y 400; cualquier otra excepción es un fallo del servidor y se trata como tal.
 */

/** El slug pedido no está en el catálogo. */
export class PortNotFoundError extends Error {
  readonly slug: string;

  constructor(slug: string) {
    super(`Puerto desconocido: ${JSON.stringify(slug)}`);
    this.name = "PortNotFoundError";
    this.slug = slug;
  }
}

/**
 * Parámetro ausente, mal formado o fuera de los límites publicados. El mensaje es para quien llama
 * al API: dice qué esperaba y qué llegó, porque un 400 mudo obliga a adivinar.
 */
export class InvalidQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidQueryError";
  }
}
