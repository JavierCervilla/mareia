/**
 * A9 · **Para un lector de pantalla, la sección meteo se queda en el estado que salió del `dist/`.**
 *
 * La sección declara `aria-busy` y lo mueve de `"true"` a `"false"` cuando llega el dato. `aria-busy`
 * dice *«esto está cambiando, no lo leas todavía»*: **no anuncia nada**. El contenido lo sustituye
 * `replaceChildren` dentro de un contenedor que no es región viva, así que quien navega con lector
 * de pantalla oye una vez «El estado del mar todavía no ha llegado» —el cuarto estado, el que viaja
 * en el HTML— y nunca se entera de que llegó el dato, ni de que la fuente se cayó, ni de que lo que
 * hay en pantalla es de hace tres horas.
 *
 * Es el mismo hueco para los otros tres estados: cuando la ausencia es la interesante (la fuente no
 * responde), quien no ve la pantalla se queda con la frase de carga como última información.
 *
 * El assert no pide una implementación concreta: pide que el contenedor cuyo contenido se sustituye
 * sea una región viva, que es la única forma que tiene el DOM de que un cambio se anuncie.
 */

import { expect, test } from "../../fixtures/qa-bundle";

import { PAGINA, fixture, montarApi } from "./utiles";

/**
 * Las regiones vivas de la sección, buscadas en el navegador. Va como expresión en texto porque el
 * `tsconfig` del repo mantiene `lib: ["ES2022"]` a propósito y aquí no hay tipos del DOM.
 */
const REGIONES_VIVAS = `[...document.querySelectorAll("#meteo, #meteo *")]
  .filter((nodo) =>
    nodo.getAttribute("aria-live") !== null ||
    ["status", "alert", "log"].includes(nodo.getAttribute("role") || ""))
  .map((nodo) => nodo.tagName + "[role=" + nodo.getAttribute("role") + "][aria-live=" +
    nodo.getAttribute("aria-live") + "]")`;

test("A9 · el cambio de estado de la sección se anuncia a un lector de pantalla", async ({
  page,
  qa,
}) => {
  qa.step("cargar la página con el API sirviendo un dato normal");
  await montarApi(page, { cuerpo: fixture("weather-ok") }, { cuerpo: fixture("bulletin-ok") });
  await page.goto(PAGINA);
  await expect(page.locator("#meteo-mar")).toContainText("1,68 m");

  qa.step("mirar si algo de la sección declara región viva");
  const vivas = await page.evaluate<readonly string[]>(REGIONES_VIVAS);

  // El comportamiento CORRECTO: el sitio donde aparece el dato (o el motivo de que no lo haya) es
  // una región viva, y por eso el cambio se anuncia. `aria-busy` solo dice «espera»: nunca avisa.
  expect(
    vivas,
    "nada en la sección meteo es región viva: el contenido se sustituye en silencio",
  ).not.toEqual([]);
});
