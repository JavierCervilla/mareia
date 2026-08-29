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
 * Informe: `docs/qa/informe-adversario-t18.md`.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { BulletinPayload, WeatherPayload } from "@mareia/module-weather/ui";

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

/** El mismo trinquete que el gemelo del módulo: verde con el hallazgo abierto, rojo al arreglarlo. */
function hallazgoAbierto(nombre: string, senaDelFallo: string, cuerpo: () => void): void {
  test(nombre, () => {
    let fallo: unknown;
    try {
      cuerpo();
    } catch (error) {
      fallo = error;
    }
    assert.notEqual(
      fallo,
      undefined,
      `TRINQUETE · «${nombre}» YA NO FALLA: el hallazgo parece corregido. Quita el envoltorio ` +
        `hallazgoAbierto() y deja el cuerpo como gate permanente.`,
    );
    const texto = fallo instanceof Error ? fallo.message : String(fallo);
    assert.ok(
      texto.includes(senaDelFallo),
      `TRINQUETE · «${nombre}» falla por un motivo que no es el hallazgo: esperaba «${senaDelFallo}» ` +
        `y llegó «${texto}».`,
    );
  });
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
 */
const REASON_HOSTIL =
  "AEMET boletín costero rechazó la petición (estado 401): API key expirada. " +
  "Solicite una nueva en https://opendata.aemet.es/centrodedescargas/altaUsuario";

for (const credencial of [
  { status: "valid", expiresAt: "2026-11-20T00:00:00.000Z", daysLeft: 83, source: "jwt-exp" },
  { status: "expired", expiresAt: "2026-07-20T00:00:00.000Z", daysLeft: -40, source: "jwt-exp" },
]) {
  hallazgoAbierto(
    `A-18 · la sección pinta el manual de renovación que escribió AEMET (credencial '${credencial.status}')`,
    "acaba en la pantalla",
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
