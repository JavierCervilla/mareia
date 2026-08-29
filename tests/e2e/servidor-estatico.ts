/**
 * Servidor estático del `dist/` de la web, para los recorridos Playwright.
 *
 * Existe por una razón concreta: `astro preview` **se demoniza** (arranca el servidor, imprime su
 * PID y sale), así que el `webServer` de Playwright lo da por caído nada más lanzarlo. Un servidor
 * en primer plano, que muere cuando Playwright lo mata, cierra ese hueco sin añadir dependencias.
 *
 * Sirve exactamente lo que sirve un hosting estático del sitio y ni un byte más: las URL del portal
 * acaban en barra y el `dist/` son directorios con su `index.html` (`trailingSlash: "always"` en
 * `astro.config.mjs`), así que aquí se resuelve igual. Nada de listados de directorio, nada de
 * reescrituras: si un recorrido pasa contra esto, pasa contra el hosting.
 */

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const RAIZ = resolve(import.meta.dirname, "..", "..", "apps", "web", "dist");
const PUERTO = Number(process.env["PUERTO_ESTATICO"] ?? 4321);

/** Tipos MIME de lo único que publica el sitio. Sin adivinanzas: lo que no está, no se sirve. */
const TIPOS: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

/**
 * Fichero del disco que corresponde a una ruta, o `undefined` si no hay ninguno.
 *
 * El `normalize` sobre la ruta decodificada y la comprobación de que el resultado sigue dentro de
 * `dist/` no son ceremonia: sin ellas, un `..%2f..%2fetc/passwd` sale del directorio. Es un servidor
 * de pruebas, pero un servidor de pruebas que se puede escapar del directorio enseña a escribir mal
 * el que no lo es.
 */
function ficheroDe(ruta: string): string | undefined {
  const limpia = normalize(decodeURIComponent(ruta.split("?")[0] ?? "/"));
  const destino = resolve(join(RAIZ, limpia));
  if (destino !== RAIZ && !destino.startsWith(`${RAIZ}/`)) {
    return undefined;
  }
  if (existsSync(destino) && statSync(destino).isDirectory()) {
    const indice = join(destino, "index.html");
    return existsSync(indice) ? indice : undefined;
  }
  return existsSync(destino) ? destino : undefined;
}

createServer((peticion, respuesta) => {
  const fichero = ficheroDe(peticion.url ?? "/");
  if (fichero === undefined) {
    respuesta.writeHead(404, { "content-type": TIPOS[".txt"] ?? "" }).end("404");
    return;
  }
  respuesta.writeHead(200, { "content-type": TIPOS[extname(fichero)] ?? "application/octet-stream" });
  createReadStream(fichero).pipe(respuesta);
}).listen(PUERTO, "127.0.0.1", () => {
  console.warn(`[mareia] dist/ servido en http://127.0.0.1:${PUERTO}/`);
});
