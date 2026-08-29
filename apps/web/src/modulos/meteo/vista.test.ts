/**
 * Los estados de la sección meteo, uno por uno.
 *
 * Esto **no** es un test de casos borde: los estados degradados son el corazón de T-11. Lo que se
 * afirma en cada uno es que **no se puede confundir con los otros tres**, y por eso los asserts
 * miran la frase que lee un humano y no un código interno: un `clase: "caducado"` que sale a la
 * pantalla como el mismo texto que un `ok` sería verde aquí y mentira en la playa.
 *
 * Los fixtures son **capturas del módulo real** (T-08) montado en Express, no JSON escritos a mano:
 * ver `fixtures/README.md`. Aquí no hay red — ni la hay en el módulo cuando se capturaron los
 * estados degradados.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { BulletinPayload, WeatherPayload } from "@mareia/module-weather/ui";

import type { BloqueMeteo, RespuestaMeteo, VistaMeteo } from "./vista.ts";
import { PIDIENDO, antiguedad, parrafosDelBoletin, vistaMeteo } from "./vista.ts";

import BOLETIN_CLAVE_CADUCADA from "./fixtures/bulletin-clave-caducada.json" with { type: "json" };
import BOLETIN_OK from "./fixtures/bulletin-ok.json" with { type: "json" };
import BOLETIN_SIN_CLAVE from "./fixtures/bulletin-sin-clave.json" with { type: "json" };
import METEO_HUECOS from "./fixtures/weather-huecos.json" with { type: "json" };
import METEO_NO_DISPONIBLE from "./fixtures/weather-no-disponible.json" with { type: "json" };
import METEO_OK from "./fixtures/weather-ok.json" with { type: "json" };
import METEO_PARCIAL from "./fixtures/weather-parcial.json" with { type: "json" };
import METEO_STALE from "./fixtures/weather-stale.json" with { type: "json" };

const ZONA = "Europe/Madrid";
/** Instante en que llegaron las respuestas al navegador, en todos los escenarios. */
const RECIBIDO = Date.parse("2026-08-28T17:49:00Z");

function meteoDe(fixture: unknown): WeatherPayload {
  return fixture as WeatherPayload;
}

function boletinDe(fixture: unknown): BulletinPayload {
  return fixture as BulletinPayload;
}

function escena(
  meteo: unknown,
  boletin: unknown,
  opciones: { readonly ahoraMs?: number } = {},
): VistaMeteo {
  const respuesta: RespuestaMeteo = {
    meteo: { ok: true, cuerpo: meteoDe(meteo) },
    boletin: { ok: true, cuerpo: boletinDe(boletin) },
    recibidoEnMs: RECIBIDO,
  };
  return vistaMeteo(respuesta, opciones.ahoraMs ?? RECIBIDO, ZONA);
}

function bloque(vista: VistaMeteo, id: string): BloqueMeteo {
  const encontrado = vista.bloques.find((candidato) => candidato.id === id);
  assert.ok(encontrado, `la vista no trae el bloque ${id}`);
  return encontrado;
}

/** Todo el texto que un lector vería de un bloque, junto: sello, filas, cita y nota. */
function textoDe(bloqueMeteo: BloqueMeteo): string {
  return [
    bloqueMeteo.sello.titular,
    bloqueMeteo.sello.detalle ?? "",
    ...bloqueMeteo.filas.flatMap((fila) => [fila.titulo, fila.valor ?? "", fila.detalle ?? "", fila.ausencia ?? ""]),
    ...(bloqueMeteo.cita?.parrafos ?? []).flatMap((parrafo) => [parrafo.rotulo, parrafo.texto]),
    bloqueMeteo.cita?.pie ?? "",
    bloqueMeteo.nota ?? "",
  ].join(" | ");
}

// --- Estado 1: ok --------------------------------------------------------------------------------

test("estado ok: cada bloque dice cuándo se consultó y ninguno se anuncia como caducado", () => {
  const vista = escena(METEO_OK, BOLETIN_OK);

  assert.equal(vista.resumen, undefined, "con dato no hay frase global que tape los bloques");
  for (const id of ["meteo-mar", "meteo-atmosfera", "meteo-boletin"]) {
    const actual = bloque(vista, id);
    assert.equal(actual.sello.clase, "fresco", `${id} debería estar fresco`);
    assert.match(actual.sello.titular, /^Consultado hace /u);
    assert.doesNotMatch(textoDe(actual), /caducad|no es de ahora/iu);
  }
});

test("estado ok: el mar y la atmósfera traen sus magnitudes con dirección en rosa y grados", () => {
  const vista = escena(METEO_OK, BOLETIN_OK);
  const mar = textoDe(bloque(vista, "meteo-mar"));
  const atmosfera = textoDe(bloque(vista, "meteo-atmosfera"));

  // Los valores son los de la captura real de Open-Meteo para la celda 42,2 / -8,7.
  assert.match(mar, /Ola \| 1,68 m \| de 287° \(ONO\) · periodo 8,9 s/u);
  assert.match(mar, /Mar de fondo \| 1,68 m \| de 287° \(ONO\) · periodo 7,5 s/u);
  assert.match(mar, /Temperatura del agua \| 18,3 °C/u);
  assert.match(atmosfera, /Viento \| 9,4 km\/h \| de 272° \(O\) · rachas 20,2 km\/h/u);
  assert.match(atmosfera, /Presión \| 1021,5 hPa/u);
  assert.match(atmosfera, /Visibilidad \| 33,6 km/u);
  assert.match(atmosfera, /Índice UV \| 1,3/u);
});

test("un 0 del modelo es un cero, no un hueco: la mar de viento en calma se publica", () => {
  const mar = bloque(escena(METEO_OK, BOLETIN_OK), "meteo-mar");
  const marDeViento = mar.filas.find((fila) => fila.titulo === "Mar de viento");

  assert.ok(marDeViento);
  assert.equal(marDeViento.valor, "0,00 m");
  assert.equal(marDeViento.ausencia, undefined, "un 0 medido no puede pintarse como ausencia");
});

test("el instante del modelo y el de la consulta son dos relojes distintos y se dicen aparte", () => {
  const mar = bloque(escena(METEO_OK, BOLETIN_OK), "meteo-mar");
  const modelo = mar.filas.find((fila) => fila.titulo === "Momento al que se refiere");

  assert.ok(modelo, "falta la fila del instante del modelo");
  // 17:45 UTC del fixture, en hora de Vigo (CEST, +2).
  assert.equal(modelo.valor, "19:45");
  // Y el sello habla de otra cosa: de cuándo se le preguntó a Open-Meteo (17:49 UTC).
  assert.match(mar.sello.detalle ?? "", /Open-Meteo respondió a las 19:49/u);
});

// --- Estado 2: stale (dato servido de caché caducada) --------------------------------------------

test("estado stale: la antigüedad va en la cara, con horas y minutos", () => {
  const vista = escena(METEO_STALE, BOLETIN_OK);
  const mar = bloque(vista, "meteo-mar");

  assert.equal(mar.sello.clase, "caducado");
  assert.equal(mar.sello.titular, "Dato de hace 3 h 10 min");
  assert.match(mar.sello.detalle ?? "", /No es de ahora/u);
  assert.match(mar.sello.detalle ?? "", /no responde en este momento/u);
});

test("estado stale: sigue enseñando el dato viejo, que para eso lo guarda el backend", () => {
  const mar = bloque(escena(METEO_STALE, BOLETIN_OK), "meteo-mar");

  assert.match(textoDe(mar), /Ola \| 1,68 m/u, "un dato caducado se publica, marcado, no se esconde");
});

test("la edad se mide como intervalo desde que llegó la respuesta, no con el reloj del cliente", () => {
  const cincoMinutosDespues = RECIBIDO + 5 * 60_000;
  const mar = bloque(
    escena(METEO_STALE, BOLETIN_OK, { ahoraMs: cincoMinutosDespues }),
    "meteo-mar",
  );

  assert.equal(mar.sello.titular, "Dato de hace 3 h 15 min", "el dato envejece mientras se mira");
});

test("un reloj de navegador atrasado no rejuvenece el dato", () => {
  // El navegador cree que son dos horas ANTES de recibir la respuesta: reloj torcido, caso real en
  // móviles sin sincronizar. La edad no puede bajar de la que declaró el servidor.
  const relojAtrasado = RECIBIDO - 2 * 3_600_000;
  const mar = bloque(escena(METEO_STALE, BOLETIN_OK, { ahoraMs: relojAtrasado }), "meteo-mar");

  assert.equal(mar.sello.titular, "Dato de hace 3 h 10 min");
});

// --- Estado 3: unavailable (con el motivo del backend) -------------------------------------------

test("estado unavailable: cada bloque publica el motivo que da el backend y no un hueco", () => {
  const vista = escena(METEO_NO_DISPONIBLE, BOLETIN_SIN_CLAVE);
  const mar = bloque(vista, "meteo-mar");

  assert.equal(mar.sello.clase, "sin-dato");
  assert.equal(mar.sello.titular, "No se ha podido traer");
  assert.equal(mar.sello.detalle, "Open-Meteo marine no respondió: ECONNREFUSED");
  assert.deepEqual(mar.filas, [], "sin dato no se pintan filas con guiones");
  assert.equal(
    vista.resumen,
    "Ahora mismo no hay estado del mar que enseñar. Debajo, de cada fuente, el motivo.",
  );
});

test("sin credencial de AEMET el boletín explica el hueco en vez de desaparecer", () => {
  const boletin = bloque(escena(METEO_NO_DISPONIBLE, BOLETIN_SIN_CLAVE), "meteo-boletin");

  assert.equal(boletin.sello.clase, "sin-dato");
  assert.match(boletin.sello.detalle ?? "", /no tiene credencial de AEMET/u);
  assert.match(boletin.sello.detalle ?? "", /no publica el boletín oficial/u);
  // El motivo técnico del backend sigue ahí: no se esconde lo que dijo el servidor.
  assert.match(boletin.sello.detalle ?? "", /falta la variable de entorno AEMET_API_KEY/u);
});

test("con la credencial caducada, el «HTTP 401» va acompañado de la causa de verdad", () => {
  const boletin = bloque(escena(METEO_OK, BOLETIN_CLAVE_CADUCADA), "meteo-boletin");

  assert.equal(boletin.sello.clase, "sin-dato");
  assert.match(boletin.sello.detalle ?? "", /credencial de AEMET de esta instancia caducó el 2026-07-20/u);
  assert.match(boletin.sello.detalle ?? "", /el servidor informa: .*HTTP 401/u);
  // Nada de instrucciones de administración en una página pública.
  assert.doesNotMatch(boletin.sello.detalle ?? "", /Renuévala|actualiza el secreto/u);
});

test("degradación parcial: una fuente caída no arrastra a la que sí respondió", () => {
  const vista = escena(METEO_PARCIAL, BOLETIN_OK);

  assert.equal(bloque(vista, "meteo-mar").sello.clase, "fresco");
  assert.equal(bloque(vista, "meteo-atmosfera").sello.clase, "sin-dato");
  assert.equal(vista.resumen, undefined, "queda dato: la frase global taparía al bloque que sí lo tiene");
});

// --- Estado 4: el navegador no llegó a preguntar --------------------------------------------------

test("si el navegador no puede pedir al API, lo dice con SU motivo y no con el de una fuente", () => {
  const vista = vistaMeteo(
    {
      meteo: { ok: false, motivo: "No se ha podido pedir el estado del mar al servidor de Mareia." },
      boletin: { ok: false, motivo: "No se ha podido pedir el boletín al servidor de Mareia." },
      recibidoEnMs: RECIBIDO,
    },
    RECIBIDO,
    ZONA,
  );

  assert.equal(vista.bloques.length, 3);
  for (const bloqueMeteo of vista.bloques) {
    assert.equal(bloqueMeteo.sello.clase, "sin-dato");
    assert.match(bloqueMeteo.sello.detalle ?? "", /al servidor de Mareia/u);
    assert.doesNotMatch(bloqueMeteo.sello.detalle ?? "", /Open-Meteo|AEMET/u);
  }
  assert.ok(vista.resumen, "sin ningún dato, la sección abre diciéndolo");
});

// --- Mientras el endpoint viaja: el bloque existe y dice QUÉ está pidiendo ------------------------

test("mientras los dos endpoints viajan, cada bloque dice qué se está pidiendo", () => {
  const vista = vistaMeteo(
    { meteo: PIDIENDO, boletin: PIDIENDO, recibidoEnMs: RECIBIDO },
    RECIBIDO,
    ZONA,
  );

  assert.deepEqual(
    vista.bloques.map((bloqueMeteo) => bloqueMeteo.sello.titular),
    [
      "Pidiendo el estado del mar…",
      "Pidiendo el estado de la atmósfera…",
      "Pidiendo el boletín de AEMET…",
    ],
  );
  assert.equal(
    vista.resumen,
    undefined,
    "estar pidiendo no es «no hay estado del mar que enseñar»: todavía no se sabe",
  );
});

test("el mar que ya llegó no espera al boletín: se pinta con su sello mientras el otro viaja", () => {
  const vista = vistaMeteo(
    { meteo: { ok: true, cuerpo: meteoDe(METEO_OK) }, boletin: PIDIENDO, recibidoEnMs: RECIBIDO },
    RECIBIDO,
    ZONA,
  );

  assert.equal(bloque(vista, "meteo-mar").sello.clase, "fresco");
  assert.match(textoDe(bloque(vista, "meteo-mar")), /Ola \| 1,68 m/u);
  assert.equal(bloque(vista, "meteo-boletin").sello.clase, "pidiendo");
});

test("pedir todavía no se puede confundir con no haber podido traer", () => {
  const pidiendo = vistaMeteo(
    { meteo: PIDIENDO, boletin: PIDIENDO, recibidoEnMs: RECIBIDO },
    RECIBIDO,
    ZONA,
  );
  const sinDato = vistaMeteo(
    {
      meteo: { ok: false, motivo: "No se ha podido pedir el estado del mar al servidor de Mareia." },
      boletin: PIDIENDO,
      recibidoEnMs: RECIBIDO,
    },
    RECIBIDO,
    ZONA,
  );

  assert.notEqual(
    bloque(pidiendo, "meteo-mar").sello.titular,
    bloque(sinDato, "meteo-mar").sello.titular,
  );
  assert.notEqual(bloque(pidiendo, "meteo-mar").sello.clase, bloque(sinDato, "meteo-mar").sello.clase);
});

// --- El otro ausente: la fuente respondió pero el modelo no publica el valor ----------------------

test("un hueco del modelo NO se dice como una fuente caída: son dos ausencias distintas", () => {
  const vista = escena(METEO_HUECOS, BOLETIN_OK);
  const mar = bloque(vista, "meteo-mar");

  // La fuente respondió: el sello es de dato fresco, no de fallo.
  assert.equal(mar.sello.clase, "fresco");
  const ola = mar.filas.find((fila) => fila.titulo === "Ola");
  assert.ok(ola);
  assert.equal(ola.valor, undefined);
  assert.equal(ola.ausencia, "el modelo no publica la altura de esta ola en esta celda");
  // Y la atmósfera de la misma celda sí trae valores: el hueco es del modelo de oleaje, no del día.
  assert.match(textoDe(bloque(vista, "meteo-atmosfera")), /Viento \| 7,0 km\/h/u);
});

// --- El boletín: se cita, no se reescribe ---------------------------------------------------------

test("el boletín se cita con su rótulo, su zona y su hora de emisión", () => {
  const boletin = bloque(escena(METEO_OK, BOLETIN_OK), "meteo-boletin");

  assert.ok(boletin.cita);
  assert.deepEqual(
    boletin.cita.parrafos.map((parrafo) => parrafo.rotulo),
    ["Avisos", "Situación", "Predicción"],
  );
  // Palabra por palabra lo que devolvió AEMET: ni resumido ni traducido a nuestro vocabulario.
  assert.equal(
    boletin.cita.parrafos[2]?.texto,
    "Viento del noroeste fuerza 4 a 5, arreciando a 5 a 6 por la tarde en las Rías Bajas. Mar " +
      "rizada o marejada, aumentando a marejadilla o marejada. Mar de fondo del noroeste de 1 a 2 " +
      "metros. Visibilidad buena, localmente regular por bancos de niebla matinales.",
  );
  assert.equal(boletin.cita.pie, "AEMET · Costa de Pontevedra · emitido a las 13:00");
});

test("una zona sin verificar contra el catálogo de AEMET se publica diciéndolo", () => {
  const boletin = bloque(escena(METEO_OK, BOLETIN_OK), "meteo-boletin");

  assert.match(boletin.nota ?? "", /código de zona de AEMET todavía no se ha comprobado/u);
});

test("un documento con forma desconocida no se adivina: se dice que no se reconoce", () => {
  const raro = { ...boletinDe(BOLETIN_OK), document: [{ vaya: "otra cosa" }] };
  const vista = vistaMeteo(
    { meteo: { ok: true, cuerpo: meteoDe(METEO_OK) }, boletin: { ok: true, cuerpo: raro }, recibidoEnMs: RECIBIDO },
    RECIBIDO,
    ZONA,
  );
  const boletin = bloque(vista, "meteo-boletin");

  assert.deepEqual(boletin.cita?.parrafos, []);
  assert.match(boletin.nota ?? "", /no se reescribe ni se adivina lo que dice/u);
});

test("sin hora de elaboración, el pie dice que falta esa hora y no otra cosa", () => {
  const sinHora = { ...boletinDe(BOLETIN_OK), issuedAt: null };
  const vista = vistaMeteo(
    { meteo: { ok: true, cuerpo: meteoDe(METEO_OK) }, boletin: { ok: true, cuerpo: sinHora }, recibidoEnMs: RECIBIDO },
    RECIBIDO,
    ZONA,
  );

  assert.equal(
    bloque(vista, "meteo-boletin").cita?.pie,
    "AEMET · Costa de Pontevedra · AEMET no declara la hora de elaboración en este documento",
  );
});

test("los párrafos se extraen igual si AEMET los sirve en lista de zonas", () => {
  const enLista = [{ prediccion: { zona: [{ texto: "Marejadilla." }, { texto: "Viento flojo." }] } }];

  assert.deepEqual(parrafosDelBoletin(enLista), [
    { rotulo: "Predicción", texto: "Marejadilla." },
    { rotulo: "Predicción", texto: "Viento flojo." },
  ]);
});

// --- La escala de antigüedad ----------------------------------------------------------------------

test("la antigüedad se escribe en la escala en la que se decide si el dato sirve", () => {
  assert.equal(antiguedad(0), "menos de un minuto");
  assert.equal(antiguedad(59), "menos de un minuto");
  assert.equal(antiguedad(60), "1 minuto");
  assert.equal(antiguedad(12 * 60), "12 minutos");
  assert.equal(antiguedad(3_600), "1 h");
  assert.equal(antiguedad(3 * 3_600 + 10 * 60), "3 h 10 min");
  assert.equal(antiguedad(86_400), "1 día");
  assert.equal(antiguedad(2 * 86_400 + 4 * 3_600), "2 días 4 h");
});
