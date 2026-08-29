/**
 * PASE ADVERSARIO · T-18 — la mitad del ataque que llega **a la página**.
 *
 * El gemelo de este fichero (`packages/modules/weather/src/__tests__/adversario-t18.test.ts`) ataca
 * el cuerpo HTTP. Éste comprueba la otra punta del mismo canal: lo que de ese cuerpo acaba **en la
 * pantalla**, porque un hallazgo que solo se ve en el JSON siempre se puede desestimar diciendo que
 * el JSON no lo lee nadie.
 *
 * `vista.ts` documenta que **no** copia `credential.message` precisamente porque «va dirigido a
 * quien administra la instancia y trae instrucciones de renovación». Cierto — y a la vez compone
 * «(el servidor informa: `${reason}`)» con el `reason` tal cual, que es la puerta por la que entra
 * lo mismo que se quiso dejar fuera, escrito por AEMET en vez de por nosotros (hallazgo **A-18**).
 *
 * **ESTADO: A-18 cerrado.** El filtro se puso en el borde —`reasonFrom`, la única puerta por la que
 * se llena el `reason` público—, así que la pantalla queda limpia por construcción y no porque la
 * vista se acuerde de mirar. El envoltorio `hallazgoAbierto()` gritó «YA NO FALLA» y se retiró: el
 * cuerpo se queda igual, como gate permanente.
 *
 * Informe: `docs/qa/informe-adversario-t18.md`.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { BulletinPayload, WeatherPayload } from "@mareia/module-weather/ui";
import { inspectAemetKey, publicCredentialView, reasonFrom } from "@mareia/module-weather/ui";

import type { BloqueMeteo, RespuestaMeteo, VistaMeteo } from "./vista.ts";
import { vistaMeteo } from "./vista.ts";

import BOLETIN_CLAVE_CADUCADA from "./fixtures/bulletin-clave-caducada.json" with { type: "json" };
import BOLETIN_OK from "./fixtures/bulletin-ok.json" with { type: "json" };
import BOLETIN_SIN_CLAVE from "./fixtures/bulletin-sin-clave.json" with { type: "json" };
import METEO_OK from "./fixtures/weather-ok.json" with { type: "json" };

const ZONA = "Europe/Madrid";
const RECIBIDO = Date.parse("2026-08-28T17:49:00Z");

/** Las mismas señas del canal del operador que vigila el gate de T-18. */
const SENAS_DEL_OPERADOR = [
  "AEMET_API_KEY",
  "opendata.aemet.es",
  "centrodedescargas",
  "Renuévala",
  "actualiza el secreto",
] as const;

function escena(boletin: unknown): VistaMeteo {
  const respuesta: RespuestaMeteo = {
    meteo: { ok: true, cuerpo: METEO_OK as unknown as WeatherPayload },
    boletin: { ok: true, cuerpo: boletin as BulletinPayload },
    recibidoEnMs: RECIBIDO,
  };
  return vistaMeteo(respuesta, RECIBIDO, ZONA);
}

/** Todo el texto que un lector vería de la sección, junto. */
function textoDeLaSeccion(vista: VistaMeteo): string {
  const deBloque = (bloque: BloqueMeteo): readonly string[] => [
    bloque.titulo,
    bloque.sello.titular,
    bloque.sello.detalle ?? "",
    ...bloque.filas.flatMap((fila) => [fila.titulo, fila.valor ?? "", fila.detalle ?? "", fila.ausencia ?? ""]),
    ...(bloque.cita?.parrafos ?? []).flatMap((parrafo) => [parrafo.rotulo, parrafo.texto]),
    bloque.cita?.pie ?? "",
    bloque.nota ?? "",
  ];
  return [vista.resumen ?? "", ...vista.bloques.flatMap(deBloque)].join(" · ");
}

/**
 * A-18 · el manual de renovación llega a la pantalla porque lo escribió AEMET.
 *
 * El `reason` no pasa por ningún filtro entre el sobre de AEMET y el texto que pinta la isla, así
 * que el criterio que T-18 aplicó a nuestras dos copias no alcanza a la tercera. Se ejercitan los
 * dos caminos de `motivoDelBoletin`: con la credencial `valid` el `reason` se pinta **solo**, y con
 * `expired` se pinta detrás de la frase de la credencial.
 *
 * Comportamiento correcto: el texto que lee un humano en la sección no lleva las señas del canal
 * del operador, las haya escrito quien las haya escrito.
 *
 * Lo que este gate mide desde ahora: con un `reason` que **sí** lleva las señas —el 401 redactado
 * como se redactan los errores de credencial—, el texto que la sección produce para la pantalla no
 * publica ninguna de las cinco, por los dos caminos de `motivoDelBoletin`: con la credencial
 * `valid` el `reason` se pinta solo, y con `expired` se pinta detrás de la frase de la credencial.
 * El gate se queda del lado de la pantalla **además** del lado del cuerpo HTTP a propósito: un
 * hallazgo que solo se ve en el JSON siempre se puede desestimar diciendo que el JSON no lo lee
 * nadie, y el filtro podría moverse de sitio sin que la punta de la pantalla se enterase.
 */
/**
 * Lo que AEMET escribiría en un 401 redactado como se redactan los errores de credencial: diciendo
 * dónde se pide una nueva. No está verificado contra AEMET —no hay clave con la que comprobarlo, la
 * misma razón por la que las zonas siguen con `verified: false`— y no hace falta que lo esté: lo que
 * se vigila es que **nada de esto llegue a la pantalla lo escriba quien lo escriba**.
 */
const DESCRIPCION_HOSTIL_DE_AEMET =
  "API key expirada. Solicite una nueva en https://opendata.aemet.es/centrodedescargas/altaUsuario";

/**
 * El `reason` **tal y como llega de verdad**: el mensaje que compone `aemet.ts` para un sobre con
 * `estado != 200`, pasado por `reasonFrom`, que es el borde donde vive el filtro. A propósito no se
 * copia aquí el resultado ya recortado: si alguien quita el filtro del borde, este gate se pone
 * rojo **del lado de la pantalla**, que es donde el hallazgo se podía desestimar diciendo que el
 * JSON no lo lee nadie.
 */
const REASON_HOSTIL = reasonFrom(
  `AEMET boletín costero rechazó la petición (estado 401): ${DESCRIPCION_HOSTIL_DE_AEMET}`,
);

for (const credencial of [
  { status: "valid", expiresAt: "2026-11-20T00:00:00.000Z", daysLeft: 83, source: "jwt-exp" },
  { status: "expired", expiresAt: "2026-07-20T00:00:00.000Z", daysLeft: -40, source: "jwt-exp" },
]) {
  test(
    `A-18 · la sección NO pinta el manual de renovación aunque lo escriba AEMET (credencial '${credencial.status}')`,
    () => {
      const vista = escena({
        ...(BOLETIN_CLAVE_CADUCADA as unknown as Record<string, unknown>),
        credential: { ...credencial, message: "da igual: la vista no copia esta frase" },
        status: "unavailable",
        reason: REASON_HOSTIL,
      });
      const texto = textoDeLaSeccion(vista);
      for (const sena of SENAS_DEL_OPERADOR) {
        assert.ok(
          !texto.includes(sena),
          `la seña «${sena}» acaba en la pantalla por el \`reason\` sin filtrar: ${texto}`,
        );
      }
    },
  );
}

/**
 * GATE · el bloque `credential` de los tres fixtures es la proyección de la función real.
 *
 * Aquí estaba commiteado el segundo canal de A-20: `bulletin-clave-caducada.json` llevaba
 * `daysLeft: -40` junto a un `expiresAt` de hacía **39** días, y llevaba también la frase que
 * afirmaba la consecuencia falsa de A-17. Un fixture es un dato como cualquier otro: se re-proyecta
 * con la función que lo produce, no se edita a mano, o vuelve a decir lo que decía antes del
 * arreglo y encima con aire de captura.
 *
 * El instante de captura es el `fetchedAt` de `bulletin-ok` (y el `RECIBIDO` de estos recorridos):
 * es lo que ata el número al reloj y lo que hace comprobable la proyección.
 */
const CAPTURADOS_EN = Date.parse("2026-08-28T17:49:00Z");

/** JWT sintético con la caducidad de cada fixture: aquí solo se lee el `exp`. */
function jwtQueCaducaEn(iso: string): string {
  const b64 = (valor: unknown): string =>
    btoa(JSON.stringify(valor)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ exp: Date.parse(iso) / 1000 })}.firma-de-prueba`;
}

test("GATE · el `credential` de los fixtures es lo que proyecta el módulo, no un JSON escrito a mano", () => {
  for (const [nombre, fixture, clave] of [
    ["bulletin-ok", BOLETIN_OK, jwtQueCaducaEn("2026-11-20T00:00:00.000Z")],
    ["bulletin-clave-caducada", BOLETIN_CLAVE_CADUCADA, jwtQueCaducaEn("2026-07-20T00:00:00.000Z")],
    ["bulletin-sin-clave", BOLETIN_SIN_CLAVE, undefined],
  ] as const) {
    assert.deepEqual(
      (fixture as unknown as { credential: unknown }).credential,
      publicCredentialView(inspectAemetKey(clave, CAPTURADOS_EN)),
      `el \`credential\` de ${nombre} ya no es lo que el módulo publicaría: re-proyéctalo con ` +
        `\`publicCredentialView(inspectAemetKey(...))\` en vez de editar el JSON`,
    );
  }
});

/**
 * GATE · los tres fixtures que T-18 re-proyectó siguen limpios.
 *
 * Es el artefacto que de verdad se hornea: estos tres JSON son los que la web sirve en los
 * recorridos y los que alimentan `dist/`. Atacado y no roto — se queda vigilando, porque
 * re-capturar un fixture del módulo es justo el gesto que podría volver a meter la prosa dentro.
 */
test("GATE · ningún fixture de boletín de la web lleva las señas del canal del operador", () => {
  for (const [nombre, fixture] of [
    ["bulletin-ok", BOLETIN_OK],
    ["bulletin-clave-caducada", BOLETIN_CLAVE_CADUCADA],
    ["bulletin-sin-clave", BOLETIN_SIN_CLAVE],
  ] as const) {
    const crudo = JSON.stringify(fixture);
    const pantalla = textoDeLaSeccion(escena(fixture));
    for (const sena of SENAS_DEL_OPERADOR) {
      assert.ok(!crudo.includes(sena), `el fixture ${nombre} lleva la seña «${sena}»: ${crudo}`);
      assert.ok(!pantalla.includes(sena), `${nombre} pinta la seña «${sena}»: ${pantalla}`);
    }
  }
});
