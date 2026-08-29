/**
 * La carga del motor de mareas, en su propio módulo y con `import()` dinámico.
 *
 * El motor (`pwa/dia-offline.ts` → `@mareia/domain-core`) es ~70 kB de tabla de constituyentes y
 * correcciones nodales: la mayor parte de todo el JavaScript del sitio, y solo hace falta cuando
 * alguien pide un día distinto del que publica la página. Cortarlo aquí es lo que deja el bundle
 * base de la página de puerto en unos pocos kB.
 *
 * Vive aparte de `otro-dia.ts` porque lo llaman **dos** sitios por motivos distintos: la
 * calculadora, para calcular, y la sección de favoritos, para **precargarlo antes de guardar** — el
 * trozo del motor es un fichero con hash bajo `/_astro/` y tiene que estar descargado para poder
 * entrar en la copia offline. Si no, calcular sin red fallaría pidiendo un fichero que no está, que
 * es justo el momento en el que no se puede pedir nada.
 */

/** El módulo del motor, cargado (y cacheado por el propio `import()`) una vez por pestaña. */
export async function motorCargado(): Promise<typeof import("../dia-offline.ts")> {
  return import("../dia-offline.ts");
}
