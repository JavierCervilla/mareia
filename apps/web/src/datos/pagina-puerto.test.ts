/**
 * La carrera del mes es la que decide el aviso de «marea de centímetros», así que su caso
 * degenerado —un mes sin un solo extremo— importa más de lo que parece: si devolviera 0, el aviso
 * se apagaría **en silencio** justo en el puerto cuyo dataset está roto.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { TideEventDto } from "@mareia/usecases";

import { carreraDe, CARRERA_MICROMAREAL_M } from "./pagina-puerto.ts";

const extremo = (height_m: number): TideEventDto => ({
  kind: "high",
  height_m,
  timeUtcMs: 0,
  timeUtc: "2026-08-01T00:00:00.000Z",
});

test("la carrera va de la bajamar más baja a la pleamar más alta", () => {
  assert.equal(carreraDe([extremo(0.4), extremo(3.6), extremo(1.1)], "2026-08", "vigo"), 3.2);
});

test("un mes sin extremos rompe el build en vez de apagar el aviso en silencio", () => {
  assert.throws(
    () => carreraDe([], "2026-08-01..2026-08-31", "puerto-roto"),
    /puerto-roto.*ni un extremo|ni un extremo.*puerto-roto/s,
  );
});

test("el umbral micromareal deja fuera al vecino más cercano del catálogo", () => {
  // Málaga, 0,59 m en su mes más flojo de 2026-2027, es el puerto NO micromareal más cercano al
  // umbral; Cabo de Palos, 0,27 m en el suyo más amplio, el micromareal más lejano.
  assert.ok(0.59 > CARRERA_MICROMAREAL_M);
  assert.ok(0.271 < CARRERA_MICROMAREAL_M);
});
