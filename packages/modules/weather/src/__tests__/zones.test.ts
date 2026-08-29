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

/** Los doce del piloto, para los que el mapeo se escribió a mano en T-08. */
const PILOTO = [
  "a-coruna",
  "bilbao",
  "cabo-de-palos",
  "cadiz",
  "huelva",
  "la-manga-del-mar-menor",
  "las-palmas-de-gran-canaria",
  "malaga",
  "palma-de-mallorca",
  "santa-cruz-de-tenerife",
  "santander",
  "vigo",
] as const;

test("los 12 puertos del piloto tienen zona marítima asignada", () => {
  const slugs = new Set(catalogueSlugs());
  for (const slug of PILOTO) {
    assert.ok(slugs.has(slug), `el piloto '${slug}' ya no está en el catálogo`);
    assert.ok(zoneForPort(slug) !== undefined, `el puerto '${slug}' no tiene zona de AEMET`);
  }
});

/**
 * T-13 llevó el catálogo de 12 puertos a toda la costa española y **el mapeo de zonas no creció con
 * él**: asignar la zona costera de AEMET a ciento y pico puertos es trabajo editorial (las zonas no
 * siguen la frontera de provincia) y no se hace a ojo desde una trayectoria de datos.
 *
 * El módulo ya degrada bien —`zoneForPort` devuelve `undefined` y el boletín responde `unavailable`
 * con su motivo—, así que el hueco no rompe nada. Este test lo deja **contado** en vez de callado:
 * si alguien amplía el mapeo, la cifra sube y se actualiza aquí a sabiendas; si alguien lo rompe,
 * baja. Lo que no puede pasar es que la cobertura se pierda sin que nadie se entere.
 */
test("la cobertura de zonas marítimas es un hueco conocido, no un olvido", () => {
  const slugs = catalogueSlugs();
  const conZona = slugs.filter((slug) => zoneForPort(slug) !== undefined);
  assert.ok(
    conZona.length >= PILOTO.length,
    `la cobertura ha bajado de ${PILOTO.length} a ${conZona.length} puertos`,
  );
  assert.ok(
    conZona.length < slugs.length,
    "si ya están todos mapeados, borra este test y exige cobertura completa",
  );
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
