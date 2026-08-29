/**
 * Los dos colores del manifiesto son **los tokens del design brief**, no una paleta nueva.
 *
 * Un `.webmanifest` lo lee el sistema operativo, no el CSS: no puede consumir una custom property
 * ni entiende `oklch()` en todas las plataformas que nos importan, así que ahí hay dos literales
 * hexadecimales. Este test es lo que impide que se conviertan en una paleta paralela: lee
 * `packages/ui/src/tokens.css`, convierte los dos tokens de OKLCH a sRGB y comprueba que salen
 * estos. Si alguien retoca `--m-bg` o `--m-navy` y no toca `marca.ts`, esto se pone rojo.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { COLOR_FONDO, COLOR_MARCA, MANIFIESTO, RUTA_ICONO, iconoSvg } from "./marca.ts";

const TOKENS = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "packages",
  "ui",
  "src",
  "tokens.css",
);

/**
 * OKLCH (L en 0-1, C, H en grados) → sRGB con codificación gamma, en 0-1.
 *
 * Mismo cuerpo que el de `adversario-t10.test.ts`, y con la misma excepción del linter por el mismo
 * motivo: el nombre de la función acaba en las tres letras de una función de color, pero aquí no se
 * escribe ningún color — se convierten los que declara `tokens.css`.
 */
// anti-slop-allow: `rgb(` aquí es el nombre de la conversión OKLCH→sRGB, no un color literal
function oklchASrgb(L: number, C: number, H: number): { r: number; g: number; b: number } {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const bb = C * Math.sin(h);
  const l = (L + 0.396_337_777_4 * a + 0.215_803_757_3 * bb) ** 3;
  const m = (L - 0.105_561_345_8 * a - 0.063_854_172_8 * bb) ** 3;
  const s = (L - 0.089_484_177_5 * a - 1.291_485_548 * bb) ** 3;
  const lineal = {
    r: 4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
    g: -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
    b: -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
  };
  const codificar = (valor: number): number => {
    const x = Math.min(1, Math.max(0, valor));
    return x <= 0.003_130_8 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  };
  return { r: codificar(lineal.r), g: codificar(lineal.g), b: codificar(lineal.b) };
}

function comoHex({ r, g, b }: { r: number; g: number; b: number }): string {
  return `#${[r, g, b].map((canal) => Math.round(canal * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** El primer valor declarado para un token (el bloque del tema claro, que es el primero). */
function tokenEnHex(nombre: string): string {
  const css = readFileSync(TOKENS, "utf8");
  const encontrado = new RegExp(`${nombre}:\\s*oklch\\(\\s*([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)`, "u").exec(
    css,
  );
  assert.ok(encontrado, `no encuentro el token ${nombre} en tokens.css`);
  const [, l = "0", c = "0", h = "0"] = encontrado;
  // anti-slop-allow: `rgb(` es el nombre de la conversión OKLCH→sRGB; el color lo pone tokens.css
  return comoHex(oklchASrgb(Number(l) / 100, Number(c), Number(h)));
}

test("el color de fondo del manifiesto es el token `--m-bg` del brief", () => {
  assert.equal(COLOR_FONDO, tokenEnHex("--m-bg"));
  assert.equal(MANIFIESTO.background_color, COLOR_FONDO);
});

test("el color de marca del manifiesto es el token `--m-navy` del brief", () => {
  assert.equal(COLOR_MARCA, tokenEnHex("--m-navy"));
  assert.equal(MANIFIESTO.theme_color, COLOR_MARCA);
});

test("el icono usa esos dos colores y ninguno más", () => {
  const colores = new Set([...iconoSvg().matchAll(/#[0-9a-f]{6}/gu)].map((encontrado) => encontrado[0]));
  assert.deepEqual([...colores].sort(), [COLOR_FONDO, COLOR_MARCA].sort());
});

test("el manifiesto apunta a un icono vectorial y a la portada, no a un puerto concreto", () => {
  assert.equal(MANIFIESTO.start_url, "/");
  assert.deepEqual(MANIFIESTO.icons.map((icono) => icono.src), [RUTA_ICONO]);
  assert.equal(MANIFIESTO.icons[0]?.type, "image/svg+xml");
});

test("el manifiesto no promete lo que el portal no es: sin `standalone`, con la URL a la vista", () => {
  assert.equal(MANIFIESTO.display, "minimal-ui");
  assert.match(MANIFIESTO.description, /No apto para navegación/u);
  assert.match(MANIFIESTO.description, /sin publicidad/u);
});
