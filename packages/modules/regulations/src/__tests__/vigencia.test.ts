/**
 * Qué hace la sección cuando el sello de vigencia envejece.
 *
 * El hallazgo H-1 del pase adversario de T-19: el workflow del gate diario prometía dos veces que
 * en su rama ámbar «la página degrada sola», y no degradaba nada —construir con
 * `verificadoEn = 2019-04-07` publicaba la misma sección byte a byte salvo la cadena de la fecha—.
 * Aquí se juzga el criterio; que la degradación llegue **al HTML publicado** lo miden el gate de
 * `apps/web/src/tallas-construido.test.ts` y el recorrido adversario A2, que construye el sitio
 * entero con el sello atrasado.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { avisoDeVigencia, rotuloDeVigencia } from "../textos.ts";
import {
  DIAS_SELLO_CORRIENTE,
  DIAS_SELLO_RANCIO,
  diasDesdeLaComprobacion,
  estadoDeVigencia,
} from "../vigencia.ts";

/** Un día que publica la página (`BUILD_DATE`), fijo para que estos casos digan lo mismo dentro de un año. */
const PUBLICA = "2026-08-30";

/** El día que queda a `dias` del de publicación. */
function selloDeHace(dias: number): string {
  const cuando = new Date(Date.parse(`${PUBLICA}T12:00:00Z`) - dias * 86_400_000);
  return cuando.toISOString().slice(0, 10);
}

test("el sello recién escrito por G2 no cambia nada: la sección sostiene el «en vigor hoy»", () => {
  assert.equal(estadoDeVigencia(PUBLICA, PUBLICA), "comprobada");
  assert.equal(avisoDeVigencia("comprobada"), null);
  assert.equal(rotuloDeVigencia("comprobada"), "Vigencia comprobada contra el BOE el");
});

test("los umbrales muerden en el día que dicen, no uno antes ni uno después", () => {
  // El borde es lo único que hay que probar de un umbral: dentro no pasa nada y fuera sí.
  assert.equal(estadoDeVigencia(selloDeHace(DIAS_SELLO_CORRIENTE), PUBLICA), "comprobada");
  assert.equal(estadoDeVigencia(selloDeHace(DIAS_SELLO_CORRIENTE + 1), PUBLICA), "envejecida");
  assert.equal(estadoDeVigencia(selloDeHace(DIAS_SELLO_RANCIO), PUBLICA), "envejecida");
  assert.equal(estadoDeVigencia(selloDeHace(DIAS_SELLO_RANCIO + 1), PUBLICA), "sin_comprobar");
});

test("el sello del hallazgo —siete años— deja la sección sin poder afirmar que esté comprobada", () => {
  const estado = estadoDeVigencia("2019-04-07", PUBLICA);
  assert.equal(estado, "sin_comprobar");
  assert.equal(diasDesdeLaComprobacion("2019-04-07", PUBLICA), 2702);
  // Lo que el lector ve de más, y lo que deja de ver: ya no se le dice «comprobada».
  assert.notEqual(rotuloDeVigencia(estado), rotuloDeVigencia("comprobada"));
  assert.match(avisoDeVigencia(estado) ?? "", /no puede decir que estas cifras sean las que están en vigor hoy/u);
});

test("los avisos dicen una COTA INFERIOR, que es lo único que sigue siendo verdad al envejecer", () => {
  // El HTML se queda en el teléfono de quien lo abrió. «Hace 9 días» sería mentira mañana; «hace
  // más de 7» lo sigue siendo dentro de un mes. Y el número sale del umbral, no de la mano.
  assert.match(avisoDeVigencia("envejecida") ?? "", new RegExp(`más de ${DIAS_SELLO_CORRIENTE} días`, "u"));
  assert.match(avisoDeVigencia("sin_comprobar") ?? "", new RegExp(`más de ${DIAS_SELLO_RANCIO} días`, "u"));
});

test("un sello ilegible o con fecha futura se trata como el peor caso, y no levanta", () => {
  // Levantar aquí tumbaría el build de las 191 páginas por una fecha mal escrita, y la marea es a
  // lo que se viene a esta página. Elegir el peor caso es lo mismo que hace G2 cuando no puede
  // preguntar: una comprobación que no se puede leer no es una comprobación.
  for (const roto of ["", "ayer", "2026-8-30", "30/08/2026", "2026-08-30T00:00:00Z"]) {
    assert.equal(estadoDeVigencia(roto, PUBLICA), "sin_comprobar", roto);
    assert.equal(diasDesdeLaComprobacion(roto, PUBLICA), null, roto);
  }
  assert.equal(estadoDeVigencia("2027-01-01", PUBLICA), "sin_comprobar");
});

test("los tres estados escriben cosas distintas: sin eso, degradar no se nota", () => {
  const escritos = (["comprobada", "envejecida", "sin_comprobar"] as const).map(
    (estado) => `${rotuloDeVigencia(estado)}|${avisoDeVigencia(estado) ?? ""}`,
  );
  assert.equal(new Set(escritos).size, 3);
});
