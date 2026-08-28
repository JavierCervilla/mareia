/**
 * Serialización del JSON-LD que va dentro de un `<script type="application/ld+json">`.
 *
 * Un `JSON.stringify` a secas **no es seguro** ahí dentro: el contenido de un `<script>` no lo
 * escapa el parser de HTML, así que un dato que contuviera `</script>` cerraría la etiqueta y todo
 * lo que viniese detrás pasaría a ser marcado del documento. Es el mismo mecanismo que reprodujo el
 * pase adversario de la tranche 1 en un atributo (A-4, `escaparMarcado`), aquí en su otra puerta.
 *
 * La defensa es escapar `<`, `>` y `&` como secuencias `\uXXXX`: siguen siendo el mismo string para
 * cualquier parser de JSON —`JSON.parse` las restituye— y dejan de significar nada para el
 * tokenizador de HTML. Nombres de puerto, licencias y URL del dataset entran por aquí.
 */

const ESCAPES: Readonly<Record<string, string>> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  // Separadores de línea de Unicode: JSON los admite crudos dentro de una cadena y algún consumidor
  // que los evalúe como JavaScript (hasta ES2019) los toma por salto de línea.
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

const PELIGROSOS = /[<>&\u2028\u2029]/gu;

/** JSON-LD listo para incrustar: JSON válido, inerte como HTML. */
export function serializarJsonLd(datos: unknown): string {
  return JSON.stringify(datos).replaceAll(PELIGROSOS, (caracter) => ESCAPES[caracter] ?? caracter);
}
