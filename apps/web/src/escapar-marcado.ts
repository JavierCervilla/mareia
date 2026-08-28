/**
 * Neutraliza el marcado que Astro NO escapa dentro de un valor de atributo.
 *
 * Astro convierte `&` y `"` al serializar un atributo, pero deja pasar `<` y `>` crudos: un dato
 * con `<script>…</script>` acaba literal en el HTML construido, dentro del valor del atributo
 * (A-4 del pase adversario, `docs/qa/informe-adversario-t09-tranche1.md`). No es un XSS —el
 * tokenizador no abandona un valor entrecomillado al ver un `<`— pero mete marcado literal en el
 * `dist/` y deja de ser inocuo en cuanto ese mismo string caiga en un `set:html`, un JSON-LD o un
 * `og:description` que consuma otro parser. Con T-05/T-07 el dato vendrá de adaptadores externos.
 *
 * Solo cubre `<` y `>`: del resto ya se encarga Astro. Como escapa el `&` **después**, un dato
 * hostil sale doblemente escapado (`&#38;lt;`); es el precio de neutralizarlo en el sitio correcto
 * y solo le pasa a datos que ya traían marcado — un texto normal no cambia ni un carácter.
 */
export function escaparMarcado(texto: string): string {
  return texto.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
