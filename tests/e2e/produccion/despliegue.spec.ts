/**
 * Lo que este recorrido comprueba, contra el **dominio real**, es que el despliegue de T-15 hizo
 * las tres cosas que prometía:
 *
 * 1. `/v1/ports` responde — el API está en pie y no devolviendo el 502 que devolvía por no tener
 *    imagen;
 * 2. `/health` **no** es alcanzable desde fuera — el dominio publica solo `/v1/*`;
 * 3. la portada sigue sirviéndose — enganchar el API al dominio no se llevó por delante la web,
 *    que llevaba publicada desde T-17.
 *
 * Está pensado para correrse **justo después de desplegar**, y también **sin haber desplegado**:
 * en ese caso tiene que decir con todas las letras que el servicio no está, en vez de escupir un
 * `net::ERR_CONNECTION_REFUSED` o un `TypeError: fetch failed` que obliga a adivinar si la avería
 * es del despliegue, del DNS o de la máquina desde la que se lanzó.
 *
 *     pnpm test:e2e:prod
 */

import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";

const ORIGEN = process.env["MAREIA_URL"] ?? "https://mareia.cervilla.es";

/** Lo que responde el healthcheck. Que esto NO aparezca en el dominio es medio recorrido. */
const HUELLA_DEL_HEALTHCHECK = '"service":"mareia-api"';

/**
 * Pide una ruta traduciendo el fallo de red —no hay nada escuchando, o el DNS no resuelve— a una
 * frase que se entiende sin abrir el código. Es lo que hace que este recorrido se pueda lanzar
 * **antes** de desplegar sin que el resultado sea un jeroglífico.
 *
 * Que un fallo de conexión ponga en rojo incluso a la comprobación de que `/health` NO está: es a
 * propósito. «No pude preguntar» y «pregunté y no estaba» no son lo mismo, y dar por buena la
 * ausencia porque no se llegó al dominio es cómo un recorrido se queda verde para siempre el día
 * que alguien le cambia la URL.
 */
async function intentar(request: APIRequestContext, ruta: string): Promise<APIResponse> {
  try {
    return await request.get(ruta, { maxRedirects: 5, failOnStatusCode: false });
  } catch (cause) {
    throw new Error(
      `No se pudo ni conectar con ${ORIGEN}${ruta}.\n` +
        `  Esto NO es un fallo del recorrido: o el dominio no resuelve, o no hay nada escuchando, ` +
        `o la máquina desde la que se lanza no tiene salida.\n` +
        `  Si el despliegue aún no se ha hecho, es lo esperado: despliega y vuelve a lanzarlo.\n` +
        `  Causa original: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}

/**
 * Lo mismo, más el segundo modo de «no está»: el 5xx del proxy, que es un diagnóstico distinto
 * —hay un Traefik delante, pero detrás no arranca nadie— y lleva a mirar otro sitio.
 */
async function pedir(request: APIRequestContext, ruta: string): Promise<APIResponse> {
  const response = await intentar(request, ruta);

  if (response.status() >= 502 && response.status() <= 504) {
    throw new Error(
      `${ORIGEN}${ruta} contesta ${response.status()}: hay un proxy delante, pero el servicio de ` +
        `detrás no está sirviendo.\n` +
        `  Es exactamente el síntoma que T-15 existe para quitar. Mira si el contenedor arrancó y ` +
        `si el puerto declarado en Dokploy es el que el proceso escucha (8787 para el API, 3000 ` +
        `para la web); un contenedor 'running' con el puerto mal declarado da este mismo 502.`,
    );
  }

  return response;
}

test("el API responde: GET /v1/ports trae el catálogo con su calidad", async ({ request }) => {
  const response = await pedir(request, "/v1/ports");
  expect(response.status(), `${ORIGEN}/v1/ports debería responder 200`).toBe(200);

  const cuerpo = (await response.json()) as {
    ports?: readonly { slug?: string; quality?: unknown }[];
  };
  const puertos = cuerpo.ports ?? [];
  // No se fija el número exacto: el catálogo crece, y un recorrido que se pone rojo porque se
  // añadió un puerto enseña a ignorarlo. Lo que no puede pasar es que llegue vacío o descabezado.
  expect(puertos.length, "el catálogo llegó vacío").toBeGreaterThan(100);
  expect(puertos[0]?.slug, "las entradas del catálogo no traen slug").toBeTruthy();
  // La calidad es lo que T-14B metió en el catálogo: si el dominio sirviera una versión anterior
  // del API, esto es lo primero que faltaría.
  expect(puertos.every((p) => p.quality !== undefined), "hay entradas sin `quality`").toBe(true);
});

test("/health NO es alcanzable desde fuera", async ({ request }) => {
  // `intentar()` y no `pedir()`: un 502 es una respuesta *aceptable* para esta pregunta —nadie
  // publica el healthcheck— y no tiene sentido abortar por él. Lo único inaceptable es que
  // conteste.
  const response = await intentar(request, "/health");
  const cuerpo = await response.text();

  expect(
    cuerpo,
    `${ORIGEN}/health devolvió el payload del healthcheck: está publicado en internet`,
  ).not.toContain(HUELLA_DEL_HEALTHCHECK);
  expect(
    response.status(),
    `${ORIGEN}/health respondió 200; el dominio debe publicar solo /v1/*`,
  ).not.toBe(200);
});

test("la portada sigue sirviéndose", async ({ request }) => {
  const response = await pedir(request, "/");
  expect(response.status(), `${ORIGEN}/ debería responder 200`).toBe(200);

  const html = await response.text();
  // El `<title>` y no un texto de la página: es lo que menos se mueve con un rediseño, y lo que
  // distingue «la portada del portal» de «una página de error con estado 200», que es la avería
  // que de verdad se está buscando.
  expect(html, "la portada no parece la del portal").toContain("<title>Mareia");
});
