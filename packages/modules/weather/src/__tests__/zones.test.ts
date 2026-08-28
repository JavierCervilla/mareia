/**
 * Coherencia del mapeo de zonas con el catálogo de puertos del dataset.
 *
 * Igual que `ports.json` ↔ `stations/*.json` en `@mareia/adapters`: un mapeo escrito a mano y sin
 * test es un mapeo que se desincroniza. Este fichero hace que **añadir un puerto al piloto y
 * olvidarse de su zona marítima** salga en rojo aquí y no en un `bulletin` vacío en producción.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { COASTAL_ZONES, zoneForPort } from "../zones.ts";

const PORTS_JSON = fileURLToPath(new URL("../../../../../data/geo/ports.json", import.meta.url));

function catalogueSlugs(): readonly string[] {
  const parsed: unknown = JSON.parse(readFileSync(PORTS_JSON, "utf8"));
  const ports = (parsed as { ports?: readonly { slug: string }[] }).ports ?? [];
  return ports.map((port) => port.slug);
}

test("los 12 puertos del piloto tienen zona marítima asignada", () => {
  const slugs = catalogueSlugs();
  assert.equal(slugs.length, 12);
  for (const slug of slugs) {
    assert.ok(zoneForPort(slug) !== undefined, `el puerto '${slug}' no tiene zona de AEMET`);
  }
});

test("el mapeo no inventa puertos que no estén en el catálogo", () => {
  const slugs = new Set(catalogueSlugs());
  for (const zone of COASTAL_ZONES) {
    for (const slug of zone.ports) {
      assert.ok(slugs.has(slug), `la zona ${zone.code} apunta a un puerto inexistente: '${slug}'`);
    }
  }
});

test("los códigos de zona son únicos y de dos cifras", () => {
  const codes = COASTAL_ZONES.map((zone) => zone.code);
  assert.equal(new Set(codes).size, codes.length, "hay códigos de zona repetidos");
  for (const code of codes) {
    assert.match(code, /^\d{2}$/u);
  }
});

test("mientras no haya API key, ninguna zona se declara verificada", () => {
  // Cuando alguien verifique una zona contra la API real, este test le recordará que la promesa
  // `verified: true` hay que sostenerla: se relaja zona a zona, no de golpe.
  for (const zone of COASTAL_ZONES) {
    assert.equal(zone.verified, false, `la zona ${zone.code} se declara verificada sin prueba`);
  }
});

test("dos puertos de la misma provincia comparten zona", () => {
  assert.deepEqual(zoneForPort("cabo-de-palos"), zoneForPort("la-manga-del-mar-menor"));
});
